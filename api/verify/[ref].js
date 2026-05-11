// api/verify/[ref].js — vérifie l'authenticité d'un sticker par sa référence
// GET /api/verify/PSXXXXXX
import { supabase } from '../../lib/supabase.js';
import { isValidReference, setCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { ref } = req.query;

  if (!ref || !isValidReference(ref)) {
    return res.status(400).json({
      authentic: false,
      error: 'invalid_format',
      message: 'Format de référence invalide. Une référence PureSpec commence par PS suivi de 6 caractères.'
    });
  }

  const reference = ref.toUpperCase();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('reference, marque, modele, type_version, moteur, nom_couleur, code_couleur, instagram, bg_color, statut, paid_at')
      .eq('reference', reference)
      .in('statut', ['paid', 'in_production', 'shipped', 'delivered'])
      .maybeSingle();

    if (error) {
      console.error('[verify] erreur BDD :', error);
      return res.status(500).json({ authentic: false, error: 'server_error' });
    }

    if (!data) {
      return res.status(404).json({
        authentic: false,
        message: 'Aucun sticker authentique ne correspond à cette référence.'
      });
    }

    return res.status(200).json({
      authentic: true,
      sticker: {
        reference: data.reference,
        marque: data.marque,
        modele: data.modele,
        version: data.type_version,
        moteur: data.moteur,
        couleur: data.nom_couleur,
        code_couleur: data.code_couleur,
        instagram: data.instagram,
        bg_color: data.bg_color,
        date: data.paid_at
      }
    });

  } catch (err) {
    console.error('[verify] erreur :', err);
    return res.status(500).json({ authentic: false, error: err.message });
  }
}
