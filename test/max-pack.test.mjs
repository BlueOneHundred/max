// Max build 2: ad-pack tools (spec sheets, layout, checks, tool wiring). Rendering itself needs Electron, so the
// tool tests use stand-ins for renderPage/renderFrames and check the files, check notes and refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import * as P from '../src/pack-maker.mjs';
import {registerPackTools} from '../src/pack-tools.mjs';

const sheet = name => readFileSync(new URL(`../templates/specs/${name}.md`, import.meta.url), 'utf8');

test('every starting spec sheet parses and its pack line names real formats', () => {
  for (const p of P.PLATFORMS) {
    const s = P.parseSpec(sheet(p), p);
    assert.equal(s.platform, p);
    for (const kind of P.PACK_KINDS) for (const f of P.packFormats(s, kind)) assert.ok(f && f.width && f.height, `${p} ${kind}`);
  }
});

test('the approved pack lists (decision 47) are what the sheets say', () => {
  const ids = (p, k) => P.packFormats(P.parseSpec(sheet(p), p), k).map(f => f.id);
  assert.deepEqual(ids('facebook', 'ad'), ['feed-4x5', 'feed-1x1', 'reels-stories-9x16']);
  assert.deepEqual(ids('instagram', 'ad'), ['feed-4x5', 'reels-stories-9x16']);
  assert.deepEqual(ids('tiktok', 'ad'), []); assert.deepEqual(ids('tiktok', 'adVideo'), ['infeed-9x16']);
  assert.deepEqual(ids('linkedin', 'carouselVideo'), ['video-1x1', 'video-4x5', 'video-16x9']);
  assert.deepEqual(ids('x', 'carouselVideo'), ['image-1x1', 'wide-16x9', 'vertical-9x16']);
});

test('Meta 9:16 safe zone is 14% top, 35% bottom, 6% sides', () => {
  for (const p of ['facebook', 'instagram']) {
    const f = P.parseSpec(sheet(p), p).formats.find(x => x.id === 'reels-stories-9x16');
    assert.ok(Math.abs(f.safe.top / f.height - 0.14) < 0.002 && Math.abs(f.safe.bottom / f.height - 0.35) < 0.002 && Math.abs(f.safe.left / f.width - 0.06) < 0.002);
  }
});

test('a broken spec sheet is refused with the reasons', () => {
  assert.throws(() => P.parseSpec('no block here', 'x'), /no Formats block/);
  assert.throws(() => P.parseSpec('```json\n{bad json}\n```', 'x'), /not valid JSON/);
  const bad = {platform: 'x', pack: {ad: ['nope'], adVideo: [], carousel: [], carouselVideo: []}, formats: [{id: 'a-1', width: 1080, height: 1080, safe: {top: 0, bottom: 0, left: 0, right: 0, blocks: [[1000, 0, 200, 10]]}}]};
  assert.throws(() => P.parseSpec('```json\n' + JSON.stringify(bad) + '\n```', 'x'), /block outside the frame.*"nope"/);
});

test('TikTok: the word column ends before the button column', () => {
  const f = P.parseSpec(sheet('tiktok'), 'tiktok').formats.find(x => x.id === 'infeed-9x16');
  const L = P.layoutBox(f);
  assert.ok(f.width - L.right <= 780, 'words stop left of x = 780');
  assert.ok(L.left >= 120 && L.top >= 240 && L.bottom >= 660);
});

test('shapes and the 9:16 word size', () => {
  assert.equal(P.shapeOf({width: 1920, height: 1080}), 'wide');
  assert.equal(P.shapeOf({width: 1080, height: 1920}), 'story');
  assert.equal(P.shapeOf({width: 1440, height: 1800}), 'tall');
  assert.equal(P.shapeOf({width: 1080, height: 1080}), 'square');
  assert.ok(Math.abs(P.layoutBox({width: 1440, height: 2560, safe: {top: 0, bottom: 0, left: 0, right: 0}}).u - 14.4 * 1.2) < 1e-9);
});

test('videos run 15 seconds; the last card holds 3.6 s; a still ad video is one card', () => {
  const t = P.videoTiming(4);
  assert.equal(t.total, 15); assert.deepEqual(t.durs.map(x => Math.round(x * 100) / 100), [3.8, 3.8, 3.8, 3.6]); assert.deepEqual(t.starts.map(x => Math.round(x * 100) / 100), [0, 3.8, 7.6, 11.4]);
  assert.deepEqual(P.videoTiming(1, 8), {durs: [8], starts: [0], total: 8});
});

