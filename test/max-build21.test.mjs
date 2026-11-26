import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile, readFile, utimes, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {Pipelines} from '../src/pipeline.mjs';
import {TeamFolder} from '../src/team-folder.mjs';
import {WOW_STEPS, WOW_BOTS, choicesProblems, emailProblems, emailOneWords, topLeads, chooseLeads, nextVersion, monthSpend, verdictLine, leadsDone} from '../src/wow-run.mjs';

// A made-up business. Real businesses' words never go into this public repository.
const B = 'test-plumbing';
const brand = {primary: '#0E6137', accent: '#00781F', panel: '#0A2616', soft: '#E4F2E8', name: 'TEST\nPLUMBING', place: 'TESTTOWN'};
const ad = (name, layout, extra = {}) => ({name, layout, button: 'Learn more', logoLine: 'TEST PLUMBING · TESTTOWN', ...extra});
const choices = (over = {}) => JSON.stringify({folder: `clients/${B}/wow`, brand, ads: [
  ad('wow-1', 'problem-fix', {headline: 'No heat tonight?\n**We\'re 24/7.**', proof: '**4.9 ★** from 120 Google reviews', photo: `clients/${B}/photos/${B}-01.jpg`, show: '0% 10% 100% 90%'}),
  ad('wow-2', 'big-review', {kicker: 'NO HOT WATER!', quote: 'Fast and tidy.', stars: 5, who: 'A. Tester, Google review, Oct 2026'}),
  ad('wow-3', 'bold-text', {kicker: 'BLOCKED DRAIN?', headline: 'Cleared the same day.', badge: 'Family-owned'}),
  ad('wow-4', 'big-number', {kicker: 'LOCAL SINCE', number: '2001', numberLine: 'Locally owned **since then**.'}),
  ad('wow-5', 'bold-text', {kicker: 'LEAKING TAP?', headline: 'Fixed while you watch.', badge: 'Testtown'}),
  ad('wow-team', 'preview', {headline: 'No heat tonight?\n**We\'re 24/7.**', proof: '**4.9 ★** from 120 Google reviews', photo: 'library/stand-ins/02-heating.png', show: '10% 8% 90% 70%'}),
  ...(over.extra || [])]});
const emailA = `Version: A\nTo: office@test-plumbing.example\nFrom: dan@blueonehundred.com\nSubject options: 120 reviews · your facebook ad\n\nEmail 1 (day 1)\nHi Test team,\n\n4.9 stars from 120 Google reviews is rare for a local plumber.\n\n12 of the 40 reviews we read say you came the same day. None of your ads say that.\n\nI've made you two new versions of your ad from your own reviews. They're free to keep, no strings:\n[page link]\n\nSend me a photo of your team and I'll put them in.\n\nDan\nNot interested? Just say so and I won't write again.\n\nEmail 2 (day 3, same thread)\nOne more thing.\n\nDan\n\n## After a reply\nThe van number.\n\n## For Max\nEmail for ${B} is drafted; Tavin reviews and sends.\n`;

async function team(files, t) {
  const root = await mkdtemp(join(tmpdir(), 'max-b21-'));
  for (const [p, body] of Object.entries(files)) await put(root, p, body, t);
  return root;
}
async function put(root, p, body, t) { await mkdir(dirname(join(root, p)), {recursive: true}); await writeFile(join(root, p), body); if (t) await utimes(join(root, p), new Date(t), new Date(t)); }
function fakeService(names) {
  const state = {bots: names.map((name, i) => ({id: 'b' + i, name})), conversations: names.map((_, i) => ({id: 'c' + i, botId: 'b' + i, messages: [], updatedAt: i}))};
  return {state, delivered: [], async _deliver(c, input, _a, setup) { c.messages.push({id: 'm' + Math.random(), role: 'user', content: input, sourceScheduleRunId: setup.scheduled.runId, status: 'complete'}); this.delivered.push({bot: state.bots.find(b => b.id === c.botId).name, input}); }};
}
const reply = (service, bot, status = 'complete') => { const b = service.state.bots.find(x => x.name === bot), c = service.state.conversations.find(x => x.botId === b.id); c.messages.push({id: 'r' + Math.random(), role: 'assistant', status, content: 'done'}); };
const last = service => service.delivered.at(-1);

