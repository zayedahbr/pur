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
          html: `<div style="font-family:-apple-system,sans-serif;padding:24px">
            <h2 style="margin:0 0 16px">Nouvelle commande payée</h2>
            <p><strong>${order.order_number}</strong> · ${order.reference}</p>
            <p>${order.prenom || ''} ${order.nom || ''} (${order.email})</p>
            <p>${order.marque} ${order.modele} ${order.type_version} · ${order.nom_couleur}</p>
            <p><strong>${Number(order.total_eur).toFixed(2)} €</strong></p>
            <p><a href="${process.env.SITE_URL}/admin">Ouvrir dans l'admin →</a></p>
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
