// Max build 14 (25 Nov 2026): the WOW page (decision 94), the private page a business opens from email 1 before any
// reply. Design and words approved by Tavin on 25 Nov 2026 12:46 ("The page is perfect"; mock-up in
// Desktop\Max\research\step4-wow-ads\page-mock). Sections, in order: header; their ad now beside 2 new ads (downloads);
// new ad 1 beside the same ad with a stand-in technician (never a download) with why a team photo is better and why it
// cannot be downloaded; an optional "one thing we noticed" note; 3 more designs, blurred; one ask: reply to Dan.
// The approved explanations are fixed text; Page Builder fills in only the business's own facts.

import {INTER_FACES} from './wow-ads.mjs';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const REPLY_EMAIL = 'dan@blueonehundred.com';

export function wowPageWordProblems(words) {
  const problems = [], all = JSON.stringify(words);
  if (/[–—]/.test(all)) problems.push('An em or en dash is in the page words; use a comma, a full stop or a hyphen.');
  for (const [re, what] of [[/\bHopkins\b|scientific advertising/i, 'Hopkins or "scientific advertising"'],
    [/\b(Rule Checker|Visual Check|Ad Writer|Ad Maker|Page Builder|Fact Finder|Lead Finder|Review Miner|Outreach Writer|(Facebook|Instagram|TikTok|LinkedIn|X) Bot)\b/, 'a bot name'],
    [/\[S\d+\]|\b(?:T[1-5]|R[12])\b/, 'a rule name or source mark'],
    [/guaranteed results|more leads|more sales|more customers|number one|cheapest|the best (?:plumber|roofer|electrician|company|team|price)/i, 'a promise of results or an empty boast']])
    if (re.test(all)) problems.push(`The page words have ${what}: ${(all.match(re) || [''])[0]}`);
  return problems;
}

