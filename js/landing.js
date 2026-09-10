/* ELEVAS · elevas-fitness.com */
(function () {
  'use strict';

  var GA_ID = 'G-X6QVLETPYE';
  var COOKIE_KEY = 'elevas_cookie_consent';
  var TRIAL_KEY = 'elevas_trial_popup';
  var TRIAL_DELAY = 6000;

  function leer(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) {}
  }

  /* Anillo del ciclo: el punto recorre las cuatro fases y el centro las nombra.
     La forma es orgánica: el radio ondula con el ángulo, igual que los trazos del SVG. */
  (function () {
    var dot = document.getElementById('orbitDot');
    var label = document.getElementById('ringLabel');
    var sub = document.getElementById('ringSub');
    if (!dot || !label || !sub) return;
    var cx = 100, cy = 100;
    function radio(t) {
      return 82 + 6 * Math.sin(3 * t + 0.6) + 4 * Math.sin(5 * t + 2.1) + 2 * Math.sin(7 * t + 1.0);
    }
    var fases = [
      { n: 'Fase menstrual', c: '#FF5470', t: 'Bajamos la intensidad. Misma rutina, cero presión.' },
      { n: 'Folicular y ovulación', c: '#7DE0A6', t: 'Subimos carga y vamos a por tus mejores marcas.' },
      { n: 'Lútea temprana', c: '#8FA7FF', t: 'Sigues empujando. Mantienes lo ganado sin retroceder.' },
      { n: 'Lútea tardía', c: '#FFD166', t: 'Semana suave antes de la regla. Técnica y cargas cómodas.' }
    ];
    var start = null, dur = 16000, cur = -1;
    var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    function pinta(f) {
      label.textContent = f.n;
      label.style.color = f.c;
      sub.textContent = f.t;
    }
    function frame(ts) {
      if (start === null) start = ts;
      var p = ((ts - start) % dur) / dur;
      var ang = p * 2 * Math.PI;
      var r = radio(ang);
      dot.setAttribute('cx', (cx + r * Math.sin(ang)).toFixed(2));
      dot.setAttribute('cy', (cy - r * Math.cos(ang)).toFixed(2));
      var idx = Math.min(3, Math.floor(p * 4));
      if (idx !== cur) { cur = idx; pinta(fases[idx]); }
      requestAnimationFrame(frame);
    }
    if (reduce) pinta(fases[0]);
    else requestAnimationFrame(frame);
  })();

  /* Cabecera: borde inferior al hacer scroll */
  (function () {
    var h = document.querySelector('header');
    if (!h) return;
    var onScroll = function () { h.classList.toggle('scrolled', window.scrollY > 10); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* Aparición progresiva de los bloques */
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.14 });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* Preguntas frecuentes */
  (function () {
    document.querySelectorAll('.faq-q').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = b.parentElement;
        var abierto = it.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function (o) { o.classList.remove('open'); });
        if (!abierto) it.classList.add('open');
      });
    });
  })();

  /* Prueba gratuita: una sola vez por visitante, y nunca encima del aviso de cookies */
  var popup = document.getElementById('trial-popup');
  var trialTimer = null;

  function abrirPrueba() {
    if (!popup || leer(TRIAL_KEY) === 'seen') return;
    guardar(TRIAL_KEY, 'seen');
    popup.hidden = false;
    var cerrar = popup.querySelector('.modal-close');
    if (cerrar) cerrar.focus();
  }
  function cerrarPrueba() {
    if (popup) popup.hidden = true;
  }
  function programarPrueba() {
    if (!popup || leer(TRIAL_KEY) === 'seen') return;
    clearTimeout(trialTimer);
    trialTimer = setTimeout(abrirPrueba, TRIAL_DELAY);
  }

  if (popup) {
    popup.querySelectorAll('.modal-close, .modal-later').forEach(function (b) {
      b.addEventListener('click', cerrarPrueba);
    });
    popup.addEventListener('click', function (e) { if (e.target === popup) cerrarPrueba(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !popup.hidden) cerrarPrueba();
    });
  }

  /* Cookies: Google Analytics solo se carga si la visitante acepta */
  var gaCargado = false;
  function cargarGA() {
    if (gaCargado) return;
    gaCargado = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  var banner = document.getElementById('elevas-cookies');
  var eleccion = leer(COOKIE_KEY);
  var faltaElegir = eleccion !== 'accepted' && eleccion !== 'rejected';

  function decidirCookies(acepta) {
    guardar(COOKIE_KEY, acepta ? 'accepted' : 'rejected');
    if (banner) banner.hidden = true;
    if (acepta) cargarGA();
    programarPrueba();
  }

  if (eleccion === 'accepted') cargarGA();
  if (banner) {
    banner.querySelectorAll('[data-cookies]').forEach(function (b) {
      b.addEventListener('click', function () {
        decidirCookies(b.getAttribute('data-cookies') === 'accept');
      });
    });
    if (faltaElegir) banner.hidden = false;
  }
  if (!faltaElegir || !banner) programarPrueba();
})();
