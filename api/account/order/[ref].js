// api/account/order/[ref].js — Détail d'une commande utilisateur (avec timeline)
import { supabase, getUserFromToken } from '../../../lib/supabase.js';
import { setCors, isValidReference } from '../../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  const { ref } = req.query;
  if (!ref) return res.status(400).json({ error: 'Référence manquante' });

  try {
    // Cherche par référence sticker OU par order_number
    let query = supabase.from('orders').select('*');

    if (isValidReference(ref)) {
      query = query.eq('reference', ref.toUpperCase());
    } else {
      query = query.eq('order_number', ref);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) {
      console.error('[account/order] erreur :', error);
      return res.status(500).json({ error: 'Erreur base de données' });
    }

    if (!order) return res.status(404).json({ error: 'Commande introuvable' });

    // Vérifie que la commande appartient à l'utilisateur (par user_id OU par email)
    if (order.user_id !== user.id && order.email !== user.email) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Récupère la timeline d'événements
    const { data: events } = await supabase
      .from('order_events')
      .select('event_type, message, created_at, metadata')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    return res.status(200).json({
      order,
      events: events || []
    });

  } catch (err) {
    console.error('[account/order] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
