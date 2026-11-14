-- Tallas agotadas por producto: el dueño puede marcar, por ejemplo, solo la "M" como agotada.
-- JSON con un subconjunto de "sizes": ["M"]. Si todas las tallas están agotadas, la tienda
-- muestra el producto como agotado.
ALTER TABLE products ADD COLUMN sold_out_sizes TEXT NOT NULL DEFAULT '[]';
