// APP / views / docs — the reseller Documentation (separate from the Host set).
(() => { AccountApp.views.docs = (main) => UI.docs(main, AccountApp.api, (t, s) => `<div class="page-head"><h1>${t}</h1><p>${s}</p></div>`); })();
