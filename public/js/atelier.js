/* ============================================================
   PureSpec — Atelier (configurateur de sticker)
   Logique : preview live, presets de couleur, pipette,
            commande, génération de référence PS+6.
   ============================================================ */

const LOGO_WHITE = 'https://i.ibb.co/Mkf2dqwg/pure-Werk-Variant-1-full-transparent.png';
const LOGO_BLACK = 'https://i.ibb.co/SwCNkt3L/pure-Werk-Variant-2-full-transparent.png';
const CIRCUIT_URLS = {
  1: 'https://raw.githubusercontent.com/zayedahbr/pur/d605d0183be2c00b7c9f3ba46417973d83a7da79/circuit%201.svg',
  2: 'https://raw.githubusercontent.com/zayedahbr/pur/d605d0183be2c00b7c9f3ba46417973d83a7da79/Circuit%202.svg',
  3: 'https://raw.githubusercontent.com/zayedahbr/pur/9795e7139d8e4c22c4e6673b17d3ca045c97cb0d/Circuit%203.svg'
};

const UNIT_PRICE = 9.90;
const SHIPPING = 3.50;

const state = {
  circuit: 1,
  circuitColor: '#000000',
  circuitOpacity: 0.25,
  txtMode: 'white',
  bgColor: '#8B1C23',
  qty: 1
};

/* =========================== RÉFÉRENCE ============================== */
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRef() {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  return 'PS' + suffix;
}
function applyRef(ref) {
  const el = document.getElementById('prev-ref');
  if (el) el.textContent = ref;
  updateOrderSummary();
}
function regenerateRef() {
  const r = generateRef();
  applyRef(r);
  PureSpec.showToast('Nouvelle référence : ' + r);
}

/* =========================== CHAMPS TEXTE ============================== */
function setField(field, value) {
  const upper = String(value || '').toUpperCase();
  const prev = document.getElementById('prev-' + field);
  if (prev) prev.textContent = upper;

  // Sync entre tous les inputs liés (data-field=field)
  document.querySelectorAll(`[data-field="${field}"]`).forEach(inp => {
    if (inp.value !== upper) inp.value = upper;
  });
  updateOrderSummary();
}

function setFieldFromInput(field, el) {
  el.value = (el.value || '').toUpperCase();
  setField(field, el.value);
}

/* =========================== COULEUR FOND ============================== */
function setBg(hex) {
  state.bgColor = hex;
  const bg = document.getElementById('stickerBg');
  if (bg) bg.style.background = hex;
  document.querySelectorAll('[data-color-input="bg"]').forEach(i => i.value = hex);
}

function applyBgPreset(color, btn) {
  document.querySelectorAll('[data-preset="bg"]').forEach(b => b.classList.toggle('is-on', b === btn));
  setBg(color);
}

function clearBgPresets() {
  document.querySelectorAll('[data-preset="bg"]').forEach(b => b.classList.remove('is-on'));
}

/* =========================== TXT MODE (BLANC / NOIR) ============================== */
function setTxtMode(mode) {
  state.txtMode = mode;
  const txtColor = mode === 'black' ? '#111' : '#fff';
  document.querySelectorAll('.txt-line').forEach(e => e.style.color = txtColor);
  const logo = document.getElementById('stickerLogo');
  if (logo) logo.src = mode === 'black' ? LOGO_BLACK : LOGO_WHITE;
  const stripe = document.getElementById('stickerStripe');
  if (stripe) {
    stripe.style.background = mode === 'black' ? '#111' : '#fff';
    stripe.style.color = mode === 'black' ? '#fff' : '#111';
  }
  document.querySelectorAll('[data-txt-mode]').forEach(b => {
    b.classList.toggle('is-on', b.dataset.txtMode === mode);
  });
}

