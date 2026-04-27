"""
fix_images.py — For each lesson output folder, copy all files from images/
to the lesson root so that <img src="filename.jpg"> works.
"""
import os, shutil, re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_ROOT  = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))

count = 0
for root, dirs, files in os.walk(SITE_ROOT):
    if "index.html" in files and "images" in dirs:
        img_src = os.path.join(root, "images")
        for img in os.listdir(img_src):
            if img.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')):
                dst = os.path.join(root, img)
                if not os.path.exists(dst):
                    shutil.copy2(os.path.join(img_src, img), dst)
                    count += 1

print(f"Copied {count} images to lesson roots.")
