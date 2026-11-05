#!/usr/bin/env python3
# Regenerate app icons and splash: python3 scripts/generate-icons.py assets/images  (needs Pillow)
"""Compass Dialer icons: teal + the Material "call" handset (Apache-2.0), rendered from its SVG path."""
import re
import sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
TEAL = (11, 122, 110, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # supersampling

# Material Icons "call", 24x24 viewBox.
PATH = ("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57"
        ".55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 "
        "2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z")

def polygon(path, steps=24):
    """Flatten an SVG path that uses M, c, l, V, h, z into points."""
    toks = re.findall(r"[MmCcLlVvHhZz]|-?\d*\.?\d+(?:e-?\d+)?", path)
    pts, i, cmd, x, y = [], 0, None, 0.0, 0.0
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]):
            cmd = toks[i]; i += 1
            if cmd in "Zz":
                continue
        if cmd == "M":
            x, y = num(), num(); pts.append((x, y)); cmd = "L"
        elif cmd in "Ll":
            dx, dy = num(), num()
            x, y = (x + dx, y + dy) if cmd == "l" else (dx, dy); pts.append((x, y))
        elif cmd == "V":
            y = num(); pts.append((x, y))
        elif cmd == "h":
            x += num(); pts.append((x, y))
        elif cmd == "c":
            c1 = (x + num(), y + num()); c2 = (x + num(), y + num()); e = (x + num(), y + num())
            p0 = (x, y)
            for k in range(1, steps + 1):
                t = k / steps; u = 1 - t
                pts.append((u**3*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t**3*e[0],
                            u**3*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t**3*e[1]))
            x, y = e
        else:
            raise ValueError(f"unsupported command {cmd}")
    return pts

POLY = polygon(PATH)

def glyph(size, color):
    s = size * SS
    layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    # The handset spans x 3..21, y 3..21 in the 24-unit box: map that span to the full layer.
    scale = s / 18
    ImageDraw.Draw(layer).polygon([((px - 3) * scale, (py - 3) * scale) for px, py in POLY], fill=color)
    return layer.resize((size, size), Image.LANCZOS)

def compose(canvas, bg, frac, color):
    img = Image.new("RGBA", (canvas, canvas), bg)
    g = glyph(int(canvas * frac), color)
    off = (canvas - g.width) // 2
    img.alpha_composite(g, (off, off))
    return img

compose(1024, TEAL, 0.50, WHITE).convert("RGB").save(f"{OUT}/icon.png")                 # iOS + general
compose(1024, (0, 0, 0, 0), 0.38, WHITE).save(f"{OUT}/adaptive-icon.png")                # Android foreground (safe zone)
compose(1024, (0, 0, 0, 0), 0.38, WHITE).save(f"{OUT}/adaptive-icon-monochrome.png")     # Android 13+ themed icon
compose(1024, (0, 0, 0, 0), 0.60, TEAL).save(f"{OUT}/splash-icon.png")                   # splash
print("ok")