/* =========================== CIRCUIT MOTIF ============================== */
function setCircuit(n) {
  state.circuit = n;
  const url = CIRCUIT_URLS[n];
  const el = document.getElementById('circuitImg');
  if (el) {
    el.style.webkitMaskImage = `url(${url})`;
    el.style.maskImage = `url(${url})`;
  }
  document.querySelectorAll('[data-circuit]').forEach(b => {
    b.classList.toggle('is-on', parseInt(b.dataset.circuit) === n);
  });
}

function setCircuitColor(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
  state.circuitColor = hex;
  const el = document.getElementById('circuitImg');
  if (el) el.style.backgroundColor = hex;
  document.querySelectorAll('[data-color-input="circuit"]').forEach(i => i.value = hex);
}

function applyCircuitPreset(color, btn) {
  document.querySelectorAll('[data-preset="circuit"]').forEach(b => b.classList.toggle('is-on', b === btn));
  setCircuitColor(color);
  setCircuitOpacity(0.25);
}

function clearCircuitPresets() {
  document.querySelectorAll('[data-preset="circuit"]').forEach(b => b.classList.remove('is-on'));
}

function setCircuitOpacity(v) {
  v = parseFloat(v);
  state.circuitOpacity = v;
  const el = document.getElementById('circuitImg');
  if (el) el.style.opacity = v;
  document.querySelectorAll('[data-circuit-opacity]').forEach(slider => {
    if (slider.tagName === 'INPUT') slider.value = v;
  });
  document.querySelectorAll('[data-circuit-opacity-label]').forEach(lbl => {
    lbl.textContent = Math.round(v * 100) + '%';
  });
}

/* =========================== PIPETTE ============================== */
let edTarget = null; // 'bg' | 'circuit'
let edPickedHex = null;
let edImage = null;

