// SERVICES / mail / templates — message wording ({{placeholders}}) and the one branded layout every message uses.
// A message is: subject, heading, body (plain paragraphs) and optionally a button. The styled and plain-text versions are both built
// from those same words. The Host administrator can change the words (see overrides); colours, fonts and layout always come from the theme.
import { emailStyles as S, LOGO_CID } from './theme.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Placeholders a message may use. sample = what the preview shows; bold = shown in bold (identifiers people may need to copy).
export const PLACEHOLDERS = {
  name: { label: 'Name', sample: 'Alex' },
  accountCode: { label: 'Account ID', sample: 'BX-4K7Q2M', bold: true },
  login: { label: 'Sign-in name', sample: 'alex@BX-4K7Q2M', bold: true },
  trialLine: { label: 'Trial sentence', sample: 'Your free trial runs for 14 days (until 2026-10-18).' },
  ip: { label: 'Address', sample: '203.0.113.24', bold: true },
  device: { label: 'Device', sample: 'Chrome on a Mac', bold: true },
  time: { label: 'Time', sample: 'Sun, 04 Oct 2026 09:15:00 GMT', bold: true },
  when: { label: 'Time', sample: 'Sun, 04 Oct 2026 02:00:00 GMT', bold: true },
  error: { label: 'Problem', sample: 'Not enough disk space', bold: true },
  url: { label: 'Link', sample: 'https://app.myboxstock.com/app/' },
  link: { label: 'Link', sample: 'https://app.myboxstock.com/app/#/reset/example' },
};

// group = how the Messages editor groups them; vars = placeholders offered; required = ones the wording must keep; button = { label, to: placeholder holding the address }.
export const TEMPLATES = {
  welcome: { group: 'Account', name: 'Welcome', title: 'Welcome to myBoxStock', subject: 'Welcome to myBoxStock — your account ID is {{accountCode}}',
    body: 'Hi {{name}},\n\nYour account is ready.\n\nAccount ID: {{accountCode}}\nSign in with: {{login}}\n\n{{trialLine}}',
    button: { label: 'Open myBoxStock', to: 'url' }, vars: ['name', 'accountCode', 'login', 'trialLine'], required: ['accountCode'] },
  new_sign_in: { group: 'Account', name: 'New sign-in alert', title: 'New sign-in to your account', subject: 'New sign-in to your myBoxStock account',
    body: 'Hi {{name}},\n\nYour account was just signed in to from a new address.\n\nAddress: {{ip}}\nDevice: {{device}}\nTime: {{time}}\n\nIf this was you, no action is needed. If not, change your password right away and tell your account administrator.',
    vars: ['name', 'ip', 'device', 'time'], required: ['ip', 'time'] },
  password_reset: { group: 'Account', name: 'Password reset', title: 'Choose a new password', subject: 'Reset your myBoxStock password',
    body: 'Hi {{name}},\n\nSomeone asked to reset the password for your account. Use the button below to choose a new password. The link is valid for 1 hour.\n\nIf this was not you, you can ignore this email.',
    button: { label: 'Choose a new password', to: 'link' }, vars: ['name'], required: [] },
  temp_password: { group: 'Account', name: 'Temporary password', title: 'Your temporary password', subject: 'Your temporary myBoxStock password',
    body: 'Hi {{name}},\n\nA support administrator set a temporary password for your account. You will be asked to change it when you sign in.',
    button: { label: 'Sign in', to: 'url' }, vars: ['name'], required: [] },
  mfa_reset: { group: 'Account', name: 'Two-factor reset', title: 'Two-factor authentication was reset', subject: 'Two-factor authentication was reset on your account',
    body: 'Hi {{name}},\n\nA support administrator reset two-factor authentication on your account. Sign in and set it up again from Security settings.\n\nIf this was unexpected, contact support.',
    vars: ['name'], required: [] },
  trial_ended: { group: 'Trial', name: 'Trial ended', title: 'Your free trial has ended', subject: 'Your myBoxStock trial has ended',
    body: 'Hi {{name}},\n\nThe free trial for account {{accountCode}} has ended. Your data is safe and the account is now read-only: you can still sign in and look at everything, but changes are paused.\n\nContact support to continue.',
    vars: ['name', 'accountCode'], required: ['accountCode'] },
  backup_failed: { group: 'System', name: 'Backup failed', title: 'A scheduled backup did not complete', subject: 'myBoxStock: the scheduled backup did not complete',
    body: 'The scheduled full-site backup did not complete.\n\nTime: {{when}}\nProblem: {{error}}\n\nOpen the Host Console, Backups page, to check it and run one by hand.',
    vars: ['when', 'error'], required: ['when', 'error'] },
  test: { group: 'System', name: 'Test message', title: 'Email is working', subject: 'myBoxStock test email',
    body: 'This is a test message from your myBoxStock server.\n\nOutbound email is working.', vars: [], required: [] },
};

