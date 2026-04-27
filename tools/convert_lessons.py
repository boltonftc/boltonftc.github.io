#!/usr/bin/env python3
"""
Convert FTC starter course lesson.md files to Jekyll HTML pages.

Usage:
    python convert_lessons.py

Reads from: ../../impulse_3dsim/modules/ftc_starter_course/
Writes to:  ../ (Jekyll site root, relative to this tools/ folder)
"""

import re
import os
import json
import shutil

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT    = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))
MODULE_DIR   = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "..", "impulse_3dsim", "modules", "ftc_starter_course"))
MODULE_JSON  = os.path.join(MODULE_DIR, "module.json")

TIER_LABEL = {
    "easier":       "Easier",
    "intermediate": "Intermediate",
    "advanced":     "Advanced",
}

CATEGORY_DIR = {
    "programming": "programming",
    "electrical":  "electrical",
    "mechanical":  "mechanical",
}

# ─────────────────────────────────────────────────────────────────────────────
# Markdown + custom-block converter
# ─────────────────────────────────────────────────────────────────────────────

BLOCK_STYLES = {
    "KEY_IDEA": ("key-idea",  "💡 Key Idea"),
    "CODE":     ("code-block","&gt;&gt; Type This Code"),
    "TODO":     ("todo",      "✅ To Do"),
    "HINT":     ("hint",      "💜 Hint"),
}

def convert_custom_blocks(text):
    """Replace <!-- BLOCK -->...<!-- /BLOCK --> with styled divs."""
    for tag, (css_class, label) in BLOCK_STYLES.items():
        pattern = rf'<!--\s*{tag}\s*-->(.*?)<!--\s*/{tag}\s*-->'
        def replacer(m, css_class=css_class, label=label):
            inner = m.group(1).strip()
            # If it contains a fenced code block, keep it raw
            inner_html = convert_fenced_code(inner)
            return (f'<div class="lesson-block {css_class}">'
                    f'<div class="block-label">{label}</div>'
                    f'<div class="block-body">{inner_html}</div>'
                    f'</div>')
        text = re.sub(pattern, replacer, text, flags=re.DOTALL)
    return text


def convert_action_tags(text):
    """Replace <!-- ACTION:... --> with a dim simulator-only note."""
    def replacer(m):
        full = m.group(0)
        if "revert" in full or "complete" in full:
            return ""  # skip revert/complete buttons entirely
        # open_file or scroll_to — show as a greyed simulator reference
        inner = re.sub(r'<!--\s*ACTION:\w+\s*', '', full).replace('-->', '').strip().strip('"')
        if "|" in inner:
            fname, marker = inner.split("|", 1)
            label = f"[ {fname.strip()} › {marker.strip()} ]"
        else:
            label = f"[ {inner} ]" if inner else "[ action ]"
        return f'<span class="sim-action" title="Simulator action only">{label}</span>'
    return re.sub(r'<!--\s*ACTION:[^>]*-->', replacer, text)


def convert_fenced_code(text):
    """Convert ```lang ... ``` to <pre><code> blocks."""
    def replacer(m):
        lang = m.group(1).strip() if m.group(1) else ""
        code = m.group(2)
        import html as h
        return f'<pre><code class="language-{lang}">{h.escape(code)}</code></pre>'
    return re.sub(r'```(\w*)\n(.*?)```', replacer, text, flags=re.DOTALL)


def convert_inline_markdown(text):
    """Convert basic inline markdown: bold, italic, inline code, links, images."""
    import html as h
    # Images before links
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',
                  lambda m: f'<img src="{m.group(2)}" alt="{h.escape(m.group(1))}" class="lesson-img">',
                  text)
    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)',
                  lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>',
                  text)
    # Inline code
    text = re.sub(r'`([^`]+)`', lambda m: f'<code>{h.escape(m.group(1))}</code>', text)
    # Bold
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text


def md_to_html(text):
    """Full markdown + custom block conversion pipeline."""
    # 1. Custom blocks first (preserve their interior)
    text = convert_custom_blocks(text)
    # 2. Action tags
    text = convert_action_tags(text)
    # 3. Fenced code blocks (outside custom blocks)
    text = convert_fenced_code(text)
    # 4. Split into lines and process block-level elements
    lines = text.split("\n")
    output = []
    i = 0
    in_ul = False
    in_ol = False
    in_p = False

    def close_list():
        nonlocal in_ul, in_ol
        if in_ul:
            output.append("</ul>")
            in_ul = False
        if in_ol:
            output.append("</ol>")
            in_ol = False

    def close_p():
        nonlocal in_p
        if in_p:
            output.append("</p>")
            in_p = False

    while i < len(lines):
        line = lines[i]

        # Skip if already an HTML tag (from block conversion above)
        if line.strip().startswith("<div") or line.strip().startswith("</div") or \
           line.strip().startswith("<pre") or line.strip().startswith("</pre") or \
           line.strip().startswith("<span"):
            close_list(); close_p()
            output.append(line)
            i += 1
            continue

        # Headings
        heading_m = re.match(r'^(#{1,4})\s+(.+)', line)
        if heading_m:
            close_list(); close_p()
            level = len(heading_m.group(1))
            content = convert_inline_markdown(heading_m.group(2))
            output.append(f'<h{level}>{content}</h{level}>')
            i += 1
            continue

        # Horizontal rule
        if re.match(r'^---+\s*$', line):
            close_list(); close_p()
            output.append('<hr>')
            i += 1
            continue

        # Unordered list
        ul_m = re.match(r'^[\*\-]\s+(.+)', line)
        if ul_m:
            close_p()
            if not in_ul:
                if in_ol: output.append("</ol>"); in_ol = False
                output.append("<ul>")
                in_ul = True
            output.append(f'<li>{convert_inline_markdown(ul_m.group(1))}</li>')
            i += 1
            continue

        # Ordered list
        ol_m = re.match(r'^\d+\.\s+(.+)', line)
        if ol_m:
            close_p()
            if not in_ol:
                if in_ul: output.append("</ul>"); in_ul = False
                output.append("<ol>")
                in_ol = True
            output.append(f'<li>{convert_inline_markdown(ol_m.group(1))}</li>')
            i += 1
            continue

        # Blank line
        if not line.strip():
            close_list(); close_p()
            i += 1
            continue

        # Regular paragraph text
        close_list()
        if not in_p:
            output.append("<p>")
            in_p = True
        output.append(convert_inline_markdown(line))
        i += 1

    close_list(); close_p()
    return "\n".join(output)


