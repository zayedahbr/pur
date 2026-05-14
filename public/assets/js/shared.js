// ============================================================
// PureSpec — JS partagé (toutes pages)
// ============================================================

// ===== Toast =====
function showToast(msg, ms = 2400) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

// ===== Navbar auto-hide =====
function setupNav() {
  const nav = document.querySelector('.nav-blur');
  if (!nav) return;
  let lastY = window.scrollY;
  let ticking = false;
  const THRESHOLD = 8;
  const HIDE_AFTER = 80;

  const onScroll = () => {
    const y = window.scrollY;
    const delta = y - lastY;
    if (Math.abs(delta) < THRESHOLD) { ticking = false; return; }
    if (y > HIDE_AFTER && delta > 0) nav.classList.add('nav-hidden');
    else nav.classList.remove('nav-hidden');
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
}

// ===== Auth state check =====
async function fetchMe() {
  try {
    const r = await fetch('/api/auth?action=me', { credentials: 'include' });
    if (!r.ok) return null;
    const data = await r.json();
    return data.user || null;
  } catch { return null; }
}

async function setupNavAuth() {
  const ic = document.getElementById('navAccountIcon');
  if (!ic) return;
  const user = await fetchMe();
  if (user) {
    const initial = (user.prenom || user.email || '?').charAt(0).toUpperCase();
    ic.innerHTML = `<span style="font-size:13px;font-weight:600;color:#1d1d1f;letter-spacing:-0.01em">${initial}</span>`;
    ic.setAttribute('href', '/dashboard');
    ic.setAttribute('aria-label', 'Mon espace');
    ic.style.background = '#e8e8ed';
  }
}

// ===== Format utils =====
function formatPrice(eur) {
  return Number(eur || 0).toFixed(2).replace('.', ',') + ' €';
}
function formatDate(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const opts = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'long', year: 'numeric' };
  return d.toLocaleDateString('fr-FR', opts);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ===== Status badges =====
const STATUS_LABELS = {
  pending: { label: 'En attente paiement', class: 'badge-gray' },
  paid: { label: 'Payée', class: 'badge-blue' },
  in_production: { label: 'En production', class: 'badge-purple' },
  shipped: { label: 'Expédiée', class: 'badge-amber' },
  delivered: { label: 'Livrée', class: 'badge-green' },
  cancelled: { label: 'Annulée', class: 'badge-red' },
  refunded: { label: 'Remboursée', class: 'badge-red' }
};
function statusBadge(status) {
  const s = STATUS_LABELS[status] || { label: status, class: 'badge-gray' };
  return `<span class="badge ${s.class}">${s.label}</span>`;
}

// ===== Inject language switcher into nav-actions (pages secondaires) =====
function injectLangSwitch() {
  // Si déjà présent (legal/cgv en ont un en dur dans le markup) → skip
  if (document.getElementById('langSwitchBtn')) return;
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;
  const btn = document.createElement('button');
  btn.id = 'langSwitchBtn';
  btn.type = 'button';
  btn.className = 'lang-switch';
  btn.setAttribute('aria-label', 'Langue / Language');
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span id="langSwitchLabel">' + (window.PS_LANG || 'fr').toUpperCase() + '</span>';
  // Insère en première position de .nav-actions
  actions.insertBefore(btn, actions.firstChild);
  btn.addEventListener('click', () => {
    const cur = window.PS_LANG || 'fr';
    if (typeof window.PS_SET_LANG === 'function') {
      window.PS_SET_LANG(cur === 'fr' ? 'en' : 'fr');
    }
  });
}

// ===== Navbar mobile menu (auto-injection sur les pages secondaires) =====
function setupSharedMobileMenu() {
  const navInner = document.querySelector('.nav-inner');
  const navActions = navInner ? navInner.querySelector('.nav-actions') : null;
  const navLinks = navInner ? navInner.querySelector('.nav-links') : null;
  if (!navInner || !navActions || !navLinks) return;
  if (document.getElementById('sharedNavBurger')) return; // déjà fait

  // 1. Injecte le bouton hamburger dans nav-actions
  const burger = document.createElement('button');
  burger.id = 'sharedNavBurger';
  burger.type = 'button';
  burger.className = 'nav-burger';
  burger.setAttribute('aria-label', 'Ouvrir le menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="17" x2="21" y2="17"/></svg>';
  navActions.appendChild(burger);

  // 2. Construit le drawer plein écran à partir des liens existants
  const links = Array.from(navLinks.querySelectorAll('.nav-link'));
  const drawer = document.createElement('div');
  drawer.className = 'nav-mobile-menu';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.innerHTML = `
    <div class="nav-mobile-head">
      <a href="/" class="nav-brand">PureSpec</a>
      <button class="nav-burger" id="sharedNavBurgerClose" type="button" aria-label="Fermer">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <nav class="nav-mobile-body"></nav>
    <div class="nav-mobile-footer">
      <a href="/#atelier" class="btn btn-primary btn-block" data-nav-close>Concevoir</a>
    </div>
  `;
  const body = drawer.querySelector('.nav-mobile-body');
  links.forEach(a => {
    const m = document.createElement('a');
    m.href = a.getAttribute('href');
    m.textContent = a.textContent.trim();
    m.className = 'nav-mobile-link';
    m.dataset.navClose = '';
    body.appendChild(m);
  });
  // Ajoute "Mon compte" si pas déjà présent
  if (!links.some(a => /compte|espace|connect/i.test(a.textContent))) {
    const acc = document.createElement('a');
    acc.href = '/account';
    acc.textContent = 'Mon compte';
    acc.className = 'nav-mobile-link';
    acc.dataset.navClose = '';
    body.appendChild(acc);
  }
  document.body.appendChild(drawer);

  const open = () => {
    drawer.classList.add('open');
    document.body.classList.add('nav-locked');
    burger.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    drawer.classList.remove('open');
    document.body.classList.remove('nav-locked');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', open);
  drawer.querySelector('#sharedNavBurgerClose').addEventListener('click', close);
  drawer.querySelectorAll('[data-nav-close]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) close();
  });
}

// ===== Init auto =====
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupNavAuth();
  injectLangSwitch();
  setupSharedMobileMenu();
  setupCookieBanner();
});

// ============================================================
// COOKIE BANNER (auto-injection si pas encore accepté)
// ============================================================
function setupCookieBanner() {
  const KEY = 'ps_cookie_consent';
  let accepted = null;
  try { accepted = localStorage.getItem(KEY); } catch {}
  // Toujours exposer openCookieSettings (lien footer)
  window.openCookieSettings = () => {
    try { localStorage.removeItem(KEY); } catch {}
    showCookieBanner();
  };
  if (accepted === '1') return;
  showCookieBanner();

  function showCookieBanner() {
    if (document.getElementById('cookieBanner')) {
      document.getElementById('cookieBanner').classList.add('show');
      return;
    }
    const t = (window._t || (k => k));
    const banner = document.createElement('div');
    banner.id = 'cookieBanner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookies');
    banner.innerHTML = `
      <h4>${t('cookie.title')}</h4>
      <p>${t('cookie.body')}</p>
      <div class="cookie-banner-actions">
        <button type="button" class="cookie-banner-accept" id="cookieAccept">${t('cookie.accept')}</button>
        <a href="/legal" class="cookie-banner-link">${t('cookie.learn')} →</a>
      </div>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    document.getElementById('cookieAccept').addEventListener('click', () => {
      try { localStorage.setItem(KEY, '1'); } catch {}
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    });
  }
}
