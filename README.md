# PureSpec

Site e-commerce pour stickers électrostatiques personnalisés.
Stack : HTML/CSS/JS vanilla, Vercel Serverless (Node), Supabase, Stripe, Resend.

---

## 🆕 Refonte 2026-05 (round 2)

- **Confirmation avant paiement** : nouveau pop-up «&nbsp;Tout est bon&nbsp;?&nbsp;» entre la livraison et Stripe, listant véhicule / moteur / couleur / référence / quantité / total, avec deux boutons (Vérifier / Oui, valider).
- **Authentification Apple supprimée** (boutons UI + routes `oauth-apple` côté serveur). Seul Google reste.
- **Page Registry nettoyée** : retrait du badge «&nbsp;Officiel&nbsp;» et de la grille de confiance «&nbsp;8 caractères uniques&nbsp;».
- **Logo maison retiré** du bloc «&nbsp;À propos des teintes&nbsp;» (page contact).
- **Pages séparées** `/legal` et `/cgv` — le contenu légal n'est plus dans `/contact`. Liens accessibles via le footer uniquement.
- **Format de numéro de commande** : `PW-000001` → `#000001` (plus de confusion avec la référence sticker `P…`).
- **Pop-up paiement** : suppression du texte «&nbsp;Votre PureSpec est en route&nbsp;» et de la timeline `commande confirmée → impression → expédition`. Le lien «&nbsp;Une question&nbsp;?&nbsp;» pointe vers `/contact` au lieu de `mailto:hello@`.
- **i18n FR/EN** : détection automatique de la langue du navigateur (FR pour `fr-*`, EN pour le reste de l'Europe), bouton switcher dans la nav, dictionnaires complets pour `index`, `registry`, `contact`, `legal`, `cgv`, modal commande et bannière cookies. Persistance via cookie 1 an + localStorage. Les pages `account`, `dashboard`, `admin` restent en français.
- **Pays de livraison étendus** : 31 pays (UE complète + UK + Monaco + Suisse + Norvège) au lieu de 5.
- **Grille de livraison par pays éditable depuis l'admin** : nouvel onglet «&nbsp;Paramètres&nbsp;» dans `/admin` pour éditer le prix unitaire du sticker et le tarif livraison de chaque pays. Les prix sont validés côté serveur dans `checkout.js` (impossible de soumettre un montant falsifié).
- **Bannière cookies RGPD** : auto-injectée au premier chargement, lien «&nbsp;Gérer les cookies&nbsp;» dans tous les footers pour la rouvrir.
- **Infos auto-entrepreneur** : PURESPEC · SIREN 949 143 101 · TVA non applicable, art. 293 B du CGI, dans le footer de toutes les pages + pages `/legal` et `/cgv`.
- **Polish hero + atelier** : eyebrow Atelier en `0.16em` tracking, titre `64px` letter-spacing `-0.04em`, hero specs avec séparateurs verticaux Porsche-like.
- **Sécurité checkout** : `api/checkout.js` ignore désormais les `unitPrice`/`shipping` envoyés par le client et recharge la grille depuis `app_settings` en BDD.

---

## 🏗️ Architecture

```
public/
├── index.html         → Page d'accueil + configurateur (sacré, ne pas modifier le bloc atelier)
├── registry.html      → Vérification d'authenticité
├── contact.html       → Formulaire de contact uniquement
├── legal.html         → Mentions légales (NOUVEAU)
├── cgv.html           → Conditions générales de vente (NOUVEAU)
├── account.html       → Connexion / inscription / mot de passe oublié
├── dashboard.html     → Espace client (commandes, profil, sécurité)
├── admin.html         → Back-office (stats, commandes, messages, clients, paramètres)
└── assets/
    ├── css/shared.css
    └── js/
        ├── i18n.js    → Dictionnaires FR/EN + détection + switcher (NOUVEAU)
        └── shared.js  → Nav, auth, toast, bannière cookies, etc.

api/
├── checkout.js        → Crée la session Stripe (prix BDD-validés)
├── webhook.js         → Réception des événements Stripe (paiement OK)
├── verify/[ref].js    → Vérifie une référence sticker
├── auth.js            → Auth client (signup/login/logout/me/forgot/reset/profil/OAuth Google)
├── orders.js          → Commandes du client connecté
├── admin.js           → Back-office (auth + CRUD orders/messages/customers/settings + stats)
├── pricing.js         → Lecture publique de la grille tarifaire (NOUVEAU)
├── contact.js         → Soumission du formulaire contact
└── test-email.js      → Diagnostic email

lib/
├── supabase.js        → Client Supabase service_role
├── email-template.js  → Template HTML email confirmation commande
└── auth.js            → Hash, sessions, cookies, rate limit

supabase/
└── schema.sql         → Schéma BDD + table app_settings (NOUVEAU)
```

**9 fonctions Serverless** (sous la limite Hobby de 12 sur Vercel).

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

> Apple OAuth a été retiré : aucune variable Apple à configurer.

### Redirect URI à configurer côté Google

- `https://votresite.fr/api/auth?action=oauth-callback&provider=google`

---

## 🚀 Mise en route

### 1. Supabase
1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor → New Query**
3. Coller le contenu de `supabase/schema.sql` et exécuter
4. La table `app_settings` est seedée avec un prix par défaut de 9,90 € et une grille de livraison par défaut. Vous pourrez tout modifier depuis `/admin` → onglet Paramètres.

### 2. Créer un compte admin

```bash
node -e "console.log(require('bcryptjs').hashSync('VOTRE_MOT_DE_PASSE', 10))"
```

Puis dans le SQL Editor de Supabase :

```sql
INSERT INTO admin_users (email, password_hash, nom, role)
VALUES ('toi@exemple.fr', 'LE_HASH_GENERE', 'Ton Nom', 'superadmin');
```

L'admin se connecte ensuite via `/admin` avec ces identifiants.

### 3. Stripe — voir version précédente
### 4. Resend — voir version précédente
### 5. Déploiement Vercel — voir version précédente

---

## 🧭 Routes du site

| URL | Page |
|-----|------|
| `/` | Accueil + configurateur sticker |
| `/registry` | Vérifier l'authenticité d'un sticker |
| `/contact` | Formulaire de contact uniquement (sans le légal) |
| `/legal` | Mentions légales |
| `/cgv` | Conditions générales de vente |
| `/account` | Connexion / inscription |
| `/account?mode=signup` | Création de compte (onglet pré-sélectionné) |
| `/account?reset=TOKEN` | Page de réinitialisation (depuis le mail) |
| `/dashboard` | Espace client (connexion requise) |
| `/admin` | Back-office (connexion admin requise) — inclut l'onglet Paramètres |

---

## 🌐 i18n

- Le dictionnaire est dans `public/assets/js/i18n.js` (objet `DICT.fr` et `DICT.en`).
- Détection automatique au premier chargement : `fr` si `navigator.language` commence par `fr`, sinon `en`.
- Bouton switcher dans la barre de nav (présent en dur sur index/legal/cgv, auto-injecté ailleurs par `shared.js`).
- Persisté en cookie `ps_lang` (1 an) + localStorage.
- Pour traduire un nouvel élément : ajouter `data-i18n="ma.clef"` sur l'élément, ajouter la clef dans `DICT.fr` et `DICT.en`. `apply()` s'exécute au `DOMContentLoaded` et à chaque changement de langue.

---

## 💰 Tarification

- **Côté client** : `/api/pricing` (cache 5 min) sert le prix unitaire + la grille livraison à l'index pour affichage. Ces valeurs ne servent QUE à l'affichage.
- **Côté serveur** : `api/checkout.js` recharge systématiquement les vraies valeurs depuis `app_settings` au moment de créer la session Stripe — impossible de falsifier les prix via le client.
- **Admin** : `/admin → Paramètres` permet de modifier prix unitaire et grille de livraison. Validation : code pays ISO-2, prix ≥ 0. Pays absent de la grille → tarif FR par défaut.

---

## 🔐 Système d'auth

Auth maison (sans Supabase Auth) :
- Mots de passe en `bcryptjs` (10 rounds)
- Sessions stockées en BDD (table `sessions`), 30 jours
- Token aléatoire de 64 hex char, dans un cookie HttpOnly+SameSite=Lax
- Deux cookies séparés : `ps_session` (client) et `ps_admin` (admin)
- Rate-limit basique en mémoire (par instance Vercel)
- Google OAuth opérationnel (config GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)

---

## 📦 Format de référence sticker

Format unique pour tout le site : **`P` + 7 caractères alphanumériques** (ex : `P4K9L2M7`).

- Le `P` est la signature PureSpec gravée verticalement sur la tranche
- 7 caractères pris dans `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (exclut O, I, 0, 1 pour la lisibilité)
- Cohérent côté générateur (index.html), côté backend (checkout/verify) et côté registry

---

## 🔢 Format de numéro de commande

`#` + 6 chiffres auto-incrémentés (ex : `#000123`). Géré par séquence Postgres `order_number_seq` + trigger `set_order_number()`.

---

## 🍪 Cookie consent

- Bannière auto-injectée par `shared.js` au premier chargement si `ps_cookie_consent` n'est pas en localStorage.
- Bouton «&nbsp;J'ai compris&nbsp;» → écrit `localStorage.ps_cookie_consent = '1'`.
- Lien «&nbsp;Gérer les cookies&nbsp;» dans tous les footers → appelle `window.openCookieSettings()` qui supprime la clef et réaffiche la bannière.
- Textes traduits FR/EN via i18n.

---

## ⚠️ Notes

- Le **bloc atelier (configurateur)** dans `index.html` reste intact : polices, animations, structure des SVG du sticker, pipette desktop et stepper mobile. Seul le titre au-dessus a été retouché (item 10).
- L'**eyedropper natif (window.EyeDropper)** est utilisé en priorité quand disponible (Chrome desktop). Fallback : pipette sur image uploadée.
- La colonne `customers.apple_sub` reste dans le schéma (inutilisée) pour éviter une migration destructive ; le code Apple a été retiré.

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
| Paiement confirmé | Client | Récap commande |
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
