// Max build 14 (25 Nov 2026): the WOW ads maker. Draws the 5 approved layouts (decision 87) and the "with your team"
// preview (decision 86) as 1080 x 1080 pictures from filled-in fields. The look is copied from the approved mock-ups
// (Desktop\Max\research\step4-wow-ads\mockup-source\*.html); the words may be longer or shorter than McCance's, so every
// text box has a size range and shrinks to fit, then the page measures itself. Nothing here costs money.
import {readFileSync} from 'node:fs';
import {contrastRatio, readableAccent} from './pack-maker.mjs';

export const WOW_SIZE = 1080;
export const WOW_LAYOUTS = ['problem-fix', 'split-claim', 'big-review', 'bold-text', 'big-number', 'preview'];
export const BAND_TEXT = 'SAMPLE PHOTO · NOT YOUR TEAM';
// What each layout needs (besides button and logo line, which every layout has).
export const WOW_NEEDS = {
  'problem-fix': ['headline', 'proof', 'photo'],
  'split-claim': ['kicker', 'headline', 'proofBig', 'proofText', 'photo'],
  'big-review': ['kicker', 'quote', 'who'],
  'bold-text': ['kicker', 'headline', 'badge'],
  'big-number': ['kicker', 'number', 'numberLine'],
  preview: ['headline', 'proof', 'photo'],
};
// Fields each layout shows; anything else given is ignored and named in the notes.
export const WOW_SHOWS = {
  'problem-fix': ['headline', 'proof', 'button', 'photo', 'footnote'],
  'split-claim': ['kicker', 'headline', 'proofBig', 'proofText', 'button', 'photo', 'footnote'],
  'big-review': ['kicker', 'quote', 'stars', 'who', 'button', 'photo', 'footnote'],
  'bold-text': ['kicker', 'headline', 'badge', 'button', 'footnote'],
  'big-number': ['kicker', 'number', 'numberLine', 'button', 'photo', 'footnote'],
  preview: ['headline', 'proof', 'button', 'photo', 'footnote'],
};