function openEyedropper(target) {
  edTarget = target;
  edPickedHex = null;
  const modal = document.getElementById('eyedropperModal');
  document.getElementById('edTitle').textContent =
    target === 'bg' ? 'Couleur carrosserie — pipette' : 'Accent circuit — pipette';

  document.getElementById('edUploadStep').style.display = 'block';
  document.getElementById('edPickStep').style.display = 'none';
  document.getElementById('edPickedHex').textContent = '—';
  document.getElementById('edPickedSwatch').style.background = '#e5e5e7';
  document.getElementById('edApplyBtn').disabled = true;
  document.getElementById('edFileInput').value = '';

  const block = document.getElementById('edPaletteBlock');
  const loading = document.getElementById('edPaletteLoading');
  const grid = document.getElementById('edPaletteGrid');
  if (block) block.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (grid) grid.innerHTML = '';

  const hint = document.getElementById('edNativeHint');
  if (hint) hint.style.display = ('EyeDropper' in window) ? 'block' : 'none';

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeEyedropper() {
  document.getElementById('eyedropperModal').classList.remove('show');
  document.body.style.overflow = '';
  edImage = null;
}

function resetEyedropper() {
  document.getElementById('edUploadStep').style.display = 'block';
  document.getElementById('edPickStep').style.display = 'none';
  document.getElementById('edFileInput').value = '';
  document.getElementById('edApplyBtn').disabled = true;
  const block = document.getElementById('edPaletteBlock');
  const loading = document.getElementById('edPaletteLoading');
  const grid = document.getElementById('edPaletteGrid');
  if (block) block.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (grid) grid.innerHTML = '';
  document.getElementById('edPickedHex').textContent = '—';
  document.getElementById('edPickedSwatch').style.background = '#e5e5e7';
  edPickedHex = null;
  edImage = null;
}

function handleEyedropperFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    PureSpec.showToast('Veuillez sélectionner une image');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      edImage = img;
      drawEyedropperImage(img);
      document.getElementById('edUploadStep').style.display = 'none';
      document.getElementById('edPickStep').style.display = 'block';
    };
    img.onerror = () => PureSpec.showToast('Impossible de charger cette image');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function drawEyedropperImage(img) {
  const canvas = document.getElementById('edCanvas');
  const MAX = 1200;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > MAX || h > MAX) {
    const ratio = Math.min(MAX / w, MAX / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function setupEyedropperCanvas() {
  const wrap = document.getElementById('edCanvasWrap');
  const canvas = document.getElementById('edCanvas');
  if (!wrap || !canvas) return;

  const pickAt = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');
    const px = ctx.getImageData(
      Math.max(0, Math.min(canvas.width - 1, Math.floor(x))),
      Math.max(0, Math.min(canvas.height - 1, Math.floor(y))),
      1, 1
    ).data;
    return rgbToHex(px[0], px[1], px[2]);
  };

  const finalize = (clientX, clientY) => {
    const rect = wrap.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    analyzeZoneAndShowPalette(canvas, clientX, clientY);
  };

  let pickingDown = false;
  wrap.addEventListener('mousedown', e => {
    e.preventDefault();
    pickingDown = true;
    let lx = e.clientX, ly = e.clientY;
    const onMove = ev => { lx = ev.clientX; ly = ev.clientY; };
    const onUp = () => {
      pickingDown = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      finalize(lx, ly);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  wrap.addEventListener('touchend', e => {
    const t = (e.changedTouches && e.changedTouches[0]);
    if (t) finalize(t.clientX, t.clientY);
  });
}

function analyzeZoneAndShowPalette(sourceCanvas, clientX, clientY) {
  const rect = sourceCanvas.getBoundingClientRect();
  const cx = ((clientX - rect.left) / rect.width) * sourceCanvas.width;
  const cy = ((clientY - rect.top) / rect.height) * sourceCanvas.height;

  const zoneRatio = 0.20;
  const minSide = Math.min(sourceCanvas.width, sourceCanvas.height);
  const zoneSize = Math.max(60, Math.round(minSide * zoneRatio));

  let zx = Math.round(cx - zoneSize / 2);
  let zy = Math.round(cy - zoneSize / 2);
  let zw = zoneSize, zh = zoneSize;
  if (zx < 0) { zw += zx; zx = 0; }
  if (zy < 0) { zh += zy; zy = 0; }
  if (zx + zw > sourceCanvas.width) zw = sourceCanvas.width - zx;
  if (zy + zh > sourceCanvas.height) zh = sourceCanvas.height - zy;
  if (zw < 8 || zh < 8) return;

  const zoneCanvas = document.createElement('canvas');
  zoneCanvas.width = zw; zoneCanvas.height = zh;
  zoneCanvas.getContext('2d').drawImage(sourceCanvas, zx, zy, zw, zh, 0, 0, zw, zh);

  const exactCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const ex = Math.max(0, Math.min(sourceCanvas.width - 1, Math.floor(cx)));
  const ey = Math.max(0, Math.min(sourceCanvas.height - 1, Math.floor(cy)));
  const ep = exactCtx.getImageData(ex, ey, 1, 1).data;
  const exactHex = rgbToHex(ep[0], ep[1], ep[2]);

  const block = document.getElementById('edPaletteBlock');
  const loading = document.getElementById('edPaletteLoading');
  const grid = document.getElementById('edPaletteGrid');
  block.style.display = 'none';
  grid.innerHTML = '';
  loading.style.display = 'flex';

  const dataUrl = zoneCanvas.toDataURL('image/png');
  const tmpImg = new Image();
  tmpImg.crossOrigin = 'anonymous';
  tmpImg.onload = () => {
    let rawPalette = [];
    if (typeof ColorThief !== 'undefined') {
      try {
        const ct = new ColorThief();
        let raw = ct.getPalette(tmpImg, 10, 1);
        if (!raw || raw.length < 2) raw = ct.getPalette(tmpImg, 8, 5);
        if (raw && raw.length) rawPalette = raw.map(rgb => rgbToHex(rgb[0], rgb[1], rgb[2]));
      } catch (_) {}
    }
    const set = new Set();
    const final = [];
    const push = h => { const k = h.toUpperCase(); if (!set.has(k)) { set.add(k); final.push(k); } };
    push(exactHex);
    rawPalette.forEach(push);
    if (final.length < 6) {
      generateHslVariations(rawPalette[0] || exactHex, 6 - final.length).forEach(push);
    }
    const list = final.slice(0, 6);
    renderPalette(list);
    loading.style.display = 'none';
    block.style.display = 'block';
    selectPaletteColor(list[0]);
  };
  tmpImg.onerror = () => {
    loading.style.display = 'none';
    const fallback = [exactHex, ...generateHslVariations(exactHex, 5)];
    renderPalette(fallback);
    block.style.display = 'block';
    selectPaletteColor(exactHex);
  };
  tmpImg.src = dataUrl;
}

function generateHslVariations(hex, n) {
  const hsl = hexToHsl(hex);
  if (!hsl) return [];
  const offsets = [[+12,0],[-12,0],[+22,-5],[-22,+5],[0,+10],[0,-10],[+6,+8],[-6,-8]];
  const out = [];
  for (let i = 0; i < offsets.length && out.length < n; i++) {
    const [dL, dS] = offsets[i];
    const L = Math.max(0, Math.min(100, hsl.l + dL));
    const S = Math.max(0, Math.min(100, hsl.s + dS));
    const h = hslToHex(hsl.h, S, L);
    if (h && h.toUpperCase() !== hex.toUpperCase()) out.push(h);
  }
  return out;
}

function hexToHsl(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.substr(0, 2), 16) / 255;
  const g = parseInt(h.substr(2, 2), 16) / 255;
  const b = parseInt(h.substr(4, 2), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let H = 0, S = 0, L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = (g - b) / d + (g < b ? 6 : 0); break;
      case g: H = (b - r) / d + 2; break;
      case b: H = (r - g) / d + 4; break;
    }
    H *= 60;
  }
  return { h: H, s: S * 100, l: L * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return rgbToHex(f(0), f(8), f(4));
}

function renderPalette(colors) {
  const grid = document.getElementById('edPaletteGrid');
  grid.innerHTML = '';
  colors.forEach((hex, idx) => {
    const div = document.createElement('div');
    div.className = 'ct-swatch';
    div.style.background = hex;
    div.dataset.hex = hex;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', 'Choisir ' + hex);
    div.title = idx === 0 ? hex + ' — pixel précis' : hex;
    div.addEventListener('click', () => selectPaletteColor(hex));
    grid.appendChild(div);
  });
}

function selectPaletteColor(hex) {
  if (!hex) return;
  edPickedHex = hex.toUpperCase();
  document.querySelectorAll('#edPaletteGrid .ct-swatch').forEach(el => {
    el.classList.toggle('is-selected', (el.dataset.hex || '').toUpperCase() === edPickedHex);
  });
  document.getElementById('edPickedSwatch').style.background = edPickedHex;
  document.getElementById('edPickedHex').textContent = edPickedHex;
  document.getElementById('edApplyBtn').disabled = false;
}

function applyEyedropperColor() {
  if (!edPickedHex) return;
  if (edTarget === 'bg') {
    setBg(edPickedHex);
    clearBgPresets();
    PureSpec.showToast('Couleur appliquée : ' + edPickedHex);
  } else if (edTarget === 'circuit') {
    setCircuitColor(edPickedHex);
    clearCircuitPresets();
    PureSpec.showToast('Accent appliqué : ' + edPickedHex);
  }
  closeEyedropper();
}

async function useNativeEyedropper() {
  if (!('EyeDropper' in window)) {
    PureSpec.showToast('Pipette native non supportée par ce navigateur');
    return;
  }
  try {
    const dropper = new EyeDropper();
    const result = await dropper.open();
    edPickedHex = result.sRGBHex.toUpperCase();
    applyEyedropperColor();
  } catch (_) {}
}

function setupEyedropperDropzone() {
  const zone = document.getElementById('edUploadZone');
  if (!zone) return;
  ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation(); zone.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('is-drag');
  }));
  zone.addEventListener('drop', e => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleEyedropperFile(file);
  });
}

