# PureSpec — CHANGELOG

## v4.0.0 — Refonte design Porsche-inspired (mai 2026)

Refonte visuelle complète du site, alignée sur l'identité editoriale et premium
de la marque (référence : porsche.com — page d'accueil et fiche modèle Macan).
Toute la **logique métier est préservée** : le sticker final, les polices
gravées, l'export PNG, le flow Stripe et le format de référence (P + 7 chars)
sont identiques à v3. Seules les couches d'interface et de présentation
changent.

---

### 🎨 Design

- **Palette** : white-dominant, accents `#0a0a0a`. Gris hiérarchique (gray-1 à
  gray-5). Rouge `#cc0000` réservé à la barre du mode édition admin.
- **Typographie** :
  - Display : **Sora** (titres, marquage, brand) — geometric premium proche du
    Porsche Next.
  - Body : **Inter** (UI, paragraphes).
  - Mono : **JetBrains Mono** (références, codes moteur, prix, numéros).
- **Boutons** : rectangles aux coins doucement arrondis (`border-radius: 8px`)
  à la Porsche, plus de boutons full-pill.
- **Cartes** : `border-radius: 4px`, bordure `1px #f4f4f4`, hover marquée.
- **Sticker** : préservé pixel-pour-pixel (123×184, polices Inter,
  référence verticale, logo PureWerk). Aucun changement dans le rendu final.

### 📐 Page d'accueil

- **Hero plein écran** avec carrousel cross-fade 3 images (M3 rouge / jaune /
  noir, comme v3) et superposition titre+CTA en bas-gauche, façon Porsche.
- **Bandeau spécifications** sous le hero : 4 colonnes (Format / Pose /
  Référence / Garantie).
- **Section Atelier** (le configurateur) :
  - 2 colonnes desktop (sticker sticky à gauche, panneaux numérotés à droite —
    `01/03`, `02/03`, `03/03` en JetBrains Mono).
  - Stepper mobile 6 étapes inchangé fonctionnellement, restylé.
  - Tous les contrôles ré-habillés (segments, color-chips, sliders) au style
    sobre Porsche.
- **Philosophie** désormais en **carrousel horizontal** (4 cards de 540px
  scroll-snap), comme la section « Votre voyage Porsche commence ici ».
- **Bandeau réassurance noir** 4 colonnes (Authentique / Sans colle / Format /
  Expédition).
- **Footer** 5 colonnes (Brand / Produit / Compte / Aide / Légal) avec mention
  légale auto-affichée en bas.

### 🌐 Pages secondaires (account, dashboard, registry, contact, admin, cgv, legal)

- **`shared.css` v2** : reconstruit autour du nouveau design system. Compat
  ascendante préservée :
  - `.apple-card`, `.apple-input`, `.apple-segment` → restylés Porsche.
  - `.nav-blur`, `.nav-link`, `.nav-cta` → re-mappés sur le nouveau token set.
  - `.footer` + `.footer-inner` + `.footer-bottom` → harmonisés.
- Variables CSS conservées (`--ink`, `--gray`, `--bg`, `--red`, `--t-fast`,
  `--ease-apple`) pour ne pas casser les styles inline des sous-pages.
- Couleurs hard-codées des pages secondaires remplacées en masse :
  - `#1d1d1f` → `#0a0a0a`
  - `#f5f5f7` → `#fafafa`
  - `#86868b` → `#525252`
  - `#d2d2d7` → `#e8e8e8`
  - `#ececf0` → `#f4f4f4`
- Polices Sora + JetBrains Mono ajoutées sur toutes les sous-pages (au lieu
  d'Inter seul).

### 🌍 Internationalisation

- **Sélecteur de langue FR / EN retiré** du markup. Le moteur i18n.js et le
  dictionnaire FR/EN sont **conservés intacts** pour une réactivation
  ultérieure ; seul un drapeau `FORCE_FR = true` en tête de `i18n.js` force le
  français. Pour rouvrir EN : passer `FORCE_FR = false` et re-injecter le
  bouton switcher dans `shared.js` (`injectLangSwitch()` → retirer le early
  return).
- `shared.js` : `injectLangSwitch()` neutralisé.
- Pages `cgv.html` et `legal.html` : bouton `langSwitchBtn` retiré du markup.

### 🔢 Format des numéros de commande

- **v3** : `#000001` (avec préfixe dièse).
- **v4** : `000001` (LPAD 6 zéros, sans préfixe).
- Migration SQL incluse dans `supabase/schema.sql` (fonction
  `set_order_number` modifiée + notes de migration `UPDATE` optionnelle pour
  les anciennes commandes).

### ✏️ Mode édition inline (nouveau)

Tous les textes éditoriaux portent un attribut `data-edit-key="..."`. Un
administrateur peut éditer ces textes directement depuis le site, sans
redéployer, en accédant à n'importe quelle page avec le paramètre URL :

```
https://purespec.fr/?edit=VOTRE_CLE_ADMIN
```

- **Activation** : définir la variable d'environnement `EDIT_KEY` (Vercel →
  Settings → Environment Variables).
- **Front** : `/assets/js/edit-mode.js` rend les `[data-edit-key]`
  `contenteditable`, ajoute une barre rouge en haut avec compteur de
  modifications et bouton « Sauvegarder ».
- **API** : nouveau endpoint `/api/site-content.js`
  - `GET ?action=list` → public, retourne les overrides à appliquer.
  - `POST ?action=verify` → vérifie la clé.
  - `POST ?action=save` → sauvegarde (requiert la clé valide).
- **BDD** : nouvelle table `site_content (key, content, updated_at)` dans
  `schema.sql`.
- **Sécurité** : la `EDIT_KEY` n'est jamais envoyée tant qu'aucune
  modification n'est sauvegardée. Validez la clé avec un secret long et
  aléatoire (32+ caractères).

### 🛡️ Conservation explicite

Aucun changement dans :
- `api/checkout.js` (Stripe, anti-collision référence, success_url)
- `api/webhook.js` (traitement métier)
- `api/auth.js`, `api/orders.js`, `api/admin.js`, `api/contact.js`,
  `api/pricing.js`, `api/verify/`
- `lib/auth.js`, `lib/supabase.js`, `lib/email-template.js`
- Le rendu final du sticker (123×184px, polices Inter, logos PureWerk,
  référence gravée)
- L'export PNG (`generateRef`, `mmToPx`, `STICKER_MM_W=48`, `DPI_EXPORT=600`)
- Toute la logique JavaScript du configurateur (lignes 2916-4447 de l'ancien
  `index.html`, recopiées **verbatim** dans le nouveau)
- Le schéma de la table `orders` (sauf le format du champ `order_number`
  modifié dans la fonction `set_order_number()`)

---

## Migration depuis v3

### 1. Variables d'environnement à ajouter dans Vercel

```
EDIT_KEY=<chaîne aléatoire 32+ caractères pour activer le mode édition>
```

Générez-en une avec :
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 2. Migration SQL (à exécuter dans Supabase SQL Editor)

```sql
-- 1. Création de la table site_content
CREATE TABLE IF NOT EXISTS site_content (
  key         VARCHAR(120) PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_site_content_updated ON site_content(updated_at DESC);

-- 2. Mise à jour de la fonction set_order_number (sans préfixe #)
CREATE OR REPLACE FUNCTION set_order_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. (Optionnel) Normaliser les anciennes commandes
UPDATE orders
SET order_number = LPAD(REGEXP_REPLACE(order_number, '^#', ''), 6, '0')
WHERE order_number LIKE '#%';
```

Le point 3 est **optionnel** — les commandes existantes garderont leur format
avec `#` sinon, ce qui ne cassera rien à l'affichage. Si vous voulez
l'uniformité, exécutez l'`UPDATE`.

### 3. Déploiement Vercel

Identique à v3 : `git push` sur main. Aucun changement de configuration
`vercel.json`. Le nouveau endpoint `/api/site-content` est auto-détecté.

---

## Notes pour développeurs

- **Le sticker DOM est unique** dans `index.html` (un seul `#stickerRoot`).
  Sur desktop il est dans la colonne sticky de gauche ; sur mobile, grâce au
  collapse du grid CSS, il apparaît en haut au-dessus des étapes, avec
  position sticky et un compactage (CSS `.mobile-sticker-pin`).
- Les classes `.sticky-sticker` et `.mobile-sticker-pin` sont **toutes deux
  appliquées** au même élément ; chaque media query active une seule des deux
  selon le viewport. C'est intentionnel et identique à v3.
- Les inputs desktop+mobile utilisent `oninput="setUpper('FIELD', this)"` et
  la classe `mobile-sync` pour permettre la synchronisation bidirectionnelle.
- `i18n.js` reste actif et applique le dictionnaire FR sur tous les
  `[data-i18n]` au chargement. Les éléments `[data-edit-key]` du nouveau
  système ne sont pas en conflit avec `[data-i18n]` (clés différentes,
  attributs différents).

## Pages secondaires — éléments à harmoniser ultérieurement

Cette refonte v4 harmonise le **chrome** (nav, footer, typographie, palette)
de toutes les pages, mais certaines pages secondaires gardent des
spécificités de design v3 dans leurs styles inline :

- `dashboard.html` : les `.order-card` ont un `border-radius: 18px` v3 (vs 4px
  Porsche). Cohérent fonctionnellement, à harmoniser si vous voulez une
  parfaite cohérence visuelle.
- `account.html` : les onglets login/signup utilisent `.acc-tabs` avec radius
  12px (style v3 préservé).
- `registry.html` : la carte `.verify-result-success` garde son radius 24px.

Ces écarts sont **cosmétiques uniquement** et ne nuisent pas à l'expérience.
Un sprint v4.1 pourra les normaliser si désiré.
