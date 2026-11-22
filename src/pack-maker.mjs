// Max build 2: ad packs for each platform (make_pack_ad, make_pack_carousel, make_pack_video).
// Sizes and safe zones are never written here: they come from the team folder's specs/<platform>.md (its ```json
// "Formats" block, kept current by each platform bot). One layout adapts to every shape: the photo fills the frame,
// a label sits top left, and the words sit at the bottom on a colour fade (or on the left for wide 16:9 frames),
// always inside that platform's safe zone and clear of any button column (TikTok).
// After drawing, PACK_JS measures where every word, badge and label really landed. Anything in a safe zone,
// under a button column, cut off, overlapping or left as a lone last word is a problem, and the file is not passed.
// Build 8 (22 Nov 2026, JJBM): a single word alone on a last line counts when that line is under half as wide as the
// line above ("Connecticut." was missed: only words of 6 letters or fewer counted; "Masonry and / hardscaping." is
// fine), so the tool rebalances the lines first. The "1 / 5" counter is a solid pill in the
// brand's panel colour (60% black vanished on dark branches).
// The look is the one Tavin approved for the free packs (session 1 to 3): Archivo Black headlines, Inter words.
import {packFonts} from './book-style.mjs';

export const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x'];
export const PACK_KINDS = ['ad', 'adVideo', 'carousel', 'carouselVideo'];
export const FPS = 30;
// Decision 36 (21 Nov 2026): videos are 15 seconds; the last card holds 3.6 s, cards change in 0.55 s.
export const VIDEO_SECONDS = 15, LAST_CARD_SECONDS = 3.6, CHANGE_SECONDS = 0.55, AD_VIDEO_SECONDS = 8;

const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = value => esc(value).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const lines = value => String(value ?? '').split(/\n|\\n/).map(esc).join('<br>');
const colour = value => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : null;
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
const focusCss = value => /^\d{1,3}% \d{1,3}%$/.test(String(value || '')) ? value : /^(center|top|bottom|left|right)( (center|top|bottom|left|right|\d{1,3}%))?$/.test(String(value || '')) ? value : '50% 50%';

// ---------- the spec sheet ----------
export function parseSpec(markdown, platform) {
  const m = String(markdown || '').match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`specs/${platform}.md has no Formats block (a \`\`\`json block).`);
  let d;
  try { d = JSON.parse(m[1]); } catch (error) { throw new Error(`The Formats block in specs/${platform}.md is not valid JSON: ${error.message}`); }
  const problems = [];
  if (platform && d.platform !== platform) problems.push(`it says platform "${d.platform}", not "${platform}"`);
  if (!Array.isArray(d.formats) || !d.formats.length) problems.push('it lists no formats');
  const ids = new Set();
  for (const f of d.formats || []) {
    const name = f && f.id ? `format "${f.id}"` : 'a format';
    if (!f || typeof f.id !== 'string' || !/^[a-z0-9-]{2,40}$/.test(f.id)) { problems.push(`${name} has no proper id`); continue; }
    if (ids.has(f.id)) problems.push(`${name} is listed twice`);
    ids.add(f.id);
    if (!Number.isInteger(f.width) || !Number.isInteger(f.height) || f.width < 200 || f.height < 200 || f.width > 4000 || f.height > 4000) problems.push(`${name} has a size outside 200 to 4000 pixels`);
    const s = f.safe || {};
    if (!['top', 'bottom', 'left', 'right'].every(k => Number.isFinite(s[k]) && s[k] >= 0)) { problems.push(`${name} has no safe zone numbers`); continue; }
    if (s.top + s.bottom >= f.height * 0.8 || s.left + s.right >= f.width * 0.8) problems.push(`${name} has a safe zone that leaves almost no room`);
    for (const b of s.blocks || []) if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite) || b[0] < 0 || b[1] < 0 || b[0] + b[2] > f.width || b[1] + b[3] > f.height) problems.push(`${name} has a block outside the frame`);
  }
  const pack = d.pack || {};
  for (const kind of PACK_KINDS) {
    if (pack[kind] === undefined) { problems.push(`the pack line has no "${kind}" list`); continue; }
    if (!Array.isArray(pack[kind])) { problems.push(`the pack line's "${kind}" is not a list`); continue; }
    for (const id of pack[kind]) if (!ids.has(id)) problems.push(`the pack line's "${kind}" names "${id}", which is not a format`);
  }
  if (problems.length) throw new Error(`specs/${platform}.md cannot be used: ${problems.join('; ')}.`);
  return d;
}
export const packFormats = (spec, kind) => (spec.pack?.[kind] || []).map(id => spec.formats.find(f => f.id === id));

