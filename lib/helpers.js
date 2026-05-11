// lib/helpers.js — helpers partagés côté serveur

/**
 * Génère une référence sticker PureSpec.
 * Format : PS + 6 caractères alphanumériques = 8 caractères total
 * Exclut O, I, 0, 1 pour éviter la confusion visuelle.
 * Exemple : PS7K9L2M
 */
export function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'PS' + suffix;
}

/**
 * Valide le format d'une référence PureSpec.
 * Accepte : PS + 6 alphanumériques.
 */
export function isValidReference(ref) {
  if (typeof ref !== 'string') return false;
  return /^PS[A-Z0-9]{6}$/i.test(ref.trim());
}

/**
 * Convertit un code ISO ou nom de pays en nom complet français.
 */
export function mapCountry(input) {
  if (!input) return 'France';
  const map = {
    FR: 'France', BE: 'Belgique', CH: 'Suisse',
    LU: 'Luxembourg', DE: 'Allemagne', IT: 'Italie',
    ES: 'Espagne', NL: 'Pays-Bas', PT: 'Portugal',
    GB: 'Royaume-Uni', UK: 'Royaume-Uni'
  };
  const key = input.toUpperCase();
  return map[key] || input;
}

/**
 * Headers CORS standardisés.
 */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Sanitise une string pour éviter l'injection HTML basique.
 */
export function sanitize(s, maxLen = 500) {
  if (s == null) return '';
  return String(s).slice(0, maxLen).replace(/[<>]/g, '');
}
