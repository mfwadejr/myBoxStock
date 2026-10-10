// SERVICES / demo / guard — demo accounts never send email. Every demo address is on a reserved domain that cannot deliver, and the mail code asks this file before it queues or sends.
import { log } from '../../logging/logger.mjs';
import { domain } from './plan.mjs';

export const isDemoAddress = (to) => String(to || '').trim().toLowerCase().endsWith('@' + domain);
// Called by the mail queue and by direct sending. Logs the refusal (the address is a made-up demo one, so it is safe to write).
export function noteBlocked(to, what = 'message') {
  log('mail', 'warn', 'demo.mail_blocked', `A ${what} to the demo address ${to} was not sent: demo accounts never send email`, { data: { code: 'DEMO_MAIL_BLOCKED' } });
}
