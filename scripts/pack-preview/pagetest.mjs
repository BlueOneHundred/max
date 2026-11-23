import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {chromium} from '/home/claude/max/node_modules/playwright-core/index.mjs';
import {registerPackTools} from '/home/claude/max/src/pack-tools.mjs';
const ROOT = process.argv[2], BIZ = process.argv[3] || 'jjbm';
const teamFolder = {root: () => ROOT, target: async (_b, p) => resolve(ROOT, p), writeBytes: async (_b, p, bytes) => { const f = resolve(ROOT, p); await mkdir(dirname(f), {recursive: true}); await writeFile(f, bytes); return true; }};
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']});
const renderPage = async ({file, width, height, script, quality}) => {
  const p = await browser.newPage({viewport: {width, height}}); await p.goto('file://' + file); await p.waitForTimeout(300);
  const result = script ? await p.evaluate(script) : null; const jpeg = await p.screenshot({type: 'jpeg', quality});
  await p.close(); return {jpeg, result, width, height};
};
const tools = {};
registerPackTools({register: (n, d, s, h) => { tools[n] = h; }, text: o => o, teamFolder, renderPage, renderFrames: async () => ({}), shrinkImage: null, signal: new AbortController().signal});
const t0 = Date.now(); const r = await tools.make_pack_page({business: BIZ});
console.log(JSON.stringify(r, null, 1), ((Date.now() - t0) / 1000).toFixed(1) + 's');
await browser.close();