const FONT_DIR = new URL('./book-fonts/', import.meta.url);
const fontCache = new Map();
const face = (family, file, weight) => {
  if (!fontCache.has(file)) fontCache.set(file, readFileSync(new URL(file + '.woff2', FONT_DIR)).toString('base64'));
  return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${fontCache.get(file)}) format('woff2');font-weight:${weight};font-style:normal;font-display:block}`;
};
export const INTER_FACES = () => [face('Inter', 'inter-600', 600), face('Inter', 'inter-700', 700), face('Inter', 'inter-800', 800)].join('');
const FONTS = () => [face('Anton', 'anton-400', 400), face('Archivo Black', 'archivo-black-400', 400), face('Inter', 'inter-600', 600), face('Inter', 'inter-700', 700), face('Inter', 'inter-800', 800)].join('');

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex6 = v => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toUpperCase() : null;
const mix = (a, b, t) => '#' + [1, 3, 5].map(k => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
const toHsl = hex => { const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
const fromHsl = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase(); };
const STAR = c => `<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c || 'currentColor'}" d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z"/></svg>`;
const CHEVRON = '<svg class="chev" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// **words** are drawn in the highlight colour; \n is a line break; ★ becomes a drawn star (no font has to carry it).
export function richText(value, starColour) {
  return esc(value).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>').replace(/\\n|\n/g, '<br>').replace(/★/g, STAR());
}
const plain = v => String(v ?? '').replace(/\*\*/g, '').replace(/\\n|\n/g, ' ').replace(/★/g, ' ').replace(/\s+/g, ' ').trim();
export const wordCount = v => plain(v).split(' ').filter(w => /[A-Za-z0-9]/.test(w)).length;

// Colours: panel (deep background), accent (bars, buttons, the bold-text background), soft (the light big-review
// background) come from brand.md; the highlight (words in **stars** on dark) is the accent made light enough to read on
// the panel, unless brand.highlight is given. Every pair is made readable (4.5:1) before drawing, and what changed is noted.
export function wowColours(brand = {}) {
  const notes = [];
  let panel = hex6(brand.panel) || '#0A2616';
  for (let i = 0; i < 40 && contrastRatio(panel, '#FFFFFF') < 7; i++) panel = mix(panel, '#000000', 0.08);
  if (hex6(brand.panel) && panel !== hex6(brand.panel)) notes.push(`The panel colour ${brand.panel} was darkened to ${panel} so white words read clearly on it.`);
  const givenAccent = hex6(brand.accent) || hex6(brand.primary) || '#00781F', accent = readableAccent(givenAccent, '#FFFFFF', 4.5);
  if (accent !== givenAccent) notes.push(`The accent ${givenAccent} was deepened to ${accent} so white words on buttons read clearly.`);
  let highlight = hex6(brand.highlight);
  if (!highlight) {
    // Lighter in the same hue, not paler: keep the colour's own saturation (at most 65%) and raise its lightness.
    const [h, sat, l] = toHsl(givenAccent); let L = l;
    highlight = fromHsl(h, Math.min(sat, 0.65), L);
    for (let i = 0; i < 40 && contrastRatio(highlight, panel) < 7.5; i++) { L = Math.min(0.92, L + 0.025); highlight = fromHsl(h, Math.min(sat, 0.65), L); }
  }
  else if (contrastRatio(highlight, panel) < 4.5) { const was = highlight; for (let i = 0; i < 30 && contrastRatio(highlight, panel) < 4.5; i++) highlight = mix(highlight, '#FFFFFF', 0.12); notes.push(`The highlight ${was} was lightened to ${highlight} to read on the panel.`); }
  let soft = hex6(brand.soft) || mix(accent, '#FFFFFF', 0.88);
  for (let i = 0; i < 30 && contrastRatio(soft, panel) < 9; i++) soft = mix(soft, '#FFFFFF', 0.25);
  // On the accent background (bold text), the kicker uses a pale tint of the accent.
  let pale = mix(accent, '#FFFFFF', 0.78);
  for (let i = 0; i < 20 && contrastRatio(pale, accent) < 4.5; i++) pale = mix(pale, '#FFFFFF', 0.3);
  return {panel, accent, highlight, soft, pale, notes};
}

// Build 15 (25 Nov 2026): "show" names the part of the photo to show, as a box in percentages of the photo
// ("x1% y1% x2% y2%", left top right bottom). The page never shows anything outside that box: it fills the layout's photo
// box from it, trimming evenly from the long side when the shapes differ, and reports the part really shown. focus and zoom remain
// for older choices but bots should use show: a bot cannot see where focus and zoom land (McCance test, 25 Nov).
export const PHOTO_BOXES = {'problem-fix': [960, 500], preview: [960, 500], 'split-claim': [552, 1080], 'big-review': [1080, 330], 'big-number': [1080, 400]};
export function parseShow(v) {
  const m = String(v || '').trim().match(/^(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?$/);
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return x1 >= 0 && y1 >= 0 && x2 <= 100 && y2 <= 100 && x2 - x1 >= 2 && y2 - y1 >= 2 ? {x1, y1, x2, y2} : null;
}
const photoTag = (ad, images, cls = '') => {
  const src = images[ad.photo];
  if (!src) return `<div class="photo ${cls}"></div>`;
  const band = ad.layout === 'preview' ? `<div class="band" data-k="band">${esc(BAND_TEXT)}</div>` : '';
  const show = parseShow(ad.show);
  if (show) return `<div class="photo ${cls}"><img class="shown" data-show="${show.x1} ${show.y1} ${show.x2} ${show.y2}" src="${src}" alt="">${band}</div>`;
  const focus = (ad.focus || '50% 50%').replace(/[^0-9.% a-z]/gi, '');
  const zoom = Math.min(Math.max(Number(ad.zoom) || 1, 1), 3);
  return `<div class="photo ${cls}"><img src="${src}" style="object-position:${focus};transform-origin:${focus};transform:scale(${zoom})" alt="">${band}</div>`;
};

// Base CSS shared by all layouts. Sizes are the mock-ups' sizes; data-max/data-min give each text box its range.
function baseCss(C) {
  return `${FONTS()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px}
