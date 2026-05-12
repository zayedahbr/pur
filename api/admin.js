// api/admin.js — Endpoint consolidé back-office
// Actions :
//   - GET  ?action=stats
//   - GET  ?action=list-orders[&statut=...&search=...&page=...]
//   - GET  ?action=get-order&id=...
//   - POST ?action=update-order
//   - GET  ?action=list-messages[&statut=...]
//   - GET  ?action=get-message&id=...
//   - POST ?action=reply-message
//   - POST ?action=update-message
//   - POST ?action=login
//   - POST ?action=logout
//   - GET  ?action=me
import { Resend } from 'resend';
import { supabase } from '../lib/supabase.js';
import {
  hashPassword, verifyPassword, createSession, deleteSession,
  parseCookies, buildCookie, clearCookie, COOKIE_NAMES,
  requireAdmin, isValidEmail, rateLimit
} from '../lib/auth.js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const action = (req.query.action || '').toLowerCase();
  const method = req.method;

  try {
    // Routes publiques (auth admin)
    if (action === 'login' && method === 'POST') return await adminLogin(req, res);
    if (action === 'logout' && method === 'POST') return await adminLogout(req, res);
    if (action === 'me' && method === 'GET') return await adminMe(req, res);

    // Toutes les autres routes nécessitent une auth admin
    const auth = await requireAdmin(req);
    if (!auth) return res.status(401).json({ error: 'Non connecté' });

    if (action === 'stats' && method === 'GET') return await stats(req, res);
    if (action === 'list-orders' && method === 'GET') return await listOrders(req, res);
    if (action === 'get-order' && method === 'GET') return await getOrder(req, res);
    if (action === 'update-order' && method === 'POST') return await updateOrder(req, res, auth);
    if (action === 'list-messages' && method === 'GET') return await listMessages(req, res);
    if (action === 'get-message' && method === 'GET') return await getMessage(req, res);
    if (action === 'reply-message' && method === 'POST') return await replyMessage(req, res, auth);
    if (action === 'update-message' && method === 'POST') return await updateMessage(req, res);
    if (action === 'list-customers' && method === 'GET') return await listCustomers(req, res);

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    console.error('[admin]', action, err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------- AUTH ----------
async function adminLogin(req, res) {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (!rateLimit(`adminlogin:${ip}`, 8)) {
    return res.status(429).json({ error: 'Trop de tentatives' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const { data: admin } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  await supabase.from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', admin.id);

  const { token } = await createSession({ kind: 'admin', userId: admin.id, req });
  res.setHeader('Set-Cookie', buildCookie(COOKIE_NAMES.admin, token));
  return res.status(200).json({
    admin: { id: admin.id, email: admin.email, nom: admin.nom, role: admin.role }
  });
}

async function adminLogout(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAMES.admin];
  if (token) await deleteSession(token);
  res.setHeader('Set-Cookie', clearCookie(COOKIE_NAMES.admin));
  return res.status(200).json({ ok: true });
}

async function adminMe(req, res) {
  const auth = await requireAdmin(req);
  return res.status(200).json({ admin: auth?.admin || null });
}

// ---------- STATS ----------
async function stats(req, res) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const startOf7d = new Date(Date.now() - 7 * 86400000).toISOString();

  const [allCount, paidCount, awaitingShip, monthRevenue, sevenDayRevenue, totalCustomers, newMessages] = await Promise.all([
    countOrders(),
    countOrders({ statut: ['paid', 'in_production', 'shipped', 'delivered'] }),
    countOrders({ statut: ['paid', 'in_production'] }),
    sumRevenue({ since: startOfMonth }),
    sumRevenue({ since: startOf7d }),
    countCustomers(),
    countNewMessages()
  ]);

  return res.status(200).json({
    stats: {
      orders_total: allCount,
      orders_paid: paidCount,
      orders_to_ship: awaitingShip,
      revenue_month: monthRevenue,
      revenue_7d: sevenDayRevenue,
      customers_total: totalCustomers,
      messages_new: newMessages
    }
  });
}

async function countOrders(filters = {}) {
  let q = supabase.from('orders').select('id', { count: 'exact', head: true });
  if (filters.statut) q = q.in('statut', filters.statut);
  const { count } = await q;
  return count || 0;
}
async function sumRevenue({ since }) {
  const { data } = await supabase.from('orders')
    .select('total_eur')
    .gte('created_at', since)
    .in('statut', ['paid', 'in_production', 'shipped', 'delivered']);
  return (data || []).reduce((s, o) => s + Number(o.total_eur || 0), 0);
}
async function countCustomers() {
  const { count } = await supabase.from('customers').select('id', { count: 'exact', head: true });
  return count || 0;
}
async function countNewMessages() {
  const { count } = await supabase.from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'new');
  return count || 0;
}

// ---------- ORDERS ----------
async function listOrders(req, res) {
  const statut = req.query.statut;
  const search = req.query.search;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 50;

  let q = supabase.from('orders')
    .select('id, order_number, reference, marque, modele, email, prenom, nom, quantite, total_eur, statut, created_at, paid_at, shipped_at, tracking_number, carrier', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (statut && statut !== 'all') q = q.eq('statut', statut);
  if (search) {
    const s = search.trim();
    q = q.or(`reference.ilike.%${s}%,order_number.ilike.%${s}%,email.ilike.%${s}%,nom.ilike.%${s}%,prenom.ilike.%${s}%`);
  }
  const { data, count, error } = await q;
  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  return res.status(200).json({ orders: data || [], total: count || 0, page, limit });
}

async function getOrder(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID manquant' });
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .or(`id.eq.${id},reference.eq.${id},order_number.eq.${id}`)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  if (!data) return res.status(404).json({ error: 'Introuvable' });
  return res.status(200).json({ order: data });
}

async function updateOrder(req, res, auth) {
  const { id, statut, carrier, tracking_number, tracking_url, admin_notes } = req.body || {};
  if (!id) return res.status(400).json({ error: 'ID manquant' });

  const validStatuts = ['pending','paid','in_production','shipped','delivered','cancelled','refunded'];
  const update = { updated_at: new Date().toISOString() };
  if (statut && validStatuts.includes(statut)) {
    update.statut = statut;
    const now = new Date().toISOString();
    if (statut === 'in_production') update.in_production_at = now;
    if (statut === 'shipped') update.shipped_at = now;
    if (statut === 'delivered') update.delivered_at = now;
    if (statut === 'cancelled') update.cancelled_at = now;
  }
  if (carrier !== undefined) update.carrier = carrier || null;
  if (tracking_number !== undefined) update.tracking_number = tracking_number || null;
  if (tracking_url !== undefined) update.tracking_url = tracking_url || null;
  if (admin_notes !== undefined) update.admin_notes = admin_notes || null;

  const { data: order, error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Erreur mise à jour' });

  // Email auto au client si on passe en "shipped" avec un tracking
  if (statut === 'shipped' && tracking_number && resend && process.env.EMAIL_FROM && order?.email) {
    resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: order.email,
      subject: `Votre commande PureSpec est en route — ${order.order_number}`,
      html: shippedEmail(order)
    }).catch(e => console.warn('[admin] mail shipped err:', e.message));
  }

  return res.status(200).json({ order });
}

// ---------- MESSAGES ----------
async function listMessages(req, res) {
  const statut = req.query.statut;
  let q = supabase.from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (statut && statut !== 'all') q = q.eq('statut', statut);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  return res.status(200).json({ messages: data || [] });
}

async function getMessage(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'ID manquant' });
  const { data } = await supabase.from('contact_messages').select('*').eq('id', id).maybeSingle();
  if (!data) return res.status(404).json({ error: 'Introuvable' });
  // Marque comme lu
  if (data.statut === 'new') {
    await supabase.from('contact_messages').update({ statut: 'read' }).eq('id', id);
    data.statut = 'read';
  }
  return res.status(200).json({ message: data });
}

