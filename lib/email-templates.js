// lib/email-templates.js — Tous les templates HTML email

const BRAND = 'PureSpec';
const TAGLINE = 'La signature de votre build.';

function wrap(content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;color:#1d1d1f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);max-width:100%;">
        <tr><td style="background:#0a0a0a;padding:36px 40px 28px;text-align:center;">
          <div style="color:#fff;font-size:24px;font-weight:600;letter-spacing:-0.03em;">${BRAND}</div>
          <div style="color:rgba(255,255,255,0.55);font-size:12px;margin-top:6px;letter-spacing:0.02em;">${TAGLINE}</div>
        </td></tr>
        ${content}
        <tr><td style="background:#f5f5f7;padding:24px 40px;text-align:center;border-top:1px solid #e5e5e7;">
          <div style="font-size:11px;color:#86868b;line-height:1.6;">
            Une question ? Répondez à cet email ou rendez-vous sur <a href="${process.env.SITE_URL || ''}/contact" style="color:#1d1d1f;text-decoration:none;">notre page contact</a>.<br/>
            © ${new Date().getFullYear()} ${BRAND}. Tous droits réservés.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:13px 0;font-size:13px;color:#86868b;border-bottom:1px solid #f0f0f2;">${label}</td>
    <td style="padding:13px 0;font-size:13px;color:#1d1d1f;text-align:right;font-weight:500;border-bottom:1px solid #f0f0f2;">${value || '—'}</td>
  </tr>`;
}

function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:13px 30px;border-radius:980px;font-size:14px;font-weight:500;letter-spacing:-0.01em;">${label}</a>`;
}

/* ========================================================== */
/* CONFIRMATION DE COMMANDE                                   */
/* ========================================================== */
export function buildConfirmationEmail(order) {
  const fmt = v => Number(v || 0).toFixed(2).replace('.', ',') + '\u00a0€';
  const total = fmt(order.total_eur);
  const subtotal = fmt(Number(order.unit_price_eur) * order.quantite);
  const shipping = fmt(order.shipping_eur);

  const siteUrl = process.env.SITE_URL || '';

  return wrap(`
    <tr><td style="padding:36px 40px 16px;">
      <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px;">Merci pour votre commande${order.prenom ? ', ' + order.prenom : ''}.</div>
      <div style="font-size:14px;color:#86868b;line-height:1.6;">
        Votre commande <strong style="color:#1d1d1f;">${order.order_number}</strong> est confirmée et passe en production.
        Vous recevrez un email avec le numéro de suivi dès l'expédition.
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 24px;">
      <div style="background:#f5f5f7;border-radius:14px;padding:22px;text-align:center;">
        <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Référence sticker</div>
        <div style="font-size:30px;font-weight:700;letter-spacing:0.05em;margin-top:8px;font-family:'SF Mono','Menlo','Consolas',monospace;">${order.reference}</div>
        <div style="font-size:12px;color:#86868b;margin-top:10px;line-height:1.5;">
          Conservez cette référence. Elle permet de vérifier l'authenticité<br/>
          de votre sticker à tout moment dans le Registry.
        </div>
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 8px;">
      <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:14px;">Détails du sticker</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e7;">
        ${row('Marque & modèle', `${order.marque || ''} ${order.modele || ''}`)}
        ${row('Version', order.type_version)}
        ${row('Code moteur', order.moteur)}
        ${row('Couleur', `${order.nom_couleur || ''}${order.code_couleur ? ' (' + order.code_couleur + ')' : ''}`)}
        ${row('Instagram', order.instagram ? '@' + order.instagram : '—')}
        ${row('Quantité', order.quantite)}
      </table>
    </td></tr>

    <tr><td style="padding:24px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e7;">
        ${row('Sous-total', subtotal)}
        ${row('Livraison', shipping)}
        <tr>
          <td style="padding:16px 0 0;font-size:16px;font-weight:600;letter-spacing:-0.02em;">Total payé</td>
          <td style="padding:16px 0 0;font-size:16px;font-weight:600;letter-spacing:-0.02em;text-align:right;">${total}</td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:28px 40px 0;">
      <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px;">Livraison</div>
      <div style="font-size:14px;line-height:1.6;color:#1d1d1f;">
        ${order.prenom || ''} ${order.nom || ''}<br/>
        ${order.adresse || ''}${order.complement ? '<br/>' + order.complement : ''}<br/>
        ${order.code_postal || ''} ${order.ville || ''}<br/>
        ${order.pays || ''}
      </div>
    </td></tr>

    <tr><td style="padding:36px 40px;text-align:center;">
      ${btn(siteUrl + '/account', 'Suivre ma commande')}
    </td></tr>
  `);
}

