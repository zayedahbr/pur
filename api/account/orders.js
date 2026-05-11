// api/account/orders.js — Liste des commandes de l'utilisateur connecté
import { supabase, getUserFromToken } from '../../lib/supabase.js';
import { setCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  try {
    // Récupère les commandes de l'utilisateur, ou celles de son email (pour les commandes invité)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, reference, order_number, marque, modele, type_version, moteur, nom_couleur, code_couleur, bg_color, instagram, quantite, total_eur, statut, tracking_number, tracking_carrier, created_at, paid_at, shipped_at, delivered_at')
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[account/orders] erreur :', error);
      return res.status(500).json({ error: 'Erreur base de données' });
    }

    // Pour chaque commande non liée à l'user, on la rattache (idempotent)
    const unlinked = (orders || []).filter(o => !o.user_id || o.user_id !== user.id);
    if (unlinked.length > 0) {
      await supabase
        .from('orders')
        .update({ user_id: user.id })
        .eq('email', user.email)
        .is('user_id', null);
    }

    return res.status(200).json({ orders: orders || [] });

  } catch (err) {
    console.error('[account/orders] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
