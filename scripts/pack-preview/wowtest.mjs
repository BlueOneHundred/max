// Build 14: runs the real make_wow_ad with a Chrome stand-in for Electron's renderPage (PNG too).
// Usage: node wowtest.mjs <team root> <ads.json>   (ads.json: {folder, brand, ads})
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {chromium} from '/home/claude/max/node_modules/playwright-core/index.mjs';
import {registerPackTools} from '/home/claude/max/src/pack-tools.mjs';
const ROOT = process.argv[2];
const teamFolder = {root: () => ROOT, target: async (_b, p) => resolve(ROOT, p), writeBytes: async (_b, p, bytes) => { const f = resolve(ROOT, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files']});
const renderPage = async ({file, width, height, script, hideCss, quality}) => {
  const p = await browser.newPage({viewport: {width, height}}); await p.goto('file://' + file);
  const result = script ? await p.evaluate(script) : null; const jpeg = await p.screenshot({type: 'jpeg', quality}); const png = await p.screenshot({type: 'png'});
  let background = null;
  if (hideCss) {
    await p.addStyleTag({content: hideCss}); const shot = await p.screenshot({type: 'png'});
    const b64 = await p.evaluate(async src => { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, i.width, i.height).data; for (let k = 0; k < d.length; k += 4) { const r = d[k]; d[k] = d[k + 2]; d[k + 2] = r; } let s = ''; for (let k = 0; k < d.length; k += 32768) s += String.fromCharCode.apply(null, d.subarray(k, k + 32768)); return btoa(s); }, shot.toString('base64'));
    background = {bitmap: Buffer.from(b64, 'base64'), width, height};
  }
  await p.close(); return {jpeg, png, result, background, width, height};
};
const tools = {};
registerPackTools({register: (n, d, s, h) => { tools[n] = {h, s}; }, text: o => o, teamFolder, renderPage, renderFrames: null, shrinkImage: null, signal: new AbortController().signal});
const {z} = await import('/home/claude/max/node_modules/zod/index.js');
const TOOL = process.argv[4] || "make_wow_ad";
const args = z.object(tools[TOOL].s).parse(JSON.parse(await readFile(process.argv[3], "utf8")));
console.log(JSON.stringify(await tools[TOOL].h(args), null, 1));
await browser.close();
