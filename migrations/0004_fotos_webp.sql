-- Las fotos de ejemplo (public/img/demo) pasaron de PNG a WEBP: más livianas, misma calidad.
-- Cambia las direcciones guardadas en los productos. Las fotos subidas desde el panel
-- (/media/...) no se tocan aquí: se convierten con el botón "Optimizar fotos" del panel.
UPDATE products
   SET images = REPLACE(images, '.png"', '.webp"'),
       updated_at = datetime('now')
 WHERE images LIKE '%/img/demo/%.png"%';
