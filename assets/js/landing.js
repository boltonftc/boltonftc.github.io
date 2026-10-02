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

  /* ---------- 36563: twin highlights, a light-up hint, and the fold easter egg ---------- */
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
    var fdop = fold.querySelector('.hop');
    var eqs = num.querySelector('.eqs');
    var timers = [], busy = false;

    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    var centerX = function (el) { var r = el.getBoundingClientRect(); return r.left + r.width / 2; };
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

    var reset = function () {
      timers.forEach(clearTimeout);
      timers = [];
      num.classList.remove('spread');
      fold.classList.remove('show', 'split');
      eqs.classList.remove('on');
      num.style.transition = '';
      digits.concat(ops, fds, [fdop]).forEach(function (el) { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
      five.classList.remove('flash');
      heroEl.classList.remove('egg-on');
      busy = false;
    };
    Egg.cancel = function () { if (busy) reset(); };

    // 3 + 6 + 5 + 6 + 3  =  23  ->  2 + 3  =  5  ->  36563 again
    Egg.run = function () {
      if (busy || !heroEl.classList.contains('is-ready')) return;
      busy = true;
      unlight();
      heroEl.classList.add('egg-on');
      if (reduceMotion) { five.classList.add('flash'); at(1500, reset); return; }

      // 1) plus signs open up between the digits
      num.classList.add('spread');

      // 2) everything slides into the center line...
      at(1300, function () {
        var c = centerX(num);
        var s = num.getBoundingClientRect().width / num.offsetWidth || 1;   // dx must be in the scaled element's own units
        digits.concat(ops).forEach(function (el) {
          el.style.transition = 'transform .65s cubic-bezier(.6, 0, .4, 1), opacity .45s ease .2s';
          el.style.transform = 'translateX(' + ((c - centerX(el)) / s) + 'px) scale(.35)';
          el.style.opacity = '0';
        });
      });

      // 3) ...and becomes "=" while the hidden digits quietly re-park at the center of the un-spread layout
      at(1950, function () {
        eqs.classList.add('on');
        num.style.transition = 'none';
        ops.forEach(function (o) { o.style.transition = 'none'; });
        digits.forEach(function (d) { d.style.transition = 'none'; d.style.transform = 'none'; });
        num.classList.remove('spread');
        void num.offsetWidth;
        var c = centerX(num);
        digits.forEach(function (d) { d.style.transform = 'translateX(' + (c - centerX(d)) + 'px) scale(.35)'; });
        void num.offsetWidth;
        num.style.transition = '';
      });

      // 4) = gives way to 23
      at(2900, function () { eqs.classList.remove('on'); });
      at(3150, function () { fold.classList.add('show'); });

      // 5) 23 opens into 2 + 3
      at(4200, function () { fold.classList.add('split'); });

      // 6) the 2 and 3 crash together on the seam...
      at(5300, function () {
        var c = centerX(num);
        fds.forEach(function (f) {
          f.style.transition = 'transform .5s cubic-bezier(.6, 0, .4, 1), opacity .35s ease .15s';
          f.style.transform = 'translateX(' + (c - centerX(f)) + 'px) scale(.4)';
          f.style.opacity = '0';
        });
        fdop.style.opacity = '0';
      });

      // 7) ...into "=" again...
      at(5850, function () { eqs.classList.add('on'); });

      // 8) ...which becomes the real 5, right where it started
      at(6800, function () {
        eqs.classList.remove('on');
        five.style.transition = 'transform .55s cubic-bezier(.2, .8, .2, 1), opacity .3s ease';
        five.style.transform = '';
        five.style.opacity = '';
        five.classList.add('flash');
      });

      // 9) 36563 unfolds back out around the 5
      at(7700, function () {
        outer.forEach(function (d) {
          d.style.transition = 'transform .9s cubic-bezier(.2, .8, .2, 1), opacity .6s ease';
          d.style.transform = '';
          d.style.opacity = '';
        });
      });

      at(8900, function () { five.classList.remove('flash'); });
      at(9400, reset);
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
      setTimeout(splitSeam, 1900);   // after the copy has finished rising into place
      session('ps-intro', '1');
      if (!noVideo && robot) robot.play().catch(function () {});
    };

    /* the seam opens around the sub-text: gold branch left, blue branch right (or just fades if too tight) */
    var subEl = hero.querySelector('.hero-sub');
    var lineEl = hero.querySelector('.hero-line');
    var ctaEl = hero.querySelector('.hero-cta');
    var split = hero.querySelector('.hero-split');
    var splitSeam = function () {
      if (!subEl || !split || !hero.classList.contains('is-ready')) return;
      var range = document.createRange();
      range.selectNodeContents(subEl);
      var r = range.getBoundingClientRect(), hb = hero.getBoundingClientRect();
      var cx = hb.width / 2, pad = 22, k = 46;
      var L = r.left - hb.left - pad, R = r.right - hb.left + pad;
      var T = r.top - hb.top - 6, B = r.bottom - hb.top + 6;
      if (!r.width || L > cx || R < cx) { hero.classList.remove('has-split', 'is-branched'); return; }
      var fits = L > 16 && R < hb.width - 16;
      // keep the straight seam through the "We | ___" row above and the button below; split only in between
      var above = lineEl ? lineEl.getBoundingClientRect().bottom - hb.top + 4 : T - k;
      var below = ctaEl ? ctaEl.getBoundingClientRect().top - hb.top - 4 : B + k;
      var y0 = fits ? Math.max(T - k, above) : T - 10, y1 = fits ? Math.min(B + k, below) : B + 10;
      hero.style.setProperty('--gap-t', y0 + 'px');
      hero.style.setProperty('--gap-b', y1 + 'px');
      hero.style.setProperty('--gap-f', fits ? '1px' : '26px');
      hero.classList.add('has-split');
      if (fits) {
        var ct = (T - y0) * 0.6, cb = (y1 - B) * 0.6;
        var branch = function (x) {
          return 'M' + cx + ',' + y0 + ' C' + cx + ',' + (y0 + ct) + ' ' + x + ',' + (T - ct) + ' ' + x + ',' + T +
                 ' L' + x + ',' + B + ' C' + x + ',' + (B + cb) + ' ' + cx + ',' + (y1 - cb) + ' ' + cx + ',' + y1;
        };
        split.querySelector('.sl').setAttribute('d', branch(L));
        split.querySelector('.sr').setAttribute('d', branch(R));
      }
      hero.classList.toggle('is-branched', fits);
    };
    var splitTimer;
    window.addEventListener('resize', function () { clearTimeout(splitTimer); splitTimer = setTimeout(splitSeam, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(splitSeam, 50); });

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

  /* ---------- 36563: read forwards, pause, read backwards, pause ---------- */
  var palin = document.querySelector('.palin');
  if (palin) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      palin.classList.add('still');
    } else {
      var pds = Array.prototype.slice.call(palin.querySelectorAll('.pd'));
      var pDir = palin.querySelector('.palin-dir');
      var pTimers = [];
      // each digit takes ~1s: 0.5s fade in, 0.5s fade out, overlapping the next digit's fade in
      var STEP = 500, LIT = 500, FADE = 600, HOLD = 2250;
      var PASS = (pds.length - 1) * STEP + LIT + FADE;
      var pAt = function (ms, fn) { pTimers.push(setTimeout(fn, ms)); };
      var pass = function (order, cls, t0) {
        pAt(t0, function () { palin.classList.add('sweeping'); });
        order.forEach(function (i, k) {
          pAt(t0 + k * STEP, function () { pds[i].classList.add(cls); palin.classList.toggle('at-mid', i === 2); });
          pAt(t0 + k * STEP + LIT, function () { pds[i].classList.remove(cls); });
        });
        pAt(t0 + (order.length - 1) * STEP + LIT, function () { palin.classList.remove('sweeping', 'at-mid'); });
      };
      var setDir = function (rev) { palin.classList.toggle('rev', rev); pDir.textContent = rev ? '\u2190' : '\u2192'; };
      var cycle = function () {
        pds.forEach(function (d) { d.classList.remove('lit-f', 'lit-b'); });
        palin.classList.remove('sweeping', 'at-mid');
        setDir(false);
        pass([0, 1, 2, 3, 4], 'lit-f', 0);
        pAt(PASS + 200, function () { setDir(true); });            // swap while the arrow is hidden
        pass([4, 3, 2, 1, 0], 'lit-b', PASS + HOLD);
        pAt(2 * PASS + HOLD + 200, function () { setDir(false); });
        pAt(2 * (PASS + HOLD), cycle);
      };
      var stop = function () {
        pTimers.forEach(clearTimeout);
        pTimers = [];
      };
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          stop();
          if (e.isIntersecting) cycle();
        });
      }, { threshold: 0.4 }).observe(palin);
    }
  }
})();
