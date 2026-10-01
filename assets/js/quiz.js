/* Shared lesson quiz. Markup: <section class="quiz" data-quiz><script type="application/json">{...}</script></section>
   JSON: { title, draw, pass, questions: [{ q, correct, wrong: [..], explain }] }  — same schema as the simulator.
   Nothing is stored or sent anywhere; reload = fresh quiz. */
(function () {
  "use strict";
  var LETTERS = "ABCDEF";

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  /* `code` spans are the only markup allowed in quiz text */
  function fmt(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }

  function init(root) {
    var src = root.querySelector('script[type="application/json"]');
    if (!src) return;
    var data = JSON.parse(src.textContent);
    var pool = data.questions || [];
    var draw = Math.min(data.draw || pool.length, pool.length);
    var pass = data.pass || 0.8;
    var state;

    root.innerHTML =
      '<header class="quiz-head"><div><p class="kicker">Check yourself</p><h2>' + esc(data.title || "Quiz") + "</h2></div>" +
      '<span class="quiz-progress"></span></header><div class="quiz-bar"><i></i></div><div class="quiz-body"></div>';
    var progress = root.querySelector(".quiz-progress");
    var bar = root.querySelector(".quiz-bar i");
    var body = root.querySelector(".quiz-body");

    function start(focus) {
      state = { qs: shuffle(pool.slice()).slice(0, draw), i: 0, score: 0 };
      show();
      if (focus) body.querySelector(".quiz-opt").focus();
    }

    function show() {
      var q = state.qs[state.i];
      var opts = shuffle([{ t: q.correct, ok: true }].concat(q.wrong.map(function (w) { return { t: w }; })));
      progress.textContent = "Question " + (state.i + 1) + " / " + state.qs.length;
      bar.style.width = (state.i / state.qs.length) * 100 + "%";
      body.innerHTML =
        '<p class="quiz-q">' + fmt(q.q) + "</p>" +
        '<div class="quiz-opts">' + opts.map(function (o, k) {
          return '<button type="button" class="quiz-opt" data-k="' + k + '"><b>' + LETTERS[k] + "</b><span>" + fmt(o.t) + "</span></button>";
        }).join("") + "</div>" +
        '<p class="quiz-explain" hidden></p>' +
        '<div class="quiz-foot"><button type="button" class="ps-btn ps-btn-sm quiz-next" hidden>' +
        (state.i + 1 < state.qs.length ? "Next question" : "See my score") + "</button></div>";

      var buttons = body.querySelectorAll(".quiz-opt");
      Array.prototype.forEach.call(buttons, function (btn) {
        btn.addEventListener("click", function () {
          var picked = opts[+btn.getAttribute("data-k")];
          if (picked.ok) state.score++;
          Array.prototype.forEach.call(buttons, function (b) {
            b.disabled = true;
            if (opts[+b.getAttribute("data-k")].ok) b.classList.add("right");
          });
          if (!picked.ok) btn.classList.add("wrong");
          var ex = body.querySelector(".quiz-explain");
          ex.innerHTML = "<b>" + (picked.ok ? "Correct." : "Not quite.") + "</b> " + fmt(q.explain || "");
          ex.hidden = false;
          var next = body.querySelector(".quiz-next");
          next.hidden = false;
          next.focus({ preventScroll: true });
          bar.style.width = ((state.i + 1) / state.qs.length) * 100 + "%";
        });
      });
      body.querySelector(".quiz-next").addEventListener("click", function () {
        state.i++;
        if (state.i < state.qs.length) { show(); body.querySelector(".quiz-opt").focus({ preventScroll: true }); }
        else finish();
      });
    }

    function finish() {
      var n = state.qs.length, ok = state.score / n >= pass;
      progress.textContent = "Done";
      bar.style.width = "100%";
      body.innerHTML =
        '<div class="quiz-result' + (ok ? " pass" : "") + '">' +
        '<div class="quiz-score">' + state.score + "<small> / " + n + "</small></div>" +
        "<p>" + (ok
          ? "Nice work. You've got the important ideas from this lesson."
          : "Worth another look. Skim the sections you weren't sure about, then try again. You'll get a fresh set of questions.") + "</p>" +
        '<button type="button" class="ps-btn ps-btn-sm quiz-again">Try again</button></div>';
      body.querySelector(".quiz-again").addEventListener("click", function () { start(true); });
    }

    start(false);
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-quiz]"), init);
})();