export const EDITABLE = ['subject', 'title', 'body', 'buttonLabel'];
export const defaultsOf = (t) => ({ subject: t.subject, title: t.title, body: t.body, buttonLabel: t.button?.label || '' });
// The wording in use: the defaults with any saved changes on top.
export const wording = (key, override) => { const t = TEMPLATES[key]; if (!t) throw new Error('Unknown template ' + key); const d = defaultsOf(t), o = override || {}; return Object.fromEntries(EDITABLE.map(k => [k, typeof o[k] === 'string' && o[k].trim() ? o[k] : d[k]])); };
export const sampleVars = () => Object.fromEntries(Object.entries(PLACEHOLDERS).map(([k, v]) => [k, v.sample]));

// What is wrong with this wording, in plain words (empty list = fine).
export function problems(key, w) {
  const t = TEMPLATES[key], out = [], allowed = new Set([...t.vars, ...(t.button ? [t.button.to] : [])]);
  const text = `${w.subject}\n${w.body}\n${w.title}`;
  if (!w.subject.trim()) out.push('The subject cannot be empty.'); else if (w.subject.length > 200) out.push('The subject is too long (200 characters at most).');
  if (!w.title.trim()) out.push('The heading cannot be empty.'); else if (w.title.length > 120) out.push('The heading is too long (120 characters at most).');
  if (!w.body.trim()) out.push('The body cannot be empty.'); else if (w.body.length > 4000) out.push('The body is too long (4000 characters at most).');
  if (t.button && !String(w.buttonLabel).trim()) out.push('The button needs a label.'); else if (t.button && w.buttonLabel.length > 60) out.push('The button label is too long (60 characters at most).');
  for (const m of new Set([...text.matchAll(/\{\{(\w*)\}\}/g)].map(x => x[1]))) if (!allowed.has(m)) out.push(`{{${m}}} is not available in this message.`);
  const used = `${w.subject}\n${w.body}`;
  for (const r of t.required) if (!used.includes(`{{${r}}}`)) out.push(`Keep {{${r}}} (${PLACEHOLDERS[r].label}) in the subject or body.`);
  return out;
}

const fillText = (str, vars) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
const fillHtml = (str, vars) => esc(str).replace(/\{\{(\w+)\}\}/g, (_, k) => { const v = esc(vars[k] ?? ''); return PLACEHOLDERS[k]?.bold && v ? `<b>${v}</b>` : v; });
const paragraphs = (body) => body.replace(/\r/g, '').trim().split(/\n{2,}/);
const btn = (href, label) => `<p><a style="${S.button}" href="${esc(href)}">${esc(label)}</a></p>`;
const wrap = (title, inner) => `<!doctype html><html><body style="${S.body}"><div style="${S.card}"><div style="${S.header}"><img src="cid:${LOGO_CID}" width="56" height="56" alt="myBoxStock" style="${S.logo}"><div style="${S.brand}">myBoxStock</div></div><h1 style="${S.title}">${esc(title)}</h1>${inner}</div><div style="${S.footer}">You are receiving this because of activity on your myBoxStock account.<br>Please do not reply to this message.</div></body></html>`;

export function render(key, vars, override) {
  const t = TEMPLATES[key], w = wording(key, override), url = t.button ? String(vars[t.button.to] || '') : '';
  const html = paragraphs(w.body).map(p => `<p>${fillHtml(p, vars).replace(/\n/g, '<br>')}</p>`).join('') + (url ? btn(url, w.buttonLabel) : '');
  const text = `${w.title}\n\n${fillText(w.body.replace(/\r/g, '').trim(), vars)}\n\n${url ? `${w.buttonLabel}: ${url}\n\n` : ''}— myBoxStock`;
  return { subject: fillText(w.subject, vars).replace(/\s*\n\s*/g, ' ').trim(), text, html: wrap(w.title, html) };
}
