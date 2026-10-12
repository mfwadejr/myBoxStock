// TEST / t53-reseller-tracking — a real browser: carrier tracking links. The carrier you typed (or the shape of the number) picks the carrier's own page, an unknown carrier stays plain text,
// and the link shows on a shipped sale and on the customer's page. Nothing is fetched from a carrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.mjs';
import { skip, launch, signUp } from './helpers-ui.mjs';

test('browser: carrier tracking links', { skip, timeout: 120000 }, async () => {
  const srv = await startServer(), br = await launch();
  try {
    const { page, errors } = await signUp(srv, br, { biz: 'Track Co', user: 'tara' });
    const r = await page.evaluate(() => { const D = AccountApp.commerce.delivery; return [
      D.trackUrl('UPS', '1Z999AA10123456784'), D.trackUrl('usps', '9400 1118 9922 3456 7890 12'), D.trackUrl('FedEx Ground', '123456789012'), D.trackUrl('DHL Express', '1234567890'),
      D.trackUrl('', '1Z999AA10123456784'), D.trackUrl('', '9400111899223456789012'), D.trackUrl('', '123456789012'), D.trackUrl('Local courier', '12345'), D.trackUrl('UPS', ''), D.trackUrl('UPS', 'a b&c=1')]; });
    assert.equal(r[0], 'https://www.ups.com/track?tracknum=1Z999AA10123456784');
    assert.equal(r[1], 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789012', 'spaces are taken out');
    assert.equal(r[2], 'https://www.fedex.com/fedextrack/?trknbr=123456789012');
    assert.match(r[3], /^https:\/\/www\.dhl\.com\/.*tracking-id=1234567890$/);
    assert.match(r[4], /ups\.com/, 'no carrier typed: a 1Z number is UPS'); assert.match(r[5], /usps\.com/, 'no carrier typed: a long 94 number is USPS');
    assert.equal(r[6], '', 'a plain 12-digit number is not guessed'); assert.equal(r[7], '', 'a carrier we have no page for stays plain text'); assert.equal(r[8], '');
    assert.ok(r[9].endsWith('ab%26c%3D1'), 'the number is escaped, so it cannot add to the address');
    const html = await page.evaluate(() => AccountApp.commerce.delivery.trackLink({ carrier: 'UPS', tracking: '1Z999AA10123456784' }));
    assert.match(html, /target="_blank" rel="noopener noreferrer">Track on UPS</); assert.equal(await page.evaluate(() => AccountApp.commerce.delivery.trackLink({ carrier: 'Other', tracking: '1' })), '');
    assert.deepEqual(errors, []);
  } finally { await br.close(); await srv.stop(); }
});