test('Max build 21: choices.json is checked as make_wow_ad input', () => {
  assert.deepEqual(choicesProblems(choices(), B), []);
  const bad = JSON.parse(choices()); bad.folder = 'clients/other/wow'; bad.ads[0].headline = 'This headline has far too many words to pass the WOW test'; delete bad.ads[0].photo; bad.ads.pop();
  const msgs = choicesProblems(JSON.stringify(bad), B).join('\n');
  assert.match(msgs, /"folder" must be "clients\/test-plumbing\/wow"/);
  assert.match(msgs, /0 previews/);
  assert.match(msgs, /7 or fewer/);
  assert.match(msgs, /wow-1 must be a photo ad/);
  assert.match(choicesProblems('{not json', B)[0], /does not read as JSON/);
});

test('Max build 21: the email check (version, Dan, links, dashes, word count)', () => {
  assert.equal(emailOneWords(emailA) < 85, true);
  assert.deepEqual(emailProblems(emailA, {business: B, version: 'A'}), []);
  const asB = emailProblems(emailA.replace('Version: A', 'Version: B'), {business: B, version: 'B'}).join('\n');
  assert.match(asB, /version B but has a link/);
  assert.match(emailProblems(emailA, {business: B, version: 'B'}).join('\n'), /given version B/);
  const long = emailA.replace('Send me a photo', 'word '.repeat(80) + 'Send me a photo').replace('a local plumber', 'a local plumber — truly');
  const m = emailProblems(long, {business: B, version: 'A'}).join('\n');
  assert.match(m, /never over 95/); assert.match(m, /em or en dash/);
  assert.match(emailProblems(emailA.replace('\nDan\nNot', '\nDaniel\nNot').replace('\nDan\n\n##', '\n\n##'), {business: B, version: 'A'}).join('\n'), /not signed "Dan"/);
});

test('Max build 21: Top 3, the pick rule, versions in turn and the spend', () => {
  const leads = `# Leads\n\n## Top 3\n\n### 1. Test Plumbing Ltd (Testtown, CA), plumbing\n- Email: office@test-plumbing.example (website)\n- Folder: test-plumbing\n\n### 2. Nomail Co (Elsewhere, Ontario, CA), roofing\n- Email: none published\n- Folder: nomail-co\n\n### 3. Far Away GmbH (Berlin, DE), electrician\n- Email: info@far.example\n- Folder: far-away\n- Country: DE\n\n### 4. Blocked Pty Ltd (Ipswich, AU), pest control\n- Email: a@blocked.example\n- Folder: blocked\n\n### 5. Old Client (Leeds, UK), cleaning\n- Email: hi@old.example\n- Folder: old-client\n\n### 6. Fourth Co (Austin, Texas, USA), plumbing\n- Email: x@fourth.example\n- Folder: fourth-co\n\n### 7. Fifth Co (Perth, AU), plumbing\n- Email: y@fifth.example\n- Folder: fifth-co\n\n### 8. Sixth Co (Napier, NZ), plumbing\n- Email: z@sixth.example\n- Folder: sixth-co\n\n## Others\n\n### 9. Not top\n- Folder: not-top\n\nStatus: done\n`;
  assert.equal(leadsDone(leads), true); assert.equal(leadsDone('## Top 3\n'), false);
  const all = topLeads(leads);
  assert.equal(all.length, 8); assert.deepEqual(all[5], {name: 'Fourth Co', folder: 'fourth-co', country: 'US', email: 'x@fourth.example'});
  const {picks, skipped} = chooseLeads({leads: all, doNotContact: '| a@blocked.example | asked us not to |', clients: ['old-client']});
  assert.deepEqual(picks.map(p => p.folder), ['test-plumbing', 'fourth-co', 'fifth-co']);
  const why = Object.fromEntries(skipped.map(s => [s.folder, s.why]));
  assert.match(why['nomail-co'], /no email/); assert.match(why['far-away'], /country "DE"/); assert.match(why.blocked, /do-not-contact/); assert.match(why['old-client'], /already exists/); assert.match(why['sixth-co'], /only 3 a day/);
  assert.equal(nextVersion(''), 'A');
  assert.equal(nextVersion('| date | business | version |\n|---|---|---|\n| 2026-11-26 | a | A | no | no |\n'), 'B');
  assert.equal(nextVersion('| 2026-11-26 | a | A | no | no |\n| 2026-11-26 | b | B | no | no |\n'), 'A');
  assert.equal(monthSpend(['10:00 | Lead Finder | done: x | cost: $0.04 | problems: none\n11:00 | Review Miner | done: y | cost: about $0.03 | problems: none', '12:00 | Package runs | done: z | cost: $0.00 | problems: none']), 0.07);
  assert.equal(monthSpend(['08:23 | Lead Finder | done: x | cost: $0, treg $0.0412 | problems: none\n09:28 | Review Miner | done: y | cost: $0.00014 (treg $0.00014; balance $8.30016) | problems: none\n09:30 | Max | done: z | cost: $0 | problems: none']), 0.0413);
  assert.equal(verdictLine('Result: PASSED\n', 'Result: PASSED'), true);
  assert.equal(verdictLine('Not "Result: PASSED" yet.\nResult: NOT PASSED', 'Result: PASSED'), false);
});

