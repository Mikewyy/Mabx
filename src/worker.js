// Backend de Mabx (Cloudflare Worker).
// Las páginas de public/ se sirven solas; este archivo solo atiende:
//   /api/...   → datos del catálogo y acciones del panel de administración
//   /media/... → fotos subidas desde el panel (guardadas en R2)

const SESSION_COOKIE = 'mabx_session';
const SESSION_HOURS = 24 * 7;
const PUBLIC_SETTINGS = ['whatsapp_number', 'whatsapp_message', 'instagram', 'tiktok', 'facebook', 'shipping_info',
  'tile_mujer_image', 'tile_mujer_title', 'tile_hombre_image', 'tile_hombre_title'];
// Recuadros de colección del inicio: fotos que se pueden cambiar desde el panel (vacío = foto por defecto)
const TILE_IMAGE_KEYS = ['tile_mujer_image', 'tile_hombre_image'];
const GENDERS = ['hombre', 'mujer', 'unisex'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const REVIEW_STATUS = ['pendiente', 'publicada', 'oculta'];
const REVIEWS_PER_HOUR = 3;      // envíos de clientes por conexión y por hora
const MAX_PENDING_REVIEWS = 200; // tope de opiniones sin revisar (frena el spam masivo)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/media/')) return serveImage(url, env);
      if (url.pathname.startsWith('/api/')) return await routeApi(request, url, env);
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Error interno del servidor' }, 500);
    }
  },
};

// ---------- Rutas ----------

async function routeApi(request, url, env) {
  const method = request.method;
  const path = url.pathname.replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean); // ['api', ...]

  // Público
  if (method === 'GET' && path === '/api/catalog') return json(await getCatalog(env, false));
  if (method === 'POST' && path === '/api/login') return login(request, env);
  if (method === 'POST' && path === '/api/logout') return logout();
  if (method === 'GET' && path === '/api/reviews') return json(await publicReviews(env));
  if (method === 'POST' && path === '/api/reviews') return json(await submitReview(request, env), 201);
  if (method === 'GET' && path === '/api/me') return json({ admin: await isAdmin(request, env) });

  // Panel (requiere sesión)
  if (parts[1] === 'admin') {
    if (!(await isAdmin(request, env))) throw new HttpError(401, 'Inicia sesión para continuar');
    sameOriginOnly(request, url);
    const [, , resource, id] = parts;

    if (resource === 'catalog' && method === 'GET') return json(await getCatalog(env, true));

    if (resource === 'products') {
      if (method === 'POST' && !id) return json(await saveProduct(env, null, await request.json()), 201);
      if (method === 'PUT' && id) return json(await saveProduct(env, toId(id), await request.json()));
      if (method === 'PATCH' && id) return json(await patchProduct(env, toId(id), await request.json()));
      if (method === 'DELETE' && id) return json(await deleteRow(env, 'products', toId(id)));
    }
    if (resource === 'categories') {
      if (method === 'POST' && !id) return json(await saveCategory(env, null, await request.json()), 201);
      if (method === 'PUT' && id) return json(await saveCategory(env, toId(id), await request.json()));
      if (method === 'DELETE' && id) return json(await deleteRow(env, 'categories', toId(id)));
    }
    if (resource === 'promotions') {
      if (method === 'POST' && !id) return json(await savePromotion(env, null, await request.json()), 201);
      if (method === 'PUT' && id) return json(await savePromotion(env, toId(id), await request.json()));
      if (method === 'DELETE' && id) return json(await deleteRow(env, 'promotions', toId(id)));
    }
    if (resource === 'settings' && method === 'PUT') return json(await saveSettings(env, await request.json()));
    if (resource === 'upload' && method === 'POST') return json(await uploadImage(request, env), 201);
    if (resource === 'reviews') {
      if (method === 'GET' && !id) return json(await adminReviews(env));
      if (method === 'POST' && !id) return json(await saveReview(env, null, await request.json()), 201);
      if (method === 'PUT' && id) return json(await saveReview(env, toId(id), await request.json()));
      if (method === 'PATCH' && id) return json(await setReviewStatus(env, toId(id), await request.json()));
      if (method === 'DELETE' && id) return json(await deleteRow(env, 'reviews', toId(id)));
    }
  }

  throw new HttpError(404, 'Ruta no encontrada');
}

