// api/admin/me.js — Vérifie que le user connecté est admin
import { requireAdmin } from '../../lib/supabase.js';
import { setCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ admin: false });

  return res.status(200).json({ admin: true, email: admin.email });
}
