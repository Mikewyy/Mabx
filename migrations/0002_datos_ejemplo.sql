-- Datos de ejemplo para arrancar. Puedes editarlos o borrarlos desde el panel /admin.

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Camisetas', 'camisetas', 1),
  ('Shorts', 'shorts', 2),
  ('Tops', 'tops', 3),
  ('Accesorios', 'accesorios', 4);

INSERT INTO products (name, description, category_id, gender, price_cents, sale_cents, sizes, images, available, featured, is_new) VALUES
  ('Camiseta Mujer · Negra',  'Tela liviana y transpirable para entrenar cómodo. Logo Mabx al pecho. Corte entallado, ideal para gimnasio y running.', 1, 'mujer',  2490, 1990, '["XS","S","M","L"]',      '["/img/demo/mujer-negra.png"]',  1, 1, 0),
  ('Camiseta Mujer · Blanca', 'Tela liviana y transpirable para entrenar cómodo. Logo Mabx al pecho. Corte entallado, ideal para gimnasio y running.', 1, 'mujer',  1990, NULL, '["XS","S","M","L"]',      '["/img/demo/mujer-blanca.png"]', 1, 1, 1),
  ('Camiseta Hombre · Negra', 'Tela liviana y transpirable para entrenar cómodo. Logo Mabx al pecho. Corte regular, ideal para gimnasio y running.', 1, 'hombre', 2590, 2190, '["XS","S","M","L","XL"]', '["/img/demo/hombre-negra.png","/img/demo/hombre-blanca.png"]', 1, 1, 0),
  ('Camiseta Hombre · Blanca','Tela liviana y transpirable para entrenar cómodo. Logo Mabx al pecho. Corte regular, ideal para gimnasio y running.', 1, 'hombre', 2190, NULL, '["S","M","L","XL"]',      '["/img/demo/hombre-blanca.png","/img/demo/hombre-negra.png"]', 1, 1, 1);

INSERT INTO promotions (title, detail, active) VALUES
  ('-20% Camisetas Mujer', 'Por tiempo limitado', 1);

INSERT INTO settings (key, value) VALUES
  ('whatsapp_number', '593991234567'),
  ('whatsapp_message', '¡Hola Mabx! Quiero pedir:
{productos}
Total: {total}'),
  ('instagram', ''),
  ('tiktok', ''),
  ('facebook', ''),
  ('shipping_info', 'Envíos a todo el Ecuador. Costo y tiempo se coordinan por WhatsApp.');
