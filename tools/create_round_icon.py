"""
File: create_round_icon.py
Author: Wildflover
Description: Creates modern circular bordered icons for taskbar with gradient effects
Language: Python
"""

from PIL import Image, ImageDraw, ImageFilter
import os
import sys

# ============================================================================
# CONFIGURATION
# ============================================================================

CONFIG = {
    'input_file': 'new_icon.jpg',
    'fallback_file': 'tools/new_icon.jpg',
    'output_dir': 'src-tauri/icons',
    'sizes': [16, 24, 32, 48, 64, 128, 256],  # All sizes for ICO
    'border_color_primary': (220, 140, 170),    # Light rose/pink
    'border_color_secondary': (180, 110, 145),  # Medium rose
}

# ============================================================================
# CIRCULAR ICON GENERATOR
# ============================================================================

def create_circular_icon(input_path, output_dir, sizes):
    """Creates circular icons with gradient border"""
    print(f'[ICON-INIT] Loading source image: {input_path}')
    
    original = Image.open(input_path).convert('RGBA')
    print(f'[ICON-INFO] Source size: {original.size[0]}x{original.size[1]}')
    
    generated_images = {}
    
    for size in sizes:
        print(f'[ICON-PROCESS] Generating {size}x{size} icon...')
        
        # Calculate dimensions
        border_width = max(2, size // 20)
        glow_size = max(2, size // 20)
        
        # Create canvas with extra space for glow
        canvas_size = size + (glow_size * 2)
        canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        
        center = canvas_size // 2
        radius = (size // 2) - 1
        
        # Draw outer glow effect
        for i in range(glow_size, 0, -1):
            glow_radius = radius + border_width + i
            alpha = int(60 * (1 - i / glow_size))
            draw.ellipse(
                [center - glow_radius, center - glow_radius, 
                 center + glow_radius, center + glow_radius],
                outline=(*CONFIG['border_color_primary'][:3], alpha),
                width=2
            )
        
        # Draw gradient border (outer to inner)
        for i in range(border_width):
            ratio = i / max(1, border_width - 1)
            r = int(CONFIG['border_color_primary'][0] * (1 - ratio) + CONFIG['border_color_secondary'][0] * ratio)
            g = int(CONFIG['border_color_primary'][1] * (1 - ratio) + CONFIG['border_color_secondary'][1] * ratio)
            b = int(CONFIG['border_color_primary'][2] * (1 - ratio) + CONFIG['border_color_secondary'][2] * ratio)
            
            current_radius = radius - i
            draw.ellipse(
                [center - current_radius, center - current_radius, 
                 center + current_radius, center + current_radius],
                outline=(r, g, b, 255),
                width=1
            )
        
        # Inner accent line
        inner_radius = radius - border_width - 1
        draw.ellipse(
            [center - inner_radius - 1, center - inner_radius - 1, 
             center + inner_radius + 1, center + inner_radius + 1],
            outline=(*CONFIG['border_color_secondary'][:3], 60),
            width=1
        )
        
        # Create circular mask for image
        mask_radius = inner_radius - 1
        mask_size = mask_radius * 2
        
        if mask_size > 0:
            mask = Image.new('L', (mask_size, mask_size), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.ellipse([0, 0, mask_size - 1, mask_size - 1], fill=255)
            
            # Resize original image to fit inside circle
            img_resized = original.resize((mask_size, mask_size), Image.Resampling.LANCZOS)
            img_resized.putalpha(mask)
            
            # Paste image onto canvas
            paste_pos = (center - mask_radius, center - mask_radius)
            canvas.paste(img_resized, paste_pos, img_resized)
        
        # Crop to final size
        final = canvas.crop((glow_size, glow_size, glow_size + size, glow_size + size))
        
        # Save PNG
        output_path = os.path.join(output_dir, f'{size}x{size}.png')
        final.save(output_path, 'PNG')
        print(f'[ICON-SUCCESS] Created: {output_path}')
        
        generated_images[size] = final
    
    # Create main icon.png (256x256)
    icon_256 = generated_images[256]
    icon_256.save(os.path.join(output_dir, 'icon.png'), 'PNG')
    print(f'[ICON-SUCCESS] Created: icon.png')
    
    # Copy to public/assets/icons
    public_icons_dir = 'public/assets/icons'
    os.makedirs(public_icons_dir, exist_ok=True)
    icon_256.save(os.path.join(public_icons_dir, 'icon.png'), 'PNG')
    print(f'[ICON-SUCCESS] Copied to: {public_icons_dir}/icon.png')
    
    # Create high-quality ICO file with all sizes
    print('[ICON-PROCESS] Generating high-quality ICO file...')
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [generated_images[s] for s in ico_sizes if s in generated_images]
    
    ico_path = os.path.join(output_dir, 'icon.ico')
    # Save with all sizes embedded
    ico_images[0].save(
        ico_path, 
        format='ICO', 
        sizes=[(img.width, img.height) for img in ico_images],
        append_images=ico_images[1:]
    )
    
    ico_size = os.path.getsize(ico_path)
    print(f'[ICON-SUCCESS] Created: icon.ico ({ico_size:,} bytes)')
    
    print('')
    print('=' * 60)
    print('[ICON-COMPLETE] All icons generated successfully!')
    print(f'[ICON-OUTPUT] Output directory: {output_dir}')
    print('=' * 60)


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == '__main__':
    print('')
    print('=' * 60)
    print('  WILDFLOVER ICON GENERATOR v2.2.0')
    print('  Author: Wildflover')
    print('  Creates circular bordered icons for taskbar')
    print('=' * 60)
    print('')
    
    input_image = CONFIG['input_file']
    
    if not os.path.exists(input_image):
        print(f'[ICON-WARN] Primary icon not found: {input_image}')
        input_image = CONFIG['fallback_file']
    
    if not os.path.exists(input_image):
        print(f'[ICON-ERROR] No input image found!')
        sys.exit(1)
    
    os.makedirs(CONFIG['output_dir'], exist_ok=True)
    create_circular_icon(input_image, CONFIG['output_dir'], CONFIG['sizes'])