// ---------- layout ----------
// The business name sits bottom right beside the badge only when the word column reaches the frame's own right margin.
// On wide frames, and where a button column narrows the words (TikTok), right-aligned would line it up with an invisible
// edge mid-screen, so it goes under the words, on the left, in the same place on every card (Tavin, 21 Nov 2026).
export function stacked(f) { const L = layoutBox(f); return shapeOf(f) === 'wide' || L.right > Math.max(f.safe.right, 3.4 * L.u) + 1; }
export function shapeOf(f) { const r = f.width / f.height; return r > 1.3 ? 'wide' : r < 0.7 ? 'story' : r < 0.95 ? 'tall' : 'square'; }

// Where words may go: the larger of the platform's safe zone and a small house margin. A block that reaches the right
// edge (TikTok's buttons) and comes down into the word area narrows the word column so nothing sits under it.
export function layoutBox(f) {
  // On full-screen 9:16 the words are 20% larger: a phone shows the whole frame, and there is room above the bottom zone.
  const u = Math.min(f.width, f.height) / 100 * (f.height / f.width > 1.5 ? 1.2 : 1), s = f.safe, pad = 3.4 * u;
  const box = {u, W: f.width, H: f.height, left: Math.max(s.left, pad), top: Math.max(s.top, pad), right: Math.max(s.right, pad), bottom: Math.max(s.bottom, pad)};
  for (const [bx, by, bw] of s.blocks || []) if (bx + bw >= f.width - 1 && by < f.height - box.bottom) box.right = Math.max(box.right, f.width - bx + 0.8 * u);
  return box;
}

const lum = hex => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const contrastRatio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// The brand's accent carries small white words (badges, step numbers). If white on it is under 4.5:1, use a deeper
// shade of the same colour until it reads; the hue stays the business's own.
export function readableAccent(accent, textColour = '#FFFFFF', need = 4.5) {
  let c = accent;
  for (let i = 0; i < 40 && contrastRatio(c, textColour) < need; i++) c = '#' + [1, 3, 5].map(k => Math.round(parseInt(c.slice(k, k + 2), 16) * 0.96).toString(16).padStart(2, '0')).join('');
  return c.toUpperCase();
}
function colours(brand = {}) {
  const primary = colour(brand.primary) || '#1B3A9E', given = colour(brand.accent) || '#2E9B3E', accentText = colour(brand.accentText) || '#FFFFFF';
  const accent = readableAccent(given, accentText);
  return {primary, accent, accentText, givenAccent: given, panel: colour(brand.panel) ? rgb(brand.panel) : '10,24,66', soft: colour(brand.soft) || '#DBE6FF'};
}