/* ========================================================== */
/* EXPÉDITION                                                 */
/* ========================================================== */
export function buildShippedEmail(order) {
  const siteUrl = process.env.SITE_URL || '';
  const tracking = order.tracking_number;

  return wrap(`
    <tr><td style="padding:36px 40px 16px;">
      <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px;">Votre sticker est en route.</div>
      <div style="font-size:14px;color:#86868b;line-height:1.6;">
        Votre commande <strong style="color:#1d1d1f;">${order.order_number}</strong> vient d'être expédiée.
        Vous le recevrez sous 3 à 7 jours ouvrés.
      </div>
    </td></tr>

    ${tracking ? `
    <tr><td style="padding:0 40px 24px;">
      <div style="background:#f5f5f7;border-radius:14px;padding:22px;text-align:center;">
        <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Numéro de suivi</div>
        <div style="font-size:18px;font-weight:600;margin-top:8px;font-family:'SF Mono',monospace;letter-spacing:0.05em;">${tracking}</div>
        ${order.tracking_carrier ? `<div style="font-size:12px;color:#86868b;margin-top:6px;">${order.tracking_carrier}</div>` : ''}
      </div>
    </td></tr>
    ` : ''}

    <tr><td style="padding:12px 40px 36px;text-align:center;">
      ${btn(siteUrl + '/account', 'Voir ma commande')}
    </td></tr>
  `);
}

/* ========================================================== */
/* CONTACT — ACCUSÉ DE RÉCEPTION                              */
/* ========================================================== */
export function buildContactReceivedEmail(ticket) {
  return wrap(`
    <tr><td style="padding:36px 40px 16px;">
      <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px;">Message bien reçu${ticket.prenom ? ', ' + ticket.prenom : ''}.</div>
      <div style="font-size:14px;color:#86868b;line-height:1.6;">
        Nous avons bien reçu votre message et vous répondrons sous 48 h ouvrées.
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 24px;">
      <div style="background:#f5f5f7;border-radius:14px;padding:22px;text-align:center;">
        <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">N° de ticket</div>
        <div style="font-size:22px;font-weight:700;margin-top:8px;font-family:'SF Mono',monospace;letter-spacing:0.05em;">${ticket.ticket_number}</div>
        <div style="font-size:12px;color:#86868b;margin-top:8px;">Conservez ce numéro pour toute correspondance.</div>
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 36px;">
      <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px;">Votre message</div>
      <div style="background:#f5f5f7;border-radius:14px;padding:18px;font-size:13px;color:#1d1d1f;line-height:1.6;white-space:pre-wrap;">${(ticket.message || '').replace(/[<>]/g, '')}</div>
    </td></tr>
  `);
}

/* ========================================================== */
/* CONTACT — NOTIFICATION ADMIN                               */
/* ========================================================== */
export function buildAdminContactNotification(ticket) {
  const siteUrl = process.env.SITE_URL || '';
  return wrap(`
    <tr><td style="padding:36px 40px 16px;">
      <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px;">Nouveau message contact</div>
      <div style="font-size:14px;color:#86868b;line-height:1.6;">
        Ticket <strong style="color:#1d1d1f;">${ticket.ticket_number}</strong> reçu de
        <strong style="color:#1d1d1f;">${(ticket.prenom || '') + ' ' + (ticket.nom || '')}</strong>
        (${ticket.email}).
      </div>
    </td></tr>

    <tr><td style="padding:0 40px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e7;">
        ${row('Sujet', ticket.sujet || '—')}
        ${row('Référence commande', ticket.reference_commande || '—')}
        ${row('Email', ticket.email)}
      </table>
    </td></tr>

    <tr><td style="padding:24px 40px 0;">
      <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:10px;">Message</div>
      <div style="background:#f5f5f7;border-radius:14px;padding:18px;font-size:13px;color:#1d1d1f;line-height:1.6;white-space:pre-wrap;">${(ticket.message || '').replace(/[<>]/g, '')}</div>
    </td></tr>

    <tr><td style="padding:36px 40px;text-align:center;">
      ${btn(siteUrl + '/admin', 'Ouvrir le back-office')}
    </td></tr>
  `);
}