function setupEyedropperBackdrop() {
  const modal = document.getElementById('eyedropperModal');
  if (!modal) return;
  modal.addEventListener('click', e => {
    if (e.target === modal) closeEyedropper();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) closeEyedropper();
  });
}

/* =========================== COMMANDE ============================== */
function getConfigData() {
  const get = id => (document.getElementById(id) || {}).textContent || '';
  return {
    marque: get('prev-marque'),
    modele: get('prev-modele'),
    type: get('prev-type'),
    moteur: get('prev-moteur'),
    nomcouleur: get('prev-nomcouleur'),
    codecouleur: get('prev-codecouleur'),
    insta: get('prev-insta'),
    ref: get('prev-ref'),
    bgColor: state.bgColor,
    txtMode: state.txtMode,
    circuit: state.circuit,
    circuitColor: state.circuitColor,
    circuitOpacity: state.circuitOpacity
  };
}

function updateOrderSummary() {
  const c = getConfigData();
  const t = document.getElementById('orderSummaryTitle');
  if (t) t.textContent = `${c.marque} ${c.modele} ${c.type}`.trim();
}

function openOrderModal() {
  const c = getConfigData();

  // Validation minimale : marque + modele
  if (!c.marque.trim() || !c.modele.trim()) {
    PureSpec.showToast('Renseignez au moins marque et modèle');
    return;
  }

  const modal = document.getElementById('orderModal');
  document.getElementById('orderStep1').classList.remove('hidden');
  document.getElementById('orderStep2').classList.add('hidden');
  document.getElementById('orderStep3').classList.add('hidden');

  document.getElementById('orderSummaryTitle').textContent = `${c.marque} ${c.modele} ${c.type}`.trim();

  document.getElementById('orderSummaryDetails').innerHTML = `
    <div class="row-between"><span class="muted">Marque & modèle</span><span>${PureSpec.escapeHtml(c.marque + ' ' + c.modele)}</span></div>
    <div class="row-between"><span class="muted">Version</span><span>${PureSpec.escapeHtml(c.type || '—')}</span></div>
    <div class="row-between"><span class="muted">Code moteur</span><span>${PureSpec.escapeHtml(c.moteur || '—')}</span></div>
    <div class="row-between"><span class="muted">Couleur</span><span>${PureSpec.escapeHtml(c.nomcouleur || '—')}${c.codecouleur ? ' <span class="muted">(' + PureSpec.escapeHtml(c.codecouleur) + ')</span>' : ''}</span></div>
    <div class="row-between"><span class="muted">Instagram</span><span>${c.insta ? '@' + PureSpec.escapeHtml(c.insta) : '—'}</span></div>
    <div class="row-between"><span class="muted">Référence</span><span class="mono">${PureSpec.escapeHtml(c.ref)}</span></div>
  `;
  document.querySelectorAll('#orderSummaryDetails > div').forEach((row, i) => {
    if (i > 0) row.style.marginTop = '10px';
  });

  const mini = document.getElementById('miniStickerContainer');
  if (mini) {
    mini.innerHTML = '';
    const clone = document.getElementById('stickerRoot').cloneNode(true);
    const wrap = document.createElement('div');
    wrap.style.transform = 'scale(0.45)';
    wrap.style.transformOrigin = 'center';
    wrap.appendChild(clone);
    mini.appendChild(wrap);
  }

  updateQtyDisplay();
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Si user connecté, pré-remplit le form
  prefillOrderForm();
}

