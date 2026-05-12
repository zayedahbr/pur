// api/webhook.js — reçoit les événements Stripe
import Stripe from 'stripe';
import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import { buildConfirmationEmail } from '../lib/email-template.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const config = {
  api: { bodyParser: false }
};

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;

    if (!orderId) {
      console.error('[webhook] order_id manquant');
      return res.status(200).json({ received: true });
    }

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          statut: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_id: session.payment_intent
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error || !order) {
        console.error('[webhook] update commande :', error);
        return res.status(500).json({ error: 'Erreur BDD' });
      }

      // Email de confirmation client
      if (resend && process.env.EMAIL_FROM) {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: order.email,
            replyTo: process.env.EMAIL_REPLY_TO,
            subject: `Commande confirmée — ${order.order_number}`,
            html: buildConfirmationEmail(order)
          });
        } catch (emailErr) {
          console.error('[webhook] échec email client :', emailErr);
        }
      }

      // Notification admin
      if (resend && process.env.EMAIL_FROM && process.env.ADMIN_EMAIL) {
        resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: process.env.ADMIN_EMAIL,
          subject: `[PureSpec] Nouvelle commande — ${order.order_number}`,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#fafafa;padding:40px 20px;color:#1d1d1f">
            <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.06);border-radius:18px;padding:32px">
              <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:8px">Nouvelle commande</div>
              <h2 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f">${order.order_number}</h2>
              <div style="font-size:14px;color:#424245;line-height:1.7">
                <div><strong style="color:#1d1d1f">Référence :</strong> <span style="font-family:'SF Mono',Menlo,Consolas,monospace">${order.reference}</span></div>
                <div><strong style="color:#1d1d1f">Client :</strong> ${order.prenom || ''} ${order.nom || ''} &lt;${order.email}&gt;</div>
                <div><strong style="color:#1d1d1f">Véhicule :</strong> ${order.marque} ${order.modele} ${order.type_version}</div>
                <div><strong style="color:#1d1d1f">Couleur :</strong> ${order.nom_couleur}</div>
              </div>
              <div style="margin-top:18px;padding-top:18px;border-top:1px solid #ececf0;font-size:17px;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f">Total : ${Number(order.total_eur).toFixed(2).replace('.',',')} €</div>
              <a href="${process.env.SITE_URL}/admin" style="display:inline-block;margin-top:20px;background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:980px;font-size:14px;font-weight:500;letter-spacing:-0.01em">Ouvrir dans l'admin</a>
            </div>
          </div>`
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[webhook] erreur :', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ received: true });
}
