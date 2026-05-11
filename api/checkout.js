// api/checkout.js — crée une session Stripe Checkout + pré-enregistre la commande
import Stripe from 'stripe';
import { supabase, getUserFromToken } from '../lib/supabase.js';
import { generateReference, isValidReference, mapCountry, setCors } from '../lib/helpers.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { config, customer, quantity, unitPrice, shipping } = req.body;

    if (!config || !customer || !customer.email) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // 1. Référence : utilise celle envoyée si valide, sinon en génère une.
    //    On garantit l'unicité côté serveur en cas de collision.
    let reference = isValidReference(config.ref) ? config.ref.toUpperCase() : generateReference();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from('orders')
        .select('reference')
        .eq('reference', reference)
        .maybeSingle();
      if (!existing) break;
      reference = generateReference();
    }

    // 2. Récupère l'utilisateur connecté si token fourni (optionnel)
    const user = await getUserFromToken(req.headers.authorization);

    // 3. Génère un numéro de commande lisible (PS-2026-000123)
    const { data: numData, error: numErr } = await supabase
      .rpc('generate_order_number');
    if (numErr) {
      console.error('[checkout] generate_order_number error:', numErr);
      return res.status(500).json({ error: 'Erreur génération numéro' });
    }
    const orderNumber = numData;

    const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
    const unit = parseFloat(unitPrice) || 9.90;
    const ship = parseFloat(shipping) || 0;
    const subtotal = qty * unit;
    const total = subtotal + ship;

    // 4. Pré-enregistre la commande en BDD avec statut 'pending'
    const { data: order, error: dbError } = await supabase
      .from('orders')
      .insert({
        reference,
        order_number: orderNumber,
        user_id: user?.id || null,
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

    // 5. Crée la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customer.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Sticker PureSpec — ${config.marque || ''} ${config.modele || ''}`.trim(),
            description: `${config.type || ''} · ${config.nomcouleur || ''}${config.codecouleur ? ' (' + config.codecouleur + ')' : ''} · Réf ${reference}`,
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
      metadata: {
        order_id: order.id,
        reference: reference,
        order_number: orderNumber
      },
      success_url: `${process.env.SITE_URL}/?success=1&ref=${reference}&order=${orderNumber}`,
      cancel_url: `${process.env.SITE_URL}/?cancelled=1`,
      locale: 'fr'
    });

    // 6. Update commande avec stripe session id
    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    // 7. Log événement "created"
    await supabase.from('order_events').insert({
      order_id: order.id,
      event_type: 'created',
      message: 'Commande créée, en attente de paiement.'
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      reference,
      orderNumber
    });

  } catch (err) {
    console.error('[checkout] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
