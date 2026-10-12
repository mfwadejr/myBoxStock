// TEST helper — sign a new reseller account up in a real browser (used by the t53 to t55 browser tests). Returns the page and the login.
import fs from 'node:fs';
import { fillLogin } from './helpers.mjs';

export const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
export let pw; try { pw = await import('playwright'); } catch { try { pw = await import('/opt/npm-tools/node_modules/playwright/index.mjs'); } catch {} }
export const skip = !(pw && fs.existsSync(exe)) ? 'no browser available' : false;
export const PW = 'Sup3rSecretPass!';
export const launch = () => (pw.chromium || pw.default.chromium).launch({ executablePath: exe });
export const pick = async (p, id, value) => { await p.click('#' + id); await p.locator('#' + id).locator('xpath=..').locator(`.select-option[data-value="${value}"]`).click(); };
export async function signUp(srv, br, { biz = 'Test Co', user = 'tess', width = 1280, height = 1000 } = {}) {
  const ctx = await br.newContext({ viewport: { width, height } }), page = await ctx.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(srv.base + '/app/'); await page.click('[data-mode=signup]');
  await page.fill('#bn', biz); await page.fill('#em', user + '@example.com'); await page.fill('#un', user); await page.fill('#pw', PW); await page.check('#tc'); await page.click('button.block');
  await page.waitForSelector('#go'); const login = user + '@' + (await page.textContent('.codeblock')).trim(); await page.click('#go');
  await fillLogin(page, login); await page.fill('#p', PW); await page.click('button.block'); await page.waitForSelector('.recovery-key'); await page.check('#ok'); await page.click('#go');
  await page.waitForSelector('.side, .tabbar, nav', { timeout: 20000 }).catch(() => {});
  return { page, ctx, login, errors };
}
