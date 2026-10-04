// SERVICES / mail / own — a reseller's own mail server (SMTP) for the messages they send to their customers. The details live encrypted
// in the reseller's vault and arrive with each request; they are used once and never saved, logged or queued here.
import dns from 'node:dns/promises';
import net from 'node:net';
import nodemailer from 'nodemailer';
import { config } from '../../core/config.mjs';
import { LOGO_CID } from './theme.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGO_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'assets', 'logo-email.png');

export const OWN_PORTS = [25, 465, 587, 2525];
const EMAIL = /^[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>"]+$/;
const clean = (s, n) => String(s || '').replace(/[\r\n"<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Addresses that are not on the public internet (loopback, private, link-local, unique-local, etc).
export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const v = ip.toLowerCase(); if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7)); return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}

// Returns { smtp } (cleaned) or { code } naming what is wrong.
export async function checkOwnSmtp(s = {}) {
  const host = String(s.host || '').trim().toLowerCase().slice(0, 200), port = Number(s.port), secure = !!s.secure, from = String(s.fromAddress || '').trim();
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !EMAIL.test(from) || from.length > 200) return { code: 'MAIL_OWN_BAD' };
  if (!OWN_PORTS.includes(port) || (secure && port !== 465) || (!secure && port === 465)) return { code: 'MAIL_OWN_PORT' };
  if (!config.mailAllowPrivate) {
    let addrs = []; try { addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }); } catch { return { code: 'MAIL_OWN_CONNECT' }; }
    if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) return { code: 'MAIL_OWN_PRIVATE' };
  }
  return { smtp: { host, port, secure, user: String(s.user || '').slice(0, 200), pass: String(s.pass || '').slice(0, 400), fromName: clean(s.fromName, 80), fromAddress: from } };
}

export async function sendOwn(smtp, { to, subject, text, html, attachments }) {
  const t = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
  try { await t.sendMail({ from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromAddress}>` : smtp.fromAddress, to, subject, text, html, attachments: attachments || [{ filename: 'myboxstock.png', path: LOGO_FILE, cid: LOGO_CID }] }); } finally { t.close(); }
}
// Which of our messages fits what the mail server said.
export const ownErrorCode = (e) => e?.code === 'EAUTH' || /535|auth/i.test(String(e?.response || '')) ? 'MAIL_OWN_AUTH' : ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNREFUSED', 'EDNS'].includes(e?.code) ? 'MAIL_OWN_CONNECT' : 'MAIL_OWN_REFUSED';
