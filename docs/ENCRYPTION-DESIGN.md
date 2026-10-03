# Customer-data encryption — design for review

Status: **implemented in 0.4.0** with these decisions: losing the password and recovery key means the data is gone; the data key is derived from the sign-in password (separate salt); no scheduled reports on business data; on before any paying customers.

Implementation notes: PBKDF2-SHA-256 (600,000 iterations, stored per person so it can be raised later) is used because Web Crypto has no Argon2 and scripts are limited to this site. Records are AES-256-GCM with the record id and type bound in as authenticated data. The data key lives only in browser memory, so a page reload asks for the password again. Roles (Administrator/Standard/View) are enforced by the server per record type; anyone holding the account key can in principle decrypt every type, so role limits are access control, not cryptographic separation. Code: `public/js/shared/vault.js`, `src/routes/app/vault.mjs`, `src/services/vault/`.

## 1. Goal

The person who runs the hosting site (the Host) must be unable to read any customer's business data — inventory, sales, customers — even with full access to the server, the database and every backup. Support work is limited to account credentials and status. A crash recovery must still be possible: restore the whole site elsewhere and every customer signs in as before.

## 2. What is protected, and what is not

| Protected (encrypted so the Host cannot read it) | Not protected (the Host needs it to run the service) |
|---|---|
| Inventory items and their fields | Account ID, business name, owner email |
| Sales, customers, notes, attachments | Usernames, roles, plan, trial dates |
| Customer-made exports and reports | Sign-in history (time, IP, device) |
| Customer-held backups | Counts and sizes (how many rows, how much storage) |

Metadata is visible. We say so plainly in the customer-facing promise (section 9).

## 3. Approach: encryption in the customer's browser

Data is encrypted and decrypted in the browser with the Web Crypto API. The server stores and returns ciphertext only. The server never holds a key that can decrypt customer data.

### Key hierarchy

1. **Account data key (ADK)** — random 256-bit AES-GCM key, created in the browser of the first Administrator when the account is created. Encrypts all business data of that account.
2. **Key-encryption key per person (KEK)** — derived in the browser from that person's password (or a separate "data passphrase") with a slow key-derivation function (Argon2id or scrypt via WebAssembly; PBKDF2-SHA-256 at ≥600,000 iterations as the built-in fallback). The salt and parameters are stored with the person.
3. **Wrapped ADK per person** — the ADK encrypted with each person's KEK, stored on the server next to that person. A new team member gets the ADK wrapped for them by an Administrator who is signed in (ADK is wrapped with the new person's public key, or with a one-time code the Administrator hands over).
4. **Recovery key** — a random 256-bit key shown once as a printable code when the account is created. It also wraps the ADK. Customers store it themselves (paper, password manager).

The server stores: ciphertext data, per-person wrapped ADKs, the recovery-wrapped ADK, salts. It never sees the ADK, a KEK or the recovery key.

### Sign-in vs data unlock

The login password proves identity to the server (as today, scrypt hash). The browser derives the KEK from the same password with a different salt and different KDF, so the server's copy of the password hash cannot unlock data. After sign-in the unwrapped ADK lives only in browser memory (never localStorage); closing the tab locks it.

## 4. Password changes and resets

- **Person changes their own password:** the browser re-wraps the ADK with the new KEK. Nothing else changes.
- **Administrator resets a team member's password:** that person's old wrapped ADK is useless; an Administrator wraps the ADK again for them with a new temporary credential. No data is lost.
- **The Host "resets" a password for support:** possible for the sign-in only. The customer's data stays locked. The customer unlocks it with another Administrator or their recovery key. This is the intended boundary: the Host cannot give anyone access to data.
- **Forgot password, only Administrator, no recovery key:** data is **permanently unreadable**. This must be explained at account creation and the recovery key step must be hard to skip.

## 5. Backups

- **Platform backups (Host):** the full-site backup (already built) contains the database, which now holds only ciphertext for customer data, plus the server key. Restoring it elsewhere brings every account back and customers can still unlock their data because their wrapped keys are inside.
- **Customer backups:** customers can download an encrypted export of their own data (ciphertext + wrapped keys) and re-import it. It is useless without their password or recovery key.

## 6. Features that change

- **Server-side search, sorting, filtering, totals:** the server cannot compute on ciphertext. Lists are downloaded, decrypted and searched in the browser. Fine for thousands of rows; very large accounts need chunking or a local index in the browser.
- **Reports and scheduled emails with business data:** cannot be produced on the server. Reports are generated in the browser. Scheduled data emails are not possible without the customer holding a key on the server, which breaks the promise. We offer none.
- **Integrations (marketplaces, payments touching inventory):** a customer-run integration would need the key; out of scope for the first version.
- **Quotas and storage totals** still work (ciphertext size).

## 7. Threat model

Protects against: the Host reading the database, files or backups; a stolen server disk; a leaked backup; a database administrator; a Host reading customer data by mistake.

Does **not** protect against:

- **A malicious or compromised server that ships altered JavaScript.** Because the server delivers the app, a hostile Host could serve code that captures keys. Mitigations: published source, reproducible builds, Subresource Integrity, an optional signed/pinned build, and publishing the hash of each release. This is the honest limit of any browser-delivered encryption (same as most web-based zero-knowledge services).
- A customer's own compromised device or a weak password.
- Metadata (section 2).

## 8. Costs and risks to decide on

- **Lost password and recovery key = lost data.** No exception, including for the Host. This is the price of the promise.
- Slower first load after sign-in (key derivation, decrypting lists).
- More complex support: the Host can fix sign-in problems but never data problems.
- Existing unencrypted accounts need a one-time migration in the browser (encrypt on the first Administrator sign-in).
- Code complexity: every data route stores opaque blobs; validation moves to the browser.

## 9. Customer-facing promise (draft wording)

> Your business data is encrypted in your browser before it reaches our servers. We store it, but we cannot read it — not for support, not for a backup, not ever. That also means we cannot recover it for you: keep your recovery key safe. We can see who you are (account, usernames, plan, sign-in times), not what you track.

## 10. Alternatives considered

- **Server-side encryption with Host-held keys:** protects a stolen disk only; the Host can still read everything. Does not meet the goal.
- **Per-customer keys held in a separate vault the Host cannot access:** better operationally but a determined Host still controls the vault; not a real guarantee.
- **Customer self-hosting:** strongest, but not a hosted service.

## 11. Proposed build order (after approval)

1. Crypto module in the browser (KDF, AES-GCM, wrap/unwrap) with test vectors.
2. Account creation flow with recovery key and an acknowledgement step.
3. Wrapped-key storage, team-member key hand-over, password change re-wrap.
4. Move inventory/sales/customers storage to opaque records; browser-side list, search and totals.
5. Customer export / import of encrypted backups.
6. Migration of existing accounts; published build hashes.
7. Verification page showing the Host cannot read data (what the Host console sees for an account: counts only).

## 12. Questions for you

1. Is "lost password and no recovery key = data gone" acceptable for your customers?
2. Should the data passphrase be separate from the sign-in password (stronger, more friction) or derived from the same password (simpler)?
3. Are reports that run without the customer present (scheduled emails with data) something you want to sell? If yes, this design needs an opt-in exception.
4. Ship a first version with encryption off and add it before paying customers, or hold launch until it is in?
