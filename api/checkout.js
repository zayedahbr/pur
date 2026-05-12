// api/checkout.js — crée une session Stripe Checkout
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';
import { requireCustomer } from '../lib/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { config, customer, quantity, unitPrice, shipping } = req.body;

    if (!config || !customer || !customer.email) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Si l'utilisateur est connecté, on associe la commande à son compte
    const auth = await requireCustomer(req).catch(() => null);
    const customerId = auth?.customer?.id || null;

    // Validation et normalisation de la référence
    let reference = (config.ref || '').toUpperCase();
    if (!/^P[A-Z0-9]{7}$/.test(reference)) {
      reference = generateRef();
    }

    // Anti-collision
    const { data: existing } = await supabase
      .from('orders')
      .select('reference')
      .eq('reference', reference)
      .maybeSingle();
    if (existing) reference = generateRef();

    const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
    const unit = parseFloat(unitPrice) || 9.90;
    const ship = parseFloat(shipping) || 0;
    const subtotal = qty * unit;
    const total = subtotal + ship;

    // Pré-enregistre la commande
    const { data: order, error: dbError } = await supabase
      .from('orders')
      .insert({
        reference,
        customer_id: customerId,
        marque: config.marque,
        modele: config.modele,
        type_version: config.type,
        moteur: config.moteur,
        nom_couleur: config.nomcouleur,
        code_couleur: config.codecouleur,
        instagram: config.insta,
        bg_color: config.bgColor,
        txt_mode: config.txtMode,
        circuit_motif: config.circuit,
        circuit_color: config.circuitColor,
        circuit_opacity: config.circuitOpacity,
        email: customer.email,
        prenom: customer.prenom || customer.firstname,
        nom: customer.nom || customer.lastname,
        telephone: customer.telephone || customer.phone,
        adresse: customer.adresse || customer.address,
        complement: customer.complement || customer.address2,
        ville: customer.ville || customer.city,
        code_postal: customer.codepostal || customer.postcode || customer.zip,
        pays: mapCountry(customer.pays || customer.country),
        quantite: qty,
        unit_price_eur: unit,
        shipping_eur: ship,
        total_eur: total,
        statut: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('[checkout] erreur BDD :', dbError);
      return res.status(500).json({ error: 'Erreur enregistrement commande' });
    }

    // Session Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customer.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Sticker PureSpec — ${config.marque} ${config.modele}`,
            description: `${config.type} · ${config.nomcouleur} (${config.codecouleur}) · Réf ${reference}`,
            metadata: { reference }
          },
          unit_amount: Math.round(unit * 100)
        },
        quantity: qty
      }],
      shipping_options: ship > 0 ? [{
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(ship * 100), currency: 'eur' },
          display_name: 'Livraison standard',
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 7 }
          }
        }
      }] : [],
      metadata: { order_id: order.id, reference },
      success_url: `${process.env.SITE_URL}/?success=1&ref=${reference}&order=${order.order_number || ''}`,
      cancel_url: `${process.env.SITE_URL}/?cancelled=1`,
      locale: 'fr'
    });

    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      reference
    });

  } catch (err) {
    console.error('[checkout] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}

function generateRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = 'P';
  for (let i = 0; i < 7; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function mapCountry(input) {
  if (!input) return 'France';
  const map = {
    FR: 'France', BE: 'Belgique', CH: 'Suisse',
    LU: 'Luxembourg', DE: 'Allemagne', IT: 'Italie',
    ES: 'Espagne', NL: 'Pays-Bas', PT: 'Portugal'
  };
  return map[String(input).toUpperCase()] || input;
}
