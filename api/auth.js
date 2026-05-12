// api/auth.js — Endpoint consolidé pour l'auth client
// Actions : signup | login | logout | me | forgot | reset | update-profile
import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import {
  hashPassword, verifyPassword, generateToken, createSession,
  deleteSession, getSession, parseCookies, buildCookie, clearCookie,
  COOKIE_NAMES, requireCustomer, isValidEmail, isStrongEnoughPassword,
  rateLimit
} from '../lib/auth.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = (req.query.action || '').toLowerCase();
  const method = req.method;

  try {
    if (action === 'me' && method === 'GET') return await me(req, res);
    if (action === 'signup' && method === 'POST') return await signup(req, res);
    if (action === 'login' && method === 'POST') return await login(req, res);
    if (action === 'logout' && method === 'POST') return await logout(req, res);
    if (action === 'forgot' && method === 'POST') return await forgot(req, res);
    if (action === 'reset' && method === 'POST') return await reset(req, res);
    if (action === 'update-profile' && method === 'POST') return await updateProfile(req, res);
    if (action === 'change-password' && method === 'POST') return await changePassword(req, res);
    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    console.error('[auth]', action, err);
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}

// ---------- ME ----------
async function me(req, res) {
  const auth = await requireCustomer(req);
  if (!auth) return res.status(200).json({ user: null });
  return res.status(200).json({ user: auth.customer });
}

// ---------- SIGNUP ----------
async function signup(req, res) {
  const { email, password, prenom, nom, telephone, adresse, complement, ville, code_postal, pays } = req.body || {};

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`signup:${ip}`, 5)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans une minute.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Vérifier que l'email n'existe pas
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
  }

  const password_hash = hashPassword(password);
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      email: cleanEmail,
      password_hash,
      prenom: prenom || null,
      nom: nom || null,
      telephone: telephone || null,
      adresse: adresse || null,
      complement: complement || null,
      ville: ville || null,
      code_postal: code_postal || null,
      pays: pays || 'France'
    })
    .select()
    .single();

  if (error) {
    console.error('[signup] error:', error);
    return res.status(500).json({ error: 'Impossible de créer le compte' });
  }

  // Lie les commandes existantes (même email) à ce nouveau compte
  await supabase
    .from('orders')
    .update({ customer_id: customer.id })
    .eq('email', cleanEmail)
    .is('customer_id', null);

  // Session
  const { token } = await createSession({ kind: 'customer', userId: customer.id, req });
  res.setHeader('Set-Cookie', buildCookie(COOKIE_NAMES.customer, token));

  // Email de bienvenue (best-effort)
  if (resend && process.env.EMAIL_FROM) {
    resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: cleanEmail,
      subject: 'Bienvenue chez PureSpec',
      html: welcomeEmail({ prenom: prenom || '' })
    }).catch(e => console.warn('[signup] mail err:', e.message));
  }

  return res.status(200).json({
    user: {
      id: customer.id,
      email: customer.email,
      prenom: customer.prenom,
      nom: customer.nom,
      telephone: customer.telephone,
      adresse: customer.adresse,
      complement: customer.complement,
      ville: customer.ville,
      code_postal: customer.code_postal,
      pays: customer.pays
    }
  });
}

// ---------- LOGIN ----------
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`login:${ip}`, 10)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans une minute.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (!customer || !verifyPassword(password, customer.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  await supabase.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);

  const { token } = await createSession({ kind: 'customer', userId: customer.id, req });
  res.setHeader('Set-Cookie', buildCookie(COOKIE_NAMES.customer, token));

  return res.status(200).json({
    user: {
      id: customer.id,
      email: customer.email,
      prenom: customer.prenom,
      nom: customer.nom,
      telephone: customer.telephone,
      adresse: customer.adresse,
      complement: customer.complement,
      ville: customer.ville,
      code_postal: customer.code_postal,
      pays: customer.pays
    }
  });
}

// ---------- LOGOUT ----------
async function logout(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAMES.customer];
  if (token) await deleteSession(token);
  res.setHeader('Set-Cookie', clearCookie(COOKIE_NAMES.customer));
  return res.status(200).json({ ok: true });
}

