// api/pricing.js — endpoint public lecture seule
// Retourne le prix unitaire + la grille de livraison par pays.
// Cache 5 min côté CDN pour limiter les hits BDD.
import { supabase } from '../lib/supabase.js';

const DEFAULTS = {
  unit_price_eur: 9.90,
  shipping_rates: {
    FR: 3.50, MC: 3.50,
    BE: 5.90, LU: 5.90, NL: 5.90, DE: 5.90,
    IT: 6.90, ES: 6.90, PT: 6.90, AT: 6.90,
    IE: 7.90, DK: 7.90, SE: 7.90, FI: 7.90, NO: 9.90,
    CH: 8.90,
    PL: 7.90, CZ: 7.90, SK: 7.90, HU: 7.90, RO: 7.90, BG: 7.90,
    GR: 7.90, HR: 7.90, SI: 7.90,
    EE: 7.90, LV: 7.90, LT: 7.90, MT: 9.90, CY: 9.90,
    GB: 9.90
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['unit_price_eur', 'shipping_rates']);

    if (error) throw error;

    const out = { ...DEFAULTS };
    (data || []).forEach(row => {
      if (row.key === 'unit_price_eur') out.unit_price_eur = Number(row.value);
      if (row.key === 'shipping_rates') out.shipping_rates = row.value || DEFAULTS.shipping_rates;
    });

    return res.status(200).json(out);
  } catch (err) {
    console.error('[pricing]', err);
    // En cas d'erreur on retourne quand même les defaults pour ne pas casser le checkout
    return res.status(200).json(DEFAULTS);
  }
}
