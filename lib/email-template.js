// lib/email-template.js — template HTML de l'email de confirmation
export function buildConfirmationEmail(order) {
  const total = Number(order.total_eur).toFixed(2).replace('.', ',') + ' €';
  const subtotal = (Number(order.unit_price_eur) * order.quantite).toFixed(2).replace('.', ',') + ' €';
  const shipping = Number(order.shipping_eur).toFixed(2).replace('.', ',') + ' €';
  const siteUrl = process.env.SITE_URL || '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Confirmation commande PureSpec</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#1d1d1f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);">

        <!-- Header light -->
        <tr><td style="background:#ffffff;padding:36px 40px 24px;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div style="color:#1d1d1f;font-size:22px;font-weight:600;letter-spacing:-0.02em;">PureSpec</div>
        </td></tr>

        <!-- Confirmation -->
        <tr><td style="padding:40px 40px 24px;">
          <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:14px;">Commande confirmée</div>
          <div style="font-size:28px;font-weight:700;letter-spacing:-0.03em;line-height:1.1;margin-bottom:14px;color:#1d1d1f;">Merci${order.prenom ? ', ' + order.prenom : ''}.</div>
          <div style="font-size:15px;color:#424245;line-height:1.55;">
            Votre commande est confirmée et passe en production. Vous recevrez un autre email avec le numéro de suivi dès l'expédition.
          </div>
        </td></tr>

        <!-- Référence -->
        <tr><td style="padding:0 40px 24px;">
          <div style="background:#f5f5f7;border-radius:14px;padding:24px;text-align:center;">
            <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;">Référence sticker</div>
            <div style="font-size:30px;font-weight:700;letter-spacing:0.05em;margin-top:8px;font-family:'SF Mono','Menlo','Consolas',monospace;color:#1d1d1f;">${order.reference}</div>
            <div style="font-size:13px;color:#86868b;margin-top:12px;line-height:1.5;">
              Conservez cette référence. Elle permet de vérifier l'authenticité<br/>
              de votre sticker à tout moment dans le Registry.
            </div>
          </div>
        </td></tr>

        <!-- Détails commande -->
        <tr><td style="padding:0 40px;">
          <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:14px;">Détails du sticker</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececf0;">
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
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececf0;">
            ${row('Sous-total', subtotal)}
            ${row('Livraison', shipping)}
            <tr>
              <td style="padding:18px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.02em;color:#1d1d1f;">Total payé</td>
              <td style="padding:18px 0 0;font-size:17px;font-weight:600;letter-spacing:-0.02em;text-align:right;color:#1d1d1f;">${total}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Adresse livraison -->
        <tr><td style="padding:32px 40px 0;">
          <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:0.14em;font-weight:500;margin-bottom:12px;">Livraison</div>
          <div style="font-size:15px;line-height:1.6;color:#1d1d1f;">
            ${order.prenom || ''} ${order.nom || ''}<br/>
            ${order.adresse || ''}${order.complement ? '<br/>' + order.complement : ''}<br/>
            ${order.code_postal || ''} ${order.ville || ''}<br/>
            ${order.pays || ''}
          </div>
        </td></tr>

        <!-- CTA vérif -->
        <tr><td style="padding:40px;text-align:center;">
          <a href="${siteUrl}/registry"
             style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:980px;font-size:15px;font-weight:500;letter-spacing:-0.01em;">
            Vérifier l'authenticité
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;padding:24px 40px;text-align:center;border-top:1px solid rgba(0,0,0,0.06);">
          <div style="font-size:12px;color:#86868b;line-height:1.6;">
            Une question ? Répondez simplement à cet email.<br/>
            © ${new Date().getFullYear()} PureSpec. Tous droits réservés.
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
