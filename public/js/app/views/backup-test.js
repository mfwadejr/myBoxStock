// APP / views / backup-test — "Test a backup file": checks a .mbsbackup in the browser and shows what is inside and how it compares with the account now.
// Nothing is restored, changed or sent. The file never leaves this device, so the host sees nothing. Allowed for read-only accounts (it only reads).
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, F = A.fmt, E = A.backupEngine, BF = A.backupFile;
  const chip = (ok) => ok === true ? '<span class="chip green">Passed</span>' : ok === false ? '<span class="chip red">Failed</span>' : '<span class="chip">Not checked</span>';
  const checkRow = (c) => `<div class="setting"><div><div class="setting-title">${esc(c.label)}</div>${c.ok === true && c.detail ? `<div class="setting-desc">${esc(c.detail)}</div>` : ''}</div>${chip(c.ok)}</div>`;
  const row = (label, a, b) => `<span>${esc(label)}</span><span class="tab-num">${a}</span><span class="tab-num">${b}</span>`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const KINDS = [['devices', 'Devices'], ['customers', 'Customers'], ['sales', 'Sales'], ['other', 'Other records']];

  const inside = (parsed, recs, team, cmp) => {
    const m = parsed.manifest, fc = m.counts, now = { devices: 0, customers: 0, sales: 0 };
    for (const r of recs) { if (r.type === 'item') now.devices++; else if (r.type === 'customer') now.customers++; else if (r.type === 'sale') now.sales++; }
    const filePeople = parsed.team, hasTeam = Array.isArray(filePeople);
    const tc = hasTeam ? BF.compareTeam(filePeople, team) : null;
    const kinds = KINDS.filter(([k]) => k !== 'other' || Object.values(cmp.by.other).some(Boolean));
    const older = cmp.older, missing = cmp.total.missing;
    const verdict = older ? { cls: '', text: `This file is older than your latest changes. Your account has ${plural(cmp.total.added, 'record', 'records')} added and ${plural(cmp.total.changed, 'record', 'records')} changed since it was made. “Replace everything” would lose that newer work.` }
      : missing ? { cls: ' blue', text: `Your account is missing ${plural(missing, 'record', 'records')} that this file still has. “Add what is missing” would bring them back.` }
      : { cls: ' blue', text: 'This file matches your account as it is now.' };
    return `<h3 class="mt-xl">What is inside</h3>
      <p class="sub mb-0">Made ${esc(F.when(m.createdAt))}${parsed.header.app ? ` with myBoxStock ${esc(parsed.header.app)}` : ''}.</p>
      <div class="compare"><span></span><b>In the file</b><b>In your account now</b>${row('Devices', fc.devices, now.devices)}${row('Customers', fc.customers, now.customers)}${row('Sales', fc.sales, now.sales)}${hasTeam ? row('Team members', filePeople.length, team.length) : ''}</div>
      ${hasTeam && filePeople.length ? `<p class="hint" id="tt">Team members in the file: ${esc(BF.teamText(filePeople))}. ${tc.already} already in your account, ${tc.wouldAdd} would be added as pending invitations.</p>` : ''}
      ${hasTeam ? '' : '<p class="hint" id="tt">This file has no team list.</p>'}
      <h3 class="mt-xl">Compared with your account now</h3>
      <table id="cmp"><thead><tr><th>Records</th><th>Added since</th><th>Changed since</th><th>Missing now</th><th>Unchanged</th></tr></thead><tbody>${kinds.map(([k, label]) => { const g = cmp.by[k]; return `<tr><td data-label="">${esc(label)}</td><td class="tab-num" data-label="Added since">${g.added}</td><td class="tab-num" data-label="Changed since">${g.changed}</td><td class="tab-num" data-label="Missing now">${g.missing}</td><td class="tab-num" data-label="Unchanged">${g.same}</td></tr>`; }).join('')}</tbody></table>
      <p class="hint">Added since: in your account but not in the file (made after it). Missing now: in the file but not in your account.</p>
      <div class="banner${verdict.cls} mt-md" id="vd">${esc(verdict.text)}</div>`;
  };

  // Tests one file. Returns when the person closes the sheet.
  A.testBackupFile = async (file) => {
    let result, against;
    try {
      toast('Testing the file…');
      result = await BF.check(await file.text(), { adk: A.vault.adk, accountCode: A.me.accountCode, records: true });
      if (result.parsed) against = await E.testAgainst();
    } catch (e) { return sheet(`<h2>The test could not run</h2><p class="muted">${esc(e.message)}</p><div class="actions"><button class="btn" data-cancel>OK</button></div>`); }
    const failed = result.steps.find(s => s.ok === false), p = result.parsed;
    if (!failed && p) A.firstRunTested();
    const banner = failed ? `<div class="banner red mb-md" id="sm"><b>This file failed a check, so it cannot be used.</b> ${esc(failed.message)} Nothing was restored or changed.</div>`
      : `<div class="banner blue mb-md" id="sm"><b>This file passed every check.</b> Nothing was restored, changed or sent.</div>`;
    return sheet(`<h2>Test a backup file</h2><p class="sub">${esc(file.name || 'Backup file')}</p>${banner}<div id="ck">${result.steps.map(checkRow).join('')}</div>
      ${p ? inside(p, against.recs, against.team, BF.compare(p, against.recs)) : ''}
      <div class="actions"><button class="btn" data-cancel>Done</button></div>`, { wide: true });
  };
})();
