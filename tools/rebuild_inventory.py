#!/usr/bin/env python3
"""Rebuild the website inventory page's goBILDA misc section from PDF receipts.

This replaces the old grouped misc rows with fully itemized rows and updates:
- misc subtotal in summary bar
- total invoiced in summary bar
- misc value in pie chart label/data
- note text describing grouping behavior

Usage:
  c:/my_stuff/ftc/.venv/Scripts/python.exe website/tools/rebuild_inventory.py
"""

from __future__ import annotations

import html
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]  # c:/my_stuff/ftc
INVENTORY_HTML = ROOT / "website" / "resources" / "inventory" / "index.html"
RECEIPTS_DIR = ROOT / "ftc_receipts"

PRICE_FULL_RE = re.compile(r"^\$([0-9,]+\.\d{2})\s+\$([0-9,]+\.\d{2})$")
PRICE_INLINE_RE = re.compile(r"^(.*?)\s+\$([0-9,]+\.\d{2})\s+\$([0-9,]+\.\d{2})$")

# These SKUs are already listed in non-misc categories on the page.
EXCLUDED_SKUS = {
    "5203-2402-0001",  # motor
    "5203-2402-0005",  # motor
    "5203-2402-0019",  # motor
    "2000-0025-0004",  # servo
    "2000-0025-0002",  # servo
    "3217-0001-2501",  # servoblock
    "2004-0025-0002",  # Axon MAX Servo MK2
    "3102-0002-0001",  # Axon Servo Programmer MK2
    "3625-0202-0104",  # mecanum wheels
    "3103-0005-0001",  # floodgate power switch
    "3100-0012-0020",  # battery
    "3125-0001-0001",  # 6V Servo Power Injector
    "3203-3110-0002",  # 4-Bar Odometry Pack (Pinpoint)
}

# Some receipts are order summaries that list items WITHOUT a SKU, so the SKU
# filter above cannot catch them. These items are already itemized in fixed
# non-misc categories, so exclude them from Misc by normalized name to avoid
# double-counting (this was the cause of a ~$1,044.90 overcount).
EXCLUDED_NAME_KEYS = {
    "axonmaxservomk2",                         # 2004-0025-0002
    "axonservoprogrammermk2",                  # 3102-0002-0001
    "6vservopowerinjector6channel815vinput",   # 3125-0001-0001
    "4barodometrypack2pods1pinpointcomputer",  # 3203-3110-0002
}


