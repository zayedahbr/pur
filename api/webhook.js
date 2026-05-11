// api/webhook.js — reçoit les événements Stripe et déclenche email + update commande
import Stripe from 'stripe';
import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import { buildConfirmationEmail } from '../lib/email-templates.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});
const resend = new Resend(process.env.RESEND_API_KEY);

export const config = { api: { bodyParser: false } };

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
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[webhook] signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.order_id;

    if (!orderId) {
      console.error('[webhook] order_id manquant dans metadata');
      return res.status(200).json({ received: true });
    }

    try {
      // 1. Marque la commande comme payée
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
        console.error('[webhook] erreur update commande :', error);
        return res.status(500).json({ error: 'Erreur BDD' });
      }

      // 2. Log événement "paid"
      await supabase.from('order_events').insert({
        order_id: order.id,
        event_type: 'paid',
        message: 'Paiement confirmé via Stripe.',
        metadata: { payment_intent: session.payment_intent }
      });

      // 3. Envoie email de confirmation
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: order.email,
          replyTo: process.env.EMAIL_REPLY_TO,
          subject: `Commande confirmée — ${order.order_number}`,
          html: buildConfirmationEmail(order)
        });
        console.log(`[webhook] email envoyé à ${order.email} pour ${order.reference}`);
      } catch (emailErr) {
        console.error('[webhook] échec envoi email :', emailErr);
      }

    } catch (err) {
      console.error('[webhook] erreur traitement :', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ received: true });
}