// ---------- Catálogo ----------

async function getCatalog(env, includeAll) {
  const [products, categories, promotions, settings] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM products ORDER BY featured DESC, created_at DESC, id DESC'),
    env.DB.prepare('SELECT * FROM categories ORDER BY sort_order, name'),
    env.DB.prepare(includeAll ? 'SELECT * FROM promotions ORDER BY id DESC' : 'SELECT * FROM promotions WHERE active = 1 ORDER BY id DESC'),
    env.DB.prepare('SELECT key, value FROM settings'),
  ]);
  const settingsObj = {};
  for (const row of settings.results) {
    if (includeAll || PUBLIC_SETTINGS.includes(row.key)) settingsObj[row.key] = row.value;
  }
  return {
    products: products.results.map(formatProduct).map((p) => (includeAll ? p : withStock(p))),
    categories: categories.results,
    promotions: promotions.results.map((p) => ({ ...p, active: !!p.active })),
    settings: settingsObj,
  };
}

// En la tienda, un producto con todas sus tallas agotadas se muestra como agotado.
// (El panel recibe los datos tal cual, para no mezclar el interruptor "Disponible" con las tallas.)
function withStock(p) {
  const hasStock = !p.sizes.length || p.sizes.some((s) => !p.sold_out_sizes.includes(s));
  return hasStock ? p : { ...p, available: false };
}

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id,
    gender: row.gender,
    price: row.price_cents / 100,
    sale_price: row.sale_cents == null ? null : row.sale_cents / 100,
    sizes: safeJson(row.sizes, []),
    sold_out_sizes: safeJson(row.sold_out_sizes, []),
    images: safeJson(row.images, []),
    available: !!row.available,
    featured: !!row.featured,
    is_new: !!row.is_new,
    created_at: row.created_at,
  };
}