body{background:${C.panel};font-family:'Inter';color:#fff;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
em{font-style:normal;color:${C.highlight}}
.star{width:.9em;height:.9em;vertical-align:-.08em;display:inline-block}
.chev{width:.42em;height:.62em;margin-left:.35em;vertical-align:.02em;display:inline-block}
.photo{position:absolute;overflow:hidden;background:#1a1a1a}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo img.shown{position:absolute;max-width:none;object-fit:fill}
.band{position:absolute;left:0;right:0;bottom:0;height:40px;background:rgba(10,20,14,.8);color:#fff;font-weight:700;font-size:17px;letter-spacing:4px;display:flex;align-items:center;justify-content:center;white-space:nowrap}
.btn{display:inline-flex;align-items:center;border-radius:40px;padding:14px 34px;font-weight:700;font-size:30px;white-space:nowrap;line-height:1.15}
.btn.line{border:3px solid #fff;color:#fff}
.btn.fill{background:${C.accent};color:#fff;padding:16px 36px}
.btn.dark{background:${C.panel};color:#fff;padding:16px 36px}
.logo{position:absolute;font-weight:800;font-size:22px;letter-spacing:3px;white-space:nowrap}
.foot{position:absolute;font-size:15px;line-height:1.3;font-weight:600}
.fit{overflow:hidden}
.lines{white-space:nowrap}
h1 span{text-wrap:balance}
`;
}

function layoutBody(ad, C, images) {
  const R = v => richText(v, C.highlight), btn = (cls) => `<div class="btn ${cls}" data-k="button">${esc(ad.button)}${CHEVRON}</div>`;
  const logo = (style, extra = '') => `<div class="logo" data-k="logo" style="${style}">${esc(ad.logoLine)}</div>${extra}`;
  const foot = (style) => ad.footnote ? `<div class="foot" data-k="footnote" style="${style}">${esc(ad.footnote)}</div>` : '';
  switch (ad.layout) {
    case 'problem-fix': case 'preview':
      return {css: `.bar{position:absolute;left:0;top:0;width:100%;height:14px;background:${C.accent}}
.card{left:60px;top:70px;width:960px;height:500px;border-radius:28px}
h1{position:absolute;left:60px;top:600px;width:960px;height:250px;font-family:'Anton';font-weight:400;line-height:1.0;letter-spacing:1px;text-transform:uppercase;display:flex;flex-direction:column;justify-content:center}
.row{position:absolute;left:60px;top:868px;width:960px;height:92px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.proof{background:#fff;color:${C.panel};border-radius:16px;padding:.47em .68em;font-weight:800;font-size:38px;white-space:nowrap;line-height:1.15}
.proof em{color:${C.accent}}`,
      html: `<div class="bar"></div>${photoTag(ad, images, 'card')}<h1 class="fit${/\\n|\n/.test(String(ad.headline || '')) ? ' lines' : ''}" data-k="headline" data-max="118" data-min="80"><span>${R(ad.headline)}</span></h1>
<div class="row fit" data-k="row" data-max="38" data-min="26" data-scale=".proof,.btn"><div class="proof" data-k="proof">${R(ad.proof)}</div>${btn('line')}</div>
${logo(`left:60px;bottom:38px;opacity:.85`)}${foot(`right:60px;bottom:36px;width:420px;text-align:right;color:rgba(255,255,255,.8)`)}`};
    case 'split-claim':
      return {css: `body{background:#fff}
.side{right:0;top:0;width:552px;height:1080px}
.panel{position:absolute;left:0;top:0;width:600px;height:1080px;background:${C.panel};clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}
.kick{position:absolute;left:60px;top:110px;width:470px;height:60px;color:${C.highlight};font-weight:800;font-size:40px;letter-spacing:4px;text-transform:uppercase;white-space:nowrap}
h1{position:absolute;left:56px;top:175px;width:470px;height:390px;font-family:'Anton';font-weight:400;line-height:.95;color:#fff;text-transform:uppercase;display:flex;flex-direction:column;justify-content:center}
.box{position:absolute;left:60px;top:590px;width:440px;height:240px;border:3px solid ${C.highlight};border-radius:18px;padding:22px 28px;color:#fff;display:flex;flex-direction:column;justify-content:center}
.box .n{font-family:'Anton';white-space:nowrap;line-height:1;color:${C.highlight};overflow:hidden}
.box .t{font-weight:700;font-size:34px;line-height:1.2;margin-top:6px}
.btnwrap{position:absolute;left:60px;top:846px;width:440px;height:72px;display:flex;align-items:center}`,
      html: `${photoTag(ad, images, 'side')}<div class="panel"></div><div class="kick fit" data-k="kicker" data-max="40" data-min="28">${R(ad.kicker)}</div>
<h1 class="fit${/\\n|\n/.test(String(ad.headline || '')) ? ' lines' : ''}" data-k="headline" data-max="190" data-min="110"><span>${R(ad.headline)}</span></h1>
<div class="box"><div class="n fit" data-k="proofBig" data-max="104" data-min="64" style="height:112px">${R(ad.proofBig)}</div><div class="t fit" data-k="proofText" data-max="34" data-min="24" style="height:84px">${R(ad.proofText)}</div></div>
<div class="btnwrap fit" data-k="row" data-max="30" data-min="24" data-scale=".btn">${btn('fill')}</div>
<div class="logo fit" data-k="logo" data-max="20" data-min="15" style="left:60px;bottom:34px;width:440px;height:58px;white-space:normal;line-height:1.35;color:#fff;display:flex;align-items:flex-end">${esc(ad.logoLine)}</div>${foot(`left:60px;top:926px;width:440px;font-size:14px;line-height:1.28;color:${C.soft};opacity:.9`)}`};
    case 'big-review': {
      const stars = Math.min(Math.max(Math.round(Number(ad.stars) || 0), 0), 5);
      // Build 16: without a photo the customer's words fill the ad, over a dark band with the name and button.
      if (!ad.photo) return {css: `body{background:${C.soft};color:${C.panel}}
.kick{position:absolute;left:70px;top:80px;max-width:940px;background:${C.panel};color:#fff;font-weight:800;font-size:64px;letter-spacing:4px;padding:16px 32px;border-radius:14px;text-transform:uppercase;white-space:nowrap}
.q{position:absolute;left:52px;top:205px;font-family:'Archivo Black';font-size:300px;color:${C.accent};line-height:1}
h1{position:absolute;left:70px;top:370px;width:940px;height:340px;font-family:'Archivo Black';font-weight:400;line-height:1.04;letter-spacing:-1px;display:flex;flex-direction:column;justify-content:center}
h1 em{color:${C.accent}}
.who{position:absolute;left:70px;top:730px;width:940px;height:56px;font-size:32px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:18px}
.who .stars{color:${C.accent};display:inline-flex;gap:4px;font-size:36px}
.band{position:absolute;left:0;bottom:0;width:1080px;height:170px;background:${C.panel}}
.btnpos{position:absolute;right:60px;bottom:52px}`,
        html: `<div class="kick fit" data-k="kicker" data-max="64" data-min="30">${R(ad.kicker)}</div><div class="q">“</div>
<h1 class="fit${/\\n|\n/.test(String(ad.quote || '')) ? ' lines' : ''}" data-k="quote" data-max="100" data-min="64"><span>${R(ad.quote)}</span></h1>
<div class="who fit" data-k="who" data-max="32" data-min="22">${stars ? `<span class="stars">${STAR(C.accent).repeat(stars)}</span>` : ''}<span>${R(ad.who)}</span></div>
${foot(`left:70px;top:800px;width:940px;color:${C.panel};opacity:.85`)}<div class="band"></div><div class="btnpos">${btn('fill')}</div>${logo(`left:70px;bottom:72px;color:#fff;opacity:.92`)}`};
      return {css: `body{background:${C.soft};color:${C.panel}}
.kick{position:absolute;left:70px;top:80px;max-width:940px;background:${C.panel};color:#fff;font-weight:800;font-size:34px;letter-spacing:3px;padding:14px 26px;border-radius:12px;text-transform:uppercase;white-space:nowrap}
.q{position:absolute;left:52px;top:150px;font-family:'Archivo Black';font-size:260px;color:${C.accent};line-height:1}
h1{position:absolute;left:70px;top:320px;width:940px;height:250px;font-family:'Archivo Black';font-weight:400;line-height:1.05;letter-spacing:-1px;display:flex;flex-direction:column;justify-content:center}
h1 em{color:${C.accent}}
.who{position:absolute;left:70px;top:590px;width:940px;height:50px;font-size:30px;font-weight:600;white-space:nowrap;display:flex;align-items:center;gap:18px}
.who .stars{color:${C.accent};display:inline-flex;gap:4px;font-size:34px}
.strip{left:0;bottom:0;width:1080px;height:330px}
.btnpos{position:absolute;right:60px;bottom:40px}
.logo{background:rgba(255,255,255,.94);padding:10px 16px;border-radius:8px;color:${C.panel}}`,
      html: `<div class="kick fit" data-k="kicker" data-max="34" data-min="24">${R(ad.kicker)}</div><div class="q">“</div>
<h1 class="fit${/\\n|\n/.test(String(ad.quote || '')) ? ' lines' : ''}" data-k="quote" data-max="92" data-min="58"><span>${R(ad.quote)}</span></h1>
<div class="who fit" data-k="who" data-max="30" data-min="22">${stars ? `<span class="stars">${STAR(C.accent).repeat(stars)}</span>` : ''}<span>${R(ad.who)}</span></div>
${photoTag(ad, images, 'strip')}<div class="btnpos">${btn('dark')}</div>${logo(`left:60px;bottom:48px;font-size:20px`)}${foot(`left:70px;top:660px;width:940px;color:${C.panel};opacity:.85`)}`};
    }
    case 'bold-text':
      return {css: `body{background:${C.accent}}
.stripe{position:absolute;left:0;top:0;width:100%;height:14px;background:${C.panel}}
.kick{position:absolute;left:70px;top:100px;width:940px;height:60px;font-weight:800;font-size:44px;letter-spacing:5px;color:${C.pale};text-transform:uppercase;white-space:nowrap}
.kick em{color:${C.pale}}
h1{position:absolute;left:64px;top:175px;width:960px;height:610px;font-family:'Anton';font-weight:400;line-height:.96;text-transform:uppercase;display:flex;flex-direction:column;justify-content:center}
h1 em{color:#fff}
.row{position:absolute;left:70px;top:812px;width:940px;height:96px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.badge{background:#fff;color:${C.panel};border-radius:16px;padding:.47em .74em;font-weight:800;font-size:38px;white-space:nowrap;line-height:1.15}`,
      html: `<div class="stripe"></div><div class="kick fit" data-k="kicker" data-max="44" data-min="30">${R(ad.kicker)}</div>
<h1 class="fit${/\\n|\n/.test(String(ad.headline || '')) ? ' lines' : ''}" data-k="headline" data-max="190" data-min="110"><span>${R(ad.headline)}</span></h1>
<div class="row fit" data-k="row" data-max="38" data-min="26" data-scale=".badge,.btn"><div class="badge" data-k="badge">${R(ad.badge)}</div>${btn('line')}</div>
${logo(`left:70px;bottom:44px;opacity:.92`)}${foot(`right:70px;bottom:42px;width:420px;text-align:right;color:${C.pale}`)}`};
    case 'big-number':
      // Build 16: without a photo the number fills the ad; a thin rule and the name and button sit at the bottom.
      if (!ad.photo) return {css: `.kick{position:absolute;left:70px;top:110px;width:940px;height:60px;font-weight:800;font-size:44px;letter-spacing:5px;color:${C.highlight};text-transform:uppercase;white-space:nowrap}
.n{position:absolute;left:58px;top:180px;width:964px;height:470px;font-family:'Anton';line-height:1;color:#fff;white-space:nowrap;display:flex;align-items:center}
.sub{position:absolute;left:70px;top:660px;width:940px;height:90px;font-weight:800;font-size:58px;white-space:nowrap;display:flex;align-items:center}
.rule{position:absolute;left:70px;top:830px;width:940px;height:4px;background:${C.accent}}
.btnpos{position:absolute;right:70px;bottom:56px}`,
        html: `<div class="kick fit" data-k="kicker" data-max="44" data-min="30">${R(ad.kicker)}</div>
<div class="n fit" data-k="number" data-max="400" data-min="180"><span>${R(ad.number)}</span></div>
<div class="sub fit" data-k="numberLine" data-max="58" data-min="34"><span>${R(ad.numberLine)}</span></div>
${foot(`left:70px;top:760px;width:940px;color:${C.soft}`)}<div class="rule"></div><div class="btnpos">${btn('fill')}</div>${logo(`left:70px;bottom:74px;opacity:.9`)}`};
      return {css: `.kick{position:absolute;left:70px;top:80px;width:940px;height:60px;font-weight:800;font-size:44px;letter-spacing:5px;color:${C.highlight};text-transform:uppercase;white-space:nowrap}
.n{position:absolute;left:58px;top:140px;width:964px;height:350px;font-family:'Anton';line-height:1;color:#fff;white-space:nowrap;display:flex;align-items:center}
.sub{position:absolute;left:70px;top:505px;width:940px;height:80px;font-weight:800;font-size:52px;white-space:nowrap;display:flex;align-items:center}
.strip{left:0;bottom:0;width:1080px;height:400px}
.fade{position:absolute;left:0;bottom:290px;width:1080px;height:110px;background:linear-gradient(${C.panel},rgba(0,0,0,0))}
.btnpos{position:absolute;right:60px;bottom:40px}
.logo{background:rgba(255,255,255,.94);color:${C.panel};padding:10px 16px;border-radius:8px}`,
      html: `<div class="kick fit" data-k="kicker" data-max="44" data-min="30">${R(ad.kicker)}</div>
<div class="n fit" data-k="number" data-max="330" data-min="180"><span>${R(ad.number)}</span></div>
<div class="sub fit" data-k="numberLine" data-max="52" data-min="34"><span>${R(ad.numberLine)}</span></div>
${photoTag(ad, images, 'strip')}<div class="fade"></div><div class="btnpos">${btn('fill')}</div>${logo(`left:60px;bottom:48px;font-size:20px`)}${foot(`left:70px;top:596px;width:940px;color:${C.soft}`)}`};
    default: throw new Error(`Unknown layout ${ad.layout}`);
  }
}

export function wowPage({ad, brand, images}) {
  const C = wowColours(brand), {css, html} = layoutBody(ad, C, images);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(C)}${css}</style></head><body>${html}</body></html>`;
}

// Runs in the page: shrink each text box until it fits (never below its data-min), then measure what a person sees.
export const WOW_SCRIPT = String.raw`(async()=>{
await document.fonts.ready;
for(const i of document.images){if(!i.complete)await new Promise(r=>{i.onload=i.onerror=r;});}
const shrunk=[],problems=[],W=1080,M=24,shown=[];
for(const im of document.querySelectorAll('img.shown')){const [x1,y1,x2,y2]=im.dataset.show.split(' ').map(Number),box=im.parentElement,bw=box.clientWidth,bh=box.clientHeight,IW=im.naturalWidth,IH=im.naturalHeight;if(!IW)continue;
 const rw=(x2-x1)/100*IW,rh=(y2-y1)/100*IH;let s=Math.max(bw/rw,bh/rh,bw/IW,bh/IH);const vw=bw/s,vh=bh/s;
 let vx=(x1+x2)/200*IW-vw/2,vy=(y1+y2)/200*IH-vh/2;vx=Math.min(Math.max(vx,0),IW-vw);vy=Math.min(Math.max(vy,0),IH-vh);
 Object.assign(im.style,{width:IW*s+'px',height:IH*s+'px',left:-vx*s+'px',top:-vy*s+'px'});
 const r=v=>Math.round(v*10)/10;shown.push({asked:[x1,y1,x2,y2],shown:[r(vx/IW*100),r(vy/IH*100),r((vx+vw)/IW*100),r((vy+vh)/IH*100)],box:[bw,bh],px:Math.round(vw)});}
const over=el=>el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1;
for(const el of document.querySelectorAll('.fit')){
 const max=+el.dataset.max,min=+el.dataset.min,kids=el.dataset.scale?[...el.querySelectorAll(el.dataset.scale)]:[el];
 const base=kids.map(k=>parseFloat(getComputedStyle(k).fontSize));let s=max;
 const set=v=>el.dataset.scale?kids.forEach((k,j)=>k.style.fontSize=(base[j]*v/max)+'px'):(el.style.fontSize=v+'px');set(s);
 while(s>min&&over(el)){s-=2;set(s);}
 // Build 16: words the writer did not break are set in as few lines as the box allows: shrink (down to 72% of the
 // largest size) while that saves a line, so a quote never leaves one word on its own line ("weekend").
 if(!el.classList.contains('lines')&&el.querySelector('span')){const sp=el.querySelector('span'),lh=()=>Math.round(sp.getBoundingClientRect().height/parseFloat(getComputedStyle(el).lineHeight==='normal'?s*1.2:getComputedStyle(el).lineHeight));
  const n0=lh();if(n0>1){let t=s,best=null;while(t>Math.max(min,max*0.72)){t-=2;set(t);if(lh()<n0){best=t;break;}}if(best===null)set(s);else s=best;}}
 if(s<max)shrunk.push({k:el.dataset.k,from:max,to:s});
 if(over(el))problems.push({kind:'too long',k:el.dataset.k,text:el.innerText.slice(0,80)});
}
const rectOf=el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b.width?b:el.getBoundingClientRect();};
const boxes=[...document.querySelectorAll('[data-k]')].filter(el=>el.dataset.k!=='row');
for(const el of boxes){const b=rectOf(el);
 if(b.left<M-1||b.top<M-1||b.right>W-M+1||b.bottom>W-M+1){if(!(el.dataset.k==='band'||el.dataset.k==='footnote'&&b.left>=8&&b.right<=W-8&&b.bottom<=W-6))problems.push({kind:'outside',k:el.dataset.k,text:el.innerText.slice(0,60)});}}
for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.contains(b)||b.contains(a))continue;
 const x=rectOf(a),y=rectOf(b);if(x.left<y.right-2&&y.left<x.right-2&&x.top<y.bottom-2&&y.top<x.bottom-2)problems.push({kind:'overlap',k:a.dataset.k+' + '+b.dataset.k});}
for(const f of ['Anton','Inter','Archivo Black'])if(!document.fonts.check('40px "'+f+'"'))problems.push({kind:'font',k:f});
for(const i of document.images)if(!i.naturalWidth)problems.push({kind:'photo',k:'photo'});


const opaque=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(',').map(Number);return v.length<4||v[3]>=.9?'rgb('+v.slice(0,3).join(',')+')':null;};
const texts=[];
for(const el of document.querySelectorAll('[data-k]')){if(el.dataset.k==='row')continue;
 const leaves=[...el.querySelectorAll('*')].concat(el).filter(n=>[...n.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()));
 for(const n of leaves){const cs=getComputedStyle(n),rg=document.createRange();rg.selectNodeContents(n);const b=rg.getBoundingClientRect();let own=null,p=n;
  while(p&&p!==document.body){const o=opaque(getComputedStyle(p).backgroundColor);if(o&&!p.classList.contains('photo')){own=o;break;}p=p.parentElement;}
  texts.push({text:n.innerText.slice(0,40),color:cs.color,size:parseFloat(cs.fontSize),box:[b.left,b.top,b.right,b.bottom],own});}}
return {shrunk,problems,texts,shown};})()`;

export const WOW_HIDE_CSS = 'body *{color:transparent!important;text-shadow:none!important}.star,.chev{visibility:hidden!important}';

// Word and truth checks done before drawing (the WOW test, decision 82; house rules).
export function wowWordProblems(ad) {
  const out = [], need = WOW_NEEDS[ad.layout] || [];
  for (const k of [...need, 'button', 'logoLine']) if (!String(ad[k] ?? '').trim()) out.push(`${ad.name}: the ${ad.layout} layout needs "${k}".`);
  const head = ad.layout === 'big-review' ? 'quote' : ad.layout === 'big-number' ? null : 'headline';
  if (head && wordCount(ad[head]) > 7) out.push(`${ad.name}: the ${head} has ${wordCount(ad[head])} words; the WOW test allows 7 or fewer.`);
  const shown = (WOW_SHOWS[ad.layout] || []).filter(k => k !== 'photo' && k !== 'footnote');
  const total = shown.reduce((n, k) => n + (k === 'stars' ? 0 : wordCount(ad[k])), 0);
  if (total > 20) out.push(`${ad.name}: ${total} words on the picture (not counting the business name and footnote); the WOW test allows 20 or fewer.`);
  for (const [k, v] of Object.entries(ad)) if (typeof v === 'string' && /[–—]/.test(v)) out.push(`${ad.name}: "${k}" has an em or en dash; use a comma, a full stop or a hyphen.`);
  if (/\*\*/.test(String(ad.button || '') + String(ad.logoLine || '') + String(ad.footnote || ''))) out.push(`${ad.name}: **highlight** marks are only for the headline, kicker, proof and number lines.`);
  if (ad.layout === 'preview' && !/(^|\/)stand-ins\//.test(String(ad.photo || ''))) out.push(`${ad.name}: the preview must use a stand-in photo from library/stand-ins/ (decision 86).`);
  if (ad.layout !== 'preview' && /(^|\/)stand-ins\//.test(String(ad.photo || ''))) out.push(`${ad.name}: a stand-in photo may only be used in the "preview" layout, never as the business's own ad (decision 86).`);
  const marks = (WOW_SHOWS[ad.layout] || []).filter(k => k !== 'footnote').some(k => /(^|[^*])\*([^*]|$)/.test(String(ad[k] ?? '').replace(/\*\*(.+?)\*\*/g, '$1')));
  if (marks && !String(ad.footnote || '').trim()) out.push(`${ad.name}: a line has a * mark but there is no footnote to explain it.`);
  if (ad.show !== undefined && !parseShow(ad.show)) out.push(`${ad.name}: "show" must be four numbers, left top right bottom in percent of the photo, e.g. "78% 28% 98% 50%".`);
  if (ad.show !== undefined && (ad.focus !== undefined || ad.zoom !== undefined)) out.push(`${ad.name}: give "show" or focus and zoom, not both.`);
  if (ad.stars !== undefined && (ad.stars < 1 || ad.stars > 5)) out.push(`${ad.name}: stars must be 1 to 5, as the review gave.`);
  return out;
}

export function wowCheckNote({name, layout, file, result, problems, shrunk, notes, words}) {
  const L = [`# ${name} (${layout}): ${result}`, '', `Made by make_wow_ad (Max build 14), 1080 x 1080.`, `File: ${file}`, `Words on the picture (not counting the business name and footnote): ${words}`];
  if (layout === 'preview') L.push('', `**Page only.** This picture has a stand-in person and the band "${BAND_TEXT}". It is shown on the business's page and is never offered as a download (decision 86).`);
  L.push('', '## To fix', problems.length ? problems.map(p => `- ${p}`).join('\n') : '- nothing');
  if (shrunk?.length) L.push('', '## Shrunk to fit', shrunk.map(s => `- ${s.k}: ${s.from} to ${s.to} px`).join('\n'));
  if (notes?.length) L.push('', '## Notes', notes.map(n => `- ${n}`).join('\n'));
  return L.join('\n') + '\n';
}

export function wowSheetHtml(items) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS()}*{margin:0;box-sizing:border-box}body{background:#fff;font-family:'Inter';padding:30px;width:${items.length * 560 + 30}px}
.g{display:flex;gap:30px}.c h2{font-weight:800;font-size:22px;margin-bottom:10px;color:#111}.c img{width:530px;height:530px;display:block}</style></head><body><div class="g">${items.map(i => `<div class="c"><h2>${esc(i.label)}</h2><img src="${i.src}"></div>`).join('')}</div></body></html>`;
}
