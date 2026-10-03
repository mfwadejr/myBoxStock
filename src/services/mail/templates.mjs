// SERVICES / mail / templates — message templates ({{var}} placeholders) and the branded wrapper.
import { emailStyles as S } from './theme.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fill = (str, vars, escape) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => escape ? esc(vars[k] ?? '') : String(vars[k] ?? ''));
const btn = (href, label) => `<p><a style="${S.button}" href="${href}">${label}</a></p>`;

export const TEMPLATES = {
  test: { subject: 'myBoxStock test email', text: 'This is a test message from your myBoxStock server. Outbound email is working.', html: '<p>This is a test message from your myBoxStock server.</p><p>Outbound email is working.</p>' },
  welcome: { subject: 'Welcome to myBoxStock — your account ID is {{accountCode}}',
    text: 'Hi {{name}},\n\nYour account is ready. Your account ID is {{accountCode}}.\nSign in with: {{login}}\n\n{{trialLine}}\n\n{{url}}',
    html: `<p>Hi {{name}},</p><p>Your account is ready.</p><p>Account ID: <b>{{accountCode}}</b><br>Sign in with: <b>{{login}}</b></p><p>{{trialLine}}</p>${btn('{{url}}', 'Open myBoxStock')}` },
  trial_ended: { subject: 'Your myBoxStock trial has ended',
    text: 'Hi {{name}},\n\nThe free trial for account {{accountCode}} has ended. Your data is safe and the account is now read-only: you can still sign in and look at everything, but changes are paused.\nReply to this email or contact support to continue.',
    html: '<p>Hi {{name}},</p><p>The free trial for account <b>{{accountCode}}</b> has ended. Your data is safe and the account is now read-only: you can still sign in and look at everything, but changes are paused.</p><p>Contact support to continue.</p>' },
  new_sign_in: { subject: 'New sign-in to your myBoxStock account',
    text: 'Hi {{name}},\n\nYour account was just signed in to from a new address.\n\nAddress: {{ip}}\nDevice: {{device}}\nTime: {{time}}\n\nIf this was you, no action is needed. If not, change your password right away and tell your account administrator.',
    html: '<p>Hi {{name}},</p><p>Your account was just signed in to from a new address.</p><p>Address: <b>{{ip}}</b><br>Device: <b>{{device}}</b><br>Time: <b>{{time}}</b></p><p>If this was you, no action is needed. If not, change your password right away and tell your account administrator.</p>' },
  password_reset: { subject: 'Reset your myBoxStock password',
    text: 'Hi {{name}},\n\nUse this link to choose a new password (valid for 1 hour):\n{{link}}\n\nIf you did not ask for this, ignore this email.',
    html: `<p>Hi {{name}},</p><p>Use the button below to choose a new password. The link is valid for 1 hour.</p>${btn('{{link}}', 'Choose a new password')}<p style="${S.faint}">If you did not ask for this, you can ignore this email.</p>` },
  mfa_reset: { subject: 'Two-factor authentication was reset on your account',
    text: 'Hi {{name}},\n\nA support administrator reset two-factor authentication on your account. Sign in and set it up again from Security settings.\nIf this was unexpected, contact support.',
    html: '<p>Hi {{name}},</p><p>A support administrator reset two-factor authentication on your account. Sign in and set it up again from Security settings.</p>' },
  temp_password: { subject: 'Your temporary myBoxStock password',
    text: 'Hi {{name}},\n\nA support administrator set a temporary password for your account. You will be asked to change it when you sign in.\nSign in: {{url}}',
    html: `<p>Hi {{name}},</p><p>A support administrator set a temporary password for your account. You will be asked to change it when you sign in.</p>${btn('{{url}}', 'Sign in')}` },
};
const wrap = (inner) => `<!doctype html><html><body style="${S.body}"><div style="${S.card}"><div style="${S.brand}">myBoxStock</div>${inner}</div></body></html>`;

export function render(template, vars) {
  const t = TEMPLATES[template]; if (!t) throw new Error('Unknown template ' + template);
  return { subject: fill(t.subject, vars, false), text: fill(t.text, vars, false), html: wrap(fill(t.html, vars, true)) };
}
