import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {imageSize} from '../src/book-pictures.mjs';
import {wowPageHtml, anatomyItems, keepPhones, ANATOMY_MARKS} from '../src/wow-page.mjs';
const require = createRequire(import.meta.url);
const {webpSize, decodeImage} = require('../src/image-decode.cjs');

// The first 40 bytes of three real 1500 x 1000 WebP files (lossy VP8, lossless VP8L, extended VP8X), made with Pillow.
const head = hex => Buffer.concat([Buffer.from(hex, 'hex'), Buffer.alloc(20)]);
const VP8 = head('52494646d40a00005745425056503820c80a0000f041019d012adc05e8033e9d4ea44e25a423a220');
const VP8L = head('5249464662000000574542505650384c550000002fdbc5f9000750ad2a14a5ff010045faff9f22fa');
const VP8X = head('52494646f80a000057454250565038580a00000008000000db0500e7030056503820c80a0000f041');

test('Max build 22: WebP sizes are read (all three kinds)', () => {
  for (const b of [VP8, VP8L, VP8X]) { assert.deepEqual(webpSize(b), {w: 1500, h: 1000}); assert.deepEqual(imageSize(b), {w: 1500, h: 1000}); }
  assert.equal(webpSize(Buffer.from('not a webp at all, just some text here')), null);
});

test('Max build 22: decodeImage uses nativeImage when it can, and draws a WebP in a page when it cannot', async () => {
  const made = [];
  const fake = ok => ({createFromBuffer: b => ({isEmpty: () => !ok && !made.length, size: b.length, getSize: () => ({width: 1, height: 1})})});
  const direct = await decodeImage(Buffer.from('png'), {nativeImage: fake(true), renderPage: async () => { throw new Error('should not draw'); }});
  assert.equal(direct.isEmpty(), false);
  let asked;
  const drawn = await decodeImage(VP8, {nativeImage: fake(false), maxSide: 600, renderPage: async input => { asked = input; made.push(1); return {png: Buffer.from('drawn')}; }});
  assert.equal(drawn.isEmpty(), false);
  assert.equal(asked.width, 600); assert.equal(asked.height, 400);
});

const brand = {panel: '#0A2616', accent: '#00781F', soft: '#E4F2E8', highlight: '#3DDC6E'};
const page = anatomy => wowPageHtml({name: 'Test Plumbing', slug: 'test-plumbing', brand, since: 'June 2024',
  current: {show: 'files/current-ad.jpg', title: 'Now', text: 'Their ad.'},
  ads: [{show: 'files/ad-1.png', download: 'files/ad-1.png', title: 'A', text: 'a', button: 'Learn more'}, {show: 'files/ad-2.png', download: 'files/ad-2.png', title: 'B', text: 'b', button: 'Learn more'}],
  preview: {show: 'files/sample-with-technician.png'}, situation: 'Someone with no heat', more: [{show: 'files/more-1.jpg'}], moreText: 'More.',
  note: {text: 'Your website lists (403) 982-2580 and +64 9 555 0123.'}, anatomy});

test('Max build 22: "why the new ads look like this" explains new ad 1 with its own words', () => {
  const items = anatomyItems({name: 'wow-1', layout: 'problem-fix', headline: 'No heat tonight?\n**We\'re 24/7.**', proof: '**4.9 ★** from 120 Google reviews', button: 'Learn more'});
  assert.deepEqual(items.map(i => i.quote), ['No heat tonight?', 'We\'re 24/7.', '4.9 ★ from 120 Google reviews', '', 'Learn more']);
  const html = page(items);
  assert.match(html, /Why the new ads look like this/);
  assert.equal((html.match(/class="mark/g) || []).length, ANATOMY_MARKS.length + 1, 'marks 1 to 4 on the picture, mark 5 on Facebook\'s button bar (build 26)');
  assert.match(html, /<q>No heat tonight\?<\/q>/);
  assert.doesNotMatch(html.slice(html.indexOf('Why the new ads')), /Your ad now/, 'their current ad is never scored');
  // Only a problem-fix ad 1 gets the section; the page is unchanged otherwise.
  assert.equal(anatomyItems({layout: 'big-review', quote: 'x', button: 'Go'}), null);
  assert.doesNotMatch(page(null), /Why the new ads look like this/);
  // A one-line headline leaves out the "answer" point and its mark.
  const one = anatomyItems({layout: 'problem-fix', headline: 'Blocked drain?', proof: '20 years', button: 'Call now'});
  assert.deepEqual(one.map(i => i.n), [1, 3, 4, 5]);
  assert.equal((page(one).match(/class="mark/g) || []).length, 4);
});

test('Max build 22: phone numbers stay on one line', () => {
  assert.equal(keepPhones('call (403) 625-6644 or 403.333.6645 now'), 'call <span class="nb">(403) 625-6644</span> or <span class="nb">403.333.6645</span> now');
  assert.match(page(null), /<span class="nb">\(403\) 982-2580<\/span>/);
  assert.equal(keepPhones('Since 2006, 1,218 reviews'), 'Since 2006, 1,218 reviews');
});

test('Max build 22: a failed bot reply names its cause in the stop reason', async () => {
  const {Pipelines} = await import('../src/pipeline.mjs');
  const service = {state: {bots: [{id: 'b1', name: 'Fact Finder'}], conversations: [{id: 'c1', botId: 'b1', updatedAt: 1, messages: [
    {role: 'user', content: 'go'}, {role: 'assistant', status: 'cancelled', error: 'Paused after repeated tool failures in a row.', activities: [{name: 'read_webpage', status: 'complete'}, {name: 'save_image_to_team', status: 'error'}, {name: 'save_image_to_team', status: 'error'}]}]}]}};
  const p = new Pipelines({directory: '/tmp', teamRoot: '/tmp', teamFolder: null, service, busy: () => false});
  assert.equal(p.failureDetail('', 'Fact Finder'), ' It said: "Paused after repeated tool failures in a row.". Tools: save_image_to_team failed 2 times.');
  assert.equal(p.failureDetail('', 'Nobody'), '');
});
