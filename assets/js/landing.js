/* Prime Symmetry landing page behaviour. No dependencies. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var noVideo = reduceMotion || saveData;

  function session(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- nav ---------- */
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
  function onScroll() { nav.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.ps-menu a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* ---------- 36563: twin highlights, a light-up hint, and the fold + proof easter egg ---------- */
  var Egg = { run: function () {}, cancel: function () {}, hint: function () {} };
  (function () {
    var heroEl = document.querySelector('.hero');
    var num = document.querySelector('.hero-num');
    if (!heroEl || !num) return;

    var slice = function (list) { return Array.prototype.slice.call(list); };
    var digits = slice(num.querySelectorAll('.hd'));
    var five = num.querySelector('.hd-c');
    var outer = digits.filter(function (d) { return d !== five; });
    var ops = slice(num.querySelectorAll(':scope > .hop'));
    var fold = num.querySelector('.fold');
    var fds = slice(fold.querySelectorAll('.fd'));
    var math = heroEl.querySelector('.hero-math');
    var copy = heroEl.querySelector('.hero-copy');
    var arc = heroEl.querySelector('.egg-arc');
    var arcPath = arc.querySelector('path');
    var toks = function (sel) { return slice(math.querySelectorAll(sel + ' .tok')); };
    var row1 = toks('.r1'), row2 = toks('.r2'), note = toks('.math-note');
    var timers = [], busy = false;

    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    var centerX = function (el) { var r = el.getBoundingClientRect(); return r.left + r.width / 2; };
    var setToks = function (list, on) { list.forEach(function (t) { t.classList.toggle('on', on); }); };
    var stagger = function (list, start, step) {
      list.forEach(function (t, k) { at(start + k * step, function () { t.classList.add('on'); }); });
    };
    var unlight = function () { digits.forEach(function (d) { d.classList.remove('lit'); }); };

    // hovering a digit lights its mirror twin
    digits.forEach(function (d) {
      var pair = d.getAttribute('data-pair');
      if (!pair) return;
      var twins = digits.filter(function (x) { return x.getAttribute('data-pair') === pair; });
      d.addEventListener('mouseenter', function () { if (!busy) twins.forEach(function (t) { t.classList.add('lit'); }); });
      d.addEventListener('mouseleave', function () { twins.forEach(function (t) { t.classList.remove('lit'); }); });
    });

    // after the intro: outer pair, inner pair, center -- shows the number is alive (phones can't hover)
    Egg.hint = function () {
      if (reduceMotion || busy) return;
      var groups = [
        digits.filter(function (d) { return d.getAttribute('data-pair') === 'a'; }),
        digits.filter(function (d) { return d.getAttribute('data-pair') === 'b'; }),
        [five]
      ];
      groups.forEach(function (g, k) {
        setTimeout(function () { if (busy) return; unlight(); g.forEach(function (d) { d.classList.add('lit'); }); }, k * 380);
      });
      setTimeout(function () { if (!busy) unlight(); }, groups.length * 380 + 320);
    };

    var drawArc = function () {
      var box = copy.getBoundingClientRect();
      var a = row2[row2.length - 1].getBoundingClientRect();
      var b = five.getBoundingClientRect();
      var sx = a.left + a.width / 2 - box.left, sy = a.top - box.top - 6;
      var ex = b.left + b.width / 2 - box.left, ey = b.bottom - box.top + 10;
      var reach = Math.max(80, (sx - ex) * 0.9);
      arcPath.setAttribute('d', 'M' + sx + ' ' + sy +
        ' C' + (sx + reach * 0.5) + ' ' + (sy - 60) + ' ' + (ex + reach) + ' ' + (ey + 70) + ' ' + ex + ' ' + ey);
      var len = arcPath.getTotalLength();
      arcPath.style.transition = 'none';
      arcPath.style.strokeDasharray = len;
      arcPath.style.strokeDashoffset = len;
      arcPath.getBoundingClientRect();
      arc.classList.add('on');
      arcPath.style.transition = 'stroke-dashoffset .75s cubic-bezier(.4, 0, .2, 1)';
      arcPath.style.strokeDashoffset = 0;
    };

    var reset = function () {
      timers.forEach(clearTimeout);
      timers = [];
      num.classList.remove('spread');
      fold.classList.remove('show', 'split');
      num.style.transition = '';
      digits.concat(ops, fds).forEach(function (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
      five.classList.remove('flash');
      setToks(row1.concat(row2, note), false);
      arc.classList.remove('on');
      arcPath.style.strokeDasharray = '';
      arcPath.style.strokeDashoffset = '';
      heroEl.classList.remove('egg-on');
      busy = false;
    };
    var finish = function () {
      heroEl.classList.remove('egg-on');
      arc.classList.remove('on');
      at(450, reset);
    };
    Egg.cancel = function () { if (busy) reset(); };

    Egg.run = function () {
      if (busy || !heroEl.classList.contains('is-ready')) return;
      busy = true;
      unlight();
      heroEl.classList.add('egg-on');
      if (reduceMotion) { setToks(row1.concat(row2, note), true); at(6500, finish); return; }

      // 1) plus signs open up between the digits:  3 + 6 + 5 + 6 + 3
      num.classList.add('spread');
      stagger(row1.slice(0, 9), 150, 85);

      // 2) everything slides into the center line...
      at(1000, function () {
        var c = centerX(num);
        var s = num.getBoundingClientRect().width / num.offsetWidth || 1;   // dx must be in the scaled element's own units
        digits.concat(ops).forEach(function (el) {
          el.style.transition = 'transform .65s cubic-bezier(.6, 0, .4, 1), opacity .45s ease .2s';
          el.style.transform = 'translateX(' + ((c - centerX(el)) / s) + 'px) scale(.35)';
          el.style.opacity = '0';
        });
      });

      // 3) ...and 23 blooms out of it. Quietly re-park the hidden digits at the center of the un-spread layout.
      at(1700, function () {
        num.style.transition = 'none';
        ops.forEach(function (o) { o.style.transition = 'none'; });
        digits.forEach(function (d) { d.style.transition = 'none'; d.style.transform = 'none'; });
        num.classList.remove('spread');
        void num.offsetWidth;
        var c = centerX(num);
        digits.forEach(function (d) { d.style.transform = 'translateX(' + (c - centerX(d)) + 'px) scale(.35)'; });
        void num.offsetWidth;
        num.style.transition = '';
        fold.classList.add('show');
        stagger(row1.slice(9), 120, 110);
      });

      // 4) 2 + 3
      at(2650, function () {
        fold.classList.add('split');
        stagger(row2.slice(0, 3), 0, 90);
      });

      // 5) the 2 and 3 crash together on the seam...
      at(3450, function () {
        var c = centerX(num);
        fds.forEach(function (f) {
          f.style.transition = 'transform .5s cubic-bezier(.6, 0, .4, 1), opacity .35s ease .15s';
          f.style.transform = 'translateX(' + (c - centerX(f)) + 'px) scale(.4)';
          f.style.opacity = '0';
        });
        stagger(row2.slice(3), 80, 120);
      });

      // 6) ...and become the real 5, right where it started
      at(3950, function () {
        five.style.transition = 'transform .55s cubic-bezier(.2, .8, .2, 1), opacity .3s ease';
        five.style.transform = '';
        five.style.opacity = '';
        five.classList.add('flash');
      });

      // 7) the written answer loops back up into it
      at(4150, drawArc);

      // 8) 36563 unfolds back out around the 5
      at(4950, function () {
        outer.forEach(function (d) {
          d.style.transition = 'transform .9s cubic-bezier(.2, .8, .2, 1), opacity .6s ease';
          d.style.transform = '';
          d.style.opacity = '';
        });
        five.classList.remove('flash');
        void five.offsetWidth;
        five.classList.add('flash');
        stagger(note, 450, 0);
      });

      at(6200, function () { five.classList.remove('flash'); });
      at(8600, finish);
    };

    slice(document.querySelectorAll('[data-egg]')).forEach(function (b) {
      b.addEventListener('click', function () { Egg.run(); });
    });
  })();

  /* ---------- hero: splash -> robot loop -> copy ---------- */
  var hero = document.querySelector('.hero');
  if (hero) {
    var splash = hero.querySelector('.hero-splash');
    var robot = hero.querySelector('.hero-robot');
    var soundBtn = hero.querySelector('.sound-btn');
    var revealed = false;

    var reveal = function () {
      if (revealed) return;
      revealed = true;
      hero.classList.add('intro', 'is-ready');
      setTimeout(function () { hero.classList.remove('intro'); }, 2200);
      setTimeout(Egg.hint, 2000);
      session('ps-intro', '1');
      if (!noVideo && robot) robot.play().catch(function () {});
    };

    if (noVideo) {
      hero.classList.add('no-video');
      reveal();
    } else if (session('ps-intro')) {
      hero.classList.add('skip-intro');   // already saw the intro this visit
      reveal();
    } else {
      splash.addEventListener('ended', reveal);
      var p = splash.play();
      if (p && p.catch) p.catch(function () { setTimeout(reveal, 900); });   // autoplay blocked: hold the poster briefly
      setTimeout(reveal, 9000);                                               // never strand the visitor on the intro
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        Egg.cancel();
        hero.classList.remove('skip-intro', 'is-ready');
        revealed = false;
        splash.removeEventListener('ended', reveal);
        splash.addEventListener('ended', reveal);
        splash.muted = false;
        splash.currentTime = 0;
        splash.play().catch(function () { splash.muted = true; splash.play().catch(reveal); });
      });
    }
  }

  /* ---------- "WE | code / compete / ..." ---------- */
  var cycler = document.querySelector('[data-cycle]');
  if (cycler && !reduceMotion) {
    var words = cycler.getAttribute('data-cycle').split(',');
    var i = 0;
    setInterval(function () {
      if (document.hidden || (hero && (!hero.classList.contains('is-ready') || hero.classList.contains('egg-on')))) return;
      i = (i + 1) % words.length;
      cycler.classList.add('out');
      setTimeout(function () {
        cycler.textContent = words[i];
        cycler.setAttribute('data-side', i % 2 ? 'r' : 'l');
        cycler.classList.remove('out');
      }, 280);
    }, 2800);
  }

  /* ---------- scroll reveals ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); ro.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ---------- simulator montage synced to the beat rail ---------- */
  var sv = document.querySelector('.sim-video');
  if (sv) {
    var beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
    var times = beats.map(function (b) { return parseFloat(b.getAttribute('data-t')); });
    var word = document.querySelector('.device-word');
    var current = -1;

    var load = function () {
      if (!sv.getAttribute('src')) { sv.setAttribute('src', sv.getAttribute('data-src')); sv.load(); }
    };
    var setBeat = function (k, frac) {
      if (k !== current) {
        beats.forEach(function (b, j) { b.classList.toggle('active', j === k); b.style.setProperty('--p', j < k ? 1 : 0); });
        if (word) word.textContent = beats[k].querySelector('b').textContent;
        current = k;
      }
      beats[k].style.setProperty('--p', frac);
    };

    sv.addEventListener('timeupdate', function () {
      var t = sv.currentTime, k = 0;
      for (var j = 0; j < times.length; j++) if (t >= times[j]) k = j;
      var end = k + 1 < times.length ? times[k + 1] : (sv.duration || times[k] + 4);
      setBeat(k, Math.min(1, Math.max(0, (t - times[k]) / (end - times[k]))));
    });

    beats.forEach(function (b, j) {
      b.setAttribute('tabindex', '0');
      b.setAttribute('role', 'button');
      var go = function () { load(); sv.currentTime = times[j] + 0.05; setBeat(j, 0); sv.play().catch(function () {}); };
      b.addEventListener('click', go);
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    sv.addEventListener('click', function () { load(); if (sv.paused) sv.play().catch(function () {}); else sv.pause(); });

    setBeat(0, 0);
    if (!noVideo && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { load(); sv.play().catch(function () {}); }
          else if (!sv.paused) sv.pause();
        });
      }, { threshold: 0.35 }).observe(sv);
    }
  }
})();