async function saveProduct(env, id, body) {
  const name = str(body.name, 120);
  if (!name) throw new HttpError(400, 'El nombre es obligatorio');
  const price = money(body.price);
  if (price == null || price <= 0) throw new HttpError(400, 'El precio debe ser mayor a 0');
  let sale = body.sale_price === '' || body.sale_price == null ? null : money(body.sale_price);
  if (sale != null && (sale <= 0 || sale >= price)) throw new HttpError(400, 'El precio de oferta debe ser menor al precio normal');
  const gender = GENDERS.includes(body.gender) ? body.gender : 'unisex';
  const sizes = Array.isArray(body.sizes) ? body.sizes.map((s) => str(s, 10)).filter(Boolean).slice(0, 20) : [];
  const images = Array.isArray(body.images) ? body.images.filter(isImageUrl).slice(0, 10) : [];
  // Solo se guardan como agotadas tallas que el producto realmente tiene
  const soldOut = Array.isArray(body.sold_out_sizes) ? [...new Set(body.sold_out_sizes.map((s) => str(s, 10)))].filter((s) => sizes.includes(s)) : [];
  const categoryId = body.category_id ? toId(body.category_id) : null;

  const values = [
    name, str(body.description, 2000), categoryId, gender, price, sale,
    JSON.stringify(sizes), JSON.stringify(soldOut), JSON.stringify(images),
    body.available === false ? 0 : 1, body.featured ? 1 : 0, body.is_new ? 1 : 0,
  ];

  if (id == null) {
    const res = await env.DB.prepare(
      `INSERT INTO products (name, description, category_id, gender, price_cents, sale_cents, sizes, sold_out_sizes, images, available, featured, is_new)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(...values).first();
    return formatProduct(res);
  }
  const old = await env.DB.prepare('SELECT images FROM products WHERE id = ?').bind(id).first();
  const res = await env.DB.prepare(
    `UPDATE products SET name = ?, description = ?, category_id = ?, gender = ?, price_cents = ?, sale_cents = ?,
       sizes = ?, sold_out_sizes = ?, images = ?, available = ?, featured = ?, is_new = ?, updated_at = datetime('now')
     WHERE id = ? RETURNING *`
  ).bind(...values, id).first();
  if (!res) throw new HttpError(404, 'Producto no encontrado');
  if (old) {
    // Borra de R2 las fotos que se quitaron del producto
    const removed = safeJson(old.images, []).filter((u) => u.startsWith('/media/') && !images.includes(u)).map((u) => u.slice(7));
    if (removed.length) await env.IMAGES.delete(removed);
  }
  return formatProduct(res);
}

// Cambios rápidos desde la tabla (disponible / destacado)
async function patchProduct(env, id, body) {
  const sets = [];
  const vals = [];
  for (const key of ['available', 'featured', 'is_new']) {
    if (typeof body[key] === 'boolean') { sets.push(`${key} = ?`); vals.push(body[key] ? 1 : 0); }
  }
  if (!sets.length) throw new HttpError(400, 'Nada que actualizar');
  const res = await env.DB.prepare(
    `UPDATE products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`
  ).bind(...vals, id).first();
  if (!res) throw new HttpError(404, 'Producto no encontrado');
  return formatProduct(res);
}

async function saveCategory(env, id, body) {
  const name = str(body.name, 60);
  if (!name) throw new HttpError(400, 'El nombre es obligatorio');
  const slug = slugify(name);
  try {
    if (id == null) {
      return await env.DB.prepare(
        'INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)) RETURNING *'
      ).bind(name, slug).first();
    }
    const res = await env.DB.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ? RETURNING *').bind(name, slug, id).first();
    if (!res) throw new HttpError(404, 'Categoría no encontrada');
    return res;
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new HttpError(409, 'Ya existe una categoría con ese nombre');
    throw err;
  }
}

async function savePromotion(env, id, body) {
  const title = str(body.title, 80);
  if (!title) throw new HttpError(400, 'El título es obligatorio');
  const vals = [title, str(body.detail, 120), body.active === false ? 0 : 1];
  if (id == null) {
    return env.DB.prepare('INSERT INTO promotions (title, detail, active) VALUES (?, ?, ?) RETURNING *').bind(...vals).first();
  }
  const res = await env.DB.prepare('UPDATE promotions SET title = ?, detail = ?, active = ? WHERE id = ? RETURNING *').bind(...vals, id).first();
  if (!res) throw new HttpError(404, 'Promoción no encontrada');
  return res;
}

async function saveSettings(env, body) {
  const stmts = [];
  const replacedImages = [];
  for (const key of PUBLIC_SETTINGS) {
    if (body[key] === undefined) continue;
    let value = str(body[key], 1000);
    if (TILE_IMAGE_KEYS.includes(key)) {
      if (value && !isImageUrl(value)) throw new HttpError(400, 'Foto del recuadro no válida');
      const old = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
      if (old?.value && old.value !== value) replacedImages.push(old.value);
    }
    if (key === 'whatsapp_number') {
      value = value.replace(/\D/g, '');
      if (value.length < 8) throw new HttpError(400, 'Número de WhatsApp no válido (incluye el código de país, ej. 593...)');
    }
    stmts.push(env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value));
  }
  if (stmts.length) await env.DB.batch(stmts);
  await deleteUnusedMedia(env, replacedImages);
  return { ok: true };
}

// Borra de R2 las fotos reemplazadas, solo si ya no las usa ningún producto ni otro recuadro
async function deleteUnusedMedia(env, urls) {
  const keys = [];
  for (const u of urls) {
    if (!u.startsWith('/media/')) continue;
    const used = await env.DB.batch([
      env.DB.prepare('SELECT 1 FROM products WHERE instr(images, ?) > 0 LIMIT 1').bind(JSON.stringify(u)),
      env.DB.prepare('SELECT 1 FROM settings WHERE value = ? LIMIT 1').bind(u),
      env.DB.prepare('SELECT 1 FROM reviews WHERE image = ? LIMIT 1').bind(u),
    ]);
    if (!used.some((r) => r.results.length)) keys.push(u.slice(7));
  }
  if (keys.length) await env.IMAGES.delete(keys);
}

const DELETABLE = new Set(['products', 'categories', 'promotions', 'reviews']);
async function deleteRow(env, table, id) {
  if (!DELETABLE.has(table)) throw new HttpError(400, 'Tabla no válida');
  if (table === 'products') {
    // Borra también las fotos subidas a R2 de ese producto
    const row = await env.DB.prepare('SELECT images FROM products WHERE id = ?').bind(id).first();
    const keys = safeJson(row?.images, []).filter((u) => u.startsWith('/media/')).map((u) => u.slice(7));
    if (keys.length) await env.IMAGES.delete(keys);
  }
  if (table === 'reviews') {
    const row = await env.DB.prepare('SELECT image FROM reviews WHERE id = ?').bind(id).first();
    if (row?.image?.startsWith('/media/')) await env.IMAGES.delete(row.image.slice(7));
  }
  if (table === 'categories') {
    await env.DB.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').bind(id).run();
  }
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return { ok: true };
}

// ---------- Imágenes (R2) ----------

async function uploadImage(request, env) {
  const form = await request.formData();
  const folder = form.get('folder') === 'opiniones' ? 'opiniones' : 'productos';
  return { url: await storeImage(env, form.get('file'), folder) };
}

// Guarda una imagen en R2 dentro de la carpeta indicada y devuelve su dirección /media/...
async function storeImage(env, file, folder) {
  if (!file || typeof file === 'string') throw new HttpError(400, 'No se recibió ninguna imagen');
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'La imagen pesa más de 5 MB');
  // El tipo que manda el navegador no es fiable (a veces llega vacío, "image/jpg" u
  // "application/octet-stream"), así que se identifica la imagen por sus primeros bytes.
  const bytes = await file.arrayBuffer();
  const type = sniffImageType(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
  if (!type) throw new HttpError(400, `"${file.name || 'archivo'}" no es una imagen válida (usa JPG, PNG o WEBP)`);
  const key = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${IMAGE_TYPES[type]}`;
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type } });
  return `/media/${key}`;
}

