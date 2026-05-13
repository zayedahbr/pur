# PureSpec v3 → v4 — Migration en 3 étapes

## 1. Ajouter la variable d'environnement Vercel

Vercel → Settings → Environment Variables → Add :

| Clé | Valeur |
|-----|--------|
| `EDIT_KEY` | une chaîne aléatoire de 32+ caractères |

Pour la générer en une commande :
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Sauvegardez bien cette valeur — elle vous servira à éditer les textes du site
(via `?edit=VOTRE_VALEUR`).

## 2. Migration SQL (Supabase SQL Editor)

Collez ce bloc complet dans le SQL Editor de Supabase et exécutez :

```sql
-- =================== MIGRATION v3 → v4 ===================

-- (1) Nouvelle table pour le mode édition admin inline
CREATE TABLE IF NOT EXISTS site_content (
  key         VARCHAR(120) PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_site_content_updated
  ON site_content(updated_at DESC);

-- (2) Mise à jour du trigger des numéros de commande (sans préfixe #)
CREATE OR REPLACE FUNCTION set_order_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (3) [OPTIONNEL] Normaliser les anciennes commandes existantes
-- Décommenter si vous voulez uniformiser. Sinon, les anciennes commandes
-- gardent leur format '#000123' (aucun bug, juste un écart d'affichage).
--
-- UPDATE orders
-- SET order_number = LPAD(REGEXP_REPLACE(order_number, '^#', ''), 6, '0')
-- WHERE order_number LIKE '#%';
```

## 3. Déploiement

Standard : `git push` sur main → Vercel construit et déploie.

Aucun changement de `vercel.json` ou `package.json` à faire.

---

## Vérifier que ça marche

1. **Page d'accueil** : la home doit s'afficher en plein écran avec un titre
   "La signature de votre build" et un carrousel de 3 images M3.
2. **Configurateur** : tapez dans les champs — le sticker se met à jour en
   temps réel comme avant.
3. **Commande de test** : exécutez une commande complète. Le numéro de
   commande dans l'email et l'écran de succès doit être au format `000001`
   (sans `#`).
4. **Mode édition** : ouvrez `https://votresite.fr/?edit=VOTRE_EDIT_KEY`.
   Une barre rouge doit apparaître en haut. Les titres et textes doivent
   être éditables au clic.

## Rollback

Si quelque chose ne va pas :
- Sur Vercel, dans **Deployments**, faites « **Promote to Production** » sur
  le dernier déploiement v3 pour revenir en arrière.
- La migration SQL est **non-destructive** : `CREATE TABLE IF NOT EXISTS`
  et `CREATE OR REPLACE FUNCTION` ne cassent rien. La nouvelle table
  `site_content` peut rester en BDD sans poser de problème.

Pour annuler entièrement la migration SQL :
```sql
-- Si vous voulez tout annuler
DROP TABLE IF EXISTS site_content;
-- Et restaurer l'ancienne fonction set_order_number (préfixe #)
CREATE OR REPLACE FUNCTION set_order_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := '#' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Utilisation du mode édition admin

Une fois `EDIT_KEY` configuré et la table `site_content` créée, vous pouvez
modifier les textes du site **sans toucher au code** :

1. Accédez à n'importe quelle page avec `?edit=VOTRE_EDIT_KEY` dans l'URL.
   Exemple : `https://purespec.fr/?edit=a3b9d4e2f7...`
2. Une **barre rouge** apparaît en haut de la page.
3. Tous les textes éditables sont entourés de pointillés et **cliquables**.
4. Cliquez pour les modifier en place.
5. Le compteur en haut indique le nombre de modifications en attente.
6. Cliquez sur **"Sauvegarder"** pour écrire les changements en BDD.
7. **Les visiteurs verront immédiatement les nouveaux textes** (cache 60s
   côté CDN, donc maximum 1 minute de propagation).

### Éléments actuellement éditables

- Hero : eyebrow, 3 lignes du titre, CTA principal et secondaire
- Atelier : eyebrow, titre, sous-titre, intitulés des 3 panneaux
- Philosophie : eyebrow, titre, sous-titre, et chaque carte (eyebrow + titre
  + texte) × 4 cartes
- Réassurance : titre et texte des 4 colonnes
- Footer : tagline

Pour ajouter d'autres éléments éditables, mettez l'attribut
`data-edit data-edit-key="ma.clef.unique"` sur l'élément HTML.

### Sécurité du mode édition

- La clé `EDIT_KEY` est **envoyée à chaque sauvegarde**. Ne la diffusez à
  personne.
- L'endpoint `/api/site-content` rejette toute requête `save` sans clé valide.
- La clé est passée dans l'URL — utilisez **HTTPS uniquement** (votre site
  Vercel l'est par défaut).
- Pour révoquer un accès : changez la valeur `EDIT_KEY` dans Vercel et
  redéployez. La nouvelle clé est immédiatement active.

### Bonnes pratiques

- Sauvegardez la valeur d'`EDIT_KEY` dans un gestionnaire de mots de passe.
- Évitez de partager une URL `?edit=...` par messagerie — préférez communiquer
  la clé verbalement ou via un canal chiffré.
- Si vous suspectez une fuite, regénérez `EDIT_KEY` immédiatement.
