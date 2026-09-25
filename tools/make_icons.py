#!/usr/bin/env python3
"""Generate the extension's PNG icons.

No third-party dependencies: PNGs are encoded directly with zlib. Shapes are
rendered by supersampling (SS x SS samples per pixel) to get antialiased edges.

Usage:  python3 tools/make_icons.py
Writes: icons/icon16.png, icon32.png, icon48.png, icon128.png
"""

import os
import struct
import zlib

SS = 4  # subsamples per axis

BG = (32, 33, 36)        # dark charcoal
PLAY = (255, 255, 255)   # white play triangle
SLASH = (230, 33, 23)    # YouTube-ish red


def rounded_rect(x, y, radius):
    """x, y in 0..1. Rounded square covering the whole canvas."""
    if x < radius and y < radius:
        return (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x > 1 - radius and y < radius:
        return (x - (1 - radius)) ** 2 + (y - radius) ** 2 <= radius ** 2
    if x < radius and y > 1 - radius:
        return (x - radius) ** 2 + (y - (1 - radius)) ** 2 <= radius ** 2
    if x > 1 - radius and y > 1 - radius:
        return (x - (1 - radius)) ** 2 + (y - (1 - radius)) ** 2 <= radius ** 2
    return True


def triangle(x, y, pts):
    (ax, ay), (bx, by), (cx, cy) = pts

    def side(px, py, qx, qy):
        return (x - qx) * (py - qy) - (px - qx) * (y - qy)

    d1 = side(ax, ay, bx, by)
    d2 = side(bx, by, cx, cy)
    d3 = side(cx, cy, ax, ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def band(x, y, half_width):
    """Diagonal bar from bottom-left to top-right: distance to line y = x."""
    return abs(x - (1.0 - y)) / (2 ** 0.5) <= half_width


def sample(x, y):
    """Return an (r, g, b, a) tuple for a point in 0..1 space."""
    if not rounded_rect(x, y, 0.22):
        return (0, 0, 0, 0)

    colour = BG

    if triangle(x, y, ((0.33, 0.25), (0.33, 0.75), (0.75, 0.50))):
        colour = PLAY

    # Drawn straight over the play mark: a gap-free bar keeps the triangle
    # readable as one shape instead of splitting it into fragments.
    if band(x, y, 0.062):
        colour = SLASH

    return colour + (255,)


def render(size):
    rows = []
    step = 1.0 / (size * SS)
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) * step
                    y = (py * SS + sy + 0.5) * step
                    sr, sg, sb, sa = sample(x, y)
                    # Weight colour by coverage so edges blend correctly.
                    r += sr * sa
                    g += sg * sa
                    b += sb * sa
                    a += sa
            n = SS * SS
            if a:
                row += bytes((round(r / a), round(g / a), round(b / a), round(a / n)))
            else:
                row += b"\0\0\0\0"
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\0" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as handle:
        handle.write(png)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, "icons")
    os.makedirs(out_dir, exist_ok=True)

    for size in (16, 32, 48, 128):
        path = os.path.join(out_dir, "icon%d.png" % size)
        write_png(path, size, render(size))
        print("wrote %s (%d bytes)" % (path, os.path.getsize(path)))


if __name__ == "__main__":
    main()
