---
title: Inventory
summary: Add, scan, import, search, edit, test, archive and export every device you own, and set reorder levels so you never run out of a popular model.
keywords: inventory, camera button, scan with camera, search by camera, paging, per page, 25 per page, next page, previous, small medium large, aim line, wrong barcode, scan next field, several barcodes on a label, no spinners, monospace, devices, stock, add device, bulk scan, barcode, scanner, uid, serial number, mac address, condition, supplier, cost, selling price, status, date received, tested on, test record, import csv, export csv, archive, delete, reorder, low stock, make, model, filter, search, awaiting test
order: 3
covers: nav:inventory, camera button, Search by camera, Scanning a detail with the camera, Bulk scan with the camera, Scan next field, 25 / 50 / 100 per page, Previous, Next, Showing 1–25, Pages, Add device, Save and add another, Save, Cancel, Close, Bulk scan, Save 0 devices, Remove last, Scan or type then Enter, What do you scan for each device, Import CSV, Import devices, Export CSV, Search, Available, All (not archived), Awaiting test, Reserved, Sold, Returned, Damaged, Archived, All models, Make, Model, Add new, UID, Serial number, MAC address, Condition, Supplier, Status, Cost, Selling price, Date received, Notes, Test record, Mark all done, Tested on, Test notes, required before sale, Stock levels, Reorder at, Low, Archive, Restore, Delete, Tests column, columns
---

## What Inventory is for

Inventory is the list of every device you have bought, with what you paid, what you want to sell it for, where it stands (for sale, sold, damaged and so on) and what testing you did. It is the heart of the app: Quick sale takes devices from here, and Home counts them.

Why keep it carefully? Because it answers questions that otherwise cost you time and money. Do I still have that model? Which unit did I sell to Maria? Did I test this box before I sold it? How much cash is tied up in stock? A device you cannot find in your records is a device you cannot sell, and a sale without a cost recorded makes your profit figures unreliable.

The header tells you how many devices are available, how many are awaiting test (when that rule is on), and the total, followed by the reminder that only your team can read it. Your data is encrypted in your browser, so only people signed in to your account can see these records.

### Who can do what

- **Administrator** and **Standard**: see everything, add, edit, archive, delete, bulk scan, import and export.
- **View**: can open the list, look at a device (the form is read-only and shows **Close** instead of Cancel and Save), and use **Export CSV**. Cannot add, change, delete, import or change reorder levels.

