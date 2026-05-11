// api/account/profile.js — Lire/mettre à jour le profil utilisateur
import { supabase, getUserFromToken } from '../../lib/supabase.js';
import { setCors, sanitize, mapCountry } from '../../lib/helpers.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Non authentifié' });

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

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
