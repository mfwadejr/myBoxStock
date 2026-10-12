// APP / reminders — warranty ending soon (Home list, Sales filter) and overdue demo loans: an optional "Send reminder" email to the customer, one at a time or all at once.
// The email is sent from this browser through the reseller's own mail server (or the site's), because the server cannot read the encrypted customer details. Nothing is sent by itself.
// The date of the last reminder is kept on the sale (warrantyRemindedAt) or the loan (remindedAt), inside the encrypted record.
(() => {
  const { esc, toast, sheet } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store, R = A.reminders = {};
  const DAY = 864e5, RECENT = 7 * DAY;   // "Send all" leaves out anyone reminded in the last 7 days

  R.warrantyDays = () => { const n = Number(S.config().reminders?.warrantyDays); return Number.isFinite(n) ? Math.max(0, Math.min(365, Math.round(n))) : 30; };   // 0 turns the list off
  R.ending = (now = Date.now(), days = R.warrantyDays()) => !days ? [] : S.all('sale').filter(e => { const d = e.data; return !d.voided && A.returns.state(d) !== 'full' && Number(d.warranty?.end) > now && d.warranty.end <= now + days * DAY; }).sort((a, b) => a.data.warranty.end - b.data.warranty.end);
  R.emailOfSale = (d) => String(d.customerEmail || S.get('customer', d.customerId)?.data.email || '').trim();
  R.emailOfLoan = (l) => String(l.customer?.email || S.get('customer', l.customerId)?.data.email || '').trim();
  const mail = (kind) => ({ ...C.mailCustom(kind), ...(C.ownMail() ? { smtp: C.ownMail() } : {}) });
  const when = (ts) => ts ? `Reminded ${F.day(ts)}` : '';

  // One message, then the date is kept on the record.
  R.sendWarranty = async (e) => {
    const d = e.data, to = R.emailOfSale(d); if (!to) throw new Error('This customer has no email address saved.');
    await A.api('POST', '/receipt-email/reminder', { kind: 'warranty_ending', to, customer: d.customerName, receiptNo: d.no, date: F.day(d.warranty.end), ...mail('warranty_ending') });
    await S.commit({ puts: [{ type: 'sale', id: e.id, data: { ...S.get('sale', e.id).data, warrantyRemindedAt: Date.now() } }] });
  };
  R.sendLoan = async (e, l) => {
    const to = R.emailOfLoan(l); if (!to) throw new Error('The borrower has no email address saved.');
    await A.api('POST', '/receipt-email/reminder', { kind: 'loan_overdue', to, customer: A.loans.who(l), device: C.itemLabel(e.data), date: F.day(C.dateMs(l.dueAt)), ...mail('loan_overdue') });
    const cur = S.get('item', e.id).data;
    await S.commit({ puts: [{ type: 'item', id: e.id, data: { ...cur, loans: A.loans.of(cur).map(x => x.id === l.id ? { ...x, remindedAt: Date.now() } : x) } }] });
  };
  // Send to every row that has an email and was not reminded in the last 7 days. Stops at the first failure so a mail server problem is not repeated.
  R.sendAll = async (rows, send, what) => {
    const todo = rows.filter(x => x.email && !(x.at && Date.now() - x.at < RECENT)), noMail = rows.filter(x => !x.email).length, recent = rows.filter(x => x.email && x.at && Date.now() - x.at < RECENT).length;
    if (!todo.length) return toast(`Nobody to remind${noMail ? `: ${noMail} without an email address` : ''}${recent ? `${noMail ? ',' : ':'} ${recent} reminded in the last 7 days` : ''}.`, true);
    if (!await UI.confirmBox({ title: `Send ${todo.length} reminder${todo.length === 1 ? '' : 's'}?`, body: `Each ${what} gets one email now.${noMail ? ` ${noMail} ${noMail === 1 ? 'has' : 'have'} no email address and will be skipped.` : ''}${recent ? ` ${recent} ${recent === 1 ? 'was' : 'were'} reminded in the last 7 days and will be skipped.` : ''}`, confirmLabel: 'Send' })) return;
    let sent = 0; try { for (const x of todo) { await send(x); sent++; } toast(`${sent} reminder${sent === 1 ? '' : 's'} sent`); } catch (er) { toast(`${sent} sent, then stopped: ${er.message}`, true); }
    A.route();
  };

  // ---- Home: Warranty ending soon ----
  R.homeHtml = () => {
    if (!A.can('sales.read')) return ''; const list = R.ending(); if (!list.length) return '';
    const canSend = A.can('sales.write');
    return `<div class="card mb-lg" id="warnbox"><div class="row spread wrap"><div><h3>Warranty ending soon</h3><div class="hint">Sales whose warranty ends in the next ${R.warrantyDays()} days. Reminders are optional and go out only when you press a button.</div></div>${canSend && list.length > 1 ? '<button type="button" class="btn secondary small" id="warnall">Send all reminders</button>' : ''}</div>
      <div class="tablewrap mt-sm"><table><thead><tr><th>Receipt</th><th>Customer</th><th>Ends</th><th></th></tr></thead><tbody>${list.slice(0, 8).map(e => { const d = e.data; return `<tr><td class="ident">${esc(d.no)}</td><td>${esc(d.customerName || 'Walk-in')}</td><td>${esc(F.day(d.warranty.end))}</td><td class="right">${canSend ? `<span class="hint">${esc(when(d.warrantyRemindedAt))}</span> <button type="button" class="linkbtn" data-warn="${esc(e.id)}">Send reminder</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>${list.length > 8 ? `<p class="hint mt-sm">Showing 8 of ${list.length}. <a href="#/sales" id="warnmore">See them in Sales</a>.</p>` : ''}</div>`;
  };
  R.homeWire = (main) => {
    main.querySelectorAll('[data-warn]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; try { await R.sendWarranty(S.get('sale', b.dataset.warn)); toast('Reminder sent'); A.route(); } catch (er) { toast(er.message, true); b.disabled = false; } }));
    main.querySelector('#warnall')?.addEventListener('click', () => R.sendAll(R.ending().map(e => ({ e, email: R.emailOfSale(e.data), at: e.data.warrantyRemindedAt })), (x) => R.sendWarranty(x.e), 'customer'));
    main.querySelector('#warnmore')?.addEventListener('click', () => A.salesFilter?.('soon'));
  };
  // ---- the overdue loans, used by the On demo card on Home ----
  R.overdueLoans = () => A.loans.outNow().filter(({ l }) => A.loans.overdue(l));
  R.loanAll = () => R.sendAll(R.overdueLoans().map(({ e, l }) => ({ e, l, email: R.emailOfLoan(l), at: l.remindedAt })), (x) => R.sendLoan(x.e, x.l), 'borrower');

  // ---- Settings card (Administrators) ----
  R.settingsHtml = (rc) => `<div class="card mt-lg"><h3>Reminders</h3><div class="sub">Lists on Home of warranties about to end and demo units that are overdue. Each has an optional Send reminder button; nothing is sent by itself. The wording of the two emails is under Customer emails.</div>
    <div class="field mt-md"><label for="rwd">Warranty ending soon: days before the end</label><input type="number" id="rwd" class="num" min="0" max="365" step="1" value="${esc(rc.warrantyDays)}"><div class="hint">A sale shows on Home and under Sales &gt; Ending soon this many days before its warranty ends. 0 turns the list off.</div></div></div>`;
  R.settingsWire = (main, rc) => { main.querySelector('#rwd').addEventListener('input', (e) => { rc.warrantyDays = Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0))); }); };
  R.settingsClean = (rc) => ({ warrantyDays: Math.max(0, Math.min(365, Math.round(Number(rc.warrantyDays) || 0))) });
})();