// ---------- Opiniones ----------

const formatReview = (r, admin = false) => ({
  id: r.id, name: r.name, message: r.message, rating: r.rating, image: r.image, created_at: r.created_at,
  ...(admin ? { status: r.status, source: r.source } : {}),
});

async function publicReviews(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM reviews WHERE status = 'publicada' ORDER BY created_at DESC, id DESC LIMIT 60"
  ).all();
  return { reviews: results.map((r) => formatReview(r)) };
}

async function adminReviews(env) {
  const { results } = await env.DB.prepare('SELECT * FROM reviews ORDER BY created_at DESC, id DESC').all();
  return { reviews: results.map((r) => formatReview(r, true)) };
}

function reviewFields(body) {
  const name = str(body.name, 60);
  const message = str(body.message, 600);
  const rating = Math.round(Number(body.rating));
  if (name.length < 2) throw new HttpError(400, 'Escribe tu nombre');
  if (message.length < 10) throw new HttpError(400, 'Cuéntanos un poco más (mínimo 10 letras)');
  if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Elige de 1 a 5 estrellas');
  return { name, message, rating };
}

// Envío público desde /opiniones: queda pendiente hasta que el admin lo apruebe
async function submitReview(request, env) {
  const form = await request.formData();
  // Trampa para robots: el campo "website" está oculto para las personas, y nadie
  // llena el formulario en menos de 3 segundos. Se responde "ok" para no dar pistas.
  const started = Number(form.get('t')) || 0;
  if (str(form.get('website'), 200) || (started && Date.now() - started < 3000)) return { ok: true };
  const { name, message, rating } = reviewFields({ name: form.get('name'), message: form.get('message'), rating: form.get('rating') });
  if (!['on', 'true', '1'].includes(String(form.get('consent')))) throw new HttpError(400, 'Necesitamos tu autorización para publicar la opinión');

  const ipHash = await sign(request.headers.get('cf-connecting-ip') || 'local', env.SESSION_SECRET || 'mabx');
  const [recent, pending] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')").bind(ipHash),
    env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE status = 'pendiente'"),
  ]);
  if (recent.results[0].n >= REVIEWS_PER_HOUR) throw new HttpError(429, 'Ya recibimos tus opiniones. Intenta de nuevo más tarde.');
  if (pending.results[0].n >= MAX_PENDING_REVIEWS) throw new HttpError(429, 'Por ahora no podemos recibir más opiniones. Intenta más tarde.');

  const photo = form.get('photo');
  const image = photo && typeof photo !== 'string' && photo.size ? await storeImage(env, photo, 'opiniones') : '';
  await env.DB.prepare("INSERT INTO reviews (name, message, rating, image, status, source, ip_hash) VALUES (?, ?, ?, ?, 'pendiente', 'cliente', ?)")
    .bind(name, message, rating, image, ipHash).run();
  return { ok: true };
}

