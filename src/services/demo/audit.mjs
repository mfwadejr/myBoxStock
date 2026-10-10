// SERVICES / demo / audit — writes Demo mode actions to the Host audit trail (event log, area "host"). Names, counts and set names only; never a password.
import { log } from '../../logging/logger.mjs';
import { MSG } from '../../core/messages.mjs';

// An Error that carries one of the codes in core/messages.mjs; routes turn it into fail(res, status, code).
export const coded = (code, extra = {}) => Object.assign(new Error(MSG[code] || code), { code, ...extra });
// event: demo.enabled, demo.build, demo.remove, demo.password_show ... (see services/audit/types.mjs)
export const audit = (event, message, { actor = 'System', ip = null, level = 'info', data = null } = {}) => log('host', level, event, message, { actor, ip, data });
