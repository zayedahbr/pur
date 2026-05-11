/* ============================================================
   PureSpec — Common JS (helpers partagés, Supabase client, nav)
   ============================================================ */

/* ====== CONFIG (injectée par les pages) ======
   Chaque page doit définir window.PURESPEC_CONFIG = { supabaseUrl, supabaseAnonKey }
   AVANT de charger ce script.
*/

/* ====== SUPABASE CLIENT (chargé via CDN dans les pages qui en ont besoin) ====== */
let _supabase = null;
let _configPromise = null;

async function ensureConfig() {
  const cfg = window.PURESPEC_CONFIG;
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey
      && !cfg.supabaseUrl.includes('__SUPABASE')
      && !cfg.supabaseAnonKey.includes('__SUPABASE')) {
    return cfg;
  }
  if (!_configPromise) {
    _configPromise = fetch('/api/config').then(r => r.json()).then(c => {
      window.PURESPEC_CONFIG = c;
      return c;
    }).catch(err => {
      console.error('[purespec] Impossible de charger /api/config:', err);
      return null;
    });
  }
  return _configPromise;
}

function getSupabase() {
  if (_supabase) return _supabase;
  if (!window.supabase || !window.PURESPEC_CONFIG) return null;
  const cfg = window.PURESPEC_CONFIG;
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey
      || cfg.supabaseUrl.includes('__SUPABASE')
      || cfg.supabaseAnonKey.includes('__SUPABASE')) {
    return null;
  }
  _supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return _supabase;
}

async function getSupabaseAsync() {
  if (_supabase) return _supabase;
  await ensureConfig();
  return getSupabase();
}

/* ====== AUTH HELPERS ====== */
async function getCurrentUser() {
  const sb = await getSupabaseAsync();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

async function getAuthToken() {
  const sb = await getSupabaseAsync();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || null;
}

async function signInWithMagicLink(email, redirectTo) {
  const sb = await getSupabaseAsync();
  if (!sb) throw new Error('Supabase non initialisé');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo || (window.location.origin + '/account')
    }
  });
  if (error) throw error;
  return true;
}

async function signOut() {
  const sb = await getSupabaseAsync();
  if (!sb) return;
  await sb.auth.signOut();
}

/* ====== API HELPER (auto-injecte le token si dispo) ====== */
async function apiRequest(path, options = {}) {
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    const err = new Error((data && data.error) || ('HTTP ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ====== TOAST ====== */
function showToast(msg, type = 'default') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = 'toast';
  if (type === 'success') toast.classList.add('toast-success');
  if (type === 'danger') toast.classList.add('toast-danger');
  toast.textContent = msg;

  // Force reflow puis show
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ====== ESCAPE HTML ====== */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ====== FORMAT DATE / MONEY ====== */
function formatDate(iso, opts) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', opts || { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) { return '—'; }
}
function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return '—'; }
}
function formatMoney(n) {
  return Number(n || 0).toFixed(2).replace('.', ',') + '\u00a0€';
}

/* ====== NAV AUTOHIDE + MOBILE MENU ====== */
function setupNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const delta = y - lastY;
    if (Math.abs(delta) < 8) { ticking = false; return; }
    if (y > 80 && delta > 0) {
      nav.classList.add('is-hidden');
    } else {
      nav.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });

  // Mobile menu toggle
  const toggle = document.querySelector('.nav-mobile-toggle');
  const menu = document.querySelector('.nav-mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', menu.classList.contains('is-open'));
    });
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => menu.classList.remove('is-open'));
    });
  }

  // Marque le lien actif
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-link, .nav-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const cleanHref = href.replace(/\/$/, '') || '/';
    if (cleanHref === path) a.classList.add('is-active');
  });
}

document.addEventListener('DOMContentLoaded', setupNav);

/* Expose globally */
window.PureSpec = {
  getSupabase,
  getCurrentUser,
  getAuthToken,
  signInWithMagicLink,
  signOut,
  apiRequest,
  showToast,
  escapeHtml,
  formatDate,
  formatDateTime,
  formatMoney
};
