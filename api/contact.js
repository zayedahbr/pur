// api/contact.js — Soumission du formulaire contact
import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import { requireCustomer, isValidEmail, rateLimit } from '../lib/auth.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { email, nom, sujet, message, order_ref, hp } = req.body || {};

    // Honeypot anti-bot
    if (hp) return res.status(200).json({ ok: true });

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
    if (!message || message.trim().length < 10) return res.status(400).json({ error: 'Message trop court' });
    if (message.length > 5000) return res.status(400).json({ error: 'Message trop long' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (!rateLimit(`contact:${ip}`, 5)) {
      return res.status(429).json({ error: 'Trop de messages envoyés. Réessaie dans une minute.' });
    }

    // Si le client est connecté, on rattache son ID
    const auth = await requireCustomer(req).catch(() => null);
    const customerId = auth?.customer?.id || null;

    const cleanEmail = email.trim().toLowerCase();

    const { data: saved, error } = await supabase.from('contact_messages').insert({
      email: cleanEmail,
      nom: (nom || '').trim() || null,
      sujet: (sujet || '').trim().slice(0, 200) || 'Sans objet',
      message: message.trim(),
      customer_id: customerId,
      order_ref: (order_ref || '').trim() || null,
      ip
    }).select().single();

    if (error) {
      console.error('[contact] err BDD:', error);
      return res.status(500).json({ error: 'Erreur enregistrement' });
    }

    // Notification email à l'admin
    if (resend && process.env.EMAIL_FROM && process.env.ADMIN_EMAIL) {
      const safeMsg = message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
      resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: process.env.ADMIN_EMAIL,
        replyTo: cleanEmail,
        subject: `[PureSpec Contact] ${sujet || 'Nouveau message'}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f5f5f7;padding:32px">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:600">Nouveau message contact</h2>
              <div style="font-size:13px;color:#86868b;line-height:1.7">
                <strong>De :</strong> ${nom ? nom + ' &lt;' + cleanEmail + '&gt;' : cleanEmail}<br>
                <strong>Sujet :</strong> ${sujet || '—'}<br>
                ${order_ref ? `<strong>Ref commande :</strong> ${order_ref}<br>` : ''}
                ${customerId ? '<strong>Compte :</strong> client identifié<br>' : ''}
              </div>
              <hr style="border:none;border-top:1px solid #e5e5e7;margin:20px 0">
              <div style="font-size:15px;line-height:1.6;color:#1d1d1f">${safeMsg}</div>
              <hr style="border:none;border-top:1px solid #e5e5e7;margin:20px 0">
              <a href="${process.env.SITE_URL}/admin" style="display:inline-block;background:#1d1d1f;color:#fff;padding:10px 20px;border-radius:980px;text-decoration:none;font-size:13px;font-weight:500">Ouvrir dans l'admin</a>
            </div>
          </div>
        `
      }).catch(e => console.warn('[contact] mail admin err:', e.message));
    }

    // Confirmation au client
    if (resend && process.env.EMAIL_FROM) {
      resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: cleanEmail,
        subject: 'Votre message a bien été reçu — PureSpec',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f5f5f7;padding:32px">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
              <div style="background:#0a0a0a;padding:24px;text-align:center"><div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.02em">PureSpec</div></div>
              <div style="padding:32px">
                <div style="font-size:20px;font-weight:600;margin-bottom:12px">Message reçu ✓</div>
                <p style="color:#86868b;line-height:1.6;font-size:14.5px">Merci ${nom ? nom : ''}, votre message est arrivé. Nous vous répondrons sous 24 à 48h ouvrées.</p>
                <p style="color:#86868b;font-size:12.5px;margin-top:24px">Réf : ${saved.id.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        `
      }).catch(e => console.warn('[contact] mail client err:', e.message));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact]', err);
    return res.status(500).json({ error: err.message });
  }
}
