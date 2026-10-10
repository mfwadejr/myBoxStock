// APP / export — take your data with you: everything in one zip, or one customer's records. Built in the browser; the server never sees the files.
// Also erasing one customer's personal details (for a deletion request) while keeping the sales history intact.
(() => {
  const { toast } = UI, A = AccountApp, C = A.commerce, F = A.fmt, S = A.store;
  const stamp = () => F.ymd(Date.now());
  const csv = (t) => '﻿' + C.toCsv(t.headers, t.rows);
  const slug = (s) => String(s || 'customer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'customer';

  const customersTable = () => ({ headers: ['name', 'phone', 'email', 'notes', 'created', 'purchases', 'spent', ...C.delivery.addrHeaders],
    rows: S.all('customer').map(e => { const s = C.salesOf(e.id); return [e.data.name, e.data.phone || '', e.data.email || '', e.data.notes || '', e.data.createdAt ? new Date(e.data.createdAt).toISOString() : '', s.length, F.dollars(s.reduce((t, x) => t + A.returns.net(x.data).revenue, 0)), ...C.delivery.addrRow(e.data.address)]; }) });
  // Reorder levels live in their own records (one per model), not in the settings, so they get their own file.
  const modelsTable = () => ({ headers: ['model', 'reorder_level'], rows: S.all('model').map(e => [e.data.name, e.data.reorder ?? '']).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
  A.modelsTable = modelsTable;
  // One row per device on each sale, so nothing a receipt shows is lost.
  const saleLines = (entries) => ({ headers: ['receipt', 'date', 'customer', 'device', 'price', 'details', 'returned'],
    rows: entries.flatMap(e => e.data.items.map(it => [e.data.no, new Date(e.data.ts).toISOString(), e.data.customerName || '', C.itemLabel(it), F.dollars(it.price), (it.fields || []).map(x => `${x.label}: ${x.value}`).join('; '), A.returns.doneIds(e.data).has(it.id) ? 'yes' : ''])) });

  A.exportEverything = () => {
    const sales = S.all('sale').sort((a, b) => a.data.ts - b.data.ts), cfg = S.config();
    const files = [
      { name: 'README.txt', text: `myBoxStock export for ${A.me.businessName} (Reseller ID ${A.me.accountCode})\r\nCreated ${new Date().toISOString()} in your browser. Nothing in this file passed through the server.\r\n\r\ninventory.csv   every device, with test results\r\ncustomers.csv   your customers\r\nsales.csv       every sale, including voided ones\r\nsale_items.csv  one row for each device on each sale\r\nreturns.csv     every return and refund, with the credit note number\r\nmodels.csv      the reorder level you set for each model\r\nsettings.json   your fields, test steps, warranty periods and catalogue\r\n\r\nThe CSV files open in Excel, Numbers and Google Sheets.\r\n` },
      { name: 'inventory.csv', text: csv(A.inventoryTable()) }, { name: 'customers.csv', text: csv(customersTable()) },
      { name: 'sales.csv', text: csv(A.salesTable(sales)) }, { name: 'sale_items.csv', text: csv(saleLines(sales)) }, { name: 'returns.csv', text: csv(A.returns.table(sales)) }, { name: 'models.csv', text: csv(modelsTable()) },
      { name: 'settings.json', text: JSON.stringify(cfg, null, 2) },
    ];
    UI.downloadBlob(`myboxstock-${slug(A.me.businessName)}-${stamp()}.zip`, UI.zip(files));
    A.api('POST', '/account/export-note', {}).catch(() => {});
    return files.length;
  };

  // One person's details and purchases, for a data-access request.
  A.exportCustomer = (e) => {
    const sales = S.all('sale').filter(s => s.data.customerId === e.id).sort((a, b) => a.data.ts - b.data.ts);
    const d = e.data, files = [
      { name: 'customer.csv', text: csv({ headers: ['name', 'phone', 'email', 'notes', 'created', ...C.delivery.addrHeaders], rows: [[d.name, d.phone || '', d.email || '', d.notes || '', d.createdAt ? new Date(d.createdAt).toISOString() : '', ...C.delivery.addrRow(d.address)]] }) },
      { name: 'purchases.csv', text: csv(A.salesTable(sales)) }, { name: 'purchase_items.csv', text: csv(saleLines(sales)) }, { name: 'returns.csv', text: csv(A.returns.table(sales)) },
    ];
    UI.downloadBlob(`customer-${slug(d.name)}-${stamp()}.zip`, UI.zip(files)); toast('Exported ' + (d.name || 'customer'));
  };

  // Removes the person's details from the customer record and from their sales; totals and receipt numbers stay so the books still add up.
  A.eraseCustomer = async (e) => {
    const ok = await UI.confirmBox({ title: 'Erase this customer?', body: 'Their name, phone, email, address and notes are removed, here and on their past sales (including where a parcel was sent and the notes on any return). The sales stay (totals and receipt numbers) and show “Erased customer”. This cannot be undone. Export them first if they asked for a copy.', confirmLabel: 'Erase', danger: true, typeToConfirm: 'ERASE' });
    if (!ok) return false;
    const sales = S.all('sale').filter(s => s.data.customerId === e.id);
    await S.commit({ puts: sales.map(s => ({ type: 'sale', id: s.id, data: { ...s.data, customerId: null, customerName: 'Erased customer', customerEmail: '', customerErased: true, ...(s.data.delivery ? { delivery: C.delivery.erased(s.data.delivery) } : {}), ...(Array.isArray(s.data.returns) && s.data.returns.length ? { returns: s.data.returns.map(r => ({ ...r, note: '', retTracking: '' })) } : {}), ...(s.data.returnAsk ? { returnAsk: { ...s.data.returnAsk, note: '' } } : {}) } })), deletes: [{ type: 'customer', id: e.id }] });
    A.api('POST', '/account/erase-note', { sales: sales.length }).catch(() => {});
    toast('Customer erased'); return true;
  };
})();
