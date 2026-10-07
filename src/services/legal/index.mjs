// SERVICES / legal — the version of the legal pages people must accept (one constant), and what an account has accepted.
// The pages themselves are content/legal/*.md (rendered by the docs loader, shared by the app and the marketing site).
// Raise TERMS_VERSION, and the version in every content/legal page header, when the terms change: Administrators are then asked to accept again at their next sign-in.
export const TERMS_VERSION = '2026-10-07-draft';

// a: the accounts row (terms_version, terms_accepted_at). outdated: the account has not accepted the current version.
export const termsOf = (a) => ({ version: a?.terms_version || null, acceptedAt: a?.terms_accepted_at ? Number(a.terms_accepted_at) : null, current: TERMS_VERSION, outdated: (a?.terms_version || null) !== TERMS_VERSION });

export async function recordAcceptance(db, accountId, now = Date.now()) {
  await db.run('UPDATE accounts SET terms_version = ?, terms_accepted_at = ? WHERE id = ?', [TERMS_VERSION, now, accountId]);
}
