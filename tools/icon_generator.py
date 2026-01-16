"""
File: icon_generator.py
Author: Wildflower
Description: Multi-size icon generator with PNG and ICO output support
Language: Python 3.x
Dependencies: Pillow (PIL)

Usage:
    python icon_generator.py

Features:
    - Converts JPG to PNG
    - Generates multiple sizes (16, 32, 64, 128, 256, 512)
    - Creates ICO file for Windows
    - High-quality resampling
"""

import os
from PIL import Image

# Configuration
INPUT_FILE = "src-tauri/icons/256x256.png"
OUTPUT_DIR = "public/assets/icons"
TAURI_ICONS_DIR = "src-tauri/icons"

# Icon sizes to generate
SIZES = [16, 32, 64, 128, 256, 512]

# ICO sizes (Windows standard)
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def create_directories():
    """Create output directories if they don't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TAURI_ICONS_DIR, exist_ok=True)
    print(f"[DIRECTORY:CREATE] Created output directories")


def generate_png_icons(source_image):
    """Generate PNG icons in multiple sizes"""
    print(f"\n[ICON:GENERATE] Starting PNG generation")
    
    for size in SIZES:
        # Create resized image with high-quality resampling
        resized = source_image.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save PNG
        output_path = os.path.join(OUTPUT_DIR, f"wildflower_{size}x{size}.png")
        resized.save(output_path, "PNG", optimize=True)
        
        print(f"[ICON:PNG] Generated {size}x{size} -> {output_path}")
        
        # Copy specific sizes to Tauri icons directory
        if size in [32, 128, 256]:
            tauri_path = os.path.join(TAURI_ICONS_DIR, f"{size}x{size}.png")
            resized.save(tauri_path, "PNG", optimize=True)
            print(f"[ICON:TAURI] Copied to {tauri_path}")


def generate_ico_file(source_image):
    """Generate Windows ICO file with multiple sizes"""
    print(f"\n[ICON:ICO] Starting ICO generation")
    
    # Create list of resized images for ICO
    ico_images = []
    for size in ICO_SIZES:
        resized = source_image.resize(size, Image.Resampling.LANCZOS)
        ico_images.append(resized)
    
    # Save as ICO (Windows)
    ico_path_public = os.path.join(OUTPUT_DIR, "wildflower.ico")
    ico_images[0].save(
        ico_path_public,
        format="ICO",
        sizes=ICO_SIZES,
        append_images=ico_images[1:]
    )
    print(f"[ICON:ICO] Generated multi-size ICO -> {ico_path_public}")
    
    # Copy to Tauri icons directory
    ico_path_tauri = os.path.join(TAURI_ICONS_DIR, "icon.ico")
    ico_images[0].save(
        ico_path_tauri,
        format="ICO",
        sizes=ICO_SIZES,
        append_images=ico_images[1:]
    )
    print(f"[ICON:ICO] Copied to {ico_path_tauri}")


def generate_icon_png(source_image):
    """Generate main icon.png for Tauri"""
    print(f"\n[ICON:MAIN] Generating main icon.png")
    
    # Create 512x512 as main icon
    main_icon = source_image.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Save to Tauri icons
    main_path = os.path.join(TAURI_ICONS_DIR, "icon.png")
    main_icon.save(main_path, "PNG", optimize=True)
    print(f"[ICON:MAIN] Generated 512x512 -> {main_path}")


def main():
    """Main execution function"""
    print("=" * 60)
    print("[SYSTEM:START] Wildflower Icon Generator v1.0.0")
    print("[SYSTEM:AUTHOR] Wildflower")
    print("=" * 60)
    
    # Check if input file exists
    if not os.path.exists(INPUT_FILE):
        print(f"[ERROR:FILE] Input file not found: {INPUT_FILE}")
        return
    
    print(f"\n[INPUT:FILE] Loading {INPUT_FILE}")
    
    try:
        # Open source image
        with Image.open(INPUT_FILE) as img:
            # Convert to RGB if necessary (remove alpha channel)
            if img.mode in ('RGBA', 'LA', 'P'):
                print(f"[CONVERT:MODE] Converting {img.mode} to RGB")
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            print(f"[INPUT:INFO] Image size: {img.size}, Mode: {img.mode}")
            
            # Create directories
            create_directories()
            
            # Generate PNG icons
            generate_png_icons(img)
            
            # Generate ICO file
            generate_ico_file(img)
            
            # Generate main icon.png
            generate_icon_png(img)
            
            print("\n" + "=" * 60)
            print("[SYSTEM:SUCCESS] Icon generation completed")
            print(f"[OUTPUT:PNG] Generated {len(SIZES)} PNG sizes")
            print(f"[OUTPUT:ICO] Generated 1 ICO file with {len(ICO_SIZES)} sizes")
            print(f"[OUTPUT:LOCATION] {OUTPUT_DIR}")
            print(f"[OUTPUT:LOCATION] {TAURI_ICONS_DIR}")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n[ERROR:EXCEPTION] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
