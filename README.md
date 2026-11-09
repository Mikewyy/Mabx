# Mabx · Sitio web

Catálogo de ropa deportiva con carrito y pedidos por WhatsApp, más un panel privado (`/admin`) para que el dueño gestione productos, ofertas, categorías y el número de WhatsApp.

Todo funciona dentro de **Cloudflare**, en su plan gratuito:

| Pieza | Servicio de Cloudflare | Para qué sirve |
|---|---|---|
| Páginas (HTML, CSS, JS, imágenes) | **Workers – Static Assets** | Lo que ve el cliente y el panel |
| Backend / API (`src/worker.js`) | **Workers** | Login del dueño, guardar productos, subir fotos |
| Base de datos | **D1** (SQLite) | Productos, categorías, promociones y ajustes |
| Fotos subidas desde el panel | **R2** | Almacena las imágenes de los productos |

## Estructura

```
public/             → páginas del sitio
  index.html          Inicio
  catalogo.html       Catálogo con filtros  (/catalogo, /catalogo?ofertas=1)
  producto.html       Ficha de producto     (/producto?id=1)
  carrito.html        Carrito + "Pedir por WhatsApp"
  admin/              Panel del dueño (login, productos, editar, configuración)
  assets/             Estilos y JavaScript
src/worker.js       → API y login
migrations/         → estructura de la base de datos + datos de ejemplo
wrangler.jsonc      → configuración de Cloudflare
```

---

## 1. Probar en tu computadora

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install                 # instala la herramienta de Cloudflare (wrangler)
cp .dev.vars.example .dev.vars   # clave del panel para pruebas locales (ya está creado)
npm run db:local            # crea la base de datos local con productos de ejemplo
npm run dev                 # abre http://localhost:8787
```

- Tienda: http://localhost:8787
- Panel: http://localhost:8787/admin — correo `admin@mabx.com`, clave la de `.dev.vars` (`cambia-esta-clave`).

---

## 2. Publicar en Cloudflare (paso a paso)

### a) Crear la cuenta e iniciar sesión
1. Crea una cuenta gratis en https://dash.cloudflare.com/sign-up
2. En la terminal, dentro de esta carpeta:
   ```bash
   npx wrangler login
   ```
   Se abre el navegador; acepta el permiso.

### b) Crear la base de datos (D1)
```bash
npx wrangler d1 create mabx-db
```
Te mostrará un bloque con `"database_id": "xxxxxxxx-..."`. Copia ese id y pégalo en `wrangler.jsonc`, reemplazando `00000000-0000-0000-0000-000000000000`.

Luego crea las tablas y los productos de ejemplo en la base de datos real:
```bash
npm run db:remote
```

### c) Activar el almacenamiento de fotos (R2)
1. En el panel de Cloudflare entra a **R2 Object Storage** y pulsa **Activar / Purchase R2**. El plan gratuito incluye 10 GB, pero Cloudflare pide registrar una tarjeta (no cobra mientras no superes el límite).
2. Crea el bucket:
   ```bash
   npx wrangler r2 bucket create mabx-imagenes
   ```

### d) Definir el usuario y la contraseña del panel
- Cambia el correo en `wrangler.jsonc` → `"ADMIN_EMAIL": "tu-correo@..."`.
- Guarda la contraseña y una clave secreta como *secrets* (nunca quedan escritos en el código):
  ```bash
  npx wrangler secret put ADMIN_PASSWORD
  # escribe una contraseña fuerte y pulsa Enter

  npx wrangler secret put SESSION_SECRET
  # pega una cadena aleatoria larga; puedes generarla con:  openssl rand -base64 32
  ```
  Si te pregunta si quieres crear el Worker "mabx", responde que sí.

### e) Publicar
```bash
npm run deploy
```
Al terminar verás la dirección pública, algo como `https://mabx.TU-USUARIO.workers.dev`. ¡Ya está en línea!

### f) Configurar la tienda
Entra a `https://.../admin`, inicia sesión y:
1. En **Configuración** pon el número real de WhatsApp (con 593, sin el 0) y tus redes sociales.
2. En **Productos** edita o borra los de ejemplo y sube tus fotos reales.

### g) (Opcional) Usar tu propio dominio, ej. `mabx.ec` o `tiendamabx.com`
1. Compra el dominio (en Cloudflare: **Domain Registration**, o en otro proveedor y luego lo agregas a Cloudflare).
2. En el panel de Cloudflare: **Workers & Pages → mabx → Settings → Domains & Routes → Add → Custom domain** y escribe tu dominio.

### Actualizar el sitio después de cambios en el código
```bash
npm run deploy
```
(Los productos y fotos no se pierden: viven en D1 y R2, no en el código.)

---

## 3. La base de datos, explicada

Sí hace falta una base de datos: es lo que permite que el dueño cambie productos y precios desde el panel sin tocar código. Usamos **Cloudflare D1**, que es SQLite en la nube (gratis hasta 5 GB, de sobra para un catálogo).

Tiene 4 tablas (ver `migrations/0001_inicial.sql`):

- **products** – cada prenda: nombre, descripción, categoría, género, precio, precio de oferta, tallas, fotos, si está disponible/agotada, si es destacada o nueva. Los precios se guardan en centavos (2190 = $21.90) para evitar errores de redondeo.
- **categories** – Camisetas, Shorts, Tops…
- **promotions** – avisos de promoción que se muestran en el banner del inicio (ej. "-20% Camisetas Mujer").
- **settings** – número de WhatsApp, mensaje base del pedido, redes sociales y texto de envíos.

Las **fotos** no van en la base de datos: se guardan en **R2** y la base solo guarda su dirección (`/media/productos/...`).

El **carrito** del cliente no usa base de datos: se guarda en su propio navegador, así que si vuelve más tarde sigue ahí. Los **pedidos** tampoco se guardan: se envían por WhatsApp y se cierran allí.

Para mirar la base de datos directamente:
```bash
npx wrangler d1 execute mabx-db --remote --command "SELECT id, name, price_cents, available FROM products"
```

**Copia de seguridad** (recomendado de vez en cuando):
```bash
npx wrangler d1 export mabx-db --remote --output respaldo.sql
```
D1 además guarda automáticamente un historial para restaurar la base a un momento anterior (*Time Travel*: 7 días en el plan gratis, 30 en el de pago).

---

## Preguntas frecuentes

- **¿Cuánto cuesta?** Con el tráfico de una tienda pequeña, $0. El plan gratis de Workers permite 100 000 visitas/peticiones al día.
- **Olvidé la contraseña del panel:** vuelve a ejecutar `npx wrangler secret put ADMIN_PASSWORD`.
- **Cerrar todas las sesiones abiertas:** cambia `SESSION_SECRET` con `npx wrangler secret put SESSION_SECRET`.
- **¿Puedo poner "envío gratis" o costos de envío?** Por ahora el envío aparece como "A coordinar" y el texto de envíos se edita en Configuración.
