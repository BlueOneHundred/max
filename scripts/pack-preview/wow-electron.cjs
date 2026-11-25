// Build 21: runs the real make_wow_ad inside real Electron with the app's own renderPage and shrinkImage (as main.cjs wires them).
// Usage: xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/pack-preview/wow-electron.cjs <team root> <ads.json> shrink
const {app, nativeImage} = require('electron'); const fs = require('fs'); const path = require('path');
app.disableHardwareAcceleration();
const [root, json, shrinkFlag] = process.argv.slice(-3);
app.whenReady().then(async () => {
  try {
    const {renderPage} = require('/home/claude/max/src/pdf-maker.cjs');
    const {registerPackTools} = await import('/home/claude/max/src/pack-tools.mjs');
    const {z} = await import('/home/claude/max/node_modules/zod/index.js');
    const teamFolder = {root: () => root, target: async (_b, p) => path.resolve(root, p), writeBytes: async (_b, p, bytes) => { const f = path.resolve(root, p); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, bytes); return true; }};
    const shrinkImage = async (bytes, max = 1400, quality = 86) => { const image = nativeImage.createFromBuffer(Buffer.from(bytes)); const {width, height} = image.getSize(); console.log('nativeImage size', width, height); const out = width > max ? image.resize({width: max, quality: 'good'}) : image; console.log('shrunk to', out.getSize()); return out.toJPEG(quality); };
    const tools = {};
    registerPackTools({register: (n, d, s, h) => { tools[n] = {h, s}; }, text: o => o, teamFolder, renderPage: i => renderPage({root, ...i}), renderFrames: null, shrinkImage: shrinkFlag === 'shrink' ? shrinkImage : null, signal: new AbortController().signal});
    const args = z.object(tools.make_wow_ad.s).parse(JSON.parse(fs.readFileSync(json, 'utf8')));
    const r = await tools.make_wow_ad.h(args); console.log('RESULT', JSON.stringify({passed: r.passed, toFix: r.toFix}));
  } catch (e) { console.log('ERR', e.stack); }
  app.quit();
});