// ---------- FORGOT ----------
async function forgot(req, res) {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`forgot:${ip}`, 5)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie dans une minute.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const { data: customer } = await supabase
    .from('customers')
    .select('id, email, prenom')
    .eq('email', cleanEmail)
    .maybeSingle();

  // Réponse identique qu'il existe ou non (anti-énumération)
  if (customer) {
    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    await supabase.from('customers').update({
      reset_token: token,
      reset_expires: expires
    }).eq('id', customer.id);

    const link = `${process.env.SITE_URL}/account?reset=${token}`;
    if (resend && process.env.EMAIL_FROM) {
      resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: cleanEmail,
        subject: 'Réinitialiser votre mot de passe PureSpec',
        html: resetEmail({ prenom: customer.prenom || '', link })
      }).catch(e => console.warn('[forgot] mail err:', e.message));
    }
  }

  return res.status(200).json({ ok: true, message: 'Si un compte existe, un email a été envoyé.' });
}

// ---------- RESET ----------
async function reset(req, res) {
  const { token, password } = req.body || {};
  if (!token || !isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id, reset_expires')
    .eq('reset_token', token)
    .maybeSingle();

  if (!customer || !customer.reset_expires || new Date(customer.reset_expires) < new Date()) {
    return res.status(400).json({ error: 'Lien expiré ou invalide. Refais une demande.' });
  }

  await supabase.from('customers').update({
    password_hash: hashPassword(password),
    reset_token: null,
    reset_expires: null
  }).eq('id', customer.id);

  // Révoque toutes les sessions existantes
  await supabase.from('sessions').delete().eq('kind', 'customer').eq('user_id', customer.id);

  return res.status(200).json({ ok: true });
}

// ---------- UPDATE PROFILE ----------
async function updateProfile(req, res) {
  const auth = await requireCustomer(req);
  if (!auth) return res.status(401).json({ error: 'Non connecté' });

  const { prenom, nom, telephone, adresse, complement, ville, code_postal, pays } = req.body || {};
  const { error } = await supabase.from('customers').update({
    prenom: prenom || null,
    nom: nom || null,
    telephone: telephone || null,
    adresse: adresse || null,
    complement: complement || null,
    ville: ville || null,
    code_postal: code_postal || null,
    pays: pays || 'France',
    updated_at: new Date().toISOString()
  }).eq('id', auth.customer.id);

  if (error) return res.status(500).json({ error: 'Erreur mise à jour' });
  return res.status(200).json({ ok: true });
}

// ---------- CHANGE PASSWORD ----------
async function changePassword(req, res) {
  const auth = await requireCustomer(req);
  if (!auth) return res.status(401).json({ error: 'Non connecté' });

  const { current, next } = req.body || {};
  if (!current || !isStrongEnoughPassword(next)) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('password_hash')
    .eq('id', auth.customer.id)
    .maybeSingle();

  if (!customer || !verifyPassword(current, customer.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  await supabase.from('customers').update({
    password_hash: hashPassword(next),
    updated_at: new Date().toISOString()
  }).eq('id', auth.customer.id);

  return res.status(200).json({ ok: true });
}

// ---------- TEMPLATES EMAIL ----------
function welcomeEmail({ prenom }) {
  return baseEmailWrap(`
    <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:12px">Bienvenue ${prenom ? prenom : 'sur PureSpec'} 👋</div>
    <div style="font-size:15px;color:#86868b;line-height:1.6">
      Votre compte est créé. Vous pouvez désormais commander vos PureSpec et suivre vos livraisons depuis votre espace.
    </div>
    <a href="${process.env.SITE_URL}/dashboard" style="display:inline-block;margin-top:24px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:980px;font-size:15px;font-weight:500">Accéder à mon espace</a>
  `);
}

function resetEmail({ prenom, link }) {
  return baseEmailWrap(`
    <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:12px">Réinitialiser votre mot de passe</div>
    <div style="font-size:15px;color:#86868b;line-height:1.6">
      ${prenom ? `Bonjour ${prenom}, ` : ''}Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien expire dans 1 heure.
    </div>
    <a href="${link}" style="display:inline-block;margin-top:24px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:980px;font-size:15px;font-weight:500">Réinitialiser le mot de passe</a>
    <p style="font-size:13px;color:#86868b;margin-top:24px;line-height:1.5">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  `);
}

function baseEmailWrap(content) {
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0a0a0a;padding:40px;text-align:center">
  <div style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.02em">PureSpec</div>
</td></tr>
<tr><td style="padding:40px">${content}</td></tr>
<tr><td style="background:#f5f5f7;padding:20px 40px;text-align:center;font-size:12px;color:#86868b">
  © ${new Date().getFullYear()} PureSpec — Tous droits réservés.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
