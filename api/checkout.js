// api/checkout.js — crée une session Stripe Checkout
import Stripe from 'stripe';
import { supabase } from '../lib/supabase.js';
import { requireCustomer } from '../lib/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

// Defaults si la table app_settings n'est pas seedée
const FALLBACK_UNIT_PRICE = 9.90;
const FALLBACK_SHIPPING = {
  FR: 3.50, MC: 3.50,
  BE: 5.90, LU: 5.90, NL: 5.90, DE: 5.90,
  IT: 6.90, ES: 6.90, PT: 6.90, AT: 6.90,
  IE: 7.90, DK: 7.90, SE: 7.90, FI: 7.90, NO: 9.90,
  CH: 8.90,
  PL: 7.90, CZ: 7.90, SK: 7.90, HU: 7.90, RO: 7.90, BG: 7.90,
  GR: 7.90, HR: 7.90, SI: 7.90,
  EE: 7.90, LV: 7.90, LT: 7.90, MT: 9.90, CY: 9.90,
  GB: 9.90
};

async function loadPricing() {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['unit_price_eur', 'shipping_rates']);
    let unit = FALLBACK_UNIT_PRICE;
    let rates = FALLBACK_SHIPPING;
    (data || []).forEach(r => {
      if (r.key === 'unit_price_eur') unit = Number(r.value) || FALLBACK_UNIT_PRICE;
      if (r.key === 'shipping_rates' && r.value && typeof r.value === 'object') rates = r.value;
    });
    return { unit, rates };
  } catch {
    return { unit: FALLBACK_UNIT_PRICE, rates: FALLBACK_SHIPPING };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { config, customer, quantity } = req.body;

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

    // ⚠️ SÉCURITÉ : on ignore les unitPrice / shipping envoyés par le client.
    // On les recharge depuis app_settings pour ne pas accepter de tarifs falsifiés.
    const { unit, rates } = await loadPricing();
    const countryCode = String(customer.pays || customer.country || 'FR').toUpperCase().slice(0, 2);
    const ship = rates[countryCode] != null ? Number(rates[countryCode]) : (rates.FR ?? 3.50);
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
    ES: 'Espagne', NL: 'Pays-Bas', PT: 'Portugal',
    AT: 'Autriche', IE: 'Irlande', DK: 'Danemark',
    SE: 'Suède', FI: 'Finlande', NO: 'Norvège',
    PL: 'Pologne', CZ: 'Tchéquie', SK: 'Slovaquie',
    HU: 'Hongrie', RO: 'Roumanie', BG: 'Bulgarie',
    GR: 'Grèce', HR: 'Croatie', SI: 'Slovénie',
    EE: 'Estonie', LV: 'Lettonie', LT: 'Lituanie',
    MT: 'Malte', CY: 'Chypre', GB: 'Royaume-Uni',
    MC: 'Monaco'
  };
  return map[String(input).toUpperCase()] || input;
}