# ─────────────────────────────────────────────────────────────────────────────
# Jekyll page wrapper
# ─────────────────────────────────────────────────────────────────────────────

LESSON_CSS = """<style>
.lesson-block { border-radius: 6px; margin: 1.2em 0; padding: 0; overflow: hidden; }
.block-label { font-size: 0.78em; font-weight: bold; padding: 4px 12px; letter-spacing: 0.05em; text-transform: uppercase; }
.block-body { padding: 10px 14px; }
.key-idea  { border: 2px solid #f0c040; }
.key-idea .block-label  { background: #f0c040; color: #333; }
.key-idea .block-body   { background: #fffbe6; }
.code-block { border: 2px solid #50c070; }
.code-block .block-label { background: #50c070; color: #fff; }
.code-block .block-body  { background: #f0fff4; }
.todo  { border: 2px solid #5090e0; }
.todo .block-label  { background: #5090e0; color: #fff; }
.todo .block-body   { background: #f0f4ff; }
.hint  { border: 2px solid #c080e0; }
.hint .block-label  { background: #c080e0; color: #fff; }
.hint .block-body   { background: #faf0ff; }
.sim-action { color: #aaa; font-style: italic; font-size: 0.9em; }
.lesson-img { max-width: 100%; border-radius: 6px; margin: 0.5em 0; }
.lesson-block pre { margin: 0; }
.lesson-block code { font-size: 0.9em; }
.tier-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.78em; font-weight: bold; margin-left: 8px; vertical-align: middle; }
.tier-easier { background: #d4edda; color: #155724; }
.tier-intermediate { background: #fff3cd; color: #856404; }
.tier-advanced { background: #f8d7da; color: #721c24; }
</style>
"""

def make_jekyll_page(title, category, tier, body_html, image_assets):
    tier_css = f"tier-{tier}"
    tier_label = TIER_LABEL.get(tier, tier.title())
    front_matter = f"""---
layout: page
title: "{title}"
---
"""
    header = (f'{LESSON_CSS}\n'
              f'<span class="tier-badge {tier_css}">{tier_label}</span>\n\n')
    return front_matter + header + body_html


# ─────────────────────────────────────────────────────────────────────────────
# File conversion
# ─────────────────────────────────────────────────────────────────────────────

def convert_lesson(lesson, module_dir, site_root):
    category = lesson.get("category", "programming")
    tier     = lesson.get("tier", "easier")
    title    = lesson["title"]
    folder   = lesson["folder"]
    lid      = lesson["id"]

    lesson_dir = os.path.join(module_dir, folder)
    md_path    = os.path.join(lesson_dir, "lesson.md")

    if not os.path.exists(md_path):
        print(f"  SKIP (no lesson.md): {lid}")
        return

    with open(md_path, "r", encoding="utf-8") as f:
        raw = f.read()

    # Determine output path
    out_dir  = os.path.join(site_root, CATEGORY_DIR[category], tier, lid.replace("_", "-"))
    out_file = os.path.join(out_dir, "index.html")
    img_dir  = os.path.join(out_dir, "images")
    os.makedirs(out_dir, exist_ok=True)

    # Copy images folder if present
    src_img_dir = os.path.join(lesson_dir, "images")
    if os.path.isdir(src_img_dir):
        if os.path.exists(img_dir):
            shutil.rmtree(img_dir)
        shutil.copytree(src_img_dir, img_dir)

    # Copy any top-level images referenced in the md
    for img_name in re.findall(r'!\[[^\]]*\]\(([^/)][^)]*\.[a-z]{3,4})\)', raw):
        src_img = os.path.join(lesson_dir, img_name)
        if os.path.exists(src_img):
            shutil.copy2(src_img, os.path.join(out_dir, img_name))

    # Fix image paths that reference images/ subfolder
    raw = re.sub(r'!\[([^\]]*)\]\(images/([^)]+)\)',
                 r'![\1](images/\2)', raw)

    body_html = md_to_html(raw)
    page = make_jekyll_page(title, category, tier, body_html, [])

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(page)

    print(f"  OK  [{category}/{tier}] {title} -> {os.path.relpath(out_file, site_root)}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    with open(MODULE_JSON, "r", encoding="utf-8") as f:
        module = json.load(f)

    lessons = module["lessons"]
    print(f"Converting {len(lessons)} lessons...\n")

    for lesson in lessons:
        convert_lesson(lesson, MODULE_DIR, SITE_ROOT)

    print("\nDone.")


if __name__ == "__main__":
    main()
