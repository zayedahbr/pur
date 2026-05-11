// api/account.js — Endpoint consolidé pour l'espace client
// Resources :
//   GET    /api/account?resource=orders         → liste des commandes
//   GET    /api/account?resource=order&ref=X    → détail commande + timeline
//   GET    /api/account?resource=profile        → lire profil
//   PATCH  /api/account?resource=profile        → mettre à jour profil
import { supabase, getUserFromToken } from '../lib/supabase.js';
import { setCors, sanitize, mapCountry, isValidReference } from '../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

  const { resource } = req.query;

  try {
    // ============ LISTE COMMANDES ============
    if (resource === 'orders' && req.method === 'GET') {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, reference, order_number, marque, modele, type_version, moteur, nom_couleur, code_couleur, bg_color, instagram, quantite, total_eur, statut, tracking_number, tracking_carrier, created_at, paid_at, shipped_at, delivered_at')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) return res.status(500).json({ error: 'Erreur base de données' });

      // Auto-rattache les commandes invité au compte
      await supabase
        .from('orders')
        .update({ user_id: user.id })
        .eq('email', user.email)
        .is('user_id', null);

      return res.status(200).json({ orders: orders || [] });
    }

    // ============ DÉTAIL COMMANDE ============
    if (resource === 'order' && req.method === 'GET') {
      const { ref } = req.query;
      if (!ref) return res.status(400).json({ error: 'Référence manquante' });

      let query = supabase.from('orders').select('*');
      if (isValidReference(ref)) {
        query = query.eq('reference', ref.toUpperCase());
      } else {
        query = query.eq('order_number', ref);
      }
      const { data: order, error } = await query.maybeSingle();

      if (error) return res.status(500).json({ error: 'Erreur base de données' });
      if (!order) return res.status(404).json({ error: 'Commande introuvable' });
      if (order.user_id !== user.id && order.email !== user.email) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      const { data: events } = await supabase
        .from('order_events')
        .select('event_type, message, created_at, metadata')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      return res.status(200).json({ order, events: events || [] });
    }

    // ============ PROFIL ============
    if (resource === 'profile') {
      if (req.method === 'GET') {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ profile: data });
      }

      if (req.method === 'PATCH') {
        const b = req.body || {};
        const update = {
          prenom: sanitize(b.prenom, 100),
          nom: sanitize(b.nom, 100),
          telephone: sanitize(b.telephone, 30),
          adresse: sanitize(b.adresse, 300),
          complement: sanitize(b.complement, 300),
          ville: sanitize(b.ville, 100),
          code_postal: sanitize(b.code_postal, 20),
          pays: mapCountry(b.pays || 'FR'),
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', user.id)
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ profile: data });
      }
    }

    return res.status(400).json({ error: 'Resource invalide' });

  } catch (err) {
    console.error('[account]', err);
    return res.status(500).json({ error: err.message });
  }
}
