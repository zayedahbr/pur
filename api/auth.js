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
    if (action === 'oauth-google' && method === 'GET') return await oauthStart(req, res, 'google');
    if (action === 'oauth-apple' && method === 'GET') return await oauthStart(req, res, 'apple');
    if (action === 'oauth-callback' && method === 'GET') return await oauthCallback(req, res);
    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    console.error('[auth]', action, err);
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}

// ---------- OAUTH ----------
// Note : pour activer Google/Apple, configurer dans Vercel les variables :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
// La logique complète OAuth (échange code → user) reste à brancher.
async function oauthStart(req, res, provider) {
  const siteUrl = process.env.SITE_URL || '';
  const ret = (req.query.return || '').toString();

  if (provider === 'google' && !process.env.GOOGLE_CLIENT_ID) {
    const msg = encodeURIComponent('Connexion Google non configurée. Utilisez l\'email pour l\'instant.');
    return res.redirect(302, `${siteUrl}/?auth=error&msg=${msg}`);
  }
  if (provider === 'apple' && !process.env.APPLE_CLIENT_ID) {
    const msg = encodeURIComponent('Connexion Apple non configurée. Utilisez l\'email pour l\'instant.');
    return res.redirect(302, `${siteUrl}/?auth=error&msg=${msg}`);
  }

  // Génère un state CSRF et l'attache en cookie (TTL court)
  const state = generateToken();
  res.setHeader('Set-Cookie', `ps_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);

  const redirectUri = `${siteUrl}/api/auth?action=oauth-callback&provider=${provider}&return=${encodeURIComponent(ret)}`;

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account'
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }
  if (provider === 'apple') {
    const params = new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'name email',
      response_mode: 'form_post',
      state
    });
    return res.redirect(302, `https://appleid.apple.com/auth/authorize?${params.toString()}`);
  }
  return res.status(400).json({ error: 'Provider inconnu' });
}

async function oauthCallback(req, res) {
  const siteUrl = process.env.SITE_URL || '';
  const provider = (req.query.provider || '').toString();
  const ret = (req.query.return || '').toString();
  const code = (req.query.code || '').toString();
  const state = (req.query.state || '').toString();
  const successTarget = ret === 'order' ? `${siteUrl}/?auth=ok` : `${siteUrl}/dashboard?auth=ok`;
  const fail = (msg) => res.redirect(302, `${siteUrl}/?auth=error&msg=${encodeURIComponent(msg)}`);

  // Vérifie le state CSRF
  const cookies = parseCookies(req);
  if (!state || !cookies.ps_oauth_state || state !== cookies.ps_oauth_state) {
    return fail('Session OAuth invalide. Réessayez.');
  }
  if (!code) return fail('Code OAuth manquant.');

  try {
    let email = null, prenom = null, nom = null, sub = null;

    if (provider === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return fail('Connexion Google non configurée.');
      }
      const redirectUri = `${siteUrl}/api/auth?action=oauth-callback&provider=google&return=${encodeURIComponent(ret)}`;
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || !tokenData.id_token) return fail('Échange OAuth Google échoué.');
      const payload = decodeJwtPayload(tokenData.id_token);
      if (!payload || !payload.email) return fail('Impossible de lire le profil Google.');
      email = String(payload.email).toLowerCase();
      prenom = payload.given_name || null;
      nom = payload.family_name || null;
      sub = payload.sub || null;
    } else if (provider === 'apple') {
      // Apple : nécessite un client_secret JWT signé avec une clé ES256 (APPLE_PRIVATE_KEY).
      // Le code complet utilise la lib `jsonwebtoken` ou `jose`. Laissé en stub :
      return fail('Connexion Apple bientôt disponible.');
    } else {
      return fail('Provider OAuth inconnu.');
    }

    // Upsert : recherche par sub, sinon par email
    const subCol = provider === 'google' ? 'google_sub' : 'apple_sub';
    let { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq(subCol, sub)
      .maybeSingle();

    if (!customer && email) {
      const { data: byEmail } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) {
        // Lie le sub OAuth au compte existant
        const upd = {};
        upd[subCol] = sub;
        upd.email_verified = true;
        await supabase.from('customers').update(upd).eq('id', byEmail.id);
        customer = { ...byEmail, [subCol]: sub };
      }
    }

    if (!customer) {
      // Nouveau compte OAuth
      const insertObj = {
        email,
        prenom: prenom || null,
        nom: nom || null,
        email_verified: true,
        auth_provider: provider
      };
      insertObj[subCol] = sub;
      const { data: created, error } = await supabase
        .from('customers')
        .insert(insertObj)
        .select()
        .single();
      if (error) {
        console.error('[oauth] insert error', error);
        return fail('Création du compte impossible.');
      }
      customer = created;
      // Relie d'éventuelles commandes existantes par email
      await supabase
        .from('orders')
        .update({ customer_id: customer.id })
        .eq('email', email)
        .is('customer_id', null);
    }

    // Crée la session
    await supabase.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);
    const { token } = await createSession({ kind: 'customer', userId: customer.id, req });
    res.setHeader('Set-Cookie', [
      buildCookie(COOKIE_NAMES.customer, token),
      `ps_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ]);

    return res.redirect(302, successTarget);
  } catch (err) {
    console.error('[oauth] callback err', err);
    return fail('Erreur OAuth serveur.');
  }
}

function decodeJwtPayload(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch { return null; }
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
    <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:14px">Bienvenue</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;margin-bottom:14px;color:#1d1d1f">Bonjour${prenom ? ', ' + prenom : ''}.</div>
    <div style="font-size:15px;color:#424245;line-height:1.55">
      Votre compte PureSpec est créé. Vous pouvez désormais commander vos PureSpec et suivre vos livraisons depuis votre espace.
    </div>
    <a href="${process.env.SITE_URL}/dashboard" style="display:inline-block;margin-top:28px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:980px;font-size:15px;font-weight:500;letter-spacing:-0.01em">Accéder à mon espace</a>
  `);
}

function resetEmail({ prenom, link }) {
  return baseEmailWrap(`
    <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:14px">Réinitialisation</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;margin-bottom:14px;color:#1d1d1f">Nouveau mot de passe</div>
    <div style="font-size:15px;color:#424245;line-height:1.55">
      ${prenom ? `Bonjour ${prenom}, ` : ''}cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien expire dans 1 heure.
    </div>
    <a href="${link}" style="display:inline-block;margin-top:28px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 28px;border-radius:980px;font-size:15px;font-weight:500;letter-spacing:-0.01em">Réinitialiser le mot de passe</a>
    <p style="font-size:13px;color:#86868b;margin-top:24px;line-height:1.5">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  `);
}

function baseEmailWrap(content) {
  return `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid rgba(0,0,0,0.06)">
<tr><td style="background:#ffffff;padding:36px 40px 24px;border-bottom:1px solid rgba(0,0,0,0.06)">
  <div style="color:#1d1d1f;font-size:22px;font-weight:600;letter-spacing:-0.02em">PureSpec</div>
</td></tr>
<tr><td style="padding:40px">${content}</td></tr>
<tr><td style="background:#fafafa;padding:24px 40px;text-align:center;font-size:12px;color:#86868b;border-top:1px solid rgba(0,0,0,0.06)">
  © ${new Date().getFullYear()} PureSpec — Tous droits réservés.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
