// SERVICES / mail / theme — email clients can't read CSS variables, so email styling is centralized here and
// a test verifies every value equals the matching token in public/css/tokens.css.
export const EMAIL_THEME = {
  '--color-bg': '#f5f5f7',
  '--color-surface': '#ffffff',
  '--color-text': '#1d1d1f',
  '--color-text-faint': '#86868b',
  '--color-primary': '#0071e3',
  '--color-primary-on': '#ffffff',
  '--radius-lg': '18px',
  '--radius-pill': '999px',
};
const T = EMAIL_THEME;
export const emailStyles = {
  body: `margin:0;background:${T['--color-bg']};font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:${T['--color-text']}`,
  card: `max-width:520px;margin:32px auto;background:${T['--color-surface']};border-radius:${T['--radius-lg']};padding:32px`,
  brand: `font-weight:600;font-size:18px;margin-bottom:16px`,
  button: `display:inline-block;background:${T['--color-primary']};color:${T['--color-primary-on']};text-decoration:none;padding:10px 20px;border-radius:${T['--radius-pill']}`,
  faint: `color:${T['--color-text-faint']}`,
};
