-- ================================================================
-- PUREWERK — Schéma Supabase
-- À exécuter dans : Supabase → SQL Editor → New Query
-- ================================================================

-- Table principale : commandes + données du sticker (pour vérification)
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(8) UNIQUE NOT NULL,

  -- Configuration du sticker
  marque          VARCHAR(50),
  modele          VARCHAR(50),
  type_version    VARCHAR(50),
  moteur          VARCHAR(50),
  nom_couleur     VARCHAR(100),
  code_couleur    VARCHAR(50),
  instagram       VARCHAR(100),
  bg_color        VARCHAR(20),
  txt_mode        VARCHAR(10),
  circuit_motif   INT,
  circuit_color   VARCHAR(20),
  circuit_opacity DECIMAL(3,2),

  -- Informations client
  email           VARCHAR(255) NOT NULL,
  prenom          VARCHAR(100),
  nom             VARCHAR(100),
  telephone       VARCHAR(30),
  adresse         TEXT,
  complement      TEXT,
  ville           VARCHAR(100),
  code_postal     VARCHAR(20),
  pays            VARCHAR(50),

  -- Commande / paiement
  quantite        INT DEFAULT 1,
  unit_price_eur  DECIMAL(10,2),
  shipping_eur    DECIMAL(10,2),
  total_eur       DECIMAL(10,2),
  stripe_session_id VARCHAR(255),
  stripe_payment_id VARCHAR(255),
  statut          VARCHAR(20) DEFAULT 'pending',  -- pending | paid | shipped | cancelled

  -- Métadonnées
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ
);

-- Index pour accélérer la vérification d'authenticité
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

-- Sécurité Row Level Security : on bloque tout par défaut.
-- L'API utilise la clé "service_role" qui contourne RLS, donc OK.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Aucune policy publique = personne ne peut lire/écrire depuis le front directement.
-- Seul le backend (avec service_role key) peut accéder.

-- Vue publique limitée pour la vérification (uniquement les commandes payées,
-- et seulement les champs non-sensibles). Optionnel : tu peux interroger
-- directement la table depuis l'API en filtrant côté code.
CREATE OR REPLACE VIEW public_verify AS
SELECT
  reference,
  marque,
  modele,
  type_version,
  moteur,
  nom_couleur,
  code_couleur,
  instagram,
  bg_color,
  created_at
FROM orders
WHERE statut IN ('paid', 'shipped');

-- ================================================================
-- DONNÉE DE TEST (optionnel) — supprime ce bloc en production
-- ================================================================
-- INSERT INTO orders (reference, marque, modele, type_version, moteur,
--   nom_couleur, code_couleur, instagram, bg_color, email, total_eur, statut)
-- VALUES ('DEMO1234', 'BMW', 'M3', 'Competition', 'S58',
--   'Toro Red', 'C57', 'purewerk_demo', '#8B1C23', 'demo@purewerk.fr', 24.99, 'paid');
