import { Resend } from 'resend';

export default async function handler(req, res) {
  const debug = {
    env_check: {
      RESEND_API_KEY_exists: !!process.env.RESEND_API_KEY,
      RESEND_API_KEY_prefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 6) + '...' : 'MANQUANTE',
      EMAIL_FROM: process.env.EMAIL_FROM || 'MANQUANTE',
      EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || 'MANQUANTE'
    }
  };

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ ...debug, error: 'RESEND_API_KEY non configurée' });
  }

  const to = req.query.to || 'test@example.com';
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: to,
      subject: 'Test PureWerk — diagnostic Resend',
      html: '<p>Si tu reçois cet email, Resend fonctionne ✅</p><p>Heure du test : ' + new Date().toISOString() + '</p>'
    });

    return res.status(200).json({
      ...debug,
      success: true,
      to: to,
      resend_response: result
    });
  } catch (err) {
    return res.status(500).json({
      ...debug,
      success: false,
      error_message: err.message,
      error_name: err.name,
      error_full: JSON.stringify(err, Object.getOwnPropertyNames(err))
    });
  }
}
