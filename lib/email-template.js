// lib/email-template.js — template HTML de l'email de confirmation
export function buildConfirmationEmail(order) {
  const total = Number(order.total_eur).toFixed(2).replace('.', ',') + ' €';
  const subtotal = (Number(order.unit_price_eur) * order.quantite).toFixed(2).replace('.', ',') + ' €';
  const shipping = Number(order.shipping_eur).toFixed(2).replace('.', ',') + ' €';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Confirmation commande PureWerk</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1d1d1f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">

        <!-- Header -->
        <tr><td style="background:#0a0a0a;padding:40px 40px 32px;text-align:center;">
          <div style="color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.03em;">PureWerk</div>
          <div style="color:rgba(255,255,255,0.6);font-size:13px;margin-top:6px;letter-spacing:0.02em;">Unique. Comme votre build.</div>
        </td></tr>

        <!-- Confirmation -->
        <tr><td style="padding:40px 40px 24px;">
          <div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:12px;">Merci pour ta commande, ${order.prenom || ''} 🎉</div>
          <div style="font-size:15px;color:#86868b;line-height:1.6;">
            Ta commande est confirmée et passe en production.
            Tu recevras un autre email avec le numéro de suivi dès l'expédition.
          </div>
        </td></tr>

        <!-- Référence -->
        <tr><td style="padding:0 40px 24px;">
          <div style="background:#f5f5f7;border-radius:14px;padding:24px;text-align:center;">
            <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Référence sticker</div>
            <div style="font-size:32px;font-weight:700;letter-spacing:0.05em;margin-top:8px;font-family:'SF Mono','Menlo',monospace;">${order.reference}</div>
            <div style="font-size:13px;color:#86868b;margin-top:12px;line-height:1.5;">
              Garde cette référence. Elle permet de vérifier l'authenticité<br/>
              de ton sticker à tout moment sur le site.
            </div>
          </div>
        </td></tr>

        <!-- Détails commande -->
        <tr><td style="padding:0 40px;">
          <div style="font-size:13px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:16px;">Détails du sticker</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e7;">
            ${row('Marque & modèle', `${order.marque || ''} ${order.modele || ''}`)}
            ${row('Version', order.type_version)}
            ${row('Code moteur', order.moteur)}
            ${row('Couleur', `${order.nom_couleur} (${order.code_couleur})`)}
            ${row('Instagram', order.instagram ? '@' + order.instagram : '—')}
            ${row('Quantité', order.quantite)}
          </table>
        </td></tr>

        <!-- Récap prix -->
        <tr><td style="padding:32px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e7;">
            ${row('Sous-total', subtotal)}
            ${row('Livraison', shipping)}
            <tr>
              <td style="padding:18px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.02em;">Total payé</td>
              <td style="padding:18px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.02em;text-align:right;">${total}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Adresse livraison -->
        <tr><td style="padding:32px 40px 0;">
          <div style="font-size:13px;color:#86868b;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:12px;">Livraison</div>
          <div style="font-size:15px;line-height:1.6;color:#1d1d1f;">
            ${order.prenom || ''} ${order.nom || ''}<br/>
            ${order.adresse || ''}${order.complement ? '<br/>' + order.complement : ''}<br/>
            ${order.code_postal || ''} ${order.ville || ''}<br/>
            ${order.pays || ''}
          </div>
        </td></tr>

        <!-- CTA vérif -->
        <tr><td style="padding:40px;text-align:center;">
          <a href="${process.env.SITE_URL}/#verify"
             style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:980px;font-size:15px;font-weight:500;letter-spacing:-0.01em;">
            Vérifier l'authenticité
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f5f7;padding:24px 40px;text-align:center;">
          <div style="font-size:12px;color:#86868b;line-height:1.6;">
            Une question ? Réponds simplement à cet email.<br/>
            © ${new Date().getFullYear()} PureWerk. Tous droits réservés.
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
    <td style="padding:14px 0;font-size:14px;color:#86868b;border-bottom:1px solid #f0f0f2;">${label}</td>
    <td style="padding:14px 0;font-size:14px;color:#1d1d1f;text-align:right;font-weight:500;border-bottom:1px solid #f0f0f2;">${value || '—'}</td>
  </tr>`;
}
