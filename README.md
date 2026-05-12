# PureSpec

Site e-commerce pour stickers électrostatiques personnalisés.
Stack : HTML/CSS/JS vanilla, Vercel Serverless (Node), Supabase, Stripe, Resend.

---

## 🆕 Refonte 2026-05

- **Hero** : nouveau layout split (typo gauche, produit droite) sur fond blanc, dans l'esprit Porsche/Apple. La bannière noire plein-écran a été supprimée.
- **Navbar** : redessinée, hamburger mobile fonctionnel (`navMobileMenu` plein écran). Brand • Atelier • Philosophie • Registry • Contact • avatar • CTA.
- **Configurator (atelier + sticker)** : **inchangé** — structure, IDs, JS, visuels du sticker préservés à 100 %.
- **Commande forcée avec compte** : nouveau flow en 3 étapes — récap → auth gate (login/signup/Google/Apple) → livraison auto-remplie. L'adresse est sauvegardée sur le profil à la commande.
- **OAuth Google + Apple** : endpoints `/api/auth?action=oauth-google` / `oauth-apple` + callback. Google complet ; Apple stub (voir ENV plus bas).
- **Eyebrows recolorés** : "L'EXPÉRIENCE", "PRÉCISION TECHNIQUE", "NETTETÉ ABSOLUE", "AUTHENTICITÉ" sont passés en gris neutre.
- **Emails** : tous les templates ont été migrés en design clair (blanc/gris), cohérent avec la nouvelle DA. Tous les `PureWerk` → `PureSpec`.
- **Schéma** : `customers.password_hash` est désormais nullable + colonnes `google_sub`, `apple_sub`, `auth_provider`.
- **Nettoyage** : ~420 lignes de CSS mort supprimées (sections `install-*`, `faq-*`, `registry-*` qui n'étaient plus dans le HTML).

---

## 🏗️ Architecture

```
public/
├── index.html         → Page d'accueil + configurateur (sacré, ne pas modifier le bloc atelier)
├── registry.html      → Vérification d'authenticité
├── contact.html       → Formulaire de contact + mentions légales + CGV
├── account.html       → Connexion / inscription / mot de passe oublié
├── dashboard.html     → Espace client (commandes, profil, sécurité)
├── admin.html         → Back-office (stats, commandes, messages, clients)
└── assets/
    ├── css/shared.css
    └── js/shared.js

api/
├── checkout.js        → Crée la session Stripe
├── webhook.js         → Réception des événements Stripe (paiement OK)
├── verify/[ref].js    → Vérifie une référence sticker
├── auth.js            → Auth client (signup/login/logout/me/forgot/reset/profil)
├── orders.js          → Commandes du client connecté
├── admin.js           → Back-office (auth + CRUD orders/messages/customers + stats)
├── contact.js         → Soumission du formulaire contact
└── test-email.js      → Diagnostic email

lib/
├── supabase.js        → Client Supabase service_role
├── email-template.js  → Template HTML email confirmation commande
└── auth.js            → Hash, sessions, cookies, rate limit

supabase/
└── schema.sql         → Schéma BDD à exécuter dans Supabase
```

**8 fonctions Serverless** (sous la limite Hobby de 12 sur Vercel).

---

## ⚙️ Variables d'environnement

À configurer dans Vercel → Settings → Environment Variables :

| Clé | Description |
|-----|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (sk_…) |
| `STRIPE_WEBHOOK_SECRET` | Secret du webhook Stripe (whsec_…) |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique (utilisable côté client si besoin) |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role Supabase |
| `RESEND_API_KEY` | Clé API Resend |
| `EMAIL_FROM` | Adresse expéditeur (ex: `PureSpec <commandes@purespec.fr>`) |
| `EMAIL_REPLY_TO` | Adresse de réponse (ex: `contact@purespec.fr`) |
| `SITE_URL` | URL canonique du site (ex: `https://purespec.fr`) |
| `ADMIN_EMAIL` | Email recevant les notifs (nouvelle commande, nouveau message contact) |
| `GOOGLE_CLIENT_ID` | **OAuth** — Client ID Google (Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client). Laissez vide pour désactiver. |
| `GOOGLE_CLIENT_SECRET` | **OAuth** — Client secret Google associé. |
| `APPLE_CLIENT_ID` | **OAuth** — Services ID Apple (apple.com → Developer → Identifiers). Laissez vide pour désactiver. |
| `APPLE_TEAM_ID` | **OAuth** — Team ID Apple Developer. |
| `APPLE_KEY_ID` | **OAuth** — Key ID Apple (associé à la clé privée Sign in with Apple). |
| `APPLE_PRIVATE_KEY` | **OAuth** — Clé privée ES256 (`.p8` content) Apple, multiligne ou en base64. |

### Redirect URIs à configurer côté Google / Apple

- Google : `https://votresite.fr/api/auth?action=oauth-callback&provider=google`
- Apple : `https://votresite.fr/api/auth?action=oauth-callback&provider=apple`

> Note : la connexion Google est entièrement opérationnelle dès que `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` sont définies. La connexion Apple nécessite en plus la finalisation du client_secret JWT (`oauthCallback` dans `api/auth.js`) — laissée en stub car elle dépend de la `APPLE_PRIVATE_KEY` et de la lib JWT que vous choisirez (`jsonwebtoken` ou `jose`).


---

## 🚀 Mise en route

### 1. Supabase
1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor → New Query**
3. Coller le contenu de `supabase/schema.sql` et exécuter

### 2. Créer un compte admin

```bash
# Génère un hash bcrypt en local :
node -e "console.log(require('bcryptjs').hashSync('VOTRE_MOT_DE_PASSE', 10))"
```

Puis dans le SQL Editor de Supabase :

```sql
INSERT INTO admin_users (email, password_hash, nom, role)
VALUES ('toi@exemple.fr', 'LE_HASH_GENERE', 'Ton Nom', 'superadmin');
```

L'admin se connecte ensuite via `/admin` avec ces identifiants.

### 3. Stripe
1. Créer un compte sur [stripe.com](https://stripe.com)
2. Activer le **mode Test** d'abord pour vérifier
3. Récupérer `STRIPE_SECRET_KEY`
4. Créer un webhook qui pointe vers `https://votresite.fr/api/webhook` et écoute l'évènement `checkout.session.completed`
5. Récupérer le secret du webhook `STRIPE_WEBHOOK_SECRET`

### 4. Resend (emails)
1. Créer un compte sur [resend.com](https://resend.com)
2. Vérifier votre domaine d'envoi
3. Récupérer la clé API `RESEND_API_KEY`

### 5. Déploiement Vercel
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 🧭 Routes du site

| URL | Page |
|-----|------|
| `/` | Accueil + configurateur sticker |
| `/registry` | Vérifier l'authenticité d'un sticker |
| `/contact` | Formulaire de contact + mentions légales + CGV |
| `/account` | Connexion / inscription |
| `/account?mode=signup` | Création de compte (onglet pré-sélectionné) |
| `/account?reset=TOKEN` | Page de réinitialisation (depuis le mail) |
| `/dashboard` | Espace client (connexion requise) |
| `/admin` | Back-office (connexion admin requise) |

---

## 🔐 Système d'auth

Auth maison (sans Supabase Auth) :
- Mots de passe en `bcryptjs` (10 rounds)
- Sessions stockées en BDD (table `sessions`), 30 jours
- Token aléatoire de 64 hex char, dans un cookie HttpOnly+SameSite=Lax
- Deux cookies séparés : `ps_session` (client) et `ps_admin` (admin)
- Rate-limit basique en mémoire (par instance Vercel)

---

## 📦 Format de référence sticker

Format unique pour tout le site : **`P` + 7 caractères alphanumériques** (ex : `P4K9L2M7`).

- Le `P` est la signature PureSpec gravée verticalement sur la tranche
- 7 caractères pris dans `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (exclut O, I, 0, 1 pour la lisibilité)
- Cohérent côté générateur (index.html), côté backend (checkout/verify) et côté registry

---

## 🔄 Workflow de commande

```
pending → paid → in_production → shipped → delivered
                        ↘ (admin)
            cancelled  /  refunded
```

Transitions clés :
- `paid` : déclenchée automatiquement par le webhook Stripe
- `in_production`, `shipped`, `delivered`, `cancelled`, `refunded` : positionnées manuellement depuis `/admin`
- L'admin peut renseigner transporteur + n° de suivi
- Quand le statut passe à `shipped` avec un n° de suivi, un email auto est envoyé au client

---

## 📨 Emails automatiques

| Évènement | Destinataire | Template |
|-----------|--------------|----------|
| Inscription | Client | "Bienvenue chez PureSpec" |
| Mot de passe oublié | Client | Lien de réinitialisation (1h) |
| Paiement confirmé | Client | Récap commande (template original conservé) |
| Paiement confirmé | Admin (ADMIN_EMAIL) | Notification nouvelle commande |
| Commande expédiée | Client | N° de suivi + lien |
| Nouveau message contact | Client | Confirmation de réception |
| Nouveau message contact | Admin (ADMIN_EMAIL) | Notification + reply-to client |
| Réponse admin | Client | Email avec votre réponse |

---

## 🛠️ Développement local

```bash
git clone <repo>
cd purespec
npm install
cp .env.example .env.local   # à créer manuellement avec les vars du tableau
vercel dev
```

Ouvrir `http://localhost:3000`.

---

## ⚠️ Notes

- Le **bloc atelier (configurateur)** dans `index.html` ne doit pas être modifié sans précaution : polices, animations, structure des SVG du sticker, pipette desktop et stepper mobile sont calibrés pour produire un rendu fidèle.
- Les **3 images de fond** (`m3 rouge.png`, `m3 jaune.png`, `m3 noire.png`) et **3 SVG circuits** sont hébergées sur GitHub Raw — pour passer en production sérieuse, idéalement les uploader sur Vercel/Supabase Storage ou un CDN.
- L'**eyedropper natif (window.EyeDropper)** est utilisé en priorité quand disponible (Chrome desktop). Fallback : pipette sur image uploadée.

---

## 📝 Changelog v2.0

- ✅ Page registry séparée (`/registry`), avec mention précision teintes
- ✅ Référence unifiée au format `P` + 7 chars (sur l'ensemble du site)
- ✅ Comptes clients complets (signup, login, mot de passe oublié, profil)
- ✅ Espace client `/dashboard` avec suivi des commandes et timeline
- ✅ Back-office `/admin` complet (stats, gestion commandes/messages/clients, envoi de réponses)
- ✅ Page contact `/contact` avec mentions légales et CGV
- ✅ Workflow de commande étendu (pending → paid → in_production → shipped → delivered)
- ✅ Notifications email à l'admin sur nouvelle commande / nouveau message
- ✅ Email automatique au client à l'expédition (avec tracking)
- ✅ Retrait du routeur SPA et de la callout Registry de la home
- ✅ Mentions de précision des teintes (sous le bouton pipette + sur la modal + au footer + sur le registry)
- ✅ Structure multi-pages propre (SEO, partages, deep-linking)
- ✅ N° de commande lisible (`PW-000001`) auto-incrémenté
