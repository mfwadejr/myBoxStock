---
title: Quick sale
summary: Ring up a sale by scanning or choosing devices, setting prices and discounts, attaching a customer, picking a payment method and warranty, then printing or emailing the receipt.
keywords: quick sale, sell, sale, checkout, till, scan, camera, phone camera, scan serial, barcode, uid, browse available stock, add by quantity, discount, percent off, order discount, payment method, paid by, customer, new customer, existing customer, receipt, print, email, warranty, date sold, time sold, void, refund, cancel sale, test record
order: 4
covers: nav:sell, Scan or type, Scan a serial with the phone camera, camera button, Nothing in your inventory matches, Browse available stock, Add by quantity, Available stock, Select all shown, Add to sale, model buttons, This sale, Price, % off, Remove, Customer, Existing, New, Search name phone or email, Change, Name, Phone, Email, Date sold, Time sold, Warranty, Paid by, Note (optional), % off the whole order, Subtotal before discounts, You save, Total, Complete sale, Required checks not done, Sell anyway, Receipt, Include the test record, Email, Print, Done, Send, Open in my mail app, Message, Send to, Receipt, Thank-you note, Sale voided notice, Void sale, Change warranty
---

## What Quick sale is for

Quick sale is the screen you use at the counter. You add the devices a customer is buying, adjust prices if you need to, say who the customer is and how they paid, and press **Complete sale**. The app marks the devices as sold, saves a receipt with its own number, and offers to print or email it.

It is a single screen designed to work on a phone as well as a computer, so you can sell from a market stall, a delivery run or the shop floor.

