// CORE / messages — every user-facing error in one place. The server sends { error: <text>, code: <CODE> }.
// Wording rule: say what actually happened and what to do next. The only deliberately vague message is LOGIN_INVALID
// (a wrong password and an unknown user look identical, so the form cannot be used to discover accounts).
export const MSG = {
  NOT_SIGNED_IN: 'Your session has ended. Please sign in again.',
  CSRF_BAD: 'This page is out of date. Refresh the page and try again.',
  PASSWORD_CHANGE_REQUIRED: 'You need to choose a new password before continuing.',
  PERMISSION_DENIED: 'Your user type does not allow this action.',
  LOGIN_MISSING_FIELDS: 'Enter your sign-in and password.',
  LOGIN_INVALID: 'Incorrect sign-in or password.',
  LOGIN_LOCKED: 'Too many failed attempts. Try again in 15 minutes.',
  MFA_LOCKED: 'Too many incorrect codes. Sign in again in a few minutes.',
  ACCOUNT_SUSPENDED: 'This account has been suspended. Please contact support.',
  USER_DISABLED: 'Your sign-in has been disabled. Ask your account administrator.',
  ACCOUNT_READ_ONLY: 'This account is read-only because its trial or paid period has ended. Please contact support to continue.',
  RATE_LIMITED: 'Too many requests. Please slow down and try again shortly.',
  AUTH_RATE_LIMITED: 'Too many sign-in attempts from your network. Try again in a few minutes.',
  NOT_FOUND: 'That item could not be found.',
  BAD_ACCOUNT_STATUS: 'Choose Active or Suspended.',
  TOTP_SETUP_FIRST: 'Start two-factor setup first, then enter the code from your authenticator app.',
  UNKNOWN_LOG_AREA: 'That log area does not exist.',
};
export const fail = (res, status, code, extra = {}) => res.status(status).json({ error: MSG[code], code, ...extra });
