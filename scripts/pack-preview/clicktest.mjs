import {chromium} from '/home/claude/max/node_modules/playwright-core/index.mjs';
const url = 'file://' + process.argv[2];
const b = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']});
const problems = [], log = [];
for (const [label, vp] of [['desktop', {width: 1440, height: 900}], ['phone', {width: 390, height: 844}]]) {
  const p = await b.newPage({viewport: vp}); const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(500);
  const ids = await p.evaluate(() => [...document.querySelectorAll('#ads > section, #video')].map(s => s.id));
  let played = 0, shown = 0;
  for (const id of ids) for (const plat of ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'X']) {
    const tab = p.locator(`#${id} .v .tab[data-p="${plat}"]`); if (!(await tab.count())) continue;
    await tab.click(); const n = await p.locator(`#${id} .v .shape`).count();
    for (let j = 0; j < n; j++) {
      await p.locator(`#${id} .v .shape`).nth(j).click(); await p.waitForTimeout(80);
      if (await p.locator(`#${id} .v .play`).count()) {
        await p.locator(`#${id} .v .play`).click(); await p.waitForTimeout(1600);
        const st = await p.evaluate(id => { const v = document.querySelector(`#${id} video`); return v ? {t: v.currentTime, w: v.videoWidth, err: v.error && v.error.code, src: v.getAttribute('src')} : null; }, id);
        if (!st || st.t < 0.5 || !st.w) problems.push(`${label} ${id} ${plat} video did not play ${JSON.stringify(st)}`); else played++;
      } else {
        const ok = await p.evaluate(async id => { const i = document.querySelector(`#${id} .stage img`); if (!i) return false; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 5000); }); return i.naturalWidth > 0; }, id);
        if (!ok) problems.push(`${label} ${id} ${plat} shape ${j} image not shown`); else shown++;
      }
    }
  }
  // carousel per platform
  let cards = 0;
  for (const plat of ['Facebook', 'Instagram', 'LinkedIn', 'X', 'TikTok']) {
    await p.locator(`#carousel .tab[data-p="${plat}"]`).click(); await p.waitForTimeout(150);
    if (plat === 'TikTok') { await p.locator('#carousel .play').click(); await p.waitForTimeout(1600); const t = await p.evaluate(() => document.querySelector('#carousel video')?.currentTime || 0); if (t < 0.5) problems.push(label + ' carousel TikTok video did not play'); continue; }
    const n = await p.locator('#carousel .slide').count();
    for (let k = 1; k < n; k++) { await p.locator('#carousel .next').click(); await p.waitForTimeout(700); }
    const c = await p.evaluate(() => ({count: document.querySelector('#carousel .count').textContent, next: document.querySelector('#carousel .next').disabled, imgs: [...document.querySelectorAll('#carousel .slide img')].every(i => i.complete && i.naturalWidth > 0)}));
    if (c.count !== `${n} / ${n}` || !c.next || !c.imgs || n !== 5) problems.push(`${label} carousel ${plat}: ${JSON.stringify(c)} n=${n}`); else cards += n;
    if (plat === 'Instagram' && label === 'phone') await p.screenshot({path: '/tmp/ph-ig.png'});
    if (plat === 'Facebook' && label === 'desktop') await p.locator('#carousel .card').screenshot({path: '/tmp/dk-fb-end.png'});
  }
  // copy buttons exist, nav, overflow
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) problems.push(`${label} overflow ${over}px`);
  if (errs.length) problems.push(`${label} errors: ${errs.join(' | ')}`);
  log.push(`${label}: ${shown} images shown, ${played} videos played, ${cards} carousel cards stepped, overflow ${over}`);
  await p.close();
}
console.log(log.join('\n')); console.log('PROBLEMS', problems.length ? problems : 'none');
await b.close();
