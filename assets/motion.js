/*
  motion.js: capa de movimiento del inicio (index.html). Va junto con assets/motion.css.
  Sin librerías: IntersectionObserver, MutationObserver y requestAnimationFrame.

  - Si la persona pidió menos movimiento (prefers-reduced-motion), no hace nada.
  - Nada se oculta sin JS: las clases que esconden (m-rv) las pone este archivo, y solo a lo que
    está debajo de la pantalla al cargar.
  - No cambia textos, enlaces ni la lógica del estimador: solo observa y anima lo que ya existe.
  - Para quitar un efecto, comenta su línea en «arrancar()» al final del archivo.
*/
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return;

  const conMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
  const suave = (t) => 1 - Math.pow(1 - t, 3); // ease-out cúbico

  // Un solo manejador de scroll, agrupado en requestAnimationFrame
  const alScroll = [];
  let scrollPendiente = false;
  function pedirScroll() {
    if (scrollPendiente) return;
    scrollPendiente = true;
    requestAnimationFrame(() => { scrollPendiente = false; alScroll.forEach((fn) => fn()); });
  }

  /* 1. Aparición al hacer scroll, escalonada dentro de cada grupo */
  function apariciones() {
    const sueltos = [
      '#sistemas > div:first-child', '#incluido > div:first-child', '#como-empiezas > div:first-child',
      '#planes > div:first-child', '#planes > .mt-8', '#studio > div', '#soluciones > div:first-child',
      '#arquitectura > div:first-child', '#cotizador > div', '#contacto .text-center',
    ];
    const grupos = [
      '#sistemas > .grid > *', '#incluido > .grid > *', '#como-empiezas > ol > li', '#planes > .grid > *',
      '#soluciones > .grid > *', '#arquitectura > .grid > *', '#contacto .grid > *',
      // Etiquetas técnicas en cascada (aparecen después de su tarjeta)
      '#soluciones .font-mono > span', '#arquitectura ul > li',
    ];
    const etiquetas = new Set($$('#soluciones .font-mono > span, #arquitectura ul > li'));
    const alto = innerHeight;
    const elementos = [...$$(sueltos.join(',')), ...$$(grupos.join(','))]
      .filter((el) => el.getBoundingClientRect().top > alto); // lo que ya se ve al cargar no se oculta

    const io = new IntersectionObserver((entradas) => {
      let k = 0;
      entradas.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach(({ target: el }) => {
          const base = etiquetas.has(el) ? 250 : 0;
          el.style.transitionDelay = `${base + Math.min(k++, 6) * 90}ms`;
          el.classList.add('m-visto');
          io.unobserve(el);
          // Al terminar se quitan las clases para devolverle a la tarjeta su hover original
          const limpiar = (ev) => {
            if (ev && ev.target !== el) return;
            el.classList.remove('m-rv', 'm-visto');
            el.style.transitionDelay = '';
            el.removeEventListener('transitionend', limpiar);
          };
          el.addEventListener('transitionend', limpiar);
          setTimeout(limpiar, 1600);
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    elementos.forEach((el) => { el.classList.add('m-rv'); io.observe(el); });
  }

  /* 1b. Subrayado de «tu tipo de negocio.» solo si la frase está en una sola línea */
  function subrayado() {
    const frase = $('[data-motion="resalte"]');
    if (!frase) return;
    const revisar = () => frase.classList.toggle('m-una-linea', frase.getClientRects().length === 1);
    revisar();
    addEventListener('resize', revisar, { passive: true });
    if (document.fonts) document.fonts.ready.then(revisar);
  }

  /* 2. Menú superior: compacto al bajar, se oculta al bajar y reaparece al subir */
  function menuSuperior() {
    const nav = $('body > nav');
    const cajon = $('#mobile-drawer');
    if (!nav) return;
    nav.classList.add('m-nav');
    let ultimo = scrollY;
    alScroll.push(() => {
      const y = scrollY;
      const d = y - ultimo;
      nav.classList.toggle('m-compacto', y > 24);
      const ocupado = $('[data-menu].is-open') || (cajon && !cajon.classList.contains('hidden')) || nav.contains(document.activeElement);
      if (y < 160 || ocupado || d < -6) nav.classList.remove('m-oculto');
      else if (d > 6) nav.classList.add('m-oculto');
      if (Math.abs(d) > 6) ultimo = y;
    });
    // Si alguien llega con el teclado al menú, que aparezca
    nav.addEventListener('focusin', () => nav.classList.remove('m-oculto'));
  }

  /* 3. Barra de progreso de lectura */
  function barraProgreso() {
    const barra = document.createElement('div');
    barra.className = 'm-progreso';
    barra.setAttribute('aria-hidden', 'true');
    document.body.appendChild(barra);
    alScroll.push(() => {
      const total = document.documentElement.scrollHeight - innerHeight;
      barra.style.transform = `scaleX(${total > 0 ? Math.min(1, scrollY / total) : 0})`;
    });
  }

  /* 4. Resaltado del ítem del menú según la sección visible */
  function menuActivo() {
    const enlaces = {
      sistemas: $('#apps-toggle'),
      planes: $('.nav-links a[href="/planes"]'),
      studio: $('.nav-links a[href="#studio"]'),
      contacto: $('.nav-links a[href="#contacto"]'),
    };
    const seccionA = { sistemas: 'sistemas', planes: 'planes', studio: 'studio', soluciones: 'studio', arquitectura: 'studio', cotizador: 'studio', contacto: 'contacto' };
    Object.values(enlaces).forEach((a) => a && a.classList.add('m-enlace'));
    const visibles = new Set();
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => (e.isIntersecting ? visibles.add(e.target.id) : visibles.delete(e.target.id)));
      const actual = Object.keys(seccionA).find((id) => visibles.has(id));
      Object.entries(enlaces).forEach(([clave, a]) => a && a.classList.toggle('m-actual', !!actual && seccionA[actual] === clave));
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(seccionA).forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* 5. Microinteracción de los botones principales */
  function botones() {
    const lista = [
      '[data-motion="hero"] a',                       // Elige tu sistema / Hablar por WhatsApp
      '#demo-toggle',                                 // Probar demo (menú)
      '#mobile-drawer .border-t a',                   // Probar demo gratis / Hablar por WhatsApp (celular)
      '#sistemas article a',                          // Conocer / Probar demo de cada sistema
      '#studio a',                                    // Cotizar mi proyecto / Qué desarrollamos
      '#planes > .mt-8 a',                            // Ver todos los planes
      '#quote-form button[type="submit"]',            // Enviar cotización por WhatsApp
    ];
    $$(lista.join(',')).forEach((b) => b.classList.add('m-btn'));
  }

  /* 6. Inclinación 3D de las tarjetas de sistemas (solo con mouse) */
  function inclinacion() {
    if (!conMouse) return;
    const tarjetas = $$('#sistemas article, #app-switcher .glass-card:not([aria-disabled="true"])');
    const MAX = 5; // grados
    tarjetas.forEach((t) => {
      t.classList.add('m-tilt');
      let caja = null;
      let pendiente = null;
      const pintar = () => {
        const { x, y } = pendiente; pendiente = null;
        const px = x / caja.width, py = y / caja.height;
        t.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 2 * MAX).toFixed(2)}deg) rotateY(${((px - 0.5) * 2 * MAX).toFixed(2)}deg) translateY(-4px)`;
        t.style.setProperty('--m-x', `${(x - 160).toFixed(0)}px`);
        t.style.setProperty('--m-y', `${(y - 160).toFixed(0)}px`);
      };
      t.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || t.classList.contains('m-rv')) return;
        caja = t.getBoundingClientRect();
        t.classList.add('m-encima');
      });
      t.addEventListener('pointermove', (e) => {
        if (!caja || e.pointerType !== 'mouse') return;
        if (!pendiente) requestAnimationFrame(pintar);
        pendiente = { x: e.clientX - caja.left, y: e.clientY - caja.top };
      });
      t.addEventListener('pointerleave', () => {
        caja = null; pendiente = null;
        t.classList.remove('m-encima');
        t.style.transform = '';
      });
    });
  }

  /* 7. Insignias: punto que pulsa en «Disponible» y brillo en «Próximamente» / «En desarrollo» */
  function insignias() {
    $$('#app-switcher span.rounded-full.bg-emerald-400').forEach((p) => p.classList.add('m-pulso'));
    $$('#incluido span.rounded-full, #app-switcher span.rounded-full').forEach((s) => {
      if (/^(Próximamente|En desarrollo)$/.test(s.textContent.trim())) s.classList.add('m-brillo');
    });
  }

  /* 8. «Empieza en tres pasos»: línea que se dibuja con el scroll y números que se activan */
  function pasos() {
    const ol = $('#como-empiezas ol');
    if (!ol) return;
    const nums = $$(':scope > li > span:first-child', ol);
    if (nums.length < 2) return;
    ol.classList.add('m-pasos');
    const linea = document.createElement('div');
    linea.className = 'm-linea';
    linea.setAttribute('aria-hidden', 'true');
    ol.prepend(linea);
    nums.forEach((n) => n.classList.add('m-num', 'm-apagado'));

    let horizontal = false;
    // Se mide con offsetLeft/offsetTop (no les afecta el desplazamiento de la animación de entrada)
    const centro = (n) => {
      const li = n.parentElement; // el <li> es position: relative, así que es el offsetParent del número
      return { x: li.offsetLeft + n.offsetLeft + n.offsetWidth / 2, y: li.offsetTop + n.offsetTop + n.offsetHeight / 2 };
    };
    const medir = () => {
      const a = centro(nums[0]);
      const b = centro(nums[nums.length - 1]);
      horizontal = Math.abs(a.y - b.y) < 4; // en celular las tarjetas van una debajo de otra
      linea.style.display = horizontal ? '' : 'none';
      if (horizontal) {
        linea.style.left = `${a.x}px`;
        linea.style.width = `${b.x - a.x}px`;
        linea.style.top = `${a.y - 1}px`;
      }
    };
    const encender = (n, si) => {
      if (si === !n.classList.contains('m-apagado')) return;
      n.classList.toggle('m-apagado', !si);
      n.classList.toggle('m-encendido', si);
    };
    const actualizar = () => {
      const vh = innerHeight;
      if (horizontal) {
        const r = ol.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.45)));
        linea.style.transform = `scaleX(${p.toFixed(3)})`;
        nums.forEach((n, i) => encender(n, p >= (i / (nums.length - 1)) * 0.98));
      } else {
        nums.forEach((n) => encender(n, n.getBoundingClientRect().top < vh * 0.8));
      }
    };
    medir();
    actualizar();
    alScroll.push(actualizar);
    addEventListener('resize', () => { medir(); actualizar(); }, { passive: true });
    addEventListener('load', () => { medir(); actualizar(); });
  }

  /* 9. Precios que cuentan desde 0 hasta su valor (formato $49.990) */
  function contarPrecios() {
    const precios = $$('#sistemas .font-mono.font-bold, #planes .font-mono.font-bold')
      .filter((s) => /^\$[\d.]+$/.test(s.textContent.trim()) && s.getBoundingClientRect().top > innerHeight);
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach(({ isIntersecting, target: s }) => {
        if (!isIntersecting) return;
        io.unobserve(s);
        const texto = s.textContent.trim();
        const final = Number(texto.replace(/\D/g, ''));
        // Ancho fijo mientras cuenta para que el texto de al lado no salte
        s.style.display = 'inline-block';
        s.style.minWidth = `${s.getBoundingClientRect().width}px`;
        const inicio = performance.now();
        const DURA = 1100;
        const paso = (ahora) => {
          const t = Math.min(1, (ahora - inicio) / DURA);
          s.textContent = t < 1 ? `$${Math.round(final * suave(t)).toLocaleString('es-CO')}` : texto;
          if (t < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
    }, { threshold: 0.6 });
    precios.forEach((s) => io.observe(s));
  }

  /* 10. Estimador: el número se anima hacia el nuevo valor; módulos y moneda con transición suave.
         No toca la lógica: observa #price-display y, antes de enviar por WhatsApp, deja el valor final. */
  function estimador() {
    const precio = $('#price-display');
    const moneda = $('#currency-label');
    const modulos = $('#dynamic-modules-container');
    const form = $('#quote-form');
    if (!precio || !moneda) return;

    let mostrado = precio.textContent.trim();
    let monedaAntes = moneda.textContent.trim();
    let animacion = null;
    let objetivo = mostrado;

    const escribir = (txt) => { precio.textContent = txt; obs.takeRecords(); };
    const terminar = () => {
      if (animacion) { cancelAnimationFrame(animacion); animacion = null; }
      if (precio.textContent !== objetivo) escribir(objetivo);
      mostrado = objetivo;
    };
    const destello = (el) => { el.classList.remove('m-cambio'); void el.offsetWidth; el.classList.add('m-cambio'); };

    const obs = new MutationObserver(() => {
      const nuevo = precio.textContent.trim();
      const monedaAhora = moneda.textContent.trim();
      if (animacion) { cancelAnimationFrame(animacion); animacion = null; }
      objetivo = nuevo;
      if (monedaAhora !== monedaAntes) {
        // Cambio de COP a USD (o al revés): no tiene sentido contar entre monedas, solo un fundido
        monedaAntes = monedaAhora;
        mostrado = nuevo;
        destello(precio); destello(moneda);
        return;
      }
      const desde = Number(mostrado.replace(/\D/g, ''));
      const hasta = Number(nuevo.replace(/\D/g, ''));
      if (desde === hasta || !Number.isFinite(desde) || !Number.isFinite(hasta)) { mostrado = nuevo; return; }
      const formato = monedaAhora === 'USD' ? 'en-US' : 'es-CO';
      escribir(Math.round(desde).toLocaleString(formato));
      const inicio = performance.now();
      const DURA = 450;
      const paso = (ahora) => {
        const t = Math.min(1, (ahora - inicio) / DURA);
        if (t < 1) {
          const v = Math.round(desde + (hasta - desde) * suave(t));
          escribir(v.toLocaleString(formato));
          mostrado = precio.textContent;
          animacion = requestAnimationFrame(paso);
        } else {
          animacion = null;
          terminar();
        }
      };
      animacion = requestAnimationFrame(paso);
    });
    obs.observe(precio, { childList: true, characterData: true, subtree: true });

    // Antes de que sendToWhatsApp() lea el precio, se deja el valor final (fase de captura)
    if (form) form.addEventListener('submit', terminar, true);

    // Los módulos se vuelven a dibujar al cambiar el tipo de proyecto: entran escalonados
    if (modulos) {
      new MutationObserver(() => {
        Array.from(modulos.children).forEach((m, i) => {
          if (m.classList.contains('m-modulo')) return;
          m.classList.add('m-modulo');
          m.style.animationDelay = `${i * 50}ms`;
        });
      }).observe(modulos, { childList: true });
    }
  }

  /* 11. Fondo vivo: luces y rejilla que se mueven a distinta velocidad al hacer scroll */
  function fondoVivo() {
    const fondo = document.createElement('div');
    fondo.className = 'm-fondo';
    fondo.setAttribute('aria-hidden', 'true');
    fondo.innerHTML = '<div class="m-rejilla"></div>' + '<div class="m-orbe"><i></i></div>'.repeat(4);
    document.body.prepend(fondo);
    const rejilla = fondo.firstElementChild;
    const orbes = Array.from(fondo.querySelectorAll('.m-orbe'));
    // Cada luz: cuánto se mueve (en % de la pantalla), qué tan rápido responde al scroll y su desfase.
    // Se usa seno/coseno para que, por larga que sea la página, las luces nunca se salgan de la pantalla.
    const conf = [
      { ax: 0.10, ay: 0.22, vel: 1.0, fase: 0 },
      { ax: 0.14, ay: 0.25, vel: 0.7, fase: 2.1 },
      { ax: 0.12, ay: 0.20, vel: 1.3, fase: 4.2 },
      { ax: 0.08, ay: 0.18, vel: 0.5, fase: 1.0 },
    ];
    alScroll.push(() => {
      const y = scrollY;
      const w = innerWidth, h = innerHeight;
      orbes.forEach((o, i) => {
        const c = conf[i];
        const t = (y / 1400) * c.vel + c.fase;
        o.style.transform = `translate3d(${(Math.cos(t) * c.ax * w).toFixed(1)}px, ${(Math.sin(t) * c.ay * h).toFixed(1)}px, 0)`;
        o.style.opacity = (0.65 + 0.35 * Math.sin(t * 1.3)).toFixed(3);
      });
      rejilla.style.transform = `translate3d(0, ${(-(y * 0.12) % 32).toFixed(1)}px, 0)`;
    });
  }

  function arrancar() {
    fondoVivo();
    apariciones();
    subrayado();
    menuSuperior();
    barraProgreso();
    menuActivo();
    botones();
    inclinacion();
    insignias();
    pasos();
    contarPrecios();
    estimador();

    addEventListener('scroll', pedirScroll, { passive: true });
    addEventListener('resize', pedirScroll, { passive: true });
    pedirScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
