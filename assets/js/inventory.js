/* /resources/inventory/ — renders _data/inventory.json (embedded as #inv-data). */
(function () {
  "use strict";
  var el = document.getElementById("inv-data");
  if (!el) return;
  var DATA = JSON.parse(el.textContent);
  var ITEMS = DATA.items || [];
  var CATS = DATA.categories || [];
  var COLORS = { motors: "#EFAB28", servos: "#446CE3", drive: "#45c47f", power: "#e0763a", electronics: "#8ea8ff", vision: "#b48cf0", field: "#4fc3c3", pit: "#d98fb0", misc: "#9aa3bd" };
  var catLabel = {};
  CATS.forEach(function (c) { catLabel[c.id] = c.label; });

  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return v == null ? "—" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var whole = function (v) { return "$" + Math.round(v).toLocaleString("en-US"); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  var safeUrl = function (u) { return /^https?:\/\//i.test(u || "") ? u : ""; };
  var hay = ITEMS.map(function (it) {
    return [it.name, it.sku, it.vendor, it.notes, it.keywords, catLabel[it.cat], it.purchased].join(" ").toLowerCase();
  });

  /* ---------- totals (computed, never stored) ---------- */
  var byCat = {}, grand = 0, parts = 0, vendors = {};
  ITEMS.forEach(function (it) {
    var t = it.total || 0;
    byCat[it.cat] = (byCat[it.cat] || 0) + t;
    grand += t;
    if (typeof it.qty === "number") parts += it.qty;
    if (it.vendor) vendors[it.vendor.replace(/\s*\(.*\)$/, "")] = true;
  });
  $("inv-grand").textContent = money(grand);
  $("inv-lines").textContent = ITEMS.length;
  $("inv-parts").textContent = parts.toLocaleString("en-US");
  $("inv-vendors").textContent = Object.keys(vendors).length;
  if (DATA.updated) {
    var d = new Date(DATA.updated + "T12:00:00");
    $("inv-updated").textContent = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  /* ---------- spend bar + legend (click to filter) ---------- */
  var ranked = CATS.filter(function (c) { return byCat[c.id] > 0; }).sort(function (a, b) { return byCat[b.id] - byCat[a.id]; });
  $("inv-bar").innerHTML = ranked.map(function (c) {
    var pct = byCat[c.id] / grand * 100;
    return '<span style="flex-basis:' + pct.toFixed(3) + '%;background:' + COLORS[c.id] + '" title="' + esc(c.label + ": " + money(byCat[c.id]) + " (" + pct.toFixed(1) + "%)") + '"></span>';
  }).join("");
  $("inv-legend").innerHTML = ranked.map(function (c) {
    var pct = byCat[c.id] / grand * 100;
    return '<li><button type="button" data-cat="' + c.id + '"><i style="background:' + COLORS[c.id] + '"></i><span>' + esc(c.label) +
      '</span><b>' + whole(byCat[c.id]) + '</b><small>' + pct.toFixed(1) + '%</small></button></li>';
  }).join("");

  /* ---------- controls ---------- */
  var state = { q: "", cat: "", vendor: "", sort: "cat", dir: 1 };
  var counts = {};
  ITEMS.forEach(function (it) { counts[it.cat] = (counts[it.cat] || 0) + 1; });
  $("inv-cats").innerHTML = '<button type="button" class="on" data-cat="">All <small>' + ITEMS.length + '</small></button>' +
    CATS.filter(function (c) { return counts[c.id]; }).map(function (c) {
      return '<button type="button" data-cat="' + c.id + '">' + esc(c.label) + ' <small>' + counts[c.id] + '</small></button>';
    }).join("");
  var vendorList = Object.keys(ITEMS.reduce(function (m, it) { if (it.vendor) m[it.vendor] = 1; return m; }, {})).sort();
  $("inv-vendor").insertAdjacentHTML("beforeend", vendorList.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join(""));

  function setCat(cat) {
    state.cat = cat;
    Array.prototype.forEach.call(document.querySelectorAll("#inv-cats button"), function (b) { b.classList.toggle("on", b.getAttribute("data-cat") === cat); });
    Array.prototype.forEach.call(document.querySelectorAll("#inv-legend button"), function (b) { b.classList.toggle("off", !!cat && b.getAttribute("data-cat") !== cat); });
    render();
  }
  $("inv-cats").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setCat(b.getAttribute("data-cat")); });
  $("inv-legend").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var c = b.getAttribute("data-cat");
    setCat(state.cat === c ? "" : c);
  });
  $("inv-q").addEventListener("input", function () { state.q = this.value.trim().toLowerCase(); render(); });
  $("inv-vendor").addEventListener("change", function () { state.vendor = this.value; render(); });

  var catOrder = {};
  CATS.forEach(function (c, i) { catOrder[c.id] = i; });
  var ths = document.querySelectorAll(".inv-table th[data-sort]");
  Array.prototype.forEach.call(ths, function (th) {
    th.setAttribute("tabindex", "0");
    th.setAttribute("role", "button");
    function go() {
      var k = th.getAttribute("data-sort");
      state.dir = state.sort === k ? -state.dir : (/^(qty|unit|total)$/.test(k) ? -1 : 1);
      state.sort = k;
      render();
    }
    th.addEventListener("click", go);
    th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  function cmp(a, b) {
    var k = state.sort, x, y;
    if (k === "cat") {
      x = catOrder[a.cat]; y = catOrder[b.cat];
      if (x !== y) return (x - y) * state.dir;
      return (b.total || 0) - (a.total || 0);
    }
    if (k === "qty" || k === "unit" || k === "total") {
      x = typeof a[k] === "number" ? a[k] : -1; y = typeof b[k] === "number" ? b[k] : -1;
      return (x - y) * state.dir;
    }
    x = String(a[k] || "").toLowerCase(); y = String(b[k] || "").toLowerCase();
    return x < y ? -state.dir : x > y ? state.dir : 0;
  }

  var shown = [];
  function render() {
    var terms = state.q ? state.q.split(/\s+/) : [];
    shown = ITEMS.filter(function (it, i) {
      if (state.cat && it.cat !== state.cat) return false;
      if (state.vendor && it.vendor !== state.vendor) return false;
      for (var t = 0; t < terms.length; t++) if (hay[i].indexOf(terms[t]) < 0) return false;
      return true;
    }).sort(cmp);

    Array.prototype.forEach.call(ths, function (th) {
      var on = th.getAttribute("data-sort") === state.sort;
      th.classList.toggle("sorted", on);
      th.classList.toggle("asc", on && state.dir > 0);
      th.setAttribute("aria-sort", on ? (state.dir > 0 ? "ascending" : "descending") : "none");
    });

    $("inv-body").innerHTML = shown.length ? shown.map(function (it) {
      var url = safeUrl(it.url);
      var name = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(it.name) + "</a>" : esc(it.name);
      return "<tr><td class=\"inv-name\">" + name + (it.notes ? "<small>" + esc(it.notes) + "</small>" : "") + "</td>" +
        '<td><span class="inv-chip" style="--c:' + COLORS[it.cat] + '">' + esc(catLabel[it.cat] || it.cat) + "</span></td>" +
        '<td class="mono">' + esc(it.sku || "—") + "</td>" +
        '<td class="num">' + esc(it.qty) + "</td>" +
        '<td class="num">' + (it.unit == null ? '<span class="muted">—</span>' : money(it.unit)) + "</td>" +
        '<td class="num">' + (it.total == null ? '<span class="inv-onhand">on hand</span>' : money(it.total)) + "</td>" +
        "<td>" + esc(it.vendor || "—") + "</td>" +
        "<td>" + esc(it.purchased || "") + "</td></tr>";
    }).join("") : '<tr><td colspan="8" class="muted">Nothing matches. Try fewer words, or clear the category and vendor filters.</td></tr>';

    var sum = shown.reduce(function (s, it) { return s + (it.total || 0); }, 0);
    $("inv-shown-total").textContent = money(sum);
    $("inv-count").textContent = shown.length === ITEMS.length
      ? "Showing all " + ITEMS.length + " line items"
      : "Showing " + shown.length + " of " + ITEMS.length + " line items · " + money(sum);
  }

  /* ---------- CSV of whatever is currently shown ---------- */
  function csvCell(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheets from treating text as a formula
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  $("inv-csv").addEventListener("click", function () {
    var head = ["Item", "Category", "SKU", "Qty", "Unit", "Total", "Vendor", "Purchased", "Notes", "URL"];
    var lines = [head.join(",")].concat(shown.map(function (it) {
      return [it.name, catLabel[it.cat] || it.cat, it.sku, it.qty, it.unit, it.total, it.vendor, it.purchased, it.notes, it.url].map(csvCell).join(",");
    }));
    var blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prime-symmetry-inventory.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  });

  render();
})();
