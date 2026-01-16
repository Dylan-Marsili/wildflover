"""
File: create_hq_ico.py
Author: Wildflover
Description: High-quality ICO generator from source image (no circular crop)
Language: Python 3.x
"""

from PIL import Image
import struct
import io
import os

def create_hq_ico(input_path, output_ico, output_pngs_dir):
    """Create high-quality ICO with PNG compression and generate PNG sizes"""
    
    sizes = [16, 24, 32, 48, 64, 128, 256]
    
    # Load source image
    source = Image.open(input_path)
    
    # Convert to RGBA for transparency support
    if source.mode != 'RGBA':
        source = source.convert('RGBA')
    
    print(f"[ICO-HQ] Source: {input_path} ({source.size[0]}x{source.size[1]})")
    
    # Generate PNG files for each size
    os.makedirs(output_pngs_dir, exist_ok=True)
    
    for size in [32, 128, 256]:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        png_path = os.path.join(output_pngs_dir, f'{size}x{size}.png')
        resized.save(png_path, 'PNG', optimize=True)
        print(f"[ICO-HQ] PNG saved: {png_path}")
    
    # Save icon.png (256x256)
    icon_png = source.resize((256, 256), Image.Resampling.LANCZOS)
    icon_png_path = os.path.join(output_pngs_dir, 'icon.png')
    icon_png.save(icon_png_path, 'PNG', optimize=True)
    print(f"[ICO-HQ] PNG saved: {icon_png_path}")
    
    # Build ICO file with PNG-compressed images
    ico_data = io.BytesIO()
    
    # ICO Header: Reserved (2) + Type (2) + Count (2)
    ico_data.write(struct.pack('<HHH', 0, 1, len(sizes)))
    
    # Prepare image data as PNG
    image_data_list = []
    for size in sizes:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        img_buffer = io.BytesIO()
        resized.save(img_buffer, format='PNG', optimize=True)
        image_data_list.append(img_buffer.getvalue())
        print(f"[ICO-HQ] Generated {size}x{size} ({len(img_buffer.getvalue()):,} bytes)")
    
    # Calculate header size
    header_size = 6 + (16 * len(sizes))
    
    # Write directory entries
    offset = header_size
    for i, size in enumerate(sizes):
        data = image_data_list[i]
        width = size if size < 256 else 0  # 0 means 256
        height = size if size < 256 else 0
        
        ico_data.write(struct.pack('<BBBBHHII',
            width,      # Width
            height,     # Height
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
    print(f"[ICO-HQ] ICO saved: {output_ico} ({file_size:,} bytes)")
    
    return file_size

if __name__ == "__main__":
    print("=" * 50)
    print("  WILDFLOVER HQ ICO GENERATOR")
    print("  Author: Wildflover")
    print("=" * 50)
    
    # Use the circular bordered icon as source
    source_file = "src-tauri/icons/256x256.png"
    if not os.path.exists(source_file):
        source_file = "new_icon.jpg"
    
    create_hq_ico(
        source_file,
        "src-tauri/icons/icon.ico",
        "src-tauri/icons"
    )
    
    print("=" * 50)
    print("  COMPLETE - Rebuild app to apply new icons")
    print("=" * 50)
