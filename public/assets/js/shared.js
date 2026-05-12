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

// ===== Init auto =====
document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupNavAuth();
});
