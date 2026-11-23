// Max build 11: the private pack page. Page Builder writes pages/<business>/page.md (only words the checkers passed);
// make_pack_page turns it into pages/<business>/index.html with the pack's own files beside it, one zip of images per
// platform, and a check note. The page has no network loads, no scripts beyond the copy buttons, and "noindex".

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const PAGE_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x'];
const PLATFORM_NAMES = {facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X'};
const platformSlug = name => { const k = String(name).trim().toLowerCase(); return PAGE_PLATFORMS.includes(k) ? k : null; };
// "Key: value" lines that hold words the business copies into Ads Manager get a copy button.
const COPY_KEYS = new Set(['headline', 'main text', 'form headline', 'form description', 'question to ask']);
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

const pretty = s => esc(s).replace(/&quot;(.+?)&quot;/g, '“$1”');
let copyId = 0;
function copyBox(label, text) { const id = 'c' + (++copyId); return `<div class="copybox" id="${id}"><b>${esc(label)}</b>${esc(text)}</div><button class="copy" data-t="${id}">Copy ${esc(label.toLowerCase())}</button>`; }
function fileTile(f) {
  const card = f.name.match(/(\d+)of(\d+)/), href = esc(f.to), cap = `<span>${esc(card ? `Card ${card[1]} of ${card[2]}${f.what ? ', ' + f.what : ''}` : (f.what || f.name))}</span>`;
  if (/\.mp4$/i.test(f.name)) return `<figure class="tile"><video src="${href}" controls muted playsinline preload="metadata"></video><figcaption>${cap}<a href="${href}" download>Download</a></figcaption></figure>`;
  return `<figure class="tile"><a href="${href}" download><img src="${href}" alt="${esc(f.what || f.name)}" loading="lazy"></a><figcaption>${cap}<a href="${href}" download>Download</a></figcaption></figure>`;
}
function filesBlock(b, business) {
  const rows = b.rows.map(r => {
    if (!r.platform || !r.files.length) return `<div class="prow"><h4>${esc(r.label)}</h4><p class="small">${pretty(r.text)}</p></div>`;
    const tiles = r.files.map(f => fileTile({...f, to: `files/${r.platform}/${f.name}`})).join('');
    return `<div class="prow"><h4>${esc(PLATFORM_NAMES[r.platform])}</h4><div class="tiles">${tiles}</div></div>`;
  }).join('');
  return `<div class="files"><div class="flabel">${esc(b.label)}</div>${rows}</div>`;
}
function blockHtml(b, business) {
  if (b.type === 'p') return `<p>${pretty(b.text)}</p>`;
  if (b.type === 'ul') return `<ul class="plain">${b.items.map(i => `<li>${pretty(i)}</li>`).join('')}</ul>`;
  if (b.type === 'ol') return `<ol class="steps">${b.items.map(i => `<li>${pretty(i)}</li>`).join('')}</ol>`;
  if (b.type === 'files') return filesBlock(b, business);
  const key = b.key.toLowerCase(), value = b.lines.join('\n');
  if (/^on the /.test(key)) return `<p class="onimage">${pretty(b.value)}</p>`;
  if (key === 'why') return `<ul class="why">${b.list.map(i => `<li>${pretty(i)}</li>`).join('')}</ul>`;
  if (key === 'buttons') return `<div class="paybtns">${(b.value.match(/\$\d+/g) || []).map(p => `<a class="btn" href="#" data-pay="${esc(p)}">US${esc(p)}</a>`).join('')}</div><p class="small">Prices in US dollars.</p>`;
  if (key === 'form image') { const f = filesInLine(b.value)[0]; return f ? `<div class="tiles">${fileTile({...f, to: `files/form/${f.name}`})}</div>` : `<p>${pretty(b.value)}</p>`; }
  if (b.list.length) return `<div class="kv"><b>${esc(b.key)}</b><ol>${b.list.map(i => `<li>${pretty(i)}</li>`).join('')}</ol></div>`;
  if (COPY_KEYS.has(key)) return copyBox(b.key, value);
  return `<div class="kv"><b>${esc(b.key)}</b>${esc(value)}</div>`;
}

export function pageHtml({page, business, brand = {}, zips = []}) {
  copyId = 0;
  const blue = /^#[0-9a-f]{6}$/i.test(brand.primary || '') ? brand.primary : '#1B3A9E', green = /^#[0-9a-f]{6}$/i.test(brand.accent || '') ? brand.accent : '#2E9B3E';
  const intro = page.sections.find(s => s.title.toLowerCase() === 'intro');
  const body = page.sections.filter(s => s !== intro).map(s => {
    const id = s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const card = /^(ad |carousel|video|lead form)/i.test(s.title);
    return `<section id="${esc(id)}"${card ? ' class="card"' : ''}><h2>${esc(s.title)}</h2>${s.blocks.map(b => blockHtml(b, business)).join('\n')}</section>`;
  }).join('\n');
  const zipLinks = zips.map(z => `<a class="pill" href="${esc(z.file)}" download>${esc(PLATFORM_NAMES[z.platform])} images (zip)</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(page.title || 'Your new ads')}</title>
<style>
:root{--blue:${blue};--green:${green};--ink:#14213d;--muted:#5b6478;--line:#e3e7ef;--bg:#f6f7fb}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ink);background:var(--bg);font-size:18px;line-height:1.55}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
header{background:var(--blue);color:#fff;padding:44px 0 36px}
header small{display:block;font-size:14px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-bottom:10px}
header h1{font-size:clamp(30px,5vw,44px);line-height:1.1;margin-bottom:14px}
header p{font-size:19px;max-width:900px;opacity:.95;margin-bottom:10px}
.pills{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.pill{display:inline-block;background:#fff;color:var(--blue);font-weight:800;border-radius:999px;padding:10px 18px;text-decoration:none;font-size:16px}
.pill.go{background:var(--green);color:#fff}
section{padding:36px 0 6px}
section.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;margin-top:26px}
h2{font-size:27px;margin-bottom:10px}
h4{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
p{margin-bottom:12px;max-width:860px}
.onimage{font-size:23px;font-weight:800}
.why{list-style:none;margin:6px 0 14px}
.why li{padding:8px 0 8px 30px;position:relative;border-bottom:1px solid var(--line)}
.why li:before{content:"✓";position:absolute;left:4px;top:8px;color:var(--blue);font-weight:900}
.copybox,.kv{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:16px;white-space:pre-wrap}
.copybox b,.kv b,.flabel{display:block;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.kv ol{margin-left:22px;white-space:normal}
button.copy{margin-top:8px;background:var(--blue);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;font-size:15px;cursor:pointer}
.files{border-top:1px solid var(--line);margin-top:18px;padding-top:12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.tile img,.tile video{width:100%;border-radius:8px;display:block;background:#dfe3ea}
.tile figcaption{font-size:13px;color:var(--muted);margin-top:4px;display:flex;flex-direction:column}
.tile a{color:var(--blue)}
.plain{margin:0 0 12px 22px}
.steps{counter-reset:s;list-style:none}
.steps li{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px 14px 60px;margin-bottom:10px;position:relative}
.steps li:before{counter-increment:s;content:counter(s);position:absolute;left:18px;top:12px;width:30px;height:30px;border-radius:50%;background:var(--blue);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}
.paybtns{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.paybtns .btn{background:var(--green);color:#fff;text-decoration:none;font-weight:800;border-radius:10px;padding:11px 18px;min-width:76px;text-align:center}
.small{font-size:15px;color:var(--muted)}
footer{color:var(--muted);font-size:15px;padding:36px 0 50px;border-top:1px solid var(--line);margin-top:36px}
@media (max-width:760px){body{font-size:17px}.tiles{grid-template-columns:repeat(2,1fr)}section.card{padding:18px}}
</style>
</head>
<body>
<header><div class="wrap">
<small>${esc(page.madeFor.replace(/^Made for /, 'Made for '))}</small>
<h1>${esc(page.title)}</h1>
${(intro?.blocks || []).map(b => b.type === 'p' ? `<p>${pretty(b.text)}</p>` : '').join('')}
<div class="pills">${zipLinks}<a class="pill go" href="#how-to-test-them">How to test them</a></div>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">Made by Blue One Hundred. This page is private: only people with the link can see it.</div></footer>
<script>document.querySelectorAll('button.copy').forEach(function(b){b.addEventListener('click',function(){var t=document.getElementById(b.dataset.t);var s=t.innerText.replace(/^[^\\n]*\\n/,'');(navigator.clipboard?navigator.clipboard.writeText(s):Promise.reject()).then(function(){b.textContent='Copied';},function(){var r=document.createRange();r.selectNodeContents(t);var sel=getSelection();sel.removeAllRanges();sel.addRange(r);});});});</script>
</body>
</html>
`;
}

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
