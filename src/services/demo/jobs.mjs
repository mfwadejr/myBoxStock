// SERVICES / demo / jobs — Build, Remove and Reset demo as background jobs: they reuse the backup job system (one job at a time, a progress strip, polling), and can be stopped.
// Everything is checked before the job starts, so a refused build changes nothing.
import { startJob } from '../backup/jobs.mjs';
import { backupBusy } from '../backup/runner.mjs';
import { jobStep } from '../backup/progress.mjs';
import { getDemo, markBuilt } from './settings.mjs';
import { buildSet, checkBuild, planCeiling } from './build.mjs';
import { removeWithAudit, builtStats, previewRemove } from './remove.mjs';
import { coded, audit } from './audit.mjs';

const busy = () => { const by = backupBusy(); if (by) throw Object.assign(coded('HOST_JOB_RUNNING'), { by }); };
const fmt = (n) => Number(n).toLocaleString('en-US');

export async function startBuild(db, key, { actor, ip, anchor = Date.now() }) {
  busy();
  const section = await getDemo(db), set = section.sets.find(s => s.key === key); if (!set) throw coded('DEMO_SET_UNKNOWN');
  await checkBuild(db, set, { section, ceiling: await planCeiling(db, section), anchor });
  return startJob({ kind: 'demo-build', label: `Build demo set ${set.name}`, actor, ip, stoppable: true, run: async () => {
    const out = await buildSet(db, key, { actor, ip, anchor }); await markBuilt(db);
    return { ok: true, ...out, summary: `${out.stopped ? 'Stopped. ' : ''}${fmt(out.accounts)} of ${fmt(out.planned)} accounts built for ${set.name}: ${fmt(out.users)} people, ${fmt(out.devices)} devices, ${fmt(out.records)} records.` };
  } });
}
export async function startRemove(db, { set = null, actor, ip }) {
  busy();
  const p = await previewRemove(db, set); if (!p.accounts) throw coded('DEMO_NOT_BUILT');
  return startJob({ kind: 'demo-remove', label: set ? `Remove demo set ${set}` : 'Remove all demo accounts', actor, ip, stoppable: true, run: async () => {
    const out = await removeWithAudit(db, { set, actor, ip });
    return { ok: true, ...out, offerCompact: out.records > 0, summary: `${out.stopped ? 'Stopped. ' : ''}Removed ${fmt(out.accounts)} demo accounts, ${fmt(out.users)} people and ${fmt(out.records)} records. Real accounts were not touched.` };
  } });
}
// Reset demo: remove what is built (one set, or every built set) and build it again with the current settings.
export async function startReset(db, { set = null, actor, ip, anchor = Date.now() }) {
  busy();
  const section = await getDemo(db), st = await builtStats(db), keys = (set ? [set] : Object.keys(st)).filter(k => st[k]); if (!keys.length) throw coded('DEMO_NOT_BUILT');
  const sets = keys.map(k => section.sets.find(s => s.key === k)); if (sets.some(s => !s)) throw coded('DEMO_SET_UNKNOWN');
  for (const s of sets) await checkBuild(db, s, { section, ceiling: await planCeiling(db, section), anchor, skipBuilt: true });
  return startJob({ kind: 'demo-reset', label: set ? `Reset demo set ${set}` : 'Reset demo', actor, ip, stoppable: true, run: async () => {
    const built = []; let stopped = false;
    for (const s of sets) {
      jobStep(`Removing ${s.name}`, 2, 10); const gone = await removeWithAudit(db, { set: s.key, actor, ip, event: 'demo.reset' }); if (gone.stopped) { stopped = true; break; }
      jobStep(`Building ${s.name} again`, 10, 98); const out = await buildSet(db, s.key, { actor, ip, anchor }); built.push(out); if (out.stopped) { stopped = true; break; }
    }
    await markBuilt(db);
    audit('demo.reset', `Reset demo finished: ${built.map(b => fmt(b.accounts)).join(' + ')} accounts rebuilt${stopped ? ' (stopped early)' : ''}`, { actor, ip, data: { sets: keys, stopped } });
    return { ok: true, stopped, offerCompact: true, summary: `${stopped ? 'Stopped. ' : ''}Rebuilt ${sets.map(s => s.name).join(', ')} with the current settings. Real accounts were not touched.` };
  } });
}
