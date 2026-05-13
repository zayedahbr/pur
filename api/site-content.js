// api/site-content.js — endpoint pour le mode édition inline
// Permet à l'admin (avec EDIT_KEY) de modifier les textes de la home et autres pages
// sans redéployer. Stocké dans la table site_content (key, content).
//
// Actions :
//   GET  ?action=list           → public, retourne tous les overrides actifs
//   POST ?action=verify         → vérifie la clé d'édition (body: { key })
//   POST ?action=save           → sauvegarde des modifications (body: { key, updates: {key: text} })
//
import { supabase } from '../lib/supabase.js';

const EDIT_KEY = process.env.EDIT_KEY || '';

function isValidKey(key) {
  return EDIT_KEY && typeof key === 'string' && key === EDIT_KEY;
}

export default async function handler(req, res) {
  const action = req.query.action || '';

  // Cache court pour la lecture publique
  if (req.method === 'GET' && action === 'list') {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('key, content');
      if (error) throw error;
      const content = {};
      (data || []).forEach(row => { content[row.key] = row.content; });
      return res.status(200).json({ content });
    } catch (err) {
      console.error('[site-content:list]', err);
      // Sans BDD ou table : retour vide (pas d'override)
      return res.status(200).json({ content: {} });
    }
  }

  if (req.method === 'POST' && action === 'verify') {
    const body = req.body || {};
    return res.status(200).json({ ok: isValidKey(body.key) });
  }

  if (req.method === 'POST' && action === 'save') {
    const body = req.body || {};
    if (!isValidKey(body.key)) {
      return res.status(401).json({ error: 'Clé invalide.' });
    }
    const updates = body.updates || {};
    const entries = Object.entries(updates);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'Aucune modification à sauvegarder.' });
    }
    if (entries.length > 200) {
      return res.status(400).json({ error: 'Trop de modifications en une seule fois.' });
    }
    try {
      // Upsert ligne par ligne (ou en lot via .upsert avec onConflict)
      const rows = entries.map(([k, v]) => ({
        key: String(k).slice(0, 120),
        content: String(v).slice(0, 4000),
        updated_at: new Date().toISOString()
      }));
      const { error } = await supabase
        .from('site_content')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      return res.status(200).json({ ok: true, count: rows.length });
    } catch (err) {
      console.error('[site-content:save]', err);
      return res.status(500).json({ error: err.message || 'Sauvegarde échouée.' });
    }
  }

  return res.status(404).json({ error: 'Action inconnue.' });
}
