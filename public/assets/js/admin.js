// Utilidades del panel de administración de Mabx.
import { ICONS, esc, optimizePhoto } from '/assets/js/common.js';

export { esc, optimizePhoto };

export const AICONS = {
  products: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12l-2-1 1-2-2-2-2 1-1-2h-2l-1 2-2-1-2 2 1 2-2 1v2l2 1-1 2 2 2 2-1 1 2h2l1-2 2 1 2-2-1-2 2-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  plus: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  ban: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 6.5l11 11" stroke="currentColor" stroke-width="1.8"/></svg>',
  restore: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reviews: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 9.5h7M8.5 12.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>',
  logout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  star: (on) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
};

// Llamadas a la API del panel. Si la sesión venció, vuelve al login.
export async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['content-type'] = 'application/json'; }
  const res = await fetch(path, opts);
  if (res.status === 401) { location.href = '/admin/'; throw new Error('Sesión vencida'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error');
  return data;
}

export async function requireAdmin() {
  const { admin } = await fetch('/api/me').then((r) => r.json()).catch(() => ({ admin: false }));
  if (!admin) { location.replace('/admin/'); throw new Error('No autorizado'); }
}

export function renderSidebar(active) {
  const el = document.querySelector('[data-sidebar]');
  // En celular la lista se vuelve una barra inferior: por eso cada enlace tiene un nombre corto
  const link = (href, key, icon, label, short = label) => `<a href="${href}" class="snav"${key === active ? ' aria-current="page"' : ''}>${icon}<span class="l-long">${label}</span><span class="l-short">${short}</span></a>`;
  el.outerHTML = `
    <aside class="sidebar">
      <a href="/" class="logo" title="Ver la tienda" aria-label="Mabx, ver la tienda">${ICONS.logo(24)}<span>MABX</span></a>
      <nav class="snav-list" aria-label="Panel">
        ${link('/admin/productos', 'productos', AICONS.products, 'Productos')}
        ${link('/admin/opiniones', 'opiniones', AICONS.reviews, 'Opiniones')}
        ${link('/admin/config', 'config', AICONS.settings, 'Configuración', 'Ajustes')}
      </nav>
      <div class="side-foot">
        <a href="/" class="snav" target="_blank" rel="noopener" title="Ver la tienda (se abre en otra pestaña)">${AICONS.eye}<span>Ver tienda</span></a>
        <button type="button" class="snav" id="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${AICONS.logout}<span>Cerrar sesión</span></button>
      </div>
    </aside>`;
  // Opiniones de clientes esperando aprobación: globito en el menú
  refreshPendingBadge();
  document.getElementById('logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.href = '/admin/';
  });
}

// ---------- Fotos: se convierten a WEBP en el navegador antes de subirlas ----------
// Así una foto de celular de varios MB queda en ~100-300 KB, ocupa menos espacio
// en el almacenamiento y la tienda carga más rápido.
// Optimiza y sube una foto; devuelve la URL /media/... ya guardada.
export async function uploadPhoto(blob, name, folder = 'productos') {
  const file = await optimizePhoto(blob, name);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const { url } = await api('/api/admin/upload', { method: 'POST', form: fd });
  return url;
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { document.body.insertAdjacentHTML('beforeend', '<div class="toast" role="status" aria-live="polite"></div>'); el = document.querySelector('.toast'); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

export async function refreshPendingBadge() {
  try {
    const { reviews } = await api('/api/admin/reviews');
    const n = reviews.filter((r) => r.status === 'pendiente').length;
    const a = document.querySelector('.snav[href="/admin/opiniones"]');
    if (!a) return n;
    a.querySelector('.nbadge')?.remove();
    if (n) a.insertAdjacentHTML('beforeend', `<span class="nbadge" aria-label="${n} pendientes">${n}</span>`);
    return n;
  } catch { return 0; }
}
