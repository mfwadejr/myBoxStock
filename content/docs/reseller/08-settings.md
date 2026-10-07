---
title: Settings
summary: Set up how myBoxStock works for your business - the details you record on each device, warranty periods, payment methods, makes and models, test checklist, discounts, locking, and your own email sending and wording.
keywords: reorder, move rows, drag, drag handle, grip, six dots, change order, camera button, scan, settings, setup, configure, fields, device details, warranty periods, payment methods, makes, models, catalog, test checklist, discount limit, standard user, unlock, auto lock, idle, smtp, own mail server, email wording, logo, receipts, customer emails, export, close account, save changes
order: 8
covers: nav:settings, camera button on lookup and unique details, Save changes, Device details to track, Add a detail, Name, Track, Look up in sale, Must be unique, On sale record, Choices, Reorder, Drag handle, Remove, Warranty periods, Add a period, Length, Unit, Make default, Archive, Restore, Default, Payment methods, Add a method, Makes and models, Add a make, Rename or merge, Add model, Unlock behaviour, After a browser refresh, Lock automatically after, Email sending, Send from my own mail server, From name, From address, SMTP host, Port, Username, Password, Use TLS from the start of the connection, Send a test email to me, Customer emails, Choose logo, Remove logo, Subject, Heading, Body, Insert a detail, Back to default wording, Discounts, Most a Standard user can discount, Test checklist, Use a test checklist, Sell only tested devices, Add a step, Details, Required before sale, Add an item, Save choices, users.manage
---

## What the Settings page is for

**Settings** is where you shape myBoxStock to fit the way you run your business. Do you track a serial number or only a UID? Do you give 30-day or 90-day warranties? Do you take cash, card and bank transfer? Do you test every box before you sell it? All of that is set here, once, and then the rest of the app follows your choices.

