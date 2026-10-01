#!/usr/bin/env python3
"""Regenerate the receipt-itemized goBILDA rows in website/_data/inventory.json from PDF receipts.

Items with "source": "receipts" are rebuilt from ftc_receipts/gobilda_*.pdf; "source": "manual"
items (motors, servos, REV hubs, Amazon/AndyMark/Limelight purchases, on-hand gear) are kept as-is.
The inventory page computes every total itself, so nothing else needs updating.

Usage:
  c:/my_stuff/ftc/.venv/Scripts/python.exe website/tools/rebuild_inventory.py
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]  # c:/my_stuff/ftc
INVENTORY_JSON = ROOT / "website" / "_data" / "inventory.json"
RECEIPTS_DIR = ROOT / "ftc_receipts"

PRICE_FULL_RE = re.compile(r"^\$([0-9,]+\.\d{2})\s+\$([0-9,]+\.\d{2})$")
PRICE_INLINE_RE = re.compile(r"^(.*?)\s+\$([0-9,]+\.\d{2})\s+\$([0-9,]+\.\d{2})$")

# These SKUs are curated as "manual" rows in inventory.json (not receipt-itemized).
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

        # Pattern D: order-page printout where unit price and qty are fused, then the name,
        # then "SKU: ..." on its own line, e.g. "$2.244 × 3.5mm Bullet Extension" = $2.24 x 4.
        m4 = re.match(r"^\$([0-9,]+\.\d{2})(\d+)\s*×\s*(.+)$", ln)
        if m4:
            unit = float(m4.group(1).replace(",", ""))
            qty = int(m4.group(2))
            name_parts = [m4.group(3).strip()]
            sku = ""
            i += 1
            while i < len(lines):
                sm = re.match(r"^SKU:\s*(\S+)$", lines[i])
                if sm:
                    sku = sm.group(1)
                    i += 1
                    break
                if re.match(r"^\$[0-9,]+\.\d{2}\d+\s*×", lines[i]):
                    break
                name_parts.append(lines[i])
                i += 1
            name = re.sub(r"\s+", " ", " ".join(name_parts)).strip()
            items.append((qty, sku, name, round(unit * qty, 2)))
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


def reconcile(misc_total: float, curated_total: float) -> bool:
    """Cross-check parsed receipts against printed subtotals and curated rows.

    Catches the two silent failure modes that caused past accounting errors:
      1. a receipt line item dropped by the parser (parsed sum < printed Subtotal)
      2. a curated-category quantity that changed on a new receipt but was never
         updated in inventory.json's manual rows (curated receipt sum drifts from them)
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
        lines = load_lines(pdf)
        for k, ln in enumerate(lines):
            if ln == "Subtotal:":  # newer layout: labels first, amounts on the following lines
                amt = next((x for x in lines[k + 1:k + 5] if re.fullmatch(r"\$[0-9,]+\.\d{2}", x)), None)
                if amt:
                    subs.append(float(amt[1:].replace(",", "")))
        printed = max(subs) if subs else None
        if printed is not None and abs(captured - printed) > 0.01:
            ok = False
            print(f"  [FAIL] {pdf.name}: parsed {money(captured)} vs printed Subtotal "
                  f"{money(printed)} (missing {money(printed - captured)})")
        else:
            print(f"  [ok]   {pdf.name}: {money(captured)}")

    total_gobilda = round(total_gobilda, 2)
    curated_seen = round(curated_seen, 2)
    if abs(curated_seen - curated_total) > 0.01:
        ok = False
        print(f"  [FAIL] curated goBILDA rows drift: receipts total {money(curated_seen)} for "
              f"curated SKUs but inventory.json's manual rows sum to {money(curated_total)} "
              f"(diff {money(curated_seen - curated_total)}). Update those manual rows.")
    if abs((curated_total + misc_total) - total_gobilda) > 0.01:
        ok = False
        print(f"  [FAIL] invariant: curated {money(curated_total)} + misc "
              f"{money(misc_total)} != total goBILDA line items {money(total_gobilda)}")
    print(f"  total goBILDA line items: {money(total_gobilda)} "
          f"(curated {money(curated_total)} + misc {money(misc_total)})")
    print("  RECONCILED OK" if ok else "  *** RECONCILIATION PROBLEMS ABOVE ***")
    return ok


def to_item(r: ItemAgg) -> dict:
    return {
        "name": r.name,
        "sku": r.sku,
        "cat": "misc",
        "qty": r.qty,
        "unit": round(r.unit_cost, 2),
        "total": round(r.total, 2),
        "vendor": "goBILDA",
        "purchased": r.purchased_label,
        "source": "receipts",
    }


def main() -> None:
    data = json.loads(INVENTORY_JSON.read_text(encoding="utf-8"))
    manual = [i for i in data["items"] if i.get("source") != "receipts"]
    curated_total = round(sum(i.get("total") or 0 for i in manual if i.get("sku") in EXCLUDED_SKUS), 2)

    rows = build_misc_aggregates()
    misc_total = round(sum(r.total for r in rows), 2)
    data["items"] = manual + [to_item(r) for r in rows]
    data["updated"] = date.today().isoformat()

    with INVENTORY_JSON.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write("\n")

    grand = round(sum(i.get("total") or 0 for i in data["items"]), 2)
    print(f"Updated: {INVENTORY_JSON}")
    print(f"Manual rows kept: {len(manual)}  receipt rows: {len(rows)}")
    print(f"Receipt-itemized goBILDA subtotal: {money(misc_total)}")
    print(f"Grand total (page computes the same): {money(grand)}")

    reconcile(misc_total, curated_total)


if __name__ == "__main__":
    main()