test('a deeper shade is used when white words on the accent are hard to read', () => {
  assert.ok(P.contrastRatio(P.readableAccent('#2E9B3E'), '#FFFFFF') >= 4.5);
  assert.equal(P.readableAccent('#1B3A9E'), '#1B3A9E');
});

test('words are escaped, the business name keeps its line break, and video keeps the label and name fixed', () => {
  const f = {id: 'feed-1x1', width: 1080, height: 1080, safe: {top: 54, bottom: 54, left: 54, right: 54, blocks: []}};
  const brand = {primary: '#1B3A9E', accent: '#2E9B3E', panel: '#0A1842', name: 'A&B\nROOFING', place: 'PERTH'};
  const html = P.stillPage({item: {headline: '<script>x</script> **Same** roof', tag: 'T & U', badge: 'Free'}, brand, f, images: {}});
  assert.ok(!html.includes('<script>x</script>') && html.includes('&lt;script&gt;') && html.includes('<b>Same</b>') && html.includes('A&amp;B<br>ROOFING') && html.includes('T &amp; U'));
  const v = P.videoPage({cards: [{headline: 'One', tag: 'TAG'}, {headline: 'Two', tag: 'TAG'}], brand, f, images: {}});
  assert.match(v, /<div id="fixed"[^>]*><div class="tag" data-k="tag">TAG<\/div>/);
  assert.equal((v.match(/data-k="tag"/g) || []).length, 1, 'only the fixed label is measured');
  assert.match(v, /DIS:false/);
  assert.match(P.videoPage({cards: [{headline: 'A'}, {headline: 'B'}], brand, f: {...f, width: 1080, height: 1920}, images: {}}), /DIS:true/);
});

test('check notes say PASSED or FAILED with the reasons in plain words', () => {
  const results = [{file: 'a.jpg', format: 'feed-1x1', width: 1080, height: 1080, problems: [{kind: 'block', text: 'ADVANCED', where: 'brand'}]}, {file: 'b.jpg', format: 'feed-4x5', width: 1080, height: 1350, problems: []}];
  const toFix = P.packToFix(results);
  assert.deepEqual(toFix, ['a.jpg: "ADVANCED" (brand) sits under the platform\'s button column.']);
  const note = P.packCheckNote({tool: 'make_pack_ad', platform: 'tiktok', name: 'A', specChecked: '2026-11-21', results, toFix});
  assert.match(note, /Result: FAILED/); assert.match(note, /\| b\.jpg \| feed-4x5 \| 1080 x 1350 \| PASS \|/);
  assert.match(P.packCheckNote({tool: 't', platform: 'x', name: 'B', results: [results[1]], toFix: []}), /Result: PASSED/);
});

