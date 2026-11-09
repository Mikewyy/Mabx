// Utilidades compartidas por todas las páginas públicas de Mabx.

export const ICONS = {
  logo: (size = 26) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="2.6"/><line x1="24" y1="2" x2="24" y2="13" stroke="currentColor" stroke-width="2.6"/><line x1="24" y1="35" x2="24" y2="46" stroke="currentColor" stroke-width="2.6"/><line x1="2" y1="24" x2="13" y2="24" stroke="currentColor" stroke-width="2.6"/><line x1="35" y1="24" x2="46" y2="24" stroke="currentColor" stroke-width="2.6"/><circle cx="24" cy="24" r="3.2" fill="currentColor"/></svg>`,
  cart: (size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.4 12.4a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L21 8H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/></svg>`,
  menu: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  close: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  whatsapp: (size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.3-.7s-3.8-3.4-3.9-3.6c-.1-.2-1-1.3-1-2.4s.6-1.7.8-1.9c.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6s.7 1.1 1.4 1.7c.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z"/></svg>`,
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => `$${Number(n).toFixed(2)}`;
export const finalPrice = (p) => (p.sale_price != null ? p.sale_price : p.price);
export const discountPct = (p) => (p.sale_price != null ? Math.round((1 - p.sale_price / p.price) * 100) : 0);
export const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#1C1C1C"/></svg>');
export const productImg = (p, i = 0) => p.images[i] || p.images[0] || PLACEHOLDER_IMG;

// ---------- Datos del catálogo (una sola llamada por página) ----------
let catalogPromise;
export function getCatalog() {
  catalogPromise ??= fetch('/api/catalog').then((r) => {
    if (!r.ok) throw new Error('No se pudo cargar el catálogo');
    return r.json();
  });
  return catalogPromise;
}

// ---------- Carrito (se guarda en el navegador del cliente) ----------
const CART_KEY = 'mabx_cart_v1';
export const cart = {
  read() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  },
  write(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* modo privado */ }
    updateCartBadge();
  },
  add(id, size, qty) {
    const items = cart.read();
    const found = items.find((i) => i.id === id && i.size === size);
    if (found) found.qty = Math.min(found.qty + qty, 99);
    else items.push({ id, size, qty });
    cart.write(items);
  },
  setQty(id, size, qty) {
    const items = cart.read().map((i) => (i.id === id && i.size === size ? { ...i, qty } : i)).filter((i) => i.qty > 0);
    cart.write(items);
  },
  remove(id, size) { cart.write(cart.read().filter((i) => !(i.id === id && i.size === size))); },
  count() { return cart.read().reduce((n, i) => n + i.qty, 0); },
};

function updateCartBadge() {
  document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = cart.count(); });
}