// The whole run for one business, with a Rule Checker failure that goes back to Ad Writer first.
test('Max build 21: a WOW run goes bot by bot, routes a failed rule check to Ad Writer, and ends at Tavin\'s review', async () => {
  let now = Date.now();
  const root = await team({'board/decisions-2026-11.md': '# Decisions\n', [`clients/${B}/photos/${B}-01.jpg`]: 'x', 'library/stand-ins/02-heating.png': 'x', [`leads/ads/${B}/ad-1.png`]: 'x'});
  const data = await mkdtemp(join(tmpdir(), 'max-b21-data-'));
  const service = fakeService(['Max', ...WOW_BOTS]);
  try {
    const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, now: () => now, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false}}).init();
    await p.startWow({business: B, name: 'Test Plumbing', version: 'A', lead: 'leads/leads-2026-11-26.md'});
    await assert.rejects(p.startWow({business: 'other-co', version: 'B'}), /One business at a time/);
    const decisions = await readFile(join(root, `board/decisions-${new Date(now).toISOString().slice(0, 7)}.md`), 'utf8').catch(() => readFile(join(root, 'board/decisions-2026-11.md'), 'utf8'));
    assert.match(decisions, /WOW RUN for Test Plumbing \(test-plumbing\), version A/);
    const step = async (bot, files) => { await p.tick(); assert.equal(last(service).bot, bot); assert.match(last(service).input, /WOW run for test-plumbing/); for (const [f, b] of Object.entries(files)) await put(root, f, b); reply(service, bot); await p.tick(); };
    await step('Review Miner', {[`clients/${B}/reviews.md`]: '# Reviews\n'});
    await step('Fact Finder', {[`clients/${B}/facts.md`]: '# Facts\n\n## Phone numbers\n- 555\n', [`clients/${B}/brand.md`]: '# Brand\n'});
    await step('Ad Writer', {[`clients/${B}/wow/choices.json`]: choices(), [`clients/${B}/wow/choices.md`]: '# Choices\n'});
    // Rule Checker fails: the fix goes to Ad Writer, then Rule Checker.
    await step('Rule Checker', {[`clients/${B}/wow/rule-check.md`]: '# Rule check\n\nResult: FAILED\n\n## To fix\n- wow-3: "Cleared the same day" is not in reviews.md.\n'});
    let run = p.findWow(B); assert.equal(run.status, 'running'); assert.equal(run.attempt, 1); assert.deepEqual(run.queue, ['Ad Writer', 'Rule Checker']);
    await p.tick(); assert.equal(last(service).bot, 'Ad Writer'); assert.match(last(service).input, /Rule Checker's rules step did not pass/); assert.match(last(service).input, /not in reviews\.md/);
    reply(service, 'Ad Writer'); await p.tick();
    await p.tick(); assert.equal(last(service).bot, 'Rule Checker');
    await put(root, `clients/${B}/wow/rule-check.md`, '# Rule check\n\nResult: PASSED\n'); reply(service, 'Rule Checker'); await p.tick();
    const pngs = ['wow-1', 'wow-2', 'wow-3', 'wow-4', 'wow-5', 'wow-team-PREVIEW'].map(n => [`clients/${B}/wow/${n}.png`, 'png']);
    await step('Ad Maker', {...Object.fromEntries(pngs), [`clients/${B}/wow/made.md`]: '# Made\n\nResult: PASSED\n\n## For Max\nAll 6 made.\n'});
    await step('Page Builder', {[`pages/${B}/wow/page-check.md`]: '# WOW page for Test Plumbing: PASSED\n', [`pages/${B}/wow/index.html`]: '<html></html>', [`pages/${B}/wow/page-preview.jpg`]: 'x'});
    await step('Outreach Writer', {[`outreach/${B}-emails.md`]: emailA});
    await p.tick();
    run = p.findWow(B); assert.equal(run.status, 'review');
    const review = await readFile(join(root, `pipeline/wow-${B}/review.html`), 'utf8');
    assert.match(review, /Ready for your review/); assert.match(review, /wow-1\.png/); assert.match(review, /leads\/ads\/test-plumbing\/ad-1\.png/); assert.match(review, /\[page link\]/); assert.ok(review.indexOf('Hi Test team') < review.indexOf('Notes from the bots')); assert.match(review, /All 6 made/);
    assert.match(await readFile(join(root, `pipeline/wow-${B}/status.md`), 'utf8'), /Status: review/);
    assert.match(await readFile(join(root, 'pipeline/status.md'), 'utf8'), /WOW: test-plumbing \(version A\)/);
    assert.ok(JSON.parse(await readFile(join(root, 'pipeline/wow-steps.json'), 'utf8')).steps.length === WOW_STEPS.steps.length);
  } finally { await rm(root, {recursive: true, force: true}); await rm(data, {recursive: true, force: true}); }
});

