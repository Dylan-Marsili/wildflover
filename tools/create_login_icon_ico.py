"""
File: create_login_icon_ico.py
Author: Wildflover
Description: Creates high-quality ICO from login_icon.jpg for Windows desktop shortcut
             - Uses LANCZOS resampling for best quality
             - PNG compression inside ICO for maximum quality
             - All required sizes: 16, 24, 32, 48, 64, 128, 256px
Language: Python 3.x
"""

from PIL import Image
import struct
import io
import os

def create_hq_ico_from_login_icon():
    """Create high-quality ICO from login_icon.jpg"""
    
    # Source file - login_icon.jpg
    source_paths = [
        "login_icon.jpg",
        "public/assets/icons/login_icon.jpg"
    ]
    
    source_file = None
    for path in source_paths:
        if os.path.exists(path):
            source_file = path
            break
    
    if not source_file:
        print("[ERROR] login_icon.jpg not found!")
        return
    
    # Output paths
    output_ico = "src-tauri/icons/icon.ico"
    output_pngs_dir = "src-tauri/icons"
    
    sizes = [16, 24, 32, 48, 64, 128, 256]
    
    # Load source image
    source = Image.open(source_file)
    original_size = source.size
    
    print(f"[ICO-GEN] Source: {source_file}")
    print(f"[ICO-GEN] Original size: {original_size[0]}x{original_size[1]}")
    
    # Convert to RGBA for transparency support
    if source.mode != 'RGBA':
        source = source.convert('RGBA')
    
    # Ensure output directory exists
    os.makedirs(output_pngs_dir, exist_ok=True)
    
    # Generate PNG files for Tauri
    for size in [32, 128, 256]:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        png_path = os.path.join(output_pngs_dir, f'{size}x{size}.png')
        resized.save(png_path, 'PNG', optimize=True)
        print(f"[ICO-GEN] PNG saved: {png_path}")
    
    # Save icon.png (256x256) - main icon
    icon_png = source.resize((256, 256), Image.Resampling.LANCZOS)
    icon_png_path = os.path.join(output_pngs_dir, 'icon.png')
    icon_png.save(icon_png_path, 'PNG', optimize=True)
    print(f"[ICO-GEN] PNG saved: {icon_png_path}")
    
    # Build ICO file with PNG-compressed images for maximum quality
    ico_data = io.BytesIO()
    
    # ICO Header: Reserved (2) + Type (2) + Count (2)
    ico_data.write(struct.pack('<HHH', 0, 1, len(sizes)))
    
    # Prepare image data as PNG (best quality)
    image_data_list = []
    for size in sizes:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        img_buffer = io.BytesIO()
        resized.save(img_buffer, format='PNG', optimize=True)
        image_data_list.append(img_buffer.getvalue())
        print(f"[ICO-GEN] Generated {size}x{size} ({len(img_buffer.getvalue()):,} bytes)")
    
    # Calculate header size
    header_size = 6 + (16 * len(sizes))
    
    # Write directory entries
    offset = header_size
    for i, size in enumerate(sizes):
        data = image_data_list[i]
        width = size if size < 256 else 0  # 0 means 256 in ICO format
        height = size if size < 256 else 0
        
        ico_data.write(struct.pack('<BBBBHHII',
            width,      # Width (0 = 256)
            height,     # Height (0 = 256)
            0,          # Color palette (0 for PNG)
            0,          # Reserved
            1,          # Color planes
            32,         # Bits per pixel
            len(data),  # Size of image data
            offset      # Offset to image data
        ))
        offset += len(data)
    
    # Write image data
    for data in image_data_list:
        ico_data.write(data)
    
    # Save ICO file
    with open(output_ico, 'wb') as f:
        f.write(ico_data.getvalue())
    
    file_size = len(ico_data.getvalue())
    print(f"\n[ICO-GEN] ICO saved: {output_ico}")
    print(f"[ICO-GEN] Total size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
    
    return file_size

if __name__ == "__main__":
    print("=" * 60)
    print("  WILDFLOVER - LOGIN ICON TO ICO CONVERTER")
    print("  Author: Wildflover")
    print("  Source: login_icon.jpg")
    print("=" * 60)
    print()
    
    create_hq_ico_from_login_icon()
    
    print()
    print("=" * 60)
    print("  COMPLETE")
    print("  - Run 'npm run tauri build' to apply new icons")
    print("  - Clear Windows icon cache: ie4uinit.exe -show")
    print("=" * 60)
