// SERVICES / mail / templates — message wording ({{placeholders}}) and the one branded layout every message uses.
// A message is: subject, heading, body (plain paragraphs) and optionally a button. The styled and plain-text versions are both built
// from those same words. The Host administrator can change the words (see overrides); colours, fonts and layout always come from the theme.
import { emailStyles as S, LOGO_CID } from './theme.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Placeholders a message may use. sample = what the preview shows; bold = shown in bold (identifiers people may need to copy).
export const PLACEHOLDERS = {
  name: { label: 'Name', sample: 'Alex' },
  accountCode: { label: 'Reseller ID', sample: 'amber-fox-4271', bold: true },
  username: { label: 'Username', sample: 'alex', bold: true },
  login: { label: 'Sign-in name', sample: 'alex@amber-fox-4271', bold: true },
  accounts: { label: 'Your accounts and reset links', sample: 'Alex Boxes — Reseller ID: amber-fox-4271, username: alex\nhttps://app.myboxstock.com/app/#/reset/example' },
  trialLine: { label: 'Trial sentence', sample: 'Your free trial runs for 14 days (until 2026-10-18).' },
  eraseDate: { label: 'Erase date', sample: '2026-10-11', bold: true },
  ip: { label: 'Address', sample: '203.0.113.24', bold: true },
  device: { label: 'Device', sample: 'Chrome on a Mac', bold: true },
  time: { label: 'Time', sample: 'Sun, 04 Oct 2026 09:15:00 GMT', bold: true },
  when: { label: 'Time', sample: 'Sun, 04 Oct 2026 02:00:00 GMT', bold: true },
  error: { label: 'Problem', sample: 'Not enough disk space', bold: true },
  business: { label: 'Business name', sample: 'Alex Boxes', bold: true },
  receiptNo: { label: 'Receipt number', sample: 'S-20261004-7K2Q', bold: true },
  customer: { label: 'Customer name', sample: 'Alex Customer', bold: true },
  message: { label: 'Receipt', sample: 'Alex Boxes\nReceipt S-20261004-7K2Q\nTotal: $40.00' },
  reasonLine: { label: 'Reason given (if any)', sample: 'Reason given: Requested by the account owner.' },
  url: { label: 'Link', sample: 'https://app.myboxstock.com/app/' },
  link: { label: 'Link', sample: 'https://app.myboxstock.com/app/#/reset/example' },
  title: { label: 'Alert headline', sample: 'Email is not being delivered', bold: true },
  ticketNo: { label: 'Ticket number', sample: 'T-1042', bold: true },
  ticketSubject: { label: 'Ticket subject', sample: 'The scanner will not focus' },
  reseller: { label: 'Reseller name', sample: 'Alex Boxes', bold: true },
  priority: { label: 'Ticket priority', sample: 'High', bold: true },
  category: { label: 'Ticket category', sample: 'Problem' },
  excerpt: { label: 'First lines of the message', sample: 'The scanner will not focus when I try to add a box.' },
  count: { label: 'Number of tickets', sample: '3', bold: true },
  lines: { label: 'List of tickets', sample: '#1042 · Alex Boxes · High · The scanner will not focus\n#1043 · Beta Shop · Normal · Question about backups' },
  notice: { label: 'Announcement', sample: 'The site will be offline for a short maintenance on Saturday morning.' },
  detail: { label: 'What was found', sample: '3 messages failed in the last 24 hours. Open Email, then Health.' },
};

