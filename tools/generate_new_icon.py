"""
File: generate_new_icon.py
Author: Wildflover
Description: High-quality icon generator with border frame effect
             Creates PNG icons in multiple sizes and ICO for Windows
             Uses new_icon.jpg as source with professional border styling
Language: Python 3.x
Dependencies: Pillow (PIL)
"""

import os
from PIL import Image, ImageDraw

# [CONFIG] Input and output paths
INPUT_FILE = "tools/new_icon.jpg"
OUTPUT_DIR = "public/assets/icons"
TAURI_ICONS_DIR = "src-tauri/icons"

# [CONFIG] Icon sizes - larger sizes for better quality
SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

# [CONFIG] ICO sizes for Windows (includes 256 for high-DPI displays)
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# [CONFIG] Border frame settings
BORDER_RADIUS = 0.15  # 15% of icon size for rounded corners
BORDER_COLOR = (201, 75, 124)  # #c94b7c - Wildflover pink accent
BORDER_WIDTH_RATIO = 0.04  # 4% of icon size


def create_directories():
    """Create output directories if they don't exist"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TAURI_ICONS_DIR, exist_ok=True)
    print(f"[DIR-CREATE] Output directories ready")


def create_rounded_mask(size, radius):
    """Create a rounded rectangle mask for the icon"""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    
    # Draw rounded rectangle
    draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=255
    )
    return mask


def add_border_frame(image, size):
    """Add a subtle border frame to the icon"""
    border_width = max(1, int(size * BORDER_WIDTH_RATIO))
    radius = int(size * BORDER_RADIUS)
    
    # Create output image with transparency
    output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # Create border layer
    border_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border_layer)
    
    # Draw outer border (subtle glow effect)
    border_draw.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=(*BORDER_COLOR, 40),  # Very subtle
        outline=(*BORDER_COLOR, 120),
        width=border_width
    )
    
    # Resize source image to fit inside border
    inner_size = size - (border_width * 2)
    inner_image = image.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    
    # Create rounded mask for inner image
    inner_mask = create_rounded_mask(inner_size, max(1, radius - border_width))
    
    # Convert inner image to RGBA if needed
    if inner_image.mode != 'RGBA':
        inner_image = inner_image.convert('RGBA')
    
    # Apply mask to inner image
    inner_image.putalpha(inner_mask)
    
    # Composite layers
    output.paste(border_layer, (0, 0), border_layer)
    output.paste(inner_image, (border_width, border_width), inner_image)
    
    return output


def generate_png_icons(source_image):
    """Generate PNG icons in multiple sizes with border frame"""
    print(f"\n[PNG-GEN] Starting PNG generation with border frame")
    
    generated = []
    for size in SIZES:
        # Create icon with border frame
        icon = add_border_frame(source_image, size)
        
        # Save to public assets
        output_path = os.path.join(OUTPUT_DIR, f"wildflower_{size}x{size}.png")
        icon.save(output_path, "PNG", optimize=True)
        generated.append(output_path)
        print(f"[PNG-GEN] {size}x{size} -> {output_path}")
        
        # Copy to Tauri icons directory
        tauri_path = os.path.join(TAURI_ICONS_DIR, f"{size}x{size}.png")
        icon.save(tauri_path, "PNG", optimize=True)
        print(f"[TAURI-COPY] {size}x{size} -> {tauri_path}")
    
    return generated


def generate_ico_file(source_image):
    """Generate Windows ICO file with multiple sizes - proper ICO format"""
    print(f"\n[ICO-GEN] Starting ICO generation (proper format)")
    
    # ICO needs specific sizes including 256x256 for high-DPI
    ico_sizes_list = [16, 24, 32, 48, 64, 128, 256]
    
    # Create list of icons for ICO - must be RGBA for transparency
    ico_images = []
    for size in ico_sizes_list:
        icon = add_border_frame(source_image, size)
        # Ensure RGBA mode for ICO with transparency
        if icon.mode != 'RGBA':
            icon = icon.convert('RGBA')
        ico_images.append(icon)
    
    # Save as ICO to public assets - use largest as base
    ico_path_public = os.path.join(OUTPUT_DIR, "wildflower.ico")
    
    # ICO format: save with all sizes embedded
    ico_images[-1].save(
        ico_path_public,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes_list],
        append_images=ico_images[:-1]
    )
    print(f"[ICO-GEN] Multi-size ICO -> {ico_path_public} ({len(ico_sizes_list)} sizes)")
    
    # Copy to Tauri icons directory
    ico_path_tauri = os.path.join(TAURI_ICONS_DIR, "icon.ico")
    ico_images[-1].save(
        ico_path_tauri,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes_list],
        append_images=ico_images[:-1]
    )
    print(f"[ICO-GEN] Tauri ICO -> {ico_path_tauri}")
    
    # Verify ICO file size
    ico_size = os.path.getsize(ico_path_tauri)
    print(f"[ICO-GEN] ICO file size: {ico_size / 1024:.1f} KB")
    
    return ico_path_public, ico_path_tauri


def generate_main_icon(source_image):
    """Generate main icon.png for Tauri (512x512)"""
    print(f"\n[MAIN-ICON] Generating main icon.png")
    
    # Create 512x512 icon with border
    main_icon = add_border_frame(source_image, 512)
    
    # Save to Tauri icons
    main_path = os.path.join(TAURI_ICONS_DIR, "icon.png")
    main_icon.save(main_path, "PNG", optimize=True)
    print(f"[MAIN-ICON] 512x512 -> {main_path}")
    
    # Also save to public assets
    public_path = os.path.join(OUTPUT_DIR, "icon.png")
    main_icon.save(public_path, "PNG", optimize=True)
    print(f"[MAIN-ICON] Public copy -> {public_path}")
    
    return main_path


def main():
    """Main execution function"""
    print("-" * 60)
    print("[SYSTEM-INIT] Wildflover Icon Generator v2.0.0")
    print("[SYSTEM-INFO] Author: Wildflover")
    print("[SYSTEM-INFO] Source: new_icon.jpg with border frame")
    print("-" * 60)
    
    # Check input file
    if not os.path.exists(INPUT_FILE):
        print(f"[ERROR] Input file not found: {INPUT_FILE}")
        return False
    
    print(f"\n[INPUT-LOAD] Loading {INPUT_FILE}")
    
    try:
        with Image.open(INPUT_FILE) as img:
            # Convert to RGB
            if img.mode != 'RGB':
                print(f"[CONVERT] {img.mode} -> RGB")
                img = img.convert('RGB')
            
            print(f"[INPUT-INFO] Size: {img.size}, Mode: {img.mode}")
            
            # Create directories
            create_directories()
            
            # Generate all icons
            png_files = generate_png_icons(img)
            ico_files = generate_ico_file(img)
            main_icon = generate_main_icon(img)
            
            print("\n" + "-" * 60)
            print("[COMPLETE] Icon generation finished successfully")
            print(f"[STATS] PNG files: {len(png_files)}")
            print(f"[STATS] ICO files: 2 (public + tauri)")
            print(f"[STATS] Main icon: {main_icon}")
            print(f"[OUTPUT] {OUTPUT_DIR}")
            print(f"[OUTPUT] {TAURI_ICONS_DIR}")
            print("-" * 60)
            
            return True
            
    except Exception as e:
        print(f"\n[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    main()
