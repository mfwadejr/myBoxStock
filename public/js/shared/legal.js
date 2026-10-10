// SHARED / legal — the links to the legal pages (Terms, Privacy, ...) shown in the footer of both apps and on the sign-up page.
// The pages are content/legal/*.md. In the reseller app they open inside the app (#/legal/<slug>); in the Host Console they open as plain pages (/legal/<slug>).
(() => {
  // [slug, full page title, short link label]. The pages keep their full titles; the links are short so they fit in one tidy block on a phone.
  const PAGES = [['terms-of-service', 'Terms of Service', 'Terms'], ['privacy-policy', 'Privacy Policy', 'Privacy'], ['data-responsibility-and-acceptable-use', 'Data responsibility and acceptable use', 'Data use'], ['billing-trial-and-refund-terms', 'Billing, trial and refund terms', 'Billing']];
  UI.legal = {
    pages: PAGES,
    href: (slug, plain) => (plain ? '/legal/' : '#/legal/') + slug,
    // A row of links. plain = real addresses opening in a new tab (Host Console); otherwise in-app links (newTab: also open in a new tab, so a half-filled sign-up form is kept).
    links: (plain = false, newTab = plain) => `<nav class="legal-links" aria-label="Legal">${PAGES.map(([s, t, short]) => `<a href="${UI.legal.href(s, plain)}" title="${t}" aria-label="${t}"${newTab ? ' target="_blank" rel="noopener"' : ''}>${short}</a>`).join('')}</nav>`,
    footer: (plain = false) => `<footer class="legal-foot">${UI.legal.links(plain)}</footer>`,
  };
})();