async function prefillOrderForm() {
  const user = await PureSpec.getCurrentUser();
  if (!user) return;
  try {
    const data = await PureSpec.apiRequest('/api/account?resource=profile');
    const p = data.profile;
    if (!p) return;
    const form = document.getElementById('orderForm');
    if (!form) return;
    if (p.prenom) form.firstname.value = p.prenom;
    if (p.nom) form.lastname.value = p.nom;
    if (user.email) form.email.value = user.email;
    if (p.telephone) form.phone.value = p.telephone;
    if (p.adresse) form.address.value = p.adresse;
    if (p.code_postal) form.postcode.value = p.code_postal;
    if (p.ville) form.city.value = p.ville;
  } catch (_) {}
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('show');
  document.body.style.overflow = '';
}

function updateQty(delta) {
  state.qty = Math.max(1, Math.min(99, state.qty + delta));
  updateQtyDisplay();
}

function updateQtyDisplay() {
  const display = document.getElementById('qtyDisplay');
  if (display) display.textContent = state.qty;
  const subtotal = state.qty * UNIT_PRICE;
  const fmt = n => n.toFixed(2).replace('.', ',') + '\u00a0€';
  const t = document.getElementById('orderTotal');
  if (t) t.textContent = fmt(subtotal);
  const st = document.getElementById('orderSubtotal');
  if (st) st.textContent = fmt(subtotal);
  const gt = document.getElementById('orderGrandTotal');
  if (gt) gt.textContent = fmt(subtotal + SHIPPING);
}