test('Max build 21: a step that still fails after 2 fix runs stops with the reasons', async () => {
  let now = Date.now();
  const root = await team({}); const data = await mkdtemp(join(tmpdir(), 'max-b21-data-'));
  const service = fakeService(['Max', ...WOW_BOTS]);
  try {
    const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, now: () => now, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false}}).init();
    await p.startWow({business: B, version: 'B', from: 'facts'});
    for (let i = 0; i < 3; i++) { await p.tick(); assert.equal(last(service).bot, 'Fact Finder'); reply(service, 'Fact Finder'); await p.tick(); }
    const run = p.findWow(B); assert.equal(run.status, 'stopped'); assert.match(run.reason, /after 2 fix runs/); assert.match(run.reason, /facts\.md was not written/);
    assert.match(await readFile(join(root, `board/runs-${new Date(now).getFullYear()}-${String(new Date(now).getMonth() + 1).padStart(2, '0')}-${String(new Date(now).getDate()).padStart(2, '0')}.md`), 'utf8'), /WOW run test-plumbing stopped; needs a look/);
  } finally { await rm(root, {recursive: true, force: true}); await rm(data, {recursive: true, force: true}); }
});

test('Max build 21: the daily run asks Lead Finder, picks under the rule, runs one business at a time and tells Max', async () => {
  // Thursday 26 Nov 2026, 13:05 on the computer's clock.
  let now = new Date(2026, 10, 26, 13, 5).getTime();
  const D = '2026-11-26', leadsPath = `leads/leads-${D}.md`;
  const root = await team({'board/decisions-2026-11.md': '# Decisions\n', 'outreach/do-not-contact.md': '# Do not contact\n', 'pipeline/daily.json': JSON.stringify({enabled: true, count: 2}), 'board/runs-2026-11-20.md': '10:00 | Lead Finder | done: x | cost: $0.40 | problems: none\n'}, now);
  const data = await mkdtemp(join(tmpdir(), 'max-b21-data-'));
  const service = fakeService(['Max', 'Lead Finder', ...WOW_BOTS]);
  try {
    const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, now: () => now, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false, wowDaily: true}}).init();
    // Before 13:00 nothing happens.
    now = new Date(2026, 10, 26, 12, 50).getTime(); p.lastDaily = 0; await p.tick(); assert.equal(service.delivered.length, 0);
    now = new Date(2026, 10, 26, 13, 5).getTime(); p.lastDaily = 0; await p.tick();
    assert.equal(last(service).bot, 'Lead Finder'); assert.match(last(service).input, /leads\/leads-2026-11-26\.md/); assert.match(last(service).input, /- Folder:/);
    await put(root, leadsPath, `# Leads\n\n## Top 3\n\n### 1. Alpha Plumbing (Testtown, CA), plumbing\n- Email: a@alpha.example\n- Folder: alpha-plumbing\n\n### 2. Beta Electric Ltd (Napier, NZ), electrician\n- Email: b@beta.example\n- Folder: beta-electric\n\n### 3. Gamma Pest (Perth, AU), pest\n- Email: g@gamma.example\n- Folder: gamma-pest\n\nStatus: done\n`, now);
    reply(service, 'Lead Finder');
    now += 60000; p.lastDaily = 0; await p.tick();
    assert.deepEqual(p.daily.queue.map(q => [q.business, q.version]), [['alpha-plumbing', 'A'], ['beta-electric', 'B']]);
    assert.match(p.daily.skipped[0].why, /only 2 a day/);
    assert.match(await readFile(join(root, 'outreach/ab-test.md'), 'utf8'), /\| 2026-11-26 \| beta-electric \| B \| no \| no \|/);
    // First business starts; the second waits for it.
    now += 60000; p.lastDaily = 0; await p.tick();
    assert.equal(p.findWow('alpha-plumbing').status, 'running'); assert.equal(p.findWow('beta-electric'), undefined);
    assert.equal(last(service).bot, 'Review Miner'); assert.match(last(service).input, /WOW run for alpha-plumbing \(Alpha Plumbing\), version A/);
    await p.stopWow('alpha-plumbing', 'Stopped in the test.');
    now += 60000; p.lastDaily = 0; await p.tick();
    assert.equal(p.findWow('beta-electric').status, 'running');
    await p.stopWow('beta-electric', 'Stopped in the test too.');
    now += 60000; p.lastDaily = 0; await p.tick();
    assert.equal(p.daily.phase, 'done');
    const ready = await readFile(join(root, `pipeline/ready-${D}.md`), 'utf8');
    assert.match(ready, /0 of 2 ready/); assert.match(ready, /\$0\.40 of \$10/); assert.match(ready, /gamma-pest: only 2 a day/);
    assert.ok((await stat(join(root, `pipeline/ready-${D}.html`))).size > 500);
    assert.equal(last(service).bot, 'Max'); assert.match(last(service).input, /ready-2026-11-26\.md/);
    // Once a day: nothing more today.
    const n = service.delivered.length; now += 3600000; p.lastDaily = 0; await p.tick(); assert.equal(service.delivered.length, n);
    // Saturday: nothing.
    now = new Date(2026, 10, 28, 13, 30).getTime(); p.lastDaily = 0; await p.tick(); assert.equal(service.delivered.length, n);
  } finally { await rm(root, {recursive: true, force: true}); await rm(data, {recursive: true, force: true}); }
});

