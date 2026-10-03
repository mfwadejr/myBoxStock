// SERVICES / mail / transport — builds a nodemailer transport: direct-to-MX delivery or an SMTP relay.
import dns from 'node:dns/promises';
import os from 'node:os';
import nodemailer from 'nodemailer';

export async function transportFor(settings, toAddr) {
  if (settings.mode === 'smtp') {
    const m = settings.smtp;
    return { transport: nodemailer.createTransport({ host: m.host, port: m.port, secure: m.secure, auth: m.user ? { user: m.user, pass: m.pass } : undefined }), via: `relay ${m.host}:${m.port}` };
  }
  const domain = toAddr.split('@')[1];
  let hosts = [];
  try { hosts = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority).map(x => x.exchange); } catch {}
  if (!hosts.length) hosts = [domain];
  return { transport: nodemailer.createTransport({ host: hosts[0], port: 25, secure: false, name: settings.heloName || os.hostname(), tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 }), via: `direct to ${hosts[0]}:25` };
}
