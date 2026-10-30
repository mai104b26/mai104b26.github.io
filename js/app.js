(function () {
  'use strict';

  var DATA = window.MemorialData;
  var CAT = DATA.CAT;
  var P = DATA.P;
  var ROUTES = DATA.ROUTES;

  var root = document.documentElement;
  var mapEl = document.getElementById('map');
  var listEl = document.getElementById('list');
  var panelEl = document.getElementById('panel');
  var emptyEl = document.getElementById('empty');
  var NS = 'http://www.w3.org/2000/svg';

  /* ─────────── Состояние ─────────── */
  var done = window.MemStorage.load();
  var cur = -1, routeIdx = 0, filterCat = '', query = '';

  function saveDone() { window.MemStorage.save(done); }

  window.MemStorage.onChange(function (fresh) {
    done = fresh;
    stat();
    if (cur >= 0) pick(cur, false);
  });

  /* ─────────── Поиск ─────────── */
  function norm(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е');
  }

  function matchTitle(title, q) {
    var words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    var t = norm(title);
    for (var i = 0; i < words.length; i++) {
      if (t.indexOf(words[i]) < 0) return false;
    }
    return true;
  }

  /* Ссылка на Яндекс.Карты — по названию мемориала.
     Префикс «Ступино,» нужен, чтобы не улететь в другой город. */
  function mapUrlFor(p) {
    return 'https://yandex.ru/maps/?text=' + encodeURIComponent('Ступино, ' + p.t);
  }

  /* ─────────── SVG helper ─────────── */
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ═══════════ 1. PRELOADER ═══════════ */
  (function initPreloader() {
    var preloader = document.getElementById('preloader');
    if (!preloader) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = !!sessionStorage.getItem('stup_seen'); } catch (e) {}

    if (prefersReduced || seen) {
      if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      return;
    }
    try { sessionStorage.setItem('stup_seen', '1'); } catch (e) {}

    document.body.style.overflow = 'hidden';

    setTimeout(function () {
      preloader.classList.add('is-hiding');
      document.body.style.overflow = '';
      setTimeout(function () {
        if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
      }, 850);
    }, 2100);
  })();

  /* ═══════════ 2. MAP BASE ═══════════ */
  var baseLayer = svg('g', { class: 'map-base' }, mapEl);

  svg('ellipse', { cx:30, cy:41, rx:12, ry:8, class:'map-park' }, baseLayer);
  svg('ellipse', { cx:79, cy:13, rx:13, ry:9, class:'map-park' }, baseLayer);

  [
    'M-4,42 C18,39 34,41 52,38 S80,34 104,36',
    'M51,-4 C52,18 50,38 53,56 S54,66 53,74',
    'M6,66 C24,54 42,48 60,36 S82,20 100,12',
    'M18,2 C28,16 36,28 44,44',
    'M72,6 C78,20 80,32 78,48',
    'M8,22 C20,26 30,32 40,42'
  ].forEach(function (d) { svg('path', { d: d, class:'map-road' }, baseLayer); });

  var compass = svg('g', { transform:'translate(92,11)' }, baseLayer);
  svg('circle', { r:4.6, class:'compass-ring' }, compass);
  svg('path', { d:'M0,-3.2 L1.5,1.1 L0,0.2 L-1.5,1.1 Z', class:'compass-arrow' }, compass);
  svg('text', { y:-6.4, class:'compass-t' }, compass).textContent = 'С';

  var routeLayer = svg('g', { class:'map-route' }, mapEl);
  var pinLayer = svg('g', { class:'map-pins' }, mapEl);

  /* ═══════════ 3. PINS ═══════════ */
  var pins = [];

  P.forEach(function (p, i) {
    var wrap = svg('g', { transform:'translate(' + p.x + ',' + p.y + ')' }, pinLayer);
    var g = svg('g', {
      class:'pin',
      tabindex:'0',
      role:'button',
      'aria-label':'Точка ' + (i + 1) + '. ' + p.t
    }, wrap);

    svg('circle', { class:'pin-ring', r:4.2 }, g);
    svg('circle', { class:'pin-dot', r:4.3 }, g);
    var num = svg('text', { class:'pin-num', x:0, y:0 }, g);
    num.textContent = i + 1;

    g.addEventListener('click', function () { pick(i, false); });
    g.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i, false); }
    });

    pins.push(g);
  });

  /* ═══════════ 4. ROUTE ═══════════ */
  function drawRoute() {
    routeLayer.innerHTML = '';
    var ids = ROUTES[routeIdx].ids;

    if (routeIdx > 0 && ids.length > 1) {
      var pts = ids.map(function (n) { return P[n - 1].x + ',' + P[n - 1].y; }).join(' ');
      svg('polyline', { points: pts, class:'rte-draw', pathLength:'1' }, routeLayer);
      svg('polyline', { points: pts, class:'rte-flow', pathLength:'1' }, routeLayer);
    }

    pins.forEach(function (g, i) {
      g.classList.toggle('dim', ids.indexOf(i + 1) < 0);
    });
  }

  /* ═══════════ 5. ROUTE CHIPS ═══════════ */
  var rtsEl = document.getElementById('rts');
  ROUTES.forEach(function (r, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = r.n;
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () {
      routeIdx = i;
      Array.prototype.forEach.call(rtsEl.children, function (x, j) {
        x.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      drawRoute();
      render();
    });
    rtsEl.appendChild(b);
  });

  /* ═══════════ 6. FILTER CHIPS ═══════════ */
  var fltEl = document.getElementById('flt');
  var FILTER_LABELS = { m:'Мемориалы', o:'Обелиски', d:'Доски', g:'Захоронения' };

  [{ k:'', n:'Все типы' }]
    .concat(Object.keys(CAT).map(function (k) { return { k:k, n:FILTER_LABELS[k] }; }))
    .forEach(function (item, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = item.n;
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        filterCat = item.k;
        Array.prototype.forEach.call(fltEl.children, function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        render();
      });
      fltEl.appendChild(b);
    });

  /* ═══════════ 7. SEARCH ═══════════ */
  document.getElementById('q').addEventListener('input', function () {
    query = this.value.trim().toLowerCase();
    render();
  });

  /* ═══════════ 8. CARDS ═══════════ */
  var ARROW =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 17L17 7M9 7h8v8"/></svg>';

  var cards = [];

  P.forEach(function (p, i) {
    var n = i + 1;
    var mapUrl = mapUrlFor(p);
    var num = (n < 10 ? '0' : '') + n;

    var li = document.createElement('li');
    li.className = 'card';
    li.style.setProperty('--delay', (i % 3) * 70 + 'ms');

    li.innerHTML =
      '<div class="card-body">' +
        '<div class="card-head">' +
          '<span class="cat" data-cat="' + p.k + '">' + CAT[p.k] + '</span>' +
          '<span class="card-num" aria-hidden="true">' + num + '</span>' +
        '</div>' +
        '<h3>' + p.t + '</h3>' +
        '<p class="card-meta">' + p.a + '</p>' +
        '<p class="card-text">' + p.d + '</p>' +
        '<div class="acts">' +
          '<button class="btn" type="button" data-a="map">На схеме</button>' +
          '<button class="btn" type="button" data-a="done" aria-pressed="false">Пройдено</button>' +
        '</div>' +
        '<a class="card-link" href="' + mapUrl + '" target="_blank" rel="noopener">Открыть на карте города' + ARROW + '</a>' +
      '</div>';

    li.querySelector('[data-a="map"]').addEventListener('click', function () { pick(i, true); });
    li.querySelector('[data-a="done"]').addEventListener('click', function () { toggle(i); });

    li.addEventListener('mousemove', function (e) {
      var r = li.getBoundingClientRect();
      li.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      li.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    });

    listEl.appendChild(li);
    cards.push(li);
  });

  /* ═══════════ 9. ЛОГИКА ═══════════ */
  function toggle(i) {
    if (done[i]) { delete done[i]; } else { done[i] = true; }
    saveDone();
    stat();
    if (cur === i) pick(i, false);
  }

  function stat() {
    var c = Object.keys(done).length;
    var total = P.length;

    var pt = document.getElementById('pt');
    pt.textContent = 'Пройдено ' + c + ' из ' + total;
    pt.classList.remove('pulse');
    void pt.offsetWidth;
    pt.classList.add('pulse');

    document.getElementById('pp').textContent = Math.round(c / total * 100) + '%';
    document.getElementById('pb').style.width = (c / total * 100) + '%';

    P.forEach(function (p, i) {
      pins[i].classList.toggle('done', !!done[i]);
      var b = cards[i].querySelector('[data-a="done"]');
      b.setAttribute('aria-pressed', done[i] ? 'true' : 'false');
      b.textContent = done[i] ? '✓ Пройдено' : 'Пройдено';
    });
  }

  function pick(i, scrollToMap) {
    cur = i;
    var p = P[i];

    pins.forEach(function (g, j) { g.classList.toggle('on', j === i); });
    cards.forEach(function (c, j) { c.classList.toggle('sel', j === i); });

    panelEl.innerHTML =
      '<span class="panel-tag">Точка ' + (i + 1) + ' · ' + CAT[p.k] + '</span>' +
      '<h3>' + p.t + '</h3>' +
      '<p class="meta">' + p.a + '</p>' +
      '<p class="body">' + p.d + '</p>' +
      '<div class="acts">' +
        '<button class="btn" type="button" id="pd" aria-pressed="' + (done[i] ? 'true' : 'false') + '">' +
          (done[i] ? '✓ Пройдено' : 'Отметить пройденной') +
        '</button>' +
        '<button class="btn" type="button" id="pc">К карточке</button>' +
      '</div>';

    document.getElementById('pd').addEventListener('click', function () { toggle(i); });
    document.getElementById('pc').addEventListener('click', function () {
      cards[i].scrollIntoView({ behavior:'smooth', block:'center' });
    });

    if (scrollToMap) {
      document.querySelector('.mapbox').scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function render() {
    var ids = ROUTES[routeIdx].ids;
    var visible = 0;

    cards.forEach(function (c, i) {
      var p = P[i];
      var inRoute = ids.indexOf(i + 1) >= 0;
      var okCat = !filterCat || p.k === filterCat;
      var okQuery = !query || matchTitle(p.t, query);
      var show = inRoute && okCat && okQuery;
      c.classList.toggle('hide', !show);
      if (show) visible++;
    });

    if (emptyEl) emptyEl.hidden = visible > 0;

    observeCards();
  }

  /* ═══════════ 10. ПОЯВЛЕНИЕ КАРТОЧЕК ═══════════ */
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var card = e.target;
          card.classList.add('in');
          setTimeout(function () { card.classList.add('entered'); }, 950);
          io.unobserve(card);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    : null;

  function observeCards() {
    cards.forEach(function (c) {
      if (c.classList.contains('in')) return;
      if (io) { io.observe(c); } else { c.classList.add('in', 'entered'); }
    });
  }

  /* ═══════════ 11. НАСТРОЙКИ ═══════════ */

  var fsBtn = document.getElementById('fs');
  try {
    if (localStorage.getItem('stup_size') === 'lg') {
      root.setAttribute('data-size', 'lg');
      fsBtn.setAttribute('aria-pressed', 'true');
    }
  } catch (e) {}

  fsBtn.addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      root.setAttribute('data-size', 'lg');
      try { localStorage.setItem('stup_size', 'lg'); } catch (e) {}
    } else {
      root.removeAttribute('data-size');
      try { localStorage.removeItem('stup_size'); } catch (e) {}
    }
  });

  var thBtn = document.getElementById('th');
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');

  function getActiveTheme() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return mqDark.matches ? 'dark' : 'light';
  }

  function updateMetaTheme(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#131211' : '#f7f4ee');
  }

  function syncThemeButton() {
    var theme = getActiveTheme();
    thBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    thBtn.textContent = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    updateMetaTheme(theme);
  }

  syncThemeButton();
  if (mqDark.addEventListener) {
    mqDark.addEventListener('change', function () {
      if (!root.hasAttribute('data-theme')) syncThemeButton();
    });
  }

  thBtn.addEventListener('click', function () {
    var next = getActiveTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('stup_theme', next); } catch (e) {}
    syncThemeButton();
  });

  var resetBtn = document.getElementById('reset');
  resetBtn.addEventListener('click', function () {
    if (!Object.keys(done).length) return;
    if (!confirm('Сбросить прогресс по всем точкам?')) return;
    done = {};
    window.MemStorage.clear();
    stat();
    if (cur >= 0) pick(cur, false);
  });

  /* ═══════════ 12. RIPPLE ═══════════ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    var rp = document.createElement('span');
    rp.className = 'ripple';
    var r = btn.getBoundingClientRect();
    var size = Math.max(r.width, r.height);
    rp.style.width = rp.style.height = size + 'px';
    rp.style.left = (e.clientX - r.left - size / 2) + 'px';
    rp.style.top = (e.clientY - r.top - size / 2) + 'px';
    btn.appendChild(rp);
    setTimeout(function () { rp.remove(); }, 640);
  });

  /* ═══════════ 13. СТАРТ ═══════════ */
  drawRoute();
  stat();
  render();

})();