async function replyMessage(req, res, auth) {
  const { id, reply } = req.body || {};
  if (!id || !reply || reply.trim().length < 5) {
    return res.status(400).json({ error: 'Réponse trop courte' });
  }
  const { data: msg } = await supabase.from('contact_messages').select('*').eq('id', id).maybeSingle();
  if (!msg) return res.status(404).json({ error: 'Introuvable' });

  if (resend && process.env.EMAIL_FROM) {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: msg.email,
        replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM,
        subject: `Re: ${msg.sujet || 'Votre message à PureSpec'}`,
        html: replyEmail({ originalMsg: msg, reply, adminName: auth.admin.nom || 'L\'équipe PureSpec' })
      });
    } catch (e) {
      return res.status(500).json({ error: 'Échec envoi email : ' + e.message });
    }
  }

  await supabase.from('contact_messages').update({
    statut: 'replied',
    admin_reply: reply,
    replied_at: new Date().toISOString()
  }).eq('id', id);

  return res.status(200).json({ ok: true });
}

async function updateMessage(req, res) {
  const { id, statut } = req.body || {};
  if (!id) return res.status(400).json({ error: 'ID manquant' });
  const valid = ['new','read','replied','archived'];
  if (!valid.includes(statut)) return res.status(400).json({ error: 'Statut invalide' });
  await supabase.from('contact_messages').update({ statut }).eq('id', id);
  return res.status(200).json({ ok: true });
}

