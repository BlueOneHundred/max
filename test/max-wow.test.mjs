// Max build 14: the WOW ads maker (make_wow_ad). Rendering needs Electron, so the tool test uses a stand-in renderPage;
// the layouts themselves were checked in Chrome (scripts/pack-preview/wowtest.mjs) on McCance's real photo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync} from 'node:fs';
import {writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {z} from 'zod';
import * as W from '../src/wow-ads.mjs';
import {registerPackTools} from '../src/pack-tools.mjs';
import {contrastRatio} from '../src/pack-maker.mjs';

const brand = {primary: '#0E6137', accent: '#00781F', panel: '#0A2616', soft: '#E4F2E8', name: 'MCCANCE\nPLUMBING & HEATING', place: 'OKOTOKS'};
const base = {button: 'Learn more', logoLine: 'McCANCE PLUMBING & HEATING · OKOTOKS'};
const good = {
  'problem-fix': {headline: "No heat at 2am?\n**We're 24/7.**", proof: '**4.9 ★** from 1,218 Google reviews', photo: 'clients/m/photos/van.jpg'},
  'split-claim': {kicker: 'BURST PIPE?', headline: "We're\nquick.", proofBig: '30 of 92', proofText: 'reviews say so.*', footnote: '*30 of 92 written reviews say quick.', photo: 'clients/m/photos/van.jpg'},
  'big-review': {kicker: 'FURNACE NOT WORKING?', quote: 'Were there in a few hours... fixed!', stars: 5, who: 'Mike C., Google review, Nov 2026', photo: 'clients/m/photos/van.jpg'},
  'bold-text': {kicker: 'NO HOT WATER?', headline: 'Tank or\ntankless,\nwe fix it.', badge: 'Okotoks · Since 2006'},
  'big-number': {kicker: 'PICKING A PLUMBER?', number: '1,218', numberLine: 'Google reviews. **4.9 ★**', photo: 'clients/m/photos/van.jpg'},
  preview: {headline: "No heat at 2am?\n**We're 24/7.**", proof: '**4.9 ★** from 1,218 Google reviews', photo: 'library/stand-ins/02-heating.png'},
};

test('build 14: the six approved layouts pass the word checks with McCance\'s approved words', () => {
  for (const layout of W.WOW_LAYOUTS) assert.deepEqual(W.wowWordProblems({name: 'x', layout, ...base, ...good[layout]}), [], layout);
});

test('build 14: the WOW test and house rules are enforced before drawing', () => {
  const p = (layout, extra) => W.wowWordProblems({name: 'x', layout, ...base, ...good[layout], ...extra}).join(' | ');
  assert.match(p('problem-fix', {headline: 'Your heating fixed fast by our friendly local team'}), /9 words.*7 or fewer/);
  assert.match(p('big-review', {quote: 'They came quickly and fixed our old furnace in an hour'}), /quote has 11 words/);
  assert.match(p('bold-text', {kicker: 'NO HOT WATER — EVER?'}), /em or en dash/);
  assert.match(p('bold-text', {badge: '30 of 92 reviews*'}), /\* mark but there is no footnote/);
  assert.match(p('problem-fix', {photo: 'library/stand-ins/02-heating.png'}), /stand-in photo may only be used in the "preview"/);
  assert.match(p('preview', {photo: 'clients/m/photos/van.jpg'}), /preview must use a stand-in/);
  assert.match(p('split-claim', {proofBig: ''}), /needs "proofBig"/);
  assert.match(p('problem-fix', {proof: 'Fast, friendly, fair and fully licensed for every heating and drain job in Okotoks and towns near it', headline: 'No heat?'}), /words on the picture.*20 or fewer/);
});

test('build 14: colours are made readable (highlight on the panel, white on the accent)', () => {
  const C = W.wowColours(brand);
  assert.ok(contrastRatio(C.highlight, C.panel) >= 6, C.highlight);
  assert.ok(contrastRatio('#FFFFFF', C.accent) >= 4.5);
  assert.ok(contrastRatio(C.panel, C.soft) >= 9);
  const yellow = W.wowColours({accent: '#FFD400', panel: '#3A3A3A'});
  assert.ok(contrastRatio('#FFFFFF', yellow.accent) >= 4.5 && contrastRatio('#FFFFFF', yellow.panel) >= 7);
  assert.ok(yellow.notes.length >= 1);
});

test('build 14: the page carries the band only on the preview, and ★ and ** are drawn', () => {
  const images = {'clients/m/photos/van.jpg': 'data:image/png;base64,AA==', 'library/stand-ins/02-heating.png': 'data:image/png;base64,AA=='};
  const pre = W.wowPage({ad: {name: 'p', layout: 'preview', ...base, ...good.preview}, brand, images});
  assert.ok(pre.includes(W.BAND_TEXT));
  const one = W.wowPage({ad: {name: 'a', layout: 'problem-fix', ...base, ...good['problem-fix']}, brand, images});
  assert.ok(!one.includes(W.BAND_TEXT));
  assert.ok(one.includes('<em>We&#39;re 24/7.</em>') || one.includes("<em>We're 24/7.</em>"));
  assert.ok(one.includes('<svg class="star"') && !one.includes('★'));
  assert.ok(one.includes("font-family:'Anton'") && one.includes('font/woff2'));
});

test('build 14: make_wow_ad writes PNGs, a PREVIEW file name, check notes and a sheet; refuses two previews', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wow-'));
  for (const f of ['clients/m/photos/van.jpg', 'library/stand-ins/02-heating.png']) { mkdirSync(dirname(join(root, f)), {recursive: true}); writeFileSync(join(root, f), Buffer.from('/9j/4AAQ', 'base64')); }
  const teamFolder = {root: () => root, target: async (_b, p) => resolve(root, p), writeBytes: async (_b, p, bytes) => { const f = resolve(root, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
  const pages = [];
  const renderPage = async ({file, width, height, script}) => { pages.push({file, width, height}); return {jpeg: Buffer.from('jpeg'), png: Buffer.from('png'), result: script ? {problems: [], shrunk: [{k: 'headline', from: 118, to: 110}], texts: []} : null, background: null}; };
  const tools = {};
  registerPackTools({register: (n, d, s, h) => { tools[n] = {s, h}; }, text: o => o, teamFolder, renderPage, renderFrames: null, shrinkImage: null, signal: new AbortController().signal});
  assert.ok(tools.make_wow_ad, 'registered');
  const ads = W.WOW_LAYOUTS.map((layout, i) => ({name: `w${i}`, layout, ...base, ...good[layout]}));
  const args = z.object(tools.make_wow_ad.s).parse({folder: 'clients/m/wow', brand, ads});
  const r = await tools.make_wow_ad.h(args);
  assert.equal(r.passed, true, JSON.stringify(r.toFix));
  assert.equal(r.files.length, 6);
  assert.ok(r.files.includes('clients/m/wow/w5-PREVIEW.png'));
  for (const f of r.files) assert.equal(readFileSync(join(root, f), 'utf8'), 'png');
  assert.ok(existsSync(join(root, 'clients/m/wow/wow-sheet.jpg')));
  const note = readFileSync(join(root, 'clients/m/wow/w5-check.md'), 'utf8');
  assert.match(note, /PASSED/); assert.match(note, /Page only/); assert.match(note, /headline: 118 to 110 px/);
  assert.ok(pages.every(p => p.width === 1080 && p.height === 1080 || p.height === 620));
  const two = await tools.make_wow_ad.h(z.object(tools.make_wow_ad.s).parse({folder: 'clients/m/wow', brand, ads: [{...ads[5], name: 'a'}, {...ads[5], name: 'b'}]}));
  assert.equal(two.passed, false); assert.match(two.toFix.join(' '), /Only one preview/);
  const failing = await tools.make_wow_ad.h(z.object(tools.make_wow_ad.s).parse({folder: 'clients/m/wow', brand, ads: [{...ads[0], name: 'f', headline: 'One two three four five six seven eight'}]}));
  assert.equal(failing.passed, false); assert.equal(failing.files.length, 0);
  assert.match(readFileSync(join(root, 'clients/m/wow/f-check.md'), 'utf8'), /FAILED/);
});

test('build 14: make_wow_page makes the approved page; the sample is never a link; refuses a wrong preview or a dash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wowpage-'));
  const files = ['clients/m/current-ads/ad-1.jpg', 'clients/m/wow/a.png', 'clients/m/wow/b.png', 'clients/m/wow/p-PREVIEW.png', 'clients/m/wow/c.png', 'clients/m/wow/d.png'];
  for (const f of files) { mkdirSync(dirname(join(root, f)), {recursive: true}); writeFileSync(join(root, f), Buffer.from('iVBORw0KGgo=', 'base64')); }
  const teamFolder = {root: () => root, target: async (_b, p) => resolve(root, p), writeBytes: async (_b, p, bytes) => { const f = resolve(root, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
  const renderPage = async ({script}) => ({jpeg: Buffer.from('jpeg'), png: Buffer.from('png'), result: script ? {bad: [], overflow: false, previewLinked: false, downloads: 2, height: 3400} : null});
  const tools = {};
  registerPackTools({register: (n, d, s, h) => { tools[n] = {s, h}; }, text: o => o, teamFolder, renderPage, renderFrames: null, shrinkImage: null, signal: new AbortController().signal});
  const args = {business: 'm', name: 'McCance Plumbing & Heating', shortName: 'McCance', town: 'Okotoks', since: 'June 2024', brand,
    current: {file: files[0], title: 'Running since June 2024', text: 'Your van photo with no words on it.'},
    ads: [{file: files[1], title: 'No heat at 2am?', text: 'Your 24/7 service.'}, {file: files[2], title: 'No hot water?', text: 'Tank or tankless.'}],
    preview: {file: files[3]}, situation: 'Someone with no heat', insteadOf: 'parked vans', ownTitle: 'With your vans', ownLine: 'Vans show you have a fleet.',
    more: [files[4], files[5]], moreText: 'Made from your reviews, in your colours.'};
  const parse = a => z.object(tools.make_wow_page.s).parse(a);
  const r = await tools.make_wow_page.h(parse(args));
  assert.equal(r.passed, true, JSON.stringify(r.toFix));
  const html = readFileSync(join(root, 'pages/m/wow/index.html'), 'utf8');
  assert.equal((html.match(/ download="/g) || []).length, 2);
  assert.ok(!/href="[^"]*sample-with-technician/.test(html), 'the sample is never a link');
  assert.match(html, /Why you can&#39;t download this one|Why you can't download this one/);
  assert.match(html, /Someone with no heat is about to let a stranger into their home/);
  assert.match(html, /2 more designs are ready/); assert.match(html, /mailto:dan@blueonehundred\.com\?subject=McCance%20ads/);
  assert.ok(!html.includes('One thing we noticed'));
  for (const f of ['files/ad-1.png', 'files/ad-2.png', 'files/sample-with-technician.png', 'files/more-1.jpg', 'files/more-2.jpg', 'page-check.md']) assert.ok(existsSync(join(root, 'pages/m/wow', f)), f);
  assert.ok(!existsSync(join(root, 'pages/m/wow/files/c.png')), 'the real more designs are not copied');
  const bad = await tools.make_wow_page.h(parse({...args, preview: {file: files[1]}, ads: [args.ads[0], {...args.ads[1], file: files[3]}]}));
  assert.equal(bad.passed, false); assert.match(bad.toFix.join(' '), /-PREVIEW\.png/); assert.match(bad.toFix.join(' '), /never be one of the 2 ads/);
  const dash = await tools.make_wow_page.h(parse({...args, moreText: 'Ready now — free.'}));
  assert.equal(dash.passed, false); assert.match(dash.toFix.join(' '), /dash/);
});

test('build 15: "show" names the part of the photo; bad boxes and mixing with focus are refused', () => {
  assert.deepEqual(W.parseShow('78% 28% 98% 50%'), {x1: 78, y1: 28, x2: 98, y2: 50});
  assert.equal(W.parseShow('50% 50% 40% 60%'), null); assert.equal(W.parseShow('1 2 3'), null); assert.equal(W.parseShow('0 0 120 50'), null);
  const p = extra => W.wowWordProblems({name: 'x', layout: 'problem-fix', ...base, ...good['problem-fix'], ...extra}).join(' | ');
  assert.equal(p({show: '0% 30% 100% 82%'}), '');
  assert.match(p({show: 'middle'}), /"show" must be four numbers/);
  assert.match(p({show: '0 30 100 82', focus: '50% 50%'}), /not both/);
  const html = W.wowPage({ad: {name: 'a', layout: 'problem-fix', ...base, ...good['problem-fix'], show: '10 20 60 50'}, brand, images: {'clients/m/photos/van.jpg': 'data:image/png;base64,AA=='}});
  assert.match(html, /class="shown" data-show="10 20 60 50"/);
  assert.match(W.WOW_SCRIPT, /shown\.push/);
  assert.deepEqual(W.PHOTO_BOXES['big-review'], [1080, 330]);
});

test('build 16: no-photo big-review and big-number; set lines never wrap; bold-text all white; split frame starts at the panel', () => {
  for (const layout of ['big-review', 'big-number']) {
    const {photo, ...rest} = good[layout];
    assert.deepEqual(W.wowWordProblems({name: 'x', layout, ...base, ...rest}), [], layout);
    const html = W.wowPage({ad: {name: 'x', layout, ...base, ...rest}, brand, images: {}});
    assert.ok(!html.includes('class="photo'), layout + ' draws no photo frame');
    assert.ok(html.includes('class="band"') || html.includes('class="rule"'));
  }
  const bold = W.wowPage({ad: {name: 'b', layout: 'bold-text', ...base, ...good['bold-text'], headline: 'Pinpointed\non camera.\n**Video on a USB.**'}, brand, images: {}});
  assert.match(bold, /class="fit lines" data-k="headline"/);
  assert.match(bold, /h1 em\{color:#fff\}/);
  const one = W.wowPage({ad: {name: 'b', layout: 'bold-text', ...base, ...good['bold-text'], headline: 'Tank or tankless we fix it'}, brand, images: {}});
  assert.match(one, /class="fit" data-k="headline"/);
  assert.deepEqual(W.PHOTO_BOXES['split-claim'], [552, 1080]);
  const split = W.wowPage({ad: {name: 's', layout: 'split-claim', ...base, ...good['split-claim']}, brand, images: {'clients/m/photos/van.jpg': 'data:image/png;base64,AA=='}});
  assert.match(split, /\.side\{right:0;top:0;width:552px/);
  assert.match(split, /data-k="footnote" style="left:60px;top:926px/);
});

test('build 17: unset quotes and headlines are set in as few even lines as fit; a set quote never wraps', () => {
  assert.match(W.WOW_SCRIPT, /n0>1/); assert.match(W.WOW_SCRIPT, /max\*0\.72/);
  const {photo, ...rest} = good['big-review'];
  const set = W.wowPage({ad: {name: 'q', layout: 'big-review', ...base, ...rest, kicker: 'NO HOT WATER!', quote: 'Rapid after hours\nweekend response.'}, brand, images: {}});
  assert.match(set, /class="fit lines" data-k="quote"/);
  assert.match(set, /data-k="kicker" data-max="64"/);
});