export function packCss(f, brand) {
  const L = layoutBox(f), u = L.u, C = colours(brand), P = C.panel, px = n => `${Math.round(n * 100) / 100}px`;
  const wideWidth = Math.min(f.width * 0.5, f.width - L.left - L.right);
  return `${packFonts()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${f.width}px;height:${f.height}px;overflow:hidden;background:#111}
body{font-family:'Inter',sans-serif;color:#fff;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.f{position:absolute;inset:0;overflow:hidden;background:#111}
.photo{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;filter:saturate(1.08) contrast(1.04);transform-origin:50% 50%}
.shade{position:absolute;left:0;right:0;bottom:0;top:${px(f.height * 0.45)};background:linear-gradient(to bottom,rgba(${P},0) 0%,rgba(${P},.78) 28%,rgba(${P},.94) 55%)}
.wide .shade{top:0;right:auto;width:${px(f.width * 0.74)};background:linear-gradient(to right,rgba(${P},.95) 0%,rgba(${P},.88) 55%,rgba(${P},0) 100%)}
.tag{position:absolute;top:${px(L.top)};left:${px(L.left)};background:#fff;color:${C.primary};font-weight:800;letter-spacing:.06em;font-size:${px(1.75 * u)};padding:${px(u)} ${px(1.6 * u)};border-radius:${px(0.6 * u)};box-shadow:0 4px 18px rgba(0,0,0,.25);white-space:nowrap;z-index:4}
.count{position:absolute;top:${px(L.top)};right:${px(L.right)};background:rgba(${P},.92);color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.25);font-weight:800;font-size:${px(1.75 * u)};padding:${px(u)} ${px(1.5 * u)};border-radius:${px(5 * u)};white-space:nowrap;z-index:4}
.label{position:absolute;font-family:'Archivo Black';font-size:${px(3 * u)};padding:${px(0.8 * u)} ${px(1.6 * u)};border-radius:${px(0.6 * u)};letter-spacing:.04em;box-shadow:0 6px 24px rgba(0,0,0,.35);white-space:nowrap;z-index:3}
.txt{position:absolute;left:${px(L.left)};right:${px(L.right)};bottom:${px(L.bottom)};z-index:3}
.wide .txt{right:auto;width:${px(wideWidth)}}
.wide.right .shade{left:auto;right:0;background:linear-gradient(to left,rgba(${P},.95) 0%,rgba(${P},.88) 55%,rgba(${P},0) 100%)}
.wide.right .txt{left:auto;right:${px(L.right)}}
.step{display:inline-flex;align-items:center;gap:${px(1.2 * u)};font-weight:800;letter-spacing:.12em;font-size:${px(1.9 * u)};color:${C.soft};margin-bottom:${px(1.4 * u)}}
.step b{display:inline-flex;align-items:center;justify-content:center;width:${px(5.2 * u)};height:${px(5.2 * u)};border-radius:50%;background:${C.accent};color:${C.accentText};font-family:'Archivo Black';font-weight:400;font-size:${px(2.8 * u)};letter-spacing:0}
.kick{display:inline-block;background:${C.accent};color:${C.accentText};font-weight:800;letter-spacing:.12em;font-size:${px(1.9 * u)};padding:${px(0.8 * u)} ${px(1.5 * u)};border-radius:${px(0.6 * u)};margin-bottom:${px(1.4 * u)}}
.big{font-family:'Archivo Black';line-height:.9;letter-spacing:-.02em;white-space:nowrap}
.big2{font-family:'Archivo Black';font-size:${px(4.6 * u)};line-height:1;margin-top:${px(0.6 * u)}}
.h{font-family:'Archivo Black';line-height:1.04;letter-spacing:-.01em;text-wrap:balance}
.q{font-family:'Archivo Black';line-height:1.08;text-wrap:balance}
.h b,.q b{color:${C.soft};font-weight:inherit}
.sub{font-size:${px(2.45 * u)};font-weight:600;margin-top:${px(1.6 * u)};line-height:1.3;text-wrap:pretty}
.who{font-size:${px(2.2 * u)};font-weight:700;margin-top:${px(1.5 * u)};color:${C.soft}}
.row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;row-gap:${px(1.6 * u)};margin-top:${px(2.6 * u)};gap:${px(2 * u)}}
.badge{display:inline-flex;align-items:center;gap:${px(u)};background:${C.accent};color:${C.accentText};font-weight:800;font-size:${px(2.1 * u)};padding:${px(1.1 * u)} ${px(1.7 * u)};border-radius:${px(5 * u)};white-space:nowrap}
.badge svg{width:${px(2.4 * u)};height:${px(2.4 * u)};flex:none}
.stack .row{flex-direction:column;align-items:flex-start;row-gap:${px(1.8 * u)}}
.stack .brand{margin-left:0;text-align:left}
.swipe{font-weight:800;font-size:${px(2.1 * u)};color:${C.soft};white-space:nowrap}
.brand{margin-left:auto;text-align:right;font-family:'Archivo Black';font-size:${px(1.9 * u)};line-height:1.05;letter-spacing:.02em;white-space:nowrap}
.brand small{display:block;font-family:'Inter';font-weight:700;font-size:${px(1.35 * u)};letter-spacing:.18em;color:${C.soft}}
`;
}

