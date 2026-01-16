"""
File: splash_processor.py
Author: Wildflower
Description: Process splash/login screen image to match background dimensions
Language: Python 3.x
Dependencies: Pillow (PIL)

Features:
    - Check image dimensions
    - Resize to 1199x674 if needed
    - Maintain aspect ratio with crop/fit
    - High-quality output
"""

import os
from PIL import Image

# Configuration
INPUT_FILE = "wildflover_splash_login.jpg"
OUTPUT_DIR = "public/assets/backgrounds"
OUTPUT_FILE = "wildflover_splash_login.jpg"
TARGET_WIDTH = 1199
TARGET_HEIGHT = 674


def process_splash_image():
    """Process splash image to match target dimensions"""
    print("=" * 60)
    print("[SYSTEM-START] Wildflower Splash Processor v1.0.0")
    print("[SYSTEM-AUTHOR] Wildflower")
    print("=" * 60)
    
    if not os.path.exists(INPUT_FILE):
        print(f"\n[ERROR-FILE] Input file not found: {INPUT_FILE}")
        return
    
    print(f"\n[INPUT-FILE] Loading {INPUT_FILE}")
    
    try:
        with Image.open(INPUT_FILE) as img:
            original_width, original_height = img.size
            print(f"[INPUT-DIMENSION] Original: {original_width}x{original_height}")
            print(f"[TARGET-DIMENSION] Required: {TARGET_WIDTH}x{TARGET_HEIGHT}")
            
            # Check if resize is needed
            if original_width == TARGET_WIDTH and original_height == TARGET_HEIGHT:
                print(f"\n[STATUS-OK] Image already has correct dimensions")
                print(f"[ACTION-SKIP] No processing needed")
                
                # Just copy to output directory
                output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
                img.save(output_path, "JPEG", quality=95, optimize=True)
                print(f"[OUTPUT-COPY] Saved to {output_path}")
            else:
                print(f"\n[STATUS-RESIZE] Dimensions mismatch, processing required")
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    print(f"[CONVERT-MODE] Converting {img.mode} to RGB")
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Calculate aspect ratios
                original_ratio = original_width / original_height
                target_ratio = TARGET_WIDTH / TARGET_HEIGHT
                
                print(f"[RATIO-ORIGINAL] {original_ratio:.3f}")
                print(f"[RATIO-TARGET] {target_ratio:.3f}")
                
                # Resize with aspect ratio preservation and crop
                if original_ratio > target_ratio:
                    # Image is wider, fit height and crop width
                    new_height = TARGET_HEIGHT
                    new_width = int(original_width * (TARGET_HEIGHT / original_height))
                    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    
                    # Crop center
                    left = (new_width - TARGET_WIDTH) // 2
                    resized = resized.crop((left, 0, left + TARGET_WIDTH, TARGET_HEIGHT))
                    print(f"[PROCESS-METHOD] Fit height, crop width (center)")
                else:
                    # Image is taller, fit width and crop height
                    new_width = TARGET_WIDTH
                    new_height = int(original_height * (TARGET_WIDTH / original_width))
                    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    
                    # Crop center
                    top = (new_height - TARGET_HEIGHT) // 2
                    resized = resized.crop((0, top, TARGET_WIDTH, top + TARGET_HEIGHT))
                    print(f"[PROCESS-METHOD] Fit width, crop height (center)")
                
                # Save processed image
                os.makedirs(OUTPUT_DIR, exist_ok=True)
                output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
                resized.save(output_path, "JPEG", quality=95, optimize=True)
                
                print(f"[OUTPUT-DIMENSION] Final: {TARGET_WIDTH}x{TARGET_HEIGHT}")
                print(f"[OUTPUT-FILE] Saved to {output_path}")
            
            print("\n" + "=" * 60)
            print("[SYSTEM-SUCCESS] Splash image processing completed")
            print(f"[OUTPUT-LOCATION] {OUTPUT_DIR}")
            print("=" * 60)
            
    except Exception as e:
        print(f"\n[ERROR-EXCEPTION] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    process_splash_image()
