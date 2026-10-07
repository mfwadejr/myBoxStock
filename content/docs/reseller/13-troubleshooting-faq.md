---
title: Troubleshooting and FAQ
summary: Plain-language fixes for the problems people run into most, from sign-in trouble and lost keys to scanners, receipts and read-only accounts, plus answers to common questions.
keywords: troubleshooting, camera blocked, camera busy, no camera, https, wrong barcode, mac not accepted, restore refused, this file cannot be used, account is newer than this file, undo restore, backup file size, lost recovery key backup, site restored banner, help, error, cannot sign in, locked out, forgot password, lost authenticator, lost recovery key, scanner, tap to aim, nothing read yet, got it, confirm each scan, use this, receipt email, read-only, out of date, refresh, faq, not working, problem
order: 13
covers: camera is turned off for this site, The camera only works when this site is opened over https, The camera is busy, No camera was found, Two codes are about equally close, No MAC address was found in that photo, This file cannot be used, Your account is newer than this file, There is no restore to undo, The restore did not finish, The site was restored from a backup, Copy diagnostics, Incorrect sign-in or password, Too many failed attempts, Forgot password, Reset link, Two-factor code, Recovery code, Recovery key, Unlock your data, Use your recovery key, Scanner, Bulk scan, Email receipt, Read-only, Trial ended, Closing account, Out of date page, Someone else changed this, Records could not be opened, Disabled sign-in, Suspended account, Mail server settings, Reseller ID, Change password, Reset access, Account deleted by the Host, account erased email, Too many failed attempts, Nothing read yet, Confirm each scan, Use this
---

## How to use this page

Find the sentence that looks most like what you are seeing on screen, then read the cause and the fix underneath it. Most of the messages in myBoxStock say plainly what happened and what to do next, and this page expands on them.

A few ideas help everywhere:

