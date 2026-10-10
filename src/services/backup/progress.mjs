// SERVICES / backup / progress — lets the streaming code (crypt, bundle, offsite) report how far it has got without knowing about jobs.
// A background job (jobs.mjs) runs its work inside a context; outside a job every call here does nothing.
import { AsyncLocalStorage } from 'node:async_hooks';

export const jobContext = new AsyncLocalStorage();
// Names the step now running and the share of the whole job (0 to 100) it covers: jobStep('Opening the file', 20, 70).
export const jobStep = (text, from, to) => jobContext.getStore()?.step(text, from, to);
// Bytes done of bytes total inside the current step; moves the bar within the step's share.
export const jobBytes = (done, total) => jobContext.getStore()?.bytes(done, total);
// True once someone has asked the running job to stop; a job that can stop checks this between its units of work and ends tidily.
export const jobStopRequested = () => !!jobContext.getStore()?.stopRequested?.();
