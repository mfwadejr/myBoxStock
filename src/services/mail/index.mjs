// SERVICES / mail — public surface.
export { getMailSettings, saveMailSettings, DEFAULT_MAIL } from './settings.mjs';
export { enqueueMail, processQueue, startMailWorker } from './queue.mjs';
export { sendDirect, mailReady } from './direct.mjs';