// group = how the Messages editor groups them; vars = placeholders offered; required = ones the wording must keep; button = { label, to: placeholder holding the address }.
export const TEMPLATES = {
  welcome: { group: 'Account', name: 'Welcome', title: 'Welcome to myBoxStock', subject: 'Welcome to myBoxStock — your Reseller ID is {{accountCode}}',
    body: 'Hi {{name}},\n\nYour account is ready. You sign in with two things: your Reseller ID and your username.\n\nReseller ID: {{accountCode}}\nUsername: {{username}}\n\nKeep your Reseller ID somewhere safe. This browser remembers it, but you will need it on a new device.\n\n{{trialLine}}',
    button: { label: 'Open myBoxStock', to: 'url' }, vars: ['name', 'accountCode', 'username', 'trialLine'], required: ['accountCode'] },
  new_sign_in: { group: 'Account', name: 'New sign-in alert', title: 'New sign-in to your account', subject: 'New sign-in to your myBoxStock account',
    body: 'Hi {{name}},\n\nYour account was just signed in to from a new address.\n\nAddress: {{ip}}\nDevice: {{device}}\nTime: {{time}}\n\nIf this was you, no action is needed. If not, change your password right away and tell your account administrator.',
    vars: ['name', 'ip', 'device', 'time'], required: ['ip', 'time'] },
  confirm_email: { group: 'Account', name: 'Confirm your email', title: 'Confirm your email address', subject: 'Confirm your email address for myBoxStock',
    body: 'Hi {{name}},\n\nPlease confirm that this is your email address. The button below is valid for 24 hours. Until you confirm, your account works as usual, but password resets by email and adding people to your team are on hold.\n\nIf you did not ask for this, you can ignore this email.',
    button: { label: 'Confirm my email', to: 'link' }, vars: ['name', 'accountCode'], required: [] },
  password_reset: { group: 'Account', name: 'Password reset', title: 'Choose a new password', subject: 'Reset your myBoxStock password',
    body: 'Hi {{name}},\n\nSomeone asked to reset the password for your account (Reseller ID: {{accountCode}}, username: {{username}}). Use the button below to choose a new password. The link is valid for 1 hour.\n\nIf this was not you, you can ignore this email.',
    button: { label: 'Choose a new password', to: 'link' }, vars: ['name', 'accountCode', 'username'], required: [] },
  password_reset_multi: { group: 'Account', name: 'Password reset (several accounts)', title: 'Choose a new password', subject: 'Reset your myBoxStock password',
    body: 'Hi {{name}},\n\nSomeone asked to reset your password. This email address is used on more than one account, so there is a link for each. Each account has its own password: use the link for the account you want. The links are valid for 1 hour.\n\n{{accounts}}\n\nIf this was not you, you can ignore this email.',
    vars: ['name', 'accounts'], required: ['accounts'] },
  temp_password: { group: 'Account', name: 'Temporary password', title: 'Your temporary password', subject: 'Your temporary myBoxStock password',
    body: 'Hi {{name}},\n\nA support administrator set a temporary password for your account. You will be asked to change it when you sign in.',
    button: { label: 'Sign in', to: 'url' }, vars: ['name'], required: [] },
  mfa_reset: { group: 'Account', name: 'Two-factor reset', title: 'Two-factor authentication was reset', subject: 'Two-factor authentication was reset on your account',
    body: 'Hi {{name}},\n\nA support administrator reset two-factor authentication on your account. Sign in and set it up again from Security settings.\n\nIf this was unexpected, contact support.',
    vars: ['name'], required: [] },
  account_closing: { group: 'Account', name: 'Account closing', title: 'Your account is closing', subject: 'Your myBoxStock account {{accountCode}} is closing',
    body: 'Hi {{name}},\n\nA request was made to close your account (Reseller ID: {{accountCode}}). It is locked now, and everything in it will be erased automatically on {{eraseDate}}.\n\nChanged your mind? Until then an Administrator can sign in and restore the account, or you can ask support.\n\nGood to know: your data is encrypted with your own key. Backups the site keeps may still hold an encrypted copy until they expire; it cannot be opened without your password or recovery key.\n\nIf this was not you, restore the account now and change your password.',
    button: { label: 'Open myBoxStock', to: 'url' }, vars: ['name', 'accountCode', 'eraseDate'], required: ['eraseDate'] },
  account_erased: { group: 'Account', name: 'Account erased', title: 'Your account has been erased', subject: 'Your myBoxStock account {{accountCode}} has been erased',
    body: 'Hi {{name}},\n\nThe closing period for Reseller ID {{accountCode}} is over and the account, its people and all of its data have been erased from the live site.\n\nEncrypted copies in the site\'s backups, if any, expire as those backups age out. They cannot be opened without your password or recovery key.\n\nThank you for using myBoxStock.',
    vars: ['name', 'accountCode'], required: ['accountCode'] },
  account_erased_by_host: { group: 'Account', name: 'Account erased by the Host', title: 'Your account was deleted', subject: 'Your myBoxStock account {{accountCode}} was deleted',
    body: 'Hi {{name}},\n\nThe myBoxStock account with Reseller ID {{accountCode}} was deleted by the site\'s Host administrator on {{when}}, and everything in it has been erased from the live site.\n\n{{reasonLine}}\n\nThe Host cannot recover it: your data was encrypted with your own key, so the only way back is your own backup file. Encrypted copies in the site\'s backups, if any, expire as those backups age out and cannot be opened without your password or recovery key.',
    vars: ['name', 'accountCode', 'when', 'reasonLine'], required: ['accountCode'] },
  trial_ended: { group: 'Trial', name: 'Trial ended', title: 'Your free trial has ended', subject: 'Your myBoxStock trial has ended',
    body: 'Hi {{name}},\n\nThe free trial for Reseller ID {{accountCode}} has ended. Your data is safe and the account is now read-only: you can still sign in and look at everything, but changes are paused.\n\nContact support to continue.',
    vars: ['name', 'accountCode'], required: ['accountCode'] },
  backup_failed: { group: 'System', name: 'Backup failed', title: 'A scheduled backup did not complete', subject: 'myBoxStock: the scheduled backup did not complete',
    body: 'The scheduled full-site backup did not complete.\n\nTime: {{when}}\nProblem: {{error}}\n\nOpen the Host Console, Backups page, to check it and run one by hand.',
    vars: ['when', 'error'], required: ['when', 'error'] },
  host_alert: { group: 'System', name: 'Host alert', title: 'The server needs a look', subject: 'myBoxStock alert: {{title}}',
    body: 'The server found a problem.\n\n{{title}}\n\n{{detail}}\n\nTime: {{when}}\n\nOpen the Host Console, Alerts page, for the full list. You get one email per problem, not one per repeat.',
    vars: ['title', 'detail', 'when'], required: ['title'] },
  support_reply: { group: 'Account', name: 'Support ticket reply', title: 'There is a reply to your support ticket', subject: 'Reply to your myBoxStock support ticket {{ticketNo}}',
    body: 'Hi {{name}},\n\nThe myBoxStock team replied to your support ticket {{ticketNo}}: {{ticketSubject}}.\n\nSign in and open Support from the account menu to read the reply. For your privacy the reply itself is not in this email.',
    button: { label: 'Open myBoxStock', to: 'url' }, vars: ['name', 'ticketNo', 'ticketSubject'], required: ['ticketNo'] },
  support_new_ticket: { group: 'System', name: 'New support ticket (to the Host)', title: 'A reseller opened a support ticket', subject: '[myBoxStock] New support ticket {{ticketNo}}: {{ticketSubject}}',
    body: 'A reseller opened a new support ticket.\n\nReseller: {{reseller}}\nPriority: {{priority}}\nCategory: {{category}}\n\n{{excerpt}}\n\nOpen the ticket in the Host Console to read it in full and reply. Screenshots and diagnostics are not included in this email.',
    button: { label: 'Open the ticket', to: 'url' }, vars: ['ticketNo', 'ticketSubject', 'reseller', 'priority', 'category', 'excerpt'], required: ['ticketNo'] },
  support_requester_reply: { group: 'System', name: 'Reseller reply on a ticket (to the Host)', title: 'A reseller replied to a support ticket', subject: '[myBoxStock] Reseller replied on ticket {{ticketNo}}: {{ticketSubject}}',
    body: 'A reseller replied on a ticket that is waiting on the Host.\n\nReseller: {{reseller}}\nPriority: {{priority}}\nCategory: {{category}}\n\n{{excerpt}}\n\nOpen the ticket in the Host Console to read it in full and reply. Screenshots and diagnostics are not included in this email.',
    button: { label: 'Open the ticket', to: 'url' }, vars: ['ticketNo', 'ticketSubject', 'reseller', 'priority', 'category', 'excerpt'], required: ['ticketNo'] },
  support_digest: { group: 'System', name: 'Daily support digest (to the Host)', title: 'Support tickets in the last day', subject: '[myBoxStock] Support digest, {{count}} waiting',
    body: 'New tickets and reseller replies since the last digest ({{count}}):\n\n{{lines}}\n\nOpen Support in the Host Console to work through them.',
    button: { label: 'Open Support', to: 'url' }, vars: ['count', 'lines'], required: ['count'] },
  host_announcement: { group: 'Account', name: 'Announcement from the Host', title: 'A message from myBoxStock', subject: 'A message from myBoxStock',
    body: 'Hi {{name}},\n\n{{notice}}', button: { label: 'Open myBoxStock', to: 'url' }, vars: ['name', 'notice'], required: ['notice'] },
  receipt: { group: 'Customer', name: 'Receipt', title: 'Your receipt', subject: 'Receipt {{receiptNo}} from {{business}}',
    body: '{{message}}', vars: ['business', 'receiptNo', 'message'], required: ['message'] },
  sale_voided: { group: 'Customer', name: 'Sale voided', title: 'Your sale was cancelled', subject: 'Receipt {{receiptNo}} from {{business}} was cancelled',
    body: 'Receipt {{receiptNo}} from {{business}} has been cancelled. You do not need to do anything.\n\nIf you have any questions, just reply to this message.\n\n{{message}}', vars: ['business', 'receiptNo', 'message'], required: ['receiptNo'] },
  thank_you: { group: 'Customer', name: 'Thank you', title: 'Thank you', subject: 'Thank you from {{business}}',
    body: 'Hello {{customer}},\n\nThank you for your purchase from {{business}} (receipt {{receiptNo}}). If anything is not working the way you expect, just reply to this message and we will help.', vars: ['business', 'customer', 'receiptNo'], required: [] },
  own_mail_test: { group: 'Customer', name: 'Reseller mail test', title: 'Your mail server works', subject: 'Test from {{business}}: your own mail server works',
    body: 'This is a test message from {{business}}.\n\nYour receipts and other messages can now be sent from your own mail server.', vars: ['business'], required: [] },
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
const linkify = (html) => html.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);
const fillHtml = (str, vars) => linkify(esc(str).replace(/\{\{(\w+)\}\}/g, (_, k) => { const v = esc(vars[k] ?? ''); return PLACEHOLDERS[k]?.bold && v ? `<b>${v}</b>` : v; }));
const paragraphs = (body) => body.replace(/\r/g, '').trim().split(/\n{2,}/);
const btn = (href, label) => `<p><a style="${S.button}" href="${esc(href)}">${esc(label)}</a></p>`;
// brand (optional) = { name, logo: bool } for messages a reseller sends to their own customers: their name, their logo (if any) and no site footer.
const wrap = (title, inner, brand) => `<!doctype html><html><body style="${S.body}"><div style="${S.card}"><div align="center" style="${S.header}">${brand ? (brand.logo ? `<img src="cid:${LOGO_CID}" width="56" height="56" alt="${esc(brand.name)}" style="${S.logo}">` : '') + `<div style="${S.brand}">${esc(brand.name)}</div>` : `<img src="cid:${LOGO_CID}" width="56" height="56" alt="myBoxStock" style="${S.logo}"><div style="${S.brand}">myBoxStock</div>`}</div><h1 style="${S.title}">${esc(title)}</h1>${inner}</div><div style="${S.footer}">${brand ? `Sent by ${esc(brand.name)}.` : 'You are receiving this because of activity on your myBoxStock account.<br>Please do not reply to this message.'}</div></body></html>`;

export function render(key, vars, override, brand) {
  const t = TEMPLATES[key], w = wording(key, override), url = t.button ? String(vars[t.button.to] || '') : '';
  const html = paragraphs(w.body).map(p => `<p>${fillHtml(p, vars).replace(/\n/g, '<br>')}</p>`).join('') + (url ? btn(url, w.buttonLabel) : '');
  const text = `${w.title}\n\n${fillText(w.body.replace(/\r/g, '').trim(), vars)}\n\n${url ? `${w.buttonLabel}: ${url}\n\n` : ''}— ${brand ? brand.name : 'myBoxStock'}`;
  return { subject: fillText(w.subject, vars).replace(/\s*\n\s*/g, ' ').trim(), text, html: wrap(w.title, html, brand) };
}
