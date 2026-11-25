// Build 20: renders one page with Max's own renderPage inside Electron (as the app does). Usage:
// node node_modules/electron/install.js (once), then: xvfb-run -a node_modules/electron/dist/electron --no-sandbox scripts/pack-preview/electron-one.cjs <name> <script file>
// It reads /home/claude/etest/<name>.html and writes <name>.png beside it.
const {app} = require('electron'); const fs = require('fs');
const {renderPage} = require('/home/claude/max/src/pdf-maker.cjs');
app.disableHardwareAcceleration();
const [n, scriptFile] = process.argv.slice(-2);
app.whenReady().then(async () => {
  try { const r = await renderPage({file: `/home/claude/etest/${n}.html`, width: 1080, height: 1080, root: '/home/claude/etest', script: fs.readFileSync(scriptFile,'utf8'), quality: 90});
    fs.writeFileSync(`/home/claude/etest/${n}.png`, r.png || r.jpeg); console.log('RESULT', n, JSON.stringify(r.result.problems)); } catch (e) { console.log('RESULT', n, 'ERR', e.message); }
  app.quit();
});
