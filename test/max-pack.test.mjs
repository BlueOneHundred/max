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
