"""One-off script to rebuild the schedule page, widen content CSS, fix programming index,
   and re-run the lesson converter with fixed image copying."""

import re, os, shutil, json

SITE_ROOT  = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
MODULE_DIR = os.path.normpath(os.path.join(SITE_ROOT, "..", "impulse_3dsim", "modules", "ftc_starter_course"))
WP_DIR     = os.path.normpath(os.path.join(SITE_ROOT, "..", "impulse_3dsim", "docs", "planning", "wp"))

# ──────────────────────────────────────────────
# 1. SCHEDULE PAGE — use schedule_table.html
# ──────────────────────────────────────────────

with open(os.path.join(WP_DIR, "schedule_table.html"), encoding="utf-8") as f:
    raw = f.read()

# Strip the HTML comment header
raw = re.sub(r'<!--.*?-->', '', raw, flags=re.DOTALL).strip()

# Remove the Littleton/6328 address references
raw = re.sub(
    r'Meeting at 6328 headquarters.*?20 Harvard Rd Building D, Littleton, MA 01460</span>',
    'Optional Sunday buffer meeting',
    raw, flags=re.DOTALL
)

schedule_page = '---\nlayout: page\ntitle: "Schedule"\n---\n\n' + raw + '\n'
os.makedirs(os.path.join(SITE_ROOT, "schedule"), exist_ok=True)
with open(os.path.join(SITE_ROOT, "schedule", "index.html"), "w", encoding="utf-8") as f:
    f.write(schedule_page)
print("✓ Schedule page updated")

# ──────────────────────────────────────────────
# 2. WIDE-PAGE CSS — inject into Beautiful Jekyll via custom CSS file
# ──────────────────────────────────────────────

css = """\
/* Widen the main content area */
.container {
  max-width: 1200px !important;
}

.col-xl-8 {
  flex: 0 0 90% !important;
  max-width: 90% !important;
}

@media (min-width: 1200px) {
  .col-xl-8 {
    flex: 0 0 88% !important;
    max-width: 88% !important;
  }
}
"""
os.makedirs(os.path.join(SITE_ROOT, "assets", "css"), exist_ok=True)
with open(os.path.join(SITE_ROOT, "assets", "css", "custom.css"), "w", encoding="utf-8") as f:
    f.write(css)
print("✓ Custom wide CSS written")

# ──────────────────────────────────────────────
# 3. PROGRAMMING INDEX — collapsible tiers with icons
# ──────────────────────────────────────────────

