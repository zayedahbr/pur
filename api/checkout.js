// api/checkout.js — crée une session Stripe Checkout
// Appelé depuis le front quand le client clique "Payer"
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

export default async function handler(req, res) {
  // CORS basique (utile en dev)
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

    // 1. Vérifier que la référence n'existe pas déjà (collision rare mais possible)
    let reference = config.ref;
    const { data: existing } = await supabase
      .from('orders')
      .select('reference')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      // Re-génère côté serveur si collision
      reference = generateRef();
    }

    const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
    const unit = parseFloat(unitPrice) || 9.99;
    const ship = parseFloat(shipping) || 0;
    const subtotal = qty * unit;
    const total = subtotal + ship;

    // 2. Pré-enregistre la commande en BDD avec statut 'pending'
    const { data: order, error: dbError } = await supabase
      .from('orders')
      .insert({
        reference,
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
        prenom: customer.prenom,
        nom: customer.nom,
        telephone: customer.telephone,
        adresse: customer.adresse,
        complement: customer.complement,
        ville: customer.ville,
        code_postal: customer.codepostal,
        pays: customer.pays || 'France',
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

    // 3. Crée la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],   // Apple Pay et Google Pay sont automatiques avec 'card'
      customer_email: customer.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Sticker PureWerk — ${config.marque} ${config.modele}`,
              description: `${config.type} · ${config.nomcouleur} (${config.codecouleur}) · Réf ${reference}`,
              metadata: { reference }
            },
            unit_amount: Math.round(unit * 100)  // Stripe attend des centimes
          },
          quantity: qty
        }
      ],
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
      metadata: {
        order_id: order.id,
        reference: reference
      },
      success_url: `${process.env.SITE_URL}/?success=1&ref=${reference}`,
      cancel_url: `${process.env.SITE_URL}/?cancelled=1`,
      locale: 'fr'
    });

    // 4. Met à jour la commande avec l'ID session Stripe
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

// Mini générateur de secours côté serveur
function generateRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
