-- Estructura de la base de datos de Mabx

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  gender        TEXT NOT NULL DEFAULT 'unisex',   -- hombre | mujer | unisex
  price_cents   INTEGER NOT NULL,                 -- precio normal en centavos (2190 = $21.90)
  sale_cents    INTEGER,                          -- precio de oferta en centavos (NULL = sin oferta)
  sizes         TEXT NOT NULL DEFAULT '[]',       -- JSON: ["S","M","L"]
  images        TEXT NOT NULL DEFAULT '[]',       -- JSON: ["/media/abc.jpg", ...]
  available     INTEGER NOT NULL DEFAULT 1,       -- 1 disponible, 0 agotado
  featured      INTEGER NOT NULL DEFAULT 0,       -- 1 = aparece en "Destacados" del inicio
  is_new        INTEGER NOT NULL DEFAULT 0,       -- 1 = etiqueta "Nuevo"
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE promotions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  title   TEXT NOT NULL,           -- ej. "-20% Camisetas Mujer"
  detail  TEXT NOT NULL DEFAULT '',-- ej. "Vence 30 nov"
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
