// CORE / http — small request helpers shared by logging and auth.
// Inside nested Express routers `req.path` is relative to the mount point, so logs use the full original path.
export const fullPath = (req) => String(req.originalUrl || req.url || '').split('?')[0];
