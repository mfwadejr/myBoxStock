// TOOLS / site / settings — the one switch for the marketing site's sign-up state.
//   SIGNUPS = 'closed'  the main button is a plain "Sign-ups are currently closed" label (no link), notices show on the home page, footer, pricing and FAQ.
//   SIGNUPS = 'open'    the Sign up buttons link to the app's sign-up page and the closed notices are not shown.
// To open sign-ups: change the value below to 'open' (or build with SITE_SIGNUPS=open), run node tools/site/build.mjs again and upload the new zip.
// Keep the Host Settings sign-up switch in the app OFF while this says closed.
export const SIGNUPS = (process.env.SITE_SIGNUPS || 'closed') === 'open' ? 'open' : 'closed';
export const CLOSED = SIGNUPS === 'closed';

export const WORDS = {
  banner: 'myBoxStock is in active development. Sign-ups are currently closed.',
  button: 'Sign-ups are currently closed',
  pricing: 'Plans and pricing are still being finalized.',
  comingLead: 'Planned and not yet available. Plans can change, and no dates are promised.',
  faqQ: 'Can I sign up now?',
  faqA: 'Not yet. myBoxStock is in active development and sign-ups are currently closed. If you already have an account, you can log in as usual.',
};
