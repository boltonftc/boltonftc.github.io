#!/usr/bin/env python3
"""
Port goBILDA WP snippet HTML files to Jekyll pages.

Usage:
    python port_parts.py

Reads WP snippets from: ../../impulse_3dsim/docs/planning/wp/
Writes Jekyll pages to:  ../mechanical/gobilda-ri3d/<slug>/index.html
"""

import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT  = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
WP_DIR     = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "impulse_3dsim", "docs", "planning", "wp"))
OUT_ROOT   = os.path.join(SITE_ROOT, "mechanical", "gobilda-ri3d")

# Sub-assemblies to port, in display order
PARTS_PAGES = [
    ("left_side_mecanum_drivetrain", "Left Side Mecanum Drivetrain"),
    ("right_side_mecanum_drivetrain", "Right Side Mecanum Drivetrain"),
    ("lower_intake",                  "Lower Intake"),
    ("upper_intake",                  "Upper Intake"),
    ("indexer",                       "Indexer"),
    ("shooter",                       "Shooter"),
    ("shooter_sub_assembly",          "Shooter Sub-Assembly"),
    ("upper_front",                   "Upper Front"),
    ("upper_right",                   "Upper Right"),
    ("upper_left",                    "Upper Left"),
    ("upper_back",                    "Upper Back"),
    ("deflector",                     "Deflector"),
]

FRONT_MATTER_TMPL = """---
layout: page
title: "{title} — Parts List"
---

"""

def port_page(slug, title):
    src = os.path.join(WP_DIR, f"{slug}.html")
    if not os.path.exists(src):
        print(f"  MISSING: {src}")
        return

    with open(src, "r", encoding="utf-8") as f:
        content = f.read()

    # Strip any stray <html>/<body>/<head> tags if present (WP snippets are fragments)
    content = re.sub(r'<(!DOCTYPE[^>]+|html[^>]*|head[^>]*|/head|body[^>]*|/body|/html)>', '', content, flags=re.IGNORECASE).strip()

    jekyll_slug = slug.replace("_", "-")
    out_dir  = os.path.join(OUT_ROOT, jekyll_slug)
    out_file = os.path.join(out_dir, "index.html")
    os.makedirs(out_dir, exist_ok=True)

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(FRONT_MATTER_TMPL.format(title=title))
        f.write(content)
        f.write("\n")

    print(f"  OK  {title} -> mechanical/gobilda-ri3d/{jekyll_slug}/index.html")


def main():
    print("Porting parts pages to Jekyll...\n")
    for slug, title in PARTS_PAGES:
        port_page(slug, title)
    print("\nDone.")


if __name__ == "__main__":
    main()