const check = fill => `<svg viewBox="0 0 24 24"><path fill="${fill}" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>`;
export const brandHtml = brand => `<div class="brand" data-k="brand">${lines(brand.name)}<small>${esc(brand.place || '')}</small></div>`;

// One frame (a still ad, a carousel card, or one card of a video). item fields, all optional except one main line:
// tag, labels [{text, side: left|right, at: 0..1 of the height, colour}], big + big2 (a large number and its words),
// step + stepLabel (a numbered step), or stepLabel alone (a word label in a pill, e.g. "TREE WORK"),
// headline (+ headlineSize in hundredths of the short side), quote, who, sub, step + stepLabel, badge, swipe, count.
// focus: "x% y%" for every shape, or {square, tall, story, wide}.
export function frameHtml({item, brand, f, images = {}, id = '', hideTag = false, hideBrand = false}) {
  const L = layoutBox(f), shape = shapeOf(f), u = L.u, C = colours(brand);
  const focus = typeof item.focus === 'object' && item.focus ? (item.focus[shape] || item.focus.tall || item.focus.square) : item.focus;
  const photo = item.photo && images[item.photo] ? `<div class="photo" style="background-image:url('${images[item.photo]}');background-position:${focusCss(focus)}"></div>` : '';
  const parts = [photo, '<div class="shade"></div>'];
  if (item.tag && !hideTag) parts.push(`<div class="tag" data-k="tag">${esc(item.tag)}</div>`);
  if (item.count) parts.push(`<div class="count" data-k="count">${esc(item.count)}</div>`);
  for (const lb of item.labels || []) {
    const at = Number.isFinite(lb.at) ? Math.min(0.9, Math.max(0.05, lb.at)) : 0.32, top = Math.round(f.height * at);
    const side = lb.side === 'right' ? `right:${Math.round(L.right)}px` : `left:${Math.round(L.left)}px`;
    parts.push(`<div class="label" data-k="label" style="top:${top}px;${side};background:${colour(lb.colour) ? readableAccent(lb.colour) : (lb.side === 'right' ? C.accent : 'rgba(20,20,20,.82)')}">${esc(lb.text)}</div>`);
  }
  let body = '';
  if (item.step) body += `<div class="step a" data-a="step"><b data-k="stepnum">${esc(item.step)}</b><span data-k="step">${esc(item.stepLabel || '')}</span></div>`;
  else if (item.stepLabel) body += `<div class="kick a" data-a="step" data-k="kick">${esc(item.stepLabel)}</div>`;
  if (item.big) body += `<div class="big a" data-k="big" data-main style="font-size:${(item.bigSize || 15) * u}px">${esc(item.big)}</div>${item.big2 ? `<div class="big2 a" data-k="big2">${esc(item.big2)}</div>` : ''}`;
  if (item.headline) body += `<div class="h a" data-k="h" data-main style="font-size:${(item.headlineSize || 8) * u}px">${rich(item.headline)}</div>`;
  if (item.quote) body += `<div class="q a" data-k="q" data-main style="font-size:${(item.quoteSize || 5.2) * u}px">${rich(item.quote)}</div>`;
  if (item.who) body += `<div class="who a" data-k="who">${esc(item.who)}</div>`;
  if (item.sub) body += `<div class="sub a" data-k="sub">${rich(item.sub)}</div>`;
  const left = item.badge ? `<div class="badge a" data-k="badge">${check(C.accentText)}${esc(item.badge)}</div>` : item.swipe ? `<div class="swipe" data-k="swipe">${esc(item.swipe)}</div>` : '';
  body += `<div class="row">${left}${hideBrand ? `<div class="brand" style="visibility:hidden">${lines(brand.name)}<small>${esc(brand.place || '')}</small></div>` : brandHtml(brand)}</div>`;
  parts.push(`<div class="txt">${body}</div>`);
  // Build 9: on wide frames side "right" puts the words, the fade and the business name on the right (subject on the left).
  const right = shape === 'wide' && item.side === 'right' ? ' right' : '';
  return `<div class="f ${shape}${right}${stacked(f) ? ' stack' : ''}"${id ? ` id="${id}"` : ''}>${parts.join('')}</div>`;
}