Settings is only for **Administrators**. Anyone else does not see it in the menu, and if they reach it they are told "Only Administrators can change these settings." The user types are explained on the [Team](#/docs/team) page.

Your settings are saved encrypted with the rest of your business data, so the site operator cannot read them. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## Saving: read this first

Most of the page works like a form. You make changes, and nothing is stored until you press **Save changes**. If you leave the page without pressing it, your changes are lost. When it works you see "Settings saved". If something is missing or clashes, you are told what to fix and nothing is saved.

There is one exception. The **Makes and models** card saves each change straight away, and tells you so with a message such as "Model added".

> Tip: work through the page, press **Save changes**, and then go to Inventory or Quick sale to see the effect. If you are about to try something unusual, change one card at a time so it is easy to see what caused what.

### Things people ask about that are not on this page

- **Business name.** It is set when the account is created. This page does not change it. It is shown in the header and printed on receipts and emails.
- **Your logo.** The logo you can choose here is for customer emails (see the Customer emails card below). The on-screen and printed receipt shows your business name.
- **Backups, exporting your data and closing your account.** Backups live on their own page, [Backup and restore](#/docs/backup-and-restore), which is next to Settings in the menu. **Export everything** is there and on the [Security](#/docs/security) page, where **Close account** is too. They are explained in [Your data, your responsibility](#/docs/your-data-your-responsibility).
- **Backups do include your settings.** Your fields, test steps, warranty periods and catalog are inside a backup file, so a restore brings them back too. The team list (usernames, emails and user types, never passwords) is in the file too; see [Team](#/docs/team).
- **People and roles.** See [Team](#/docs/team).

## Device details to track

This card decides what you record about each device in [Inventory](#/docs/inventory). The header text explains it: turn on what you record, identifiers you scan or type at the till are looked up in Quick sale, and anything ticked for the sale record is copied onto the sale.

Out of the box you have **UID**, **Serial number**, **MAC address**, **Condition** (New, Refurbished, Used) and **Supplier**. Make, model, cost, selling price, status and notes are always available and are not listed here.

Each row has these controls:

- **Name** - a text box with the label. You can rename it. Names must be unique and cannot be blank. Next to it is the type of detail (Text, Number, Date, Yes / No, or Choice from a list). For a Choice detail it is instead a button labelled **Choices (n)**, where n is how many choices there are.
- **Track** - tick to use this detail. Unticked details are hidden everywhere in the app but anything already entered is kept.
- **Look up in sale** - tick if you want Quick sale to find a device by this detail. Use it for things you can scan or type to identify a box, such as UID or serial number. Only text details can be looked up. A text detail that is ticked **Look up in sale** or **Must be unique** also gets a small **camera button** inside its box in Add device and Edit device, so you can scan it with your phone (see [Scanning with your phone camera](#/docs/scanning-with-your-phone)). The MAC address detail only accepts MAC-shaped codes from the camera.
- **Must be unique** - tick to stop two devices having the same value. Great for UID and MAC address, since no two boxes should share them. Only text details can be unique.
- **On sale record** - tick to copy this detail onto the sale and show it on the receipt. For example, ticking Serial number means the customer's receipt lists the serial number of the box they bought, which helps in warranty claims.
- **Remove** (a cross) - removes the detail from the list. A confirmation says it stops showing in Inventory, Quick sale and new sale records, but what was already entered is kept and only hidden. It takes effect when you press **Save changes**.
- **Reorder** (a switch at the top right of the card) - see "Changing the order of a list" below. It is off normally, so the rows are locked and the page has more room on a phone.

For Number, Date and Yes / No details the Look up and Unique boxes are greyed out, because they only make sense for text.

### Add a detail

1. Press **Add a detail**.
2. Type a **Name**, for example "Firmware version" or "Remote model".
3. Choose a **Type**: Text, Number, Date, Yes / No or Choice from a list.
4. If you chose Choice from a list, type **Choices (separated by commas)**, for example `Good, Fair, Poor`. At least one is needed.
5. Press **Add**, then **Save changes**.

New details start ticked as Track but not Look up, Unique or On sale record; tick those yourself if you want them.

### Editing choices

Press **Choices (n)** next to a Choice detail. Enter one choice per line in the box, then press **Save choices**. Devices that already use a choice you remove keep it; it simply stops being offered. You must keep at least one choice.

### The rule to remember

You must have at least one detail that is both ticked **Track** and **Look up in sale**. Otherwise Quick sale would have no way to find a box, and Save changes tells you "Turn on at least one detail to look up in Quick sale."

### Changing the order of a list

Device details, warranty periods, payment methods and test steps each have a **Reorder** switch at the top right of their card. It starts off, and while it is off the rows are locked, so you cannot move one by accident and scrolling the page never drags a row.

1. Turn **Reorder** on for the card. Every row now shows a handle made of six grey dots at its right end.
2. Press and hold the handle (with a mouse, a pen or your finger) and drag the row up or down. On a phone the page scrolls by itself when you hold the row near the top or bottom of the screen. Only the handle moves a row; touching anywhere else on the row scrolls the page as usual.
3. Let go to drop the row in its new place.
4. Turn **Reorder** off to lock the order in, then press **Save changes**. The new order is used in Add device, Quick sale, receipts and the test checklist.

With a keyboard or a screen reader: Tab to a row's handle, press **Space** to pick the row up, press the **Up** and **Down arrow** keys to move it (**Home** and **End** jump to the top and bottom), then press **Space** to drop it. **Escape** puts it back where it was. The screen reader says the row's new position after every move, for example "Remote tested, position 2 of 5".

> The order is part of your settings, so it is saved, encrypted, when you press **Save changes**, like everything else on this page.

## Warranty periods

This card is the list of warranties you offer at [Quick sale](#/docs/quick-sale). The standard list is No warranty, 30 days, 60 days, 90 days and 1 year.

Each sale remembers the warranty it was sold with, so changing this list never changes past sales.

Controls:

- **Name** - a text box you can rename. A grey tag next to it shows the real length, or "No cover".
- **Default** - a green tag on the period that is pre-selected at Quick sale.
- **Make default** - makes another period the pre-selected one. (Greyed out for an archived period.)
- **Archive** and **Restore** - hide a period from Quick sale without deleting it, or bring it back. The default period cannot be archived; make another one the default first.
- **Remove** (a cross) - deletes a period, only possible if no sale has used it. Once used, you can archive it instead.
- **Reorder** - the switch at the top of the card; turn it on to change the order shown at Quick sale (see below).

### Add a period

1. Press **Add a period**.
2. Enter a **Length** from 1 to 120.
3. Choose the **Unit**: Days, Months or Years.
4. Optionally type a **Name**. If you leave it blank the app names it for you, for example "6 months".
5. Press **Add**, then **Save changes**.

Why use this? A reseller who sells refurbished boxes might offer "30 days" for used and "1 year" for new. If you sometimes sell "as is", keep **No warranty** in the list. Every period must have a unique name.

## Payment methods

The choices under **Paid by** at Quick sale. The starting list is Cash, Card, Bank transfer and Other.

- **Name** - rename it (up to 40 characters). Each sale keeps the name it was sold under, so renaming never changes past receipts.
- **Make default** and the green **Default** tag - which method Quick sale pre-selects.
- **Archive** and **Restore** - hide a method you no longer take, or bring it back. The default cannot be archived.
- **Remove** (a cross) - only for a method no sale has used, and never the last remaining one.
- **Reorder** - the switch at the top of the card; turn it on to change the order of the methods (see below).
- **Add a method** - adds a blank row. Type its name, then press **Save changes**.

Example: you start accepting a payment app. Press **Add a method**, type its name, and press **Save changes**. It is available at Quick sale straight away. Names must be unique and cannot be blank.

## Makes and models

These are the drop-down lists of **Make** and **Model** offered when you add a device. They are built from the devices you enter, and you can also add names ahead of time and tidy them here.

Each make appears with how many devices use it, and under it, its models. Capital letters never create a second entry: typing "ACME" next to "Acme" reuses "Acme". If a name has been entered in several spellings, a note says "Also entered as ..." and suggests Rename or merge.

Buttons:

- **Add a make** - type a name in the box that opens, then press **Save**. You can add its models afterwards.
- **Add model** (on a make) - adds a model under that make.
- **Rename or merge** (on a make or model) - type the new name. If you type a name that already exists, the two are merged and every device moves to it; a confirmation asks you first for makes. You are told how many devices were updated.
- **Remove** (a cross) - only shown when no device uses that make or model.

These changes save straight away and update the devices that use them. Past sales keep the name they were sold under.

Why use it? If your list has "vSeeBox", "VSeeBox" and "v-seebox", merging them keeps your stock counts and filters accurate.

## Unlock behaviour

Your data is encrypted in the browser, and the browser needs your account key to read it. This card decides what happens when someone on your team refreshes the page. It applies to everyone on the account.

- **After a browser refresh** has two choices:
  - **Ask for the password again (most private)** - the standard choice. A refresh locks the data until the person types their password.
  - **Stay unlocked while this tab is open** - a refresh does not interrupt them.
- **Lock automatically after (minutes without activity)** - appears only when you choose to stay unlocked. Enter a number from 1 to 1440 (that is 24 hours). After that many minutes without activity, the data locks.

The card warns about the trade-off. Staying unlocked keeps the account key in that tab's temporary browser storage. It is cleared when the tab closes, when someone signs out, and after the idle time. Malicious script running on the page while the tab is open could use that key, so keep the default if the device is shared or untrusted. A shop till on a private counter might reasonably choose to stay unlocked; a shared family laptop should not.

## Email sending

When you email a receipt, it normally goes from the site's shared sender, with replies coming back to your own email address. This card lets you send from your own mail server instead, so receipts come from your own business address.

1. Turn on **Send from my own mail server**. The fields appear.
2. Fill in:
   - **From name** - the name customers see. If blank, your business name is used.
   - **From address** - the email address messages come from, for example `sales@yourbusiness.com`. Required.
   - **SMTP host** - your mail provider's server name, for example `smtp.example.com`. Required. Your mail provider (Gmail, Outlook, your web host or an email service) can tell you this.
   - **Port** - usually 587.
   - **Username** and **Password** - your mail account's sign-in. Some providers need an "app password" instead of your normal one.
   - **Use TLS from the start of the connection (port 465)** - leave off for port 587. If you turn it on, the port is fixed at 465.
3. Press **Send a test email to me**. A test message is sent to your own email address, and you are told it was sent or what went wrong.
4. Press **Save changes** at the top of the page to keep the details.

If you tick the box but leave the host or From address blank, saving is refused with a reminder to fill them in or turn the option off.

Privacy: the details are saved encrypted with your account data. When you send, they pass through the site once to reach your mail server and are not stored, logged or queued there. Anyone on your team who can send receipts can use them, so only make people Administrators if you trust them with this.

Typical problems are shown in plain words: the server could not be reached, the login was refused (check the username and password), the port is not allowed, or the server is on a private network the site cannot reach.

## Customer emails

This card appears when your site has email wording available. It controls the look and wording of messages your customers receive, such as receipts. They show your business name and your logo, not ours.

### Your logo

- **Choose logo** - pick a PNG, JPEG, WebP or GIF picture from your device. It is shrunk automatically to at most 256 pixels and must be small once shrunk; if it is too detailed you are told to try a simpler one. A square picture works best.
- **Remove logo** - clears it (greyed out when there is none).
- The picture shows next to the buttons, or "No logo".

Press **Save changes** to keep it.

### Reword the emails

1. Use the drop-down at the top of the card to pick which message to edit. The choices include the receipt, the sale voided notice, the thank-you note and your own-mail test message.
2. Edit the **Subject**, **Heading** and **Body**. A blank line starts a new paragraph. Keep `{{message}}` in the body of the receipt so the receipt details appear.
3. To add a detail such as the customer's name or receipt number, click into the box you want, then press the matching button under **Insert a detail**. It is inserted where your cursor was.
4. Watch the preview beside the form. It uses sample details and updates as you type. Anything wrong appears in red under the form.
5. Press **Back to default wording** to undo your changes to the message you are editing. It is greyed out if you have not changed anything.
6. Press **Save changes**.

If you do not change a message, the standard wording is used.

## Discounts

Quick sale lets you take a percent off one device or the whole order. Administrators can give any discount. In this card, **Most a Standard user can discount (%)** sets the most a Standard user may give in total on one sale, from 0 to 100. The starting value is 10.

Example: with 10, a Standard user selling a 100.00 box can give up to 10.00 off. Anything more is refused with a message that tells them to ask an Administrator or reduce it. Set it to 0 so Standard users cannot discount at all.

Because your data is encrypted, the server cannot enforce this limit. It is checked in the app when the sale is completed. Treat it as a guard rail against honest mistakes, not a security control.

## Test checklist

This card is the list of checks you do on each device before selling it, such as "Remote tested". People tick these steps in Inventory, and who did it and when is recorded and copied onto the sale. If a customer later says it never worked, you can show what was done.

- **Use a test checklist** - turn this off if you do not test devices. The test record is then hidden in Inventory, Quick sale, receipts and CSV files. Nothing already recorded is deleted.
- **Sell only tested devices** - when on, a device stays "Awaiting test" until its required steps are ticked (every step, if none are marked required). It is not counted as available and cannot be added to a sale. This option is greyed out when the checklist is off.
- **Add a step** - adds a blank row; type what you check, for example "Remote tested". Greyed out when the checklist is off.

Each step has:

- a text box for the step name,
- **Details (n)** - extra items to fill in when the step is ticked,
- a **Required before sale** tick,
- a **Remove** cross. Use the **Reorder** switch at the top of the card to change the order of the steps.

The starting steps are Device inspected, Batteries installed in remote, Remote tested, Device tested, and Code / firmware upgraded (if needed), which has Launcher and Firmware details.

### Details on a step

Press **Details (n)** to add extra items, such as Launcher or Firmware recorded as a From and To pair.

1. Press **Add an item** and type an **Item name**.
2. Choose its kind from the list: **Text**, **From -> To** or **Choice from a list**. For a choice, type the choices separated by commas.
3. Press **Remove item** on any row you no longer want.
4. Press **Save**.

Each item needs a unique name, and a choice item needs at least one choice. Items are optional to fill in, even when the step is required before sale.

### How Required works

If you tick **Required before sale** on a step and the device does not have it ticked, Quick sale warns "Required checks not done" and lets the seller choose to sell anyway, with the sale record showing what was and was not done. If you also turn on **Sell only tested devices**, the device cannot be sold at all until the required steps are ticked.

## Saving checks and common mistakes

When you press **Save changes**, the app checks that:

- every detail and test step has a name, and no two details share a name,
- at least one tracked detail is set to be looked up in Quick sale,
- every warranty period and payment method has a unique name,
- the idle lock time is 1 to 1440 minutes if you chose to stay unlocked,
- the discount limit is 0 to 100,
- the mail server and From address are filled in if own-mail is on.

Common mistakes:

- **Forgetting Save changes.** Everything except makes and models is lost if you leave first.
- **Turning off look-ups.** You need at least one tracked, looked-up detail.
- **Archiving instead of removing.** Used warranty periods and payment methods can only be archived, which is fine; they stay on old sales.
- **Expecting changes to rewrite history.** Past sales keep the warranty, payment name and details they were sold with.
- **Sharing Administrator access.** Anyone with it can change all of this.

For help, see [Troubleshooting and FAQ](#/docs/troubleshooting-faq). To see these settings in action, read [Inventory](#/docs/inventory) and [Quick sale](#/docs/quick-sale), and the [Glossary](#/docs/glossary) for unfamiliar terms.
