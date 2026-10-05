---
title: Sales
summary: Look back over every sale, filter by date, warranty and status, open and print receipts, email them again, void a sale, change a warranty and export your sales to a spreadsheet.
keywords: paging, per page, next, previous, sales, receipts, receipt, void, refund, cancel sale, warranty, email receipt, print receipt, export csv, revenue, profit, report, search sales, filter, date range, paid by
order: 6
covers: nav:sales, 25 / 50 / 100 per page, Previous, Next, Export CSV, Quick sale, Search sales, From, To, All warranties, In warranty, Expired, No warranty, All sales, Sold, Void, Today, 7 days, 30 days, This month, All time, Clear filters, Sales, Revenue, Profit, Devices sold, Date, Receipt, Customer, Items, Warranty, Paid by, Total, Same number, Walk-in, Include the test record, Void sale, Change warranty, Email, Print, Done, Receipt, Thank-you note, Sale voided notice, Send to, Open in my mail app, Send, sales.read, sales.write
---

## What the Sales page is for

The **Sales** page is the history of everything you have sold. Every time you finish a [Quick sale](#/docs/quick-sale), a sale record is created with a receipt number, the date, the customer, the devices, the price, how it was paid and the warranty. This page lets you look back over all of that.

Why would you use it? Some everyday examples:

- A customer rings and says their box has a fault. You search for their name, open the receipt, and check whether the warranty is still running.
- At the end of the month you want to know how much you took and how much of it was profit. You press **This month** and read the totals.
- You made a mistake on a sale, perhaps the wrong device or the customer sent it back. You open the receipt and void it, which puts the device back into stock.
- Your accountant wants a spreadsheet. You press **Export CSV** and send them the file.

Your sales are encrypted in your browser with your own key, so only people who sign in to your account can read them. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Who can do what

- **Administrator** and **Standard** users can view sales, record new ones, and void a sale.
- **View** users can look at sales and open receipts, print them and email them, but they cannot void a sale or record a new one. The **Quick sale** button on this page is not shown to them.
- **Change warranty** on a receipt is for Administrators only.
- If your user type does not include sales, the **Sales** menu item is hidden, and the page says "Your user type does not include sales."

Your user types are explained on the [Team](#/docs/team) page.

## Reading the page

The top of the page says "Receipts and totals. Only your team can read this." Beside it are two buttons: **Export CSV** and **Quick sale** (the second only if you are allowed to record sales; it takes you straight to the sales screen).

### The totals

Four summary boxes sit above the table. They are worked out from whatever sales are currently showing, so they change as you filter:

- **Sales** - how many sales are showing, not counting voided ones.
- **Revenue** - the total of those sales.
- **Profit** - revenue minus what the devices cost you (the cost you entered in [Inventory](#/docs/inventory)). If you did not enter a cost, profit equals revenue for that sale.
- **Devices sold** - the number of devices across those sales.

Voided sales are never included in these four numbers, even when they are visible in the table.

A line of small text under the filters describes what you are looking at, for example "Showing 2026-10-01 to 2026-10-31 · In warranty · 12 sales". It is a quick check that your filters are what you meant.

### The table

Each row is one sale, newest first. The columns are:

- **Date** - when the sale happened.
- **Receipt** - the receipt number. A red **Void** tag appears next to a voided sale. An amber **Same number** tag appears if another sale happens to carry the same receipt number (this is rare; hover over the tag to see the explanation).
- **Customer** - the customer's name, or "Walk-in" if the sale has no customer name.
- **Items** - how many devices were on the sale.
- **Warranty** - a coloured badge. Green means still in warranty and says how many days remain; red means expired and says how long ago; grey means no warranty. Voided sales show a grey "Void".
- **Paid by** - the payment method, as it was named at the time of the sale.
- **Total** - the amount charged after any discounts.

Click a row to open its receipt.

### Pages

The list shows **25 rows per page**. Under it a line says, for example, "Showing 1–25 of 60", with a **25 / 50 / 100 per page** list and **Previous** and **Next** buttons. Choose 50 or 100 to see more at once. These controls hide when everything fits on one page of 25 or fewer. Changing the search or a filter always takes you back to page 1. There is no longer a limit on how many sales you can reach: use **Next**, or narrow the dates or search. The four boxes above count every matching sale, not just the page you are looking at. **Export CSV** also includes every matching sale, not just the current page.

## Finding sales: search and filters

All filters work together. A sale has to match every filter you set.

### Search sales

The box labelled **Search sales** matches as you type. It looks in the receipt number, customer name, payment method, warranty name, and each device's make, model, UID, serial number, MAC address and any other details recorded on the sale. Examples:

- Type part of a UID or serial number to find which customer bought that exact box.
- Type `cash` to see cash sales only.
- Type a customer's first name.

### From and To

The two date boxes (labelled **From** and **To** for screen readers) let you pick an exact range. Leave one blank for "no limit" on that side. The **To** date includes the whole of that day.

### The period buttons

Under the search row are quick buttons: **Today**, **7 days**, **30 days**, **This month** and **All time**. Pressing one fills in the From and To dates for you. The button you pressed stays highlighted while the dates match it. If you then change a date by hand, the highlight disappears because it is now a custom range.

- **7 days** and **30 days** count back from today, including today.
- **This month** runs from the first of the month to today.
- **All time** removes the date limits.

### Warranty filter

A drop-down with four choices:

- **All warranties** - no filter.
- **In warranty** - sales whose warranty has not yet ended.
- **Expired** - sales whose warranty has ended.
- **No warranty** - sales with no warranty.

Voided sales are left out whenever you choose one of the three specific warranty options.

This is handy for support. Choosing **In warranty** gives you the list of customers who could come back with a fault.

### Sale status filter

A second drop-down with **All sales**, **Sold** and **Void**. Choose **Void** to review everything that was cancelled, or **Sold** to hide the voided ones from the table.

### Clear filters

When any filter is active a **Clear filters** link appears. Press it to remove the search, dates, warranty and status filters and show everything again.

> Tip: if the table seems to be missing a sale, look at the "Showing..." line first. Nine times out of ten there is a forgotten filter, such as an old date range or "In warranty".

## Opening a receipt

Click a sale row (or a purchase line on a customer's page) to open its receipt. You will see your business name, the receipt number and date, the customer, each device with its price and recorded details, any discount, the total, how it was paid, and the warranty lines. A voided sale shows a red notice saying "This sale was voided."

If you gave a discount you will see the original price crossed out beside the reduced price on the line, and for an order-wide discount you will see a subtotal and an "Order discount" line.

### Include the test record

If the devices on the sale had test steps ticked before they were sold (see the test checklist in [Settings](#/docs/settings)), a checkbox appears: **Include the test record (shows what was checked before it was sold)**. Tick it to show, under each device, which checks were done, who did them and when, plus any details and notes. Leave it unticked for a clean customer-facing receipt. Whatever you choose applies to printing and emailing, too.

Why include it? If a customer says "it never worked", the test record is your proof of what you checked before the sale.

### Buttons on the receipt

- **Done** - closes the receipt.
- **Print** - opens your browser's print dialog with just the receipt on the page.
- **Email** - lets you send the receipt to the customer (next section).
- **Void sale** - cancels the sale. Shown only to people who can record sales, and only while the sale is not already voided.
- **Change warranty** - Administrators only, and only while the sale is not voided.

> Right after you finish a quick sale the receipt opens automatically with **Print**, **Email** and **Done**. The **Void sale** and **Change warranty** buttons are not shown there; find the sale on this page if you need them.

## Emailing a receipt

1. Open the receipt.
2. Press **Email**. A box called "Email the customer" opens.
3. Under **Message**, choose what to send. For a normal sale the choices are **Receipt** and **Thank-you note**. For a voided sale they are **Sale voided notice** and **Receipt**.
4. In **Send to**, check the address. It is filled in from the customer's email if you have one saved. You can type a different address.
5. Press **Send**. You will see "Email sent".

The box tells you how the message will go out. If you have set up your own mail server in [Settings](#/docs/settings) it says "Sent from your own mail server" with your From address. Otherwise it says it is sent from the site, with replies going to your own email address. Either way it also tells you the receipt is not kept on the server. It passes through to be delivered and is then forgotten.

### Open in my mail app

If you would rather send it from your own email program, press **Open in my mail app**. Your device opens a new message with the address, a subject and the receipt text already filled in. This also works when email sending is not set up on the site, in which case pressing **Send** shows a message saying email is not set up and suggesting your own mail app.

### Limits and errors

- The site limits how many receipts one account can email in a day. If you hit the limit you are told to try tomorrow or use your own mail app.
- If the address is not valid you are asked to enter one valid email address.
- The wording and logo of the emails can be changed in [Settings](#/docs/settings).

## Voiding a sale

Voiding is how you cancel a sale without losing the record, for example when a customer returns a box or you picked the wrong device.

1. Open the receipt from the Sales page.
2. Press **Void sale**.
3. Read the confirmation: "The devices go back to available and the sale stays in your history marked as voided."
4. Press **Void sale** to confirm.

What changes:

- The sale stays in the list with a red **Void** tag. Nothing is deleted.
- Each device on the sale goes back to **Available** in [Inventory](#/docs/inventory), so you can sell it again. (Only devices still linked to that sale are changed. If a device has since been sold on a different sale it is left alone.)
- The sale no longer counts in **Sales**, **Revenue**, **Profit** or **Devices sold**, and no longer counts toward the customer's **Purchases** and **Spent**.
- You can still open the receipt, and email the customer a **Sale voided notice**.

You cannot un-void a sale. If you voided by mistake, record a new sale for the same devices.

> Money is handled outside the app. Voiding does not refund anyone; it only fixes your records. Give any refund through whatever method you took payment with.

## Changing a warranty after the sale

Administrators can fix the warranty on an existing sale, which is useful when you chose the wrong period or agreed a goodwill extension.

1. Open the receipt.
2. Press **Change warranty**.
3. Pick a period from the **Warranty** list. It offers your current periods, plus the one already on the sale if it has since been archived.
4. Press **Save**. You see "Warranty updated".

The end date is worked out again from the original sale date, not from today. For example, changing a 30-day warranty to 90 days on a sale made 40 days ago gives a warranty that ends 50 days from today.

## Export CSV

**Export CSV** downloads a spreadsheet of the sales currently shown, meaning your filters apply. If you want one month, set that first. The file is named like `sales-20261031.csv` and has one row per sale with these columns: receipt, date, customer, devices, payment, warranty, warranty_ends, total, cost, profit and voided. Voided sales are included, marked "yes" in the last column.

It opens in Excel, Numbers and Google Sheets. It is built in your browser and does not pass through the server. Two things to know:

- The file includes your cost and profit. Think before you share it.
- To get the sales together with inventory, customers and your settings in a single download, an Administrator can use **Export everything** on the Security page. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Common mistakes and tips

- **Forgotten filters.** A leftover search or date range makes sales seem to vanish. Use **Clear filters**.
- **Voiding the wrong sale.** Check the receipt number and customer before you confirm. A void cannot be reversed.
- **Expecting the receipt to change when you edit a customer.** Receipts keep the details they were created with.
- **Using Print for a PDF.** Most browsers let you choose "Save as PDF" in the print dialog if you want a digital copy.
- **Same number tag.** It means two sales share a receipt number. It is only a flag; open each to check which is which.
- **Trial ended.** When your trial or paid period ends, the app becomes read-only. You can still look at sales and export, but not record or void. See [Plans, trials and billing](#/docs/plans-trials-billing).

For answers to common questions, see [Troubleshooting and FAQ](#/docs/troubleshooting-faq), and the [Glossary](#/docs/glossary) for any unfamiliar word.
