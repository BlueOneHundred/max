// Build 13 (24 Nov 2026): page check from outside the app. Usage: node pagecheck.mjs <page folder> (needs playwright-core and /usr/bin/google-chrome).
// Serves the folder, then on desktop 1366, wide 1920 and phone 390 clicks every tab, shape, play button, carousel arrow, copy and more button,
// checks every link and image, and flags any picture drawn at a different shape from the file (a stretched poster).
// Click test for a Max pack page: every tab, shape, play button, carousel arrow,
// copy and "more" button, every link and download, on desktop and phone.
import { chromium } from '/home/claude/max/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const types = { '.html': 'text/html', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.zip': 'application/zip', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(p).size, t = types[path.extname(p)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const [a, b] = range.replace('bytes=', '').split('-'); const start = +a, end = b ? +b : size - 1;
    res.writeHead(206, { 'Content-Type': t, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(p, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': t, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(p).pipe(res);
}).listen(8765);

const base = 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const stats = {};

for (const vp of [{ name: 'desktop', width: 1366, height: 900 }, { name: 'wide', width: 1920, height: 1080 }, { name: 'phone', width: 390, height: 844, isMobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.isMobile });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') problems.push(`${vp.name}: console error ${m.text()}`); });
  page.on('pageerror', e => problems.push(`${vp.name}: page error ${e.message}`));
  const failed = [];
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  await page.goto(base + 'index.html', { waitUntil: 'networkidle' });
  const s = stats[vp.name] = { clicks: 0, videosPlayed: 0, links: 0 };
  const imagesSeen = new Set(), videoSrcs = new Set();

  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ov > 1) problems.push(`${vp.name}: page scrolls sideways by ${ov}px`);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 600) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(50); }
  await page.waitForLoadState('networkidle');
  const badAll = await page.$$eval('img', is => is.filter(i => i.offsetParent && i.complete && i.naturalWidth === 0).map(i => i.src));
  for (const b of badAll) problems.push(`${vp.name}: image did not load ${b}`);
  (await page.$$eval('img', is => is.map(i => i.src))).forEach(x => imagesSeen.add(x));
  for (const q of await page.$$eval('img', es => es.filter(e => e.offsetParent && e.naturalWidth).map(e => { const r = e.getBoundingClientRect(); const fit = getComputedStyle(e).objectFit; if (fit === 'contain' || fit === 'cover') return null; const d = Math.abs((r.width / r.height) / (e.naturalWidth / e.naturalHeight) - 1); return d > 0.03 ? `${e.closest('section')?.id}: ${e.src.split('/').slice(-2).join('/')} drawn ${Math.round(r.width)}x${Math.round(r.height)}, real ${e.naturalWidth}x${e.naturalHeight}` : null; }).filter(Boolean))) problems.push(`${vp.name}: SQUASHED ${q}`);

  const secs = await page.$$eval('section', ss => ss.filter(x => x.querySelector('.tab')).map(x => x.id));
  for (const id of secs) {
    const plats = await page.$$eval(`#${id} .tab`, ts => ts.map(t => t.dataset.p));
    for (const p of plats) {
      const tab = page.locator(`#${id} .tab[data-p="${p}"]`);
      await tab.scrollIntoViewIfNeeded(); await tab.click(); s.clicks++; await page.waitForTimeout(250);
      const shapes = await page.locator(`#${id} .shape`).count();
      for (let j = 0; j < Math.max(1, shapes); j++) {
        if (shapes) { const sh = page.locator(`#${id} .shape`).nth(j); await sh.scrollIntoViewIfNeeded(); await sh.click(); s.clicks++; await page.waitForTimeout(300); }
        await page.waitForFunction(id => [...document.querySelectorAll(`#${id} img`)].filter(i => i.offsetParent).every(i => i.complete), id, { timeout: 5000 }).catch(() => {});
        const imgs = await page.$$eval(`#${id} img`, is => is.filter(i => i.offsetParent).map(i => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })));
        for (const im of imgs) { imagesSeen.add(im.src); if (!im.ok) problems.push(`${vp.name}: ${id} ${p} shape ${j}: image not loaded ${im.src}`); }
        const squashed = await page.$$eval(`#${id} img, #${id} video`, es => es.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); const nw = e.naturalWidth || e.videoWidth, nh = e.naturalHeight || e.videoHeight; const fit = getComputedStyle(e).objectFit; if (!nw || !r.height || e.tagName === 'VIDEO' || fit === 'contain' || fit === 'cover') return null; const d = Math.abs((r.width / r.height) / (nw / nh) - 1); return d > 0.03 ? `${(e.src||'').split('/').slice(-2).join('/')} drawn ${Math.round(r.width)}x${Math.round(r.height)}, real ${nw}x${nh}` : null; }).filter(Boolean));
        for (const q of squashed) problems.push(`${vp.name}: ${id} ${p} shape ${j}: SQUASHED ${q}`);
        const plays = await page.locator(`#${id} .play`).count();
        if (!imgs.length && !plays) problems.push(`${vp.name}: ${id} ${p} shape ${j}: nothing shown`);
        for (let k = 0; k < plays; k++) {
          const pb = page.locator(`#${id} .play`).nth(k);
          if (!(await pb.isVisible())) continue;
          const src = await pb.getAttribute('data-src');
          await pb.scrollIntoViewIfNeeded(); await pb.click(); s.clicks++;
          const ok = await page.waitForFunction(src => { const v = [...document.querySelectorAll('video')].find(v => (v.currentSrc || v.src).includes(src)); return v && v.readyState >= 2 && v.currentTime > 0.3 && v.videoWidth > 0; }, src, { timeout: 10000 }).then(() => true).catch(() => false);
          if (ok) { s.videosPlayed++; videoSrcs.add(src); } else problems.push(`${vp.name}: ${id} ${p} shape ${j}: video did not play ${src}`);
          await page.evaluate(() => document.querySelectorAll('video').forEach(v => v.pause()));
        }
        if (await page.locator(`#${id} .arrow.next`).count()) {
          const seen = new Set();
          for (let i = 0; i < 6; i++) {
            const vis = await page.$$eval(`#${id} img`, is => is.filter(i => i.offsetParent).map(i => i.src + (i.complete && i.naturalWidth > 0 ? '' : ' NOTLOADED')));
            vis.forEach(v => seen.add(v));
            const nx = page.locator(`#${id} .arrow.next`);
            if (await nx.click({ timeout: 1500 }).then(() => true).catch(() => false)) { s.clicks++; await page.waitForTimeout(350); }
          }
          for (const v of seen) if (v.endsWith('NOTLOADED')) problems.push(`${vp.name}: carousel ${p}: ${v}`);
          s.carousel = s.carousel || {}; s.carousel[p] = seen.size;
          const pv = page.locator(`#${id} .arrow.prev`);
          for (let i = 0; i < 6; i++) { if (!(await pv.click({ timeout: 1500 }).then(() => true).catch(() => false))) break; s.clicks++; await page.waitForTimeout(150); }
        }
      }
    }
  }

  for (const m of await page.$$('.more')) { if (await m.isVisible()) { await m.scrollIntoViewIfNeeded(); await m.click(); s.clicks++; } }
  let copyVisible = 0;
  for (const c of await page.$$('.copy')) { if (await c.isVisible()) { copyVisible++; await c.scrollIntoViewIfNeeded(); await c.click().catch(() => {}); s.clicks++; } }
  s.copyButtons = copyVisible;

  const links = await page.$$eval('a[href]', as => as.map(a => ({ h: a.getAttribute('href'), abs: a.href, pay: a.hasAttribute('data-pay') })));
  const checked = new Set();
  for (const l of links) {
    s.links++;
    if (l.h === '#') { if (!l.pay) problems.push(`${vp.name}: empty link "#" (not a payment button)`); continue; }
    if (l.h.startsWith('#')) { if (!(await page.$(l.h))) problems.push(`${vp.name}: jump link ${l.h} has no target`); continue; }
    if (l.h.startsWith("mailto:")) { if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]+/i.test(l.h)) problems.push(`${vp.name}: bad mail link ${l.h}`); continue; }
    if (checked.has(l.abs)) continue; checked.add(l.abs);
    const r = await page.request.head(l.abs).catch(() => null);
    if (!r || r.status() !== 200) problems.push(`${vp.name}: link broken ${l.h}`);
  }
  s.uniqueFileLinks = checked.size;
  for (const f of failed) problems.push(`${vp.name}: request failed ${f}`); 
  const ov2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ov2 > 1) problems.push(`${vp.name}: after clicking, page scrolls sideways by ${ov2}px`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `/tmp/pagecheck-${vp.name}.png`, fullPage: true });
  s.imagesSeen = imagesSeen.size; s.videoFiles = videoSrcs.size;
  await ctx.close();
}
await browser.close(); server.close();
console.log(JSON.stringify(stats, null, 1));
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'NO PROBLEMS');
