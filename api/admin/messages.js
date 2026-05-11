// api/admin/messages.js — Liste tickets contact (admin)
import { supabase, requireAdmin } from '../../lib/supabase.js';
import { setCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Accès admin requis' });

  const { statut } = req.query;

  try {
    let query = supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (statut && statut !== 'all') {
      query = query.eq('statut', statut);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ messages: data || [] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
