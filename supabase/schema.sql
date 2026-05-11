-- ================================================================
-- PureSpec — Schéma Supabase complet
-- À exécuter dans : Supabase → SQL Editor → New Query
-- ================================================================
-- IMPORTANT : Supabase Auth (auth.users) est utilisé pour les comptes
-- client. Cette table est gérée par Supabase, on s'y rattache via
-- des foreign keys.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. PROFILS CLIENT (extension de auth.users)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  prenom          VARCHAR(100),
  nom             VARCHAR(100),
  telephone       VARCHAR(30),
  adresse         TEXT,
  complement      TEXT,
  ville           VARCHAR(100),
  code_postal     VARCHAR(20),
  pays            VARCHAR(50) DEFAULT 'France',
  is_admin        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- Auto-création du profil quand un nouvel utilisateur s'inscrit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 2. COMMANDES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(10) UNIQUE NOT NULL,             -- PS + 6 chars = 8 caractères total
  order_number    VARCHAR(20) UNIQUE NOT NULL,             -- Numéro humain (PS-2026-000123)

  -- Lien optionnel vers compte client (peut être null si commande invité)
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

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

  -- Informations client (snapshot au moment de la commande)
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

  -- Statut + tracking
  statut          VARCHAR(20) DEFAULT 'pending',  -- pending | paid | in_production | shipped | delivered | cancelled
  tracking_number VARCHAR(100),
  tracking_carrier VARCHAR(50),
  admin_notes     TEXT,

  -- Métadonnées
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_statut ON orders(statut);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Séquence pour les numéros de commande lisibles
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  yr TEXT := to_char(NOW(), 'YYYY');
  seq_val INT := nextval('order_number_seq');
BEGIN
  RETURN 'PS-' || yr || '-' || lpad(seq_val::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 3. ÉVÉNEMENTS DE COMMANDE (timeline / journal)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type      VARCHAR(50) NOT NULL,  -- created | paid | in_production | shipped | delivered | cancelled | note
  message         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id, created_at);

-- ----------------------------------------------------------------
-- 4. MESSAGES DE CONTACT (formulaire contact)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   VARCHAR(20) UNIQUE NOT NULL,

  email           VARCHAR(255) NOT NULL,
  prenom          VARCHAR(100),
  nom             VARCHAR(100),
  sujet           VARCHAR(255),
  message         TEXT NOT NULL,
  reference_commande VARCHAR(20),  -- optionnel : si la question concerne une commande

  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  statut          VARCHAR(20) DEFAULT 'open',  -- open | read | replied | closed
  admin_response  TEXT,
  responded_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_statut ON contact_messages(statut);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_ticket ON contact_messages(ticket_number);

CREATE SEQUENCE IF NOT EXISTS contact_ticket_seq START 1;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
  seq_val INT := nextval('contact_ticket_seq');
BEGIN
  RETURN 'CT-' || to_char(NOW(), 'YYYY') || '-' || lpad(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
-- Pour la sécurité côté front, on bloque tout et l'API service_role
-- contourne RLS. C'est plus simple et plus sûr.
-- ================================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy : un user peut lire son propre profil et le mettre à jour
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy : un user peut lire ses propres commandes (mais pas les modifier — c'est l'API qui fait ça)
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- ================================================================
-- VUE PUBLIQUE pour la vérification du Registry (lecture anonyme)
-- ================================================================
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
  paid_at
FROM orders
WHERE statut IN ('paid', 'in_production', 'shipped', 'delivered');

-- Donne l'accès lecture anonyme sur la vue
GRANT SELECT ON public_verify TO anon, authenticated;

-- ================================================================
-- COMMENT NOMMER UN ADMIN ?
-- Après avoir créé ton compte via le site, exécute dans le SQL editor :
--   UPDATE profiles SET is_admin = TRUE WHERE email = 'ton@email.com';
-- ================================================================
