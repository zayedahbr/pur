// api/contact.js — Reçoit les messages du formulaire contact
import { Resend } from 'resend';
import { supabase, getUserFromToken } from '../lib/supabase.js';
import { setCors, sanitize } from '../lib/helpers.js';
import { buildContactReceivedEmail, buildAdminContactNotification } from '../lib/email-templates.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const { email, prenom, nom, sujet, message, reference_commande } = req.body;

    if (!email || !message) {
      return res.status(400).json({ error: 'Email et message requis' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    if (message.length < 10 || message.length > 5000) {
      return res.status(400).json({ error: 'Message trop court ou trop long' });
    }

    // Lien optionnel vers compte
    const user = await getUserFromToken(req.headers.authorization);

    // Génère le ticket number
    const { data: ticketNumData, error: tnErr } = await supabase.rpc('generate_ticket_number');
    if (tnErr) {
      console.error('[contact] generate_ticket_number error:', tnErr);
      return res.status(500).json({ error: 'Erreur génération ticket' });
    }
    const ticketNumber = ticketNumData;

    const ticketData = {
      ticket_number: ticketNumber,
      email: sanitize(email, 255),
      prenom: sanitize(prenom, 100),
      nom: sanitize(nom, 100),
      sujet: sanitize(sujet, 255),
      message: sanitize(message, 5000),
      reference_commande: reference_commande ? sanitize(reference_commande, 20) : null,
      user_id: user?.id || null,
      statut: 'open'
    };

    const { data: ticket, error: dbError } = await supabase
      .from('contact_messages')
      .insert(ticketData)
      .select()
      .single();

    if (dbError) {
      console.error('[contact] erreur BDD :', dbError);
      return res.status(500).json({ error: 'Erreur enregistrement message' });
    }

    // Email accusé de réception au client
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: ticket.email,
        replyTo: process.env.EMAIL_REPLY_TO,
        subject: `Message reçu — Ticket ${ticket.ticket_number}`,
        html: buildContactReceivedEmail(ticket)
      });
    } catch (emailErr) {
      console.error('[contact] échec envoi accusé :', emailErr);
    }

    // Email notification à l'admin
    if (process.env.ADMIN_EMAIL) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM,
          to: process.env.ADMIN_EMAIL,
          replyTo: ticket.email,
          subject: `[Contact] ${ticket.ticket_number} — ${ticket.sujet || 'Nouveau message'}`,
          html: buildAdminContactNotification(ticket)
        });
      } catch (emailErr) {
        console.error('[contact] échec envoi admin :', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      ticket_number: ticket.ticket_number
    });

  } catch (err) {
    console.error('[contact] erreur :', err);
    return res.status(500).json({ error: err.message });
  }
}
