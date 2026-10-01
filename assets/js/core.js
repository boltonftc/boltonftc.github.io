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
})();
