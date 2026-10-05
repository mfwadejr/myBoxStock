// SERVICES / backup / cost — what the backup settings will cost in disk space and upload, worked out from the real database size.
// Pure: give it numbers, get numbers back. The estimate is on the safe side (no allowance for compression).
import { steadyCount } from './thin.mjs';

export const fmtBytes = (n) => { if (n == null || !Number.isFinite(n)) return 'an unknown amount'; const u = ['bytes', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`; };

// in: { dbBytes, frequent:{enabled,everyMinutes,thin}, offsite:{enabled,everyMinutes,thin,destinations:[...]}, full:{enabled,frequency,keepDaily,keepWeekly,destinations:[...]},
//       safety:{keepMin}, freeBytes, usedByBackupsBytes }
export function estimateCost(i) {
  const db = Math.max(0, Number(i.dbBytes) || 0), perDay = (m) => 1440 / m;
  let local = 0, remote = 0, up = 0;
  if (i.frequent?.enabled) local += steadyCount(i.frequent.everyMinutes, i.frequent.thin) * db;
  const offDests = Math.max(0, (i.offsite?.destinations || []).length);
  if (i.offsite?.enabled && offDests) { remote += steadyCount(i.offsite.everyMinutes, i.offsite.thin) * db * offDests; up += perDay(i.offsite.everyMinutes) * db * offDests; }
  if (i.full?.enabled) {
    const files = (i.full.keepDaily || 0) + (i.full.keepWeekly || 0), fd = Math.max(0, (i.full.destinations || []).length) + (i.full.offboxDir ? 1 : 0), perDayFull = i.full.frequency === 'weekly' ? 1 / 7 : 1;
    local += files * db; remote += files * db * fd; up += perDayFull * db * fd;
  }
  local += (i.safety?.keepMin ?? 5) * db; // a few safety copies are always kept
  const free = i.freeBytes ?? null, roomy = free == null ? true : Math.max(0, local - (i.usedByBackupsBytes || 0)) + 2 * db < free;
  const line = db ? `At these settings you will hold about ${fmtBytes(local)} here${remote ? ` and ${fmtBytes(remote)} away from this server` : ''} and upload about ${fmtBytes(up)} a day.` : 'The database size is not known yet, so the space needed cannot be worked out.';
  return { dbBytes: db, localBytes: local, remoteBytes: remote, uploadPerDay: up, fits: roomy, freeBytes: free, line, warning: db && !roomy ? `This will not fit in the free space on this server (${fmtBytes(free)} free). Keep fewer copies, make them less often, or add disk space.` : '' };
}
