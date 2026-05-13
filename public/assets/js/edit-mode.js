// ============================================================
// PureSpec — Mode édition inline (admin)
// Activé via ?edit=KEY dans l'URL (où KEY est la EDIT_KEY env var)
// Permet de modifier les textes [data-edit] et de les sauvegarder.
// ============================================================

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const editKey = params.get('edit');
  if (!editKey) return;

  let isAuthorized = false;
  let pending = {}; // { [key]: text } — modifications en attente
  let initialValues = {}; // { [key]: text } — état initial pour comparer

  // ============ Vérification de la clé ============
  async function verifyKey() {
    try {
      const r = await fetch('/api/site-content?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: editKey })
      });
      if (!r.ok) return false;
      const data = await r.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  // ============ Charge les overrides existants ============
  async function loadOverrides() {
    try {
      const r = await fetch('/api/site-content?action=list', { credentials: 'include' });
      if (!r.ok) return {};
      const data = await r.json();
      return data.content || {};
    } catch { return {}; }
  }

  // ============ Active le mode édition ============
  async function enableEditMode() {
    isAuthorized = await verifyKey();
    if (!isAuthorized) {
      console.warn('[edit-mode] Clé invalide — mode désactivé.');
      return;
    }

    // Applique les overrides existants AVANT de capturer l'état initial
    const overrides = await loadOverrides();
    document.querySelectorAll('[data-edit-key]').forEach(el => {
      const key = el.dataset.editKey;
      if (overrides[key] != null) el.textContent = overrides[key];
    });

    document.body.classList.add('edit-mode');

    // Capture les valeurs initiales
    document.querySelectorAll('[data-edit-key]').forEach(el => {
      initialValues[el.dataset.editKey] = el.textContent.trim();
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');

      el.addEventListener('input', () => {
        const k = el.dataset.editKey;
        const v = el.textContent;
        if (v !== initialValues[k]) {
          pending[k] = v;
        } else {
          delete pending[k];
        }
        updateBar();
      });

      el.addEventListener('blur', () => {
        // Nettoie les sauts de ligne et balises injectées au paste
        el.textContent = el.textContent.replace(/\s+/g, ' ').trim();
      });

      el.addEventListener('paste', (e) => {
        // Force le paste en texte brut
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, text);
      });
    });

    injectBar();
  }

  // ============ Barre admin en haut ============
  function injectBar() {
    const bar = document.createElement('div');
    bar.className = 'edit-mode-bar';
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Mode édition — <span id="editPendingCount">0</span> modification(s) en attente
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="editCancelBtn" type="button" style="background:transparent;color:#ffffff;border:1px solid rgba(255,255,255,0.4)">Annuler</button>
        <button id="editSaveBtn" type="button">Sauvegarder</button>
      </div>
    `;
    document.body.prepend(bar);

    document.getElementById('editSaveBtn').addEventListener('click', save);
    document.getElementById('editCancelBtn').addEventListener('click', cancel);
  }

  function updateBar() {
    const c = document.getElementById('editPendingCount');
    if (c) c.textContent = Object.keys(pending).length;
    const btn = document.getElementById('editSaveBtn');
    if (btn) {
      btn.disabled = Object.keys(pending).length === 0;
      btn.style.opacity = Object.keys(pending).length === 0 ? '0.5' : '1';
    }
  }

  async function save() {
    if (Object.keys(pending).length === 0) return;
    const btn = document.getElementById('editSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Sauvegarde…';

    try {
      const r = await fetch('/api/site-content?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: editKey, updates: pending })
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || 'Sauvegarde échouée');
      }
      // Met à jour l'état initial
      Object.entries(pending).forEach(([k, v]) => { initialValues[k] = v; });
      pending = {};
      updateBar();
      btn.textContent = 'Sauvegardé ✓';
      setTimeout(() => { btn.textContent = 'Sauvegarder'; btn.disabled = false; }, 1800);
    } catch (e) {
      alert('Erreur : ' + e.message);
      btn.textContent = 'Sauvegarder';
      btn.disabled = false;
    }
  }

  function cancel() {
    document.querySelectorAll('[data-edit-key]').forEach(el => {
      const k = el.dataset.editKey;
      if (initialValues[k] != null) el.textContent = initialValues[k];
    });
    pending = {};
    updateBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableEditMode);
  } else {
    enableEditMode();
  }
})();

// ============ Chargement public des overrides (mode normal, sans ?edit) ============
// Tous les visiteurs voient les textes modifiés par l'admin.
(async function loadPublicOverrides() {
  if (new URLSearchParams(window.location.search).get('edit')) return; // déjà chargé en mode édition
  try {
    const r = await fetch('/api/site-content?action=list', { credentials: 'omit' });
    if (!r.ok) return;
    const data = await r.json();
    const content = data.content || {};
    const apply = () => {
      document.querySelectorAll('[data-edit-key]').forEach(el => {
        const k = el.dataset.editKey;
        if (content[k] != null) el.textContent = content[k];
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  } catch { /* silent */ }
})();
