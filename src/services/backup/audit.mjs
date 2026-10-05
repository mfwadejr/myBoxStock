// SERVICES / backup / audit — writes backup actions to the Host audit trail (event log, area "host"). Names only; never a secret or any account data.
import { log } from '../../logging/logger.mjs';

// event: backup.run, backup.restore, backup.download, backup.delete, backup.test_restore, backup.destination_saved, backup.destination_deleted …
export const audit = (event, message, { actor = 'scheduler', ip = null, level = 'info', data = null } = {}) => log('host', level, event, message, { actor, ip, data });
