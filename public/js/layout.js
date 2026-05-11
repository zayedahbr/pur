/* ============================================================
   Layout : nav et footer partagés, injectés via JS
   Permet de garder un seul endroit pour ces composants.
   ============================================================ */

const NAV_HTML = `
<nav class="nav" aria-label="Navigation principale">
  <div class="nav-inner">
    <a href="/" class="brand" aria-label="PureSpec — Accueil">PureSpec</a>
    <div class="nav-links">
      <a href="/" class="nav-link">Atelier</a>
      <a href="/registry" class="nav-link">Registry</a>
      <a href="/account" class="nav-link">Mon compte</a>
      <a href="/contact" class="nav-link">Contact</a>
    </div>
    <a href="/#atelier" class="nav-cta nav-cta-desktop">Concevoir</a>
    <button class="nav-mobile-toggle" aria-label="Menu" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  </div>
  <div class="nav-mobile-menu">
    <a href="/">Atelier</a>
    <a href="/registry">Registry</a>
    <a href="/account">Mon compte</a>
    <a href="/contact">Contact</a>
  </div>
</nav>
`;

const FOOTER_HTML = `
<footer class="footer">
  <div class="container">
    <div class="footer-disclaimer">
      <strong>*</strong> La fidélité de la teinte dépend de l'exposition et de la qualité de la photo soumise. L'algorithme interprète la zone sélectionnée par la pipette ; cependant, les variations de lumière naturelle sur votre peinture resteront toujours uniques. Nous vous conseillons de sélectionner une zone à la lumière du jour pour un résultat optimal. Les coloris imprimés peuvent légèrement différer du rendu écran en raison des calibrations colorimétriques propres à chaque support.
    </div>

    <div class="footer-grid">
      <div class="footer-brand-block">
        <div class="brand">PureSpec</div>
        <p>Film électrostatique haute définition conçu pour se fondre dans votre pare-brise. Pas pour le couvrir.</p>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Produit</div>
        <a href="/#atelier">Atelier</a>
        <a href="/#story">Philosophie</a>
        <a href="/registry">Registry</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Compte</div>
        <a href="/account">Mes commandes</a>
        <a href="/account/login">Connexion</a>
        <a href="/contact">Contact</a>
      </div>
      <div class="footer-col">
        <div class="footer-col-title">Légal</div>
        <a href="/legal">Mentions légales</a>
        <a href="/legal#cgv">CGV</a>
        <a href="/legal#privacy">Confidentialité</a>
      </div>
    </div>

    <div class="footer-bottom">
      <div>© <span id="footer-year"></span> PureSpec. Tous droits réservés.</div>
      <div>Conçu avec précision en France.</div>
    </div>
  </div>
</footer>
`;

function injectLayout() {
  // Nav
  const navSlot = document.getElementById('nav-slot');
  if (navSlot) {
    navSlot.outerHTML = NAV_HTML;
  } else if (!document.querySelector('.nav')) {
    document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  }

  // Footer
  const footerSlot = document.getElementById('footer-slot');
  if (footerSlot) {
    footerSlot.outerHTML = FOOTER_HTML;
  } else if (!document.querySelector('.footer')) {
    document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  }

  // Année dans le footer
  const y = document.getElementById('footer-year');
  if (y) y.textContent = new Date().getFullYear();
}

// Injecter dès que possible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectLayout);
} else {
  injectLayout();
}
