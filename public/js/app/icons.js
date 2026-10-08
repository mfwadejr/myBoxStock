// APP / icons — menu icons (stroke, width and colour come from the .icon class).
(() => {
  const svg = (inner) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  AccountApp.icons = {
    home: svg('<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>'),
    sell: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2.5l2.2 11h10l2-8H7"/>'),
    inventory: svg('<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>'),
    customers: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.6 3.1 2.3 3.5 5.2"/>'),
    sales: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
    team: svg('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.6-3.4 3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M19 8v6M16 11h6"/>'),
    settings: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>'),
    backup: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>'),
    activity: svg('<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>'),
    security: svg('<rect x="4" y="10.5" width="16" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    camera: svg('<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'),
    support: svg('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M9 8.5h6M9 11.5h4"/>'),
    docs: svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'),
  };
})();
