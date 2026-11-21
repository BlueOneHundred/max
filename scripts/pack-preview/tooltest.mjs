// Runs Max's real pack tools with a Chrome stand-in for Electron's renderPage/renderFrames and a simple team folder.
// Usage: node tooltest.mjs <team root>
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {chromium} from '/home/claude/max/node_modules/playwright-core/index.mjs';
import {registerPackTools} from '/home/claude/max/src/pack-tools.mjs';
const ROOT = process.argv[2];
const teamFolder = {root: () => ROOT, target: async (_b, p) => resolve(ROOT, p), writeBytes: async (_b, p, bytes) => { const f = resolve(ROOT, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files']});
const renderPage = async ({file, width, height, script, hideCss, quality}) => {
  const p = await browser.newPage({viewport: {width, height}}); await p.goto('file://' + file);
  const result = await p.evaluate(script); const jpeg = await p.screenshot({type: 'jpeg', quality});
  let background = null;
  if (hideCss) {
    await p.addStyleTag({content: hideCss}); const png = await p.screenshot({type: 'png'});
    // A BGRA bitmap like Electron's toBitmap, made with a canvas in the page.
    const b64 = await p.evaluate(async src => { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, i.width, i.height).data; for (let k = 0; k < d.length; k += 4) { const r = d[k]; d[k] = d[k + 2]; d[k + 2] = r; } let s = ''; for (let k = 0; k < d.length; k += 32768) s += String.fromCharCode.apply(null, d.subarray(k, k + 32768)); return btoa(s); }, png.toString('base64'));
    background = {bitmap: Buffer.from(b64, 'base64'), width, height};
  }
  await p.close(); return {jpeg, result, background, width, height};
};
const renderFrames = async ({file, width, height, frames, setup, frameScript, onFrame, quality}) => {
  const p = await browser.newPage({viewport: {width, height}}); await p.goto('file://' + file);
  const result = await p.evaluate(setup);
  for (let i = 0; i < frames; i++) { await p.evaluate(frameScript(i)); await onFrame(await p.screenshot({type: 'jpeg', quality}), i); }
  await p.close(); return {result};
};
const tools = {};
registerPackTools({register: (n, d, s, h) => { tools[n] = h; }, text: o => o, teamFolder, renderPage, renderFrames, shrinkImage: null, signal: new AbortController().signal});
const data = JSON.parse(await readFile('/home/claude/work/pack/ar.json', 'utf8'));
const brand = data.brand, photo = p => 'clients/advanced-roofing/photos/' + p;
const ad = {...data.ads[0], photo: photo(data.ads[0].photo)};
const cards = data.carousel.cards.map(c => ({...c, photo: photo(c.photo === 'IMG_4292.jpg' ? 'IMG_0164.jpg' : c.photo)}));
const folder = 'clients/advanced-roofing/free-pack';
const show = (label, r) => console.log(label, JSON.stringify({passed: r.passed, files: r.files, toFix: r.toFix, notes: r.notes, check: r.check}));
console.log(Object.keys(tools));
show('AD facebook', await tools.make_pack_ad({platform: 'facebook', folder, brand, ad}));
show('AD tiktok', await tools.make_pack_ad({platform: 'tiktok', folder, brand, ad}));
show('CAROUSEL linkedin', await tools.make_pack_carousel({platform: 'linkedin', folder, brand, name: 'F-carousel', cards}));
show('CAROUSEL tiktok', await tools.make_pack_carousel({platform: 'tiktok', folder, brand, name: 'F-carousel', cards}));
show('VIDEO x', await tools.make_pack_video({platform: 'x', folder, brand, name: 'F-carousel', cards, keepTitleCard: false}));
show('BAD ad', await tools.make_pack_ad({platform: 'instagram', folder, brand, ad: {...ad, name: 'Z-too-long', headline: 'A very long headline that will never fit nicely here at all', headlineSize: 12, photo: photo('missing.jpg')}}));
await browser.close();
