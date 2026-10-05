// HOST / icons — navigation icons. Stroke, width and color come from the .icon class (tokens), never from attributes.
window.Host = window.Host || { views: {} };
(() => {
  const svg = (inner) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  Host.icons = {
    overview: svg('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),
    pipeline: svg('<path d="M3 5h18l-7 8v6l-4-2v-4z"/>'),
    plans: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>'),
    accounts: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.6 3.1 2.3 3.5 5.2"/>'),
    backups: svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    email: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>'),
    firewall: svg('<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6z"/>'),
    security: svg('<rect x="4" y="10.5" width="16" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    settings: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>'),
    alerts: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    onboarding: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
    audit: svg('<path d="M9 11.5 11 13.5 15.5 9"/><rect x="4" y="3.5" width="16" height="17" rx="3"/>'),
    updates: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>'),
    docs: svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'),
    logs: svg('<path d="M7 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.4z"/><path d="M9 12h6M9 16h6"/>'),
  };
  Host.nav = [['overview', 'Overview'], ['alerts', 'Alerts'], ['accounts', 'Accounts'], ['pipeline', 'Pipeline'], ['onboarding', 'Onboarding'], ['plans', 'Plans'], ['backups', 'Backups'], ['email', 'Email'], ['firewall', 'Firewall'], ['security', 'Security'], ['settings', 'Settings'], ['logs', 'Logs'], ['audit', 'Audit trail'], ['updates', 'Updates'], ['docs', 'Documentation']];
})();