test('Max build 21: the money guard stops the day before Lead Finder runs', async () => {
  const now = new Date(2026, 10, 27, 13, 10).getTime();
  const root = await team({'pipeline/daily.json': JSON.stringify({enabled: true}), 'board/runs-2026-11-21.md': '10:00 | Lead Finder | done: x | cost: $9.95 | problems: none\n'}, now);
  const data = await mkdtemp(join(tmpdir(), 'max-b21-data-'));
  const service = fakeService(['Max', 'Lead Finder', ...WOW_BOTS]);
  try {
    const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, now: () => now, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false, wowDaily: true}}).init();
    await p.tick();
    assert.equal(service.delivered.some(d => d.bot === 'Lead Finder'), false);
    assert.match(await readFile(join(root, 'pipeline/ready-2026-11-27.md'), 'utf8'), /Nothing ran today: Max has spent \$9\.95 of his \$10/);
    assert.equal(last(service).bot, 'Max');
  } finally { await rm(root, {recursive: true, force: true}); await rm(data, {recursive: true, force: true}); }
});

test('Max build 21: daily run is off until daily.json says so', async () => {
  const now = new Date(2026, 10, 26, 13, 30).getTime();
  const root = await team({}); const data = await mkdtemp(join(tmpdir(), 'max-b21-data-'));
  const service = fakeService(['Max', 'Lead Finder', ...WOW_BOTS]);
  try {
    const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, now: () => now, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false, wowDaily: true}}).init();
    await p.tick(); assert.equal(service.delivered.length, 0);
    assert.equal(JSON.parse(await readFile(join(root, 'pipeline/daily.json'), 'utf8')).enabled, false);
  } finally { await rm(root, {recursive: true, force: true}); await rm(data, {recursive: true, force: true}); }
});
