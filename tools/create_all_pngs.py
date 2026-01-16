"""
File: create_all_pngs.py
Author: Wildflover
Description: Creates all PNG sizes needed for Tauri from login_icon.jpg
Language: Python 3.x
"""

from PIL import Image
import os

source = Image.open('login_icon.jpg').convert('RGBA')
output_dir = 'src-tauri/icons'

for size in [16, 24, 48, 64]:
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    path = os.path.join(output_dir, f'{size}x{size}.png')
    resized.save(path, 'PNG', optimize=True)
    print(f'[PNG] Created: {path}')

print('[DONE] All PNG sizes created')
