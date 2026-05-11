// api/admin/orders.js — Liste des commandes (admin uniquement)
import { supabase, requireAdmin } from '../../lib/supabase.js';
import { setCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Accès admin requis' });

  const { statut, q, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(10, parseInt(limit) || 50));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;

  try {
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (statut && statut !== 'all') {
      query = query.eq('statut', statut);
    }

    if (q && q.trim()) {
      const search = q.trim();
      query = query.or(`reference.ilike.%${search}%,order_number.ilike.%${search}%,email.ilike.%${search}%,nom.ilike.%${search}%,prenom.ilike.%${search}%`);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error('[admin/orders] erreur :', error);
      return res.status(500).json({ error: error.message });
    }

    // Compteurs par statut pour le dashboard
    const { data: counts } = await supabase
      .from('orders')
      .select('statut');

    const stats = (counts || []).reduce((acc, o) => {
      acc[o.statut] = (acc[o.statut] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      orders: data || [],
      pagination: { page: pageNum, limit: limitNum, total: count || 0 },
      stats
    });

  } catch (err) {
    console.error('[admin/orders] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