// d: {name, town, since, ads: [{show, download, title, text}, {...}], current: {show, title, text}, preview: {show},
//     situation, note?: {text}, more: [{show}], moreText, brand: {panel, accent, soft, highlight}}
export function wowPageHtml(d) {
  const C = d.brand, a1 = d.ads[0], a2 = d.ads[1];
  const card = (img, alt, tag, tagCls, title, text, extra = '') => `<div class="card"><div class="pic"><img src="${esc(img)}" alt="${esc(alt)}"></div><div class="body"><span class="tag ${tagCls}">${esc(tag)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${extra}</div></div>`;
  const dl = (file, as) => `<a class="dl" href="${esc(file)}" download="${esc(as)}">Download (PNG, 1080 x 1080)</a>`;
  const subject = encodeURIComponent(`${d.shortName || d.name} ads`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230F6B3A'/%3E%3Ctext x='32' y='46' font-family='Arial,sans-serif' font-weight='700' font-size='40' text-anchor='middle' fill='white'%3EM%3C/text%3E%3C/svg%3E">
<title>Two new ads for ${esc(d.name)}</title>
<style>
${INTER_FACES()}
:root{--ink:${C.panel};--green:${C.accent};--soft:${C.soft};--line:#d9e0dc;--muted:#4b5a52}
*{box-sizing:border-box;margin:0}
body{font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.55;font-size:18px}
.wrap{max-width:1120px;margin:0 auto;padding:0 28px}
header{background:var(--ink);color:#fff;padding:56px 0 48px}
header .from{font-size:15px;letter-spacing:2px;text-transform:uppercase;opacity:.75;font-weight:700}
header h1{font-size:44px;line-height:1.15;margin:12px 0 14px;font-weight:800}
header p{font-size:20px;max-width:760px;opacity:.92}
section{padding:56px 0;border-bottom:1px solid var(--line)}
h2{font-size:30px;line-height:1.2;margin-bottom:10px;font-weight:800}
.lead{color:var(--muted);max-width:780px;margin-bottom:28px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;align-items:start}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start}
.card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff}
.card .pic{background:#f3f5f4;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1}
.card .pic img{width:100%;height:100%;object-fit:contain;display:block}
.card .body{padding:18px 20px 22px}
.tag{display:inline-block;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:5px 10px;border-radius:6px;margin-bottom:10px}
.tag.now{background:#eceeed;color:#444}.tag.new{background:var(--soft);color:var(--green)}.tag.sample{background:#fff1d6;color:#7a4b00}
.card h3{font-size:20px;margin-bottom:6px}
.card p{font-size:16px;color:var(--muted)}
.dl{display:inline-flex;align-items:center;gap:8px;margin-top:14px;background:var(--green);color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:11px 18px;border-radius:10px}
.why{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px}
.why div{background:var(--soft);border-radius:16px;padding:22px 24px}
.why h3{font-size:19px;margin-bottom:8px}
.why p{font-size:16px}
.nodl{margin-top:14px;font-size:15px;font-weight:700;color:#7a4b00}
.note{background:#fff8e8;border:1px solid #f0dcae;border-radius:16px;padding:22px 26px;max-width:860px}
.note h3{font-size:19px;margin-bottom:6px}
.more{display:flex;gap:18px;margin:6px 0 4px;flex-wrap:wrap}
.more img{width:160px;height:160px;border-radius:12px;display:block}
.ask{background:var(--ink);color:#fff;text-align:center;padding:64px 0;border:0}
.ask h2{font-size:34px}
.ask p{opacity:.9;max-width:680px;margin:8px auto 26px}
.reply{display:inline-block;background:${C.highlight};color:var(--ink);font-weight:800;font-size:22px;text-decoration:none;padding:18px 36px;border-radius:14px}
footer{padding:28px 0 40px;color:var(--muted);font-size:14px}
img{-webkit-user-drag:none}
@media (max-width:820px){.grid3,.pair,.why{grid-template-columns:1fr}header h1{font-size:32px}h2{font-size:25px}body{font-size:17px}.more img{width:100px;height:100px}}
</style></head><body>

<header><div class="wrap">
  <div class="from">For ${esc(d.name)}, from Dan</div>
  <h1>Two new versions of your Facebook ad, free to keep.</h1>
  <p>${d.since ? `Your current ad has run since ${esc(d.since)}. ` : ''}We made two new versions from your own reviews and your own photo. Download them, run them, change them. No strings.</p>
</div></header>

<section><div class="wrap">
  <h2>Your ad now, and two new ones</h2>
  <p class="lead">Each new ad names one problem a customer has and gives one proof from your reviews. Both are square, for Facebook and Instagram feeds.</p>
  <div class="grid3">
    ${card(d.current.show, 'Your current ad', 'Your ad now', 'now', d.current.title, d.current.text)}
    ${card(a1.show, 'New ad 1', 'New ad 1', 'new', a1.title, a1.text, dl(a1.download, `${d.slug}-ad-1.png`))}
    ${card(a2.show, 'New ad 2', 'New ad 2', 'new', a2.title, a2.text, dl(a2.download, `${d.slug}-ad-2.png`))}
  </div>
</div></section>

<section><div class="wrap">
  <h2>The same ad, with one of your team in it</h2>
  <p class="lead">This is what new ad 1 looks like with a person doing the work${d.insteadOf ? ` instead of ${esc(d.insteadOf)}` : ''}.</p>
  <div class="pair">
    ${card(a1.show, 'New ad 1', 'New ad 1', 'new', d.ownTitle || 'With your photo', 'Yours to download above.')}
    ${card(d.preview.show, 'Sample: new ad 1 with a technician', 'Sample only', 'sample', 'With a technician', 'The person in this photo is not on your team.', '<div class="nodl">Not available to download.</div>')}
  </div>
  <div class="why">
    <div><h3>Why a photo of your team is better</h3><p>${esc(d.situation)} is about to let a stranger into their home. A photo of the person who will actually turn up answers their first question: who's coming?${d.ownLine ? ' ' + esc(d.ownLine) : ''} A person shows them who they'll meet at the door.</p></div>
    <div><h3>Why you can't download this one</h3><p>The technician is a sample photo we made to show the idea. Running it would tell your customers a stranger works for you, which isn't true. So it's never offered as a download, and the band across the photo stays on. Send me a photo of one of your team at work and I'll make your real version, free.</p></div>
  </div>
</div></section>
${d.note ? `
<section><div class="wrap">
  <div class="note"><h3>One thing we noticed</h3><p>${esc(d.note.text)}</p></div>
</div></section>
` : ''}
<section><div class="wrap">
  <h2>${d.more.length} more design${d.more.length === 1 ? ' is' : 's are'} ready</h2>
  <p class="lead">${esc(d.moreText)}</p>
  <div class="more">${d.more.map(m => `<img src="${esc(m.show)}" alt="">`).join('')}</div>
</div></section>

<section class="ask"><div class="wrap">
  <h2>Want the other ${d.more.length}?</h2>
  <p>Just reply to my email and say "send them". Or send a photo of one of your team at work, and I'll make the real version of the ad above too.</p>
  <a class="reply" href="mailto:${REPLY_EMAIL}?subject=${subject}">Reply to Dan</a>
</div></section>

<footer><div class="wrap">Made by Dan at Blue One Hundred for ${esc(d.name)}${d.town ? ', ' + esc(d.town) : ''}. Free to keep. This page is private and not listed on search engines.</div></footer>
</body></html>
`;
}

// Runs in the finished page: every picture loads, nothing sticks out sideways, the preview is never a link or download.
export const WOW_PAGE_CHECK = `(async()=>{const out={bad:[],overflow:false,previewLinked:false,downloads:0,height:0};
await Promise.all([...document.images].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));
for(const i of document.images)if(!i.naturalWidth)out.bad.push(i.getAttribute('src'));
out.previewLinked=[...document.querySelectorAll('a')].some(a=>/PREVIEW|preview-/i.test(a.getAttribute('href')||''));
out.downloads=document.querySelectorAll('a[download]').length;
out.overflow=document.documentElement.scrollWidth>window.innerWidth+1;out.height=document.documentElement.scrollHeight;return out;})()`;

// The 3 "more" designs are shown only as small blurred copies; the real files never go into the page folder.
export const blurPage = src => `<!doctype html><html><head><style>*{margin:0}body{width:360px;height:360px;overflow:hidden;background:#fff}img{width:360px;height:360px;display:block;filter:blur(9px);transform:scale(1.06)}</style></head><body><img src="${src}"></body></html>`;
