// SERVICES / system / metrics — host resource numbers for the dashboard (container-aware where possible).
import os from 'node:os';
import fs from 'node:fs';
import { config, dbDisplay } from '../../core/config.mjs';
import { areaLogger } from '../../logging/logger.mjs';

const L = areaLogger('system');
const history = []; // one sample per 10 s, last hour
let lastCpu = null, lastWarn = { disk: 0, mem: 0 };

const cpuTimes = () => { let idle = 0, total = 0; for (const c of os.cpus()) { for (const v of Object.values(c.times)) total += v; idle += c.times.idle; } return { idle, total }; };
const readNum = (f) => { try { const v = fs.readFileSync(f, 'utf8').trim(); return v === 'max' ? null : Number(v); } catch { return null; } };

function memory() {
  const limit = readNum('/sys/fs/cgroup/memory.max') ?? readNum('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  const used = readNum('/sys/fs/cgroup/memory.current') ?? readNum('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  const total = limit && limit < os.totalmem() ? limit : os.totalmem();
  return { total, used: Math.min(used ?? (os.totalmem() - os.freemem()), total) };
}
function disk() {
  for (const p of [config.dataDir, '/']) { try { const s = fs.statfsSync(p); return { total: s.blocks * s.bsize, free: s.bavail * s.bsize, used: (s.blocks - s.bavail) * s.bsize }; } catch {} }
  return null;
}
function warnIfHigh(kind, pct) { // resource warnings, at most once per hour
  if (pct >= 90 && Date.now() - lastWarn[kind] > 3600e3) { lastWarn[kind] = Date.now(); L.warn(`${kind}.high`, `${kind === 'disk' ? 'Storage' : 'Memory'} is ${pct}% full`, { data: { pct } }); }
}
function sample() {
  const now = cpuTimes(); let cpu = 0;
  if (lastCpu) { const dt = now.total - lastCpu.total, di = now.idle - lastCpu.idle; cpu = dt > 0 ? Math.round((1 - di / dt) * 1000) / 10 : 0; }
  lastCpu = now;
  const m = memory(), d = disk();
  history.push({ t: Date.now(), cpu, mem: Math.round((m.used / m.total) * 1000) / 10 }); if (history.length > 360) history.shift();
  warnIfHigh('mem', Math.round(m.used / m.total * 100)); if (d) warnIfHigh('disk', Math.round(d.used / d.total * 100));
}
sample(); setInterval(sample, 10000).unref();

export const snapshot = (extra = {}) => ({
  version: config.version, node: process.version, platform: `${os.type()} ${os.release()}`, hostname: os.hostname(),
  uptimeSec: Math.round(process.uptime()), osUptimeSec: Math.round(os.uptime()), cpuCount: os.cpus().length, cpuModel: os.cpus()[0]?.model || '', load: os.loadavg(),
  memory: memory(), disk: disk(), processRss: process.memoryUsage().rss, database: { client: config.dbClient, label: dbDisplay() }, history, ...extra,
});
