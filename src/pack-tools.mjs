// Max build 2: the ad-pack tools the platform bots call (make_pack_ad, make_pack_carousel, make_pack_video).
// Each tool reads specs/<platform>.md from the team folder, makes exactly the formats its "pack" line lists, measures
// every file against that platform's safe zone (and contrast for stills), and writes a check note. Nothing costs money.
import {z} from 'zod';
import {mkdir, rm, readFile} from 'node:fs/promises';

import {ffmpeg} from './media.mjs';
import {imageDataUrl} from './book-builder.mjs';
import {imageSize} from './book-pictures.mjs';
import {contrastProblems} from './carousel-builder.mjs';
import {parsePageMd, pageHtml, pageWordProblems, requiredSections, pageFiles, zipStore, pageCheckNote, PAGE_PLATFORMS, PAGE_CHECK_SCRIPT, posterPath, businessName} from './pack-page.mjs';
import {readableAccent, PLATFORMS, FPS, parseSpec, packFormats, stillPage, panelShape, videoPage, videoTiming, STILL_SCRIPT, HIDE_WORDS_CSS, VIDEO_SETUP, videoFrameScript, holdFrames, contactSheetHtml, packToFix, packCheckNote, AD_VIDEO_SECONDS, VIDEO_SECONDS} from './pack-maker.mjs';

// Max build 7 (22 Nov 2026): JJBM's busy photos (branches, leaves, gravel) made a 15 s 1440 px video over 20 MB and the save failed.
// The encoder now keeps quality (CRF 18) but never goes over 8 Mbit/s (a 15 s video stays near 15 MB; Meta and others re-encode
// uploads to far less), and finished pack videos may be saved up to 100 MB as a safety net.
export const VIDEO_MAXRATE = '8M', VIDEO_BUFSIZE = '16M', VIDEO_MAX_FILE_BYTES = 100000000;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour like #1B3A9E');
export const brandSchema = z.object({
  primary: hex.describe('Main brand colour (the top label text)'), accent: hex.describe('Accent colour (badges, step circles)'), accentText: hex.optional(),
  panel: hex.describe('Deep colour behind the words (the fade)'), soft: hex.optional().describe('Light colour for small lines'),
  name: z.string().min(1).max(60).describe('Business name as it should show; use \\n for a line break, e.g. "ADVANCED\\nROOFING SERVICES"'),
  place: z.string().max(60).default(''),
});
const label = z.object({text: z.string().min(1).max(14), side: z.enum(['left', 'right']), at: z.number().min(0.05).max(0.9).default(0.32), colour: hex.optional()});
const focus = z.union([z.string().max(20), z.object({square: z.string().max(20).optional(), tall: z.string().max(20).optional(), story: z.string().max(20).optional(), wide: z.string().max(20).optional()})]);
const words = {
  photo: z.string().min(1).max(300).describe('A photo in the team folder: the business\'s own, from clients/<business>/photos/'),
  focus: focus.optional().describe('Crop position "x% y%" (50% 50% is the middle), or one per shape {square, tall, story, wide}'),
  tag: z.string().max(48).optional().describe('Short top label, e.g. "ROOF RESTORATION · PERTH & ROCKINGHAM"'),
  headline: z.string().max(60).optional(), headlineSize: z.number().min(3).max(12).optional(),
  big: z.string().max(12).optional().describe('A large number line, e.g. "20-YEAR"'), bigSize: z.number().min(6).max(20).optional(), big2: z.string().max(40).optional(),
  quote: z.string().max(110).optional().describe('A review or owner quote, word for word from the fact file, in curly quotes'), quoteSize: z.number().min(3).max(8).optional(),
  who: z.string().max(70).optional(), sub: z.string().max(110).optional(),
  badge: z.string().max(36).optional().describe('Green pill, e.g. "20-year workmanship guarantee"'),
};
const adSchema = z.object({name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/), ...words, labels: z.array(label).max(2).optional()});
const cardSchema = z.object({role: z.enum(['title', 'step', 'end']).default('step'), ...words, step: z.string().max(3).optional().describe('A step number, e.g. "1"'), stepLabel: z.string().max(20).optional().describe('"STEP 1 OF 4" with a step number, or alone a word label in a pill, e.g. "TREE WORK"')});
const mainLine = x => x.headline || x.big || x.quote;