If your user type does not include inventory at all, you will see a message that your user type does not include it. See [Team](#/docs/team).

## The page at a glance

At the top right are the action buttons: **Bulk scan**, **Import CSV**, **Export CSV** and **Add device**. View users see only **Export CSV**.

Under that, if any model is at or below its reorder level, a banner lists it, for example "Fire Stick 4K: 2 left (reorder at 3)".

Then the toolbar: a search box and two drop-down filters. Then the table of devices. Last, a **Stock levels** card.

### The table

Each row is a device. The columns are:

- Up to the first three of your scannable identifiers, using the names you set in [Settings](#/docs/settings), for example **UID**, **Serial number**, **MAC address**. Which ones show depends on which are turned on for **Look up in sale**.
- **Device**: the make and model together.
- **Cost** and **Price**: what you paid and what you plan to sell for.
- **Tests**: a small chip, only when the test checklist is on. It reads **Tested** (all steps done), **Tested 2/5** (some done), or **Not tested**.
- **Status**: a coloured chip.

The list is sorted by **Date received**, newest first. Click a row to open that device.

Identifiers such as serial numbers, MAC addresses and UIDs are shown in a fixed-width (monospace) font, so similar characters like 0 and O are easy to tell apart. Prices and dates use ordinary figures that line up in columns.

### Pages

The list shows **25 devices per page**. Under the table a line says, for example, "Showing 1–25 of 60", with a **25 / 50 / 100 per page** list and **Previous** and **Next** buttons. Pick 50 or 100 to see more at once. The buttons hide when there are 25 or fewer devices. Every device is reachable: there is no cap. Whenever you change the search, the status filter or the model filter, you go back to page 1. **Export CSV** always exports every device, not just the page.

## Searching and filtering

### Search

The search box has a placeholder that names your identifiers, for example "Search UID, Serial number, MAC address, make, model, notes". Type any part of a word and the list narrows as you type. It looks in make, model, notes and every device detail you track (including Supplier and Condition). It is not case sensitive.

### Search by camera

The search box has a small **camera button** at its right end. Tap it and scan the barcode on a box. The code fills the search box and the list narrows to that device. See [Scanning with your phone camera](#/docs/scanning-with-your-phone).

### Status filter

The first drop-down has these choices:

- **Available**: devices you can sell now. This is the standard view.
- **All (not archived)**: everything except archived devices, including sold ones.
- **Awaiting test**: devices that cannot be sold yet because required tests are not done. This choice appears only when your Administrator has turned on **Sell only tested devices**.
- **Reserved**, **Sold**, **Returned**, **Damaged**, **Archived**: only devices with that status.

### Model filter

The second drop-down starts at **All models** and lists every model that appears on at least one device. Choose one to see only that model. Combine it with the status filter, for example **Available** plus one model to see exactly what you could sell today.

> Tip: if you cannot find a device, check the status filter first. A sold or archived device does not show in Available.

## Statuses explained

- **Available**: ready to sell.
- **Reserved**: set aside for someone, not for general sale. Quick sale will not accept it.
- **Sold**: set automatically when you complete a sale. It records the sale date and receipt.
- **Returned**: came back from a customer. It is treated like available stock again, so it can be sold again.
- **Damaged**: not sellable. Quick sale will not accept it.
- **Archived**: tucked away without deleting. See below.
- **Awaiting test**: not something you choose. The app shows it automatically for an Available or Returned device whose required tests are not finished, when **Sell only tested devices** is on. Ticking the test steps frees the device automatically.

## Adding a device

1. Press **Add device**. A form opens.
2. Choose the **Make** from the list, or choose **Add new...** and type it.
3. Choose the **Model**. The list is filtered to the chosen make. Choose **Add new...** to type a new one.
4. Fill in the device details you track (see below).
5. Set **Status**, **Cost**, **Selling price** and **Date received**.
6. Add any **Notes**.
7. Fill in the **Test record** if you have already tested it.
8. Press **Save**, or **Save and add another** to keep going with a fresh form. **Cancel** closes without saving.

A "Device added" message confirms it.

### Make and Model

These are drop-down lists. The first time, the lists are empty and you simply type your first make and model. After that they are built from the devices you have entered, plus any names your Administrator pre-loaded in Settings. Capital letters never create a duplicate: typing "ACME" when "Acme" already exists reuses "Acme". Choosing a make narrows the models to those of that make. Why it matters: consistent names make search, stock levels and the model filter reliable.

### Device details

By default these are tracked:

- **UID**, **Serial number**, **MAC address**: identifiers. They can be scanned or typed. By default each is searchable in Quick sale and must be unique across your devices.
- **Condition**: a choice of New, Refurbished or Used. A new device starts as New.
- **Supplier**: free text, for example where you bought it.

Your Administrator can rename these, turn them off, reorder them, or add more of type Text, Number, Date, Yes/No or Choice from a list, in [Settings](#/docs/settings). Whatever is turned on appears in this form. Details marked **Must be unique** cannot repeat; if you try, you see "Another device already has that UID" (or whatever the detail is called). If at least one detail is marked **Look up in sale**, you must fill in at least one of them, so every device can be found when selling.

> Tip: when you click into a UID, serial or MAC box and a scanner types a label such as "UID" or "SN:" before the number, the app removes the label for you when you leave the box.

### Scanning a detail with the camera

Each text detail that is marked **Look up in sale** or **Must be unique** (by default UID, Serial number and MAC address) has a small **camera button** inside its box, in Add device and in Edit device. Tap it, hold the phone over the barcode, and the number drops into the box. After a Serial number scan, if the MAC address box is still empty, the scanner offers **Scan MAC address** so you can read the second code without leaving the camera. The MAC box only accepts a real MAC address and writes it as `AA:BB:CC:DD:EE:FF`. The full steps, the buttons on the scanner screen and tips for good scans are on [Scanning with your phone camera](#/docs/scanning-with-your-phone).

If a label has more than one barcode, make the scan box **Small** and put the barcode you want on the thin aim line in the middle. The scanner reads the code nearest that line. Always glance at the number in the box before you save.

### Status, Cost, Selling price

- **Status**: normally Available. You may choose Reserved, Sold, Returned, Damaged or Archived.
- **Cost**: what you paid, in dollars and cents. Used for Home profit and for each sale. Number boxes such as Cost and Selling price have no little up and down arrows, so you simply type the amount.
- **Selling price**: the price Quick sale starts with. You can change it on the sale.

### Date received

A date box that starts as today. Set it to the day the box actually arrived if you are entering old stock. The list is sorted by this date, and "Add by quantity" in Quick sale sells your oldest units first.

### Notes

Free text for anything else: a scratch on the case, a missing remote, an order number.

## The test record

If your Administrator has turned on the test checklist (it is on by default), the form ends with a **Test record** area. If it is off in Settings, the area and the Tests column disappear everywhere; nothing is deleted.

The default steps are Device inspected, Batteries installed in remote, Remote tested, Device tested, and Code / firmware upgraded (if needed). Your Administrator can change them.

1. Tick each step you have done.
2. A step may reveal extra boxes. The default firmware step has **Launcher** and **Firmware** with a From and a To box, so you can note "v2.1 to v2.4". Some extra items are text boxes or a choice list.
3. Set **Tested on**. It starts as today. Change it if you tested on a different day. This is saved only if at least one step is ticked.
4. Add **Test notes** for anything worth remembering.
5. **Mark all done** ticks every step at once and uses the date in Tested on as it stands.

Steps marked **required before sale** show that note beside them. When ticked, the app records who ticked it and when. When you later sell the device, a copy of the test record is saved with the sale, so if a customer says "it never worked" you can show what was checked and by whom. On a receipt you can choose to include it.

If **Sell only tested devices** is on, a device cannot be put in a sale until its required steps are ticked (or every step, if none are marked required). If the device is Awaiting test, Quick sale tells you to tick its steps in Inventory first.

## Bulk scan

Use **Bulk scan** when a delivery arrives and you want to enter many identical boxes quickly with a barcode scanner, your phone camera or a keyboard. You will need at least one scannable text detail turned on in Settings (for example UID); otherwise you see a message to turn one on first.

1. Press **Bulk scan**.
2. Choose the **Make** and **Model** and fill in anything else that is the same for every box (such as Condition or Supplier), plus **Status**, **Cost**, **Selling price** and **Date received**.
3. Under **What do you scan for each device?**, tick the identifiers that are on your labels, for example UID and Serial number. At least one stays ticked. You cannot change these ticks in the middle of a device; finish it first.
4. Click the scan box (it is selected already). The label above it says what to scan next, such as "Scan UID".
5. Scan or type the value. Press Enter, or Tab, after it. Many scanners do this by themselves. The scan also completes if you paste, or if a quick burst of typing stops, or if you click out of the box.
6. The app moves to the next identifier, then to the next device. Each scanned device appears as a grey chip.
7. If a device does not have one of the identifiers, press Enter on an empty box to skip it (not possible for the first identifier).
8. Press **Remove last** to undo the most recent scan.
9. When finished, press **Save N devices** (the button counts them, for example "Save 12 devices"). A message confirms "12 devices added". **Cancel** closes without saving.

Duplicates are caught: a value already scanned in this batch, or a unique identifier already on another device, shows a message and is not accepted. A label sent by the scanner on its own, such as "UID", is ignored.

> Tip: do not turn off your scanner's Enter at the end of a scan. It is what moves you along.

### Bulk scan with the camera

Beside the scan box is a **camera button**. Tap it and the scanner stays open while you scan one label after another. Each code is added at once ("Got it"), then the scanner waits for a different code, so holding still does not add the same box twice. The title says which identifier comes next, for example "Scan MAC address". A serial number already in your inventory, or already in this batch, is refused with a message and the scanner stays open. Tap **Close** when you are done, then press **Save N devices**. Details are on [Scanning with your phone camera](#/docs/scanning-with-your-phone).

Bulk scan leaves Notes and test steps empty. Open a device afterwards to record tests.

## Import CSV

Use **Import CSV** to bring in a spreadsheet saved as CSV, for example from a previous system or a supplier.

1. Prepare a file whose first row has column names. Use the same names as in the app: your detail names (UID, Serial number...), Make, Model, Cost, Price, Status, Date received, Notes, and Condition. The match is not case sensitive. Test steps can be columns too, with yes, true, 1 or x meaning done, plus **Tested on** and **Test notes**.
2. The first row must include at least one of your Look up details, such as UID.
3. Press **Import CSV** and choose the file.
4. A box says how many devices will be added and how many rows will be skipped. Rows are skipped when they have no identifier or one that already exists.
5. Press **Import N** to confirm, or **Cancel**.

Missing columns get sensible defaults: Status Available, costs zero, Date received today, and Condition the first choice. Makes and models are spelled to match your existing lists. Files are read inside your browser; the site never sees them.

> Tip: the quickest way to learn the layout is to press **Export CSV**, open that file, and add rows in the same shape.

## Export CSV

**Export CSV** downloads every device in your account as a spreadsheet file named like `inventory-20261005.csv`, with all your detail columns, Make, Model, Cost, Price, Status, Date received, Notes, and test columns. Costs are in plain numbers. It ignores the filters on the page and includes archived devices. A message says how many devices were exported.

Why bother: an export is a copy you can open in a spreadsheet. It is not a backup you can restore from. For that, use **Back up now** on the [Backup and restore](#/docs/backup-and-restore) page. You own your data and are responsible for it, so do both regularly and keep copies somewhere you control. See [Your data, your responsibility](#/docs/your-data-your-responsibility) and [Security](#/docs/security) for "Export everything".

## Editing a device

1. Click a row. The device opens with its name as the heading. A sold device also says when it was sold and the receipt number.
2. Change what you need. Every field from the add form is there.
3. Press **Save**. "Saved" confirms.

**Cancel** closes without saving. View users see the same form with every box disabled and a **Close** button.

If you change a unique detail to something another device already has, the save is refused.

### Archive and Restore

**Archive** hides a device from the normal lists without deleting it, which is useful for old or retired stock you want to keep a record of. It moves to the **Archived** filter and no longer counts as available. On an archived device the same button reads **Restore**, which sets it back to Available.

### Delete

**Delete** asks "Delete this device?" and says it is removed for good. Past sales that included it keep their receipts. If you are unsure, use Archive instead. There is no undo.

> Important: if a device was sold by mistake, void the sale in [Sales](#/docs/sales) rather than editing its status. Voiding returns it to available and keeps the history tidy.

## Stock levels and reorder

The **Stock levels** card lists every model with how many are available. Type a number in **Reorder at** for any model and the page saves it ("Saved"). When the available count is at or below that number a red **Low** chip appears, the banner shows at the top, and Home also warns you. Enter 0 to turn off the warning. View users can see the numbers but the boxes are disabled.

Example: you want to keep at least four of one model. Set Reorder at to 4.

## Common mistakes

- Scanning a label with several barcodes and not checking which one landed in the box. Use **Small** and the aim line, then look.
- Cannot find a device you know you added. It may be on another page. Check "Showing 1–25 of N" and the status filter.

- Typing the same make in several spellings. Pick from the list instead.
- Forgetting Cost. Your profit on Home and Sales depends on it.
- Leaving a device as Reserved after the buyer has gone. It will not sell in Quick sale.
- Deleting when you meant to archive.
- Expecting to see a sold device under Available. Use **All (not archived)** or **Sold**.
- Ticking test steps for devices you did not test. The record shows your username and date; keep it honest.
- Importing the same file twice. Duplicate identifiers are skipped, but check the count before pressing Import.

Next, see [Quick sale](#/docs/quick-sale) to sell what you have entered, and [Settings](#/docs/settings) to choose which details and tests you track.
