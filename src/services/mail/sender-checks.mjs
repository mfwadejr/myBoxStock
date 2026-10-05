// SERVICES / mail / sender-checks — looks up the public DNS records (SPF, DMARC, DKIM) of the From address's domain and explains them in plain English.
// DNS facts only. The app does not sign mail itself: the mail relay normally does, so a missing DKIM record is only a problem if the relay does not sign.
import dns from 'node:dns/promises';

export const COMMON_SELECTORS = ['default', 'selector1', 'selector2', 'google', 'k1', 'mail', 'dkim'];
const TIMEOUT_MS = 4000, NOT_THERE = new Set(['ENOTFOUND', 'ENODATA', 'ENOENT']);   // "no such record" answers; anything else means we could not tell

export const domainOf = (address) => { const m = String(address || '').trim().match(/^[^@\s]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)$/i); return m ? m[1].toLowerCase() : ''; };
export const cleanSelector = (s) => { const v = String(s || '').trim().toLowerCase(); return /^[a-z0-9]([a-z0-9._-]{0,61}[a-z0-9])?$/.test(v) ? v : ''; };

// One TXT lookup: { ok: true, records: [string] } (empty list = no such record) or { ok: false } when the lookup itself failed.
async function txt(resolver, name) {
  let timer;
  try {
    const rows = await Promise.race([resolver.resolveTxt(name), new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), TIMEOUT_MS); })]);
    return { ok: true, records: rows.map(r => (Array.isArray(r) ? r.join('') : String(r))) };
  } catch (e) { return NOT_THERE.has(e?.code) ? { ok: true, records: [] } : { ok: false, records: [] }; }
  finally { clearTimeout(timer); }
}
const shown = (s) => String(s).slice(0, 400);

export async function checkSender({ fromAddress, selector = '' }, resolver = dns) {
  const domain = domainOf(fromAddress), want = cleanSelector(selector);
  if (!domain) return { domain: '', error: 'Set a From address on the Delivery tab first, then check again.' };
  const [spfR, dmarcR] = await Promise.all([txt(resolver, domain), txt(resolver, `_dmarc.${domain}`)]);
  const spfRec = spfR.records.filter(r => /^v=spf1(\s|$)/i.test(r)), dmarcRec = dmarcR.records.filter(r => /^v=DMARC1(\s*;|\s*$)/i.test(r));
  const spf = !spfR.ok ? { status: 'unknown', advice: 'The DNS lookup did not answer, so SPF could not be checked. Try again in a minute.' }
    : spfRec.length ? { status: 'found', record: shown(spfRec[0]), advice: spfRec.length > 1 ? 'Found, but there is more than one SPF record. Receivers treat that as an error: keep a single record that lists everything allowed to send for your domain.' : 'Found. Make sure it includes your mail relay, otherwise receivers may mark your mail as suspicious.' }
    : { status: 'missing', advice: 'Not found. SPF tells receiving mail servers which servers may send mail for your domain. Ask your mail relay provider for the SPF record to add to your domain’s DNS.' };
  const policy = dmarcRec[0]?.match(/;\s*p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() || '';
  const dmarc = !dmarcR.ok ? { status: 'unknown', advice: 'The DNS lookup did not answer, so DMARC could not be checked. Try again in a minute.' }
    : dmarcRec.length ? { status: 'found', record: shown(dmarcRec[0]), policy, advice: policy === 'none' ? 'Found, in monitoring mode (p=none): receivers will not act on failures yet. That is a fine first step.' : 'Found. Receivers are told what to do with mail that fails the checks.' }
    : { status: 'missing', advice: 'Not found. DMARC tells receivers what to do with mail that fails SPF or DKIM, and gives you reports. Add a TXT record at _dmarc.' + domain + ' such as v=DMARC1; p=none to start.' };
  const names = want ? [want] : COMMON_SELECTORS, results = await Promise.all(names.map(async (s) => [s, await txt(resolver, `${s}._domainkey.${domain}`)]));
  const hit = results.find(([, r]) => r.ok && r.records.some(x => /v=DKIM1|p=/i.test(x))), failed = results.filter(([, r]) => !r.ok).length;
  const note = 'This app does not sign mail itself. Your mail relay normally signs it, so a missing DKIM record here is only a problem if your relay does not sign.';
  const dkim = hit ? { status: 'found', selector: hit[0], advice: `Found for the selector “${hit[0]}”. ${note}` }
    : failed === results.length ? { status: 'unknown', selector: want, tried: names, advice: 'The DNS lookup did not answer, so DKIM could not be checked. Try again in a minute.' }
    : { status: 'missing', selector: want, tried: names, advice: want ? `Not found for the selector “${want}”. Check the selector name with your mail relay provider. ${note}` : `Not found for the common selectors (${names.join(', ')}). Your relay may use a different selector: type it above and check again. ${note}` };
  return { domain, spf, dmarc, dkim, checkedAt: Date.now() };
}
