// Preview harness: runs Max's pack pages in Chrome the way the app's renderPage/renderFrames do, so the layouts and
// self-checks can be seen before an app build. Usage: node harness.mjs <data.json> <photoDir> <outDir> [platform...] [--video]
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from '/home/claude/max/node_modules/playwright-core/index.mjs';
import * as P from '/home/claude/max/src/pack-maker.mjs';

const [dataFile, photoDir, outDir, ...rest] = process.argv.slice(2);
const wantVideo = rest.includes('--video'), only = rest.filter(x => !x.startsWith('--'));
const data = JSON.parse(readFileSync(dataFile, 'utf8'));
const img = name => 'data:image/jpeg;base64,' + readFileSync(photoDir + '/' + name).toString('base64');
const images = {};
for (const it of [...data.ads, ...data.carousel.cards]) if (it.photo) images[it.photo] = img(it.photo);
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome'});
const summary = [];

async function still(page, html, f, file) {
  await page.setViewportSize({width: f.width, height: f.height});
  await page.setContent(html, {waitUntil: 'load'});
  const r = await page.evaluate(P.STILL_SCRIPT);
  await page.screenshot({path: file, type: 'jpeg', quality: 92});
  return r;
}
async function video(page, html, f, file) {
  await page.setViewportSize({width: f.width, height: f.height});
  await page.setContent(html, {waitUntil: 'load'});
  const r = await page.evaluate(P.VIDEO_SETUP);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(P.FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', file], {stdio: ['pipe', 'inherit', 'inherit']});
  for (let i = 0; i < r.frames; i++) { await page.evaluate(P.videoFrameScript(i)); ff.stdin.write(await page.screenshot({type: 'jpeg', quality: 90})); }
  ff.stdin.end(); await new Promise(res => ff.on('close', res));
  return r;
}

for (const platform of only.length ? only : P.PLATFORMS) {
  const spec = P.parseSpec(readFileSync(`specs/${platform}.md`, 'utf8'), platform);
  const dir = `${outDir}/${platform}`; mkdirSync(dir, {recursive: true});
  const page = await browser.newPage();
  for (const f of P.packFormats(spec, 'ad')) for (const ad of data.ads) {
    const file = `${dir}/${ad.name}-${f.id}.jpg`;
    const r = await still(page, P.stillPage({item: ad, brand: data.brand, f, images}), f, file);
    summary.push({file, problems: r.problems, shrunk: r.shrunk});
  }
  const cards = data.carousel.cards, n = cards.length;
  for (const f of P.packFormats(spec, 'carousel')) for (let i = 0; i < n; i++) {
    const c = {...cards[i], count: `${i + 1} / ${n}`, swipe: i === 0 ? 'Swipe to see how →' : i < n - 1 ? 'Next →' : undefined};
    const file = `${dir}/${data.carousel.name}-${i + 1}of${n}-${f.id}.jpg`;
    const r = await still(page, P.stillPage({item: c, brand: data.brand, f, images}), f, file);
    summary.push({file, problems: r.problems, shrunk: r.shrunk});
  }
  if (wantVideo) {
    const vcards = cards.filter(c => c.role !== 'title');
    for (const f of P.packFormats(spec, 'carouselVideo')) {
      const file = `${dir}/${data.carousel.name}-video-${f.id}.mp4`;
      const r = await video(page, P.videoPage({cards: vcards, brand: data.brand, f, images}), f, file);
      summary.push({file, problems: r.problems, shrunk: r.shrunk});
    }
    for (const f of P.packFormats(spec, 'adVideo')) for (const ad of data.ads) {
      const file = `${dir}/${ad.name}-video-${f.id}.mp4`;
      const r = await video(page, P.videoPage({cards: [ad], brand: data.brand, f, images}), f, file);
      summary.push({file, problems: r.problems, shrunk: r.shrunk});
    }
  }
  await page.close();
}
await browser.close();
writeFileSync(`${outDir}/summary.json`, JSON.stringify(summary, null, 1));
for (const s of summary) console.log((s.problems.length ? 'FAIL ' : 'PASS ') + s.file.split('/').slice(-2).join('/') + (s.shrunk?.length ? ' (shrunk)' : '') + (s.problems.length ? '\n   ' + P.packToFix([{file: '', problems: s.problems}]).join('\n   ') : ''));
