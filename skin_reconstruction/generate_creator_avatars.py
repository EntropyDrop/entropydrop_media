#!/usr/bin/env python3
"""
Generate Minecraft 2D creator avatars from skin_url in metadata.json.
References the exact rendering logic in entropydrop_frontend:
- entropydrop_frontend/src/utils/skin2dRenderer.ts (renderSkinAvatarFast)
- entropydrop_frontend/src/components/SkinAvatarImage.tsx
- entropydrop_frontend/src/components/utils.ts (SkinAvatar)
"""

import io
import json
import os
import sys
import urllib.request
from pathlib import Path
from PIL import Image

def render_skin_avatar_fast(
    skin_img: Image.Image,
    scale: int = 10,
    show_overlay: bool = True,
    overlay_inflated: bool = True
) -> Image.Image:
    """
    Renders a Minecraft skin head avatar exactly matching renderSkinAvatarFast
    from entropydrop_frontend/src/utils/skin2dRenderer.ts:

    Default options:
      scale = 10
      showOverlay = True
      overlayInflated = True
      inflated = True
      padding = 10 * 0.5 = 5
      canvas size = 8 * 10 + 2 * 5 = 90 x 90
      inner face: UV (8, 8, 16, 16), scaled to 80x80 at (5, 5)
      outer face: UV (40, 8, 48, 16), scaled to 90x90 at (0, 0)
      resampling: Nearest Neighbor
    """
    skin_img = skin_img.convert("RGBA")
    width, height = skin_img.size
    texture_scale = width // 64

    inflated = show_overlay and overlay_inflated
    padding = int(scale * 0.5) if inflated else 0
    canvas_size = 8 * scale + 2 * padding # 90

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    # 1. Inner head front face: UV (8, 8, 16, 16)
    inner_crop = skin_img.crop((
        8 * texture_scale,
        8 * texture_scale,
        16 * texture_scale,
        16 * texture_scale
    ))
    inner_size = 8 * scale # 80
    inner_scaled = inner_crop.resize((inner_size, inner_size), Image.Resampling.NEAREST)

    temp_inner = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    temp_inner.paste(inner_scaled, (padding, padding))
    canvas = Image.alpha_composite(canvas, temp_inner)

    # 2. Outer head front face (overlay / hat): UV (40, 8, 48, 16)
    if show_overlay:
        offset = int(scale * 0.5) if inflated else 0
        outer_size = (8 + (1 if inflated else 0)) * scale # 90
        outer_crop = skin_img.crop((
            40 * texture_scale,
            8 * texture_scale,
            48 * texture_scale,
            16 * texture_scale
        ))
        outer_scaled = outer_crop.resize((outer_size, outer_size), Image.Resampling.NEAREST)

        temp_outer = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        temp_outer.paste(outer_scaled, (padding - offset, padding - offset))
        canvas = Image.alpha_composite(canvas, temp_outer)

    return canvas

def main():
    script_dir = Path(__file__).resolve().parent
    media_root = script_dir.parent if script_dir.name == "skin_reconstruction" else script_dir
    metadata_file = media_root / "assets" / "skin_reconstruction" / "metadata.json"
    avatars_dir = media_root / "assets" / "skin_reconstruction" / "avatars"

    if not metadata_file.exists():
        print(f"Error: {metadata_file} not found!", file=sys.stderr)
        sys.exit(1)

    avatars_dir.mkdir(parents=True, exist_ok=True)

    with open(metadata_file, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    updated_count = 0
    for item in metadata:
        creator = item.get("creator") or {}
        skin_url = creator.get("skin_url")
        short_id = item.get("shortId")
        username = creator.get("username", "Unknown")

        if not skin_url:
            continue

        print(f"Processing avatar for [{short_id}] {username} from {skin_url}...")
        try:
            req = urllib.request.Request(skin_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                skin_data = resp.read()

            skin_img = Image.open(io.BytesIO(skin_data))
            avatar_img = render_skin_avatar_fast(skin_img, scale=10, show_overlay=True, overlay_inflated=True)

            # Save PNG avatar
            png_dest = avatars_dir / f"{short_id}.png"
            avatar_img.save(png_dest, format="PNG")

            # Also save to .jpg path (as PNG encoding) for compatibility with any legacy code
            jpg_dest = avatars_dir / f"{short_id}.jpg"
            avatar_img.save(jpg_dest, format="PNG")

            # Update localAvatar reference in metadata.json
            item["localAvatar"] = f"assets/skin_reconstruction/avatars/{short_id}.png"
            print(f"  ✓ Successfully saved {png_dest.name} (90x90 PNG) and updated metadata.json")
            updated_count += 1
        except Exception as e:
            print(f"  ✗ Failed to process skin for {short_id}: {e}", file=sys.stderr)

    if updated_count > 0:
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nDone! Updated {updated_count} creator avatars in metadata.json.")
    else:
        print("\nNo items with skin_url found or updated.")

    # Clean up any temporary test avatar
    test_avatar = avatars_dir / "test_kbd3z6cd_avatar.png"
    if test_avatar.exists():
        test_avatar.unlink()
        print("Cleaned up test_kbd3z6cd_avatar.png")

if __name__ == "__main__":
    main()
