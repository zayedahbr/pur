-- ================================================================
-- PureSpec — Schéma Supabase complet
-- À exécuter dans Supabase → SQL Editor → New Query
-- ================================================================

-- ===== 1. Extensions =====
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== 2. Table CUSTOMERS (comptes client) =====
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  prenom          VARCHAR(100),
  nom             VARCHAR(100),
  telephone       VARCHAR(30),
  adresse         TEXT,
  complement      TEXT,
  ville           VARCHAR(100),
  code_postal     VARCHAR(20),
  pays            VARCHAR(50) DEFAULT 'France',
  email_verified  BOOLEAN DEFAULT FALSE,
  reset_token     VARCHAR(255),
  reset_expires   TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_reset_token ON customers(reset_token) WHERE reset_token IS NOT NULL;

-- ===== 3. Table ADMIN_USERS =====
CREATE TABLE IF NOT EXISTS admin_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  nom             VARCHAR(100),
  role            VARCHAR(30) DEFAULT 'admin',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. Table ORDERS =====
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       VARCHAR(8) UNIQUE NOT NULL,
  order_number    VARCHAR(20) UNIQUE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,

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

  email           VARCHAR(255) NOT NULL,
  prenom          VARCHAR(100),
  nom             VARCHAR(100),
  telephone       VARCHAR(30),
  adresse         TEXT,
  complement      TEXT,
  ville           VARCHAR(100),
  code_postal     VARCHAR(20),
  pays            VARCHAR(50),

  quantite          INT DEFAULT 1,
  unit_price_eur    DECIMAL(10,2),
  shipping_eur      DECIMAL(10,2),
  total_eur         DECIMAL(10,2),
  stripe_session_id VARCHAR(255),
  stripe_payment_id VARCHAR(255),

  statut          VARCHAR(20) DEFAULT 'pending',

  carrier         VARCHAR(50),
  tracking_number VARCHAR(100),
  tracking_url    TEXT,
  admin_notes     TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  in_production_at TIMESTAMPTZ,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_statut ON orders(statut);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE OR REPLACE FUNCTION set_order_number() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PW-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_orders_set_number ON orders;
CREATE TRIGGER trg_orders_set_number BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- ===== 5. Table CONTACT_MESSAGES =====
CREATE TABLE IF NOT EXISTS contact_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) NOT NULL,
  nom          VARCHAR(150),
  sujet        VARCHAR(200),
  message      TEXT NOT NULL,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_ref    VARCHAR(20),
  statut       VARCHAR(20) DEFAULT 'new',
  admin_reply  TEXT,
  replied_at   TIMESTAMPTZ,
  ip           VARCHAR(45),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_statut ON contact_messages(statut);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);

-- ===== 6. Table SESSIONS =====
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       VARCHAR(255) UNIQUE NOT NULL,
  kind        VARCHAR(20) NOT NULL,
  user_id     UUID NOT NULL,
  ip          VARCHAR(45),
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(kind, user_id);

-- ===== 7. RLS (verrouillage) =====
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;

-- ===== 8. Vue publique (pour /api/verify) =====
CREATE OR REPLACE VIEW public_verify AS
SELECT
  reference, marque, modele, type_version, moteur,
  nom_couleur, code_couleur, instagram, bg_color,
  created_at, paid_at, shipped_at, delivered_at, statut
FROM orders
WHERE statut IN ('paid','in_production','shipped','delivered');

-- ===== 9. Cleanup sessions =====
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- POUR CRÉER UN ADMIN :
-- 1. Génère un hash bcrypt en local :
--      node -e "console.log(require('bcryptjs').hashSync('TonMotDePasse', 10))"
-- 2. Puis exécute (dans le SQL Editor de Supabase) :
--      INSERT INTO admin_users (email, password_hash, nom, role)
--      VALUES ('toi@exemple.fr', 'LE_HASH_GENERE', 'Ton Nom', 'superadmin');
-- ================================================================
