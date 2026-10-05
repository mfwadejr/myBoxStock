---
title: Glossary
summary: Plain-English meanings of every term used in the Host Console, in alphabetical order, each with a link to the page that explains more.
keywords: glossary, terms, meaning, definition, words, jargon, what is
order: 19
covers: Account, Alert, Announcement banner, Audit trail, Authenticator app, Ban, Backup, CIDR, Cloudflare, Closing, Comped, DKIM, Database engine, Direct delivery, Docker, Export, Firewall, Free, Full-site backup, Health, Helper, HELO, Host, Host Console, Log, Log area, Migration, Off-box folder, Onboarding, Open sign-ups, Owner, Paid, Pipeline, Plan, Proxy, Rate limit, Read-only, Recovery codes, Recovery key, Reseller, Reseller ID, Restore, Site address, SMTP, SPF, Suspended, TLS, Temporary password, Trial, Two-factor, User type, Zero-knowledge
---

Words are listed from A to Z. Each entry is short, and the link at the end of it goes to the page that explains the subject in full.

## A

### Account
One customer business on your site: its own users, its own data and its own Reseller ID. The Host sees an account's name, plan, people and security facts, but never its business data. More in [Accounts](#/docs/accounts).

### Alert
A problem the server noticed by itself, such as failing email, a failing backup, a burst of failed sign-ins, a nearly full disk, database errors or trials about to end. Each problem is listed once with a counter, and the Owner is emailed once. More in [Alerts](#/docs/alerts).

### Announcement banner
One plain-text message, set in Settings, that appears at the top of every customer's app. Use it for maintenance notices or news. More in [Settings](#/docs/settings).

### Audit trail
A searchable record of what each Host administrator did: who, what, when and from which address. It never includes anything from inside a customer's account. More in [Audit trail](#/docs/audit-trail).

### Authenticator app
A phone app that shows a six-digit code that changes every 30 seconds. It is the second step of signing in when two-factor is on. More in [Security](#/docs/security).

## B

### Backup
A saved copy of the platform that you can restore if something goes wrong. The Host Console makes plain database backups and full-site backups. More in [Backups](#/docs/backups).

### Ban
A temporary block of one address after it breaks the rate limits too many times. By default it lasts 15 minutes and you can lift it early. More in [Firewall](#/docs/firewall).

## C

### CIDR
A short way of writing a range of addresses, such as `203.0.113.0/24` for 256 addresses in a row. A single address can be written on its own. You use it in the Firewall rules. More in [Firewall](#/docs/firewall).

### Cloudflare
A service that sits between visitors and your site. When your site is behind it, turn on **Site is behind Cloudflare** so the real visitor address is used. More in [Settings](#/docs/settings) and [Troubleshooting and FAQ](#/docs/troubleshooting-faq).

### Closing (account)
The state of an account whose customer has asked to close it. It is kept for 7 days, during which an Administrator of that account can restore it, and then it is erased. More in [Accounts](#/docs/accounts).

### Comped
An account on the Free plan that you have granted without payment. It never expires. More in [Plans](#/docs/plans).

## D

### Database engine
The software that stores the platform's data. SQLite is built in and suits testing. PostgreSQL or MariaDB suit many users at once. More in [Settings](#/docs/settings) and [Running the server](#/docs/running-the-server).

### Direct delivery
An email mode where your server hands each message straight to the recipient's mail server instead of using a relay. It works best with a fixed IP address, reverse DNS, SPF and DKIM. More in [Email](#/docs/email).

### DKIM
A digital signature added to outgoing email that proves it really came from your domain. Mail without it is more likely to be treated as spam. More in [Email](#/docs/email).

### Docker
The container tool the server normally runs in. Settings made as container variables, and updates done by rebuilding the container, relate to it. More in [Running the server](#/docs/running-the-server).

## E

### Export
A copy of their own data that a customer saves to their own device. Customers are responsible for making their own exports; the Host cannot make one for them. More in [Recovery and emergencies](#/docs/recovery-and-emergencies).

## F

### Firewall
The part of the Host Console that limits who can reach the site: rate limits, address rules, temporary bans and a list of addresses allowed into the Host Console. More in [Firewall](#/docs/firewall).

### Free
A plan with no end date, used for comped accounts. More in [Plans](#/docs/plans).

### Full-site backup
A single `.mbsbak` file holding the whole site, protected by a passphrase you choose. It is what you use to move to a new server. More in [Backups](#/docs/backups).

## H

### Health (account chips)
Small labels in the Accounts list that point to things worth a nudge, such as No recovery key, 2FA off, Email not verified or Not encrypted. More in [Accounts](#/docs/accounts).

### Health (email tab)
The tab on the Email page that shows whether mail is getting out: last success, recent failures and what is waiting. More in [Email](#/docs/email).

### Helper
A Host administrator other than the Owner. A helper can use the console once two-factor is on, but cannot add or manage other administrators. More in [Security](#/docs/security).

### HELO
The name your server announces to a receiving mail server when it connects. It should be a real host name that points to your server, or some servers reject the mail. More in [Email](#/docs/email).

### Host
The person or team who runs the server and signs in at `/host/`. Not to be confused with customers, who sign in at `/app/`. More in [Getting started](#/docs/getting-started).

### Host Console
The administration area at `/host/`. It handles accounts, backups, email, the firewall, settings and logs, and deliberately has no view of customers' business data. More in [Overview](#/docs/overview).

## L

### Log
A written record of what the server did, kept as plain-English lines and as raw data. More in [Logs](#/docs/logs).

### Log area
The group a log line belongs to, such as auth, security, host, accounts, backup, mail, system, database or error. The account activity area holds only identifiers and event names, never business data, and is hidden from the Host. More in [Logs](#/docs/logs).

## M

### Migration
Moving something from one place to another. In the Host Console it means copying the database to another engine with `migrate-db`, which leaves the original untouched. It also describes the small database changes an update may make. More in [Settings](#/docs/settings) and [Updates](#/docs/updates).

## O

### Off-box folder
A folder outside the server's data folder, such as a mounted network drive or USB drive, where scheduled backups are also copied. More in [Backups](#/docs/backups).

### Onboarding
How far a new account gets through setup: email confirmed, first sign-in, recovery key saved and plan started. Use it to see who needs a nudge. More in [Onboarding](#/docs/onboarding).

### Open sign-ups
The setting that lets new businesses create an account. Turn it off to stop new sign-ups while existing accounts keep working. More in [Settings](#/docs/settings).

### Owner
The first Host administrator. The Owner adds and removes other administrators, resets their two-factor, sets temporary passwords, and receives alert emails. More in [Security](#/docs/security).

## P

### Paid
A plan with an end date set by you, usually the day the customer has paid through. When it passes the account becomes read-only. More in [Plans](#/docs/plans).

### Pipeline
The page showing sign-ups, trials, renewals and accounts that have gone quiet. It shows plan and contact details only. More in [Pipeline](#/docs/pipeline).

### Plan
An account's commercial state: trial, free or paid. The Plans page also records prices and limits for the future. Nothing is charged by the app yet. More in [Plans](#/docs/plans).

### Proxy
A server standing between visitors and your site and passing requests on. The site must know how many there are to read the true visitor address. More in [Settings](#/docs/settings).

## R

### Rate limit
A cap on how many requests, or sign-in attempts, one address may make in a period. It slows floods and password guessing. More in [Firewall](#/docs/firewall).

### Read-only
The state of an account whose trial or paid period has ended: people can sign in and look but cannot change anything until you extend or change the plan. More in [Accounts](#/docs/accounts) and [Plans](#/docs/plans).

### Recovery codes
One-time codes given when someone sets up two-factor, for use if they lose their authenticator app. More in [Security](#/docs/security).

### Recovery key
A secret that lets a customer open their encrypted data if they forget their password. The customer keeps it, not you. If it is lost along with the password, the data cannot be opened by anyone. More in [Recovery and emergencies](#/docs/recovery-and-emergencies).

### Reseller
Your customer: a distributor who signs up and uses the app to track their stock and sales. More in [Accounts](#/docs/accounts).

### Reseller ID
The code that identifies an account, written like `BX-ABC123`. Customers sign in as `username@BX-ABC123`. More in [Accounts](#/docs/accounts).

### Restore
Replacing the current platform with a backup. The current database is saved first, the server restarts, and everyone is signed out. More in [Backups](#/docs/backups).

## S

### Site address
The https address people type to reach your site. Every link in a confirmation, reset or welcome email is built from it. More in [Settings](#/docs/settings).

### SMTP
The standard way programs send email. An SMTP relay is a mail service that your server hands messages to for delivery. More in [Email](#/docs/email).

### SPF
A public record on your domain listing which servers may send email for it. Without it, receivers are more likely to treat your mail as spam. More in [Email](#/docs/email).

### Suspended
An account state in which nobody can sign in until you reactivate it. More in [Accounts](#/docs/accounts).

## T

### Temporary password
A one-time password the Host or the Owner can set for someone. It is shown once, and the person must choose a new password at the next sign-in. More in [Accounts](#/docs/accounts).

### TLS
The encryption used to protect email in transit between servers. Port 465 uses it from the start; port 587 upgrades to it. More in [Email](#/docs/email).

### Trial
The free period new accounts start with. Its length is set in Settings, and at its end the account becomes read-only unless you change the plan. More in [Plans](#/docs/plans).

### Two-factor
A second step at sign-in using a code from an authenticator app. Every Host administrator must have it on. More in [Security](#/docs/security).

## U

### User type
The role of a person inside a customer account: Administrator, Standard or View. Host administrators do not have user types. More in [Accounts](#/docs/accounts).

## Z

### Zero-knowledge
A design where only the customer can read their data, and the server holds only an unreadable form. It is why the Host cannot see or recover business data. More in [Security](#/docs/security).
