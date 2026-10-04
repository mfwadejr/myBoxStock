// TEST / mail-theme — every outbound email carries the logo, the brand name, a title and the footer, in the product's colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEMPLATES, render } from '../src/services/mail/templates.mjs';
import { EMAIL_THEME } from '../src/services/mail/theme.mjs';

const vars = { name: 'Sam', accountCode: 'BX-ABC123', login: 'sam@BX-ABC123', url: 'https://example.com/app/', trialLine: 'Your trial runs for 14 days.', link: 'https://example.com/r', ip: '1.2.3.4', device: 'Chrome on Mac', time: 'now', when: 'now', error: 'boom' };

test('every template is branded: logo, name, title, footer, product colours, and a matching plain-text part', () => {
  for (const key of Object.keys(TEMPLATES)) {
    const m = render(key, vars);
    assert.ok(m.html.includes('cid:mbs-logo'), `${key}: logo`); assert.ok(m.html.includes('>myBoxStock<'), `${key}: brand name`);
    assert.match(m.html, /<h1 [^>]*>[^<]+<\/h1>/, `${key}: title`); assert.ok(m.html.includes('Please do not reply'), `${key}: footer`);
    assert.ok(m.html.includes(EMAIL_THEME['--color-bg']) && m.html.includes(EMAIL_THEME['--color-surface']), `${key}: theme colours`);
    assert.ok(m.text.includes('myBoxStock'), `${key}: plain text`); assert.ok(!/\{\{/.test(m.html + m.text), `${key}: unfilled placeholder`);
  }
  assert.ok(fs.existsSync(new URL('../public/assets/logo-email.png', import.meta.url)), 'the email logo file exists');
});
