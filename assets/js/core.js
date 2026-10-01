/* Prime Symmetry — shared behaviour for every page: nav, menu, coin flip, scroll reveals. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var nav = document.querySelector('.ps-nav');
  var burger = document.querySelector('.ps-burger');
  var coin = document.querySelector('.ps-coin');

  if (coin && !reduceMotion) {
    var brand = coin.closest('.ps-brand');
    var flip = function () { coin.classList.add('flip'); };   // runs to completion even if the pointer leaves
    brand.addEventListener('mouseenter', flip);
    brand.addEventListener('focus', flip);
    coin.addEventListener('animationend', function () { coin.classList.remove('flip'); });
  }

  if (nav) {
    var solidAlways = document.body.classList.contains('nav-solid');
    var onScroll = function () { nav.classList.toggle('is-solid', solidAlways || window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.ps-menu a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); });
    });
  }

  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); ro.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* Simulator links: on phones/tablets (touch only, no mouse), explain it's a desktop app first, then let them through. */
  var simMeta = document.querySelector('meta[name="ps-sim-url"]');
  var simUrl = simMeta && simMeta.content;
  var touchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  if (simUrl && touchOnly && typeof HTMLDialogElement === 'function') {
    var dlg;
    var openSim = function () { window.open(simUrl, '_blank', 'noopener'); };
    var build = function () {
      dlg = document.createElement('dialog');
      dlg.className = 'sim-warn';
      dlg.setAttribute('aria-labelledby', 'sim-warn-t');
      dlg.innerHTML =
        '<p class="kicker">Heads up</p>' +
        '<h2 id="sim-warn-t">The simulator is a desktop app</h2>' +
        '<p>The Impulse 3D Simulator is built for a computer with a keyboard and a gamepad or mouse, in Chrome or Edge. On a phone it will be slow and hard to use, and the code editor won\'t fit.</p>' +
        '<div class="sim-warn-actions">' +
          '<button type="button" class="ps-btn ps-btn-gold ps-btn-sm" data-act="copy">Copy link for later</button>' +
          '<button type="button" class="ps-btn ps-btn-ghost ps-btn-sm" data-act="open">Open anyway</button>' +
          '<button type="button" class="sim-warn-x" data-act="close" aria-label="Close">&times;</button>' +
        '</div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) { dlg.close(); return; }   // backdrop tap
        var b = e.target.closest('[data-act]');
        if (!b) return;
        var act = b.getAttribute('data-act');
        if (act === 'open') { dlg.close(); openSim(); }
        else if (act === 'close') dlg.close();
        else if (act === 'copy') {
          var done = function () { b.textContent = 'Link copied'; };
          if (navigator.clipboard) navigator.clipboard.writeText(simUrl).then(done, function () { b.textContent = simUrl; });
          else b.textContent = simUrl;
        }
      });
    };
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.href.indexOf(simUrl) !== 0) return;
      e.preventDefault();
      if (!dlg) build();
      var copyBtn = dlg.querySelector('[data-act="copy"]');
      copyBtn.textContent = 'Copy link for later';
      dlg.showModal();
    });
  }
})();