export function stillPage({item, brand, f, images}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${packCss(f, brand)}</style></head><body>${frameHtml({item, brand, f, images})}<script>${PACK_JS(f)}</script></body></html>`;
}

// ---------- measuring (runs inside the page) ----------
// window.packReady waits for fonts and photos. fit(frame) shrinks the main line (down to 70%) until the words sit
// below the top label and nothing is cut; it then fits the colour fade to the words. measure(frame, extra) checks
// every [data-k] element against the platform's safe zone and blocks, and returns problems plus each word's box and
// colours for the contrast check.
export function PACK_JS(f) {
  const L = layoutBox(f);
  return String.raw`
var PK={W:${f.width},H:${f.height},S:${JSON.stringify(f.safe)},u:${L.u},wide:${shapeOf(f) === 'wide'},left:${L.left},right:${f.width - L.right}};
window.packReady=(async()=>{await document.fonts.ready;
 await Promise.all([...document.querySelectorAll('.photo')].map(el=>new Promise(r=>{const m=/url\(["']?(.*?)["']?\)$/.exec(el.style.backgroundImage);if(!m)return r();const i=new Image();i.onload=()=>{el.dataset.ok='1';r();};i.onerror=()=>r();i.src=m[1];})));
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})();
function box(el){const r=el.getBoundingClientRect();return {x0:r.left,y0:r.top,x1:r.right,y1:r.bottom};}
function cutIn(frame){return [...frame.querySelectorAll('[data-k]')].some(el=>el.scrollWidth>el.clientWidth+1);}
function topLimit(frame){const tag=[...document.querySelectorAll('.tag')].find(t=>getComputedStyle(t).visibility!=='hidden'&&(frame.contains(t)||t.closest('#fixed')));const lim=Math.max(PK.S.top,tag?box(tag).y1+2*PK.u:0);
 let lab=0;for(const l of frame.querySelectorAll('.label'))lab=Math.max(lab,box(l).y1+1.5*PK.u);return Math.max(lim,lab);}
function fit(frame){const main=frame.querySelector('[data-main]'),txt=frame.querySelector('.txt');if(!main||!txt)return null;
 const start=parseFloat(main.style.fontSize);let size=start;const limit=topLimit(frame);
 while((box(txt).y0<limit||cutIn(frame))&&size>start*0.7){size-=Math.max(1,start*0.03);main.style.fontSize=size+'px';}
 for(const el of frame.querySelectorAll('.h,.q,.sub')){if(widow(el)){el.style.textWrap='balance';if(widow(el))el.style.textWrap='pretty';}}
 const shade=frame.querySelector('.shade');if(shade&&!PK.wide)shade.style.top=Math.max(0,box(txt).y0-12*PK.u)+'px';
 return size<start-0.5?{text:main.textContent.trim().slice(0,60),from:Math.round(start),to:Math.round(size)}:null;}
function words(el){const out=[];const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const re=/\S+/g;let m;while((m=re.exec(n.textContent))){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const b=r.getClientRects()[0];if(b)out.push({word:m[0],top:Math.round(b.top),left:b.left,right:b.right});}}return out;}
function widow(el){const ws=words(el);if(ws.length<3)return null;const ls=[];for(const w of ws){const l=ls[ls.length-1];if(l&&Math.abs(l.top-w.top)<8){l.words.push(w.word);l.left=Math.min(l.left,w.left);l.right=Math.max(l.right,w.right);}else ls.push({top:w.top,words:[w.word],left:w.left,right:w.right});}
 const end=ls[ls.length-1],before=ls[ls.length-2];return ls.length>1&&end.words.length===1&&(end.right-end.left)<0.5*(before.right-before.left)?end.words[0]:null;}
function measure(frame,extra){const S=PK.S,problems=[],texts=[],keys=[];
 const els=[...frame.querySelectorAll('[data-k]'),...(extra||[])].filter(el=>getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length);
 for(const el of els){const r=box(el),t=el.textContent.trim().slice(0,60),k=el.dataset.k;keys.push({k,r,t});
  if(r.x0<S.left-0.5||r.x1>PK.W-S.right+0.5||r.y0<S.top-0.5||r.y1>PK.H-S.bottom+0.5)problems.push({kind:'outside',text:t,where:k});
  for(const b of S.blocks||[])if(r.x0<b[0]+b[2]&&r.x1>b[0]&&r.y0<b[1]+b[3]&&r.y1>b[1])problems.push({kind:'block',text:t,where:k});
  if(el.scrollWidth>el.clientWidth+1)problems.push({kind:'cut',text:t,where:k});
  if(k==='brand'&&Math.abs(r.x0-PK.left)>2*PK.u&&Math.abs(r.x1-PK.right)>2*PK.u&&!(frame.querySelector('.txt')&&Math.abs(r.x0-box(frame.querySelector('.txt')).x0)<=2*PK.u))problems.push({kind:'floating',text:t,where:k});
  const cs=getComputedStyle(el),own=cs.backgroundColor!=='rgba(0, 0, 0, 0)'?cs.backgroundColor:null;
  texts.push({text:t,box:[r.x0,r.y0,r.x1,r.y1],color:cs.color,size:parseFloat(cs.fontSize),own});}
 const txt=frame.querySelector('.txt');if(txt){const T=box(txt);for(const o of keys.filter(x=>['tag','label','count'].includes(x.k)))if(o.r.x0<T.x1&&o.r.x1>T.x0&&o.r.y0<T.y1&&o.r.y1>T.y0)problems.push({kind:'overlap',text:o.t,where:o.k});
  const labs=keys.filter(x=>x.k==='label');for(let i=0;i<labs.length;i++)for(let j=i+1;j<labs.length;j++){const a=labs[i].r,b=labs[j].r;if(a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0)problems.push({kind:'overlap',text:labs[i].t+' / '+labs[j].t,where:'label'});}}
 for(const el of frame.querySelectorAll('.h,.q,.sub')){const w=widow(el);if(w)problems.push({kind:'widow',text:el.textContent.trim().slice(0,60),word:w});}
 for(const p of frame.querySelectorAll('.photo'))if(!p.dataset.ok)problems.push({kind:'image',text:'the photo did not load'});
 const fams=new Set([...document.fonts].filter(x=>x.status==='loaded').map(x=>x.family.replace(/["']/g,'')));for(const fam of ['Inter','Archivo Black'])if(!fams.has(fam))problems.push({kind:'font',text:fam});
 return {problems,texts};}
`;
}
export const STILL_SCRIPT = `(async()=>{await window.packReady;const fr=document.querySelector('.f');const shrunk=fit(fr);const m=measure(fr,[]);return {...m,shrunk:shrunk?[shrunk]:[]};})()`;
export const HIDE_WORDS_CSS = '.f *{color:transparent!important;text-shadow:none!important}.f svg{visibility:hidden!important}';

// ---------- video ----------
// Cards change by swipe on feed shapes and by dissolve on 9:16 (decision 37); card 1's words are on screen from the first
// frame (decision 38); the business name stays fixed, and the top label too when all cards share it (decision 39, build 7). One card alone (a still ad made
// into a short video for TikTok) holds still with a slow zoom.
export function videoTiming(n, total = VIDEO_SECONDS) {
  if (n === 1) return {durs: [total], starts: [0], total};
  const last = LAST_CARD_SECONDS, mid = (total - last) / (n - 1), durs = [...Array(n - 1).fill(mid), last];
  return {durs, starts: durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0)), total};
}
export function videoPage({cards, brand, f, images, transition, seconds}) {
  const n = cards.length, {durs, starts, total} = videoTiming(n, seconds || (n === 1 ? AD_VIDEO_SECONDS : VIDEO_SECONDS));
  const dissolve = (transition || (shapeOf(f) === 'story' ? 'dissolve' : 'swipe')) === 'dissolve';
  // Build 7 (22 Nov 2026, JJBM): the top label stays fixed only when every card has the same one. When the cards' labels
  // differ (TREE REMOVAL, LAWN CARE, HARDSCAPING), each card keeps its own label, which moves with its card, so a label
  // never sits over a photo of other work. The business name always stays fixed.
  const sameTag = new Set(cards.map(c => c.tag || '')).size <= 1;
  const tag = sameTag ? (cards.find(c => c.tag)?.tag || '') : '';
  // Build 9: on wide frames the business name stays fixed only when every card puts its words on the same side;
  // otherwise each card carries its own name under its words.
  const sameSide = shapeOf(f) !== 'wide' || new Set(cards.map(c => c.side === 'right' ? 'right' : 'left')).size <= 1;
  const frames = cards.map((c, i) => frameHtml({item: c, brand, f, images, id: 'c' + i, hideTag: sameTag, hideBrand: sameSide})).join('');
  const fixed = `<div id="fixed" class="${shapeOf(f)}${stacked(f) ? ' stack' : ''}" style="position:absolute;inset:0;z-index:9;pointer-events:none">${tag ? `<div class="tag" data-k="tag">${esc(tag)}</div>` : ''}${sameSide ? `<div class="brand" data-k="brand" style="position:absolute">${lines(brand.name)}<small>${esc(brand.place || '')}</small></div>` : ''}</div>`;
  const timeline = String.raw`
var T={W:${f.width},starts:${JSON.stringify(starts)},durs:${JSON.stringify(durs)},SW:${CHANGE_SECONDS},DIS:${dissolve},N:${n}};
var ease=x=>1-Math.pow(1-Math.min(Math.max(x,0),1),3),io=x=>{x=Math.min(Math.max(x,0),1);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
var IN={step:0.1,h:0.25,big:0.25,q:0.25,big2:0.35,who:0.4,sub:0.45,badge:1.1},ANIM=0.6;
function setTime(t){for(let i=0;i<T.N;i++){const el=document.getElementById('c'+i),s=T.starts[i],local=t-s;let x=0;
 if(T.DIS){el.style.opacity=i>0?io((t-(s-T.SW))/T.SW):1;}else{if(i>0)x=(1-io((t-(s-T.SW))/T.SW))*T.W;if(i<T.N-1)x-=io((t-(T.starts[i+1]-T.SW))/T.SW)*T.W*0.35;}
 el.style.transform='translateX('+x+'px)';el.style.zIndex=i;el.style.visibility=(t<s-T.SW||(i<T.N-1&&t>T.starts[i+1]))?'hidden':'visible';
 const z=(t-(s-(i>0?T.SW:0)))/(T.durs[i]+T.SW),ph=el.querySelector('.photo');if(ph)ph.style.transform='scale('+(1+0.07*Math.min(Math.max(z,0),1))+')';
 const base=i>0?0:-99;el.querySelectorAll('.a').forEach(a=>{const k=a.dataset.k||a.dataset.a;if(k==='badge'){const q=ease((local-(i>0?IN.badge:-99))/0.5);a.style.opacity=q;a.style.transform='scale('+(0.6+0.4*q)+')';}
  else{const p=ease((local-base-(IN[k]??0.3))/ANIM);a.style.opacity=p;a.style.transform='translateY('+((1-p)*40)+'px)';}});}}
function holdTime(i){return T.starts[i]+Math.min(T.durs[i]-T.SW-0.05,IN.badge+0.55);}
window.prepare=async()=>{await window.packReady;const shrunk=[];for(let i=0;i<T.N;i++){const s=fit(document.getElementById('c'+i));if(s)shrunk.push(s);}
 const fb=document.querySelector('#fixed .brand');if(fb){const ref=document.querySelector('#c0 .brand').getBoundingClientRect();fb.style.left=ref.left+'px';fb.style.top=ref.top+'px';fb.style.width=ref.width+'px';}
 const problems=[],texts=[];const fixedEls=[...document.querySelectorAll('#fixed [data-k]')];
 for(let i=0;i<T.N;i++){setTime(holdTime(i));const m=measure(document.getElementById('c'+i),i===0?fixedEls:[]);problems.push(...m.problems.map(p=>({...p,card:i+1})));texts.push(m.texts);}
 setTime(0);return {problems,shrunk,frames:Math.round(${total}*${FPS})};};`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${packCss(f, brand)}.f{will-change:transform,opacity}.a{will-change:transform,opacity}</style></head><body>${frames}${fixed}<script>${PACK_JS(f)}${timeline}</script></body></html>`;
}
export const VIDEO_SETUP = 'window.prepare()';
// The frame numbers where each card is at its fullest (all words in), for the contact sheet Visual Check looks at.
export function holdFrames(n, seconds) {
  const {durs, starts} = videoTiming(n, seconds);
  return starts.map((s, i) => Math.round((s + Math.min(durs[i] - CHANGE_SECONDS - 0.05, 1.1 + 0.55)) * FPS));
}
export function contactSheetHtml(frames, w, h) {
  const H = 640, W = Math.round(w * H / h), gap = 16, total = frames.length * W + (frames.length + 1) * gap;
  return {width: total, height: H + 2 * gap, html: `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{width:${total}px;height:${H + 2 * gap}px;background:#fff;overflow:hidden}body{display:flex;gap:${gap}px;padding:${gap}px}img{width:${W}px;height:${H}px;display:block;outline:1px solid #ccc}</style></head><body>${frames.map(src => `<img src="${src}">`).join('')}</body></html>`};
}
export const videoFrameScript = i => `setTime(${(i / FPS).toFixed(4)})`;

// ---------- results ----------
const SAY = {
  outside: p => `"${p.text}" (${p.where}) reaches into the platform's safe zone, where its own buttons or captions cover it`,
  block: p => `"${p.text}" (${p.where}) sits under the platform's button column`,
  cut: p => `"${p.text}" is cut off`,
  overlap: p => `"${p.text}" (${p.where}) overlaps the words`,
  floating: p => `the business name is not lined up with the words or the frame's right margin (it floats mid-frame)`,
  widow: p => `"${p.word}" sits alone on the last line of "${p.text}"`,
  image: () => 'the photo did not load',
  font: p => `the font ${p.text} did not load`,
  contrast: p => `"${p.text}" is hard to read on its background (contrast ${p.ratio}:1, needs ${p.need}:1)`,
};
export function packToFix(results) {
  const out = [];
  for (const r of results) for (const p of r.problems || []) out.push(`${r.file}${p.card ? ' card ' + p.card : ''}: ${(SAY[p.kind] || (x => x.kind + ': ' + x.text))(p)}.`);
  return [...new Set(out)];
}
export function packCheckNote({tool, platform, name, specChecked, results, toFix, notes = []}) {
  const rows = results.map(r => `| ${r.file} | ${r.format} | ${r.width} x ${r.height} | ${(r.problems || []).length ? 'FAIL' : 'PASS'} | ${(r.problems || []).length ? packToFix([r]).map(x => x.replace(/^[^:]+: /, '')).join(' ') : 'inside the safe zone, nothing cut or overlapping' + (r.shrunk?.length ? '; main line shrunk ' + r.shrunk.map(s => s.from + ' to ' + s.to + ' px').join(', ') : '')} |`);
  return `# ${name}: ${platform} (${tool})\n\nResult: ${toFix.length ? 'FAILED' : 'PASSED'}\nSpec sheet: specs/${platform}.md (checked ${specChecked || 'unknown'})\n\n| File | Format | Size | Check | Notes |\n|---|---|---|---|---|\n${rows.join('\n')}\n${toFix.length ? '\n## To fix\n' + toFix.map(x => '- ' + x).join('\n') + '\n' : ''}${notes.length ? '\n## Notes\n' + notes.map(x => '- ' + x).join('\n') + '\n' : ''}\n## For Max\n${toFix.length ? '- Not passed: the bot fixes the words, focus or layout and runs the tool again.' : '- nothing'}\n`;
}
