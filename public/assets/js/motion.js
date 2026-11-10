// Mabx · animaciones al hacer scroll (compartido por todas las páginas).
//
// Uso: pon la clase "reveal" a cualquier elemento y aparecerá suavemente al entrar en pantalla.
//      "reveal reveal-fade" hace solo un fundido, sin desplazamiento (panel de administración).
// Los elementos que entran a la vez (una fila de tarjetas, el hero) aparecen en cascada.
// También funciona con contenido que se pinta después (tarjetas cargadas desde la API).
//
// Este archivo se carga en el <head> SIN "defer" para activar la clase "motion" antes del
// primer pintado. Si el navegador no soporta IntersectionObserver, si el usuario pidió
// "reducir movimiento" o si algo falla, la clase no se pone y todo se ve normal.
(function () {
  var root = document.documentElement;
  var STEP = 0.08;     // segundos entre elementos de una misma cascada
  var MAX_STEPS = 6;   // la cascada nunca tarda más de ~0.5s en completarse

  try {
    if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.classList.add('motion');
  } catch (e) { return; }

  function showAll() {
    root.classList.remove('motion');
  }

  // Red de seguridad: si el JS de abajo no llega a arrancar, nada queda oculto.
  var failsafe = setTimeout(showAll, 4000);

  function start() {
    try {
      var io = new IntersectionObserver(function (entries) {
        var n = 0;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          io.unobserve(el); // la animación ocurre una sola vez
          if (!el.style.getPropertyValue('--d')) {
            el.style.setProperty('--d', Math.min(n, MAX_STEPS) * STEP + 's');
          }
          n++;
          el.classList.add('visible');
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

      var watch = function (node) {
        if (node.nodeType !== 1) return;
        if (node.classList.contains('reveal') && !node.classList.contains('visible')) io.observe(node);
        var inner = node.querySelectorAll('.reveal:not(.visible)');
        for (var i = 0; i < inner.length; i++) io.observe(inner[i]);
      };

      watch(document.body);
      // Contenido que se agrega después (tarjetas, carrito, tablas del panel…)
      new MutationObserver(function (records) {
        records.forEach(function (r) { r.addedNodes.forEach(watch); });
      }).observe(document.body, { childList: true, subtree: true });

      clearTimeout(failsafe);
    } catch (e) {
      showAll();
    }
  }

  // "interactive" llega apenas termina de leerse el HTML (antes que los scripts de cada página)
  if (document.readyState === 'loading') {
    document.addEventListener('readystatechange', function once() {
      document.removeEventListener('readystatechange', once);
      start();
    });
  } else start();
})();
