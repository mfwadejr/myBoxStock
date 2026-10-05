---
title: Customers
summary: Keep a list of the people you sell to, see what each one has bought, export or erase their details, and find anyone in seconds.
keywords: customers, paging, per page, next, previous, customer list, buyers, contacts, phone, email, notes, purchase history, search, export customer, erase customer, delete customer, privacy, data request, GDPR
order: 5
covers: nav:customers, 25 / 50 / 100 per page, Previous, Next, Showing 1–25, Add customer, Search name, phone, email, Name, Phone, Email, Notes, Purchases, Spent, Last purchase, Save, Cancel, Close, Delete, Erase, Export, customer.csv, purchases.csv, purchase_items.csv, Erased customer, customers.read, customers.write
---

## What the Customers page is for

The **Customers** page is your address book for the people who buy from you. Each customer has a name, a phone number, an email address and a free-text note, and the app works out for itself how many times they have bought, how much they have spent, and when they last bought.

Why bother keeping customers? A few real-life examples:

- A customer calls and says the box you sold them last month has stopped working. You type their name or phone number into the search box, open their record, and see every purchase, the receipt number, and whether they are still in warranty. You do not have to dig through paper receipts.
- You want to email a receipt again. Because the customer's email address is saved, it is already filled in for you when you send it from [Sales](#/docs/sales).
- A regular comes in and you want to know how much they have spent with you over the year, or you want to remember that "prefers to be called after 5 pm".

