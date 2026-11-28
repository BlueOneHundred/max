import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, mkdir, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {Pipelines, queueSection, localDate} from '../src/pipeline.mjs';
import {TeamFolder} from '../src/team-folder.mjs';
import {WOW_BOTS} from '../src/wow-run.mjs';
import {slimActivity} from '../src/chat-service.mjs';

// Made-up businesses only. Real businesses' words never go into this public repository.
async function put(root, p, body) { await mkdir(dirname(join(root, p)), {recursive: true}); await writeFile(join(root, p), body); }
function fakeService(names) {
  const state = {bots: names.map((name, i) => ({id: 'b' + i, name})), conversations: names.map((_, i) => ({id: 'c' + i, botId: 'b' + i, title: 'old', messages: [], updatedAt: i}))};
  let k = 0;
  return {state, delivered: [], notes: [],
    async _deliver(c, input, _a, setup) { c.messages.push({id: 'm' + ++k, role: 'user', content: input, sourceScheduleRunId: setup.scheduled.runId, status: 'complete'}); this.delivered.push({bot: state.bots.find(b => b.id === c.botId).name, input, c}); },
    newChat(botId, title) { const c = {id: 'n' + ++k, botId, title, messages: [], updatedAt: 0}; state.conversations.push(c); return c; },
    async addNote(id, content) { const c = state.conversations.find(x => x.id === id); c.messages.push({id: 'note' + ++k, role: 'assistant', kind: 'app-note', content, status: 'complete'}); this.notes.push(content); }};
}
const answer = (service, status = 'complete') => service.delivered.at(-1).c.messages.push({id: 'r' + Math.random(), role: 'assistant', status, content: 'done'});
const make = async (features = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'max-b25-')), data = await mkdtemp(join(tmpdir(), 'max-b25-data-'));
  await put(root, `board/decisions-${localDate(Date.now()).slice(0, 7)}.md`, '# Decisions\n');
  const service = fakeService(['Max', ...WOW_BOTS]);
  const p = await new Pipelines({directory: data, teamRoot: root, teamFolder: new TeamFolder(root), service, busy: () => false, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false, ...features}}).init();
  return {root, data, service, p, done: () => Promise.all([rm(root, {recursive: true, force: true}), rm(data, {recursive: true, force: true})])};
};
// One Visual Check step from "check": the bot writes final-check.md and answers; the run reaches review.
const pass = async ({root, service, p}, business) => {
  await p.tick(); const d = service.delivered.at(-1); assert.equal(d.bot, 'Visual Check'); assert.match(d.input, new RegExp(`WOW run for ${business}`));
  await put(root, `clients/${business}/wow/final-check.md`, '# Final check\n\nResult: PASSED\n'); answer(service); await p.tick(); await p.tick();
};

