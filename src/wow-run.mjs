// Max build 21 (26 Nov 2026): Max runs himself. The WOW run takes one business from Lead Finder's list to a finished
// page and email 1, bot by bot, with the same engine as Toby's package runs (src/pipeline.mjs): the app messages each bot,
// waits for its reply, checks its files, gives a failed step at most 2 fix runs (the fix goes to the bot that owns it),
// then stops for Tavin. The daily run (each weekday 13:00 Hanoi time, decisions 104 to 109) asks Lead Finder for today's
// leads, picks the Top 3 under Tavin's standing rule (decision 108), gives each version A or B in turn and runs them one
// business at a time. It ends at "ready for Tavin's review" (decision 103): only Tavin publishes a page or sends an email.
// Before build 21 Tavin pasted Max's message into every bot by hand.
import {WOW_LAYOUTS, wowWordProblems} from './wow-ads.mjs';

export const WOW_BOTS = ['Review Miner', 'Fact Finder', 'Ad Writer', 'Rule Checker', 'Ad Maker', 'Page Builder', 'Outreach Writer', 'Visual Check'];
export const COUNTRIES = ['US', 'CA', 'UK', 'AU', 'NZ'];
const COUNTRY_ALIASES = {GB: 'UK', USA: 'US', 'UNITED STATES': 'US', CANADA: 'CA', 'UNITED KINGDOM': 'UK', AUSTRALIA: 'AU', 'NEW ZEALAND': 'NZ'};
export const validBusiness = s => /^[a-z0-9][a-z0-9-]{0,40}$/.test(String(s || ''));

// The steps. Saved to pipeline/wow-steps.json in the team folder the first time, so they can change without a build.
export const WOW_STEPS = {
  version: 2,
  steps: [
    {id: 'reviews', bot: 'Review Miner', fixes: 2, task: 'read the reviews for {business} ({name}; lead in {lead}) and write clients/{business}/reviews.md',
      gates: [{file: 'clients/{business}/reviews.md'}]},
    {id: 'facts', bot: 'Fact Finder', fixes: 2, task: 'write clients/{business}/facts.md (with "## Phone numbers"), brand.md and save their own photos in clients/{business}/photos/',
      gates: [{file: 'clients/{business}/facts.md', contains: ['## Phone numbers']}, {file: 'clients/{business}/brand.md', fresh: 'run'}]},
    {id: 'words', bot: 'Ad Writer', fixes: 2, task: 'write the WOW choices for {business}: clients/{business}/wow/choices.json and choices.md (2 ads, 3 more, the preview)',
      gates: [{file: 'clients/{business}/wow/choices.md'}, {file: 'clients/{business}/wow/choices.json'}, {choices: true}]},
    {id: 'rules', bot: 'Rule Checker', fixes: 2, task: 'check the WOW words for {business} (clients/{business}/wow/choices.json) and write clients/{business}/wow/rule-check.md',
      retry: ['Ad Writer', 'Rule Checker'],
      fixNote: {'Ad Writer': 'Rule Checker did not pass your words: make every fix in clients/{business}/wow/rule-check.md, in choices.json and choices.md.', 'Rule Checker': 'Check clients/{business}/wow/choices.json again after Ad Writer\'s fixes and update clients/{business}/wow/rule-check.md.'},
      gates: [{file: 'clients/{business}/wow/rule-check.md', verdict: 'Result: PASSED'}]},
    {id: 'ads', bot: 'Ad Maker', fixes: 2, task: 'make the WOW ads for {business} from clients/{business}/wow/choices.json with make_wow_ad, look at every picture and write clients/{business}/wow/made.md',
      retry: ['Ad Writer', 'Rule Checker', 'Ad Maker'],
      fixNote: {'Ad Writer': 'Ad Maker did not pass the ads: make what clients/{business}/wow/made.md asks under "## Word changes needed" (and anything listed below that is yours), in choices.json and choices.md. Change nothing else.', 'Rule Checker': 'Check only the ads Ad Writer has just changed in clients/{business}/wow/choices.json and update clients/{business}/wow/rule-check.md.', 'Ad Maker': 'Make the ads for {business} again from the new clients/{business}/wow/choices.json and update clients/{business}/wow/made.md.'},
      gates: [{file: 'clients/{business}/wow/made.md', verdict: 'Result: PASSED'}, {made: true}]},
    {id: 'page', bot: 'Page Builder', fixes: 2, task: 'make the WOW page for {business} with make_wow_page (pages/{business}/wow/)',
      gates: [{file: 'pages/{business}/wow/page-check.md', line: '^# WOW page for .+: PASSED\\s*$'}, {file: 'pages/{business}/wow/index.html'}]},
    {id: 'email', bot: 'Outreach Writer', fixes: 2, task: 'write email 1 in version {version}, and its two follow-ups, in outreach/{business}-emails.md',
      gates: [{email: true}]},
    // Build 25 (decision 113): Visual Check looks at the whole set by eye, the check Claude did by hand until 26 Nov.
    {id: 'check', bot: 'Visual Check', fixes: 1, task: 'check the whole WOW set for {business} (the ads, the page previews and the email) and write clients/{business}/wow/final-check.md',
      retry: ['Ad Writer', 'Rule Checker', 'Ad Maker', 'Page Builder', 'Outreach Writer', 'Visual Check'],
      fixNote: {'Ad Writer': 'Visual Check found a fault: make only the "## Fixes" lines starting "Ad Writer:" in clients/{business}/wow/final-check.md, in choices.json and choices.md. If there is none for you, change nothing and say so.',
        'Rule Checker': 'Check only what Ad Writer has just changed in clients/{business}/wow/choices.json (if anything) and update rule-check.md. If nothing changed, say so.',
        'Ad Maker': 'If clients/{business}/wow/choices.json changed in this fix run, make the ads again and update made.md; otherwise change nothing and say so.',
        'Page Builder': 'Make the WOW page for {business} again if the ads changed or final-check.md has a "Page Builder:" fix line; otherwise change nothing and say so.',
        'Outreach Writer': 'Make only the "## Fixes" lines starting "Outreach Writer:" in clients/{business}/wow/final-check.md, in outreach/{business}-emails.md. If there is none for you, change nothing and say so.',
        'Visual Check': 'Check the whole set for {business} again after the fixes and update clients/{business}/wow/final-check.md.'},
      gates: [{file: 'clients/{business}/wow/final-check.md', verdict: 'Result: PASSED'}]},
    {id: 'review', review: true}
  ]
};