// Crear (nace publicada) o editar desde el panel
async function saveReview(env, id, body) {
  const { name, message, rating } = reviewFields(body);
  const image = body.image ? String(body.image) : '';
  if (image && !isImageUrl(image)) throw new HttpError(400, 'Foto no válida');
  const status = REVIEW_STATUS.includes(body.status) ? body.status : 'publicada';
  if (id == null) {
    const row = await env.DB.prepare("INSERT INTO reviews (name, message, rating, image, status, source) VALUES (?, ?, ?, ?, ?, 'admin') RETURNING *")
      .bind(name, message, rating, image, status).first();
    return formatReview(row, true);
  }
  const old = await env.DB.prepare('SELECT image FROM reviews WHERE id = ?').bind(id).first();
  if (!old) throw new HttpError(404, 'Opinión no encontrada');
  const row = await env.DB.prepare('UPDATE reviews SET name = ?, message = ?, rating = ?, image = ?, status = ? WHERE id = ? RETURNING *')
    .bind(name, message, rating, image, status, id).first();
  if (old.image && old.image !== image) await deleteUnusedMedia(env, [old.image]);
  return formatReview(row, true);
}

async function setReviewStatus(env, id, body) {
  if (!REVIEW_STATUS.includes(body.status)) throw new HttpError(400, 'Estado no válido');
  const row = await env.DB.prepare('UPDATE reviews SET status = ? WHERE id = ? RETURNING *').bind(body.status, id).first();
  if (!row) throw new HttpError(404, 'Opinión no encontrada');
  return formatReview(row, true);
}

function sniffImageType(b) {
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  return null;
}

async function serveImage(url, env) {
  const key = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!key || key.includes('..')) return new Response('No encontrado', { status: 404 });
  const obj = await env.IMAGES.get(key);
  if (!obj) return new Response('No encontrado', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}

// ---------- Sesión del administrador ----------

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    throw new HttpError(500, 'Falta configurar ADMIN_PASSWORD y SESSION_SECRET (ver README)');
  }
  const body = await request.json().catch(() => ({}));
  const emailOk = safeEqual(String(body.email || '').trim().toLowerCase(), String(env.ADMIN_EMAIL || '').trim().toLowerCase());
  const passOk = safeEqual(String(body.password || ''), env.ADMIN_PASSWORD);
  if (!emailOk || !passOk) {
    await new Promise((r) => setTimeout(r, 600)); // frena intentos repetidos
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  const hours = body.remember ? SESSION_HOURS : 12;
  const exp = Date.now() + hours * 3600 * 1000;
  const token = `${exp}.${await sign(String(exp), env.SESSION_SECRET)}`;
  return json({ ok: true }, 200, {
    'set-cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${hours * 3600}`,
  });
}

function logout() {
  return json({ ok: true }, 200, {
    'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}

async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(exp, env.SESSION_SECRET));
}

function sameOriginOnly(request, url) {
  if (request.method === 'GET') return;
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) throw new HttpError(403, 'Origen no permitido');
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

// ---------- Utilidades ----------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function str(v, max) { return String(v ?? '').trim().slice(0, max); }
function toId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Id no válido');
  return n;
}
function money(v) {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function safeJson(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }
function isImageUrl(u) { return typeof u === 'string' && /^\/(media|img)\/[\w\-./]+$/.test(u) && !u.includes('..'); }
function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categoria';
}
