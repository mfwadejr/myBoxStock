---
title: Email
summary: Set up how the server sends email, reword each message customers and administrators receive, and check that mail is actually getting out.
keywords: sender checks, dmarc, dns, dkim selector, email, smtp, relay, direct, helo, from address, tls, port 465, 587, test email, resend, queue, bounce, spf, dkim, reverse dns, messages, placeholders, template, preview, health
order: 8
covers: nav:email, Delivery, Messages, Health, Send email, Delivery method, Direct to recipient, SMTP relay, From name, From address, Server name announced when sending (HELO), SMTP host, Port, Username, Password, Use TLS from the start of the connection (port 465), Save, Send a test, Send test email, Recent messages, Resend, Resend all failed, Subject, Heading, Body, Button label, Insert a detail, Reset to default, Send test, Live preview, Styled, Plain text, Desktop, Phone, Is email getting out, Last successful send, Failed last 24 hours, Failed last 7 days, Waiting to send, Last failure, Sender checks, Check again, DKIM selector, SPF, DMARC, DKIM, Found, Not found, Could not check, Account erased by the Host, Emails and alerts only work after the Email section is set up
---

## What email does here

**Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway.** The Email page itself shows this in a blue box above its tabs. Until it is done, nothing below can reach anyone: not sign-up and sign-in emails, not password resets, not backup-failure or alert emails, not the "account erased" message. The places in the app that depend on email warn you where that matters, for example the delete sheet in [Accounts](#/docs/accounts).

The server sends email on its own for several reasons: welcome messages when a business signs up, password resets, confirmations, "new sign-in" notices, warnings that a trial has ended, account closing notices, backup failure notices, and the problem alerts sent to you. It is outbound only: the server never receives mail, and nobody can reply to it and reach a mailbox.

The **Email** page has three tabs. **Delivery** is how mail leaves the server. **Messages** is the wording of each message. **Health** tells you whether mail is really getting out. The tab you were last on is remembered while you move around.

> Email is how customers recover access to their accounts, and how you hear about problems. If it is not working, people get stuck. Set it up early, send yourself a test, and check the Health tab from time to time.

Messages are queued, not sent in the middle of a customer's click. A background worker picks up waiting messages every 30 seconds. If sending fails, the server tries again, up to five tries, and then marks the message as failed.

## Delivery tab

### Turning mail on and off

- **Send email** is a switch. Turn it off to pause all outgoing messages. While it is off, anything waiting will fail with the reason "Outbound email is disabled in Host settings." and after five tries it is marked failed. You can send those again later with **Resend**.

### Choosing a delivery method

**Delivery method** has two buttons, and a hint underneath explains the one you picked.

- **Direct to recipient** makes the server look up each recipient's mail server and hand the message straight to it over the standard mail port, 25. No account with anyone else is needed. It works best from a server with a fixed public address, a proper reverse DNS name, and correct records on your domain (explained in the section below). Many home and cloud connections block port 25 or are distrusted by big mail providers, so messages can fail or land in spam.
- **SMTP relay** hands every message to a mail service you trust, such as Amazon SES, Mailgun, Postfix on another machine or your hosting provider's mail service. The service does the final delivery. This is the recommended choice for a real service, because those providers keep their reputation with Gmail, Outlook and others in good shape for you.

Why both exist: direct delivery needs nothing external and suits a testing setup, while a relay gives dependable delivery for production.

### Fields that apply to both methods

- **From name** is the display name recipients see. It defaults to myBoxStock.
- **From address** is the sender address, for example `no-reply@yourdomain.com`. It is required: without it, every message fails with "Set a From address first." Use an address on a domain you control, and for a relay, the address your provider has verified.

Reseller receipts are shown as sent from a business name "via" your From name, so choose a From name you are happy to have next to theirs.

### Fields for Direct to recipient

- **Server name announced when sending (HELO)** is the name the server introduces itself with when it connects to the recipient's server, for example `mail.yourdomain.com`. If you leave it blank, the machine's own host name is used. Use a name that really points to your server's address. Receiving servers compare it with your address, and a mismatch raises suspicion.

### Fields for SMTP relay

- **SMTP host** is the address your provider gave you, for example `smtp.example.com`.
- **Port** is usually 587. When the TLS switch below is on, the port is fixed at 465 and the box is locked.
- **Username** and **Password** are the relay's sign-in details. The saved password is shown as a row of stars and is stored encrypted on the server. Leave the stars alone to keep the saved one; type a new one to replace it.
- **Use TLS from the start of the connection (port 465)** is a switch. Leave it off for port 587, where the connection starts in the open and then upgrades to an encrypted one automatically. Turn it on for port 465, where encryption is there from the first moment. The page keeps the two in step: turning it on sets the port to 465, turning it off puts 587 back. Saving refuses port 465 without the switch.

### Setting up an SMTP relay, step by step

1. Sign up with a mail provider and verify your sending domain or address with them.
2. On **Delivery**, press **SMTP relay**.
3. Fill in **From name** and **From address**.
4. Enter **SMTP host**, **Username** and **Password** as the provider gives them. Use port 587 with the TLS switch off, unless your provider tells you to use 465.
5. Make sure **Send email** is on.
6. Click **Save**. A message says "Email settings saved".
7. Use **Send a test** (next section) to prove it works.

### Setting up direct delivery, step by step

1. Press **Direct to recipient**, fill in **From name**, **From address** and **Server name announced when sending (HELO)**, make sure **Send email** is on, and click **Save**.
2. Use **Send a test** to an address at a large provider such as Gmail, and check the spam folder too.

### Sending a test

1. Save your changes first. The test uses what is saved, not what is typed.
2. In **Send a test**, check the recipient box. It starts with your own email address if you have one on file.
3. Click **Send test email**.
4. Read the line underneath. "Delivered to the recipient's server." means the next server accepted it. "Not sent:" followed by a reason means it did not.

A delivered test only means the receiving server took the message. It does not promise the message avoided the spam folder, so always look in the inbox.

### Recent messages

This table lists the latest 30 messages. It refreshes by itself every few seconds. Each row shows **To**, **Subject**, **Status**, **When** and, for failed ones, a **Resend** button. Failed rows also show the reason in red under the subject.

- **queued** (amber) means waiting to be sent or waiting for another try.
- **sent** (green) means it was handed over successfully.
- **failed** (red) means it was tried five times and given up on.
- **Resend** puts one failed message back in the queue and tries it again straight away.
- **Resend all failed** appears above the table when any failed message exists, and does the same for all of them.

> After fixing a problem such as a wrong password or a closed port, use **Resend all failed** so password resets that never went out do not stay lost.

Receipts that resellers email to their own buyers are handed over directly and are not kept in this list or in the logs. The list holds the platform's own messages only.

## Making sure mail is trusted: SPF, DKIM and reverse DNS

Spam is such a problem that big mail providers check whether a message really came from where it claims. Three checks matter most. They are set up at your DNS provider (the company that manages your domain), not in myBoxStock.

- **SPF** is a short public note on your domain that lists which servers may send mail for it. If your server's address, or your relay's servers, are not on the list, the message looks forged. Your relay provider will give you the exact line to add.
- **DKIM** is a digital signature added to each message that proves it was not changed on the way. Relay providers normally sign messages for you after you add a record they supply. myBoxStock does not add its own DKIM signature, so if you want signed mail, use a relay that does it.
- **DMARC** is a public note that tells receivers what to do with mail that fails SPF or DKIM, and where to send reports. A first record that only watches (`p=none`) is a fine start.

You do not have to look these up by hand. The **Sender checks** card on the Health tab (below) looks up SPF, DMARC and DKIM for you.
- **Reverse DNS** means that looking up your server's public address gives back a name, and that name points back to the same address. It is set by whoever owns the address, usually your hosting provider. It matters mostly for direct delivery. It should match your HELO name.

A related point is a fixed (static) public address. If your address changes, the provider's trust in it starts over.

> If you use direct delivery and your messages keep landing in spam, the cure is almost always one of these three, or moving to an SMTP relay.

## Messages tab

The **Messages** tab lets you reword every message the platform sends. You change the words only. Colours, fonts, the logo and layout come from the site theme and cannot be changed here. All accounts receive the same text, and it is English only.

### The editor

A selector at the top lists the messages, grouped as **Account**, **Trial** and **System**, in the form "Group · Name", with "(edited)" after any whose wording you have changed. The groups hold:

- Account: Welcome, New sign-in alert, Confirm your email, Password reset, Password reset (several accounts), Temporary password, Two-factor reset, Account closing, Account erased (sent by the hourly closing sweep) and Account erased by the Host (sent once when a Host administrator deletes an account; it carries the optional reason).
- Trial: Trial ended.
- System: Backup failed, Host alert and Test message.

Below the selector are the fields:

- **Subject** is the email's subject line, up to 200 characters.
- **Heading** is the large title inside the message, up to 120 characters.
- **Body** is the text, up to 4000 characters. A blank line starts a new paragraph. Use plain words only.
- **Button label** appears only for messages that carry a button, such as Welcome or Password reset. Up to 60 characters. The button's link is added by the server.
- **Insert a detail** lists small buttons such as `{{name}}` or `{{accountCode}}`. These are placeholders: the server swaps each one for the real value when the message is sent. Click one to insert it where the cursor is in the last Subject, Heading or Body box you clicked in. Hover over a button to see what it stands for.

### Placeholders

A placeholder is a word in double curly brackets, such as `{{name}}`, swapped for the real value when the message is sent. Each message offers only the ones that make sense for it, such as name, Reseller ID, username, trial sentence, erase date, sign-in address, device and time, problem, alert headline and details.

Some are required and are listed as "Must stay in the message". For example Account closing must keep `{{eraseDate}}`, and Backup failed must keep the time and problem. If you remove a required one, or type one the message does not allow, a red note names the problem and **Save** stays disabled until it is fixed.

### Preview and test send

- **Live preview** shows the message as it will look, updating as you type. **Styled** shows the full design and **Plain text** shows the version for mail apps that do not show formatting. **Desktop** and **Phone** change the preview width. The preview uses sample details such as "Alex" and a made-up Reseller ID.
- **Send test** sends the wording currently in the boxes (saved or not) to the address typed in the recipient box. The subject starts with "[Test]" and the details are samples. The line underneath tells you whether it was delivered.

### Saving and resetting

1. Pick the message and edit the fields.
2. Check the preview and, if you like, send yourself a test.
3. Click **Save**. A message says "Message saved".

If you switch to another message while you have unsaved edits, you are asked whether to discard them.

**Reset to default** is only available for a message you have changed. It asks for confirmation and then removes your changes so the original wording is used again. Saving words that match the original also counts as a reset.

> Do not remove explanations that matter. For example, the account closing text tells people that backups may hold an encrypted copy that cannot be opened without their password or recovery key. That is part of being honest with customers about how their data is kept.

### What is not here

Messages resellers send to their own buyers, such as receipts, are edited by the resellers in their own Settings.

## Health tab

The **Health** tab answers one question: is email getting out?

At the top, **Is email getting out?** shows a line like "Sending directly to recipients from no-reply@yourdomain.com" or "Sending through your SMTP relay", or says sending is turned off on the Delivery tab. A chip shows **Working** or **Needs a look**. You get "Needs a look" when sending is off, when any message failed in the last 24 hours, or when the oldest queued message has waited more than 30 minutes.

Four tiles give times and counts only. No message contents are shown.

- **Last successful send** is how long ago the last message went out, or "never".
- **Failed, last 24 hours** with a note of how many were sent in that time.
- **Failed, last 7 days** with the sent count for the week.
- **Waiting to send** is the number queued, and how old the oldest one is.

If anything failed, **Last failure** shows when and the reason given. A message that fails five times is given up on. A refusal by the receiving server, known as a bounce, appears here as the reason. If nothing has failed, the card says so.

### Reading a failure

An authentication reason means a wrong relay username or password. "Connection refused" or a timeout often means a blocked port or wrong host name. A refusal mentioning your address or a blocklist means direct delivery is distrusted: move to a relay or fix SPF and reverse DNS. "Set a From address first" and "Outbound email is disabled in Host settings" mean exactly that.

## Sender checks

At the bottom of the Health tab, the **Sender checks** card looks at the public DNS records of the domain in your From address (the part after the @). These are the records that help other mail servers trust your mail.

It runs by itself each time you open the Health tab, and shows one row for each check with a chip:

- **Found** (green): the record exists. The row quotes it and gives a note.
- **Not found** (amber): the record does not exist, with plain advice on what to add.
- **Could not check** (red): the DNS lookup did not answer. Try again in a minute.

The three checks are:

- **SPF**: looks for a TXT record that starts `v=spf1`. If more than one is found, the row says so, because receivers treat two SPF records as an error. Keep a single record.
- **DMARC**: looks at `_dmarc.` followed by your domain, and shows the policy it finds. A policy of `p=none` is flagged as monitoring only, which is a sensible first step.
- **DKIM**: looks for the signature key. DKIM keys live under a name called a selector, so the lookup is `selector._domainkey.` followed by your domain. If you type your relay's selector into the **DKIM selector** box, only that one is tried. If you leave it empty, the common ones are tried: default, selector1, selector2, google, k1, mail and dkim.

Press **Check again** after you change DNS records, or after you type a selector. DNS changes can take a while to spread, so a record you just added may not show for a few minutes.

> The app itself does not sign mail. Your relay normally does. So "DKIM not found" only matters if your relay does not sign your mail. If you use a relay, ask the provider which selector they use and type it in the box. If it says it is not found for that selector, the DNS record is missing.

If you have not set a From address yet, the card tells you to set one on the Delivery tab first. Nothing about customers is ever sent to the lookup; it only asks DNS about your own domain.

## Related pages

- [Alerts](#/docs/alerts) for email failure warnings.
- [Settings](#/docs/settings) for the site address that email links use. If it is wrong, links in emails will not work.
- [Troubleshooting and FAQ](#/docs/troubleshooting-faq) for more help.
