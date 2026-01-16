"""
File: create_ico.py
Author: Wildflover
Description: High-quality ICO generator with embedded PNG compression
Language: Python 3.x
"""

from PIL import Image
import struct
import io

def create_ico_with_png(input_path, output_path):
    """Create ICO file with PNG-compressed images for high quality"""
    
    sizes = [16, 32, 48, 64, 128, 256]
    
    # Load source image
    source = Image.open(input_path)
    if source.mode != 'RGBA':
        source = source.convert('RGBA')
    
    print(f"[ICO-CREATE] Source: {input_path} ({source.size})")
    
    # Generate resized images
    images = []
    for size in sizes:
        resized = source.resize((size, size), Image.Resampling.LANCZOS)
        images.append((size, resized))
        print(f"[ICO-CREATE] Generated {size}x{size}")
    
    # Build ICO file manually
    ico_data = io.BytesIO()
    
    # ICO Header
    ico_data.write(struct.pack('<HHH', 0, 1, len(images)))  # Reserved, Type (1=ICO), Count
    
    # Calculate offsets
    header_size = 6 + (16 * len(images))  # 6 byte header + 16 bytes per image entry
    
    # Prepare image data
    image_data_list = []
    for size, img in images:
        img_buffer = io.BytesIO()
        # Use PNG format for sizes >= 48 (better quality)
        if size >= 48:
            img.save(img_buffer, format='PNG', optimize=True)
        else:
            # Use BMP for small sizes
            img.save(img_buffer, format='PNG')
        image_data_list.append(img_buffer.getvalue())
    
    # Write directory entries
    offset = header_size
    for i, (size, img) in enumerate(images):
        data = image_data_list[i]
        width = size if size < 256 else 0
        height = size if size < 256 else 0
        
        ico_data.write(struct.pack('<BBBBHHII',
            width,           # Width (0 = 256)
            height,          # Height (0 = 256)
            0,               # Color palette
            0,               # Reserved
            1,               # Color planes
            32,              # Bits per pixel
            len(data),       # Size of image data
            offset           # Offset to image data
        ))
        offset += len(data)
    
    # Write image data
    for data in image_data_list:
        ico_data.write(data)
    
    # Save ICO file
    with open(output_path, 'wb') as f:
        f.write(ico_data.getvalue())
    
    file_size = len(ico_data.getvalue())
    print(f"[ICO-CREATE] Output: {output_path} ({file_size:,} bytes)")
    return file_size

if __name__ == "__main__":
    create_ico_with_png(
        "src-tauri/icons/256x256.png",
        "src-tauri/icons/icon.ico"
    )
