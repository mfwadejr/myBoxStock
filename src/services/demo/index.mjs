// SERVICES / demo — public surface of Demo mode (settings, planning, building, removing, credentials, the backup gate and the email guard).
export * from './settings.mjs';
export { planAccount, estimate, codeOf, domain, bigIndexes } from './plan.mjs';
export { buildSet, checkBuild, nameClashes, genPassword, planCeiling } from './build.mjs';
export { builtStats, demoTotals, previewRemove, removeAccounts, removeWithAudit } from './remove.mjs';
export { credentialRows, passwordOf, resetPassword, makeTicket, redeemTicket } from './credentials.mjs';
export { backupState, requireBackup, OVERRIDE_TEXT } from './backup-gate.mjs';
export { isDemoAddress, noteBlocked } from './guard.mjs';
export { stripDemoFromSnapshot } from './strip.mjs';
export { startBuild, startRemove, startReset } from './jobs.mjs';
export { coded, audit } from './audit.mjs';
export { canManage } from './roles.mjs';
