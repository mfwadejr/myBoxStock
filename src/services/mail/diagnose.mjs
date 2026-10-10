// SERVICES / mail / diagnose — the Host's "Send test email" and "Check my email setup": runs the checks in order (settings, connection, sign-in, send), says in plain words
// what went wrong and what to try next, keeps the technical detail for support, and remembers the last result. The mail password is never part of any result, log or stored value.
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns/promises';
import nodemailer from 'nodemailer';
import { getMailSettings } from './settings.mjs';
import { transportFor } from './transport.mjs';
import { render } from './templates.mjs';
import { LOGO_CID } from './theme.mjs';
import { checkSender } from './sender-checks.mjs';
import { getSetting, setSetting } from '../../db/settings.mjs';
import { areaLogger } from '../../logging/logger.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const L = areaLogger('mail');
const LOGO_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'assets', 'logo-email.png');
const TIMEOUT = 10000;

// What each kind of failure means and what to do. `cause` says what happened, `next` the first thing to try.
export const KINDS = {
  settings: { title: 'Email is not fully set up', cause: 'Email is turned off or a required detail is missing.', next: 'Turn on Send email, enter a From address and, for an SMTP relay, the host and port. Then save and try again.' },
  unreachable: { title: 'Cannot reach the mail server', cause: 'This server could not open a connection to the mail server.', next: 'Check the server name for typos and that the port is right. If you send directly from a home or office connection, your provider may block port 25: use an SMTP relay instead.' },
  tls: { title: 'Wrong port or TLS setting', cause: 'The mail server answered, but not in the way this setting expects.', next: 'Port 587 normally uses “Use TLS from the start” OFF. Port 465 needs it ON. Check which one your mail provider gave you.' },
  auth: { title: 'The mail server refused the sign-in', cause: 'The server was reached, but it did not accept the username and password.', next: 'Re-enter the username and password. Many providers need an app password or SMTP password instead of your normal login.' },
  sender: { title: 'The From address is not allowed', cause: 'The mail server refused to send mail from this address.', next: 'Use a From address on a domain your mail provider has verified for you, or the same address as your SMTP login.' },
  unauthenticated: { title: 'Sent, but it looks unauthenticated', cause: 'The message was accepted, but receivers may treat it as suspicious because the sending domain has no (or an incomplete) SPF, DKIM or DMARC setup.', next: 'Open the Health tab, Sender checks, and add the missing DNS records for your From address’s domain.' },
  blocked: { title: 'Blocked or rate-limited', cause: 'The mail server or the receiving side refused the message because of limits, a block list, or spam rules.', next: 'Wait a while and try again. If it keeps happening, check that your sending address or server is not on a block list and that you are within your provider’s sending limits.' },
  other: { title: 'The test email could not be sent', cause: 'The mail server refused or dropped the message for a reason this page does not recognise.', next: 'Open “Show details” and check the server’s own words, or give them to your mail provider.' },
};

// Removes anything that could be the mail password (and the user:password forms) from text that will be shown or logged.
export function scrub(text, secrets = []) {
  let t = String(text ?? '');
  for (const s of secrets.filter(x => x && String(x).length >= 3)) t = t.split(String(s)).join('[hidden]').split(Buffer.from(String(s)).toString('base64')).join('[hidden]');
  return t.replace(/(AUTH\s+(?:PLAIN|LOGIN)\s+)\S+/gi, '$1[hidden]').replace(/(password|pass|pwd)\s*[=:]\s*\S+/gi, '$1=[hidden]').slice(0, 800);
}

