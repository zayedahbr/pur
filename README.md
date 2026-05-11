# PureSpec

Site e-commerce pour la vente de stickers électrostatiques premium personnalisés (format vignette d'assurance), avec configurateur visuel, pipette couleur depuis photo, registry de vérification d'authenticité, comptes client et back-office admin.

## Stack

- **Front** : HTML/CSS/JS vanilla, design Apple-like
- **Back** : API serverless (Vercel functions, Node 18+)
- **DB** : Supabase (Postgres + Auth)
- **Paiement** : Stripe Checkout
- **Emails** : Resend
- **Déploiement** : Vercel

## Structure

```
purespec/
├── public/
│   ├── index.html          Page d'accueil (atelier + story)
│   ├── registry.html       Vérification authenticité
│   ├── account.html        Espace client (commandes + profil)
│   ├── admin.html          Back-office admin
│   ├── contact.html        Formulaire contact
│   ├── login.html          Magic-link auth
│   ├── legal.html          Mentions légales / CGV / privacy
│   ├── css/                Styles (main, sticker, modals, atelier)
│   └── js/                 Scripts partagés (common, layout, atelier, status)
├── api/
│   ├── checkout.js         POST → crée commande + session Stripe
│   ├── webhook.js          Stripe webhook (paid + email)
│   ├── config.js           Sert URL Supabase publique au client
│   ├── verify/[ref].js     Vérif authenticité Registry
│   ├── contact/index.js    Reçoit messages contact
│   ├── account/
│   │   ├── orders.js       Liste commandes user
│   │   ├── order/[ref].js  Détail commande (avec timeline)
│   │   └── profile.js      GET/PATCH profil
│   └── admin/
│       ├── me.js           Vérif rôle admin
│       ├── orders.js       Liste + filtres + stats
│       ├── order/[id].js   GET + PATCH (statut, tracking, notes)
│       ├── messages.js     Liste tickets contact
│       └── message/[id].js Update statut ticket
├── lib/
│   ├── supabase.js         Client + getUserFromToken + requireAdmin
│   ├── helpers.js          generateReference, validation
│   └── email-templates.js  4 templates HTML (confirmation, shipped, contact-received, admin-notif)
├── supabase/
│   └── schema.sql          Schéma complet (profiles, orders, events, contact_messages + RLS)
└── package.json
```

## Installation

### 1. Cloner et installer

```bash
git clone <repo>
cd purespec
npm install
```

### 2. Créer un projet Supabase

1. Aller sur [supabase.com](https://supabase.com) et créer un nouveau projet
2. SQL Editor → New query → coller le contenu de `supabase/schema.sql` → exécuter
3. **Activer l'auth email** : Authentication → Providers → Email → "Enable Email provider" + désactiver "Confirm email" (magic link suffit)
4. **Configurer la redirection** : Authentication → URL Configuration → Redirect URLs : ajouter `https://votre-domaine.com/account` et `http://localhost:3000/account`
5. Récupérer dans Settings → API :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role — secret)
   - `SUPABASE_ANON_KEY` (anon public)

### 3. Stripe

1. [stripe.com](https://stripe.com) → Dashboard → Récupérer `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY`
2. Webhooks → Add endpoint : `https://votre-domaine.com/api/webhook`, événement `checkout.session.completed`
3. Récupérer le `STRIPE_WEBHOOK_SECRET`

### 4. Resend

1. [resend.com](https://resend.com) → Créer une API key
2. Vérifier votre domaine d'envoi (DNS)

### 5. Variables d'environnement Vercel

Dans Vercel → Settings → Environment Variables (ou `.env.local` en dev) :

```bash
SITE_URL=https://purespec.fr
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
EMAIL_FROM=PureSpec <hello@purespec.fr>
EMAIL_REPLY_TO=hello@purespec.fr
ADMIN_EMAIL=admin@purespec.fr
```

### 6. Déployer

```bash
vercel --prod
```

### 7. Créer un admin

Après votre premier déploiement :

1. Aller sur `/account/login`, se connecter avec votre email (réception magic link)
2. Cliquer le lien — votre compte est créé automatiquement (trigger Supabase)
3. Dans Supabase SQL Editor :

```sql
UPDATE profiles SET is_admin = TRUE WHERE email = 'votre@email.com';
```

4. Aller sur `/admin` — vous avez accès au back-office.

## Développement local

```bash
vercel dev
```

Le site tourne sur `http://localhost:3000`. Les routes API sont accessibles.

Pour les emails en dev : Resend permet d'envoyer en mode test. Pour Stripe webhook en dev :

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

## Format de référence

Chaque sticker porte une référence unique de **8 caractères** : `PS` + 6 alphanumériques (ex: `PS7K9L2M`). Les chars `O`, `I`, `0`, `1` sont exclus pour éviter la confusion visuelle.

## Workflow d'une commande

1. **Client** : configure son sticker dans l'atelier, clique "Commander"
2. **API checkout** : génère ref + order_number, crée la commande (statut `pending`), session Stripe
3. **Client** : paie sur Stripe
4. **Webhook Stripe** : passe la commande à `paid`, envoie email de confirmation
5. **Admin** : voit la commande dans `/admin`, la passe à `in_production` puis `shipped` (avec n° tracking → email auto)
6. **Client** : suit le statut sur `/account` + reçoit les emails à chaque étape

## Sécurité

- Service-role key uniquement côté serveur (env var, jamais exposée)
- RLS activée sur toutes les tables sensibles
- Tokens JWT vérifiés côté API pour `/api/account/*` et `/api/admin/*`
- Sanitization basique des inputs utilisateurs
- Stripe webhook signé

## License

Tous droits réservés.
