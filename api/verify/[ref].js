// api/verify/[ref].js — vérifie l'authenticité d'un sticker par sa référence
// GET /api/verify/P0789453
import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { ref } = req.query;

  // Validation : 8 caractères alphanumériques
  if (!ref || !/^[A-Z0-9]{8}$/i.test(ref)) {
    return res.status(400).json({
      authentic: false,
      error: 'Format de référence invalide',
      message: 'La référence doit contenir 8 caractères (lettres et chiffres).'
    });
  }

  const reference = ref.toUpperCase();

  try {
    // On ne renvoie QUE les champs publics, et seulement si la commande est payée/expédiée
    const { data, error } = await supabase
      .from('orders')
      .select('reference, marque, modele, type_version, moteur, nom_couleur, code_couleur, instagram, bg_color, statut, paid_at')
      .eq('reference', reference)
      .in('statut', ['paid', 'shipped'])
      .maybeSingle();

    if (error) {
      console.error('[verify] erreur BDD :', error);
      return res.status(500).json({ authentic: false, error: 'Erreur serveur' });
    }

    if (!data) {
      return res.status(404).json({
        authentic: false,
        message: 'Aucun sticker authentique ne correspond à cette référence.'
      });
    }

    // Sticker authentique : on renvoie les infos publiques
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