test('Max build 25: the queue runs a list one after another, redoes a business at review, goes on after a stop and tells Max', async () => {
  const env = await make(), {root, service, p} = env;
  try {
    await p.startWow({business: 'alpha-co', name: 'Alpha Co', version: 'A', lead: 'leads/leads-2026-11-24.md', from: 'check'});
    await pass(env, 'alpha-co'); assert.equal(p.findWow('alpha-co').status, 'review');
    const firstChat = service.delivered.at(-1).c; assert.equal(firstChat.title, 'WOW alpha-co (I1)', 'each WOW run gets its own chat');
    // The list: a redo of alpha-co (version and lead taken from its last run), then beta-co, then gamma-co.
    await assert.rejects(p.queueWow([{business: 'new-co'}]), /give the email version/);
    await assert.rejects(p.queueWow([{business: 'x-co', version: 'A'}, {business: 'x-co', version: 'B'}]), /already in the queue/);
    await assert.rejects(p.queueWow([{business: 'x-co', version: 'A', from: 'nowhere'}]), /no step "nowhere"/);
    const st = await p.queueWow([{business: 'alpha-co', from: 'check', note: 'Visual Check failed design 3'}, {business: 'beta-co', name: 'Beta Co', version: 'B', from: 'check'}, {business: 'gamma-co', version: 'A', from: 'check'}]);
    assert.equal(st.waiting, 3);
    const q = JSON.parse(await readFile(join(root, 'pipeline/queue.json'), 'utf8')); assert.equal(q.items.length, 3); assert.equal(q.items[0].version, 'A'); assert.equal(q.items[0].lead, 'leads/leads-2026-11-24.md');
    await pass(env, 'alpha-co');
    const old = p.runs.find(r => r.business === 'alpha-co' && r.decision === 1); assert.equal(old.status, 'stopped'); assert.match(old.reason, /Replaced by a redo from Tavin's queue/);
    const redo = p.findWow('alpha-co'); assert.equal(redo.status, 'review'); assert.equal(redo.by, 'queue');
    assert.notEqual(service.delivered.at(-1).c.id, firstChat.id, 'the redo has a fresh chat');
    const decisions = await readFile(join(root, `board/decisions-${localDate(Date.now()).slice(0, 7)}.md`), 'utf8');
    assert.match(decisions, /I2 \| for: Visual Check \| instruction: WOW RUN for Alpha Co \(alpha-co\), version A, lead from leads\/leads-2026-11-24\.md, from step "check" \(Tavin's queue/);
    assert.match(decisions, /Note: Visual Check failed design 3 Restart: no new ab-test\.md row\./);
    // beta-co started by itself; Tavin stops it; the queue reports it and goes on with gamma-co.
    await p.tick(); assert.equal(p.findWow('beta-co').status, 'running'); assert.equal(service.delivered.at(-1).bot, 'Visual Check');
    await p.stopWow('beta-co'); await p.tick();
    assert.equal(p.queue.items.find(i => i.business === 'beta-co').status, 'stopped');
    assert.equal(p.findWow('gamma-co').status, 'running');
    await pass(env, 'gamma-co'); await p.tick();
    const all = service.notes.join('\n');
    assert.match(all, /Started Alpha Co \(version A, from check; I2\)\. 2 more waiting\./);
    assert.match(all, /Alpha Co is ready for your review: pipeline\/wow-alpha-co\/review\.html/);
    assert.match(all, /Beta Co stopped: Stopped by Tavin\./);
    assert.match(all, /The queue is empty\. Ready for your review: Alpha Co, gamma-co\. Not ready: Beta Co \(stopped\)\./);
    assert.ok(service.state.conversations.find(c => c.id === 'c0').messages.every(m => m.kind === 'app-note'), 'notes go to Max\'s chat without an AI run');
    assert.match(await readFile(join(root, 'pipeline/status.md'), 'utf8'), /## Queue[\s\S]*\| 2 \| Beta Co \(beta-co\) \| B \| check \| stopped/);
    assert.equal(p.runs.filter(r => r.status === 'running').length, 0);
  } finally { await env.done(); }
});

test('Max build 25: stop_queue lets the run going now finish and starts nothing new; resume carries on; a bad item is skipped', async () => {
  const env = await make(), {service, p} = env;
  try {
    await p.queueWow([{business: 'one-co', version: 'A', from: 'check'}, {business: 'two-co', version: 'B', from: 'check'}]);
    await p.tick(); assert.equal(p.findWow('one-co').status, 'running');
    const stopped = await p.stopQueue(); assert.equal(stopped.paused, true); assert.match(stopped.note, /one-co carries on/);
    await put(env.root, 'clients/one-co/wow/final-check.md', 'Result: PASSED\n'); answer(service); await p.tick(); await p.tick(); await p.tick();
    assert.equal(p.findWow('one-co').status, 'review'); assert.equal(p.findWow('two-co'), undefined, 'nothing new starts while stopped');
    await p.resumeQueue(); await p.tick(); assert.equal(p.findWow('two-co').status, 'running');
    // A run already going outside the queue makes the queue wait; one that cannot start is reported and skipped.
    await p.stopWow('two-co'); await p.tick();
    await p.queueWow([{business: 'three-co', version: 'A', from: 'check'}, {business: 'four-co', version: 'A', from: 'check'}]);
    service.state.bots.find(b => b.name === 'Visual Check').name = 'Renamed';
    await p.tick();
    assert.equal(p.queue.items.find(i => i.business === 'three-co').status, 'not started');
    assert.match(p.queue.items.find(i => i.business === 'three-co').reason, /No chat found for the bot "Visual Check"/);
    service.state.bots.find(b => b.name === 'Renamed').name = 'Visual Check';
    await p.tick(); assert.equal(p.findWow('four-co').status, 'running');
    assert.match(service.notes.join('\n'), /three-co could not start/);
  } finally { await env.done(); }
});

test('Max build 25: the queue waits while the daily run picks or runs its businesses; replace swaps the waiting list', async () => {
  const env = await make({wowDaily: true}), {p} = env;
  try {
    p.daily = {date: localDate(Date.now()), phase: 'run', queue: [], skipped: [], notes: []};
    await p.queueWow([{business: 'wait-co', version: 'A', from: 'check'}, {business: 'later-co', version: 'B'}]);
    await p.tick(); assert.equal(p.findWow('wait-co'), undefined); assert.match(p.queueStatus().dailyRunToday, /queue waits/);
    await p.queueWow([{business: 'swap-co', version: 'B', from: 'check'}], {replace: true});
    assert.deepEqual(p.queue.items.filter(i => i.status === 'waiting').map(i => i.business), ['swap-co']);
    p.daily.phase = 'done'; await p.tick(); assert.equal(p.findWow('swap-co').status, 'running');
    assert.match(queueSection(p.queue), /wait-co.*removed/);
    // The queue survives a restart of the app.
    const again = await new Pipelines({directory: env.data, teamRoot: env.root, teamFolder: new TeamFolder(env.root), service: env.service, busy: () => false, features: {creatorLog: false, creatorsSafetyNet: false, autoPick: false}}).init();
    assert.equal(again.queue.items.find(i => i.business === 'swap-co').status, 'running');
  } finally { await env.done(); }
});

test('Max build 25: finished replies keep a short record of their tool calls', () => {
  const big = 'x'.repeat(50000);
  assert.deepEqual(slimActivity({id: 'a', name: 'write_team_file', status: 'complete', startedAt: 1, finishedAt: 2, input: {path: 'clients/x/a.md', content: big}, result: {text: big}}),
    {id: 'a', name: 'write_team_file', status: 'complete', startedAt: 1, finishedAt: 2, input: {path: 'clients/x/a.md'}});
  assert.deepEqual(slimActivity({id: 'b', name: 'computer', status: 'error', input: {action: 'click', args: {url: 'https://example.com'}}, result: {receiptId: 'r1', big}}),
    {id: 'b', name: 'computer', status: 'error', input: {action: 'click', args: {url: 'https://example.com'}}, result: {receiptId: 'r1'}});
});

test('Max build 25: a streaming reply saves and redraws a few times, not once per chunk; the end is saved; old tool logs are slimmed', async () => {
  const {ChatService} = await import('../src/chat-service.mjs');
  const dataDir = await mkdtemp(join(tmpdir(), 'max-b25-chat-'));
  try {
    const backend = async function* (request) { for (let i = 0; i < 400; i++) { if (i < 40) request.onMetadata({activity: {id: 'a' + i, name: 'write_team_file', status: 'complete', input: {path: 'x.md', content: 'y'.repeat(2000)}, result: {text: 'z'.repeat(2000)}}}); yield 'w '; } };
    let changes = 0; const service = new ChatService({dataDir, backend, onChange: () => changes++}); await service.init();
    const s0 = service.snapshot(); 
    for (let k = 0; k < 8; k++) { await service.send({conversationId: s0.activeConversationId, text: 'Go ' + k}); await service.whenIdle(); }
    assert.ok(changes < 100, `${changes} redraws for 8 replies of 400 chunks each (before build 25: one per chunk and per tool event, about 3,500)`);
    const saved = JSON.parse(await readFile(join(dataDir, 'workspace.json'), 'utf8')), msgs = saved.conversations[0].messages.filter(m => m.role === 'assistant');
    assert.equal(msgs.at(-1).status, 'complete', msgs.at(-1).error); assert.equal(msgs.at(-1).content.trim().split(' ').length, 400);
    assert.equal(msgs.at(-1).activities[0].result.text.length, 2000, 'the newest replies keep their full tool logs');
    assert.equal(msgs[0].activitiesSlim, true); assert.equal(msgs[0].activities.length, 40); assert.deepEqual(msgs[0].activities[0], {id: 'a0', name: 'write_team_file', status: 'complete', input: {path: 'x.md'}});
    const note = await service.addNote(s0.activeConversationId, 'Queue: done.'); assert.equal(note.kind, 'app-note');
    const chat = service.newChat(s0.activeBotId, 'WOW test-co (I1)'); assert.notEqual(service.state.activeConversationId, chat.id, 'a run chat does not change what Tavin is looking at');
    await service.close();
  } finally { await rm(dataDir, {recursive: true, force: true}); }
});

test('Max build 26: no button is drawn on any layout; the page shows Facebook\'s own button bar under each new ad', async () => {
  const W = await import('../src/wow-ads.mjs'), P = await import('../src/wow-page.mjs');
  const brand = {primary: '#0E6137', accent: '#00781F', panel: '#0A2616', soft: '#E4F2E8', name: 'TEST', place: 'TESTTOWN'};
  const base = {name: 'x', button: 'Book now', logoLine: 'TEST CO · TESTTOWN', photo: 'p.jpg'};
  const ads = [{layout: 'problem-fix', headline: 'Leak?\nFixed today.', proof: '4.9 from 120 reviews'}, {layout: 'preview', headline: 'Leak?\nFixed today.', proof: '4.9'},
    {layout: 'split-claim', kicker: 'LEAK?', headline: 'Fixed today.', proofBig: '120', proofText: 'reviews'}, {layout: 'big-review', kicker: 'LEAK!', quote: 'Fast.', stars: 5, who: 'A. Tester'},
    {layout: 'big-review', kicker: 'LEAK!', quote: 'Fast.', stars: 5, who: 'A. Tester', photo: ''}, {layout: 'bold-text', kicker: 'LEAK?', headline: 'Fixed today.', badge: 'Testtown'},
    {layout: 'big-number', kicker: 'SINCE', number: '2001', numberLine: 'Local.'}, {layout: 'big-number', kicker: 'SINCE', number: '2001', numberLine: 'Local.', photo: ''}];
  for (const a of ads) { const html = W.wowPage({ad: {...base, ...a}, brand, images: {'p.jpg': 'data:image/png;base64,AA=='}}); assert.doesNotMatch(html, /Book now|data-k="button"|class="btn/, a.layout); }
  // The button no longer counts as words on the picture, but every ad still needs one (the page shows it).
  assert.match(W.wowWordProblems({...base, ...ads[0], button: ''}).join(' '), /needs "button"/);
  const html = P.wowPageHtml({name: 'Test Co', slug: 'test-co', brand, current: {show: 'c.jpg', title: 'Now', text: 'x'},
    ads: [{show: 'a1.png', download: 'a1.png', title: 'A', text: 'a', button: 'Book now'}, {show: 'a2.png', download: 'a2.png', title: 'B', text: 'b', button: 'Book now'}],
    preview: {show: 'p.png'}, situation: 'Someone', more: [{show: 'm.jpg'}], moreText: 'More.', anatomy: null});
  assert.equal((html.match(/<div class="fbbar">/g) || []).length, 4, 'ads 1 and 2, and both ads in the team-photo pair');
  assert.match(html, /Facebook's own button, the one your ad uses now \(&quot;Book now&quot;\)|Facebook's own button, the one your ad uses now \("Book now"\)/);
});

test('Max build 26: before review the app checks the business\'s ad is still active; the result is on the review page and in Max\'s note', async () => {
  const {leadAdIds, adsActive, makeAdCheck} = await import('../src/ad-check.mjs');
  const lead = '## Top 3\n\n### 1. Alpha Co (Town, CA), plumbing\n- Folder: alpha-co\n- Ads: 1 active\n  - Ad 1: https://www.facebook.com/ads/library/?id=111222333 | ad id 111222333 | Ad Library page id 999888777.\n\n### 2. Beta Co\n- Folder: beta-co\n- ad id 444555666 | page id 123123123\n';
  assert.deepEqual(leadAdIds(lead, 'alpha-co'), {pageId: '999888777', adIds: ['111222333']});
  assert.deepEqual(leadAdIds(lead, 'beta-co'), {pageId: '123123123', adIds: ['444555666']});
  // Only the "active" flag counts, never the end date (28 Nov: running ads had end dates in March and August).
  assert.equal(adsActive({results: [{ad_archive_id: '111222333', is_active: true, end_date_string: '2026-03-02'}]}, ['111222333']).active, true);
  assert.equal(adsActive({results: [{ad_archive_id: '777', is_active: true}]}, ['111222333']).active, false);
  assert.equal(adsActive({results: []}, []).active, false);
  let asked; const check = makeAdCheck({url: 'https://treg.example/mcp'}, async (_c, endpoint, params) => { asked = {endpoint, params}; return {status: 200, body: {results: [{ad_archive_id: '111222333', is_active: true}]}, cost_usd: 0.00188}; });
  assert.equal((await check({pageId: '999888777', adIds: ['111222333']})).state, 'active'); assert.equal(asked.params.pageId, '999888777');
  assert.equal((await makeAdCheck(null)({pageId: '1'})).state, 'unknown');

  const env = await make(), {root, service, p} = env;
  try {
    await put(root, 'leads/leads-2026-11-24.md', lead);
    p.adCheck = async ({pageId, adIds}) => ({state: pageId === '999888777' && adIds[0] === '111222333' ? 'stopped' : 'unknown', cost: 0.00188});
    await p.queueWow([{business: 'alpha-co', name: 'Alpha Co', version: 'A', lead: 'leads/leads-2026-11-24.md', from: 'check'}]);
    await pass(env, 'alpha-co'); await p.tick();
    assert.equal(p.findWow('alpha-co').adCheck.state, 'stopped');
    assert.match(await readFile(join(root, 'pipeline/wow-alpha-co/review.html'), 'utf8'), /NOT active in the Meta Ad Library any more/);
    assert.match(service.notes.join('\n'), /Alpha Co is ready for your review.*NOT active/);
    assert.match(await readFile(join(root, `board/runs-${localDate(Date.now())}.md`), 'utf8'), /Ad Library check for alpha-co: their ad is NOT active any more \| cost: \$0, treg \$0\.00188/);
  } finally { await env.done(); }
});