function goToOrderStep2() {
  document.getElementById('orderStep1').classList.add('hidden');
  document.getElementById('orderStep2').classList.remove('hidden');
}

function backToOrderStep1() {
  document.getElementById('orderStep2').classList.add('hidden');
  document.getElementById('orderStep1').classList.remove('hidden');
}

async function submitOrder(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const customer = Object.fromEntries(formData.entries());
  const config = getConfigData();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-light"></span><span>Redirection…</span>';
  }

  try {
    const data = await PureSpec.apiRequest('/api/checkout', {
      method: 'POST',
      body: { config, customer, quantity: state.qty, unitPrice: UNIT_PRICE, shipping: SHIPPING }
    });
    if (!data.url) throw new Error('Aucune URL de paiement reçue');
    window.location.href = data.url;
  } catch (err) {
    console.error('[order]', err);
    PureSpec.showToast('Erreur : ' + err.message, 'danger');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  }
}

/* =========================== RETOUR STRIPE (success / cancelled) ============================== */
(function handleStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === '1') {
    const ref = params.get('ref') || '';
    const orderNum = params.get('order') || '';
    setTimeout(() => showSuccessScreen({ ref, orderNum }), 400);
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('cancelled') === '1') {
    setTimeout(() => PureSpec.showToast('Paiement annulé'), 400);
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

function showSuccessScreen({ ref, orderNum }) {
  const refEl = document.getElementById('orderStickerRef');
  if (refEl) refEl.textContent = ref || '—';
  const numEl = document.getElementById('orderNumber');
  if (numEl) numEl.textContent = orderNum || '—';

  document.getElementById('orderStep1').classList.add('hidden');
  document.getElementById('orderStep2').classList.add('hidden');
  document.getElementById('orderStep3').classList.remove('hidden');

  const modal = document.getElementById('orderModal');
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

/* =========================== INIT ============================== */
document.addEventListener('DOMContentLoaded', () => {
  setupEyedropperCanvas();
  setupEyedropperDropzone();
  setupEyedropperBackdrop();

  setTxtMode('white');
  setCircuit(1);
  setCircuitOpacity(0.25);

  applyRef(generateRef());
  updateOrderSummary();
  updateQtyDisplay();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeOrderModal();
});

// Exposer pour les onclick inline du HTML
window.atelier = {
  setField, setFieldFromInput, regenerateRef,
  setBg, applyBgPreset, clearBgPresets,
  setTxtMode, setCircuit, setCircuitColor, applyCircuitPreset, setCircuitOpacity,
  openEyedropper, closeEyedropper, resetEyedropper,
  handleEyedropperFile, applyEyedropperColor, useNativeEyedropper,
  openOrderModal, closeOrderModal, updateQty, goToOrderStep2, backToOrderStep1, submitOrder
};