// ---------- Mensaje de WhatsApp ----------
export function buildOrderMessage(lines, total, template) {
  const productos = lines.map((l) => `• ${l.product.name} (Talla ${l.size}) x${l.qty} — ${money(finalPrice(l.product) * l.qty)}`).join('\n');
  const base = template && template.trim() ? template : '¡Hola Mabx! Quiero pedir:\n{productos}\nTotal: {total}';
  let msg = base.replaceAll('{productos}', productos).replaceAll('{total}', money(total));
  if (!base.includes('{productos}')) msg += `\n${productos}`;
  if (!base.includes('{total}')) msg += `\nTotal: ${money(total)}`;
  return msg;
}
export const whatsappUrl = (number, text = '') => `https://wa.me/${String(number || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

// ---------- Tarjeta de producto ----------
export function productCard(p, { compact = false, cta = true } = {}) {
  const tags = [];
  if (p.sale_price != null) tags.push(`<span class="tag">-${discountPct(p)}%</span>`);
  if (p.is_new) tags.push('<span class="tag alt">Nuevo</span>');
  const href = `/producto?id=${p.id}`;
  return `
    <article class="card${p.available ? '' : ' soldout'}">
      <a class="pimg" href="${href}" tabindex="-1" aria-hidden="true">
        <img src="${esc(productImg(p))}" alt="" loading="lazy">
        ${p.available ? '' : '<span class="soldout-tag">Agotado</span>'}
      </a>
      <div class="body">
        ${compact ? '' : `<div class="tags">${tags.join('')}</div>`}
        <h3><a href="${href}">${esc(p.name)}</a></h3>
        <div><span class="price"${p.available ? '' : ' style="color:var(--mut)"'}>${money(finalPrice(p))}</span>${p.sale_price != null ? `<span class="old">${money(p.price)}</span>` : ''}</div>
        ${cta ? `<a href="${href}" class="btn btn-gh card-cta">Ver producto</a>` : ''}
      </div>
    </article>`;
}

// ---------- Encabezado y pie de página ----------
export function renderChrome(active) {
  const header = document.querySelector('[data-header]');
  if (header) {
    const link = (href, label, key) => `<a class="navlink" href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`;
    header.outerHTML = `
      <header class="site-header">
        <div class="wrap bar">
          <button class="menu-btn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="main-nav">${ICONS.menu}</button>
          <a href="/" class="logo" aria-label="Mabx, ir al inicio">${ICONS.logo()}<span>MABX</span></a>
          <nav class="main-nav" id="main-nav" aria-label="Principal">
            ${link('/', 'Inicio', 'inicio')}
            ${link('/catalogo', 'Catálogo', 'catalogo')}
            ${link('/catalogo?ofertas=1', 'Ofertas', 'ofertas')}
            ${link('#contacto', 'Contacto', 'contacto')}
          </nav>
          <a href="/carrito" class="btn btn-gh cart-btn" aria-label="Ver carrito">${ICONS.cart()}<span class="cart-count" data-cart-count>0</span></a>
        </div>
      </header>`;
    const btn = document.querySelector('.menu-btn');
    const nav = document.getElementById('main-nav');
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      btn.innerHTML = open ? ICONS.close : ICONS.menu;
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) { nav.classList.remove('open'); btn.innerHTML = ICONS.menu; btn.setAttribute('aria-expanded', 'false'); } });
  }

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer" id="contacto">
        <div class="wrap cols">
          <div>
            <div class="logo" style="margin-bottom:16px">${ICONS.logo(24)}<span style="font-size:24px">MABX</span></div>
            <p class="muted" style="font-size:14px;line-height:1.6;max-width:280px;margin:0">Nacidos para superarnos. Ropa deportiva desde Portoviejo, Ecuador.</p>
          </div>
          <div>
            <h3>Tienda</h3>
            <div class="links"><a href="/catalogo">Catálogo</a><a href="/catalogo?ofertas=1">Ofertas</a><a href="/carrito">Carrito</a></div>
          </div>
          <div>
            <h3>Contacto</h3>
            <div class="links" data-contact>
              <a class="btn btn-ac btn-sm" data-wa-link href="#" target="_blank" rel="noopener" style="width:fit-content;color:#0A0A0A">${ICONS.whatsapp()} WhatsApp</a>
            </div>
          </div>
        </div>
        <div class="copy"><div class="wrap">© ${new Date().getFullYear()} Mabx · Nacidos para superarnos</div></div>
      </footer>`;
    getCatalog().then(({ settings: s }) => {
      document.querySelectorAll('[data-wa-link]').forEach((a) => { a.href = whatsappUrl(s.whatsapp_number, '¡Hola Mabx! Tengo una consulta.'); });
      const box = document.querySelector('[data-contact]');
      const socials = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['facebook', 'Facebook']].filter(([k]) => s[k]);
      if (socials.length) box.insertAdjacentHTML('beforeend', `<span>${socials.map(([k, label]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener">${label}</a>`).join(' · ')}</span>`);
      if (s.shipping_info) box.insertAdjacentHTML('beforeend', `<span>${esc(s.shipping_info)}</span>`);
    }).catch(() => {});
  }

  if (!document.querySelector('.toast')) document.body.insertAdjacentHTML('beforeend', '<div class="toast" role="status" aria-live="polite"></div>');
  updateCartBadge();
  window.addEventListener('storage', (e) => { if (e.key === CART_KEY) updateCartBadge(); });
}

let toastTimer;
export function toast(html) {
  const el = document.querySelector('.toast');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

export function errorBox(target, msg = 'No pudimos cargar los productos. Revisa tu conexión e intenta de nuevo.') {
  target.innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(msg)}</div>`;
}
