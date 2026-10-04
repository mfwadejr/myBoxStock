// SERVICES / site — the public address of this site, used for every link in an email. The Host Console setting wins; the PUBLIC_URL environment value is the fallback.
import { getSetting } from '../../db/settings.mjs';
import { config } from '../../core/config.mjs';

export const cleanUrl = (v) => String(v || '').trim().replace(/\/+$/, '');

// What is wrong with an address, in plain words ('' = fine). Emails go to people outside your network, so it must work from anywhere.
export function urlProblem(v) {
  const u = cleanUrl(v); if (!u) return 'No site address is set, so links in emails will not work.';
  let x; try { x = new URL(u); } catch { return 'That is not a web address. Use the form https://app.example.com'; }
  if (!/^https?:$/.test(x.protocol) || x.pathname !== '/' && x.pathname !== '' || x.search || x.hash) return 'Use just the address, like https://app.example.com (no path).';
  const h = x.hostname.toLowerCase();
  if (/(^|\.)example\.(com|org|net)$/.test(h)) return 'This is still the example address. Enter your real site address.';
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home') || h.endsWith('.internal') || !h.includes('.') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === '::1' || h.startsWith('[')) return 'This is an address only your own network can reach. People outside it will get a broken link.';
  if (x.protocol !== 'https:') return 'This address is not secure (http). Use https.';
  return '';
}
export async function siteUrl(db) { return cleanUrl(await getSetting(db, 'site_url', '')) || cleanUrl(config.publicUrl); }
export async function siteStatus(db) { const saved = cleanUrl(await getSetting(db, 'site_url', '')), url = saved || cleanUrl(config.publicUrl); return { saved, fromEnv: !saved && !!url, url, problem: urlProblem(url) }; }