Like everything else in myBoxStock, your customer list is encrypted in your browser with your own key. Only people who sign in to your account can read it. Your site administrator cannot. See [Your data, your responsibility](#/docs/your-data-your-responsibility) for what that means for you.

> The page header shows how many customers you have and reminds you that only your team can read this list.

## Who can see and change customers

What you can do depends on your user type (your role). The three types are explained in full on the [Team](#/docs/team) page.

- **Administrator** and **Standard** users can see customers and also add, change, delete and erase them.
- **View** users can see the list and open a customer, but everything is read-only. They get a **Close** button instead of **Cancel** and **Save**, the fields are greyed out, and the **Add customer**, **Delete** and **Erase** buttons are not shown.
- If your user type does not include customers at all, the **Customers** menu item is hidden, and if you reach the page anyway it says "Your user type does not include customers."

Anyone who can see a customer can also use **Export** on that customer (see below).

## Finding your way around the list

Open **Customers** from the menu. You will see a table with these columns:

- **Name** - the customer's name. The list is sorted alphabetically by name.
- **Phone** - their phone number, or a dash if you did not enter one.
- **Email** - their email address, or a dash.
- **Purchases** - how many sales they have. Voided sales are not counted.
- **Spent** - the total of those sales.
- **Last purchase** - the date of their most recent sale, or a dash if they have never bought.

Click anywhere on a row to open that customer.

### Pages

The list shows **25 rows per page**. Under it a line says, for example, "Showing 1–25 of 60", with a **25 / 50 / 100 per page** list and **Previous** and **Next** buttons. Choose 50 or 100 to see more at once. These controls hide when everything fits on one page of 25 or fewer. Changing the search or a filter always takes you back to page 1. Every customer is in the list; none are cut off.

### The search box

Above the table is a search box labelled **Search name, phone, email**. Type a few letters and the list narrows as you type. The search looks in the name, the phone number, the email address and the notes, and it ignores capital letters. For example, typing `smith` finds "Dana Smith", and typing `555-01` finds anyone whose phone number contains it. It also finds words you put in the notes, such as "church group".

If nothing matches you will see "No customers match." If you have not added anyone yet you will see "No customers yet. They are added here or during a quick sale."

> Tip: you do not need to type the whole phone number. Part of it is enough, and the search checks the notes too, so a note like "friend of Marcus" makes that customer easy to find later.

## Adding a customer

There are two ways a customer gets onto your list.

### Way 1: from the Customers page

1. Open **Customers** from the menu.
2. Press **Add customer**. A form opens.
3. Fill in the fields (described in the next section). Only **Name** is required.
4. Press **Save**. You will see a short "Saved" message and the new customer appears in the list.

Press **Cancel** at any time to close the form without saving anything.

### Way 2: during a Quick sale

When you are ringing up a sale on the [Quick sale](#/docs/quick-sale) page you can choose **New** under Customer, type the name, phone and email, and finish the sale. The customer is created at the same moment as the sale. This is the fastest way to build your list because you never have to enter anyone twice. Note that this needs permission to add customers; if your user type cannot, the app tells you "Your user type cannot add customers."

Why add customers up front? Say a friend tells you they will be buying three boxes on Saturday. Adding them now means that on Saturday you simply pick them from the list under **Existing** at Quick sale, rather than typing their details while they wait.

## The customer form, field by field

The same form is used for adding and for editing.

- **Name** - required. If you press Save with this blank you are told "Enter a name." Use whatever you will remember, such as a full name or "Dana S. (cafe)". The name is copied onto each receipt at the moment of sale.
- **Phone** - optional free text. You can type it however you like; the app does not reformat it.
- **Email** - optional. If you fill this in, it is offered automatically when you email a receipt to this customer. Use a valid address so receipts reach them.
- **Notes** - optional, free text with room for several lines. Good uses: delivery preferences, which box models they like, a reminder to follow up, how they found you. Do not put anything in notes that you would not want to show to a customer who asks for a copy of their data (see Export below).

### Editing an existing customer

1. Click the customer's row.
2. Change any of the four fields.
3. Press **Save**. The list refreshes with the new details.

> Changing a customer's name later does not rewrite old receipts. Each sale keeps the name the customer had at the time. That is deliberate, so your records stay as they were. The only way to remove a name from past receipts is Erase, which is meant for people who have asked for their details to be removed (see below).

## The Purchases section

When you open an existing customer, below the four fields you will see a **Purchases** heading. It lists every sale for that customer, newest first. Each line shows:

- the receipt number (for example `S-20261004-7K2Q`),
- the sale total,
- the date and how many items were on it,
- a warranty badge saying whether the warranty is still running, has expired, or there was none.

Click a line to open the receipt. From the receipt you can print it, email it, or, if you have permission, void the sale or change the warranty. All of that is explained on the [Sales](#/docs/sales) page.

If the customer has never bought, you will see "No purchases yet."

Important details:

- Voided sales are left out of this list and out of the **Purchases** and **Spent** numbers, because a voided sale did not really happen. They are still in your sales history.
- A new customer being created has no Purchases section yet; it only appears once the customer has been saved.

## Deleting a customer

Use **Delete** when you simply do not want someone on your list any more, for example you added a duplicate by mistake.

1. Open the customer.
2. Press **Delete** (only Administrator and Standard users see this button).
3. A confirmation box asks "Delete this customer?" and explains that their past sales stay in your history under their name.
4. Press **Delete** again to confirm, or cancel.

What happens next: the customer record is removed from your list. Their old sales are not touched. The receipts still show their name, and the sales still appear on the [Sales](#/docs/sales) page. This is a good choice when the person is not asking you to remove their information, you just want a tidier list.

Common mistake: deleting a customer and expecting their name to disappear from old receipts. It will not. If they have asked for their personal details to be removed, use **Erase** instead.

## Erasing a customer for privacy requests

Sometimes a customer asks you to remove their personal information. The **Erase** button is for that.

1. Open the customer.
2. If they also asked for a copy of what you hold, press **Export** first (see below).
3. Press **Erase**.
4. A confirmation box explains what will happen: their name, phone, email and notes are removed, both from the customer record and from their past sales. The sales themselves stay (totals and receipt numbers), and show the name "Erased customer". This cannot be undone.
5. To confirm, type the word `ERASE` in the box, then confirm.

After erasing, the customer is gone from the list and their sales appear as "Erased customer" with no email attached, so you can no longer email a receipt to them from those sales. Your books still add up, because the amounts and receipt numbers remain.

The app also leaves a small note in your account's activity log that a customer was erased and how many sales were kept. It records only the count, never the person's details.

> Delete versus Erase in one line: **Delete** removes the customer from the list and leaves their name on old sales. **Erase** removes the customer and wipes their personal details from old sales too.

You are responsible for deciding when a request must be honoured and for acting on it. The app gives you the tools; the decisions are yours. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Exporting one customer's data

The **Export** button in a customer's form builds a small zip file in your browser and downloads it. It is useful when a customer asks "what do you have on me?" or when you want to keep a record before erasing.

1. Open the customer.
2. Press **Export**.
3. Your browser downloads a file named like `customer-dana-smith-20261004.zip` and you see "Exported" with their name.

The zip contains three spreadsheet files you can open in Excel, Numbers or Google Sheets:

- `customer.csv` - their name, phone, email, notes and the date they were added.
- `purchases.csv` - one row per sale, with receipt number, date, devices, payment method, warranty, total, cost, profit and whether it was voided.
- `purchase_items.csv` - one row per device on each sale, with the device, the price and the details recorded.

The file is built inside your browser. It does not pass through the server, and your site administrator never sees it. Once it is on your computer it is yours to look after, so send it to the customer through a safe route and delete your copy when you no longer need it.

> Note that `purchases.csv` includes your cost and profit columns. If you are handing the file to the customer, open it first and remove anything you do not want to share.

To export everything about your whole business, not just one customer, see the Security page described in [Your data, your responsibility](#/docs/your-data-your-responsibility).

## Button and field reference

- **Add customer** - opens an empty form (Administrator and Standard).
- **Search name, phone, email** - filters the list as you type.
- **Name / Phone / Email / Notes** - the four things you record. Only Name is required.
- **Save** - stores your changes.
- **Cancel** - closes the form without saving. View users see **Close** instead.
- **Delete** - removes the customer; old sales keep the name.
- **Erase** - removes the customer and wipes their details from old sales; asks you to type `ERASE`.
- **Export** - downloads a zip of their details and purchases.
- **Purchases list** - click a line to open that receipt.

## Common mistakes and tips

- **Duplicates.** Typing the same person twice with slightly different spellings creates two customers, and their purchases are split between them. Search before you add. If you do create a duplicate, there is no merge button, so pick one to keep and delete the other, remembering that old sales stay under the name they were sold with.
- **No email, no emailed receipt.** If a customer's email is blank you can still type an address in the email form when you send a receipt, but nothing is filled in for you.
- **Editing does not change history.** Changes to a customer's name or email apply from now on. Past receipts keep what they had.
- **Two people editing at once.** If a colleague saves the same customer a moment before you, you may see a message that someone else changed it. Reload and try again.
- **Keep notes professional.** Notes can be exported to the customer. Write them as if the customer might read them.
- **Read-only accounts.** If your trial or paid period has ended, the app is read-only and you cannot add or change customers until the account is renewed. See [Plans, trials and billing](#/docs/plans-trials-billing).

If something does not look right, the [Troubleshooting and FAQ](#/docs/troubleshooting-faq) page lists the most common questions, and the [Glossary](#/docs/glossary) explains any term you are unsure of.
