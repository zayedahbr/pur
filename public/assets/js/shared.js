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
    ic.textContent = initial;
    ic.setAttribute('href', '/dashboard');
    ic.setAttribute('aria-label', 'Mon espace');
    // garde le style noir + lettre blanche (Figma)
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

// ===== Navbar mobile menu (câble le bouton Menu au drawer pour les pages secondaires) =====
function setupSharedMobileMenu() {
  const burger = document.getElementById('navBurger');
  const drawer = document.getElementById('navMobileMenu');
  const closeBtn = document.getElementById('navBurgerClose');
  if (!burger || !drawer) return;

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
  if (closeBtn) closeBtn.addEventListener('click', close);
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
