-- Fotos nuevas para las camisetas de mujer (public/img/demo/camisaDama*.png).
-- camisaDama1 = blanca · camisaDama2 = negra · camisaDama3 = gris
-- La primera foto de cada lista es la portada; las demás aparecen en la galería.
-- Solo cambia las fotos si el producto todavía tiene las de ejemplo antiguas,
-- para no pisar fotos que el dueño haya subido desde el panel.
UPDATE products
   SET images = '["/img/demo/camisaDama2.png","/img/demo/camisaDama3.png","/img/demo/camisaDama1.png"]'
 WHERE name = 'Camiseta Mujer · Negra' AND images = '["/img/demo/mujer-negra.png"]';

UPDATE products
   SET images = '["/img/demo/camisaDama1.png","/img/demo/camisaDama2.png","/img/demo/camisaDama3.png"]'
 WHERE name = 'Camiseta Mujer · Blanca' AND images = '["/img/demo/mujer-blanca.png"]';
