// Max build 26 (28 Nov 2026): before a WOW set goes to Tavin's review, the app checks in the Meta Ad Library (through
// the team's treg connection) that the business's ad is still running, so Tavin never checks it by hand. Only the
// Ad Library's own "active" flag counts: the end date in this data is not a stop date (28 Nov: two running ads had
// end dates in March and August). One call per business, about $0.002, counted in Max's monthly treg spend.
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const AD_CHECK_ENDPOINT = 'scrapecreators.x.v1-facebook-adlibrary-company-ads';

// The business's section of a leads file (from its "### " heading to the next) and the ids in it.
export function leadSection(text, business) {
  const parts = String(text || '').split(/^(?=#{2,3} )/m);
  return parts.find(p => new RegExp(`^-\\s*Folder:\\s*\`?${business}\`?\\s*$`, 'mi').test(p)) || '';
}
export function leadAdIds(text, business) {
  const s = leadSection(text, business);
  const pageId = s.match(/page id[^0-9\n]{0,6}(\d{6,})/i)?.[1] || '';
  const adIds = [...new Set([...s.matchAll(/(?:\bad id\s+|ads\/library\/\?id=)(\d{6,})/gi)].map(m => m[1]))];
  return {pageId, adIds};
}

// From the provider's answer: is one of the lead's ads (or, with no ids, any ad of the page) still active?
export function adsActive(body, adIds = []) {
  const rows = Array.isArray(body?.results) ? body.results : [];
  const live = rows.filter(r => r?.is_active === true).map(r => String(r.ad_archive_id));
  const ours = adIds.filter(id => live.includes(String(id)));
  return {active: adIds.length ? ours.length > 0 : live.length > 0, ours, liveCount: live.length};
}

// One call through treg's MCP "call" tool. The answer is the tool's JSON text: {status, body, cost_usd, ...}.
export async function tregCall({url, headers = {}}, endpoint_id, params, {timeoutMs = 60000} = {}) {
  const client = new Client({name: 'max-ad-check', version: '1.0.0'});
  const transport = new StreamableHTTPClientTransport(new URL(url), {requestInit: {headers}});
  const timer = new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('treg did not answer within a minute')), timeoutMs); t.unref?.(); });
  try {
    await Promise.race([client.connect(transport), timer]);
    const r = await Promise.race([client.callTool({name: 'call', arguments: {endpoint_id, params}}), timer]);
    const textPart = (r?.content || []).find(c => c.type === 'text')?.text || '';
    if (r?.isError) throw new Error(textPart.slice(0, 200) || 'treg returned an error');
    let out; try { out = JSON.parse(textPart); } catch { throw new Error('treg\'s answer did not read as JSON'); }
    if (Number(out.status) >= 400) throw new Error(`treg answered ${out.status}`);
    return out;
  } finally { await client.close().catch(() => {}); }
}

// What the pipeline calls: check({pageId, adIds}) -> {state: 'active'|'stopped'|'unknown', ...}.
export function makeAdCheck(connection, call = tregCall) {
  return async ({pageId, adIds = []}) => {
    const conn = typeof connection === 'function' ? connection() : connection;
    if (!conn?.url) return {state: 'unknown', why: 'no treg connection in Max'};
    if (!pageId) return {state: 'unknown', why: 'no Ad Library page id in the leads file'};
    const out = await call(conn, AD_CHECK_ENDPOINT, {pageId, trim: true});
    const {active, ours, liveCount} = adsActive(out.body, adIds);
    return {state: active ? 'active' : 'stopped', ours, liveCount, cost: Number(out.cost_usd) || 0, callId: out.call_id || ''};
  };
}
