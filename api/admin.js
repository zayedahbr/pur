// api/admin.js — Endpoint consolidé pour le back-office admin
// Resources :
//   GET    /api/admin?resource=me                    → check si admin
//   GET    /api/admin?resource=orders                → liste commandes (filtres : statut, q, page)
//   GET    /api/admin?resource=order&id=X            → détail commande + events
//   PATCH  /api/admin?resource=order&id=X            → update (statut, tracking, notes)
//   GET    /api/admin?resource=messages              → liste tickets contact
//   PATCH  /api/admin?resource=message&id=X          → update statut ticket
import { Resend } from 'resend';
import { supabase, requireAdmin } from '../lib/supabase.js';
import { setCors, sanitize } from '../lib/helpers.js';
import { buildShippedEmail } from '../lib/email-templates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const ORDER_STATUS = ['pending', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled'];
const MESSAGE_STATUS = ['open', 'read', 'replied', 'closed'];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = await requireAdmin(req.headers.authorization);
  if (!admin) return res.status(403).json({ error: 'Accès admin requis', admin: false });

  const { resource, id } = req.query;

  try {
    // ============ ME ============
    if (resource === 'me' && req.method === 'GET') {
      return res.status(200).json({ admin: true, email: admin.email });
    }

    // ============ LISTE COMMANDES ============
    if (resource === 'orders' && req.method === 'GET') {
      const { statut, q, page = '1', limit = '50' } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(10, parseInt(limit) || 50));
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statut && statut !== 'all') query = query.eq('statut', statut);
      if (q && q.trim()) {
        const search = q.trim();
        query = query.or(`reference.ilike.%${search}%,order_number.ilike.%${search}%,email.ilike.%${search}%,nom.ilike.%${search}%,prenom.ilike.%${search}%`);
      }

      const { data, count, error } = await query.range(from, to);
      if (error) return res.status(500).json({ error: error.message });

      // Stats par statut
      const { data: counts } = await supabase.from('orders').select('statut');
      const stats = (counts || []).reduce((acc, o) => {
        acc[o.statut] = (acc[o.statut] || 0) + 1;
        acc.total = (acc.total || 0) + 1;
        return acc;
      }, {});

      return res.status(200).json({
        orders: data || [],
        pagination: { page: pageNum, limit: limitNum, total: count || 0 },
        stats
      });
    }

    // ============ DÉTAIL / UPDATE COMMANDE ============
    if (resource === 'order') {
      if (!id) return res.status(400).json({ error: 'ID manquant' });

      if (req.method === 'GET') {
        const { data: order, error } = await supabase
          .from('orders').select('*').eq('id', id).maybeSingle();
        if (error || !order) return res.status(404).json({ error: 'Commande introuvable' });

        const { data: events } = await supabase
          .from('order_events').select('*').eq('order_id', order.id).order('created_at');
        return res.status(200).json({ order, events: events || [] });
      }

      if (req.method === 'PATCH') {
        const b = req.body || {};
        const update = {};
        const eventsToLog = [];

        const { data: current } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
        if (!current) return res.status(404).json({ error: 'Commande introuvable' });

        if (b.statut && ORDER_STATUS.includes(b.statut) && b.statut !== current.statut) {
          update.statut = b.statut;
          if (b.statut === 'shipped' && !current.shipped_at) update.shipped_at = new Date().toISOString();
          if (b.statut === 'delivered' && !current.delivered_at) update.delivered_at = new Date().toISOString();
          eventsToLog.push({ event_type: b.statut, message: `Statut passé à : ${b.statut}` });
        }
        if (typeof b.tracking_number === 'string' && b.tracking_number !== current.tracking_number) {
          update.tracking_number = sanitize(b.tracking_number, 100);
        }
        if (typeof b.tracking_carrier === 'string' && b.tracking_carrier !== current.tracking_carrier) {
          update.tracking_carrier = sanitize(b.tracking_carrier, 50);
        }
        if (typeof b.admin_notes === 'string') {
          update.admin_notes = sanitize(b.admin_notes, 2000);
        }

        if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucune modification' });

        const { data: updated, error } = await supabase
          .from('orders').update(update).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });

        for (const evt of eventsToLog) {
          await supabase.from('order_events').insert({
            order_id: id, event_type: evt.event_type, message: evt.message, created_by: admin.id
          });
        }

        // Email expédition
        if (update.statut === 'shipped' && updated.email) {
          try {
            await resend.emails.send({
              from: process.env.EMAIL_FROM,
              to: updated.email,
              replyTo: process.env.EMAIL_REPLY_TO,
              subject: `Votre commande ${updated.order_number} est expédiée`,
              html: buildShippedEmail(updated)
            });
          } catch (e) { console.error('[admin email shipped]', e); }
        }

        return res.status(200).json({ order: updated });
      }
    }

    // ============ LISTE MESSAGES ============
    if (resource === 'messages' && req.method === 'GET') {
      const { statut } = req.query;
      let q = supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100);
      if (statut && statut !== 'all') q = q.eq('statut', statut);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ messages: data || [] });
    }

    // ============ UPDATE MESSAGE ============
    if (resource === 'message' && req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'ID manquant' });
      const b = req.body || {};
      const update = {};
      if (b.statut && MESSAGE_STATUS.includes(b.statut)) {
        update.statut = b.statut;
        if (b.statut === 'replied') update.responded_at = new Date().toISOString();
      }
      if (typeof b.admin_response === 'string') {
        update.admin_response = sanitize(b.admin_response, 5000);
      }
      if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucune modification' });

      const { data, error } = await supabase
        .from('contact_messages').update(update).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ message: data });
    }

    return res.status(400).json({ error: 'Resource invalide' });

  } catch (err) {
    console.error('[admin]', err);
    return res.status(500).json({ error: err.message });
  }
}
