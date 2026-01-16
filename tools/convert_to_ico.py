"""
File: convert_to_ico.py
Author: Wildflower
Description: Convert PNG icon to ICO format for Tauri application
Language: Python 3.x
Dependencies: Pillow (PIL)

Usage:
    python convert_to_ico.py
"""

import os
from PIL import Image

# Configuration
INPUT_PNG = "src-tauri/icons/icon.png"
OUTPUT_ICO = "src-tauri/icons/icon.ico"

# ICO sizes (Windows standard)
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def convert_png_to_ico():
    """Convert PNG to ICO with multiple sizes"""
    print("=" * 60)
    print("[SYSTEM:START] PNG to ICO Converter v1.0.0")
    print("[SYSTEM:AUTHOR] Wildflower")
    print("=" * 60)
    
    # Check if input file exists
    if not os.path.exists(INPUT_PNG):
        print(f"\n[ERROR:FILE] Input file not found: {INPUT_PNG}")
        return
    
    print(f"\n[INPUT:FILE] Loading {INPUT_PNG}")
    
    try:
        # Open source image
        with Image.open(INPUT_PNG) as img:
            print(f"[INPUT:INFO] Image size: {img.size}, Mode: {img.mode}")
            
            # Convert to RGBA if necessary
            if img.mode != 'RGBA':
                print(f"[CONVERT:MODE] Converting {img.mode} to RGBA")
                img = img.convert('RGBA')
            
            # Create list of resized images for ICO
            print(f"\n[ICON:RESIZE] Creating {len(ICO_SIZES)} sizes")
            ico_images = []
            for size in ICO_SIZES:
                resized = img.resize(size, Image.Resampling.LANCZOS)
                ico_images.append(resized)
                print(f"[ICON:SIZE] Generated {size[0]}x{size[1]}")
            
            # Save as ICO
            print(f"\n[ICON:SAVE] Saving to {OUTPUT_ICO}")
            ico_images[0].save(
                OUTPUT_ICO,
                format="ICO",
                sizes=ICO_SIZES,
                append_images=ico_images[1:]
            )
            
            print("\n" + "=" * 60)
            print("[SYSTEM:SUCCESS] ICO conversion completed")
            print(f"[OUTPUT:FILE] {OUTPUT_ICO}")
            print(f"[OUTPUT:SIZES] {len(ICO_SIZES)} embedded sizes")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n[ERROR:EXCEPTION] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    convert_png_to_ico()
