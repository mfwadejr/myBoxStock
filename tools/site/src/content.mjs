// TOOLS / site / content — the two lists the site's Available today and Coming soon sections are made from.
//
// AVAILABLE: only what is built in the app this site describes. Each entry's `ships` names the app file and a word that file contains, and test/site.test.mjs checks
// both, so an entry cannot describe something the app does not have. Add an entry only after the feature ships.
//
// COMING_SOON: items the owner has approved for public mention. Add an item with one line: { title: 'Plain-language name', text: 'One sentence.' }.
// Rules: no dates, no prices, no promises. While the list is empty the whole Coming soon section (heading and lead-in) is left out of the page.
// test/site.test.mjs fails if an item carries a date or a banned phrase.
export const COMING_SOON = [
];

export const AVAILABLE = [
  { id: 'inventory', kicker: 'Inventory', h: 'Know every device on your shelf', shot: 'inventory', alt: 'The Inventory page with test and status chips',
    body: ['Add devices one at a time, by quantity, or by importing a spreadsheet. Choose which details you track (UID, serial number, MAC address, condition, supplier and your own), and tick off a test checklist on every device.', 'Bulk scan lets you point your phone camera at a stack of labels and read the serial number, MAC address or UID of each box in turn.'],
    ticks: ['Bulk scan with the phone camera', 'Statuses: Available, Reserved, Sold, Returned, Damaged and Archived', 'A reorder level for each model, and a Running low card on Home that shows what to buy next, most urgent first', 'Search by any identifier; export to a spreadsheet whenever you like'],
    ships: [['public/js/app/views/inventory.js', 'Bulk scan'], ['public/js/app/views/home-low.js', 'Running low']] },
  { id: 'quick-sale', kicker: 'Quick sale', h: 'Sell in a few taps', shot: 'quick-sale', alt: 'Quick sale with devices in the cart and a customer picked',
    body: ['Scan or type an ID, or pick from what is in stock. Set the price, take a percentage off a line or the whole order, choose the customer, the warranty and how they paid, then print or email the receipt.'],
    ticks: ['Back-date a sale to the day it really happened', 'Your own payment methods and warranty periods', 'Add a new customer without leaving the sale', 'Receipts that carry the warranty and, if you choose, the test record'],
    ships: [['public/js/app/views/sell.js', 'Quick sale']] },
  { id: 'delivery', kicker: 'Delivery and shipping', h: 'Immediate, shipped, pickup or meet', shot: 'delivery', alt: 'Quick sale with Delivery set to Shipping and the ship-to fields open',
    body: ['Choose how each sale is handed over. Shipping adds the ship-to address, the fee you charge and, for your own profit figures, what the shipping cost you. Track carrier and tracking number, find everything still to ship, and mark it shipped.', 'Print an address label in the browser: 4x6 inch, half sheet or full page, with your logo, return address, order number and a delivery note. Your own shipping cost never appears on a receipt or a label.'],
    ticks: ['Immediate, Shipping, Pickup and Meet on every sale', 'A To ship list, with Mark shipped', 'Printable labels, one at a time or a batch', 'Postage is handled outside the app: you pay it elsewhere and enter the tracking number'],
    ships: [['public/js/app/delivery.js', 'Shipping'], ['public/js/app/label.js', 'Delivery note'], ['public/js/app/views/sales.js', 'Mark shipped']] },
  { id: 'returns', kicker: 'Returns and refunds', h: 'Record what came back', shot: 'returns', alt: 'The Return or refund sheet on a sale',
    body: ['Pick which devices came back, the reason and what happens to each one: back in stock, Returned or Damaged. Record the refund, a restocking fee if you charge one, and how you paid it back. The original sale stays on record, and your totals show refunds separately.', 'A credit note can be printed or emailed, and never shows your costs.'],
    ticks: ['Full or partial returns, on shipped sales too', 'Administrators decide whether Standard users may process returns, and set an approval limit', 'Void stays for plain mistakes'],
    ships: [['public/js/app/returns.js', 'Return or refund']] },
  { id: 'customers', kicker: 'Customers', h: 'Remember who bought what', shot: 'customers', alt: 'The Customers page with search and sort',
    body: ['Every customer has one page with all their purchases, shipments and refunds, their saved address, notes and what they have spent. Search by name, phone, email, address, receipt number or tracking number.'],
    ticks: ['Saved addresses pre-fill the ship-to on the next sale', 'Sort and quick filters, kept while you work', 'Export one customer, or erase them for a privacy request'],
    ships: [['public/js/app/views/customers.js', 'Search customers']] },
  { id: 'sales', kicker: 'Sales and profit', h: 'Proof, and the numbers behind it', shot: 'sales', alt: 'The Sales page with totals and delivery tags',
    body: ['Every sale is a receipt with the devices, identifiers, price, payment method and warranty countdown. Filter by dates, delivery or warranty, and see sales, revenue and profit for the period, net of refunds.'],
    ticks: ['Search by serial, customer, payment method or receipt', 'Delivery tags and a To ship filter', 'Export the list to a spreadsheet'],
    ships: [['public/js/app/views/sales.js', 'Profit']] },
  { id: 'team', kicker: 'Team', h: 'Let people help, safely', shot: 'team', alt: 'The Team page with three user types',
    body: ['Add the people who work with you, each with their own sign-in. Administrators can do everything; Standard users work with inventory, customers and sales; View users can look but not change anything.'],
    ticks: ['Administrator, Standard and View', 'A discount limit for Standard users', 'Switch a person off without touching anyone else'],
    ships: [['public/js/app/views/team.js', 'Reset access']] },
  { id: 'security', kicker: 'Activity and security', h: 'See who did what', shot: '', alt: '',
    body: ['The activity log shows who signed in, from which device and when, and lets you sign a device out. Each person can turn on two-step sign-in with an authenticator app.'],
    ticks: ['Sign-in history and active sessions', 'Optional two-step sign-in for every person', 'Sign-in alerts when email is set up on the site'],
    ships: [['public/js/app/views/activity.js', 'Activity'], ['public/js/app/views/security.js', 'Two-factor']] },
  { id: 'backup', kicker: 'Backup and restore', h: 'Your own copy, proven to work', shot: 'backup', alt: 'The Backup and restore page',
    body: ['Back up now saves one encrypted file of the whole account. Test a backup file opens it in your browser and tells you, check by check, whether it is good, without changing anything. When you need it, Restore shows what is inside first.'],
    ticks: ['Backups you hold yourself', 'A recovery key you save when you set up', 'Spreadsheet exports of inventory, customers and sales'],
    ships: [['public/js/app/views/backup.js', 'Test a backup file']] },
  { id: 'get-set-up', kicker: 'Get set up', h: 'A short checklist for day one', shot: '', alt: '',
    body: ['Home shows a Get set up checklist: add your first device, check your payment methods, make your first sale, add a team member, make and test a backup, and save your recovery key. Each step ticks itself off.'],
    ticks: ['Visible to Administrators', 'Dismiss it when you are done'],
    ships: [['public/js/app/views/firstrun.js', 'Get set up']] },
  { id: 'support', kicker: 'Support', h: 'Help inside the app', shot: '', alt: '',
    body: ['Documentation is built in, with a page for every screen and a search box. Signed-in resellers can also send a support ticket from inside the app, with screenshots, and follow the replies there.'],
    ticks: ['Documentation in plain language', 'Support tickets, with replies in the app'],
    ships: [['public/js/app/views/support.js', 'ticket']] },
  { id: 'private', kicker: 'Privacy', h: 'Encrypted in your browser', shot: '', alt: '',
    body: ['Your inventory, customers, sales and receipts are encrypted in your own browser before they reach the server. The people who run myBoxStock cannot read them. You own your data and you are responsible for it, for your recovery key and for your own backups.'],
    ticks: ['Zero-knowledge by design', 'You hold the key'],
    ships: [['public/js/shared/vault.js', 'PBKDF2']] },
];
