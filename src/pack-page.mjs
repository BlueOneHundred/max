// Max build 11: the private pack page. Page Builder writes pages/<business>/page.md (only words the checkers passed);
// make_pack_page turns it into pages/<business>/index.html with the pack's own files beside it, one zip of images per
// platform, and a check note. Build 12: the new design (see pageHtml). The page has no network loads and "noindex".

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const PAGE_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x'];
const PLATFORM_NAMES = {facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X'};
const platformSlug = name => { const k = String(name).trim().toLowerCase(); return PAGE_PLATFORMS.includes(k) ? k : null; };
const LINE_KEYS = new Set(['on the image', 'on the first card', 'on the first frame', 'headline', 'form headline', 'form description', 'question to ask', 'form image', 'buttons']);
const FILE_RE = /([A-Za-z0-9][A-Za-z0-9_.-]*\.(?:jpe?g|png|mp4))(?:\s*\(([^)]*)\))?/gi;

export function filesInLine(text) { return [...String(text).matchAll(FILE_RE)].map(m => ({name: m[1], what: (m[2] || '').trim()})); }

// page.md -> {title, madeFor, sections: [{title, blocks}]}. Blocks: p, ul, ol, kv {key, value, lines}, files {label, rows}.
export function parsePageMd(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n'), page = {title: '', madeFor: '', sections: []};
  let section = null, block = null;
  const close = () => { block = null; };
  const push = b => { if (!section) { section = {title: '', blocks: []}; page.sections.push(section); } section.blocks.push(b); return b; };
  for (const raw of lines) {
    const line = raw.trimEnd(), t = line.trim();
    if (!t) { if (block && block.type !== 'kv') close(); else if (block?.type === 'kv' && (block.lines.length || block.list.length)) close(); continue; }
    if (/^# /.test(t)) { page.title = t.slice(2).trim(); close(); continue; }
    if (/^## /.test(t)) { section = {title: t.slice(3).trim(), blocks: []}; page.sections.push(section); close(); continue; }
    if (!page.sections.length && /^Made for /.test(t)) { page.madeFor = t; continue; }
    const label = t.match(/^([A-Z][A-Za-z ]*(?:\([^)]*\))?):$/);
    if (label) { const key = label[1].trim(); block = push(/^files/i.test(key) ? {type: 'files', label: key, rows: []} : {type: 'kv', key, value: '', lines: [], list: []}); continue; }
    const kv = t.match(/^([A-Z][A-Za-z ]*):\s+(.+)$/);
    if (kv && LINE_KEYS.has(kv[1].toLowerCase())) { push({type: 'kv', key: kv[1], value: kv[2], lines: [kv[2]], list: []}); close(); continue; }
    const bullet = t.match(/^- (.+)$/), numbered = t.match(/^(\d+)\. (.+)$/);
    if (block?.type === 'files' && bullet) {
      const m = bullet[1].match(/^([A-Za-z]+):\s*(.*)$/);
      block.rows.push(m ? {platform: platformSlug(m[1]), label: m[1], text: m[2], files: filesInLine(m[2])} : {platform: null, label: '', text: bullet[1], files: filesInLine(bullet[1])});
      continue;
    }
    if (block?.type === 'kv') { if (bullet || numbered) block.list.push((bullet || numbered)[bullet ? 1 : 2]); else block.lines.push(t); continue; }
    if (bullet) { if (block?.type !== 'ul') block = push({type: 'ul', items: []}); block.items.push(bullet[1]); continue; }
    if (numbered) { if (block?.type !== 'ol') block = push({type: 'ol', items: []}); block.items.push(numbered[2]); continue; }
    if (block?.type === 'p') block.text += ' ' + t; else block = push({type: 'p', text: t});
  }
  return page;
}

// Words that must never reach a customer: notes, rule names, bot names, the book.
export function pageWordProblems(md) {
  const problems = [], text = String(md);
  if (/[\u2013\u2014]/.test(text)) problems.push('page.md has an em or en dash.');
  for (const [re, what] of [[/##\s*For Max/i, 'a "## For Max" section (notes go in page-notes.md)'], [/\bHopkins\b|scientific advertising/i, 'Hopkins or "scientific advertising"'],
    [/\b(Rule Checker|Visual Check|Ad Writer|Page Builder|Fact Finder|Lead Finder|Outreach Writer|(Facebook|Instagram|TikTok|LinkedIn|X) Bot)\b/, 'a bot name'],
    [/\b(?:T[1-5]|H[1-4]|S[12]|O[12]|P[1-4]|F[12]|N[12]|X[12]|M[1-3]|R[12]|V[12])\b/, 'a rule name or source mark (for example T1 or S1)'], [/\[S\d+\]/, 'a source mark like [S1]'],
    [/guaranteed results|more leads|more sales|number one|cheapest|the best (?:roofer|landscaper|company|team|crew|price|in )/i, 'a promise of results or an empty boast']])
    if (re.test(text)) problems.push(`page.md has ${what}: ${(text.match(re) || [''])[0]}`);
  return problems;
}

export function requiredSections(page) {
  const titles = page.sections.map(s => s.title.toLowerCase()), missing = [];
  if (!page.title) missing.push('the "# Your new ads, <name>" title');
  for (const need of ['intro', 'how to test them', 'if you found these useful']) if (!titles.includes(need)) missing.push(`the "## ${need.replace(/^./, c => c.toUpperCase())}" section`);
  return missing;
}

// Every file the page names, with where it comes from in the team folder and where it goes on the page.
export function pageFiles(page, business) {
  const out = new Map();
  for (const s of page.sections) for (const b of s.blocks) {
    if (b.type === 'files') for (const r of b.rows) for (const f of r.files) if (r.platform) out.set(`${r.platform}/${f.name}`, {platform: r.platform, name: f.name, what: f.what, from: `clients/${business}/free-pack/${r.platform}/${f.name}`, to: `files/${r.platform}/${f.name}`});
    if (b.type === 'kv' && /^form image$/i.test(b.key)) for (const f of filesInLine(b.value)) out.set(`form/${f.name}`, {platform: 'form', name: f.name, what: f.what, from: `clients/${business}/photos/${f.name}`, to: `files/form/${f.name}`});
  }
  return [...out.values()];
}

// Max build 12 (23 Nov 2026): the page design Tavin approved ("looks like a page from a professional company").
// One big preview per ad with platform tabs and shape buttons (the platform choice follows through the page), words
// beside it with copy buttons, videos as a still with a play button (only the clicked video loads), Carousel F as a
// working feed carousel per platform, a lead form mock, download cards and the thanks section in Tavin's own words.
const pretty = s => esc(s).replace(/&quot;(.+?)&quot;/g, '“$1”');
const NAMES = {facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X'};
const shapeOf = name => { const m = String(name).match(/(\d+)x(\d+)\.(?:jpe?g|png|mp4)$/i); return m ? `${m[1]}:${m[2]}` : ''; };
export const posterPath = (platform, name) => `posters/${platform}/${String(name).replace(/\.mp4$/i, '.jpg')}`;
export function businessName(page) { return String(page.title || '').replace(/^Your new ads,\s*/i, '').trim() || String(page.madeFor || '').replace(/^Made for\s*/i, '').split('·')[0].trim(); }
export function initials(name) {
  const words = String(name).replace(/&/g, ' ').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
  if (words[0] && words[0].length <= 5 && words[0] === words[0].toUpperCase()) return words[0].replace(/[^A-Za-z0-9]/g, '');
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
}
// Tavin's words (23 Nov 2026, decision 58). The business name is filled in; nothing else changes.
export function thanksText(name) {
  return `If you find what we have created for you to be useful to ${name}, you're more than welcome to say thanks if you wish. This is a completely optional gesture; everything we've created for you on this page is yours to download for free and use however you like.`;
}

const kv = (s, re) => s.blocks.find(b => b.type === 'kv' && re.test(b.key));
const kvText = b => b ? (b.lines.length ? b.lines.join('\n') : b.value) : '';
const unquote = s => String(s).trim().replace(/^["“](.*)["”]$/s, '$1');
const paras = s => s.blocks.filter(b => b.type === 'p').map(b => b.text);
function filesOf(s, posters) {
  const out = {}, b = s.blocks.find(x => x.type === 'files');
  if (!b) return out;
  for (const r of b.rows) {
    if (!r.platform) continue;
    out[NAMES[r.platform]] = {note: r.files.length ? '' : r.text, items: r.files.map(f => {
      const video = /\.mp4$/i.test(f.name), poster = posterPath(r.platform, f.name);
      return {name: f.name, path: `files/${r.platform}/${f.name}`, desc: f.what, shape: shapeOf(f.name), video, ...(video && posters.has(poster) ? {poster} : {})};
    })};
  }
  return out;
}
const anchor = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// page.md (parsed) -> the data the page's script draws from.
export function pageData({page, business, zips = [], posters = new Set()}) {
  const name = businessName(page), d = {biz: name, initials: initials(name), ads: [], car: null, vid: null, lead: null, how: [], test: {steps: [], after: []}, other: [], pay: [], zips: zips.map(z => ({file: z.file, plat: NAMES[z.platform], count: z.count, mb: z.mb || 0})), videos: []};
  for (const s of page.sections) {
    const t = s.title.trim(), low = t.toLowerCase(), ad = t.match(/^Ad ([A-Z0-9]+):\s*(.+)$/i);
    if (low === 'intro') continue;
    if (ad) d.ads.push({id: anchor(t), letter: ad[1], name: ad[2], onimage: unquote(kvText(kv(s, /^on the image$/i))), why: kv(s, /^why$/i)?.list || [], headline: kvText(kv(s, /^headline$/i)), main: kvText(kv(s, /^main text$/i)), files: filesOf(s, posters)});
    else if (/^carousel/.test(low)) d.car = {id: anchor(t), name: t, onimage: unquote(kvText(kv(s, /^on the first card$/i))), why: kv(s, /^why$/i)?.list || [], heads: kv(s, /^headlines/i)?.list || [], main: kvText(kv(s, /^main text$/i)), files: filesOf(s, posters)};
    else if (/^video/.test(low)) d.vid = {id: anchor(t), name: t, onimage: unquote(kvText(kv(s, /^on the first frame$/i))), about: paras(s).join(' '), main: kvText(kv(s, /^main text$/i)), files: filesOf(s, posters)};
    else if (/^lead form/.test(low)) { const img = filesInLine(kvText(kv(s, /^form image$/i)))[0]; d.lead = {headline: kvText(kv(s, /^form headline$/i)), desc: kvText(kv(s, /^form description$/i)), question: kvText(kv(s, /^question to ask$/i)), img: img ? `files/form/${img.name}` : '', imgdesc: img?.what || ''}; }
    else if (low === 'how we make ads') d.how = paras(s);
    else if (low === 'how to test them') d.test = {steps: s.blocks.filter(b => b.type === 'ol').flatMap(b => b.items), after: paras(s)};
    else if (low === 'if you found these useful') d.pay = (kvText(kv(s, /^buttons$/i)).match(/\$\d+/g) || []);
    else d.other.push({id: anchor(t), title: t, blocks: s.blocks.filter(b => ['p', 'ul', 'ol'].includes(b.type))});
  }
  for (const x of [...d.ads, d.vid].filter(Boolean)) for (const it of x.files.TikTok?.items || []) if (it.video) d.videos.push(it);
  return d;
}

// The page's own script (runs in the browser; kept as a real function so it is checked like other code).
function clientMain(D) {
  const PL = ['Facebook', 'Instagram', 'TikTok', 'LinkedIn', 'X'], views = [];
  let plat = 'Facebook';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const $ = id => document.getElementById(id);
  const copyBox = (label, text) => `<div class="copybox"><div class="lab">${esc(label)}<button class="copy" data-t="${esc(text)}">Copy</button></div><div class="txt">${esc(text)}</div></div>`;
  const why = list => list.length ? `<ul class="why">${list.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '';
  const stopVideos = except => document.querySelectorAll('video').forEach(v => { if (v !== except) v.pause(); });
  const media = it => !it.video ? `<img src="${it.path}" alt="${esc(it.desc || it.name)}">`
    : `<div class="player">${it.poster ? `<img src="${it.poster}" alt="${esc(it.desc || it.name)}">` : '<div class="noposter"></div>'}<button class="play" title="Play" data-src="${it.path}">&#9654;</button></div>`;
  const tabs = (avail, cur) => `<div class="tabs">${PL.filter(p => avail.includes(p)).map(p => `<button class="tab${p === cur ? ' on' : ''}" data-p="${p}">${p}</button>`).join('')}</div>`;
  document.addEventListener('click', ev => {
    const c = ev.target.closest('.copy');
    if (c) { const done = () => { c.textContent = 'Copied'; c.classList.add('done'); setTimeout(() => { c.textContent = 'Copy'; c.classList.remove('done'); }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(c.dataset.t).then(done, () => {}); return; }
    const pl = ev.target.closest('.play');
    if (pl) { const v = document.createElement('video'); v.src = pl.dataset.src; v.controls = true; v.autoplay = true; v.muted = true; v.playsInline = true; v.preload = 'auto';
      stopVideos(v); pl.parentElement.replaceWith(v); v.addEventListener('play', () => stopVideos(v)); return; }
    const t = ev.target.closest('.tab');
    if (t) { plat = t.dataset.p; stopVideos(); views.forEach(x => x.render()); }
  });
  function viewer(el, files) {
    const avail = PL.filter(p => files[p] && files[p].items.length), pick = {};
    if (!avail.length) return;
    const v = {render() {
      const p = avail.includes(plat) ? plat : avail[0], items = files[p].items, i = Math.min(pick[p] || 0, items.length - 1), it = items[i];
      el.innerHTML = tabs(avail, p) + `<div class="shapes">${items.map((x, j) => `<button class="shape${j === i ? ' on' : ''}" data-j="${j}">${esc(x.desc || x.shape || x.name)}</button>`).join('')}</div>`
        + `<div class="stage">${media(it)}</div><div class="under"><span>${p}${it.shape ? ' · ' + it.shape : ''}${it.video ? ' · video' : ''}</span><a class="dl" href="${it.path}" download>Download this ${it.video ? 'video' : 'image'}</a></div>`;
      el.querySelectorAll('.shape').forEach(b => { b.onclick = () => { pick[p] = +b.dataset.j; stopVideos(); v.render(); }; });
    }};
    views.push(v); v.render();
  }
  const ads = $('ads');
  for (const a of D.ads) {
    const s = document.createElement('section'); s.className = 'card'; s.id = a.id;
    s.innerHTML = `<div class="adgrid"><div class="v"></div><div><div class="kicker">Ad ${esc(a.letter)} · ${esc(a.name)}</div>${a.onimage ? `<div class="onimage">“${esc(a.onimage)}”</div>` : ''}${why(a.why)}${a.headline ? copyBox('Headline', a.headline) : ''}${a.main ? copyBox('Main text', a.main) : ''}</div></div>`;
    ads.appendChild(s); viewer(s.querySelector('.v'), a.files);
  }
  if (D.car) {
    const c = D.car, el = $('carousel'), avail = PL.filter(p => c.files[p]), n = Math.max(...PL.map(p => (c.files[p] && c.files[p].items.length) || 0), 0);
    el.innerHTML = `<h2>${esc(c.name)}</h2><p class="lead">This is how the carousel looks in the feed. Swipe or use the arrows to go through the cards, just as people will.</p><div class="card"><div class="adgrid"><div class="v"></div><div><div class="kicker">Carousel · ${n} cards</div>${c.onimage ? `<div class="onimage">“${esc(c.onimage)}”</div>` : ''}${why(c.why)}${c.heads.map((h, i) => copyBox('Card ' + (i + 1) + ' headline', h)).join('')}${c.main ? copyBox('Main text', c.main) : ''}</div></div></div>`;
    const box = el.querySelector('.v');
    const v = {render() {
      if (!avail.length) return;
      const p = avail.includes(plat) ? plat : avail[0], f = c.files[p], first = c.main.split('\n')[0];
      let inner;
      if (!f.items.length) {
        const tv = D.vid && D.vid.files[p] && D.vid.files[p].items[0];
        inner = (f.note ? `<p class="note">${esc(f.note)}</p>` : '') + (tv ? `<div class="stage">${media(tv)}</div><div class="under"><span>${p} · video</span><a class="dl" href="${tv.path}" download>Download this video</a></div>` : '');
      } else {
        const ig = p === 'Instagram', zip = D.zips.find(z => z.plat === p);
        inner = `<div class="post${ig ? ' ig' : ''}"><div class="top"><div class="av">${esc(D.initials)}</div><div class="who"><b>${esc(D.biz)}</b><span>Sponsored</span></div></div>`
          + (ig ? '' : `<div class="ptxt">${esc(first)} <button class="more">See more</button></div>`)
          + `<div class="track">${f.items.map((it, i) => `<div class="slide"><img src="${it.path}" alt="Card ${i + 1}">${ig ? '' : `<div class="cap"><span>${esc(c.heads[i] || '')}</span><span class="cta">Get quote</span></div>`}</div>`).join('')}</div>`
          + `<div class="carnav"><button class="arrow prev" title="Back">&#8249;</button><span class="count">1 / ${f.items.length}</span><div class="dots">${f.items.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div><button class="arrow next" title="Next">&#8250;</button></div>`
          + (ig ? `<div class="ptxt"><b>${esc(D.biz)}</b> ${esc(first)} <button class="more">more</button></div>` : '') + '</div>'
          + `<div class="under"><span>${p} · ${f.items.length} cards${f.items[0].shape ? ', ' + f.items[0].shape : ''}</span>${zip ? `<a class="dl" href="${zip.file}" download>All ${p} images (zip)</a>` : ''}</div>`;
      }
      box.innerHTML = tabs(avail, p) + inner;
      const tr = box.querySelector('.track');
      if (tr) {
        const sl = [...tr.children], cnt = box.querySelector('.count'), dots = [...box.querySelectorAll('.dots i')], pv = box.querySelector('.prev'), nx = box.querySelector('.next');
        const step = () => sl.length > 1 ? sl[1].offsetLeft - sl[0].offsetLeft : 1, cur = () => Math.min(sl.length - 1, Math.round(tr.scrollLeft / step()));
        const upd = () => { const i = cur(); cnt.textContent = (i + 1) + ' / ' + sl.length; dots.forEach((d, j) => d.classList.toggle('on', j === i)); pv.disabled = i === 0; nx.disabled = i === sl.length - 1; };
        const go = d => { const i = Math.max(0, Math.min(sl.length - 1, cur() + d)); tr.scrollTo({left: sl[i].offsetLeft - sl[0].offsetLeft, behavior: 'smooth'}); };
        pv.onclick = () => go(-1); nx.onclick = () => go(1); tr.addEventListener('scroll', () => requestAnimationFrame(upd)); upd();
      }
      box.querySelectorAll('.more').forEach(b => { b.onclick = () => { b.parentElement.innerHTML = (p === 'Instagram' ? `<b>${esc(D.biz)}</b> ` : '') + esc(c.main); }; });
    }};
    views.push(v); v.render();
  }
  if (D.vid) {
    const c = D.vid, el = $('video');
    el.innerHTML = `<h2>The carousel as a video</h2><div class="card"><div class="adgrid"><div class="v"></div><div><div class="kicker">Video</div>${c.onimage ? `<div class="onimage">“${esc(c.onimage)}”</div>` : ''}${c.about ? `<p>${esc(c.about)}</p>` : ''}${c.main ? copyBox('Main text', c.main) : ''}</div></div></div>`;
    viewer(el.querySelector('.v'), c.files);
  }
  if (D.lead) {
    const l = D.lead, el = $('lead-form'), m = l.question.match(/^"?([^"(]+)"?\s*\(([^)]*)\)/), q = m ? m[1].trim() : l.question, opts = m ? m[2].split('/').map(s => s.trim()) : [];
    el.innerHTML = `<h2>Lead form</h2><div class="card"><div class="adgrid"><div><div class="formmock">${l.img ? `<img src="${l.img}" alt="${esc(l.imgdesc)}">` : ''}<div class="in"><h4>${esc(l.headline)}</h4><p>${esc(l.desc)}</p><div class="q">${esc(q)}</div>${opts.map(o => `<div class="opt">${esc(o)}</div>`).join('')}<div class="submit">Submit</div></div></div>`
      + (l.img ? `<div class="under"><span>Form image: ${esc(l.imgdesc)}</span><a class="dl" href="${l.img}" download>Download the photo</a></div>` : '')
      + `</div><div><div class="kicker">What to put in your form</div>${l.headline ? copyBox('Form headline', l.headline) : ''}${l.desc ? copyBox('Form description', l.desc) : ''}${l.question ? copyBox('Question to ask', l.question) : ''}</div></div></div>`;
  }
  const dl = $('downloads');
  dl.innerHTML = '<h2>Download everything</h2><p class="lead">Each zip holds all the images for that platform. Videos download one by one.</p><div class="dlgrid">'
    + D.zips.map(z => `<div class="dlcard"><b>${z.plat} images</b><span>Zip, ${z.count} images${z.mb ? ', ' + z.mb + ' MB' : ''}</span><a class="dl" href="${z.file}" download>Download zip</a></div>`).join('')
    + (D.videos.length ? `<div class="dlcard"><b>TikTok videos</b><span>${D.videos.length} videos, 9:16</span><ul>${D.videos.map(t => `<li><a href="${t.path}" download>${esc(t.name)}</a></li>`).join('')}</ul></div>` : '') + '</div>';
}

function otherHtml(s) {
  return `<section class="block" id="${esc(s.id)}"><h2>${esc(s.title)}</h2>${s.blocks.map(b => b.type === 'p' ? `<p class="lead">${pretty(b.text)}</p>` : b.type === 'ul' ? `<ul class="plain">${b.items.map(i => `<li>${pretty(i)}</li>`).join('')}</ul>` : `<ol class="steps">${b.items.map(i => `<li>${pretty(i)}</li>`).join('')}</ol>`).join('')}</section>`;
}

export function pageHtml({page, business, brand = {}, zips = [], posters = new Set()}) {
  const blue = /^#[0-9a-f]{6}$/i.test(brand.primary || '') ? brand.primary : '#1B3A9E', green = /^#[0-9a-f]{6}$/i.test(brand.accent || '') ? brand.accent : '#2E9B3E';
  const d = pageData({page, business, zips, posters}), intro = page.sections.find(s => s.title.toLowerCase() === 'intro');
  const jump = [...d.ads.map(a => [a.id, 'Ad ' + a.letter]), ...(d.car ? [['carousel', 'Carousel']] : []), ...(d.vid ? [['video', 'Video']] : []), ...(d.lead ? [['lead-form', 'Lead form']] : []),
    ...(d.test.steps.length ? [['how-to-test', 'How to test']] : []), ['downloads', 'Downloads']];
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(page.title || 'Your new ads')}</title>
<style>
:root{--blue:${blue};--green:${green};--ink:#14213d;--muted:#56607a;--line:#e1e6ef;--bg:#f4f6fa}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ink);background:var(--bg);font-size:19px;line-height:1.6}
.wrap{max-width:1320px;margin:0 auto;padding:0 32px}
header{background:var(--blue);color:#fff;padding:56px 0 40px}
header small{display:block;font-size:15px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-bottom:12px}
header h1{font-size:clamp(32px,4.4vw,54px);line-height:1.1;margin-bottom:18px}
header p{font-size:21px;max-width:1000px;opacity:.96}
nav.jump{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 2px 10px rgba(20,33,61,.05)}
nav.jump .wrap{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding-top:10px;padding-bottom:10px}
nav.jump a{color:var(--ink);text-decoration:none;font-weight:700;font-size:16px;padding:8px 14px;border-radius:999px}
nav.jump a:hover{background:#eef2f8;color:var(--blue)}
nav.jump a.go{margin-left:auto;background:var(--green);color:#fff}
h2{font-size:34px;line-height:1.2;margin-bottom:14px}
section.block,.card{scroll-margin-top:84px}
section.block{padding:56px 0 8px}
.lead{font-size:21px;max-width:1000px;margin-bottom:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:36px;margin-top:28px;box-shadow:0 4px 24px rgba(20,33,61,.04)}
.adgrid{display:grid;grid-template-columns:minmax(0,520px) minmax(0,1fr);gap:48px;align-items:start}
.kicker{font-size:15px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blue)}
.onimage{font-size:30px;font-weight:800;line-height:1.2;margin:6px 0 16px}
.why{list-style:none;margin:0 0 20px}
.why li{padding:10px 0 10px 34px;position:relative;border-bottom:1px solid var(--line)}
.why li:before{content:"\\2713";position:absolute;left:4px;top:10px;color:var(--blue);font-weight:900}
.copybox{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-top:16px}
.copybox .lab{display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.copybox .txt{white-space:pre-wrap;font-size:19px}
button{font:inherit;cursor:pointer}
.copy{background:var(--blue);color:#fff;border:0;border-radius:8px;padding:6px 14px;font-weight:700;font-size:15px;letter-spacing:0;text-transform:none}
.copy.done{background:var(--green)}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.tab{border:2px solid var(--line);background:#fff;color:var(--ink);border-radius:999px;padding:7px 16px;font-weight:700;font-size:16px}
.tab.on{background:var(--blue);border-color:var(--blue);color:#fff}
.shapes{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.shape{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:8px;padding:5px 12px;font-size:15px}
.shape.on{background:var(--ink);border-color:var(--ink);color:#fff}
.stage{background:#eef1f6;border-radius:16px;height:min(70vh,660px);display:flex;align-items:center;justify-content:center;padding:18px;position:relative}
.stage img,.stage video{max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 8px 30px rgba(20,33,61,.18);display:block;background:#000}
.player{position:relative;max-width:100%;max-height:100%;display:flex}
.noposter{width:300px;height:420px;max-width:100%;border-radius:10px;background:#1b2436}
.player .play{position:absolute;inset:0;margin:auto;width:84px;height:84px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:34px;display:flex;align-items:center;justify-content:center;padding-left:6px}
.player .play:hover{background:var(--blue)}
.under{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;font-size:16px;color:var(--muted);flex-wrap:wrap}
.dl{display:inline-block;background:#fff;border:2px solid var(--blue);color:var(--blue);font-weight:800;text-decoration:none;border-radius:10px;padding:7px 16px;font-size:16px}
.dl:hover{background:var(--blue);color:#fff}
.note{font-size:17px;color:var(--muted);margin-bottom:12px}
.post{background:#fff;border:1px solid var(--line);border-radius:14px;max-width:560px;margin:0 auto;overflow:hidden;box-shadow:0 8px 30px rgba(20,33,61,.12)}
.post .top{display:flex;gap:12px;align-items:center;padding:14px 16px 8px}
.av{width:42px;height:42px;border-radius:50%;background:var(--blue);color:#fff;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none}
.post .who b{display:block;font-size:16px;line-height:1.2}.post .who span{font-size:13px;color:var(--muted)}
.post .ptxt{font-size:16px;padding:4px 16px 12px;white-space:pre-wrap}
.post .ptxt .more{color:var(--muted);font-weight:700;border:0;background:none;font-size:16px}
.track{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 16px 6px;scrollbar-width:none}
.track::-webkit-scrollbar{display:none}
.slide{flex:0 0 78%;scroll-snap-align:start;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
.post.ig .track{padding:0;gap:0}.post.ig .slide{flex:0 0 100%;border:0;border-radius:0}
.slide img{width:100%;display:block;aspect-ratio:1/1;object-fit:cover}
.slide .cap{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;font-size:15px;font-weight:700;background:#f3f4f7}
.slide .cap .cta{background:#e4e6eb;border-radius:6px;padding:5px 10px;font-size:14px;white-space:nowrap}
.carnav{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px}
.arrow{width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:#fff;font-size:20px;font-weight:900;color:var(--ink)}
.arrow:disabled{opacity:.3;cursor:default}
.dots{display:flex;gap:6px}.dots i{width:8px;height:8px;border-radius:50%;background:#c9cfdb;display:block}.dots i.on{background:var(--blue)}
.count{font-size:14px;color:var(--muted);min-width:44px;text-align:center}
.formmock{max-width:460px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(20,33,61,.12)}
.formmock img{width:100%;display:block;aspect-ratio:1.91/1;object-fit:cover}
.formmock .in{padding:18px 20px}.formmock h4{font-size:21px;margin-bottom:6px}.formmock p{font-size:15px;color:var(--muted);margin-bottom:14px}
.formmock .q{font-weight:700;font-size:16px;margin-bottom:8px}
.opt{border:1px solid var(--line);border-radius:8px;padding:8px 12px;font-size:15px;margin-bottom:6px}
.submit{background:var(--blue);color:#fff;border-radius:8px;text-align:center;padding:10px;font-weight:800;margin-top:12px}
.plain{margin:0 0 12px 24px;max-width:1000px}
.steps{counter-reset:s;list-style:none;max-width:1000px;margin-bottom:12px}
.steps li{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 22px 18px 72px;margin-bottom:12px;position:relative}
.steps li:before{counter-increment:s;content:counter(s);position:absolute;left:22px;top:16px;width:34px;height:34px;border-radius:50%;background:var(--blue);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}
.dlgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.dlcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.dlcard b{display:block;font-size:19px}.dlcard span{display:block;color:var(--muted);font-size:15px;margin-bottom:10px}
.dlcard ul{list-style:none}.dlcard li{margin:6px 0}.dlcard li a{color:var(--blue);font-weight:700;font-size:16px;font-feature-settings:'calt' 0;word-break:break-all}
.thanks{text-align:center;max-width:860px;margin:28px auto 0}
.thanks h2{font-size:40px}
.thanks p{font-size:21px}
.paybtns{display:flex;justify-content:center;flex-wrap:wrap;gap:14px;margin:26px 0 14px}
.paybtns a{background:var(--green);color:#fff;text-decoration:none;font-weight:800;font-size:22px;border-radius:12px;padding:14px 30px;min-width:120px}
.paybtns a:hover{filter:brightness(1.15)}
footer{color:var(--muted);font-size:15px;padding:40px 0 60px;border-top:1px solid var(--line);margin-top:56px}
@media (max-width:980px){.adgrid{grid-template-columns:minmax(0,1fr);gap:28px}.wrap{padding:0 18px}.card{padding:22px}body{font-size:18px}h2{font-size:28px}.stage{height:min(72vh,560px);padding:10px}
nav.jump .wrap{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}nav.jump a{font-size:15px;padding:6px 10px;white-space:nowrap}nav.jump a.go{margin-left:0}header{padding:36px 0 28px}header p{font-size:18px}.post .ptxt{font-size:15px}.thanks h2{font-size:30px}.thanks p{font-size:19px}}
</style>
</head>
<body>
<header><div class="wrap">
<small>${esc(page.madeFor)}</small>
<h1>${esc(page.title)}</h1>
${(intro?.blocks || []).filter(b => b.type === 'p').map(b => `<p>${pretty(b.text)}</p>`).join('')}
</div></header>
<nav class="jump"><div class="wrap">${jump.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join('')}<a class="go" href="#thanks">Say thanks</a></div></nav>
<main class="wrap">
${d.how.length ? `<section class="block" id="how-we-make-ads"><h2>How we make ads</h2>${d.how.map(p => `<p class="lead">${pretty(p)}</p>`).join('')}</section>` : ''}
<div id="ads"></div>
${d.car ? '<section class="block" id="carousel"></section>' : ''}
${d.vid ? '<section class="block" id="video"></section>' : ''}
${d.lead ? '<section class="block" id="lead-form"></section>' : ''}
${d.test.steps.length ? `<section class="block" id="how-to-test"><h2>How to test them</h2><ol class="steps">${d.test.steps.map(s => `<li>${pretty(s)}</li>`).join('')}</ol>${d.test.after.map(p => `<p class="lead">${pretty(p)}</p>`).join('')}</section>` : ''}
${d.other.map(otherHtml).join('\n')}
<section class="block" id="downloads"></section>
<section class="block" id="thanks"><div class="card thanks"><h2>If you found these useful...</h2><p>${esc(thanksText(d.biz))}</p>
<div class="paybtns">${d.pay.map(p => `<a href="#" data-pay="${esc(p)}">${esc(p)}</a>`).join('')}</div>
<p class="note">Prices in US dollars, paid securely through Whop.</p></div></section>
</main>
<footer><div class="wrap">Made by Blue One Hundred for ${esc(d.biz)}. This page is private: only people with the link can see it.</div></footer>
<script>window.PACK=${json};(${clientMain.toString()})(window.PACK);</script>
</body>
</html>
`;
}

// make_pack_page runs this in the finished page (renderPage's script): every picture and poster must load, every video
// must load its first frame, the carousel must hold all its cards and nothing may stick out sideways.
export const PAGE_CHECK_SCRIPT = `(async () => {
  const D = window.PACK || {}, out = {badImages: [], badVideos: [], overflow: false, cards: 0, wantCards: 0, height: 0};
  const all = [...(D.ads || []), D.car, D.vid].filter(Boolean).flatMap(x => Object.values(x.files || {}).flatMap(f => f.items || []));
  const imgs = [...new Set([...all.filter(i => !i.video).map(i => i.path), ...all.filter(i => i.poster).map(i => i.poster), ...(D.lead && D.lead.img ? [D.lead.img] : [])])];
  const vids = [...new Set(all.filter(i => i.video).map(i => i.path))];
  await Promise.all(imgs.map(src => new Promise(ok => { const i = new Image(); i.onload = () => { if (!i.naturalWidth) out.badImages.push(src); ok(); }; i.onerror = () => { out.badImages.push(src); ok(); }; i.src = src; })));
  for (const src of vids) await new Promise(ok => { const v = document.createElement('video'); let done = false; const end = good => { if (done) return; done = true; if (!good) out.badVideos.push(src); v.removeAttribute('src'); v.load(); ok(); };
    v.muted = true; v.preload = 'auto'; v.onloadeddata = () => end(v.videoWidth > 0); v.onerror = () => end(false); setTimeout(() => end(false), 20000); v.src = src; });
  const track = document.querySelector('#carousel .track'); out.cards = track ? track.children.length : 0;
  out.wantCards = D.car ? Math.max(0, ...Object.values(D.car.files).map(f => (f.items || []).length)) : 0;
  out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  out.height = document.documentElement.scrollHeight;
  return out;
})()`;

// A plain (stored, not compressed) zip: JPGs and MP4s are already compressed. Works in every unzip tool.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
export function zipStore(entries, when = new Date()) {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1), dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals = [], centrals = []; let offset = 0;
  for (const {name, data} of entries) {
    const nameBuf = Buffer.from(name, 'utf8'), crc = crc32(data), size = data.length;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(size, 20); central.writeUInt32LE(size, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data); centrals.push(central, nameBuf); offset += 30 + nameBuf.length + size;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function pageCheckNote({business, result, files, zips, toFix, notes, bytes}) {
  return ['# Page check: ' + business, '', '- Made: ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', '- Result: ' + result, `- Files on the page: ${files.length} (${PAGE_PLATFORMS.map(p => `${PLATFORM_NAMES[p]} ${files.filter(f => f.platform === p).length}`).join(', ')}${files.some(f => f.platform === 'form') ? ', form image 1' : ''})`,
    `- Image zips: ${zips.map(z => `${z.file} (${z.count} images)`).join(', ') || 'none'}`, `- Page folder size: about ${Math.round(bytes / 1e6)} MB`, '',
    ...(toFix.length ? ['## To fix', ...toFix.map(x => '- ' + x)] : ['Nothing to fix.']), ...(notes.length ? ['', '## Notes', ...notes.map(x => '- ' + x)] : []), ''].join('\n');
}
