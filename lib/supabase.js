// lib/supabase.js — client Supabase pour le backend (clé service_role)
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] Variables d\'environnement manquantes');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false }
  }
);

/**
 * Vérifie un token d'auth utilisateur (JWT côté client) et retourne le user.
 * Utilisé pour authentifier les requêtes côté API.
 */
export async function getUserFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (err) {
    console.error('[auth] getUserFromToken error:', err);
    return null;
  }
}

/**
 * Vérifie que l'utilisateur connecté est admin.
 * Retourne le user si admin, null sinon.
 */
export async function requireAdmin(authHeader) {
  const user = await getUserFromToken(authHeader);
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data?.is_admin) return null;
  return user;
}
