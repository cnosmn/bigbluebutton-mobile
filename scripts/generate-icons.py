#!/usr/bin/env python3
"""Generate placeholder brand icons from the colors in brand.json.

Usage: python3 scripts/generate-icons.py
Requires Pillow (pip install pillow). Replace the generated PNGs with real
artwork whenever it is available; brand.json only references the paths.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "brand"
SIZE = 1024


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def draw_glyph(draw, scale, offset, color):
    """A screen with an upward 'share' arrow, drawn in a 1024 box."""
    def box(x0, y0, x1, y1):
        return [offset + x0 * scale, offset + y0 * scale,
                offset + x1 * scale, offset + y1 * scale]

    stroke = max(1, int(56 * scale))
    # Screen frame
    draw.rounded_rectangle(box(192, 232, 832, 712), radius=int(56 * scale),
                           outline=color, width=stroke)
    # Stand
    draw.rectangle(box(472, 712, 552, 792), fill=color)
    draw.rounded_rectangle(box(352, 776, 672, 832), radius=int(28 * scale), fill=color)
    # Share arrow
    draw.rectangle(box(484, 420, 540, 600), fill=color)
    arrow = [(512, 324), (632, 444), (392, 444)]
    draw.polygon([(offset + x * scale, offset + y * scale) for x, y in arrow], fill=color)


def make(path, background, color, glyph_fraction):
    img = Image.new("RGBA", (SIZE, SIZE), background)
    scale = glyph_fraction
    offset = SIZE * (1 - scale) / 2
    draw_glyph(ImageDraw.Draw(img), scale, offset, color)
    img.save(path)


def main():
    brand = json.loads((ROOT / "brand.json").read_text())
    primary = hex_rgb(brand["colors"]["primary"]) + (255,)
    on_primary = hex_rgb(brand["colors"]["onPrimary"]) + (255,)
    transparent = (0, 0, 0, 0)
    OUT.mkdir(parents=True, exist_ok=True)

    make(OUT / "icon.png", primary, on_primary, 0.9)
    # Adaptive icon layers: keep the glyph inside the 66% safe zone.
    make(OUT / "android-foreground.png", transparent, on_primary, 0.62)
    make(OUT / "android-monochrome.png", transparent, (255, 255, 255, 255), 0.62)
    fav = OUT / "favicon.png"
    make(fav, primary, on_primary, 0.9)
    Image.open(fav).resize((48, 48), Image.LANCZOS).save(fav)
    print(f"Icons written to {OUT}")


if __name__ == "__main__":
    main()
