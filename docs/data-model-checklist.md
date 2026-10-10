# myBoxStock data-model checklist (v0.25.0)

Every stored field, where it is saved, and which backup, export and import path covers it. Updated at every release. `test/t48-field-guard.test.mjs` reads this file and FAILS when a field the app saves is not listed here, or a listed field has no coverage, so a new field cannot be added without deciding how it is backed up and exported.

How to update it: add a row for each new stored field (the Field column is `record.path`), fill in all three coverage columns, and run `node --test test/t48-field-guard.test.mjs`.

## The paths

| Path | What it is | Covers |
| --- | --- | --- |
| Backup (B) | Reseller backup file (`.mbsbackup`), restore (add what is missing, or replace everything), Test a backup file, Undo last restore | Every reseller record exactly as the server holds it, sealed with the account key. A new field inside an existing record is covered automatically. A new record TYPE needs code in `public/js/app/backup-file.js` (counts) and `src/routes/app` (allowed types). |
| Team (M) | Team-member restoration on restore | Username, email and role only. Passwords, two-factor secrets and sessions are never in a file. Restored people come back as pending invitations. |
| Export (X) | Security > Export everything (zip made in the browser), and one customer's export | `file:column` names the CSV and the column. `settings.json` holds the whole account settings record. A dash means the field is not exported and the reason is given. |
| Import (I) | Inventory > Import CSV (devices only; there is no customer or sales import) | `yes` when the column is read on import. Sales, customers, returns and settings are restored only from a backup file. |
| Host (H) | Host full-site backup (`.mbsbak`), offsite copy, snapshots, restore, Test a backup file (Host) | The whole database file, including the encrypted records, so every row below is covered. Demo mode accounts are left out of full-site backups and offsite copies (see the Host section). |

Rules that always hold: every field below sits inside an encrypted record (type `item`, `customer`, `model`, `sale` or `config`), so the Host sees only the record type, size and times. The backup file never contains passwords, two-factor secrets, sessions or the server key.

## Reseller records

### Device (record type `item`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `item.uid` | UID (core field) | yes | inventory.csv:UID | yes |
| `item.serial` | Serial number (core field) | yes | inventory.csv:Serial number | yes |
| `item.mac` | MAC address (core field) | yes | inventory.csv:MAC address | yes |
| `item.cond` | Condition (core field) | yes | inventory.csv:Condition | yes |
| `item.supplier` | Supplier (core field) | yes | inventory.csv:Supplier | yes |
| `item.custom` | Fields the reseller added in Settings, by field key | yes | inventory.csv:one column per field | yes |
| `item.make` | Make | yes | inventory.csv:Make | yes |
| `item.model` | Model | yes | inventory.csv:Model | yes |
| `item.cost` | What the device cost (cents) | yes | inventory.csv:Cost | yes |
| `item.price` | List price (cents) | yes | inventory.csv:Price | yes |
| `item.status` | available, reserved, sold, returned, damaged, archived. Changed by a sale, a void and a return | yes | inventory.csv:Status | yes (a sold status imports, but no sale is created) |
| `item.receivedOn` | Date received | yes | inventory.csv:Date received | yes |
| `item.notes` | Notes | yes | inventory.csv:Notes | yes |
| `item.addedAt` | When it was added (milliseconds) | yes | - (set on import; not a column) | - |
| `item.soldAt` | When it was sold. Removed on a void or a return | yes | - (the sale date is in sales.csv:date) | - |
| `item.saleId` | The sale it was sold on. Removed on a void or a return | yes | - (the link is by device in sale_items.csv) | - |
| `item.checks` | Which test steps were done, by whom and when | yes | inventory.csv:one column per test step | yes |
| `item.checkVals` | Details recorded under a test step (From and To values) | yes | inventory.csv:one column per detail | yes |
| `item.testedOn` | Date tested | yes | inventory.csv:Tested on | yes |
| `item.testNotes` | Test notes | yes | inventory.csv:Test notes | yes |

