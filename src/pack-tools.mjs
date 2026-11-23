// Max build 2: the ad-pack tools the platform bots call (make_pack_ad, make_pack_carousel, make_pack_video).
// Each tool reads specs/<platform>.md from the team folder, makes exactly the formats its "pack" line lists, measures
// every file against that platform's safe zone (and contrast for stills), and writes a check note. Nothing costs money.
import {z} from 'zod';
import {mkdir, rm, readFile} from 'node:fs/promises';

import {ffmpeg} from './media.mjs';
import {imageDataUrl} from './book-builder.mjs';
import {imageSize} from './book-pictures.mjs';
import {contrastProblems} from './carousel-builder.mjs';
import {readableAccent, PLATFORMS, FPS, parseSpec, packFormats, stillPage, videoPage, videoTiming, STILL_SCRIPT, HIDE_WORDS_CSS, VIDEO_SETUP, videoFrameScript, holdFrames, contactSheetHtml, packToFix, packCheckNote, AD_VIDEO_SECONDS, VIDEO_SECONDS} from './pack-maker.mjs';

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
      for (const f of stills) results.push(await drawStill({html: stillPage({item: ad, brand, f, images}), f, rel: `${folder}/${platform}/${ad.name}-${f.id}.jpg`, scratch}));
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