function teamSetup() {
  const root = mkdtempSync(join(tmpdir(), 'max-pack-'));
  mkdirSync(join(root, 'specs')); for (const p of P.PLATFORMS) writeFileSync(join(root, 'specs', p + '.md'), sheet(p));
  mkdirSync(join(root, 'photos'));
  // a tiny real JPEG header is not needed: imageSize may return null for these bytes, which is fine
  writeFileSync(join(root, 'photos', 'roof.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const teamFolder = {root: () => root, target: async (_b, p) => resolve(root, p), writeBytes: async (_b, p, bytes) => { const f = resolve(root, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
  const calls = [];
  const renderPage = async ({width, height, script}) => { calls.push({width, height, script}); return {jpeg: Buffer.from('jpeg'), result: {problems: width === 1440 && height === 2560 ? [{kind: 'outside', text: 'Same roof.', where: 'h'}] : [], texts: [], shrunk: []}, background: null, width, height}; };
  const tools = {};
  registerPackTools({register: (n, d, s, h) => { tools[n] = {h, s, d}; }, text: o => o, teamFolder, renderPage, renderFrames: null, shrinkImage: null, signal: new AbortController().signal});
  return {root, tools, calls};
}
const brand = {primary: '#1B3A9E', accent: '#2E9B3E', panel: '#0A1842', name: 'ADVANCED\nROOFING SERVICES', place: 'PERTH'};

test('make_pack_ad makes every format the sheet lists, writes the check note, and fails a file outside the safe zone', async () => {
  const {root, tools, calls} = teamSetup();
  assert.ok(tools.make_pack_ad && tools.make_pack_carousel && !tools.make_pack_video, 'no video tool without a frame renderer');
  const r = await tools.make_pack_ad.h({platform: 'facebook', folder: 'clients/a/free-pack', brand, ad: {name: 'A-test', photo: 'photos/roof.jpg', headline: 'Same roof.', badge: 'Free quote'}});
  assert.deepEqual(r.files, ['clients/a/free-pack/facebook/A-test-feed-4x5.jpg', 'clients/a/free-pack/facebook/A-test-feed-1x1.jpg', 'clients/a/free-pack/facebook/A-test-reels-stories-9x16.jpg']);
  assert.deepEqual(calls.map(c => c.width + 'x' + c.height), ['1440x1800', '1440x1440', '1440x2560']);
  assert.equal(r.passed, false); assert.equal(r.toFix.length, 1); assert.match(r.toFix[0], /reels-stories-9x16\.jpg: "Same roof\." \(h\) reaches into the platform's safe zone/);
  const note = await readFile(join(root, 'clients/a/free-pack/facebook/A-test-check.md'), 'utf8');
  assert.match(note, /Result: FAILED/); assert.match(note, /deeper shade of it, #268436/);
  assert.ok(existsSync(join(root, 'clients/a/free-pack/facebook/A-test-feed-1x1.jpg')));
  assert.ok(!existsSync(join(root, 'clients/a/free-pack/facebook/_work')), 'scratch folder removed');
});

test('make_pack_ad refuses a missing photo or an ad with no main line, before drawing anything', async () => {
  const {tools, calls} = teamSetup();
  assert.match((await tools.make_pack_ad.h({platform: 'instagram', folder: 'p', brand, ad: {name: 'B', photo: 'photos/none.jpg', headline: 'Hi'}})).toFix[0], /was not found/);
  assert.match((await tools.make_pack_ad.h({platform: 'instagram', folder: 'p', brand, ad: {name: 'B', photo: 'photos/roof.jpg', sub: 'only a sub'}})).toFix[0], /one main line/);
  assert.equal(calls.length, 0);
});

test('make_pack_carousel adds the count and swipe words, and TikTok is pointed to the video tool', async () => {
  const {tools, calls} = teamSetup();
  const cards = [{role: 'title', photo: 'photos/roof.jpg', headline: 'Every roof, in 2 steps.'}, {photo: 'photos/roof.jpg', step: '1', stepLabel: 'STEP 1 OF 2', headline: 'Inspect.'}, {photo: 'photos/roof.jpg', step: '2', stepLabel: 'STEP 2 OF 2', headline: 'Paint.', badge: 'Free quote'}];
  const r = await tools.make_pack_carousel.h({platform: 'linkedin', folder: 'p', brand, name: 'F-carousel', cards});
  assert.equal(r.passed, true); assert.equal(r.files.length, 3); assert.match(r.files[0], /F-carousel-1of3-carousel-1x1\.jpg$/);
  assert.equal(calls.length, 3);
  const t = await tools.make_pack_carousel.h({platform: 'tiktok', folder: 'p', brand, name: 'F-carousel', cards});
  assert.equal(t.files.length, 0); assert.match(t.note, /make_pack_video/);
});

test('the business name stacks under the words on wide frames and where buttons narrow the column', () => {
  const tiktok = P.parseSpec(sheet('tiktok'), 'tiktok').formats[0], fb = P.parseSpec(sheet('facebook'), 'facebook').formats.find(f => f.id === 'reels-stories-9x16');
  const wide = P.parseSpec(sheet('linkedin'), 'linkedin').formats.find(f => f.id === 'video-16x9');
  assert.equal(P.stacked(tiktok), true); assert.equal(P.stacked(wide), true); assert.equal(P.stacked(fb), false);
  assert.match(P.stillPage({item: {headline: 'x'}, brand: {name: 'B', place: ''}, f: tiktok, images: {}}), /class="f story stack"/);
  assert.match(P.videoPage({cards: [{headline: 'a'}, {headline: 'b'}], brand: {name: 'B'}, f: wide, images: {}}), /id="fixed" class="wide stack"/);
  assert.match(P.packToFix([{file: 'v.mp4', problems: [{kind: 'floating', text: 'B', where: 'brand'}]}])[0], /floats mid-frame/);
});

test('videos get a contact sheet of every card at its fullest', () => {
  assert.deepEqual(P.holdFrames(4, 15), [50, 164, 278, 392]);
  assert.deepEqual(P.holdFrames(1, 8), [50]);
  const s = P.contactSheetHtml(['a', 'b'], 1920, 1080);
  assert.equal(s.height, 672); assert.equal((s.html.match(/<img /g) || []).length, 2);
});

test('a word label without a step number becomes a pill', () => {
  const f = {id: 'c', width: 1080, height: 1080, safe: {top: 54, bottom: 54, left: 54, right: 54, blocks: []}};
  const h = P.stillPage({item: {stepLabel: 'TREE WORK', headline: 'Tree removal.'}, brand: {name: 'J'}, f, images: {}});
  assert.match(h, /<div class="kick a" data-a="step" data-k="kick">TREE WORK<\/div>/); assert.doesNotMatch(h, /stepnum/);
});

// Max build 7 (22 Nov 2026): JJBM's carousel video was over 20 MB and could not be saved.
test('build 7: pack videos may be saved up to 100 MB; other files keep the 20 MB limit', async () => {
  const {TeamFolder} = await import('../src/team-folder.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'max-b7-')), team = new TeamFolder(dir);
  const big = Buffer.alloc(25000000, 1);
  await assert.rejects(team.writeBytes(null, 'a/too-big.mp4', big), /smaller than 20 MB/);
  const saved = await team.writeBytes(null, 'a/video.mp4', big, {maxFileBytes: 100000000});
  assert.equal(saved.bytes, 25000000);
  await assert.rejects(team.writeBytes(null, 'a/huge.mp4', big, {maxFileBytes: 10 ** 10}).then(() => team.writeBytes(null, 'a/huger.mp4', Buffer.alloc(100000001, 1), {maxFileBytes: 10 ** 10})), /smaller than 100 MB/);
});

test('build 7: the video encoder caps the bitrate so a 15 s video stays near 15 MB', async () => {
  const T = await import('../src/pack-tools.mjs');
  assert.equal(T.VIDEO_MAXRATE, '8M');
  assert.equal(T.VIDEO_MAX_FILE_BYTES, 100000000);
  const src = readFileSync(new URL('../src/pack-tools.mjs', import.meta.url), 'utf8');
  assert.match(src, /'-maxrate', VIDEO_MAXRATE, '-bufsize', VIDEO_BUFSIZE/);
  assert.match(src, /writeBytes\(null, rel, await readFile\(tmp\), \{maxFileBytes: VIDEO_MAX_FILE_BYTES\}\)/);
});

test('build 7: a video keeps the top label fixed only when every card shares it', () => {
  const spec = P.parseSpec(sheet('facebook'), 'facebook'), f = P.packFormats(spec, 'carouselVideo')[0];
  const brand = {primary: '#0256C6', accent: '#007018', panel: '#042054', name: 'JJBM', place: 'ANSONIA'};
  const fixedPart = html => html.slice(html.indexOf('<div id="fixed"'), html.indexOf('<script>'));
  const differ = P.videoPage({cards: [{tag: 'TREE REMOVAL · ANSONIA', headline: 'Trees.'}, {tag: 'LAWN CARE · ANSONIA', headline: 'Lawns.'}], brand, f, images: {}});
  assert.ok(!fixedPart(differ).includes('class="tag"'), 'no fixed label when the labels differ');
  assert.ok(differ.includes('TREE REMOVAL · ANSONIA') && differ.includes('LAWN CARE · ANSONIA'), 'each card keeps its own label');
  const same = P.videoPage({cards: [{tag: 'ROOFING · LEEDS', headline: 'One.'}, {tag: 'ROOFING · LEEDS', headline: 'Two.'}], brand, f, images: {}});
  assert.ok(fixedPart(same).includes('ROOFING · LEEDS'), 'one shared label stays fixed');
  assert.equal(same.split('ROOFING · LEEDS').length - 1, 1, 'and is drawn once');
});

test('build 8: a lone last word counts by width, not letters, and the counter has a solid pill', () => {
  const js = P.PACK_JS(P.packFormats(P.parseSpec(sheet('instagram'), 'instagram'), 'ad')[0]);
  assert.match(js, /end\.words\.length===1&&\(end\.right-end\.left\)<0\.5\*\(before\.right-before\.left\)/, 'short last line under half the line above');
  assert.doesNotMatch(js, /length<=6\?end\.words\[0\]/, 'the old 6-letter limit is gone ("Connecticut." was missed)');
  const css = P.packCss(P.packFormats(P.parseSpec(sheet('facebook'), 'facebook'), 'carousel')[0], {primary: '#0256C6', accent: '#007018', panel: '#042054', name: 'J'});
  assert.match(css, /\.count\{[^}]*background:rgba\(4,32,84,\.92\)/, 'counter pill in the panel colour');
});

test('build 10: the 16:9 fade sits only behind the words (bottom left), with no side option', () => {
  const brand = {primary: '#0256C6', accent: '#007018', panel: '#042054', name: 'JJBM', place: 'ANSONIA'};
  const wide = P.packFormats(P.parseSpec(sheet('linkedin'), 'linkedin'), 'carouselVideo').find(f => P.shapeOf(f) === 'wide');
  const css = P.packCss(wide, brand);
  assert.match(css, /\.wide \.shade\{top:0;right:0;width:auto;background:radial-gradient\(ellipse [^)]* at 0% 100%/, 'fade from the bottom-left corner');
  assert.ok(!/\.wide\.right/.test(css), 'no right-side layout');
  assert.match(P.frameHtml({item: {headline: 'A', side: 'right'}, brand, f: wide}), /class="f wide stack"/, 'side is ignored');
});

test('build 11: make_pack_page reads page.md, lists files per platform and blocks notes and rule names', async () => {
  const G = await import('../src/pack-page.mjs');
  const md = ['# Your new ads, Test Co', '', 'Made for Test Co · Perth, Australia', '', '## Intro', '', 'Two of your ads have run since 2024.', '',
    '## Ad A: Roofs', '', 'On the image: "Roofs done right."', '', 'Why:', '- The principle: be specific. Your own number.', '', 'Headline: Roof repairs in Perth', '', 'Main text:', 'Line one.', 'Line two.', '',
    'Files:', '- Facebook: A-roof-feed-4x5.jpg (4:5 feed), A-roof-feed-1x1.jpg (1:1 feed)', '- TikTok: A-roof-infeed-9x16.mp4 (9:16 video)', '',
    '## Lead form', '', 'Form image: own-01.jpg (your crew)', '', '## How to test them', '', '1. Run them.', '2. Compare cost per lead.', '', '## If you found these useful', '', "Yours to keep. Pay what you think it's worth (optional).", '', 'Buttons: $25 / $50 / $100 / $250 (links added by Tavin)'].join('\n');
  const page = G.parsePageMd(md);
  assert.equal(page.title, 'Your new ads, Test Co');
  assert.deepEqual(G.requiredSections(page), []);
  assert.deepEqual(G.pageWordProblems(md), []);
  const files = G.pageFiles(page, 'test-co');
  assert.deepEqual(files.map(f => f.from), ['clients/test-co/free-pack/facebook/A-roof-feed-4x5.jpg', 'clients/test-co/free-pack/facebook/A-roof-feed-1x1.jpg', 'clients/test-co/free-pack/tiktok/A-roof-infeed-9x16.mp4', 'clients/test-co/photos/own-01.jpg']);
  const main = page.sections[1].blocks.find(b => b.key === 'Main text');
  assert.deepEqual(main.lines, ['Line one.', 'Line two.']);
  const html = G.pageHtml({page, business: 'test-co', brand: {primary: '#0256C6', accent: '#007018'}, zips: [{platform: 'facebook', file: 'test-co-facebook-images.zip', count: 2}]});
  assert.match(html, /noindex, nofollow/);
  assert.ok(!/<video /.test(html), 'build 12: no video loads until clicked');
  assert.match(html, /data-pay="\$25">\$25</);
  assert.ok(!/https?:\/\//.test(html.replace(/<script>[\s\S]*<\/script>/, '')), 'no network links');
  for (const bad of ['## For Max\nnothing', 'Rule Checker said so', 'T1 passed', 'source [S1]', 'Hopkins', '7am–8pm', 'Get more leads today']) assert.ok(G.pageWordProblems(md + '\n' + bad).length, bad);
  assert.deepEqual(G.requiredSections(G.parsePageMd('## Intro\nhi')).length, 3);
  const zip = G.zipStore([{name: 'a.txt', data: Buffer.from('hello')}]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50); assert.equal(G.crc32(Buffer.from('hello')), 0x3610a686);
});

test('build 12: the new page design (tabs, posters, working carousel, Tavin\'s thanks words, in-page check)', async () => {
  const G = await import('../src/pack-page.mjs');
  const md = ['# Your new ads, Test Co Roofing', '', 'Made for Test Co Roofing · Perth, Australia', '', '## Intro', '', 'Hello.', '', '## How we make ads', '', 'One idea.', '',
    '## Ad A: Roofs', '', 'On the image: "Roofs done right."', '', 'Why:', '- The principle: be specific.', '', 'Headline: Roof repairs in Perth', '', 'Main text:', 'Line one.', 'Line two.', '',
    'Files:', '- Facebook: A-roof-feed-4x5.jpg (4:5 feed), A-roof-feed-1x1.jpg (1:1 feed)', '- TikTok: A-roof-infeed-9x16.mp4 (9:16 video)', '',
    '## Carousel F', '', 'On the first card: "One crew."', '', 'Headlines (one per card):', '1. One crew.', '2. Roofs.', '', 'Main text:', 'All of it.', '',
    'Files (2 square cards, in order):', '- Facebook: F-carousel-1of2-carousel-1x1.jpg, F-carousel-2of2-carousel-1x1.jpg (1:1 carousel cards)', '- TikTok: no still carousel; on TikTok the carousel runs as the video below', '',
    '## Lead form', '', 'Form headline: Free quote', '', 'Question to ask: "What do you need?" (Roof / Gutter)', '', 'Form image: own-01.jpg (your crew)', '',
    '## How to test them', '', '1. Run them.', '', '## If you found these useful', '', 'Buttons: $25 / $50 / $100 / $250 (links added by Tavin)'].join('\n');
  const page = G.parsePageMd(md), posters = new Set(['posters/tiktok/A-roof-infeed-9x16.jpg']);
  const d = G.pageData({page, business: 'test-co', zips: [{platform: 'facebook', file: 'test-co-facebook-images.zip', count: 4}], posters});
  assert.equal(d.biz, 'Test Co Roofing'); assert.equal(d.initials, 'TCR');
  assert.equal(d.ads[0].onimage, 'Roofs done right.', 'quotes taken off');
  assert.deepEqual(Object.keys(d.ads[0].files), ['Facebook', 'TikTok']);
  assert.equal(d.ads[0].files.TikTok.items[0].poster, 'posters/tiktok/A-roof-infeed-9x16.jpg');
  assert.equal(d.ads[0].files.Facebook.items[0].shape, '4:5');
  assert.deepEqual(d.car.heads, ['One crew.', 'Roofs.']); assert.equal(d.car.files.Facebook.items.length, 2); assert.equal(d.car.files.TikTok.items.length, 0);
  assert.deepEqual(d.pay, ['$25', '$50', '$100', '$250']); assert.equal(d.lead.img, 'files/form/own-01.jpg');
  assert.equal(G.posterPath('tiktok', 'A-x-9x16.mp4'), 'posters/tiktok/A-x-9x16.jpg');
  const html = G.pageHtml({page, business: 'test-co', brand: {primary: '#0256C6', accent: '#007018'}, zips: [], posters});
  assert.match(html, /If you found these useful\.\.\./);
  assert.ok(html.includes(G.thanksText('Test Co Roofing').replace(/'/g, '&#39;')), 'Tavin\'s words with the name filled in');
  assert.match(G.thanksText('X'), /^If you find what we have created for you to be useful to X, you're more than welcome to say thanks if you wish\. This is a completely optional gesture; everything we've created for you on this page is yours to download for free and use however you like\.$/);
  assert.match(html, /Prices in US dollars, paid securely through Whop\./); assert.ok(!/refund/i.test(html), 'no refund line');
  assert.ok(!/[\u2013\u2014]/.test(html), 'no dashes'); assert.match(html, /noindex, nofollow/);
  assert.ok(!/https?:\/\//.test(html), 'no network links');
  assert.ok(!/<\/script/i.test(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))), 'the data cannot close the script');
  assert.match(G.PAGE_CHECK_SCRIPT, /badVideos/); assert.doesNotThrow(() => new Function('return ' + G.PAGE_CHECK_SCRIPT));
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  assert.doesNotThrow(() => new Function('window', 'document', script), 'the page script parses');
});

test('build 13: tall (9:16) ads and videos use one panel; other shapes keep the fade; ad videos glide', () => {
  const f = s => P.packFormats(P.parseSpec(sheet(s), s), 'ad');
  const fb = P.parseSpec(sheet('facebook'), 'facebook'), all = [...P.packFormats(fb, 'ad'), ...P.packFormats(fb, 'carouselVideo')];
  const story = all.find(x => P.shapeOf(x) === 'story'), feed = all.find(x => P.shapeOf(x) !== 'story');
  assert.ok(story && feed);
  assert.equal(P.panelShape(story), true); assert.equal(P.panelShape(feed), false);
  const item = {headline: 'Drain cleaning in Okotoks.', sub: 'Since 2006.', badge: 'Ask us for a quote'}, brand = {name: 'TEST\nCO', place: 'TOWN', panel: '#0A2616'};
  assert.match(P.stillPage({item, brand, f: story, gp: true}), /class="f story stack gp"/, 'panel frame, name under the words');
  assert.doesNotMatch(P.stillPage({item, brand, f: feed}), /\bgp\b"/, 'feed shapes keep the fade');
  assert.match(P.packCss(story, brand), /\.f\.gp \.shade\{display:none\}/); assert.match(P.packCss(story, brand), /\.gpanel\{position:absolute;background:rgba\(10,38,22,\.9\)/);
  assert.match(P.STILL_SCRIPT, /panel\(fr,/);
  assert.match(P.PACK_JS(story), /function panel\(fr,brandEl\)\{const PAD=4\*PK\.u/);
  const one = P.videoPage({cards: [item], brand, f: story, images: {}, seconds: 8});
  assert.match(one, /class="f story stack gp"/); assert.match(one, /glideSetup/); assert.match(one, /GL=\{SPAN:40,PX:900,ZOOM:0\.12\}/);
  const many = P.videoPage({cards: [item, item, item], brand, f: story, images: {}});
  assert.equal((many.match(/class="f story stack gp"/g) || []).length, 3, 'every card of a tall carousel video has the panel');
  assert.match(many, /every card's panel the same width/);
  const wide = all.find(x => P.shapeOf(x) === 'wide') || P.packFormats(P.parseSpec(sheet('linkedin'), 'linkedin'), 'carouselVideo').find(x => P.shapeOf(x) === 'wide');
  if (wide) assert.doesNotMatch(P.videoPage({cards: [item, item], brand, f: wide, images: {}}), /class="f wide[^"]*\bgp\b/);
  assert.ok(f('tiktok').length >= 0);
});

test('build 13: the page keeps poster shapes, loops short videos, shows a light form photo and has a tab icon', async () => {
  const G = await import('../src/pack-page.mjs');
  const md = ['# Your new ads, Test Co', '', '## Intro', '', 'Hello.', '', '## Lead form', '', 'Form headline: A quote', '', 'Form image: own-01.jpg (your vans)', '', '## How to test them', '', '1. Run them.', '', '## If you found these useful', '', 'Buttons: $25 / $50 / $100 / $250 (links added by Tavin)'].join('\n');
  const page = G.parsePageMd(md);
  assert.equal(G.posterPath('form', 'own-01.png'), 'posters/form/own-01.jpg');
  const withShow = G.pageData({page, business: 'test-co', posters: new Set(['posters/form/own-01.jpg'])});
  assert.equal(withShow.lead.img, 'files/form/own-01.jpg', 'the download stays the original'); assert.equal(withShow.lead.show, 'posters/form/own-01.jpg');
  assert.equal(G.pageData({page, business: 'test-co'}).lead.show, 'files/form/own-01.jpg', 'no light copy: the original is shown');
  const html = G.pageHtml({page, business: 'test-co', brand: {}, zips: [], posters: new Set()});
  assert.match(html, /\.player img\{width:auto;height:auto;max-width:100%;max-height:100%\}/);
  assert.match(html, /v\.duration <= 10\) v\.loop = true/);
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/); assert.ok(!/https?:\/\//.test(html), 'still no network links');
});