// Which kind of problem a nodemailer / socket error is. Looks at the error code first, then the words the server used.
export function classify(e, { step = 'send' } = {}) {
  const code = String(e?.code || ''), resp = String(e?.response || ''), cmd = String(e?.command || ''), code5 = Number(e?.responseCode) || Number((resp.match(/^(\d{3})/) || [])[1]) || 0;
  const words = `${e?.message || ''} ${resp}`.toLowerCase();
  if (code === 'EAUTH' || code5 === 535 || code5 === 534 || (cmd === 'AUTH PLAIN' || cmd === 'AUTH LOGIN') && code5 >= 400 || /authentication (failed|unsuccessful|required)|invalid login|username and password not accepted|bad credentials/.test(words)) return 'auth';
  if (/wrong version number|ssl routines|tls|starttls|greeting never received|unexpected socket close|eproto|self.signed|certificate|handshake/.test(words) || code === 'ETLS' || code === 'EPROTOCOL' || (code === 'ETIMEDOUT' && /greeting/.test(words))) return 'tls';
  if (/spf|dkim|dmarc|unauthenticated|not authenticated|authentication results|5\.7\.26/.test(words)) return 'unauthenticated';
  if (/rate.?limit|too many|throttl|blocked|blacklist|block ?list|spamhaus|reputation|temporarily deferred|try again later|greylist|quota|exceeded/.test(words) || [421, 450, 451, 452].includes(code5) || (code5 === 554 && /spam|reject|policy/.test(words))) return 'blocked';
  if (code === 'EENVELOPE' || [553, 550, 501, 502].includes(code5) && /sender|from|relay|not allowed|not permitted|domain|unauthori[sz]ed|mailbox/.test(words) || /sender address rejected|not allowed to send|relay access denied|not owned by user|5\.7\.60|5\.7\.1|5\.1\.8/.test(words)) return 'sender';
  if (['ECONNECTION', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'EDNS', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET', 'EAI_AGAIN'].includes(code) || step === 'connect') return 'unreachable';
  return 'other';
}

const explain = (kind, e, secrets, extra = {}) => ({ kind, code: `MAIL_TEST_${kind.toUpperCase()}`, ...KINDS[kind], detail: scrub(`${e?.code ? `${e.code}: ` : ''}${e?.message || e || ''}${e?.response && !String(e.message).includes(e.response) ? ` | server said: ${e.response}` : ''}`, secrets), ...extra });

// Opens a plain or TLS connection and waits for the server's first line (its greeting). Resolves the line; rejects with the socket error.
const connectTo = (host, port, secure, greetingMs) => new Promise((resolve, reject) => {
  const s = (secure ? tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false }) : net.connect({ host, port }));
  let timer = setTimeout(() => done(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })), TIMEOUT);
  const done = (err, line) => { clearTimeout(timer); s.destroy(); err ? reject(err) : resolve(line); };
  s.once(secure ? 'secureConnect' : 'connect', () => { clearTimeout(timer); timer = setTimeout(() => done(Object.assign(new Error('Greeting never received'), { code: 'ETIMEDOUT' })), greetingMs); s.once('data', (b) => done(null, String(b).split('\r\n')[0])); });
  s.once('error', done);
});

const stamp = () => Date.now();
const STEPS = [['settings', 'Settings are complete'], ['connect', 'Reach the mail server'], ['signin', 'Sign in to the mail server'], ['send', 'Send the test message']];

// Fingerprint of the settings that matter for delivery (never the password itself, only whether it changed). A test result only counts for the settings it was run against.
export async function settingsFingerprint(db) {
  const raw = await getSetting(db, 'mail', {}), m = await getMailSettings(db), s = raw.smtp || {};
  return crypto.createHash('sha256').update(JSON.stringify([m.enabled, m.mode, m.fromAddress, m.fromName, m.heloName, m.smtp.host, m.smtp.port, m.smtp.secure, m.smtp.user, s.pass || ''])).digest('hex').slice(0, 24);
}

