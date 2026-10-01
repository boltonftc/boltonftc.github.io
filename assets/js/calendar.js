/* /calendar/ — expands _data/calendar.yml (embedded as JSON) into sessions, then renders the
   next-up countdown, agenda and month grid. All dates are interpreted in the team's time zone. */
(function () {
  "use strict";
  var dataEl = document.getElementById("cal-data");
  if (!dataEl) return;
  var CAL = JSON.parse(dataEl.textContent);
  var TZ = CAL.timezone || "America/New_York";
  var DAY = 864e5;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var KIND = { competition: "Competition", scrimmage: "Scrimmage", outreach: "Outreach", build: "Build day", deadline: "Deadline", meeting: "Meeting", event: "Event" };

  /* ---------- date helpers (calendar days are UTC-midnight millis; no DST surprises) ---------- */
  function dayMs(iso) { var p = iso.split("-"); return Date.UTC(+p[0], p[1] - 1, +p[2]); }
  function isoOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function dowOf(iso) { return new Date(dayMs(iso)).getUTCDay(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  function tzOffset(utc) {
    var o = {};
    partsFmt.formatToParts(new Date(utc)).forEach(function (p) { o[p.type] = p.value; });
    return Date.UTC(+o.year, o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) - utc;
  }
  /* real instant for a wall-clock date + "HH:MM" in the team time zone */
  function instant(iso, hm) {
    var t = (hm || "00:00").split(":");
    var guess = dayMs(iso) + (+t[0]) * 36e5 + (+t[1]) * 6e4;
    var at = guess - tzOffset(guess);
    var off2 = tzOffset(at);
    return guess - off2;
  }
  function todayIso() {
    var o = {};
    partsFmt.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
    return o.year + "-" + o.month + "-" + o.day;
  }

  function clock(hm) {
    var t = hm.split(":"), h = +t[0], m = t[1];
    return { t: ((h + 11) % 12 + 1) + (m === "00" ? "" : ":" + m), ap: h < 12 ? "AM" : "PM" };
  }
  function timeRange(a, b) {
    if (!a) return "All day";
    var x = clock(a);
    if (!b) return x.t + " " + x.ap;
    var y = clock(b);
    return x.ap === y.ap ? x.t + "–" + y.t + " " + y.ap : x.t + " " + x.ap + " – " + y.t + " " + y.ap;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function safeUrl(u) { return /^(https?:\/\/|\/)/i.test(u || "") ? u : ""; }
  function shortDate(iso) { var d = new Date(dayMs(iso)); return MONTHS[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate(); }

  /* ---------- expand the data into a flat, sorted list of sessions ---------- */
  var skip = {};
  (CAL.skip || []).forEach(function (s) { skip[s.date] = s.reason || "No meeting"; });
  var items = [];
  (CAL.series || []).forEach(function (s, i) {
    var color = s.color || (i % 2 ? "blue" : "gold");
    var end = dayMs(s.until || CAL.season.end);
    for (var t = dayMs(s.first); t <= end; t += 7 * DAY) {
      var d = isoOf(t);
      items.push({ date: d, start: s.start, end: s.end, title: s.title, location: s.location, color: color, kind: "meeting", skipped: !!skip[d], reason: skip[d] });
    }
  });
  (CAL.events || []).forEach(function (e) {
    items.push({ date: e.date, start: e.start, end: e.end, title: e.title, location: e.location, url: safeUrl(e.url), notes: e.notes, color: "event", kind: e.kind || "event", skipped: !!e.cancelled, reason: e.cancelled ? "Cancelled" : "" });
  });
  items.forEach(function (it) {
    it.t0 = instant(it.date, it.start || "00:00");
    it.t1 = it.end ? instant(it.date, it.end) : (it.start ? it.t0 + 36e5 : instant(isoOf(dayMs(it.date) + DAY), "00:00"));
  });
  items.sort(function (a, b) { return a.t0 - b.t0; });

  function live() { return items.filter(function (it) { return !it.skipped; }); }
  function upcoming(now) { return live().filter(function (it) { return it.t1 > now; }); }

  /* ---------- static bits: weekday names in the rhythm + legend, season range ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".cal-slot-day[data-first]"), function (el) {
    el.textContent = DOW_LONG[dowOf(el.getAttribute("data-first"))] + "s";
  });
  Array.prototype.forEach.call(document.querySelectorAll(".cal-slot-time[data-start]"), function (el) {
    var a = clock(el.getAttribute("data-start")), b = clock(el.getAttribute("data-end"));
    el.innerHTML = esc(a.t) + (a.ap !== b.ap ? "<small>" + a.ap + "</small>" : "") + "–" + esc(b.t) + "<small>" + b.ap + "</small>";
  });
  Array.prototype.forEach.call(document.querySelectorAll(".js-dayname[data-first]"), function (el) {
    el.textContent = DOW_LONG[dowOf(el.getAttribute("data-first"))] + " meeting";
  });
  var range = document.getElementById("season-range");
  if (range && CAL.season) {
    var s0 = new Date(dayMs(CAL.season.start)), s1 = new Date(dayMs(CAL.season.end));
    range.textContent = shortDate(CAL.season.start) + " " + s0.getUTCFullYear() + " → " + shortDate(CAL.season.end) + " " + s1.getUTCFullYear();
  }

  /* ---------- next up + countdown ---------- */
  var nextEl = document.getElementById("next-up");
  var afterEl = document.getElementById("next-after");
  var labelEl = document.getElementById("next-label");

  function countdown(ms) {
    var m = Math.round(ms / 6e4);
    if (m < 60) return "in " + Math.max(m, 1) + " min";
    var h = Math.floor(m / 60);
    if (h < 24) return "in " + h + " h " + pad(m % 60) + " min";
    var d = Math.floor(h / 24), rh = h % 24;
    return "in " + d + (d === 1 ? " day" : " days") + (d < 3 && rh ? " " + rh + " h" : "");
  }
  function relDay(it) {
    var today = dayMs(todayIso()), d = dayMs(it.date);
    if (d === today) return "Today";
    if (d === today + DAY) return "Tomorrow";
    return "";
  }

  function renderNext() {
    if (!nextEl) return;
    var now = Date.now();
    var up = upcoming(now);
    if (!up.length) {
      labelEl.textContent = "Season complete";
      nextEl.innerHTML = '<p class="cal-big">See you <b>next season</b></p>';
      afterEl.innerHTML = "";
      return;
    }
    var n = up[0], d = new Date(dayMs(n.date));
    var on = n.t0 <= now;
    labelEl.textContent = on ? "Happening now" : "Next up";
    var rel = relDay(n);
    nextEl.innerHTML =
      '<p class="cal-big c-' + n.color + '">' + (rel ? "<b>" + rel + "</b>" : "<b>" + DOW[d.getUTCDay()] + "</b>" + MONTHS[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate()) + "</p>" +
      '<div class="cal-next-meta">' +
      '<span class="cal-count' + (on ? " now" : "") + '">' + (on ? "Until " + timeRange(n.end) : countdown(n.t0 - now)) + "</span>" +
      "<span>" + esc(timeRange(n.start, n.end)) + " · " + esc(n.title) + "</span>" +
      (n.location ? '<span class="muted">' + esc(n.location) + "</span>" : "") +
      "</div>";
    afterEl.innerHTML = up.slice(1, 4).map(function (it) {
      var dd = new Date(dayMs(it.date));
      return '<li class="c-' + it.color + '"><span class="d"><small>' + DOW[dd.getUTCDay()] + "</small>" + shortDate(it.date) + "</span>" +
        '<span class="w">' + esc(it.title) + "<span>" + esc(timeRange(it.start, it.end)) + "</span></span></li>";
    }).join("");
  }

  /* ---------- agenda ---------- */
  var agendaEl = document.getElementById("agenda");
  var agendaWrap = document.getElementById("view-agenda");
  var earlierBtn = document.getElementById("show-earlier");

  function renderAgenda() {
    if (!agendaEl) return;
    var now = Date.now(), today = todayIso();
    var nextIt = upcoming(now)[0];
    var months = [], byKey = {};
    items.forEach(function (it) {
      var k = it.date.slice(0, 7);
      if (!byKey[k]) { byKey[k] = []; months.push(k); }
      byKey[k].push(it);
    });
    var pastCount = 0;
    agendaEl.innerHTML = months.map(function (k) {
      var list = byKey[k], y = +k.slice(0, 4), m = +k.slice(5) - 1;
      var allPast = list.every(function (it) { return it.t1 <= now; });
      var rows = list.map(function (it) {
        var past = it.t1 <= now;
        if (past) pastCount++;
        var d = new Date(dayMs(it.date));
        var cls = "cal-row c-" + it.color + (past ? " is-past" : "") + (it.skipped ? " is-skip" : "") + (it === nextIt ? " is-next" : "") + (it.date === today ? " is-today" : "");
        var title = it.skipped ? (it.kind === "meeting" ? "No meeting" : esc(it.title) + " — cancelled") : (it.url ? '<a href="' + esc(it.url) + '">' + esc(it.title) + "</a>" : esc(it.title));
        var sub = it.skipped ? esc(it.reason) : esc(timeRange(it.start, it.end)) + (it.location ? " · " + esc(it.location) : "") + (it.notes ? " · " + esc(it.notes) : "");
        var tag = it === nextIt ? '<span class="tag tag-gold">Next</span>' : (it.kind !== "meeting" ? '<span class="tag">' + esc(KIND[it.kind] || it.kind) + "</span>" : "<span></span>");
        return '<li class="' + cls + '"><div class="cal-d"><b>' + d.getUTCDate() + "</b><span>" + DOW[d.getUTCDay()] + "</span></div>" +
          '<div class="cal-w"><h4>' + title + "</h4><p>" + sub + "</p></div>" + tag + "</li>";
      }).join("");
      return '<section class="cal-month' + (allPast ? " is-past" : "") + '"><h3 class="cal-mh">' + MONTHS[m] + "<small>" + y + "</small></h3>" +
        '<ol class="cal-list">' + rows + "</ol></section>";
    }).join("") || '<p class="cal-empty">Nothing scheduled yet.</p>';
    if (earlierBtn) {
      earlierBtn.hidden = !pastCount || !agendaWrap.classList.contains("hide-past");
      earlierBtn.textContent = "Show " + pastCount + " earlier " + (pastCount === 1 ? "date" : "dates");
    }
  }
  if (earlierBtn) earlierBtn.addEventListener("click", function () {
    agendaWrap.classList.remove("hide-past");
    earlierBtn.hidden = true;
  });

  /* ---------- month grid ---------- */
  var gridEl = document.getElementById("m-grid");
  var titleEl = document.getElementById("m-title");
  var prevBtn = document.getElementById("m-prev");
  var nextBtn = document.getElementById("m-next");
  var firstMonth = items.length ? items[0].date.slice(0, 7) : todayIso().slice(0, 7);
  var lastMonth = items.length ? items[items.length - 1].date.slice(0, 7) : firstMonth;
  var cur = todayIso().slice(0, 7);
  if (cur < firstMonth) cur = firstMonth;
  if (cur > lastMonth) cur = lastMonth;

  function shiftMonth(k, n) {
    var y = +k.slice(0, 4), m = +k.slice(5) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + pad(m + 1);
  }
  function renderMonth() {
    if (!gridEl) return;
    var y = +cur.slice(0, 4), m = +cur.slice(5) - 1;
    titleEl.innerHTML = MONTHS[m] + "<small>" + y + "</small>";
    prevBtn.disabled = cur <= firstMonth;
    nextBtn.disabled = cur >= lastMonth;
    var first = Date.UTC(y, m, 1), start = first - new Date(first).getUTCDay() * DAY;
    var byDate = {};
    items.forEach(function (it) { (byDate[it.date] = byDate[it.date] || []).push(it); });
    var today = todayIso(), now = Date.now();
    var html = DOW.map(function (d) { return '<div class="cal-dow" role="columnheader">' + d + "</div>"; }).join("");
    for (var i = 0; i < 42; i++) {
      var t = start + i * DAY, iso = isoOf(t), dd = new Date(t);
      if (i === 35 && dd.getUTCMonth() !== m) break;
      var list = byDate[iso] || [];
      var cls = "cal-cell" + (dd.getUTCMonth() !== m ? " out" : "") + (iso === today ? " today" : "") + (iso < today ? " past" : "");
      html += '<div class="' + cls + '" role="gridcell"><span class="n">' + dd.getUTCDate() + "</span>" + list.map(function (it) {
        var label = it.skipped ? "<s>" + esc(timeRange(it.start)) + "</s> " + esc(it.reason) : "<b>" + esc(timeRange(it.start)) + "</b> " + esc(it.title);
        var tip = esc((it.skipped ? "No meeting — " + it.reason : it.title + ", " + timeRange(it.start, it.end)));
        var c = "chip c-" + it.color + (it.skipped ? " skip" : "");
        return it.url && !it.skipped
          ? '<a class="' + c + '" href="' + esc(it.url) + '" title="' + tip + '">' + label + "</a>"
          : '<span class="' + c + '" title="' + tip + '">' + label + "</span>";
      }).join("") + "</div>";
    }
    gridEl.innerHTML = html;
  }
  if (prevBtn) prevBtn.addEventListener("click", function () { cur = shiftMonth(cur, -1); renderMonth(); });
  if (nextBtn) nextBtn.addEventListener("click", function () { cur = shiftMonth(cur, 1); renderMonth(); });

  /* ---------- view toggle ---------- */
  var tabs = document.querySelectorAll("[data-view]");
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-view");
      Array.prototype.forEach.call(tabs, function (x) {
        var on = x === b;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.getElementById("view-agenda").hidden = v !== "agenda";
      document.getElementById("view-month").hidden = v !== "month";
    });
  });

  /* ---------- copy feed link ---------- */
  var copyBtn = document.getElementById("copy-feed");
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(document.getElementById("feed-url").textContent.trim()).then(function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
      });
    });
  } else if (copyBtn) { copyBtn.hidden = true; }

  function renderAll() { renderNext(); renderAgenda(); renderMonth(); }
  renderAll();
  setInterval(renderNext, 30000);
  /* re-sort past/next when a session ends while the page is open */
  setInterval(function () { renderAgenda(); renderMonth(); }, 5 * 60000);
})();
