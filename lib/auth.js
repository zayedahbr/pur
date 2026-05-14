// lib/auth.js — helpers d'authentification (clients + admin)
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { supabase } from './supabase.js';

const SESSION_DAYS = 30;
const COOKIE_CUSTOMER = 'ps_session';
const COOKIE_ADMIN = 'ps_admin';

// ---------- Hash / verify ----------
export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}
export function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  try { return bcrypt.compareSync(plain, hash); }
  catch { return false; }
}

// ---------- Sessions ----------
export function generateToken() {
  return randomBytes(32).toString('hex');
}

export async function createSession({ kind, userId, req }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
          || req?.headers?.['x-real-ip']
          || null;
  const ua = req?.headers?.['user-agent'] || null;
  const { error } = await supabase.from('sessions').insert({
    token, kind, user_id: userId, ip, user_agent: ua,
    expires_at: expiresAt.toISOString()
  });
  if (error) throw error;
  return { token, expiresAt };
}

export async function deleteSession(token) {
  if (!token) return;
  await supabase.from('sessions').delete().eq('token', token);
}

export async function getSession(token, kind) {
  if (!token) return null;
  const { data } = await supabase.from('sessions')
    .select('*')
    .eq('token', token)
    .eq('kind', kind)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) {
    deleteSession(token).catch(() => {});
    return null;
  }
  return data;
}

// ---------- Cookies ----------
export function parseCookies(req) {
  const out = {};
  const raw = req?.headers?.cookie || '';
  raw.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export function buildCookie(name, value, opts = {}) {
  const maxAge = opts.maxAge ?? SESSION_DAYS * 86400;
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name) {
  const parts = [
    `${name}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export const COOKIE_NAMES = { customer: COOKIE_CUSTOMER, admin: COOKIE_ADMIN };

// ---------- Middlewares (helpers) ----------
export async function requireCustomer(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_CUSTOMER];
  const session = await getSession(token, 'customer');
  if (!session) return null;
  const { data: customer } = await supabase
    .from('customers')
    .select('id, email, prenom, nom, telephone, adresse, complement, ville, code_postal, pays, created_at')
    .eq('id', session.user_id)
    .maybeSingle();
  return customer ? { customer, token } : null;
}

export async function requireAdmin(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_ADMIN];
  const session = await getSession(token, 'admin');
  if (!session) return null;
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, email, nom, role, created_at')
    .eq('id', session.user_id)
    .maybeSingle();
  return admin ? { admin, token } : null;
}

// ---------- Validation ----------
export function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
export function isStrongEnoughPassword(p) {
  return typeof p === 'string' && p.length >= 8;
}

// ---------- Rate limit basique (en mémoire, par instance Vercel) ----------
const rateMap = new Map();
export function rateLimit(key, maxPerMinute = 10) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const k = `${key}:${minute}`;
  const count = (rateMap.get(k) || 0) + 1;
  rateMap.set(k, count);
  // Cleanup
  if (rateMap.size > 500) {
    for (const [kk] of rateMap) {
      const mm = parseInt(kk.split(':').pop(), 10);
      if (mm < minute - 2) rateMap.delete(kk);
    }
  }
  return count <= maxPerMinute;
}
