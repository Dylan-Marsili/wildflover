"""
File: image_info.py
Author: Wildflower
Description: Get image dimensions and info
Language: Python 3.x
"""

from PIL import Image
import os

image_path = "public/assets/backgrounds/wildflover_bg.jpg"

if os.path.exists(image_path):
    with Image.open(image_path) as img:
        width, height = img.size
        mode = img.mode
        format_type = img.format
        
        print("=" * 60)
        print("[IMAGE:INFO] Wildflower Background Image")
        print("=" * 60)
        print(f"[DIMENSION:WIDTH] {width}px")
        print(f"[DIMENSION:HEIGHT] {height}px")
        print(f"[DIMENSION:RATIO] {width}:{height}")
        print(f"[FORMAT:TYPE] {format_type}")
        print(f"[COLOR:MODE] {mode}")
        print("=" * 60)
else:
    print("[ERROR] File not found")