programming_index = '''\
---
layout: page
title: "Programming Lessons"
---

<style>
.tier-section { margin-bottom: 1em; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
.tier-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer; user-select: none;
  background: #f8f9fa; border: none; width: 100%; text-align: left;
  font-size: 1.1em; font-weight: 700;
}
.tier-header:hover { background: #e9ecef; }
.tier-icon { font-size: 1.2em; }
.tier-count { font-size: 0.8em; font-weight: normal; color: #666; margin-left: auto; }
.tier-body { padding: 0 16px 8px; display: none; }
.tier-body.open { display: block; }
.lesson-card { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.lesson-card:last-child { border-bottom: none; }
.tier-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.78em; font-weight: bold; white-space: nowrap; }
.tier-easier { background: #d4edda; color: #155724; }
.tier-intermediate { background: #fff3cd; color: #856404; }
.tier-advanced { background: #f8d7da; color: #721c24; }
.lesson-card a { font-weight: bold; font-size: 1.05em; }
.lesson-card p { margin: 2px 0 0; color: #555; font-size: 0.92em; }
.intro-text { margin-bottom: 1.2em; color: #444; }
</style>

<p class="intro-text">Learn to program your FTC robot — from your first telemetry line to full autonomous navigation.
Click a tier to expand its lessons.</p>

<!-- EASIER -->
<div class="tier-section">
  <button class="tier-header" onclick="toggleTier(this)">
    <span class="tier-icon">🟢</span> Easier
    <span class="tier-count">8 lessons</span>
    <span>▼</span>
  </button>
  <div class="tier-body open">
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/welcome-to-pit/">Welcome to the PIT</a><p>A quick tour of the PIT training station and how everything works.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/robot-basics/">FTC Robot Basics</a><p>What is inside an FTC robot, how matches work, and where you fit in as the programmer.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/code-orientation/">Your Code Package</a><p>Tour the Java files in your package, understand init vs loop, and make your first code change.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/java-tour/">A Tour of Your Code</a><p>Walk through MecanumDrive.java line by line and learn the Java building blocks.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/telemetry/">Telemetry</a><p>Send debug messages to the Driver Hub so you can see what your code is doing.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/tank-drive/">Tank Drive</a><p>Wire up the joystick to the motors and make the robot drive like a tank.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/button-actions/">Button Actions: Intake</a><p>Make the A button toggle the intake on and off using a state machine.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-easier">Easier</span><div><a href="easier/auto-vs-teleop/">Auto vs TeleOp</a><p>Understand match phases, create your first Autonomous OpMode, and run a full match.</p></div></div>
  </div>
</div>

<!-- INTERMEDIATE -->
<div class="tier-section">
  <button class="tier-header" onclick="toggleTier(this)">
    <span class="tier-icon">🟦</span> Intermediate
    <span class="tier-count">5 lessons</span>
    <span>▶</span>
  </button>
  <div class="tier-body">
    <div class="lesson-card"><span class="tier-badge tier-intermediate">Intermediate</span><div><a href="intermediate/imu-heading/">IMU Heading</a><p>Read the gyroscope heading and test it on the turntable.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-intermediate">Intermediate</span><div><a href="intermediate/shooter-flywheel/">Flywheel Shooter</a><p>Spin up the flywheel shooter and understand how inertia affects your shots.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-intermediate">Intermediate</span><div><a href="intermediate/indexer-servo/">Indexer Servo</a><p>Wire up the CR servo indexer and fire balls into the spinning flywheel.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-intermediate">Intermediate</span><div><a href="intermediate/encoder-rpm/">Encoder: Flywheel RPM</a><p>Read the flywheel encoder to measure real-time RPM and watch the spin-up curve.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-intermediate">Intermediate</span><div><a href="intermediate/flywheel-trim/">Flywheel Trim</a><p>Use the right stick to adjust flywheel speed on the fly.</p></div></div>
  </div>
</div>

<!-- ADVANCED -->
<div class="tier-section">
  <button class="tier-header" onclick="toggleTier(this)">
    <span class="tier-icon">🔷</span> Advanced
    <span class="tier-count">6 lessons</span>
    <span>▶</span>
  </button>
  <div class="tier-body">
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/mecanum-drive/">Mecanum Drive</a><p>Replace tank drive with full mecanum holonomic movement.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/otos/">SparkFun OTOS</a><p>Track your robot\'s position with the Optical Tracking Odometry Sensor.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/apriltag/">AprilTag Detection</a><p>Use the robot camera to detect AprilTags for autonomous alignment.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/localization/">Localization</a><p>Fuse OTOS and AprilTag data into a single drift-free position estimate.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/pedro-pathing/">Pedro Pathing: Capture Mode</a><p>Record a path and run a full autonomous using Pedro Pathing.</p></div></div>
    <div class="lesson-card"><span class="tier-badge tier-advanced">Advanced</span><div><a href="advanced/flywheel-control/">Flywheel Control</a><p>Use feedforward and proportional feedback to hold the flywheel at a target RPM.</p></div></div>
  </div>
</div>

<script>
function toggleTier(btn) {
  const body = btn.nextElementSibling;
  const arrow = btn.querySelector('span:last-child');
  if (body.classList.contains('open')) {
    body.classList.remove('open');
    arrow.textContent = '▶';
  } else {
    body.classList.add('open');
    arrow.textContent = '▼';
  }
}
</script>
'''

with open(os.path.join(SITE_ROOT, "programming", "index.html"), "w", encoding="utf-8") as f:
    f.write(programming_index)
print("✓ Programming index updated with collapsible tiers")

# ──────────────────────────────────────────────
# 4. RE-RUN LESSON CONVERTER with fixed image copying
# ──────────────────────────────────────────────

MODULE_JSON = os.path.join(MODULE_DIR, "module.json")
with open(MODULE_JSON, encoding="utf-8") as f:
    module = json.load(f)

CATEGORY_DIR = {"programming": "programming", "electrical": "electrical", "mechanical": "mechanical"}

image_count = 0
for lesson in module["lessons"]:
    category = lesson.get("category", "programming")
    tier     = lesson.get("tier", "easier")
    lid      = lesson["id"]
    folder   = lesson["folder"]

    lesson_dir = os.path.join(MODULE_DIR, folder)
    tier_slug  = tier
    id_slug    = lid.replace("_", "-")
    out_dir    = os.path.join(SITE_ROOT, CATEGORY_DIR[category], tier_slug, id_slug)

    # Copy images/ subfolder
    src_img_dir = os.path.join(lesson_dir, "images")
    dst_img_dir = os.path.join(out_dir, "images")
    if os.path.isdir(src_img_dir):
        if os.path.exists(dst_img_dir):
            shutil.rmtree(dst_img_dir)
        shutil.copytree(src_img_dir, dst_img_dir)
        count = len(os.listdir(dst_img_dir))
        image_count += count

    # Copy any images sitting directly in the lesson root (referenced without path)
    for fname in os.listdir(lesson_dir):
        if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')):
            src = os.path.join(lesson_dir, fname)
            dst = os.path.join(out_dir, fname)
            shutil.copy2(src, dst)
            image_count += 1

print(f"✓ Images copied: {image_count} total")
print("\nAll done.")