export const wowVars = run => ({business: run.business, name: run.name || run.business, version: run.version, lead: run.lead || 'the leads files'});

// A verdict counts only on its own line ("Result: PASSED"), never inside a sentence ('not "Result: PASSED" yet').
export const verdictLine = (text, phrase) => String(text || '').split('\n').some(l => l.replace(/^[\s>*_#-]+/, '').trim().startsWith(phrase));

// choices.json must be input make_wow_ad will take: the business's folder, 5 ads and 1 preview, ad 1 a photo ad (decision 99).
export function choicesProblems(text, business) {
  let d; try { d = JSON.parse(text); } catch (e) { return [`clients/${business}/wow/choices.json does not read as JSON (${e.message.slice(0, 120)}).`]; }
  const out = [], ads = Array.isArray(d?.ads) ? d.ads : [];
  if (String(d?.folder || '').replace(/\/+$/, '') !== `clients/${business}/wow`) out.push(`choices.json "folder" must be "clients/${business}/wow".`);
  if (!d?.brand || typeof d.brand !== 'object') out.push('choices.json has no "brand".');
  const real = ads.filter(a => a?.layout !== 'preview'), previews = ads.filter(a => a?.layout === 'preview');
  if (real.length !== 5) out.push(`choices.json has ${real.length} ads; it needs 5 (the 2 ads and the 3 more).`);
  if (previews.length !== 1) out.push(`choices.json has ${previews.length} previews; it needs 1.`);
  const names = new Set(ads.map(a => a?.name));
  for (const n of ['wow-1', 'wow-2']) if (!names.has(n)) out.push(`choices.json has no ad named "${n}".`);
  if (names.size !== ads.length) out.push('choices.json has two ads with the same name.');
  for (const a of ads) {
    if (!WOW_LAYOUTS.includes(a?.layout)) { out.push(`${a?.name || 'an ad'}: the layout "${a?.layout}" is not one of ${WOW_LAYOUTS.join(', ')}.`); continue; }
    out.push(...wowWordProblems(a));
  }
  const first = ads.find(a => a?.name === 'wow-1');
  if (first && !first.photo) out.push('wow-1 must be a photo ad (decision 99: ad 1 is always a photo).');
  return out;
}
export const choicesPhotos = text => { try { return [...new Set(JSON.parse(text).ads.map(a => a.photo).filter(Boolean))]; } catch { return []; } };
export const choicesFiles = (text, business) => { try { return JSON.parse(text).ads.map(a => `clients/${business}/wow/${a.name}${a.layout === 'preview' ? '-PREVIEW' : ''}.png`); } catch { return []; } };

// Email 1 words, counted the way Outreach Writer's rule counts them: from after the greeting to the end of the gift or
// ask, sign-off and opt-out not counted, the link one word. The hard ceiling is 95 (outreach-writer.md).
export function emailOneWords(text) {
  const lines = String(text || '').split('\n'), start = lines.findIndex(l => /email 1\b/i.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /email 2\b/i.test(l)); if (end < 0) end = lines.length;
  const body = [];
  for (const raw of lines.slice(start + 1, end)) {
    const l = raw.replace(/[*_#>]/g, '').trim();
    if (!l) continue;
    if (/^(hi|hello|hey|g'?day|good morning)\b/i.test(l) && body.length === 0) continue;
    if (/^(dan|thanks,?|cheers,?|best,?|regards,?|kind regards,?|thank you,?)$/i.test(l)) break;
    if (/unsubscribe|opt[- ]out|not interested|reply ["“]?stop/i.test(l)) continue;
    body.push(l.replace(/\[page link\]/gi, 'LINK'));
  }
  return body.join(' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}
export function emailProblems(text, {business, version}) {
  const p = `outreach/${business}-emails.md`, out = [], t = String(text || '');
  const first = t.split('\n').find(l => l.trim())?.replace(/[*_#]/g, '').trim() || '';
  if (!/^Version:\s*[AB]\b/i.test(first)) out.push(`${p} must start with "Version: ${version}" on its first line.`);
  else if (!new RegExp(`^Version:\\s*${version}\\b`, 'i').test(first)) out.push(`${p} says "${first}", but this business was given version ${version}.`);
  if (!/dan@blueonehundred\.com/i.test(t)) out.push(`${p} has no "From: dan@blueonehundred.com".`);
  if (!/^\s*\**\s*Dan\s*\**\s*$/m.test(t)) out.push(`${p} is not signed "Dan".`);
  if (/[–—]/.test(t)) out.push(`${p} has an em or en dash.`);
  const links = t.match(/https?:\/\/\S+/g) || [];
  if (version === 'B' && (links.length || /\[page link\]/i.test(t.split(/^## After a reply/m)[0]))) out.push(`${p} is version B but has a link in the emails; version B has no link.`);
  if (version === 'A' && !/\[page link\]/i.test(t)) out.push(`${p} is version A but has no [page link].`);
  if (version === 'A' && links.length) out.push(`${p} has a web link (${links[0].slice(0, 60)}); version A has only [page link], which Tavin fills in.`);
  const n = emailOneWords(t);
  if (n === null) out.push(`${p} has no "Email 1" section.`);
  else if (n > 95) out.push(`${p}: email 1 has about ${n} words between the greeting and the sign-off; the limit is under 85, never over 95.`);
  return out;
}

// Lead Finder's "## Top 3" (build 21: each lead carries "- Folder:" and "- Country:"; the file ends "Status: done").
export const leadsDone = text => /^\s*Status:\s*done\b/im.test(String(text || ''));
export function topLeads(text) {
  const t = String(text || ''), m = t.match(/^## Top 3\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!m) return [];
  return m[1].split(/^### /m).slice(1).map(block => {
    const head = block.split('\n')[0].trim(), name = head.replace(/^\d+\.\s*/, '').replace(/\s*\(.*$/, '').trim();
    const field = k => block.match(new RegExp(`^-\\s*${k}:\\s*(.+)$`, 'mi'))?.[1].trim() || '';
    let country = field('Country').toUpperCase().replace(/[^A-Z ]/g, '').trim();
    if (!country) country = (head.match(/\(([^)]*)\)/)?.[1].split(',').pop() || '').trim().toUpperCase();
    country = COUNTRY_ALIASES[country] || country;
    const email = (field('Email').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [''])[0].toLowerCase();
    const folder = field('Folder').replace(/[`'"]/g, '').replace(/^.*\//, '').trim().toLowerCase();
    return {name, folder, country, email};
  });
}
// Decision 108: Top 3, skip no own email, do-not-contact, already in clients/, outside the 5 countries.
export function chooseLeads({leads, doNotContact = '', clients = [], busy = [], count = 3, countries = COUNTRIES}) {
  const dnc = String(doNotContact).toLowerCase(), picks = [], skipped = [];
  for (const l of leads) {
    const why = !validBusiness(l.folder) ? 'no usable "- Folder:" line'
      : !l.email ? 'no email the business publishes itself'
      : !countries.includes(l.country) ? `country "${l.country || 'unknown'}" is not one of ${countries.join(', ')}`
      : (dnc.includes(l.email) || dnc.includes(l.folder) || (l.name && dnc.includes(l.name.toLowerCase()))) ? 'on outreach/do-not-contact.md'
      : clients.includes(l.folder) ? `clients/${l.folder} already exists`
      : busy.includes(l.folder) ? 'already has a WOW run'
      : picks.length >= count ? `only ${count} a day (decision 104)` : '';
    if (why) skipped.push({...l, why}); else picks.push(l);
  }
  return {picks, skipped};
}

// outreach/ab-test.md: "| date | business | version | sent | replied |". Versions in turn from the last row (decision 85).
export const AB_HEADER = '# A/B test of email 1 (decision 85)\n\nVersion A: the 2 ads by the page link. Version B: no link, offers them. One row per business, append only.\n\n| date | business | version | sent (yes/no, date) | replied (yes/no, date) |\n|---|---|---|---|---|\n';
export function nextVersion(abText) {
  const rows = String(abText || '').split('\n').filter(l => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l));
  const last = rows.at(-1)?.split('|')[3]?.trim().toUpperCase();
  return last === 'A' ? 'B' : 'A';
}

// Decision 105: Max's treg spend this month, from the cost on Max's own run lines (board/runs-<date>.md).
export function monthSpend(runFiles) {
  let total = 0;
  // Build 23: bots write "cost: $0, treg $0.0412" or "cost: $0.00014 (treg $0.00014; balance $8.30)": the treg amount
  // counts when it is named (never a balance), otherwise the first amount (26 Nov: only "$0" was read, so treg was missed).
  for (const text of runFiles) for (const m of String(text).matchAll(/\|\s*cost:([^|\n]*)/gi)) {
    const field = m[1].replace(/balance[^;)]*/gi, ''), treg = [...field.matchAll(/treg[^$\d]{0,12}\$\s*(\d+(?:\.\d+)?)/gi)];
    if (treg.length) for (const t of treg) total += Number(t[1]);
    else { const first = field.match(/\$\s*(\d+(?:\.\d+)?)/); if (first) total += Number(first[1]); }
  }
  return Math.round(total * 10000) / 10000;
}

export const DAILY = {
  enabled: false,            // Tavin turns it on after the proof (plan-session-12.md)
  start: '13:00',            // decision 107 (the computer's clock: Hanoi time)
  count: 3,                  // decision 104
  countries: COUNTRIES,      // decision 108
  leadWaitMinutes: 60,       // ask Lead Finder once more when today's file is not done after this
  latestPick: '17:00',       // no leads by then: nothing runs today, and the brief says why
  monthlyLimit: 10,          // decision 105, US dollars of treg
  reserveLeads: 0.10,        // kept back for Lead Finder before it starts
  reserveBusiness: 0.25      // kept back for each business (Review Miner) before its run starts
};

export const leadMessage = ({date, count}) => `Daily lead search (from the Max app, ${date}). This message is Tavin's go (decisions 104 to 109): do your default job now and write leads/leads-${date}.md, with a "## Top 3" of the ${count} best leads. Under each Top 3 lead put a line "- Folder: <folder name>" (small letters and dashes, the same name as leads/ads/<folder>/) and a line "- Country: <US, CA, UK, AU or NZ>", and save its current ad pictures in leads/ads/<folder>/. End the file with the line "Status: done". Don't ask questions.`;
export const leadSecondMessage = ({date}) => `Second try for today's leads (from the Max app): leads/leads-${date}.md has no "Status: done" line yet. Finish today's lead search now (keep anything already in the file and add to it), with the "## Top 3", the "- Folder:" and "- Country:" lines and the last line "Status: done". Don't ask questions.`;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
// Build 23: the review page shows the email first (To, From, subjects, emails 1 to 3) and folds the drafting notes under it.
export function splitEmail(text) {
  const lines = String(text || '').split('\n'), start = lines.findIndex(l => /email 1\b/i.test(l));
  if (start < 0) return {main: String(text || '').trim(), notes: ''};
  const end = lines.findIndex((l, i) => i > start && /^##\s+(After a reply|Send time|Before sending|Checks|For Max)/i.test(l));
  const head = lines.slice(0, start).filter(l => /^\**\s*(To|From|Subject options?)\s*:/i.test(l));
  const main = [...head, '', ...lines.slice(start, end < 0 ? undefined : end)].join('\n').trim();
  const notes = [...lines.slice(0, start).filter(l => !head.includes(l)), ...(end < 0 ? [] : lines.slice(end))].join('\n').trim();
  return {main, notes};
}
// One business's whole set side by side (standing rule: show Tavin a whole set side by side). Paths are relative to pipeline/.
export function reviewSection({run, current = [], ads = [], email = '', forMax = [], rel = p => '../' + p}) {
  const img = (p, label) => `<figure><a href="${esc(rel(p))}"><img src="${esc(rel(p))}" alt="${esc(label)}"></a><figcaption>${esc(label)}</figcaption></figure>`;
  const page = `pages/${run.business}/wow/`;
  const status = run.status === 'review' ? '<span class="ok">Ready for your review</span>' : `<span class="bad">Stopped: ${esc((run.reason || '').split('\n')[0])}</span>`;
  return `<section><h2>${esc(run.name || run.business)} <small>(${esc(run.business)}, version ${esc(run.version)})</small></h2><p>${status}</p>
${run.status === 'review' ? '' : `<pre class="why">${esc(run.reason || '')}</pre>`}
<div class="row">${current.map((p, i) => img(p, `Their ad now${current.length > 1 ? ' ' + (i + 1) : ''}`)).join('')}${ads.filter(a => /wow-[12]\.png$/.test(a)).map(p => img(p, p.includes('wow-1') ? 'New ad 1 (download)' : 'New ad 2 (download)')).join('')}${ads.filter(a => /PREVIEW/.test(a)).map(p => img(p, 'Preview, stand-in (page only)')).join('')}</div>
<div class="row small">${ads.filter(a => /wow-[3-9]\.png$/.test(a)).map(p => img(p, 'More (blurred on the page)')).join('')}</div>
<div class="row"><figure><a href="${esc(rel(page + 'index.html'))}"><img src="${esc(rel(page + 'page-preview.jpg'))}" alt="Page"></a><figcaption>The page (click to open). Not published.</figcaption></figure>
<div class="mail"><h3>Email (${esc(run.version)})</h3>${(() => { const e = splitEmail(email); return `<pre>${esc(e.main || 'No email yet.')}</pre>${e.notes ? `<details><summary>Outreach Writer's notes and checks</summary><pre>${esc(e.notes)}</pre></details>` : ''}`; })()}</div></div>
${forMax.length ? `<div class="note"><b>Notes from the bots:</b><br>${forMax.map(esc).join('<br>')}</div>` : ''}</section>`;
}
export function readyPage({date, sections, summary}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Ready for Tavin: ${esc(date)}</title><style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:17px;line-height:1.45;color:#16201a;margin:0;background:#f3f5f3}
main{max-width:1600px;margin:0 auto;padding:28px 36px 80px}h1{font-size:32px;margin:0 0 6px}h2{font-size:26px;margin:0 0 4px}h2 small{font-weight:400;color:#556}
section{background:#fff;border-radius:14px;padding:22px 26px;margin:22px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.row{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin:12px 0}figure{margin:0;width:360px}.small figure{width:240px}
figure img{width:100%;border-radius:8px;display:block;border:1px solid #dde}figcaption{font-size:14px;color:#445;margin-top:4px}
.mail{flex:1;min-width:380px}.mail pre,.why{white-space:pre-wrap;font-family:inherit;font-size:16px;background:#f7f8f7;padding:14px;border-radius:8px;margin:0}
.ok{color:#1d6b33;font-weight:700}details{margin-top:10px}summary{cursor:pointer;color:#445;font-size:15px}.bad{color:#a33;font-weight:700}.note{color:#7a5200;margin-top:10px}</style></head><body><main>
<h1>Ready for you: ${esc(date)}</h1><p>${esc(summary)}</p><p>Nothing is published or sent. For version A, publish the page and put its link in place of [page link]; then send.</p>
${sections.join('\n')}</main></body></html>`;
}