def norm_name(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


# Fixed non-misc category subtotals shown on the inventory page. These are the
# single source of truth for the summary bar + pie-chart aggregate slices.
CAT_TOTALS = {
    "Motors": 577.36,
    "Servos": 776.34,
    "Drive": 284.98,
    "Power": 564.88,   # floodgate 69.98 + battery 389.92 (qty 8) + injector 104.98
    "Electronics": 1850.00,
    "Vision/Sensors": 797.98,
    "Field": 1571.00,
}
BASE_NON_MISC_TOTAL = sum(CAT_TOTALS.values())

# Sum of curated goBILDA line-totals (motors + servos + drive + power + odometry).
# Used to detect drift when a curated-category quantity changes on a new receipt.
CURATED_GOBILDA_TOTAL = 2623.54

SUBTOTAL_RE = re.compile(r"^Subtotal\s+\$([0-9,]+\.\d{2})$")


@dataclass
class ItemAgg:
    sku: str
    name: str
    qty: int = 0
    total: float = 0.0
    dates: set[datetime] = field(default_factory=set)

    @property
    def unit_cost(self) -> float:
        if self.qty <= 0:
            return 0.0
        return self.total / self.qty

    @property
    def purchased_label(self) -> str:
        if not self.dates:
            return "Unknown"
        ds = sorted(self.dates)
        if len(ds) == 1:
            return ds[0].strftime("%b %d, %Y").replace(" 0", " ")
        return f"Multiple ({ds[0].strftime('%b %Y')} - {ds[-1].strftime('%b %Y')})"


def parse_receipt_date(pdf_name: str) -> datetime | None:
    # filenames like gobilda_kevin_89p79_052126.pdf
    m = re.search(r"_(\d{6})\.pdf$", pdf_name)
    if not m:
        return None
    return datetime.strptime(m.group(1), "%m%d%y")


def load_lines(pdf_path: Path) -> list[str]:
    text = "\n".join((page.extract_text() or "") for page in PdfReader(str(pdf_path)).pages)
    text = text.replace("\uFFFD", "")
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def parse_gobilda_items(pdf_path: Path) -> list[tuple[int, str, str, float]]:
    """Return list of (qty, sku, name, line_total). sku may be ''."""
    lines = load_lines(pdf_path)
    items: list[tuple[int, str, str, float]] = []

    i = 0
    while i < len(lines):
        ln = lines[i]
        qty: int | None = None
        sku: str = ""
        name_parts: list[str] = []
        unit = None
        total = None

        # Pattern A: qty + sku-prefix ending in dash, next line has suffix.
        m = re.match(r"^(\d+)\s+(\d{4}-\d{4}-)$", ln)
        if m and i + 1 < len(lines):
            qty = int(m.group(1))
            sku = (m.group(2) + lines[i + 1]).replace(" ", "")
            i += 2
        else:
            # Pattern B: qty + full 4-4-4 sku on same line (sometimes name starts immediately).
            m2 = re.match(r"^(\d+)\s+(\d{4}-\d{4}-\d{4})(.*)$", ln)
            if m2:
                qty = int(m2.group(1))
                sku = m2.group(2)
                rest = m2.group(3).strip()
                i += 1
                if rest:
                    pm = PRICE_INLINE_RE.match(rest)
                    if pm:
                        name_parts.append(pm.group(1).strip())
                        unit = float(pm.group(2).replace(",", ""))
                        total = float(pm.group(3).replace(",", ""))
                    else:
                        name_parts.append(rest)
            else:
                # Pattern B2: qty + plain numeric SKU. goBILDA resells third-party
                # items under a plain integer SKU (e.g. "2 44370 Hitec RDX2 200 ...").
                # These matched no pattern before and vanished from all totals.
                m2b = re.match(r"^(\d+)\s+(\d{3,6})\s+(\S.*)$", ln)
                if m2b:
                    qty = int(m2b.group(1))
                    sku = m2b.group(2)
                    rest = m2b.group(3).strip()
                    i += 1
                    pm = PRICE_INLINE_RE.match(rest)
                    if pm:
                        name_parts.append(pm.group(1).strip())
                        unit = float(pm.group(2).replace(",", ""))
                        total = float(pm.group(3).replace(",", ""))
                    else:
                        name_parts.append(rest)

        if qty is not None:
            while unit is None and i < len(lines):
                cur = lines[i]
                if re.match(
                    r"^(Subtotal|Shipping|Tax|Grand total|Order:|Payment Method:|Order Date:|Shipping Method:|Qty Code/SKU Product Name Price Total|Comments)$",
                    cur,
                ):
                    break

                pm_full = PRICE_FULL_RE.match(cur)
                if pm_full:
                    unit = float(pm_full.group(1).replace(",", ""))
                    total = float(pm_full.group(2).replace(",", ""))
                    i += 1
                    break

                pm_inline = PRICE_INLINE_RE.match(cur)
                if pm_inline:
                    name_parts.append(pm_inline.group(1).strip())
                    unit = float(pm_inline.group(2).replace(",", ""))
                    total = float(pm_inline.group(3).replace(",", ""))
                    i += 1
                    break

                if re.match(r"^\d+\s+\d{4}-\d{4}-", cur):
                    break

                name_parts.append(cur)
                i += 1

            if total is not None and name_parts:
                name = " ".join(name_parts)
                name = re.sub(r"\s+", " ", name).strip()
                items.append((qty, sku, name, total))
            continue

        # Pattern C: simple order-summary lines (no SKU), e.g. "8 x Name $41.92"
        m3 = re.match(r"^(\d+)\s+x\s+(.+?)\s+\$([0-9,]+\.\d{2})$", ln)
        if m3:
            qty = int(m3.group(1))
            name = re.sub(r"\s+", " ", m3.group(2)).strip()
            total = float(m3.group(3).replace(",", ""))
            items.append((qty, "", name, total))
            i += 1
            continue

        i += 1

    return items


def build_misc_aggregates() -> list[ItemAgg]:
    aggs: dict[str, ItemAgg] = defaultdict(lambda: ItemAgg(sku="", name=""))

    name_to_key: dict[str, str] = {}

    for pdf in sorted(RECEIPTS_DIR.glob("gobilda_*.pdf")):
        receipt_dt = parse_receipt_date(pdf.name)
        for qty, sku, name, line_total in parse_gobilda_items(pdf):
            if sku in EXCLUDED_SKUS or norm_name(name) in EXCLUDED_NAME_KEYS:
                continue

            nn = norm_name(name)
            if sku:
                key = sku
                # If we previously saw this as a no-SKU entry, merge into the SKU key.
                prev = name_to_key.get(nn)
                if prev and prev != key and prev in aggs:
                    prev_agg = aggs.pop(prev)
                    if key not in aggs:
                        aggs[key] = ItemAgg(sku=sku, name=name)
                    aggs[key].qty += prev_agg.qty
                    aggs[key].total += prev_agg.total
                    aggs[key].dates.update(prev_agg.dates)
                name_to_key[nn] = key
            else:
                # Prefer an existing SKU key if the normalized name matches.
                key = name_to_key.get(nn, f"NAME::{nn}")

            agg = aggs[key]
            if not agg.name:
                agg.name = name
            if not agg.sku:
                agg.sku = sku
            agg.qty += qty
            agg.total += line_total
            if receipt_dt:
                agg.dates.add(receipt_dt)

    rows = list(aggs.values())
    rows.sort(key=lambda x: (-x.total, x.name.lower()))
    return rows


def money(value: float) -> str:
    return f"${value:,.2f}"


def reconcile(misc_total: float) -> bool:
    """Cross-check parsed receipts against printed subtotals and curated rows.

    Catches the two silent failure modes that caused past accounting errors:
      1. a receipt line item dropped by the parser (parsed sum < printed Subtotal)
      2. a curated-category quantity that changed on a new receipt but was never
         updated in the fixed rows (curated receipt sum drifts from the constant)
    """
    ok = True
    total_gobilda = 0.0
    curated_seen = 0.0
    print("\nReconciliation:")
    for pdf in sorted(RECEIPTS_DIR.glob("gobilda_*.pdf")):
        items = parse_gobilda_items(pdf)
        captured = round(sum(t for _, _, _, t in items), 2)
        total_gobilda += captured
        for _, sku, name, t in items:
            if sku in EXCLUDED_SKUS or norm_name(name) in EXCLUDED_NAME_KEYS:
                curated_seen += t
        subs = [
            float(m.group(1).replace(",", ""))
            for ln in load_lines(pdf)
            if (m := SUBTOTAL_RE.match(ln))
        ]
        printed = max(subs) if subs else None
        if printed is not None and abs(captured - printed) > 0.01:
            ok = False
            print(f"  [FAIL] {pdf.name}: parsed {money(captured)} vs printed Subtotal "
                  f"{money(printed)} (missing {money(printed - captured)})")
        else:
            print(f"  [ok]   {pdf.name}: {money(captured)}")

    total_gobilda = round(total_gobilda, 2)
    curated_seen = round(curated_seen, 2)
    if abs(curated_seen - CURATED_GOBILDA_TOTAL) > 0.01:
        ok = False
        print(f"  [FAIL] curated goBILDA rows drift: receipts total {money(curated_seen)} for "
              f"curated SKUs but the page hardcodes {money(CURATED_GOBILDA_TOTAL)} "
              f"(diff {money(curated_seen - CURATED_GOBILDA_TOTAL)}). Update the fixed rows "
              f"and CURATED_GOBILDA_TOTAL / CAT_TOTALS.")
    if abs((CURATED_GOBILDA_TOTAL + misc_total) - total_gobilda) > 0.01:
        ok = False
        print(f"  [FAIL] invariant: curated {money(CURATED_GOBILDA_TOTAL)} + misc "
              f"{money(misc_total)} != total goBILDA line items {money(total_gobilda)}")
    print(f"  total goBILDA line items: {money(total_gobilda)} "
          f"(curated {money(CURATED_GOBILDA_TOTAL)} + misc {money(misc_total)})")
    print("  RECONCILED OK" if ok else "  *** RECONCILIATION PROBLEMS ABOVE ***")
    return ok


def make_misc_rows(rows: list[ItemAgg]) -> str:
    out: list[str] = []
    for r in rows:
        sku_text = r.sku if r.sku else "—"
        search = f"misc gobilda {r.name} {r.sku}".lower()
        out.append(
            "\n".join(
                [
                    f'    <tr class="data-row row-misc" data-cat="misc" data-search="{html.escape(search, quote=True)}">',
                    f"      <td>{html.escape(r.name)} <span class=\"tag tag-misc\">Misc</span></td>",
                    f"      <td class=\"sku\">{html.escape(sku_text)}</td>",
                    "      <td>Misc</td>",
                    f"      <td class=\"qty\">{r.qty}</td>",
                    f"      <td class=\"cost\">{money(r.unit_cost)}</td>",
                    f"      <td class=\"cost\">{money(r.total)}</td>",
                    "      <td>goBILDA</td>",
                    f"      <td>{html.escape(r.purchased_label)}</td>",
                    "      <td>Itemized from goBILDA receipts</td>",
                    "    </tr>",
                ]
            )
        )
    return "\n\n".join(out)


def main() -> None:
    html_text = INVENTORY_HTML.read_text(encoding="utf-8")

    rows = build_misc_aggregates()
    misc_total = round(sum(r.total for r in rows), 2)
    grand_total = round(BASE_NON_MISC_TOTAL + misc_total, 2)

    # 1) Update note text.
    html_text = re.sub(
        r'<p class="inv-note">.*?</p>',
        '<p class="inv-note">All receipted goBILDA parts are now listed individually (no grouped Misc order rows).</p>',
        html_text,
        count=1,
        flags=re.DOTALL,
    )

    # 2) Update misc + total values in summary bar.
    html_text = re.sub(
        r'Misc goBILDA:\s*<strong>\$[0-9,]+\.\d{2}</strong>',
        f'Misc goBILDA: <strong>{money(misc_total)}</strong>',
        html_text,
        count=1,
    )
    html_text = re.sub(
        r'Total invoiced:\s*<strong style="color:#b71c1c;">\$[0-9,]+\.\d{2}</strong>',
        f'Total invoiced: <strong style="color:#b71c1c;">{money(grand_total)}</strong>',
        html_text,
        count=1,
    )

    # 2b) Update fixed per-category subtotals in the summary bar.
    for label, val in CAT_TOTALS.items():
        html_text = re.sub(
            rf'{re.escape(label)}: <strong>\$[0-9,]+\.\d{{2}}</strong>',
            f'{label}: <strong>{money(val)}</strong>',
            html_text,
            count=1,
        )

    # 3) Replace misc category block (header + rows).
    misc_rows_html = make_misc_rows(rows)
    new_misc_block = (
        '    <!-- ── MISC GOBILDA PARTS ───────────────────────────────── -->\n'
        '    <tr class="inv-cat inv-misc" data-cat="misc">\n'
        '      <td colspan="9">⚙️ Misc goBILDA Parts (itemized from receipts)</td>\n'
        '    </tr>\n\n'
        f'{misc_rows_html}\n'
    )

    html_text = re.sub(
        r'\s*<!-- ── MISC GOBILDA PARTS[\s\S]*?</tr>\n\n\s*</tbody>',
        "\n" + new_misc_block + "\n  </tbody>",
        html_text,
        count=1,
    )

    # 4) Rebuild pie chart labels + data from the single-source CAT_TOTALS + misc.
    pie = [
        ("Motors", CAT_TOTALS["Motors"]),
        ("Servos", CAT_TOTALS["Servos"]),
        ("Drive", CAT_TOTALS["Drive"]),
        ("Power", CAT_TOTALS["Power"]),
        ("Electronics (REV)", CAT_TOTALS["Electronics"]),
        ("Vision/Sensors", CAT_TOTALS["Vision/Sensors"]),
        ("Field Equipment", CAT_TOTALS["Field"]),
        ("Misc goBILDA", misc_total),
    ]
    pie_labels = ",\n".join(f"        '{name} \u2014 {money(val)}'" for name, val in pie)
    html_text = re.sub(
        r"labels:\s*\[[\s\S]*?\],",
        "labels: [\n" + pie_labels + "\n      ],",
        html_text,
        count=1,
    )
    pie_data = ", ".join(f"{val:.2f}" for _, val in pie)
    html_text = re.sub(
        r"data:\s*\[[0-9.,\s]+\],",
        f"data: [{pie_data}],",
        html_text,
        count=1,
    )

    # 5) Set visible row count and call update() initially.
    data_rows_count = len(re.findall(r'class="data-row\s', html_text))
    html_text = re.sub(
        r'Showing <strong id="visible-count">\d+</strong> rows',
        f'Showing <strong id="visible-count">{data_rows_count}</strong> rows',
        html_text,
        count=1,
    )
    html_text = html_text.replace(
        "  searchInput.addEventListener('input', update);\n})();",
        "  searchInput.addEventListener('input', update);\n  update();\n})();",
    )

    INVENTORY_HTML.write_text(html_text, encoding="utf-8")

    print(f"Updated: {INVENTORY_HTML}")
    print(f"Itemized misc rows: {len(rows)}")
    print(f"Misc subtotal: {money(misc_total)}")
    print(f"Total invoiced: {money(grand_total)}")

    reconcile(misc_total)


if __name__ == "__main__":
    main()
