// Utilidades compartidas por todas las páginas públicas de Mabx.

// Emblema de la brújula Mabx: aro partido en cuatro arcos + estrella de cuatro puntas
// con el eje vertical largo (igual que el logo de las camisetas).
export const EMBLEM_PATHS = {
  arcs: ['M37.7 21.1A14 14 0 0 0 26.9 10.3', 'M21.1 10.3A14 14 0 0 0 10.3 21.1', 'M10.3 26.9A14 14 0 0 0 21.1 37.7', 'M26.9 37.7A14 14 0 0 0 37.7 26.9'],
  star: 'M24 1.5 26.1 21.9 34.5 24 26.1 26.1 24 46.5 21.9 26.1 13.5 24 21.9 21.9Z',
};
export function emblem(size = 26, cls = '') {
  return `<svg${cls ? ` class="${cls}"` : ''} width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">${EMBLEM_PATHS.arcs.map((d) => `<path class="em-arc" d="${d}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" pathLength="1"/>`).join('')}<path class="em-star" d="${EMBLEM_PATHS.star}" fill="currentColor"/></svg>`;
}

export const ICONS = {
  logo: (size = 26) => emblem(size),
  arrow: (size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: (size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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
// Talla agotada (el dueño la marca en el panel) o producto completo agotado
export const sizeOut = (p, s) => !p.available || (p.sold_out_sizes || []).includes(s);
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

let lastCount = null;
function updateCartBadge() {
  const n = cart.count();
  document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n; });
  // Pequeño "salto" del botón del carrito cuando se agrega algo
  if (lastCount != null && n > lastCount) {
    document.querySelectorAll('.cart-btn').forEach((b) => {
      b.classList.remove('bump');
      void b.offsetWidth; // reinicia la animación si se agrega varias veces seguidas
      b.classList.add('bump');
    });
  }
  lastCount = n;
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
// reveal: aparece con animación al hacer scroll (ver motion.js). Desactívalo en vistas que se
// repintan a cada rato, como la vista previa del panel.
// Toda la tarjeta es clicable: el enlace del título se estira sobre ella (ver .card h3 a::after).
export function productCard(p, { compact = false, cta = true, reveal = true } = {}) {
  const tags = [];
  if (!p.available) tags.push('<span class="tag out">Agotado</span>');
  if (!compact && p.sale_price != null) tags.push(`<span class="tag">-${discountPct(p)}%</span>`);
  if (!compact && p.is_new) tags.push('<span class="tag alt">Nuevo</span>');
  const href = `/producto?id=${p.id}`;
  return `
    <article class="card${p.available ? '' : ' soldout'}${reveal ? ' reveal' : ''}">
      <div class="pimg">
        <img src="${esc(productImg(p))}" alt="" loading="lazy">
        ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
      </div>
      <div class="body">
        <h3><a href="${href}">${esc(p.name)}</a></h3>
        <div class="pline">
          <span class="price">${money(finalPrice(p))}</span>${p.sale_price != null ? `<span class="old">${money(p.price)}</span>` : ''}
          ${cta ? `<span class="go" aria-hidden="true">${ICONS.arrow(16)}</span>` : ''}
        </div>
      </div>
    </article>`;
}

// ---------- Encabezado y pie de página ----------
export function renderChrome(active) {
  document.body.dataset.page = active;
  const header = document.querySelector('[data-header]');
  // Enlace "Saltar al contenido": lo primero que alcanza el teclado
  const main = document.querySelector('main');
  if (header && main) {
    main.id ||= 'contenido';
    main.tabIndex = -1;
    header.insertAdjacentHTML('beforebegin', `<a class="skip-link" href="#${main.id}">Saltar al contenido</a>`);
  }
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
          <a href="/carrito" class="cart-btn" aria-label="Ver carrito">${ICONS.cart()}<span class="cart-count" data-cart-count>0</span></a>
        </div>
      </header>`;
    // El encabezado se vuelve sólido apenas la página baja un poco
    const siteHeader = document.querySelector('.site-header');
    const onScroll = () => siteHeader.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const btn = document.querySelector('.menu-btn');
    const nav = document.getElementById('main-nav');
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      btn.innerHTML = open ? ICONS.close : ICONS.menu;
    });
    const closeMenu = () => { nav.classList.remove('open'); btn.innerHTML = ICONS.menu; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Abrir menú'); };
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
    // Escape cierra el menú del celular y devuelve el foco al botón
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); btn.focus(); } });
  }

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer" id="contacto">
        <div class="wrap cols">
          <div class="reveal">
            <div class="logo">${ICONS.logo(26)}<span>MABX</span></div>
            <p class="foot-claim">Nacidos para superarnos. Ropa deportiva desde Portoviejo, Ecuador.</p>
          </div>
          <div class="reveal">
            <h2>Tienda</h2>
            <div class="links"><a href="/catalogo">Catálogo</a><a href="/catalogo?ofertas=1">Ofertas</a><a href="/carrito">Carrito</a></div>
          </div>
          <div class="reveal">
            <h2>Contacto</h2>
            <div class="links" data-contact>
              <a class="btn btn-wa btn-sm" data-wa-link href="#" target="_blank" rel="noopener">${ICONS.whatsapp()} Escríbenos por WhatsApp</a>
            </div>
          </div>
        </div>
        <div class="foot-mark" aria-hidden="true"><span>MABX</span></div>
        <div class="copy"><div class="wrap"><span>© ${new Date().getFullYear()} Mabx</span><span>Nacidos para superarnos</span></div></div>
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
