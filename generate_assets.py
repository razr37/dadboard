#!/usr/bin/env python3
"""
Generates Dadboard app assets:
  assets/icon.png              512 × 512    app icon (orange steering wheel)
  assets/feature-graphic.png   1024 × 500   Play Store banner

Run from the project root:  python3 generate_assets.py

Installs Pillow into a temporary venv on first run — no system packages modified.
"""
import os, sys, subprocess, math

# ── Bootstrap: ensure Pillow is available in a temporary venv ─────────────────
VENV    = '/tmp/dadboard_assets_venv'
VPYTHON = os.path.join(VENV, 'bin', 'python3')

if 'ASSETS_READY' not in os.environ:
    if not os.path.exists(VPYTHON):
        print('Installing Pillow into /tmp/dadboard_assets_venv …')
        subprocess.check_call([sys.executable, '-m', 'venv', VENV])
        subprocess.check_call([VPYTHON, '-m', 'pip', 'install', 'Pillow', '--quiet'])
    os.execve(VPYTHON, [VPYTHON, os.path.abspath(__file__)],
              {**os.environ, 'ASSETS_READY': '1'})

# ── Running with Pillow available ─────────────────────────────────────────────
from PIL import Image, ImageDraw, ImageFont

ORANGE    = (240, 124,  42)   # #F07C2A  — primary brand
DARK      = ( 28,  25,  23)   # #1C1917  — near-black warm
WHITE     = (255, 255, 255)
WARM_TEXT = (255, 195, 140)   # warm peachy-orange for secondary text


def steer(draw, cx, cy, outer_r, inner_r, hub_r, spoke_w, bg_color):
    """Steering wheel drawn with solid-color compositing.

    Layer order:
      1. White disk  (full wheel area)
      2. bg_color disk  (punches out the centre, leaving the ring)
      3. White spoke lines  (from hub edge to inner ring edge)
      4. White hub circle  (covers spoke ends at centre)
    """
    draw.ellipse([cx-outer_r, cy-outer_r, cx+outer_r, cy+outer_r], fill=WHITE)
    draw.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=bg_color)
    for deg in [270, 30, 150]:          # top spoke, lower-right, lower-left
        rad = math.radians(deg)
        x1 = cx + round(hub_r   * math.cos(rad))
        y1 = cy + round(hub_r   * math.sin(rad))
        x2 = cx + round(inner_r * math.cos(rad))
        y2 = cy + round(inner_r * math.sin(rad))
        draw.line([(x1, y1), (x2, y2)], fill=WHITE, width=spoke_w)
    draw.ellipse([cx-hub_r, cy-hub_r, cx+hub_r, cy+hub_r], fill=WHITE)


def load_font(size, bold=False):
    """Try macOS system fonts in order; fall back to PIL default."""
    candidates = [
        ('/System/Library/Fonts/HelveticaNeue.ttc', 1 if bold else 0),
        ('/System/Library/Fonts/HelveticaNeue.ttc', 0),
        ('/System/Library/Fonts/Helvetica.ttc',     0),
        ('/System/Library/Fonts/Supplemental/Arial.ttf', 0),
        ('/System/Library/Fonts/Supplemental/Tahoma.ttf', 0),
    ]
    for path, idx in candidates:
        if os.path.exists(path):
            for kw in [{'index': idx}, {}]:
                try:
                    return ImageFont.truetype(path, size, **kw)
                except Exception:
                    continue
    return ImageFont.load_default()


os.makedirs('assets', exist_ok=True)


# ── App Icon  512 × 512 ───────────────────────────────────────────────────────
IW = IH = 512
icon = Image.new('RGB', (IW, IH), ORANGE)
steer(ImageDraw.Draw(icon), IW // 2, IH // 2,
      outer_r=185, inner_r=148, hub_r=46, spoke_w=30, bg_color=ORANGE)

# Rounded-corner alpha mask (squircle feel; EAS/Play Store will apply launcher shape)
mask = Image.new('L', (IW, IH), 0)
md   = ImageDraw.Draw(mask)
try:
    md.rounded_rectangle([0, 0, IW - 1, IH - 1], radius=80, fill=255)
except AttributeError:            # Pillow < 8.2 — use full square mask
    md.rectangle([0, 0, IW - 1, IH - 1], fill=255)
rgba = icon.convert('RGBA')
rgba.putalpha(mask)
rgba.save('assets/icon.png', optimize=True)
print('✓  assets/icon.png            (512 × 512)')


# ── Feature Graphic  1024 × 500 ──────────────────────────────────────────────
FW, FH = 1024, 500
fg   = Image.new('RGB', (FW, FH), DARK)
draw = ImageDraw.Draw(fg)

# Orange right panel
SPLIT = 555
draw.rectangle([SPLIT, 0, FW, FH], fill=ORANGE)

# Soft diagonal gradient blend between panels (70 px wide)
BLEND = 70
for i in range(BLEND):
    t = i / BLEND
    c = tuple(int(DARK[k] * (1 - t) + ORANGE[k] * t) for k in range(3))
    draw.line([(SPLIT - BLEND // 2 + i, 0), (SPLIT - BLEND // 2 + i, FH)], fill=c)

# Steering wheel on orange panel
steer(draw, 790, FH // 2, outer_r=198, inner_r=158, hub_r=58, spoke_w=38, bg_color=ORANGE)

# Typography on dark panel
font_title = load_font(102, bold=True)
font_tag   = load_font( 34, bold=False)

PAD = 62
draw.text((PAD, 150), 'Dadboard', fill=WHITE, font=font_title)
draw.multiline_text((PAD + 3, 295),
                    'The family pickup\ncommand centre',
                    fill=WARM_TEXT, font=font_tag, spacing=10)

fg.save('assets/feature-graphic.png', optimize=True)
print('✓  assets/feature-graphic.png (1024 × 500)')
print()
print('Review assets/ then update app.json to reference icon.png.')