export function registerPackTools({register, text, teamFolder, renderPage, renderFrames, shrinkImage, signal}) {
  if (!teamFolder || !renderPage) return;
  const clean = p => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
  const readSpec = async platform => {
    let md;
    try { md = (await readFile(await teamFolder.target(null, `specs/${platform}.md`))).toString('utf8'); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`specs/${platform}.md is missing from the team folder.`); throw error; }
    return parseSpec(md, platform);
  };
  // Photos go into the page as data URLs (the page has no network). Small photos are noted: on a large canvas they look soft.
  const loadPhotos = async (items, widest) => {
    const images = {}, notes = [], missing = [];
    for (const it of items) {
      if (!it.photo || images[it.photo]) continue;
      let bytes;
      try { bytes = await readFile(await teamFolder.target(null, it.photo)); } catch (error) { if (error.code === 'ENOENT') { missing.push(`The photo ${it.photo} was not found in the team folder.`); continue; } throw error; }
      const size = imageSize(bytes);
      if (size && size.w < widest * 0.75) notes.push(`${it.photo} is ${size.w} pixels wide and the widest format here is ${widest}, so it is enlarged and may look soft; use a larger copy of the same photo if the business has one.`);
      images[it.photo] = imageDataUrl(shrinkImage ? await shrinkImage(bytes, 2600, 90) : bytes, shrinkImage ? 'x.jpg' : it.photo);
    }
    return {images, notes, missing};
  };
  const work = async (folder, platform) => { const rel = `${folder}/${platform}/_work`; const dir = await teamFolder.target(null, rel, true); await rm(dir, {recursive: true, force: true}); await mkdir(dir, {recursive: true}); return {rel, dir}; };
  const drawStill = async ({html, f, rel, scratch}) => {
    await teamFolder.writeBytes(null, scratch + '/page.html', Buffer.from(html));
    const shot = await renderPage({file: await teamFolder.target(null, scratch + '/page.html'), width: f.width, height: f.height, root: teamFolder.root(), signal, script: STILL_SCRIPT, hideCss: HIDE_WORDS_CSS, quality: 92});
    const measured = shot.background ? contrastProblems(shot.result.texts, shot.background.bitmap, f.width, f.height) : {problems: []};
    await teamFolder.writeBytes(null, rel, shot.jpeg);
    return {file: rel, format: f.id, width: f.width, height: f.height, problems: [...shot.result.problems, ...measured.problems], shrunk: shot.result.shrunk};
  };
  const drawVideo = async ({html, f, rel, scratch, scratchDir, seconds, cards = 1}) => {
    if (!renderFrames) throw new Error('This Max build cannot make videos (no frame renderer).');
    await teamFolder.writeBytes(null, scratch + '/video.html', Buffer.from(html));
    const frames = Math.round(seconds * FPS), tmp = scratchDir + '/video.mp4';
    let child;
    const encoding = ffmpeg(['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-maxrate', VIDEO_MAXRATE, '-bufsize', VIDEO_BUFSIZE, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), tmp], {signal, onSpawn: c => { child = c; }});
    encoding.catch(() => {});
    const write = buf => new Promise((resolve, reject) => { if (!child || child.stdin.destroyed) return reject(new Error('The video encoder stopped.')); child.stdin.write(buf, e => e ? reject(e) : resolve()); });
    const holds = new Set(holdFrames(cards, seconds)), kept = [];
    const onFrame = async (buf, i) => { if (holds.has(i)) kept.push(buf); await write(buf); };
    const {result} = await renderFrames({file: await teamFolder.target(null, scratch + '/video.html'), width: f.width, height: f.height, root: teamFolder.root(), signal, frames, setup: VIDEO_SETUP, frameScript: videoFrameScript, onFrame, quality: 92});
    child.stdin.end(); await encoding;
    await teamFolder.writeBytes(null, rel, await readFile(tmp), {maxFileBytes: VIDEO_MAX_FILE_BYTES});
    // A contact sheet of every card at its fullest, so Visual Check can look at the video (it cannot play it).
    const sheet = contactSheetHtml(kept.map(b => imageDataUrl(b, 'x.jpg')), f.width, f.height), sheetRel = rel.replace(/\.mp4$/, '-sheet.jpg');
    await teamFolder.writeBytes(null, scratch + '/sheet.html', Buffer.from(sheet.html));
    const shot = await renderPage({file: await teamFolder.target(null, scratch + '/sheet.html'), width: sheet.width, height: sheet.height, root: teamFolder.root(), signal, quality: 88});
    await teamFolder.writeBytes(null, sheetRel, shot.jpeg);
    return {sheet: sheetRel, file: rel, format: f.id, width: f.width, height: f.height, problems: result?.problems || [], shrunk: result?.shrunk || []};
  };
  let brandNow = null;
  const finish = async ({tool, platform, folder, name, spec, results, notes, missing}) => {
    if (brandNow && readableAccent(brandNow.accent, brandNow.accentText || '#FFFFFF').toUpperCase() !== brandNow.accent.toUpperCase()) notes.push(`White words on the accent ${brandNow.accent} were hard to read, so badges and step circles use a deeper shade of it, ${readableAccent(brandNow.accent, brandNow.accentText || '#FFFFFF')}.`);
    const toFix = [...missing, ...packToFix(results)], check = `${folder}/${platform}/${name}-check.md`;
    await teamFolder.writeBytes(null, check, Buffer.from(packCheckNote({tool, platform, name, specChecked: spec.checked, results, toFix, notes})));
    await rm(await teamFolder.target(null, `${folder}/${platform}/_work`, true), {recursive: true, force: true}).catch(() => {});
    return text({platform, passed: toFix.length === 0, files: results.map(r => r.file), sheets: results.map(r => r.sheet).filter(Boolean), toFix, notes, check, note: toFix.length ? 'Not passed. Change the focus or the sizes and run it again; if the words must change, ask Ad Writer (never change the words yourself).' : 'Passed the safe-zone and contrast checks. Look at every still, and every video\'s -sheet.jpg, with zoom_team_image before handing on.'});
  };
  const platformField = z.enum(PLATFORMS).describe('Your platform. Formats, sizes and safe zones come from specs/<platform>.md');
  const folderField = z.string().min(1).max(200).describe('The pack folder, e.g. clients/advanced-roofing/free-pack. Files go into <folder>/<platform>/');

  register('make_pack_ad', 'Make one ad for your platform in every shape its spec sheet\'s pack line lists ("ad" stills and "adVideo" short videos). Sizes and safe zones come from specs/<platform>.md; never set sizes yourself. Give the brand (colours measured from their site, name, place) and the ad: the business\'s own photo, an optional top label, ONE main line (headline, big + big2, or quote + who), an optional sub line, labels (e.g. BEFORE/AFTER) and a badge. Every word must come from the fact file (rule sheet T1 to T5). The tool fits the words inside the safe zone and clear of any button column, measures every file (safe zone, cut words, overlaps, lone last words, contrast) and writes <folder>/<platform>/<name>-check.md. Costs nothing.',
    {platform: platformField, folder: folderField, brand: brandSchema, ad: adSchema},
    async ({platform, folder, brand, ad}) => {
      folder = clean(folder); brandNow = brand;
      if (!mainLine(ad)) return text({passed: false, toFix: ['The ad needs one main line: headline, big, or quote.']});
      const spec = await readSpec(platform), stills = packFormats(spec, 'ad'), videos = packFormats(spec, 'adVideo');
      if (!stills.length && !videos.length) return text({passed: true, files: [], note: `specs/${platform}.md lists no ad formats: nothing to make.`});
      const {images, notes, missing} = await loadPhotos([ad], Math.max(...[...stills, ...videos].map(f => f.width)));
      if (missing.length) return text({passed: false, toFix: missing});
      const {rel: scratch, dir: scratchDir} = await work(folder, platform), results = [];
      for (const f of stills) results.push(await drawStill({html: stillPage({item: ad, brand, f, images, gp: panelShape(f)}), f, rel: `${folder}/${platform}/${ad.name}-${f.id}.jpg`, scratch}));
      for (const f of videos) results.push(await drawVideo({html: videoPage({cards: [ad], brand, f, images, seconds: AD_VIDEO_SECONDS}), f, rel: `${folder}/${platform}/${ad.name}-${f.id}.mp4`, scratch, scratchDir, seconds: AD_VIDEO_SECONDS, cards: 1}));
      return finish({tool: 'make_pack_ad', platform, folder, name: ad.name, spec, results, notes, missing});
    });

  register('make_pack_carousel', 'Make a carousel (still cards) for your platform in the shapes its spec sheet\'s pack line lists ("carousel"). Cards in order: optionally one role "title" card first (headline, sub), then "step" cards (step "1", stepLabel "STEP 1 OF 4", headline, sub), the last card with the badge (guarantee or free quote). The tool adds "1 / 5" and "Swipe to see how" / "Next" itself. Same words rules and checks as make_pack_ad; writes <folder>/<platform>/<name>-check.md. If the pack line lists no carousel (TikTok), make the carousel with make_pack_video instead.',
    {platform: platformField, folder: folderField, brand: brandSchema, name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/).default('F-carousel'), swipe: z.string().max(40).optional().describe('Words on the first card, e.g. "Swipe to see what we do →" (default "Swipe to see how →")'), cards: z.array(cardSchema).min(2).max(10)},
    async ({platform, folder, brand, name, swipe, cards}) => {
      folder = clean(folder); brandNow = brand;
      const bad = cards.map((c, i) => mainLine(c) ? null : `Card ${i + 1} needs a headline (or big line or quote).`).filter(Boolean);
      if (bad.length) return text({passed: false, toFix: bad});
      const spec = await readSpec(platform), formats = packFormats(spec, 'carousel');
      if (!formats.length) return text({passed: true, files: [], note: `specs/${platform}.md lists no still carousel: make it with make_pack_video.`});
      const {images, notes, missing} = await loadPhotos(cards, Math.max(...formats.map(f => f.width)));
      if (missing.length) return text({passed: false, toFix: missing});
      const {rel: scratch} = await work(folder, platform), results = [], n = cards.length;
      for (const f of formats) for (let i = 0; i < n; i++) {
        const item = {...cards[i], count: `${i + 1} / ${n}`, swipe: i === 0 ? (swipe || 'Swipe to see how →') : i < n - 1 ? 'Next →' : undefined};
        results.push(await drawStill({html: stillPage({item, brand, f, images}), f, rel: `${folder}/${platform}/${name}-${i + 1}of${n}-${f.id}.jpg`, scratch}));
      }
      return finish({tool: 'make_pack_carousel', platform, folder, name, spec, results, notes, missing});
    });


  // Build 11: the private page. Page Builder writes pages/<business>/page.md; this makes the page from it.
  register('make_pack_page', 'Make a pack\'s private page from pages/<business>/page.md (written by Page Builder from words the checkers passed). Writes pages/<business>/index.html with the pack\'s own files beside it (files/<platform>/...: every still and video page.md names, from clients/<business>/free-pack/<platform>/, and the form image from clients/<business>/photos/), one zip of images per platform, a still (poster) for every video, page-preview.jpg (desktop) and page-preview-phone.jpg (phone) showing the whole page (a long page gets -2, -3 parts) to look at, and page-check.md. Build 12 design: one big preview per ad with platform tabs, videos play when clicked, the carousel works like a feed carousel, and the thanks section uses Tavin\'s fixed words (page.md needs only the Buttons line there). It checks that every named file exists, that page.md has the title, Intro, How to test them and If you found these useful sections, that no customer word breaks the house rules (no notes, rule names, source marks, bot names, Hopkins, dashes or promises), and, in the finished page, that every picture loads, every video plays, the carousel holds all its cards and nothing sticks out sideways on a phone. Colours come from free-pack/ads.json. It never publishes anything. Costs nothing.',
    {business: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/).describe('The business folder name, e.g. "jjbm" (clients/jjbm, pages/jjbm)')},
    async ({business}) => {
      const dir = `pages/${business}`; let md;
      try { md = (await readFile(await teamFolder.target(null, `${dir}/page.md`))).toString('utf8'); }
      catch (error) { if (error.code === 'ENOENT') return text({passed: false, toFix: [`${dir}/page.md is missing: Page Builder writes it first.`]}); throw error; }
      let brand = {};
      try { brand = JSON.parse((await readFile(await teamFolder.target(null, `clients/${business}/free-pack/ads.json`))).toString('utf8')).brand || {}; } catch {}
      const page = parsePageMd(md), files = pageFiles(page, business), toFix = [...requiredSections(page).map(m => `page.md is missing ${m}.`), ...pageWordProblems(md)], notes = [];
      if (!files.length) toFix.push('page.md names no files: each ad needs a "Files:" list with one line per platform.');
      for (const old of ['files', 'posters', ...PAGE_PLATFORMS.map(p => `${business}-${p}-images.zip`), ...[2, 3, 4, 5, 6].flatMap(n => [`page-preview-${n}.jpg`, `page-preview-phone-${n}.jpg`])]) await rm(await teamFolder.target(null, `${dir}/${old}`, true), {recursive: true, force: true}).catch(() => {});
      if (!businessName(page)) toFix.push('page.md has no business name in its title ("# Your new ads, <name>").');
      const zipParts = {}, posters = new Set(); let bytes = 0;
      for (const f of files) {
        let data;
        try { data = await readFile(await teamFolder.target(null, f.from)); } catch (error) { if (error.code === 'ENOENT') { toFix.push(`page.md names ${f.name} for ${f.platform}, but ${f.from} does not exist.`); continue; } throw error; }
        await teamFolder.writeBytes(null, `${dir}/${f.to}`, data, {maxFileBytes: VIDEO_MAX_FILE_BYTES}); bytes += data.length;
        if (f.platform !== 'form' && /\.(jpe?g|png)$/i.test(f.name)) (zipParts[f.platform] ||= []).push({name: `${business}-${f.platform}/${f.name}`, data});
        if (f.platform === 'form' && /\.(jpe?g|png)$/i.test(f.name)) {
          // Build 13: the page shows a light copy of the form photo (the original can be 12 MB); the download stays the original.
          try { const {stdout} = await ffmpeg(['-i', await teamFolder.target(null, `${dir}/${f.to}`), '-vf', "scale='min(1200,iw)':-2", '-q:v', '3', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'], {signal});
            if (stdout.length) { const shown = posterPath('form', f.name); await teamFolder.writeBytes(null, `${dir}/${shown}`, stdout); posters.add(shown); bytes += stdout.length; } } catch { /* the page then shows the original */ }
        }
        if (/\.mp4$/i.test(f.name)) {
          // Build 12: a still for each video, so the page loads no video until it is clicked.
          try { const {stdout} = await ffmpeg(['-ss', '0.5', '-i', await teamFolder.target(null, `${dir}/${f.to}`), '-frames:v', '1', '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1'], {signal});
            if (!stdout.length) throw new Error('no picture');
            const poster = posterPath(f.platform, f.name); await teamFolder.writeBytes(null, `${dir}/${poster}`, stdout); posters.add(poster); bytes += stdout.length; }
          catch (error) { toFix.push(`${f.from} could not be read as a video (${String(error.message || error).slice(0, 120)}).`); }
        }
      }
      const zips = [];
      for (const p of PAGE_PLATFORMS) if (zipParts[p]?.length) { const file = `${business}-${p}-images.zip`, zip = zipStore(zipParts[p]); await teamFolder.writeBytes(null, `${dir}/${file}`, zip, {maxFileBytes: VIDEO_MAX_FILE_BYTES}); bytes += zip.length; zips.push({platform: p, file, count: zipParts[p].length, mb: Math.round(zip.length / 1e5) / 10}); }
      const html = pageHtml({page, business, brand, zips, posters});
      await teamFolder.writeBytes(null, `${dir}/index.html`, Buffer.from(html));
      if (!/\$\d/.test(md) || /links added by Tavin/i.test(md)) notes.push('The payment buttons have no links yet: Tavin adds the Whop links before the page goes live.');
      notes.push('Nothing was published. The page folder is ready for Tavin to look at and publish.');
      // Build 12: check the finished page in the browser (desktop, then phone), then picture the whole page at both sizes.
      const previews = [], pageFile = await teamFolder.target(null, `${dir}/index.html`), heights = {};
      for (const [size, width, height] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
        try {
          const {result: r} = await renderPage({file: pageFile, width, height, root: teamFolder.root(), signal, script: PAGE_CHECK_SCRIPT, quality: 60});
          if (!r) throw new Error('the page script did not run');
          heights[size] = r.height;
          if (size === 'desktop') {
            for (const b of r.badImages) toFix.push(`The page could not show ${b}.`);
            for (const b of r.badVideos) toFix.push(`The video ${b} did not play in the page.`);
            if (r.wantCards && r.cards !== r.wantCards) toFix.push(`The carousel shows ${r.cards} cards, not ${r.wantCards}.`);
          }
          if (r.overflow) toFix.push(`On ${size === 'phone' ? 'a phone' : 'a desktop'} something on the page sticks out sideways.`);
        } catch (error) { toFix.push(`The page could not be checked on ${size} (${String(error.message || error).slice(0, 120)}).`); }
      }
      // A long page is pictured in parts (one picture can be at most about 15000 pixels tall): page-preview.jpg, page-preview-2.jpg, ...
      const MAX_SHOT = 15000;
      for (const [base, size, width] of [['page-preview', 'desktop', 1280], ['page-preview-phone', 'phone', 390]]) {
        const total = Math.max(900, heights[size] || 2600), parts = Math.ceil(total / MAX_SHOT), height = Math.ceil(total / parts);
        for (let i = 0; i < parts; i++) {
          const name = `${base}${i ? '-' + (i + 1) : ''}.jpg`;
          try { const shot = await renderPage({file: pageFile, width, height, root: teamFolder.root(), signal, quality: 80, script: `(()=>{document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,${i * height});return new Promise(r=>setTimeout(r,150));})()`}); await teamFolder.writeBytes(null, `${dir}/${name}`, shot.jpeg); previews.push(`${dir}/${name}`); }
          catch (error) { notes.push(`The ${name} preview could not be made (${String(error.message || error).slice(0, 120)}).`); }
        }
      }
      const result = toFix.length ? `FAILED (${toFix.length} to fix)` : 'PASSED', check = `${dir}/page-check.md`;
      await teamFolder.writeBytes(null, check, Buffer.from(pageCheckNote({business, result, files, zips, toFix, notes, bytes})));
      return text({passed: !toFix.length, page: `${dir}/index.html`, previews, zips: zips.map(z => `${dir}/${z.file}`), files: files.length, toFix, notes, check, note: toFix.length ? 'Not passed. Fix page.md (or ask the bot that owns a missing file) and run make_pack_page again.' : 'Passed. Look at every preview picture (previews) with zoom_team_image, top to bottom, before you finish.'});
    });

  if (renderFrames) register('make_pack_video', 'Make the carousel as a 15-second video for your platform, in the shapes its spec sheet\'s pack line lists ("carouselVideo"). Give the same cards as make_pack_carousel. House rules built in (Tavin, 21 Nov 2026): a "title" card is left out (the video opens on step 1) unless keepTitleCard is true; card 1\'s words are on screen from the first frame; the top label and business name stay fixed; cards swipe on feed shapes and dissolve on 9:16; no sound. Every card is measured at its fullest moment against the safe zone. Writes <folder>/<platform>/<name>-video-check.md.',
    {platform: platformField, folder: folderField, brand: brandSchema, name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/).default('F-carousel'), cards: z.array(cardSchema).min(2).max(10), keepTitleCard: z.boolean().default(false), transition: z.enum(['swipe', 'dissolve']).optional().describe('Leave out for the house rule (swipe on feed, dissolve on 9:16)')},
    async ({platform, folder, brand, name, cards, keepTitleCard, transition}) => {
      folder = clean(folder); brandNow = brand;
      const used = keepTitleCard ? cards : cards.filter(c => c.role !== 'title');
      if (used.length < 2) return text({passed: false, toFix: ['A video needs at least 2 cards after the title card is left out.']});
      const bad = used.map((c, i) => mainLine(c) ? null : `Card ${i + 1} needs a headline (or big line or quote).`).filter(Boolean);
      if (bad.length) return text({passed: false, toFix: bad});
      const spec = await readSpec(platform), formats = packFormats(spec, 'carouselVideo');
      if (!formats.length) return text({passed: true, files: [], note: `specs/${platform}.md lists no carousel video: nothing to make.`});
      const {images, notes, missing} = await loadPhotos(used, Math.max(...formats.map(f => f.width)));
      if (missing.length) return text({passed: false, toFix: missing});
      const {rel: scratch, dir: scratchDir} = await work(folder, platform), results = [], seconds = videoTiming(used.length, VIDEO_SECONDS).total;
      for (const f of formats) results.push(await drawVideo({html: videoPage({cards: used, brand, f, images, transition, seconds}), f, rel: `${folder}/${platform}/${name}-video-${f.id}.mp4`, scratch, scratchDir, seconds, cards: used.length}));
      return finish({tool: 'make_pack_video', platform, folder, name: name + '-video', spec, results, notes, missing});
    });
}