### Customer (record type `customer`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `customer.name` | Name | yes | customers.csv:name | - |
| `customer.phone` | Phone | yes | customers.csv:phone | - |
| `customer.email` | Email | yes | customers.csv:email | - |
| `customer.notes` | Notes | yes | customers.csv:notes | - |
| `customer.createdAt` | When added | yes | customers.csv:created | - |
| `customer.address` | The saved address | yes | customers.csv:street | - |
| `customer.address.name` | Saved address: name (usually empty; the customer's name is used) | yes | - (blank in practice) | - |
| `customer.address.street` | Saved address: street | yes | customers.csv:street | - |
| `customer.address.unit` | Saved address: apartment or suite | yes | customers.csv:apartment_or_suite | - |
| `customer.address.city` | Saved address: city | yes | customers.csv:city | - |
| `customer.address.state` | Saved address: state | yes | customers.csv:state | - |
| `customer.address.zip` | Saved address: ZIP | yes | customers.csv:zip | - |
| `customer.address.country` | Saved address: country | yes | customers.csv:country | - |

### Model (record type `model`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `model.name` | Make and model name the level belongs to | yes | models.csv:model | - |
| `model.reorder` | Reorder level (0 turns the warning off) | yes | models.csv:reorder_level | - |

### Sale (record type `sale`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `sale.no` | Receipt number | yes | sales.csv:receipt | - |
| `sale.ts` | Sale date and time | yes | sales.csv:date | - |
| `sale.customerId` | Link to the customer | yes | - (the name is exported) | - |
| `sale.customerName` | Customer name at the time | yes | sales.csv:customer | - |
| `sale.customerEmail` | Customer email at the time | yes | - (in customers.csv:email) | - |
| `sale.customerErased` | Marks a sale whose customer was erased | yes | - (the customer column reads Erased customer) | - |
| `sale.items` | Devices on the sale (list, below) | yes | sale_items.csv:device | - |
| `sale.subtotal` | Items total before discounts (cents) | yes | - (total is exported) | - |
| `sale.orderPct` | Whole-order discount percent | yes | - (the discounted total is exported) | - |
| `sale.orderOff` | Whole-order discount amount | yes | - (the discounted total is exported) | - |
| `sale.total` | Total of the items after discounts | yes | sales.csv:total | - |
| `sale.cost` | Total cost of the devices | yes | sales.csv:cost | - |
| `sale.payment` | Paid by (key) | yes | sales.csv:payment | - |
| `sale.paymentLabel` | Paid by (label at the time) | yes | sales.csv:payment | - |
| `sale.warranty` | Warranty snapshot: key, label, start, end | yes | sales.csv:warranty_ends | - |
| `sale.notes` | Sale notes | yes | - (kept in the backup and on the receipt only) | - |
| `sale.voided` | Sale was voided | yes | sales.csv:voided | - |
| `sale.voidedAt` | When it was voided | yes | - (sales.csv:voided says yes; the time stays in the backup) | - |
| `sale.returnAsk` | A pending request for an Administrator to process a return | yes | - (pending request; becomes a return when processed) | - |
| `sale.returnAsk.by` | Who asked | yes | - (pending request) | - |
| `sale.returnAsk.ts` | When they asked | yes | - (pending request) | - |
| `sale.returnAsk.note` | Their note | yes | - (pending request) | - |

### Sale items (inside `sale.items`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `sale.items.id` | Device record id | yes | - (an internal link) | - |
| `sale.items.uid` | UID at the time of sale | yes | sale_items.csv:device | - |
| `sale.items.serial` | Serial at the time of sale | yes | sale_items.csv:details | - |
| `sale.items.mac` | MAC at the time of sale | yes | sale_items.csv:details | - |
| `sale.items.make` | Make | yes | sale_items.csv:device | - |
| `sale.items.model` | Model | yes | sale_items.csv:device | - |
| `sale.items.fields` | Fields printed on the receipt (label and value) | yes | sale_items.csv:details | - |
| `sale.items.inspection` | Test results at the time of sale | yes | - (the live test results are in inventory.csv) | - |
| `sale.items.listPrice` | List price at the time | yes | - (the price actually charged is exported) | - |
| `sale.items.pct` | Line discount percent | yes | - (the price after discount is exported) | - |
| `sale.items.price` | Price after the line discount | yes | sale_items.csv:price | - |
| `sale.items.cost` | Cost at the time | yes | - (sales.csv:cost has the total) | - |

### Delivery (inside `sale.delivery`; absent on Immediate sales and on sales made before v0.25.0)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `sale.delivery` | The whole delivery record | yes | sales.csv:delivery | - |
| `sale.delivery.type` | shipping, pickup or meet | yes | sales.csv:delivery | - |
| `sale.delivery.shipTo` | Ship to: name, street, unit, city, state, zip, country | yes | sales.csv:ship_to | - |
| `sale.delivery.fee` | Shipping fee charged to the customer (cents) | yes | sales.csv:shipping_fee | - |
| `sale.delivery.cost` | The reseller's own shipping cost (cents). Internal: never on a receipt or label | yes | sales.csv:shipping_cost | - |
| `sale.delivery.carrier` | Carrier | yes | sales.csv:carrier | - |
| `sale.delivery.tracking` | Tracking number | yes | sales.csv:tracking | - |
| `sale.delivery.note` | Delivery note (printed on the label) | yes | sales.csv:delivery_note | - |
| `sale.delivery.status` | toship or shipped | yes | sales.csv:delivery_status | - |
| `sale.delivery.shippedAt` | When it was marked shipped | yes | sales.csv:shipped_on | - |
| `sale.delivery.labelRef` | Reserved for a future postage label reference (empty today) | yes | - (always empty) | - |
| `sale.delivery.date` | Pickup or meet date | yes | sales.csv:delivery_date | - |
| `sale.delivery.notes` | Pickup or meet notes | yes | sales.csv:delivery_notes | - |

### Returns (inside `sale.returns`, one entry per return)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `sale.returns.id` | Return record id | yes | - (an internal link; the credit note number is exported) | - |
| `sale.returns` | The list of returns on this sale | yes | returns.csv:credit_note | - |
| `sale.returns.no` | Credit note number | yes | returns.csv:credit_note | - |
| `sale.returns.ts` | When it was processed | yes | returns.csv:date | - |
| `sale.returns.by` | Who processed it | yes | returns.csv:processed_by | - |
| `sale.returns.role` | Their role | yes | - (the name is exported) | - |
| `sale.returns.reasonKey` | Reason (key) | yes | - (the label is exported) | - |
| `sale.returns.reasonLabel` | Reason (label at the time) | yes | returns.csv:reason | - |
| `sale.returns.note` | Free-text note | yes | returns.csv:note | - |
| `sale.returns.lines` | Devices returned: id, label, price, refund, restock | yes | returns.csv:refund_devices | - |
| `sale.returns.fee` | Restocking fee kept | yes | returns.csv:restocking_fee | - |
| `sale.returns.shipRefund` | Shipping fee refunded | yes | returns.csv:shipping_refunded | - |
| `sale.returns.net` | Total refunded | yes | returns.csv:refund_total | - |
| `sale.returns.method` | Refund given by (key) | yes | - (the label is exported) | - |
| `sale.returns.methodLabel` | Refund given by (label) | yes | returns.csv:refunded_by | - |
| `sale.returns.retTracking` | Return tracking number | yes | returns.csv:return_tracking | - |
| `sale.returns.retShipCost` | Return shipping cost | yes | returns.csv:return_shipping_cost | - |
| `sale.returns.retShipPaidBy` | Who paid return shipping | yes | returns.csv:return_shipping_paid_by | - |

### Account settings (record type `config`, one per account)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `config.fields` | Device fields to track | yes | settings.json | - |
| `config.steps` | Test steps and their details | yes | settings.json | - |
| `config.warranty` | Warranty periods and the default | yes | settings.json | - |
| `config.payments` | Paid by methods and the default | yes | settings.json | - |
| `config.unlock` | Unlock mode and idle minutes | yes | settings.json | - |
| `config.discount` | Highest discount for Standard users | yes | settings.json | - |
| `config.catalog` | Makes and models catalogue | yes | settings.json | - |
| `config.tests` | Tests on or off, required before sale | yes | settings.json | - |
| `config.firstRun` | Get set up checklist dismissed | yes | settings.json | - |
| `config.mail` | Customer emails: own mail server, wording, logo. Holds the mail password; settings.json contains it, so keep the zip private | yes | settings.json | - |
| `config.mail.enabled` | Use your own mail server | yes | settings.json | - |
| `config.mail.host` | Mail server | yes | settings.json | - |
| `config.mail.port` | Port | yes | settings.json | - |
| `config.mail.secure` | Secure connection | yes | settings.json | - |
| `config.mail.user` | Mail user | yes | settings.json | - |
| `config.mail.pass` | Mail password (in settings.json too, keep the zip private) | yes | settings.json | - |
| `config.mail.fromName` | Sender name | yes | settings.json | - |
| `config.mail.fromAddress` | Sender address | yes | settings.json | - |
| `config.mail.wording` | Customer email wording | yes | settings.json | - |
| `config.mail.logo` | Business logo, a small image (also the default label logo) | yes | settings.json | - |
| `config.delivery` | Delivery settings | yes | settings.json | - |
| `config.delivery.country` | Show a Country box on addresses | yes | settings.json | - |
| `config.delivery.receiptNote` | Print the pickup or meet note on receipts | yes | settings.json | - |
| `config.delivery.receiptDeliveryNote` | Print the Delivery note on receipts | yes | settings.json | - |
| `config.label` | Label settings | yes | settings.json | - |
| `config.label.size` | Default label size | yes | settings.json | - |
| `config.label.look` | Themed or Plain | yes | settings.json | - |
| `config.label.logo` | Business logo, a different logo, or none | yes | settings.json | - |
| `config.label.customLogo` | The different logo, as a small image kept in the record | yes | settings.json | - |
| `config.label.returnAddress` | Return address printed on labels | yes | settings.json | - |
| `config.returns` | Returns settings | yes | settings.json | - |
| `config.returns.reasons` | Return reasons the reseller picks from | yes | settings.json | - |
| `config.returns.standardCan` | Standard users can process returns | yes | settings.json | - |
| `config.returns.limit` | Refunds above this amount need an Administrator | yes | settings.json | - |
| `config.returns.fee` | Default restocking fee (percentage or flat) | yes | settings.json | - |

## Team (not an encrypted record)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `team.username` | Login name | Team list in the file, sealed with the account key | - | - |
| `team.email` | Email | Team list in the file | - | - |
| `team.role` | Administrator, Standard or View | Team list in the file | - | - |

## Browser only (never sent to the server, never in a backup)

These are per-person conveniences kept in the browser. After a restore on a new browser they are simply set again. Losing them loses no business data.

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `browser.mbs.lowcard.<userId>` | Running low card hidden by this person | not backed up | - | - |
| `browser.mbs.backupNudge` | Backup reminder closed for today | not backed up | - | - |
| `browser.mbs.resellerId` | Last Reseller ID typed on the sign-in screen | not backed up | - | - |
| `browser.mbs.scanSize` | Phone scanner box size | not backed up | - | - |
| `browser.mbs.scanConfirm` | Phone scanner confirm choice | not backed up | - | - |
| `browser.mbs.scanTapped` | Phone scanner hint shown | not backed up | - | - |
| `browser.mbs.fr.tested.<userId>` | Get set up test step noted | not backed up | - | - |
| `browser.mbs-ann` | Announcement already seen | not backed up | - | - |

## Host (server side)

The Host database is covered as a whole by the full-site backup (`.mbsbak`), the offsite copies, the snapshots and the Host restore. The lists below are what the guard test watches: every table, every setting key, every Demo mode column.

### Tables

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `table.accounts` | Resellers (includes `demo` and `demo_set`) | Host | - | - |
| `table.account_users` | Team members: login, role, password hash | Host | - | - |
| `table.account_keys` | Each person's wrapped account key | Host | - | - |
| `table.account_recovery` | The recovery-key wrapped account key | Host | - | - |
| `table.account_roles` | Roles per account | Host | - | - |
| `table.records` | Encrypted reseller records | Host | - | - |
| `table.inventory_items` | Older plain-text inventory table (unused by the app) | Host | - | - |
| `table.restore_points` | Restore points taken before a restore | Host | - | - |
| `table.restore_point_records` | Records held by a restore point | Host | - | - |
| `table.billing_events` | Billing events | Host | - | - |
| `table.billing_receipts` | Billing receipts | Host | - | - |
| `table.receipt_mail_usage` | Receipt emails sent per day | Host | - | - |
| `table.sign_in_history` | Sign-in history | Host | - | - |
| `table.sessions` | Open sessions | Host | - | - |
| `table.password_resets` | Password reset links | Host | - | - |
| `table.email_confirmations` | Email confirmation links | Host | - | - |
| `table.admin_links` | Host-sent sign-in links | Host | - | - |
| `table.host_admins` | Host administrators | Host | - | - |
| `table.settings` | Host settings (keys below) | Host | - | - |
| `table.firewall_rules` | Firewall rules | Host | - | - |
| `table.security_blocks` | Temporary security blocks | Host | - | - |
| `table.mail_queue` | Mail history | Host | - | - |
| `table.event_log` | Audit trail | Host | - | - |
| `table.alerts` | Host alerts | Host | - | - |
| `table.support_tickets` | Support tickets | Host | - | - |
| `table.support_messages` | Ticket messages | Host | - | - |
| `table.support_attachments` | Ticket screenshots | Host | - | - |
| `table.support_notes` | Private Host notes on tickets | Host | - | - |
| `table.support_views` | Which tickets a Host admin has read | Host | - | - |
| `table.demo_logins` | Demo mode logins, the password sealed with the server key | Host (left out of full-site backups on SQLite with the demo accounts) | - | - |
| `table.schema_migrations` | Which database upgrades have run | Host | - | - |

### Accounts columns added for Demo mode

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `accounts.demo` | 1 on accounts made by Demo mode Build | Host (those accounts are left out of full-site backups and offsite copies on SQLite) | - | - |
| `accounts.demo_set` | Which demo set (demo3, demo300 and so on) | Host (same) | - | - |

### Setting keys (table `settings`)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `setting.announcement` | Site announcement | Host | - | - |
| `setting.backup_destinations` | Offsite destinations | Host | - | - |
| `setting.backup_full` | Full-site backup options | Host | - | - |
| `setting.backup_full_status` | Last full-site backup result | Host | - | - |
| `setting.backup_schedule` | Daily copy schedule | Host | - | - |
| `setting.backup_status` | Last backup result | Host | - | - |
| `setting.backup_tiers` | Snapshot and offsite tiers | Host | - | - |
| `setting.backup_setup` | Backup passphrase set-up state | Host | - | - |
| `setting.backup_test_last` | Last restore test | Host | - | - |
| `setting.backup_health_since` | Backup health baseline | Host | - | - |
| `setting.demo_mode` | Demo mode switch and sizes | Host | - | - |
| `setting.firewall_limits` | Firewall limits | Host | - | - |
| `setting.mail` | Email transport (password sealed) | Host | - | - |
| `setting.mail_last_test` | Result of the last test email (no password) | Host | - | - |
| `setting.mail_templates` | Email wording | Host | - | - |
| `setting.plans` | Plans | Host | - | - |
| `setting.retention` | Data and retention rules | Host | - | - |
| `setting.retention_state` | Retention run state | Host | - | - |
| `setting.runtime` | Runtime options | Host | - | - |
| `setting.sign_in_history_days` | Days of sign-in history kept | Host | - | - |
| `setting.signups_enabled` | Sign-ups on or off | Host | - | - |
| `setting.site_url` | Site address | Host | - | - |
| `setting.support` | Support settings (see the keys below) | Host | - | - |
| `setting.support_notify_state` | New-ticket notice state (hourly cap, digest) | Host | - | - |
| `setting.trial_days` | Trial length | Host | - | - |
| `setting.run_history` | Update history | Host | - | - |
| `setting.update_check` | Last update check | Host | - | - |

### Support settings keys (inside `setting.support`; the notify keys are new in v0.25.0)

| Field | Meaning | Backup | Export | Import |
| --- | --- | --- | --- | --- |
| `support.categories` | Ticket categories | Host | - | - |
| `support.priorities` | Ticket priorities | Host | - | - |
| `support.defaultPriority` | Default priority | Host | - | - |
| `support.canned` | Canned replies | Host | - | - |
| `support.responseDays` | Response target in days | Host | - | - |
| `support.autoCloseDays` | Days before Resolved closes | Host | - | - |
| `support.maxFiles` | Screenshots per message | Host | - | - |
| `support.maxKB` | Screenshot size limit | Host | - | - |
| `support.perHour` | New tickets per hour per account | Host | - | - |
| `support.openCap` | Open tickets per account | Host | - | - |
| `support.notifyInApp` | New-ticket alert in Host > Alerts | Host | - | - |
| `support.notifyEmail` | New-ticket email | Host | - | - |
| `support.notifyRecipients` | Owner only, all Host admins or a chosen list | Host | - | - |
| `support.notifyChosen` | The chosen list | Host | - | - |
| `support.notifyThreshold` | Every ticket, or High and Urgent only | Host | - | - |
| `support.notifyDigest` | Daily digest instead of one email each | Host | - | - |
| `support.notifyReplyInApp` | Alert on a reseller reply | Host | - | - |
| `support.notifyReplyEmail` | Email on a reseller reply | Host | - | - |
| `support.notifyPerHour` | Emails-per-hour cap | Host | - | - |

## Demo mode and the Host backups

- Full-site backup (`.mbsbak`) and the offsite copy on SQLite leave Demo mode accounts out of the copy (never out of the live site) unless the Demo mode setting "Leave demo accounts out of backups" is switched off. The manifest records how many were left out and Host > Backups > Test a backup file shows it.
- Daily and frequent snapshots, safety copies taken before a restore, and database dumps (PostgreSQL pg_dump, MariaDB mysqldump) are whole copies of the database and DO include demo accounts. Restoring one of those brings demo accounts back; Demo mode > Remove deletes them again.
- On PostgreSQL and MariaDB the full-site backup holds the whole dump, so demo accounts are included. Remove them with Demo mode before taking a backup if that matters.
- Host > Backups > Test a backup file reports counts only: accounts by plan and status, users by role, and records per account by kind (devices, customers, sales, models, settings records). It cannot open reseller records; only a reseller's own Test a backup file proves their data decrypts.

## Known limits, on purpose

- Import is for devices only. Customers, sales, returns and settings come back only through a backup file.
- A device imported with the status Sold has no sale behind it.
- The browser-only items above are not backed up.
- A reseller backup holds the account's records, the Team list and the wrapped keys; it is bound to its own account (Reseller ID) and refuses another account's file.
