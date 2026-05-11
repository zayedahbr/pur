// api/admin/order/[id].js — Détail + update d'une commande (admin)
import { Resend } from 'resend';
import { supabase, requireAdmin } from '../../../lib/supabase.js';
import { setCors, sanitize } from '../../../lib/helpers.js';
import { buildShippedEmail } from '../../../lib/email-templates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_STATUS = ['pending', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Accès admin requis' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID manquant' });

  // GET = détail
  if (req.method === 'GET') {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !order) return res.status(404).json({ error: 'Commande introuvable' });

    const { data: events } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    return res.status(200).json({ order, events: events || [] });
  }

  // PATCH = update
  if (req.method === 'PATCH') {
    const b = req.body || {};

    const update = {};
    const eventsToLog = [];

    // Récupère la commande actuelle pour comparer
    const { data: current } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!current) return res.status(404).json({ error: 'Commande introuvable' });

    // Status
    if (b.statut && ALLOWED_STATUS.includes(b.statut) && b.statut !== current.statut) {
      update.statut = b.statut;
      if (b.statut === 'shipped' && !current.shipped_at) {
        update.shipped_at = new Date().toISOString();
      }
      if (b.statut === 'delivered' && !current.delivered_at) {
        update.delivered_at = new Date().toISOString();
      }
      eventsToLog.push({
        event_type: b.statut,
        message: `Statut passé à : ${b.statut}`
      });
    }

    // Tracking
    if (typeof b.tracking_number === 'string' && b.tracking_number !== current.tracking_number) {
      update.tracking_number = sanitize(b.tracking_number, 100);
    }
    if (typeof b.tracking_carrier === 'string' && b.tracking_carrier !== current.tracking_carrier) {
      update.tracking_carrier = sanitize(b.tracking_carrier, 50);
    }

    // Notes admin
    if (typeof b.admin_notes === 'string') {
      update.admin_notes = sanitize(b.admin_notes, 2000);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Aucune modification' });
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[admin/order PATCH] erreur :', error);
      return res.status(500).json({ error: error.message });
    }

    // Log événements
    for (const evt of eventsToLog) {
      await supabase.from('order_events').insert({
        order_id: id,
        event_type: evt.event_type,
        message: evt.message,
        created_by: admin.id
      });
    }

    // Envoie email si on passe à "shipped" et qu'on a un tracking
    if (update.statut === 'shipped' && updated.email) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: updated.email,
          replyTo: process.env.EMAIL_REPLY_TO,
          subject: `Votre commande ${updated.order_number} est expédiée`,
          html: buildShippedEmail(updated)
        });
      } catch (emailErr) {
        console.error('[admin/order] échec envoi email expedition :', emailErr);
      }
    }

    return res.status(200).json({ order: updated });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}
