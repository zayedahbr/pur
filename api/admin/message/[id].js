// api/admin/message/[id].js — Update statut d'un ticket contact
import { supabase, requireAdmin } from '../../../lib/supabase.js';
import { setCors, sanitize } from '../../../lib/helpers.js';

const ALLOWED = ['open', 'read', 'replied', 'closed'];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Méthode non autorisée' });

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Accès admin requis' });

  const { id } = req.query;
  const b = req.body || {};

  const update = {};
  if (b.statut && ALLOWED.includes(b.statut)) {
    update.statut = b.statut;
    if (b.statut === 'replied') update.responded_at = new Date().toISOString();
  }
  if (typeof b.admin_response === 'string') {
    update.admin_response = sanitize(b.admin_response, 5000);
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'Aucune modification' });
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ message: data });
}
