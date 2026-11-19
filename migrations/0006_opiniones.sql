-- Opiniones de clientes. Las que envían los clientes desde /opiniones llegan como
-- "pendiente" y solo se muestran cuando el admin las aprueba ("publicada").
-- Las que crea el dueño desde el panel nacen publicadas.
CREATE TABLE reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  message    TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,          -- 1 a 5 estrellas
  image      TEXT NOT NULL DEFAULT '',            -- "/media/opiniones/..." o vacío
  status     TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | publicada | oculta
  source     TEXT NOT NULL DEFAULT 'cliente',     -- cliente | admin
  ip_hash    TEXT NOT NULL DEFAULT '',            -- para limitar envíos repetidos (no guarda la IP)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reviews_status ON reviews(status, created_at);