// Runs the checks in order and stops at the first failure. `sendIt` false = stop before sending (not used by the buttons today, kept for the connection-only check).
export async function runMailCheck(db, { to, resolver, sendIt = true, greetingMs = 6000 } = {}) {
  const settings = await getMailSettings(db, { reveal: true }), secrets = [settings.smtp.pass], started = stamp(), steps = STEPS.map(([key, label]) => ({ key, label, status: 'notrun', note: '' }));
  const set = (key, status, note = '', more = {}) => Object.assign(steps.find(s => s.key === key), { status, note, ...more });
  let failure = null, warning = null, via = '', tp = null;
  const fail = (key, kind, e, extra) => { failure = explain(kind, e, secrets, extra); set(key, 'fail', failure.title); };
  try {
    // 1. settings
    if (!settings.enabled || !settings.fromAddress || (settings.mode === 'smtp' && (!settings.smtp.host || !settings.smtp.port))) {
      const why = !settings.enabled ? 'Send email is turned off.' : !settings.fromAddress ? 'There is no From address.' : 'The SMTP host or port is empty.';
      fail('settings', 'settings', new Error(why)); throw 0;
    }
    set('settings', 'ok', `${settings.mode === 'smtp' ? `SMTP relay ${settings.smtp.host}:${settings.smtp.port}` : 'Direct to the recipient'}, from ${settings.fromAddress}`);
    // 2. connection
    let host, port, secure = false;
    if (settings.mode === 'smtp') ({ host, port } = settings.smtp), secure = !!settings.smtp.secure;
    else { const dom = String(to).split('@')[1]; let mx = []; try { mx = (await dns.resolveMx(dom)).sort((a, b) => a.priority - b.priority); } catch {} host = mx[0]?.exchange || dom; port = 25; }
    try {
      const hello = await connectTo(host, Number(port), secure, greetingMs);
      if (/^[45]/.test(hello)) { fail('connect', classify({ responseCode: Number(hello.slice(0, 3)), response: hello, message: hello }), { code: 'EGREETING', message: hello }); throw 0; }
      set('connect', 'ok', `Connected to ${host}:${port}`); via = `${host}:${port}`;
    } catch (e) { if (e === 0) throw e; fail('connect', secure && /wrong version|ssl|tls|eproto/i.test(e.message) ? 'tls' : classify(e, { step: 'connect' }), e); throw 0; }
    // 3. sign-in (only an SMTP relay with a username signs in)
    const { transport } = await transportFor(settings, to); tp = transport;
    if (settings.mode === 'smtp' && settings.smtp.user) {
      try { await transport.verify(); set('signin', 'ok', `Signed in as ${settings.smtp.user}`); }
      catch (e) { const k = classify(e, { step: 'signin' }); fail('signin', k === 'unreachable' ? 'tls' : k, e); throw 0; }
    } else set('signin', 'skipped', settings.mode === 'smtp' ? 'This relay needs no sign-in' : 'Direct sending needs no sign-in');
    // 4. send
    if (!sendIt) { set('send', 'skipped', 'Not sent'); throw 0; }
    const m = render('test', {}, (await getSetting(db, 'mail_templates', {})).test);   // the Host's own wording for the test message, if edited
    try {
      await transport.sendMail({ from: `"${settings.fromName}" <${settings.fromAddress}>`, to, subject: `${m.subject} (${new Date().toISOString().slice(11, 16)} UTC)`, text: m.text, html: m.html, attachments: [{ filename: 'myboxstock.png', path: LOGO_FILE, cid: LOGO_CID, contentDisposition: 'inline' }] });
      set('send', 'ok', `Accepted by the mail server for ${to}`);
    } catch (e) { fail('send', classify(e, { step: 'send' }), e); throw 0; }
    // Accepted. Does the sender domain look authenticated? (public DNS facts only)
    try {
      const c = await checkSender({ fromAddress: settings.fromAddress }, resolver);
      if (c.domain && (c.spf?.status === 'missing' || c.dmarc?.status === 'missing')) { warning = explain('unauthenticated', null, secrets, { detail: `SPF ${c.spf.status}, DMARC ${c.dmarc.status}, DKIM ${c.dkim.status} for ${c.domain}` }); set('send', 'warn', 'Accepted, but the sending domain looks unauthenticated'); }
    } catch {}
  } catch (e) { if (e !== 0) { failure = failure || explain('other', e, secrets); } }
  tp?.close?.();
  return { ok: !failure, to, via, steps, failure, warning, at: started, ms: stamp() - started };
}

// ---- remembered result ----
export async function saveLastTest(db, result) {
  const rec = { at: result.at, ok: result.ok, kind: result.failure?.kind || (result.warning ? 'unauthenticated' : ''), title: result.failure?.title || result.warning?.title || 'Test email sent', fingerprint: await settingsFingerprint(db) };
  await setSetting(db, 'mail_last_test', rec); return rec;
}
// { last: {at, ok, kind, title} | null, passedSinceChange: bool, needsTest: bool } — needsTest when email is on but no test has passed for the settings as they are now.
export async function mailTestStatus(db) {
  const m = await getMailSettings(db), last = await getSetting(db, 'mail_last_test', null), fp = last ? await settingsFingerprint(db) : '';
  const passed = !!(last && last.ok && last.fingerprint === fp);
  return { last: last ? { at: last.at, ok: last.ok, kind: last.kind, title: last.title, current: last.fingerprint === fp } : null, passedSinceChange: passed, needsTest: !!(m.enabled && m.fromAddress) && !passed };
}
export const logTest = (result, actor, ip) => L[result.ok ? 'info' : 'warn']('test', `Email test ${result.ok ? 'passed' : `failed: ${result.failure.title}`}${result.warning ? ` (warning: ${result.warning.title})` : ''}`, { actor, ip, data: { ok: result.ok, kind: result.failure?.kind || null, warning: result.warning?.kind || null, steps: result.steps.map(s => `${s.key}:${s.status}`), via: result.via } });
