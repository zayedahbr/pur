# PureWerk — Site e-commerce avec vérification d'authenticité

Site complet pour vendre des stickers personnalisés avec :
- Paiement sécurisé Stripe (CB + Apple Pay + Google Pay automatiques)
- Email de confirmation automatique après paiement
- Vérification d'authenticité par référence (comme Apple)
- Base de données Supabase qui stocke chaque commande

---

## Architecture

```
Client navigateur
   │
   ├─► /              → public/index.html (site statique)
   │
   ├─► POST /api/checkout    → Crée session Stripe + pré-enregistre commande
   ├─► POST /api/webhook     → Reçoit confirmation Stripe → marque payée + email
   └─► GET  /api/verify/:ref → Récupère infos sticker authentique
                                    │
                                    ▼
                              Supabase (PostgreSQL)
```

---

## Déploiement (étape par étape)

### 1. Créer les comptes (gratuits)

- **Vercel** : https://vercel.com (hébergement)
- **Supabase** : https://supabase.com (base de données)
- **Stripe** : https://stripe.com (paiement) — passe en mode "Test" pour démarrer
- **Resend** : https://resend.com (emails)

### 2. Configurer Supabase

1. Crée un nouveau projet sur https://supabase.com
2. Va dans **SQL Editor** → **New Query**
3. Copie/colle le contenu de `supabase/schema.sql` et exécute
4. Va dans **Settings → API** et récupère :
   - `Project URL` → ce sera `SUPABASE_URL`
   - `service_role secret` → ce sera `SUPABASE_SERVICE_ROLE_KEY` (⚠️ à garder secret)

### 3. Configurer Stripe

1. Sur https://dashboard.stripe.com → **Developers → API keys**
2. Récupère :
   - `Secret key` → `STRIPE_SECRET_KEY`
   - `Publishable key` → `STRIPE_PUBLISHABLE_KEY`
3. Active Apple Pay et Google Pay :
   - **Settings → Payment methods** → active "Apple Pay" et "Google Pay" (automatique avec Checkout)
4. Pour le webhook, on le configure **après** le déploiement (étape 6).

### 4. Configurer Resend

1. Sur https://resend.com → **API Keys** → crée une clé → `RESEND_API_KEY`
2. **Domains** → ajoute ton domaine (ex: `purewerk.fr`) et suis les instructions DNS pour le vérifier
   - Tant que tu n'as pas de domaine vérifié, tu peux utiliser `onboarding@resend.dev` comme `EMAIL_FROM` pour tester (mais limite 100 emails/jour vers ta propre adresse uniquement)

### 5. Déployer sur Vercel

```bash
# Dans le dossier du projet
npm install -g vercel
vercel login
vercel --prod
```

Puis sur le dashboard Vercel → **Project Settings → Environment Variables**, ajoute toutes les variables de `.env.example`.

Redéploie après avoir ajouté les variables : `vercel --prod`

### 6. Configurer le webhook Stripe

1. Sur https://dashboard.stripe.com → **Developers → Webhooks → Add endpoint**
2. URL : `https://ton-projet.vercel.app/api/webhook`
3. Évènement à écouter : `checkout.session.completed`
4. Récupère le **Signing secret** → ajoute-le sur Vercel comme `STRIPE_WEBHOOK_SECRET`
5. Redéploie une dernière fois

### 7. Tester

1. Ouvre ton site, configure un sticker, clique "Commander"
2. Sur Stripe, utilise une carte de test : `4242 4242 4242 4242` / n'importe quelle date future / n'importe quel CVC
3. Tu reçois l'email de confirmation
4. Reviens sur le site, va dans la section "Vérifier l'authenticité", entre la référence
5. ✅ Le sticker doit apparaître comme authentique

---

## Passer en production (vraies cartes)

1. Sur Stripe, active ton compte (KYC entreprise)
2. Bascule en mode **Live** et remplace les clés `sk_test_` / `pk_test_` par les `sk_live_` / `pk_live_`
3. Refais le webhook en mode Live (la clé webhook change aussi)
4. Vérifie ton domaine d'envoi sur Resend pour ne plus avoir de limite

---

## Structure des fichiers

```
purewerk/
├── public/
│   └── index.html              ← Site front-end (modifié avec section vérif)
├── api/
│   ├── checkout.js             ← POST : crée session Stripe + enregistre commande
│   ├── webhook.js              ← POST : Stripe → mise à jour commande + email
│   └── verify/[ref].js         ← GET  : vérifie une référence
├── lib/
│   ├── supabase.js             ← Client Supabase
│   └── email-template.js       ← Template HTML email
├── supabase/
│   └── schema.sql              ← Script création table
├── package.json
├── vercel.json
├── .env.example                ← Template variables d'environnement
└── README.md                   ← Ce fichier
```

---

## Comment ça marche

### Quand un client commande

1. Front : remplit le formulaire → `POST /api/checkout`
2. Backend : enregistre la commande en BDD avec statut `pending` + crée session Stripe
3. Client : redirigé vers la page Stripe Checkout (CB / Apple Pay / Google Pay)
4. Après paiement : Stripe appelle `POST /api/webhook`
5. Backend : passe la commande en `paid` + envoie email Resend
6. Client : redirigé vers le site avec confirmation

### Quand on vérifie une référence

1. Front : `GET /api/verify/P0789453`
2. Backend : cherche la commande dans Supabase, ne renvoie que les infos publiques
3. Front : affiche soit ✅ authentique avec les détails, soit ❌ non reconnu

---

## Sécurité

- La clé `service_role` Supabase n'est utilisée **que côté serveur** (les API endpoints)
- Le RLS (Row Level Security) est activé sur la table `orders`, donc personne ne peut lire la BDD depuis le navigateur
- Le webhook Stripe vérifie la signature pour s'assurer que la requête vient bien de Stripe
- L'endpoint `/api/verify` ne renvoie **jamais** les données client (email, adresse, prix) — uniquement les caractéristiques publiques du sticker

---

## Personnalisations courantes

**Changer le prix** : dans `public/index.html`, cherche `UNIT_PRICE` et `SHIPPING`.

**Modifier le template email** : `lib/email-template.js`.

**Voir les commandes** : sur Supabase → **Table Editor** → `orders`. Tu peux aussi y changer manuellement le statut en `shipped` quand tu envoies.

**Limiter la vérification aux commandes expédiées** : dans `api/verify/[ref].js`, change `.in('statut', ['paid', 'shipped'])` en `.eq('statut', 'shipped')`.

---

## Coûts à prévoir

| Service | Gratuit jusqu'à | Coût après |
|---|---|---|
| Vercel | 100 GB de bande passante / mois | 20 €/mois |
| Supabase | 500 Mo BDD + 50 000 utilisateurs | 25 €/mois |
| Stripe | — | 1.5 % + 0.25 € par transaction (UE) |
| Resend | 3 000 emails / mois | 20 €/mois pour 50 000 |

Pour démarrer : **0 €/mois** en frais fixes, uniquement les frais Stripe variables.