- Your business data (inventory, customers, sales) is encrypted in your browser with a key that belongs to your account. The hosting service stores it but cannot read it, and cannot recover it for you. That is why a few problems below can only be solved by you or by another Administrator on your team. See [Your data, your responsibility](#/docs/your-data-your-responsibility).
- To sign in you need three things: your **Reseller ID**, your **username**, and your **password**. Your Reseller ID looks like `amber-fox-4271`.
- If a problem is not listed here, note the exact words of the message you saw. They are the quickest way for support to help you.

> Emails and alerts only work after the Email section is set up, using either direct sending or an SMTP gateway. The person who runs your site sets this up, so if a message you expect never arrives, ask them to check it.

## Signing in

### I cannot sign in: "Incorrect sign-in or password."

**Cause.** One of three things does not match: the Reseller ID, the username or the password. The message is deliberately vague. It says the same thing whether the username does not exist or the password is wrong, so nobody can use the sign-in form to find out who has an account.

**Fix.** Check these in order:

1. **Reseller ID.** It is on your welcome email, on the "You're all set" screen you saw when you created the account, and on the Security page once you are in. Your Administrator can also tell you. Letters are not case sensitive and spaces are ignored, but a wrong digit will fail.
2. **Username.** This is your own username, not your email address and not the business name.
3. **Password.** Check that Caps Lock is off. If you pasted the password, make sure no extra space came along.
4. If you are sure of all three, use "Forgot password?" on the sign-in screen. See the next section.

> Tip: your browser remembers the Reseller ID (never the password) after you sign in, so next time you usually only need the username and password. On a new computer or phone you will need to type the Reseller ID again.

### Sign-in locked for 15 minutes: "Too many failed attempts. Try again in 15 minutes."

**Cause.** The same sign-in name was tried with a wrong password six times in a row. This protects your account from people guessing passwords. The lock lasts 15 minutes.

**Fix.** Wait the 15 minutes, then try again, carefully. If you cannot wait, ask the person who runs the site to unlock your sign-in: a site administrator can clear the lock from their console in one step, and it is recorded in their audit trail. They cannot see or change your password when they do; if you have forgotten it, use "Forgot password?" or ask them to email you a reset link afterwards. Trying again sooner will not work and does not help. If you are not sure of your password, use "Forgot password?" instead of guessing. If you did not make those attempts yourself, a person may be trying to get into your account, so change your password after you get back in and consider turning on two-factor sign-in. See [Security](#/docs/security).

Administrators can look at the sign-in history on the [Activity](#/docs/activity) page to see wrong-password attempts and where they came from.

### "Too many sign-in attempts from your network. Try again in a few minutes."

**Cause.** This is different from the 15 minute lock above. The site noticed a lot of sign-in attempts from the same internet connection, which can happen when several people in one shop or one office sign in at once, or when someone is guessing passwords.

**Fix.** Wait a few minutes and try again. Your own account is not locked.

### "Too many requests. Please slow down and try again shortly."

**Cause.** Your browser sent a burst of requests in a short time, for example from clicking a button many times quickly.

**Fix.** Wait a moment and try again. Click once and give the page a second to answer.

### "Enter your sign-in and password."

**Cause.** The Reseller ID, username or password box was left empty.

**Fix.** Fill in all three boxes and press Sign in.

### "Your sign-in has been disabled. Ask your account administrator."

**Cause.** An Administrator on your team switched your sign-in off. This message only appears when your password was right.

**Fix.** Ask an Administrator to turn your sign-in back on from the [Team](#/docs/team) page.

### "This account has been suspended. Please contact support."

**Cause.** The site operator has suspended the account. Again, you only see this when the password was right.

**Fix.** Contact support. An Administrator on your team may already know why. See [Plans, trials and billing](#/docs/plans-trials-billing).

### "This account is closing. Only an Administrator can sign in, to restore it or look at the data."

**Cause.** An Administrator chose to close the account. It is locked straight away and will be erased 7 days after it was closed.

**Fix.** If this was a mistake, ask an Administrator to sign in and press **Restore account** on the red banner at the top of any page. Until the erase date the account is read-only. If you want to keep your data, an Administrator can use **Export everything** on the [Security](#/docs/security) page, or make a backup file on [Backup and restore](#/docs/backup-and-restore), while the account is still closing. Both still work. What happens after the 7 days is explained under "How do I close my account?" below.

### "This account is closing, so changes are paused. An Administrator can restore it."

**Cause.** You are signed in to an account that is in its 7 day closing period and tried to save something. Looking around still works, but changes are refused.

**Fix.** An Administrator can restore the account. See the item above.

### "Your session has ended. Please sign in again."

**Cause.** Your sign-in expired, you were signed out on purpose (for example an Administrator used "Sign out everyone"), or your sign-in was disabled or the password was reset. A normal sign-in lasts up to 14 days.

**Fix.** Sign in again. Anything you were typing but had not saved is lost, so save as you go.

### "You need to choose a new password before continuing."

**Cause.** You are using a temporary password that an Administrator gave you.

**Fix.** On the "Choose a new password" screen enter the temporary password and then your own new one. Passwords need at least 10 characters with both letters and numbers.

## Passwords

### I forgot my password

**Fix.** On the sign-in screen choose **Forgot password?**, enter the email address on your account, and press **Send link**. For privacy the page always says "If that email is on an account, a link is on its way", whether or not the address is on an account.

Things to know about the reset email:

- The link works for **one hour** and **only once**. If you see "This reset link has expired. Request a new one.", ask for a new link.
- If one email address is used on several accounts, one message lists a link for each account, with the Reseller ID and username beside each.
- The email address must have been **confirmed**. If you never clicked the confirmation link, the reset email is held back. Ask an Administrator to reset your access from the Team page instead.
- If the email does not arrive, check your spam or junk folder and wait a few minutes. The site must also have email set up. If nothing arrives, ask an Administrator.
- If you changed your email address on the Security page, the old address stays in use until you click the link sent to the new one.

> Important: after a password reset by email, your password no longer unlocks your encrypted data. Because the site cannot read your data, it also cannot re-lock it with your new password. The next time you sign in you will see "Use your recovery key". Have the account's recovery key ready, or ask an Administrator to reset your access (see the next question).

### A teammate forgot their password and has no email on the account

**Fix.** An Administrator opens [Team](#/docs/team), finds the person and chooses **Reset access**. The Administrator types a new temporary password. The person is signed out everywhere, and at their next sign-in is asked to choose their own password. They keep access to the data because the Administrator's browser prepares the new key at the same moment. Tell them the temporary password in person or by phone rather than in a message that others can read.

This is the way to recover a team member who has no recovery key. Administrators cannot reset their own access this way; the message "Use Security to change your own password." points you to the Security page.

### The new password is rejected

**Cause.** Passwords must be at least 10 characters long and include both letters and numbers. The messages are "Password must be at least 10 characters." and "Password must include letters and numbers."

**Fix.** Choose a longer one. A few unrelated words with a number on the end is easy to remember and hard to guess.

### "Current password is incorrect." when changing my password

**Cause.** The first box on the change password form wants the password you use now, not the new one.

**Fix.** Type your current password carefully. If you have forgotten it, sign out and use "Forgot password?".

## Two-factor sign-in

### I lost my authenticator (phone broken, new phone, app deleted)

**Cause.** Two-factor sign-in asks for a 6 digit code from an authenticator app each time you sign in. Without the app you do not have the code.

**Fix.** When two-factor was turned on, you were shown a set of **recovery codes** and asked to save them. Each recovery code works once, in place of the 6 digit code. On the "Two-factor code" screen type one of your recovery codes into the same box and press **Verify**. Once you are in:

1. Open [Security](#/docs/security).
2. Turn two-factor off (it asks for your password and a code, so use another unused recovery code), then set it up again on your new phone. You will be given a fresh set of recovery codes. Save them properly this time.

If you have no recovery codes either, you cannot get past the code screen on your own, and a teammate's Reset access does not remove two-factor. Contact support. Take care: two-factor is a lock that is meant to keep other people out, so expect to be asked to prove who you are.

> Tip: the best time to prepare for a lost phone is today. Print or store your recovery codes with your recovery key, and consider setting up your authenticator on a second device.

### "That code is not valid."

**Cause.** The 6 digit code was typed wrongly, has expired (codes change every 30 seconds or so), or was already used if it is a recovery code.

**Fix.** Wait for the next code and type it again. If it keeps failing, the clock on your phone may be wrong. Set your phone to set the time automatically. This is also the usual cause of "That code did not match. Check your device clock and try again." while turning two-factor on.

### "Too many incorrect codes. Sign in again in a few minutes."

**Cause.** Several wrong codes in a row. The code step is locked for a while to stop guessing, around 15 minutes.

**Fix.** Wait, then sign in again from the start with your password and a fresh code.

### I cannot finish the code step in time

**Cause.** After you enter your password, the code step stays open for about 10 minutes.

**Fix.** If it times out you will be returned to the sign-in screen. Sign in again.

### "Start two-factor setup first, then enter the code from your authenticator app."

**Cause.** You tried to confirm a code before starting setup, usually after a page refresh part way through.

**Fix.** Press **Set up** on the Security page again and scan the new picture.

## Your data key and recovery key

### The page says "Unlock your data"

**Cause.** This is normal. Your data is encrypted, so after you sign in (or refresh the page) myBoxStock needs your password once more to open it on this device.

**Fix.** Type your password and press **Unlock**. If you would rather not be asked after every refresh, an Administrator can change **Unlock behaviour** in [Settings](#/docs/settings) to stay unlocked while the tab is open. That setting applies to everyone and is less private, so keep the default on shared computers.

### "That password does not unlock your data. If you changed it recently, use your recovery key."

**Cause.** The password was right to sign in, but it no longer matches the key that protects your data. This happens after a password reset by email, because the site cannot re-protect a key it cannot read.

**Fix.** Choose **Forgot it? Use your recovery key** on the same screen, enter the recovery key and your current password. From then on the data unlocks with your current password.

### I lost my recovery key

**Cause.** The recovery key is a long code, shown once when encryption was turned on, that lets an Administrator get back in if everyone forgets their passwords. It was meant to be downloaded, printed or stored safely.

**Fix.** It depends on whether you still have a working sign-in:

- **You can still sign in and unlock your data.** You are fine. An Administrator opens [Security](#/docs/security) and chooses **Create new recovery key**. The old key stops working immediately, so save the new one: download it, print it, and store it somewhere other than the computer you use for work.
- **Somebody else on your team can still unlock their data.** They can reset your access from the Team page.
- **Nobody can unlock the data and nobody has the recovery key.** The data cannot be opened by anyone, including the hosting service and support. This is how the encryption protects you, and it is not a fault that can be fixed. You would start again with an empty account. This is why it matters to keep the recovery key and your own backup file. Note that a backup file does not help here: it is locked with the same keys, so it opens only with your password or recovery key. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

### "That recovery key does not match this account. Check it and try again."

**Cause.** The key was typed with a mistake, belongs to another account, or has been replaced by a newer one (creating a new recovery key cancels the old one).

**Fix.** Check you are using the most recent key, copying it from the downloaded file if you have one. Check each group of characters, because similar looking letters are easy to swap. If you made a new key after the one you are holding, use the newer one.

### "Almost ready. An Administrator needs to sign in once to turn on encryption for your account."

**Cause.** You are not an Administrator, and encryption has not yet been set up on the account (also shown as "Encryption has not been set up for this account yet.").

**Fix.** Ask an Administrator to sign in. They will see "Turn on encryption", press **Turn on**, and save the recovery key. Then you can sign in normally. Only an Administrator can do this ("Only an Administrator can set up encryption for the account.").

### "N records could not be opened with your key. Sign out and back in..."

**Cause.** A red notice on Home says some saved records could not be read with the key on this device. It can follow a bad connection while the page loaded.

**Fix.** Sign out, sign in again and unlock. If it continues, contact support and mention the number of records. Do not delete anything while this is showing.

### "The encryption details sent were not complete. Refresh the page and try again."

**Cause.** The browser did not finish preparing the encryption details, for example because the page was closed too early or is out of date.

**Fix.** Refresh the page and try again.

### "Secure connection needed"

**Cause.** Your browser only allows encryption on a secure (https) address, and the site was opened over plain http.

**Fix.** Use the https address of your site. If you run the site yourself, ask whoever set it up to publish it with https.

## Pages that look old or refuse to save

### I see an old version / "This page is out of date. Refresh the page and try again."

**Cause.** The page you have open was loaded a while ago, and the site has changed since, or your sign-in was refreshed in another tab.

**Fix.** Refresh the page (reload the tab) and repeat what you were doing. If it still looks old, close the tab and open the site again, or press your browser's "hard refresh" (usually Ctrl and F5 together, or Cmd and Shift and R on a Mac). Only that tab was out of date. Your data is not affected.

### "Someone else changed this just now. Reload and try again."

**Cause.** Two people (or two of your own tabs) changed the same record at nearly the same moment, for example editing one device, or selling the same device. The first save wins.

**Fix.** Reload, look at the current details, and make your change again. In Quick sale the equivalent message is "One of these devices was just changed by someone else. Check the cart and try again."

### "That record could not be saved because it was not in the expected form." or "That record is too large to save."

**Cause.** Something in the record is unusually large or malformed, most often a very long note pasted in.

**Fix.** Shorten the text, remove anything odd, and save again. Refresh the page if it keeps happening.

### "That item could not be found."

**Cause.** The thing you tried to open or change was deleted by someone else, or the page has not caught up.

**Fix.** Refresh the page.

### "Your user type does not allow this action."

**Cause.** Your user type does not include what you tried to do. There are three: **Administrator** (everything), **Standard** (works with inventory, customers and sales, and records quick sales) and **View** (can only look). See [Team](#/docs/team).

**Fix.** Ask an Administrator to change your user type, or to do it for you. Pages you cannot use, such as Team, Settings and Activity, are hidden from non-Administrators.

## Account is read-only

### "The page says my account is read-only" and "This account is read-only because its trial or paid period has ended. Please contact support to continue."

**Cause.** The free trial or the paid period has ended. A chip at the top of every page then shows "Trial ended - read-only". You can still look at everything, search, open receipts and export, but anything that changes data (adding devices, recording sales, saving customers or settings) is refused.

**Fix.** Contact support to continue. Your data has not been deleted. While you wait, use **Export everything** on the [Security](#/docs/security) page to take a copy, which is a good habit in any case. Details of how trials and plans work are on [Plans, trials and billing](#/docs/plans-trials-billing).

### A chip says "Free trial" with days left

**Fix.** Nothing is wrong. The blue chip at the top shows how many days of the free trial remain. When it reaches zero the account becomes read-only until it is continued.

## Scanning and Quick sale

### The scanner types into the wrong box

**Cause.** A barcode scanner works like a keyboard. It "types" the code wherever your cursor is. If the cursor is in a different box, the code lands there.

**Fix.**

- In **Quick sale** the scan box at the top is selected for you when the page opens. If you click elsewhere, for example in the customer search or a price box, click back in the scan box before scanning.
- In **Bulk scan** (Inventory) the scan box is selected for you, the label above it says which detail to scan next (for example "Scan UID"), and you press Enter after each one. Press Enter with the box empty to skip a detail the label does not have.
- When adding one device by hand, scanning into a field marked as scannable fills it with the clean number. Click into the right field first.
- If the scanner adds a label such as "UID" or "SN" before the number, or line breaks, myBoxStock removes them for you, so the box keeps only the number.
- If scans never press Enter by themselves, your scanner may need to be set to send an Enter key after each code. Check the scanner's manual or its setup barcodes.

### The camera cannot read the barcode, or reads the wrong one

The camera scanner has its own set of fixes. See "Scanning with the camera" just below, and the whole guide at [Scanning with your phone camera](#/docs/scanning-with-your-phone).

### "Nothing in your inventory matches ..."

**Cause.** Quick sale looks up the code in the details your Administrator has marked **Look up in sale** (for example UID, serial number or MAC). The code you scanned is not stored in any of them, may have been entered with a typo, or the device is not in Inventory yet.

**Fix.** Search for the device on the [Inventory](#/docs/inventory) page, or add it first. If a code you expect to work is never matched, an Administrator can check which details are marked **Look up in sale** in [Settings](#/docs/settings). At least one must be turned on, otherwise you see "Turn on at least one detail to look up in Quick sale."

### "... was already sold", "... is awaiting its tests and cannot be sold yet", "... is marked ..., not available."

**Cause.** Only devices that are **Available** or **Returned** can be sold. A sold device cannot be sold again, a device still **Awaiting test** (when tests are required) cannot be sold until its test steps are ticked, and devices marked Reserved, Damaged or Archived are held back.

**Fix.** Open the device in Inventory and check its status. If a sale was recorded by mistake, void it (see below) and the device returns to available.

### "Required checks not done"

**Cause.** The device has test steps marked **Required before sale** that are not ticked.

**Fix.** Either tick the steps in Inventory first, or choose **Sell anyway**. The sale record will show what was and was not done.

### "Discounts on this sale add up to more than the N% you are allowed to give."

**Cause.** Standard users can give discounts only up to a limit set by an Administrator.

**Fix.** Reduce the discount, or ask an Administrator to record the sale. Administrators can change the limit in [Settings](#/docs/settings).

### "Choose today or an earlier date and time for the sale."

**Cause.** A sale cannot be dated in the future.

**Fix.** Pick today or an earlier day and time, or leave the date alone to use the current moment.

### "Choose a customer, or switch to New." and "Your user type cannot add customers."

**Fix.** Every sale needs a customer. Pick an existing one, or switch to **New** and type a name. A View user cannot record sales at all, and a user type that cannot add customers must choose an existing customer.

### I made a sale by mistake

**Fix.** Open the sale from [Sales](#/docs/sales) or right after finishing it, and choose **Void sale**. The devices go back to available and the sale stays in your history marked Void, so your records stay honest. A voided sale is left out of the revenue and profit totals. You can send a "Sale voided" notice to the customer from the same screen.

## Scanning with the camera

### The camera does not start: "The camera is turned off for this site."

**Cause.** The browser's camera permission for this site was refused.

**Fix.** Allow the camera when the browser asks, then tap **Try again** in the scanner. On an iPhone, open **Settings**, **Safari**, **Camera** and choose **Ask** or **Allow**, then come back and tap **Try again**. If you do not want to use the camera now, tap **Type it instead** or **Take a photo**.

### "The camera only works when this site is opened over https ..."

**Cause.** The page was opened through an address that does not start with `https://`, and browsers only let secure pages use the camera.

**Fix.** Open the site with its secure `https://` address. If you only have an address that starts with `http://`, ask your site administrator for the right one. Typing the code or **Take a photo** still works in the meantime.

### "No camera was found on this device." / "The camera is busy." / "The camera could not start."

**Cause and fix.** No camera: use a device that has one, or type the code. Busy: another app or browser tab is using the camera, so close it and tap **Try again**. Could not start: tap **Try again**, and if it still fails close the browser completely and reopen it.

### "This browser cannot use the camera here."

**Cause.** The browser is too old or locked down. **Fix.** Update it, or open myBoxStock in Safari on iPhone or Chrome on Android. Until then use **Take a photo** or **Type it instead**.

### The scanner reads the wrong barcode (for example the UID instead of the serial number)

**Cause.** The label has several barcodes and the one nearest the aim line was read.

**Fix.** Tap **Small** so the scan box is a thin strip, then **tap the barcode you want** on the picture so the box and red line move onto it, and scan again. Always check the value in the box before you save. If two barcodes are equally close you get two big buttons: "Two codes are about equally close. Tap the one you want."

### The hint says "Nothing read yet. Put the red line across the bars, not the printed text."

**Cause.** Nothing was read for about six seconds. Most often the scan box is over the printed text under a barcode, or between two barcodes, and not over the bars. This is common on labels where the S/N barcode is stacked over the MAC barcode.

**Fix.** **Tap the barcode you want** on the picture. The scan box moves to the spot you tapped. Put the red line across the bars, then hold steady and move a little closer. If the box is on **Small**, try **Medium**. The message clears by itself once you move the box or a code is read.

### I did not notice that the scan worked

**Cause.** An iPhone does not buzz, and its beep is muted when the ringer is on silent.

**Fix.** Look for the green **Got it** with the code, which stays up for about a second and a half. When the scanner closes, the box that received the code flashes green. If you still want to check every code first, open the scanner and turn on **Confirm each scan**: each code then waits for you to tap **Use this** (or **Scan again**) and nothing is filled in until you do.

### The scanner will not read at all, or takes a long time

**Cause.** Usually light, distance, shake or glare.

**Fix.** Add light or tap **Flash** (where it exists), hold the phone about a hand span away and steady, tilt it to move shine off the label, and fit the whole code inside the box. Try **Large** for a QR code. Or tap **Take a photo**, which uses your phone's own camera app, then read the picture. See the tips in [Scanning with your phone camera](#/docs/scanning-with-your-phone).

### The MAC address will not fill in from the camera

**Cause.** The MAC box accepts only a real MAC address: 12 digits or letters A to F, plain or separated by colons, dashes or dots. Any other barcode in the box, such as a serial number, is ignored there. After a **Take a photo** with no MAC in it you see "No MAC address was found in that photo."

**Fix.** Make the scan box **Small** and put the MAC barcode on the aim line. If the label has the MAC only as printed text and not as a barcode, type it by hand. The camera does not read printed letters.

### "No code was found in that photo." / "That photo could not be read."

**Fix.** Take the photo again, closer, in good light, with the whole code filling the picture. Or tap **Type it instead**.

### There is no Flash button

**Cause.** The phone or browser does not let web pages use the torch. It does not on iPhone Safari. **Fix.** Use a lamp or a window.

## Backup and restore

### I cannot see Backup and restore in the menu

**Cause.** It is for Administrators only. **Fix.** Ask an Administrator to make your backups, or to change your user type on the [Team](#/docs/team) page. On a phone it is under **More**.

### I pressed Back up now, but "Last backup" did not change

**Cause.** The date changes only after the file has really been saved. On an iPhone or iPad, if you close the share sheet without choosing **Save to Files**, nothing was saved.

**Fix.** Press **Back up now** again, tap **Save backup file**, and choose **Save to Files** and a folder. Look in the Files app to find it.

### Where did my backup file go?

**Fix.** On an iPhone or iPad, open the Files app and look in the folder you chose. On Android or a computer, look in your Downloads folder. The name starts with `myboxstock-backup-` and ends in `.mbsbackup`.

### How big is the backup file?

It depends on how many devices, customers and sales you have. A big account makes a bigger file and takes longer, so keep the page open until you see "Backup saved." If the file is too big to email, save it to Files, a cloud folder or a USB drive.

### "This file cannot be used" when I choose a file

The sheet says why. Nothing was changed.

- **"That file is not a myBoxStock backup."** Wrong file. You need one ending in `.mbsbackup`, not an export zip or a spreadsheet.
- **"That backup was made by a newer version of myBoxStock."** Refresh the page (or close and reopen the tab) to load the latest version, then try again.
- **"That backup belongs to a different account."** The message shows the Reseller ID in the file. A backup restores only into its own account. Sign in to that account, or find the right file.
- **"That backup was made with a different key..."** This account cannot open it, for example because the account was set up again since. Use the recovery key from when the backup was made.
- **"That backup file is damaged or incomplete."** It may not have finished downloading or copying. Use another copy.

### "Your account is newer than this file"

**Cause.** The newest change in your account is later than the newest change in the file, so the file is older than your work. **Fix.** Pick **Add what is missing**, which never changes what is already there, or cancel and choose a newer file. Do not pick **Replace everything** unless you really want to lose the newer work.

### I restored and something is wrong. How do I undo?

**Fix.** Open **Backup and restore** and press **Undo last restore**, then confirm **Undo restore**. It is there for 7 days after a restore. Before every restore the site keeps a locked safety copy for exactly this. After 7 days the button is gone and you see "There is no restore to undo. The safety copy is kept for 7 days after a restore and then removed." Only one safety copy exists, so a second restore replaces the first.

### "The restore did not finish"

**Cause.** The connection dropped, or the page was closed part way. **Fix.** The page puts your data back as it was and says so. Check your connection, keep the page open, and try again.

### I see a banner: "The site was restored from a backup taken ..."

**Cause.** The person who runs the site had to go back to an older copy. Anything you did after the time in the banner (UTC) may be missing. **Fix.** Check Sales and Inventory. If you have your own newer backup file, open **Backup and restore**, **Choose file**, and use **Add what is missing**. See [Backup and restore](#/docs/backup-and-restore).

### I lost my password or my recovery key. Can a backup file help?

No. The file is locked with your keys and opens only with your password or your recovery key, just like the account. If you still have a working sign-in, make a new recovery key on [Security](#/docs/security) right away and make a fresh backup. If nobody has a password or the recovery key, no backup can be opened either.

### Are my team members in the backup?

Yes, the list is: each person's username, email and user type, locked with your key. Passwords, two-factor secrets and sign-ins are never in the file. When you restore, the switch **Add team members (N in this file)** brings them back as pending invitations (on by default). Give each one a temporary password with **Set up access** on the [Team](#/docs/team) page. Anyone already on your team is skipped and **Replace everything** never removes a person.

### How do I check that a backup file is good?

Open **Backup and restore** and use the **Test a backup file** card. Pick the file and read the result: a **Passed** or **Failed** list (is a backup, made for this account, opens with this account's key, complete and not damaged, every record can be opened), then what is inside and how it compares with your account now. Nothing is restored, changed or sent, the file stays on your device, and it works even if your account is read-only.

### The test says "damaged: one of its records cannot be opened"

**Cause.** One record inside the file was changed or damaged after it was made. A restore would not notice, but the test opens every record. **Fix.** Do not rely on that file. Use another copy and make a fresh backup.

### The backup reminder keeps showing on Home

It shows when you have no backup or the last one is more than 7 days old. Make one with **Back up now** and it goes. **Not today** only hides it until tomorrow on that device.

### What does Copy diagnostics do?

It copies a short summary (versions, plan, people counts, recent warnings) for your site's administrator. Paste it into your message when you ask for help. It never contains your devices, customers or sales. If your browser blocks copying, select the text in the box and copy it by hand.

## Receipts and email

### My receipt did not arrive

Work through these:

1. **Check the address.** "Enter one valid email address and try again." means the box held no address, two addresses, or a typo. Only one address can be used at a time.
2. **Check spam or junk.** Receipts sent from the site's shared sender are sometimes filed there. Replies go to the email address on your account.
3. **"Email is not set up on this site, so the receipt cannot be sent from here. You can open it in your own mail app instead."** Use **Open in my mail app** on the email screen. It opens a ready-made message in your own mail program, and you press Send there. Or press **Print** and give the customer a paper copy.
4. **"Too many receipts were emailed today from this account. Try again tomorrow, or use your own mail app."** There is a daily limit (100 a day through the site, 1,000 a day through your own mail server). Try again tomorrow or use your own mail app.
5. **"The receipt could not be sent. Check the address and try again."** Try again. If it keeps failing, use your own mail app.

Receipts are not stored by the site once sent, so there is no "sent" history to look in. If a customer needs a copy, open the sale in Sales and send it again, or print it.

### Problems with "Send from my own mail server"

An Administrator can send receipts from their own mail account in [Settings](#/docs/settings) under **Email sending**. These messages mean:

- **"Check your mail server details: a server name and a valid From address are needed."** Fill in both the server (SMTP host) and the From address.
- **"Use port 587 (or 25 or 2525), or port 465 with 'Use TLS from the start' turned on."** Match the port to the setting.
- **"Could not reach your mail server. Check the server name and port."** The name is mistyped or the server is unreachable.
- **"That mail server is on a private network, which this site cannot reach. Use your mail provider's public server name."** Use the public name your provider gives, not an address on your office network.
- **"Your mail server refused the login. Check the user name and password (some providers need an app password)."** Gmail, Outlook and others often require a special app password rather than your normal one.
- **"Your mail server did not accept the message. Check the From address and the recipient."** The From address must be one your provider allows you to send from.
- **"The message wording is not valid."** or **"The logo must be a PNG, JPEG, GIF or WebP picture no larger than 150 KB."** The reworded message needs to keep its required placeholders, and a logo has to be a small picture. The settings page shrinks pictures for you, so try a simpler one.

Your mail server password is used to send and is not part of the receipts the site keeps. See [Settings](#/docs/settings).

### The Email button is missing, or the customer has no email

**Fix.** Receipts can still be printed. To email, type the address into the **Send to** box on the email screen, or add an email to the customer record.

## Team and access

### I cannot add a person: "Confirm your own email address first..."

**Cause.** Administrators must confirm their own email address before adding people.

**Fix.** Click the link in the confirmation email. If it did not arrive, choose **Send it again** on the blue banner on Home or Security. "A message was just sent. Please wait a minute before asking for another." means you asked twice too quickly. If the link has expired ("This confirmation link has expired. Sign in and ask for a new one.") sign in and ask for a fresh one.

### "That username is taken in your account." or "Username: 3-30 letters, numbers, . _ -"

**Fix.** Pick another username using 3 to 30 letters, numbers, dots, underscores or dashes.

### "An account needs at least one Administrator." / "You cannot delete yourself." / "You cannot disable yourself."

**Cause.** These are safety rules so an account is never left without anyone in charge.

**Fix.** Make another person an Administrator first, then remove or disable the one you want to.

## General questions

### What do I need to sign in?

Your Reseller ID, your username and your password, plus a code from your authenticator if you turned on two-factor. See [Getting started](#/docs/getting-started).

### Where do I find my Reseller ID?

On your welcome email, on the Security page, on the Team page heading, and the sign-in screen offers the one this browser last used. Any Administrator can tell you.

### Can the hosting service see my inventory, customers or sales?

No. They are encrypted in your browser before they are sent and are only opened in your browser. The service stores the scrambled version. That also means it cannot restore your data if you lose both your password and your recovery key. See [Your data, your responsibility](#/docs/your-data-your-responsibility).

### Why can't I create my account? It says to tick the box.

Sign-up needs the **I agree to the Terms of Service and Privacy Policy** box ticked. Tick it (the names beside it are links to the pages) and press **Create account** again. Nothing is created until you do.

### Why does it say Updated terms when I sign in?

The Terms of Service or Privacy Policy were changed, or your account was created before they were introduced. An Administrator reads them, ticks the box and presses **Accept and continue**, once for each new version. Until then the account cannot be used, for anyone. If you are not an Administrator, ask one to sign in and accept. See [Getting started](#/docs/getting-started).

### Who is responsible for my data?

You are. myBoxStock, its owner and supporting staff cannot see your customer data (inventory, customers, sales, receipts and prices) and are not responsible or liable for it. You own your data and are 100 percent responsible for it, for your recovery key, and for your own backup files and exports.

### What should I keep safe?

Four things: your **recovery key**, your **two-factor recovery codes** (if you use two-factor), a recent **backup file** (Backup and restore, **Back up now**), and if you like a recent **export** of your data. Keep them somewhere other than the computer you use every day.

### How do I take a copy of my data?

For a copy you can restore, an Administrator opens [Backup and restore](#/docs/backup-and-restore) and presses **Back up now**. For spreadsheets, choose **Export everything** there or on [Security](#/docs/security). You get one file with spreadsheets of inventory, customers and sales plus your settings. It is built in your browser and does not pass through the site. You can also export Inventory and Sales as CSV from those pages, and export one customer from their record. Do this regularly.

### Does an export protect me if I lose my keys?

An export is a normal set of spreadsheets that opens without any key, so you keep your information. Keep it safe, because anyone who has it can read it. But you cannot restore from it. A **backup file** can be restored, but it is locked with your keys, so it does not help if you lose them all.

### How long does a free trial last, and what happens after?

The length is shown on the sign-up screen and the blue chip at the top of the page counts down. When it ends the account becomes read-only: you can view and export but not change anything, and nothing is deleted. See [Plans, trials and billing](#/docs/plans-trials-billing).

### Can I use it on a phone?

Yes. Quick sale in particular is made to work on a phone, and you can scan barcodes with the phone's camera (see [Scanning with your phone camera](#/docs/scanning-with-your-phone)) or with a USB or Bluetooth scanner that acts like a keyboard.

### A customer asked me to delete their personal details. What do I do?

Open the customer on the [Customers](#/docs/customers) page. **Export** gives you a copy of their records if they asked for one. **Erase** removes their name, phone, email and notes from the customer record and from their past sales while keeping the totals and receipt numbers so your books still add up. Erase cannot be undone.

### What is the difference between Delete and Erase for a customer?

**Delete** removes the customer record but their past sales keep their name. **Erase** removes their personal details from the sales as well.

### What is the difference between Archive and Delete for a device?

**Archive** hides the device from normal lists but keeps it, and you can **Restore** it. **Delete** removes it for good, though past sales that included it keep their receipts.

### How do I get someone signed out?

An Administrator can open [Activity](#/docs/activity) to see where people are signed in, sign out one session, "Sign out everyone else" or "Sign out everyone". Disabling a person on the Team page also signs them out.

### How do I close my account?

An Administrator uses **Close account** on the [Security](#/docs/security) page, entering their password and Reseller ID. The account is locked for 7 days: only Administrators can sign in, to look, export, make a backup file or restore it, and an "account is closing" email with the erase date is sent. An Administrator can restore it any time before the erase date. After that the site erases everything (people, devices, customers, sales, keys, billing history and your undo copy) and there is no way back. The site's own encrypted backups may still hold a locked copy for up to about 8 weeks with the default settings, and it cannot be opened without your keys. Backup files and exports you made yourself are yours and are not touched. Make a backup first. In rare cases the person who runs the site can also delete an account straight away, without the 7 days (for example when you ask them to). They cannot read your data and cannot bring the account back. If the site's email is set up, one "account erased" email then goes to the owner and the Administrators, saying the account was deleted by the site's Host, when, and the reason they gave if any. The delete never waits for that email, so if email is not set up nobody is emailed, which is one more reason to keep your own backup file and export.

### Who can I ask for more help?

Start with an Administrator on your team, who can do many fixes. For anything this page says needs support, such as a suspended account, a trial that has ended or a lost authenticator without recovery codes, contact the support address given by your site's operator. When you write, include your Reseller ID (never your password or recovery key) and the exact wording of the message.