Quick sale appears in the menu only for people whose user type allows recording sales: Administrators and Standard users. View users do not see it. If you open it without permission it says your user type cannot record sales. See [Team](#/docs/team).

> Note: if your trial or paid period has ended, the account is read-only and sales cannot be saved. See [Plans, trials and billing](#/docs/plans-trials-billing).

## Before your first sale

Check that:

1. Your devices are entered in [Inventory](#/docs/inventory), with a Selling price. Quick sale starts each line at the device's Selling price.
2. The Warranty periods and Payment methods in [Settings](#/docs/settings) match how you trade.
3. If you want devices tested first, your test rules are set in Settings.

## Selling step by step

1. Open **Quick sale** from the menu (or press the **Quick sale** button on Home).
2. Add devices (see the three ways below).
3. Check each price and any discount in the **This sale** card.
4. Choose or enter the customer.
5. Check the date, time, warranty and payment method.
6. Check the **Total**, then press **Complete sale**.
7. The receipt appears. Print it, email it, then press **Done**.

## Adding devices

### Scan or type an identifier

The big box at the top says "Scan or type" followed by the names of your lookup identifiers, for example UID, Serial number, MAC address, and "press Enter". It is selected automatically when the page opens.

1. Scan the barcode, or type the number and press Enter.
2. The device is added to the sale at its Selling price.

A small camera button sits inside the right end of the box. Tap it to scan with your phone's camera (see below).

Any label the scanner sends, such as "UID" or "SN", is stripped off. Capital letters do not matter. Which identifiers are searched is decided by the Look up in sale setting in [Settings](#/docs/settings).

Under the box a message in red appears when something cannot be added:

- Nothing in your inventory matches what you typed. The message reads: Nothing in your inventory matches "the code".
- The device was already sold (with the date).
- The device is awaiting its tests and cannot be sold yet. Tick its test steps in Inventory first.
- The device is marked Reserved, Damaged or Archived, so it is not available.
- The device is already in this sale.

### Scan a serial with the phone camera

You do not need a barcode scanner. Your phone camera can read the barcode on the box or label.

1. Tap the **camera button** inside the scan box. The scanner opens full screen with the title "Scan a serial to add to the sale".
2. Hold the phone over the barcode and fit the whole code inside the bright box, with the thin line across the middle of the code. The line turns green when the code is read.
3. The phone beeps (and buzzes where it can), the screen says "Got it", the matching device goes into **This sale**, and the scanner closes. A small message "Scanned (the number)" appears.
4. To add another device, tap the camera button again.

If nothing in your inventory matches the code, the scanner **stays open** and shows the message in red: Nothing in your inventory matches "the code". Try another label on the box, or tap **Type it instead** and type the number. The same red messages as for typing apply (already sold, awaiting test, not available, already in this sale).

The scanner has more buttons, such as **Small / Medium / Large**, **Flash**, **Take a photo** and **Type it instead**. They are explained step by step on [Scanning with your phone camera](#/docs/scanning-with-your-phone). The camera works only when the site is opened over https. A hardware barcode scanner that types into the box still works exactly as before.

### Browse available stock

If you do not know a device's number, or you are selling several of one kind, press **Browse available stock**. A list called **Available stock** opens.

1. The top says how many devices are shown, for example "8 of 20 available devices".
2. Use the search box (make, model, UID, serial, MAC and so on) to narrow the list.
3. The model buttons, such as "All · 20" and "Fire Stick 4K · 8", filter by model.
4. Tick the devices you want. Each row shows the name, identifiers, the condition and test chips, and the price.
5. **Select all shown** ticks every device currently visible.
6. Press **Add to sale** (the button counts them, for example "Add 3 to sale"). **Cancel** closes the list.

Only devices that are Available or Returned, ready to sell, and not already in the sale are listed.

### Add by quantity

Press **Add by quantity** when you just need, say, five of one model and do not care which five.

1. Choose the **Model**. Each choice shows how many are available.
2. Type **How many**.
3. Press **Add to sale**.

The app adds the oldest available units of that model first (by Date received), which helps you sell older stock before newer. You can remove any of them afterwards. If you ask for more than are available, it tells you how many there are.

### The model buttons

Beneath the scan box, a button for each model shows how many are available, such as "Fire Stick 4K · 8". Pressing one opens Browse available stock already filtered to that model.

## The This sale card

Each device you add becomes a line showing:

- The device name and its identifiers.
- A test chip (Tested, Tested 2/5 or Not tested). If some required checks are not ticked a red **Required checks missing** chip appears.
- **Price**: the amount for this device. It starts at the Selling price. Change it for this sale only; it does not alter the device in Inventory.
- **% off**: a discount in percent for this device alone. Leave it empty for none. It accepts decimals up to one place and the value is kept between 0 and 100.
- A cross (**Remove**) to take the device out of the sale.

Why change the price? Perhaps you agreed a bundle deal, or the buyer is a friend. Why use **% off**? To give a visible discount that is recorded on the receipt as "10% off", with the original price crossed out.

## Discounts on the whole order

Under the customer area you will find **% off the whole order**. Type a percent to discount the combined total after any line discounts. Example: three boxes at 50.00 each with 10 percent off one gives 145.00, and 10 percent off the whole order takes off 14.50 more, for a total of 130.50.

The sum area shows **Subtotal before discounts** and **You save** whenever a discount applies, and **Total** is always shown.

### The discount limit

Administrators can give any discount. For Standard users, an Administrator sets a maximum total discount (10 percent unless changed) in [Settings](#/docs/settings). The label then reads "% off the whole order (you can give up to 10%)". If the savings on a sale add up to more than your limit, pressing **Complete sale** is refused with a message telling you to ask an Administrator or reduce the discounts. The limit counts all discounts together, as a share of the list price.

## Choosing the customer

Every sale must have a customer. The **Customer** card has two modes, **Existing** and **New**. If you have no customers yet it starts on **New**; otherwise on **Existing**.

### Existing customer

1. Type in the search box (name, phone or email). Up to six matches appear.
2. Click one to attach it. The card shows the name and phone.
3. Press **Change** to pick someone else.

### New customer

1. Press **New**.
2. Type the **Name**. It is required.
3. Optionally type the **Phone** and **Email**.
4. When you complete the sale the customer is created and saved automatically, and attached to the sale.

Adding a new customer requires permission to add customers, which Administrators and Standard users have. Add the email if you want to send a receipt; it is filled in for you later. See [Customers](#/docs/customers).

> Tip: check for an existing record before creating a new one, to avoid two entries for the same person.

## Date, time, warranty, payment and note

- **Date sold** and **Time sold**: start as now. Change them if you are recording a sale that happened earlier, such as when you were offline at a market. You cannot choose a date in the future; the date box stops at today and the sale is refused if the time is in the future. The receipt, reports and warranty end date all use this date.
- **Warranty**: the cover you are giving, from the list set in Settings (for example No warranty, 30 days, 60 days, 90 days, 1 year). The end date is worked out from the sale date and printed on the receipt. If a period is later changed in Settings, past sales keep what they were sold with.
- **Paid by**: how the customer paid, from your own list (by default Cash, Card, Bank transfer, Other). It is saved by name on the sale.
- **Note (optional)**: a short message that appears on the receipt, such as "Includes HDMI cable".

## Completing the sale

Press **Complete sale**. It is disabled until there is at least one device. The app checks:

1. A customer is chosen, or a new customer has a name.
2. The discounts are within your limit.
3. Required test steps. If any device has required steps not ticked, a box titled **Required checks not done** lists those devices and asks whether to sell anyway. Press **Sell anyway** to proceed; the sale record will show what was and was not done. Cancel to go back and finish the tests. (If Sell only tested devices is on, untested devices could not be added in the first place.)
4. The date and time are not in the future.

Then it saves the sale and sets each device to Sold. If someone else changed one of those devices a moment earlier, you will be told to check the cart and try again.

What gets recorded: a receipt number such as `S-20261005-K7P2Q`, the date, your customer, each device with the price list and net price, any discounts, the cost of each device (for profit), the payment method, the warranty, your note, and a snapshot of the test record and any "On sale record" details as they were at that moment.

## The receipt

After saving, the **Receipt** opens with your business name, number, date, customer, each device (with its discount and any recorded details), order discount, **Total**, **Paid by**, warranty lines and your note, ending in "Thank you!".

If any device has a test record, a tick box **Include the test record (shows what was checked before it was sold)** adds the steps, who tested and when, any From/To values, and notes. Use it when a customer wants proof, leave it off for a simple receipt.

### Print

**Print** opens your browser's print window with only the receipt. You can print to paper or save as a PDF.

### Email

**Email** opens a small form.

1. Choose the **Message**: **Receipt** or **Thank-you note** (for a voided sale, **Sale voided notice** or Receipt).
2. In **Send to**, check the customer's email (filled in from their record) or type one.
3. Press **Send**. The text says whether it goes from the site's shared sender, with replies to your own email address, or from your own mail server if the Administrator set that up in Settings. The receipt is not kept on the site's server.
4. Or press **Open in my mail app** to write the message in your own email program instead.

If you want wording and logo of your own, an Administrator can set them in [Settings](#/docs/settings).

### Done

**Done** closes the receipt and clears the Quick sale screen for the next customer.

## Voiding a sale

Made a mistake? Voiding cancels a sale but keeps the record.

1. Find the sale: open it from [Sales](#/docs/sales), from Home's Recent sales, or from the customer's purchases in [Customers](#/docs/customers). (The receipt shown straight after completing a sale does not offer Void; reopen it from Sales.)
2. In the receipt press **Void sale**. It asks "Void this sale?" and explains the devices go back to available and the sale stays in your history marked as voided.
3. Confirm with **Void sale**.

The receipt then says "This sale was voided." Voided sales are left out of the totals on Home and Sales. You can email a **Sale voided notice** to the customer. The Void button needs permission to record sales. Money handling (a refund) is up to you outside the app.

### Change warranty

Administrators see **Change warranty** on a receipt. Choose a different period and save; the end date is recalculated from the sale date.

## Common mistakes

- Forgetting to attach a customer. The app will not complete the sale without one.
- Choosing the wrong payment method. Cannot be changed after the sale except by voiding and re-entering, so check before pressing Complete sale.
- Typing a price in cents. Prices are in dollars and cents, for example 49.99.
- Discounting twice by accident, on a line and on the whole order. Watch **You save**.
- Entering a sale for another day without changing the date. Use **Date sold** and **Time sold**.
- Selling a device marked Reserved. Change its status in [Inventory](#/docs/inventory) first.

See also [Sales](#/docs/sales) for reviewing past sales and [Inventory](#/docs/inventory) for stock.
