import base64
import io
import os
import re
from pathlib import Path
from PIL import Image

root = Path(r"c:\Users\Asus\Kì 2 năm 3\development application\English_App\lingai-frontend")
images_js = root / "src" / "assets" / "images.js"
out_dir = root / "src" / "assets" / "penguins"
out_dir.mkdir(parents=True, exist_ok=True)

text = images_js.read_text(encoding="utf-8")
pattern = re.compile(r'export const (IMG_[A-Z_]+)\\s*=\\s*"data:image/[^;]+;base64,([^"]+)";', re.S)
items = pattern.findall(text)
if not items:
    raise SystemExit("No embedded images found")

exports = []

for name, b64 in items:
    raw = base64.b64decode(b64)
    im = Image.open(io.BytesIO(raw)).convert("RGB")

    # Heuristic matte removal for black background: derive alpha from brightness,
    # then unpremultiply color channels.
    rgb = im.split()
    r, g, b = rgb
    # alpha ~= max channel value, slightly boosted for mid-tones
    alpha = Image.merge("RGB", (r, g, b)).convert("L")

    # Build RGBA pixel-wise with unpremultiply
    src = im.load()
    w, h = im.size
    out = Image.new("RGBA", im.size)
    dst = out.load()

    for y in range(h):
        for x in range(w):
            rr, gg, bb = src[x, y]
            a = max(rr, gg, bb)
            # Reduce residual dark haze near pure black background
            if a < 18:
                dst[x, y] = (0, 0, 0, 0)
                continue
            af = a / 255.0
            ur = min(255, int(rr / af)) if af > 0 else 0
            ug = min(255, int(gg / af)) if af > 0 else 0
            ub = min(255, int(bb / af)) if af > 0 else 0
            dst[x, y] = (ur, ug, ub, a)

    filename = name.lower().replace("img_", "") + ".png"
    out_path = out_dir / filename
    out.save(out_path, format="PNG", optimize=True)

    exports.append((name, filename))

header = "// Converted to static PNG assets for cleaner transparency handling\n"
imports = "\n".join([f"import {name}File from './penguins/{fn}';" for name, fn in exports])
export_lines = "\n".join([f"export const {name} = {name}File;" for name, _ in exports])
new_text = header + imports + "\n\n" + export_lines + "\n"
images_js.write_text(new_text, encoding="utf-8")

print(f"Converted {len(exports)} images to {out_dir}")
for name, fn in exports:
    print(f"{name} -> {fn}")
