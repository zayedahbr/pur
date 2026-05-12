// api/orders.js — Commandes du client connecté
// Actions : list | get
import { supabase } from '../lib/supabase.js';
import { requireCustomer } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const auth = await requireCustomer(req);
  if (!auth) return res.status(401).json({ error: 'Non connecté' });

  const action = (req.query.action || 'list').toLowerCase();

  try {
    if (action === 'list') return await listOrders(req, res, auth);
    if (action === 'get') return await getOrder(req, res, auth);
    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    console.error('[orders]', err);
    return res.status(500).json({ error: err.message });
  }
}

async function listOrders(req, res, auth) {
  // On affiche les commandes liées au customer_id OU à l'email du client
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, reference, marque, modele, type_version, nom_couleur, bg_color, quantite, total_eur, statut, created_at, paid_at, shipped_at, delivered_at, carrier, tracking_number, tracking_url')
    .or(`customer_id.eq.${auth.customer.id},email.eq.${auth.customer.email}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  return res.status(200).json({ orders: data || [] });
}

async function getOrder(req, res, auth) {
  const ref = req.query.ref || req.query.id;
  if (!ref) return res.status(400).json({ error: 'Référence manquante' });

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`reference.eq.${ref},order_number.eq.${ref},id.eq.${ref}`)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  if (!data) return res.status(404).json({ error: 'Commande introuvable' });

  // Sécurité : la commande doit appartenir au client
  if (data.customer_id !== auth.customer.id && data.email !== auth.customer.email) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  // Masque les champs internes
  const { admin_notes, ...publicOrder } = data;
  return res.status(200).json({ order: publicOrder });
}
