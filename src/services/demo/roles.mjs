// SERVICES / demo / roles — who may change Demo mode and see demo passwords: the Owner and Administrator roles on the Host.
// Host administrators are all Administrators today (the oldest is the Owner). A Host role that can only read (View) carries `role: 'View'` and is refused here.
export const canManage = (subject) => !subject?.role || /^(owner|administrator)$/i.test(String(subject.role));