// ---------- CUSTOMERS ----------
async function listCustomers(req, res) {
  const search = req.query.search;
  let q = supabase.from('customers')
    .select('id, email, prenom, nom, telephone, ville, created_at, last_login_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (search) {
    const s = search.trim();
    q = q.or(`email.ilike.%${s}%,nom.ilike.%${s}%,prenom.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Erreur BDD' });
  return res.status(200).json({ customers: data || [] });
}

// ---------- TEMPLATES EMAIL ----------
function shippedEmail(order) {
  const trackHtml = order.tracking_number ? `
    <div style="margin-top:16px;padding:18px;background:#f5f5f7;border-radius:14px">
      <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Suivi colis</div>
      <div style="font-size:18px;font-weight:600;font-family:'SF Mono',monospace;margin-top:6px">${order.tracking_number}</div>
      ${order.carrier ? `<div style="font-size:13px;color:#86868b;margin-top:4px">via ${order.carrier}</div>` : ''}
      ${order.tracking_url ? `<a href="${order.tracking_url}" style="display:inline-block;margin-top:12px;color:#0066cc;font-weight:500;font-size:14px">Suivre le colis →</a>` : ''}
    </div>
  ` : '';
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0a0a0a;padding:32px;text-align:center"><div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.02em">PureSpec</div></td></tr>
<tr><td style="padding:40px">
  <div style="font-size:22px;font-weight:600;margin-bottom:12px">Votre PureSpec est en route 📦</div>
  <div style="font-size:15px;color:#86868b;line-height:1.6">Commande <strong>${order.order_number}</strong> — Référence <strong>${order.reference}</strong></div>
  ${trackHtml}
  <p style="font-size:13px;color:#86868b;margin-top:24px;line-height:1.5">Délai estimé : 2 à 5 jours ouvrés à compter d'aujourd'hui.</p>
</td></tr>
<tr><td style="background:#f5f5f7;padding:20px;text-align:center;font-size:12px;color:#86868b">© ${new Date().getFullYear()} PureSpec</td></tr>
</table></td></tr></table>
</body></html>`;
}

function replyEmail({ originalMsg, reply, adminName }) {
  const safeReply = String(reply).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const safeOrig = String(originalMsg.message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,sans-serif;color:#1d1d1f">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="background:#0a0a0a;padding:32px;text-align:center"><div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.02em">PureSpec</div></td></tr>
<tr><td style="padding:40px">
  <div style="font-size:14px;color:#86868b;margin-bottom:8px">Bonjour,</div>
  <div style="font-size:15px;line-height:1.6;color:#1d1d1f">${safeReply}</div>
  <div style="margin-top:24px;padding-top:24px;border-top:1px solid #e5e5e7">
    <div style="font-size:13px;color:#86868b">— ${adminName}<br/>PureSpec</div>
  </div>
  <div style="margin-top:32px;padding:16px;background:#f5f5f7;border-radius:12px">
    <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:6px">Votre message initial</div>
    <div style="font-size:13px;color:#6e6e73;line-height:1.5">${safeOrig}</div>
  </div>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
