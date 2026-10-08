// SERVICES / audit-types — which log events make up the audit trail. To add a kind of entry, add one row here (and nothing else).
// A row: { group, label, area, events: [...], hostRealm? }. hostRealm limits sign-in events to the Host Console (never reseller sign-ins).
// The first group, 'actions', is every event in the host and accounts areas that has a named administrator (settings, accounts, admins...).
export const ACTION_AREAS = ['host', 'accounts'];

export const AUDIT_GROUPS = [
  { id: 'actions', label: 'Settings and accounts' },
  { id: 'firewall', label: 'Firewall and access' },
  { id: 'blocks', label: 'Bans and lockouts' },
  { id: 'signins', label: 'Host Console sign-ins' },
  { id: 'twofactor', label: 'Two-factor' },
  { id: 'backups', label: 'Backups' },
  { id: 'support', label: 'Support tickets' },
  { id: 'retention', label: 'Data and retention' },
];

export const AUDIT_TYPES = [
  { group: 'firewall', label: 'Firewall rule added', area: 'security', events: ['rule.added'] },
  { group: 'firewall', label: 'Firewall rule changed', area: 'security', events: ['rule.toggled'] },
  { group: 'firewall', label: 'Firewall rule removed', area: 'security', events: ['rule.removed'] },
  { group: 'firewall', label: 'Rate-limit settings changed', area: 'security', events: ['limits.changed'] },
  { group: 'firewall', label: 'Host Console access limit changed', area: 'security', events: ['host_access.changed'] },
  { group: 'blocks', label: 'Ban created', area: 'security', events: ['ban.created'] },
  { group: 'blocks', label: 'Ban lifted', area: 'security', events: ['ban.lifted'] },
  { group: 'blocks', label: 'Sign-in unlocked', area: 'security', events: ['lockout.lifted'] },
  { group: 'blocks', label: 'Host Console sign-in locked', area: 'auth', events: ['lockout.started'], hostRealm: true },
  { group: 'signins', label: 'Host Console sign-in', area: 'auth', events: ['login.ok'], hostRealm: true },
  { group: 'signins', label: 'Host Console failed sign-in', area: 'auth', events: ['login.failed', 'login.blocked', 'mfa.failed'], hostRealm: true },
  { group: 'signins', label: 'Host Console sign-out', area: 'auth', events: ['logout'], hostRealm: true },
  { group: 'twofactor', label: 'Two-factor turned on', area: 'auth', events: ['mfa.enabled'], hostRealm: true },
  { group: 'twofactor', label: 'Two-factor turned off', area: 'auth', events: ['mfa.disabled'], hostRealm: true },
  { group: 'twofactor', label: 'Two-factor recovery code used', area: 'auth', events: ['mfa.recovery_used'], hostRealm: true },
  { group: 'backups', label: 'Backup made', area: 'host', events: ['backup.run'] },
  { group: 'backups', label: 'Backup restored', area: 'host', events: ['backup.restore'] },
  { group: 'backups', label: 'Backup downloaded', area: 'host', events: ['backup.download'] },
  { group: 'backups', label: 'Backup deleted', area: 'host', events: ['backup.delete'] },
  { group: 'backups', label: 'Backup test restore', area: 'host', events: ['backup.test_restore'] },
  { group: 'backups', label: 'Backup file uploaded for testing', area: 'host', events: ['backup.file_upload'] },
  { group: 'backups', label: 'Backup file tested', area: 'host', events: ['backup.file_test'] },
  { group: 'backups', label: 'Backup destination saved', area: 'host', events: ['backup.destination_saved'] },
  { group: 'backups', label: 'Backup destination removed', area: 'host', events: ['backup.destination_deleted'] },
  { group: 'backups', label: 'Backup destination tested', area: 'host', events: ['backup.destination_test'] },
  { group: 'backups', label: 'Backup settings changed', area: 'host', events: ['backup.settings_saved'] },
  { group: 'backups', label: 'Backup passphrase checked', area: 'host', events: ['backup.passphrase_check'] },
  { group: 'backups', label: 'Backup passphrase changed', area: 'host', events: ['backup.passphrase_change'] },
  { group: 'backups', label: 'Backup passphrase reset', area: 'host', events: ['backup.passphrase_reset'] },
  { group: 'backups', label: 'Backup setup step done', area: 'host', events: ['backup.setup_passphrase', 'backup.setup_where', 'backup.setup_keep', 'backup.setup_prove'] },
  { group: 'support', label: 'Ticket opened by the Host', area: 'host', events: ['support.viewed'] },
  { group: 'support', label: 'Ticket reply sent', area: 'host', events: ['support.reply'] },
  { group: 'support', label: 'Internal note added', area: 'host', events: ['support.note'] },
  { group: 'support', label: 'Ticket status changed', area: 'host', events: ['support.status'] },
  { group: 'support', label: 'Ticket priority or category changed', area: 'host', events: ['support.priority', 'support.category'] },
  { group: 'support', label: 'Ticket assigned', area: 'host', events: ['support.assign'] },
  { group: 'support', label: 'Ticket closed automatically', area: 'host', events: ['support.auto_closed'] },
  { group: 'support', label: 'Support settings changed', area: 'host', events: ['support.settings'] },
  { group: 'support', label: 'Host note on a reseller saved', area: 'host', events: ['support.account_note'] },
  { group: 'retention', label: 'Retention rule changed', area: 'host', events: ['retention.rule'] },
  { group: 'retention', label: 'Automatic pruning changed', area: 'host', events: ['retention.auto'] },
  { group: 'retention', label: 'Data pruned', area: 'host', events: ['retention.pruned'] },
  { group: 'retention', label: 'Database compacted', area: 'host', events: ['retention.compacted'] },
  { group: 'retention', label: 'Retention change refused', area: 'host', events: ['retention.refused'] },
  { group: 'support', label: 'Closed tickets purged', area: 'host', events: ['support.purge'] },
];


// SQL for "this event row belongs to the audit trail" (optionally only one group). Parameters are returned in order.
export function auditScope(group = '') {
  const parts = [], params = [];
  if (!group || group === 'actions') { parts.push(`(e.area IN (${ACTION_AREAS.map(() => '?').join(',')}) AND e.actor IS NOT NULL AND e.actor <> '' AND e.event NOT LIKE 'backup.%' AND e.event NOT LIKE 'support.%' AND e.event NOT LIKE 'retention.%')`); params.push(...ACTION_AREAS); }
  for (const t of AUDIT_TYPES.filter(x => !group || x.group === group)) {
    parts.push(`(e.area = ? AND e.event IN (${t.events.map(() => '?').join(',')})${t.hostRealm ? ` AND e.raw LIKE '%"realm":"host"%'` : ''})`); params.push(t.area, ...t.events);
  }
  return { sql: parts.length ? `(${parts.join(' OR ')})` : '1 = 0', params };
}
export const labelOf = (area, event) => AUDIT_TYPES.find(t => t.area === area && t.events.includes(event))?.label || '';
