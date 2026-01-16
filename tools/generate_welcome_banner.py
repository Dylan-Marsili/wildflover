"""
File: generate_welcome_banner.py
Author: Wildflover
Description: Professional Discord welcome banner - clean modern design
Language: Python
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import os

# [CONFIG] Banner dimensions
BANNER_WIDTH = 1200
BANNER_HEIGHT = 630

# [COLORS] Teal/Cyan theme
GRADIENT_START = (45, 195, 190)
GRADIENT_END = (90, 225, 215)
ACCENT = (65, 205, 195)
FRAME_COLOR = (55, 175, 170)

def draw_corner_frame(draw, width, height):
    """Draw minimal corner frame"""
    margin = 35
    corner = 45
    color = FRAME_COLOR + (180,)
    thin = FRAME_COLOR[:3] + (40,)
    
    # Corners
    corners = [
        [(margin, margin + corner), (margin, margin), (margin + corner, margin)],
        [(width - margin - corner, margin), (width - margin, margin), (width - margin, margin + corner)],
        [(margin, height - margin - corner), (margin, height - margin), (margin + corner, height - margin)],
        [(width - margin - corner, height - margin), (width - margin, height - margin), (width - margin, height - margin - corner)]
    ]
    
    for c in corners:
        draw.line([c[0], c[1]], fill=color, width=2)
        draw.line([c[1], c[2]], fill=color, width=2)
    
    # Thin lines
    gap = 20
    draw.line([(margin + corner + gap, margin), (width - margin - corner - gap, margin)], fill=thin, width=1)
    draw.line([(margin + corner + gap, height - margin), (width - margin - corner - gap, height - margin)], fill=thin, width=1)

def generate_welcome_banner():
    """Generate clean modern Discord welcome banner"""
    print("[BANNER-GEN] Creating banner...")
    
    # Load and prepare background
    source_path = os.path.join(os.path.dirname(__file__), '..', 'login_bg.jpg')
    bg = Image.open(source_path).convert('RGBA')
    
    # Crop and resize
    bg_ratio = bg.width / bg.height
    target_ratio = BANNER_WIDTH / BANNER_HEIGHT
    
    if bg_ratio > target_ratio:
        new_width = int(bg.height * target_ratio)
        left = (bg.width - new_width) // 2
        bg = bg.crop((left, 0, left + new_width, bg.height))
    else:
        new_height = int(bg.width / target_ratio)
        top = (bg.height - new_height) // 2
        bg = bg.crop((0, top, bg.width, top + new_height))
    
    bg = bg.resize((BANNER_WIDTH, BANNER_HEIGHT), Image.Resampling.LANCZOS)
    bg = ImageEnhance.Brightness(bg).enhance(0.82)
    
    # Dark overlay for readability
    overlay = Image.new('RGBA', (BANNER_WIDTH, BANNER_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    for y in range(BANNER_HEIGHT):
        dist = abs(y - BANNER_HEIGHT/2) / (BANNER_HEIGHT/2)
        alpha = int(85 * (1 - dist * 0.5))
        overlay_draw.line([(0, y), (BANNER_WIDTH, y)], fill=(10, 15, 20, alpha))
    
    bg = Image.alpha_composite(bg, overlay)
    
    # Draw frame
    frame = Image.new('RGBA', (BANNER_WIDTH, BANNER_HEIGHT), (0, 0, 0, 0))
    draw_corner_frame(ImageDraw.Draw(frame), BANNER_WIDTH, BANNER_HEIGHT)
    bg = Image.alpha_composite(bg, frame)
    
    # Load clean fonts (Arial/Calibri style - not scary)
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 72)
        font_subtitle = ImageFont.truetype("C:/Windows/Fonts/calibril.ttf", 24)
        font_welcome = ImageFont.truetype("C:/Windows/Fonts/calibrii.ttf", 22)
        font_features = ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 18)
        font_footer = ImageFont.truetype("C:/Windows/Fonts/calibril.ttf", 14)
    except:
        try:
            font_title = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 72)
            font_subtitle = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 24)
            font_welcome = ImageFont.truetype("C:/Windows/Fonts/ariali.ttf", 22)
            font_features = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
            font_footer = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 14)
        except:
            font_title = ImageFont.load_default()
            font_subtitle = font_title
            font_welcome = font_title
            font_features = font_title
            font_footer = font_title
    
    draw = ImageDraw.Draw(bg)
    
    # Title: "Wild" white + "flover" gradient - NO space between
    wild = "Wild"
    flover = "flover"
    
    wild_bbox = draw.textbbox((0, 0), wild, font=font_title)
    flover_bbox = draw.textbbox((0, 0), flover, font=font_title)
    
    wild_w = wild_bbox[2] - wild_bbox[0]
    flover_w = flover_bbox[2] - flover_bbox[0]
    
    total_w = wild_w + flover_w
    title_x = (BANNER_WIDTH - total_w) // 2
    title_y = 135
    
    # Draw "Wild" - white with subtle shadow
    draw.text((title_x + 2, title_y + 2), wild, font=font_title, fill=(0, 0, 0, 60))
    draw.text((title_x, title_y), wild, font=font_title, fill=(255, 255, 255, 255))
    
    # Draw "flover" - gradient character by character
    flover_x = title_x + wild_w
    char_x = flover_x
    
    for i, char in enumerate(flover):
        ratio = i / max(len(flover) - 1, 1)
        r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * ratio)
        g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * ratio)
        b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * ratio)
        
        draw.text((char_x + 2, title_y + 2), char, font=font_title, fill=(0, 0, 0, 50))
        draw.text((char_x, title_y), char, font=font_title, fill=(r, g, b, 255))
        
        char_bbox = draw.textbbox((0, 0), char, font=font_title)
        char_x += char_bbox[2] - char_bbox[0]
    
    # Subtitle
    subtitle = "League of Legends Skin Manager"
    sub_bbox = draw.textbbox((0, 0), subtitle, font=font_subtitle)
    sub_x = (BANNER_WIDTH - (sub_bbox[2] - sub_bbox[0])) // 2
    sub_y = title_y + 85
    
    draw.text((sub_x, sub_y), subtitle, font=font_subtitle, fill=(210, 215, 220, 255))
    
    # Gradient divider
    div_y = sub_y + 40
    div_w = 180
    div_x = (BANNER_WIDTH - div_w) // 2
    
    for i in range(div_w):
        dist = abs(i - div_w/2) / (div_w/2)
        alpha = int(180 * (1 - dist))
        ratio = i / div_w
        r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * ratio)
        g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * ratio)
        b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * ratio)
        draw.point((div_x + i, div_y), fill=(r, g, b, alpha))
    
    # Welcome text
    welcome = "Welcome to the Community"
    wel_bbox = draw.textbbox((0, 0), welcome, font=font_welcome)
    wel_x = (BANNER_WIDTH - (wel_bbox[2] - wel_bbox[0])) // 2
    wel_y = div_y + 18
    
    draw.text((wel_x, wel_y), welcome, font=font_welcome, fill=ACCENT + (255,))
    
    # Features - MORE items, positioned lower
    features = [
        "All champion skins unlocked for free",
        "Custom skin import & easy installation",
        "One-click apply system",
        "Regular updates & new skins",
        "Safe & undetectable",
        "Community support on Discord"
    ]
    
    feature_y = wel_y + 55  # Start lower
    
    for feature in features:
        icon = "—"  # Clean dash icon
        spacing = "    "  # More space between dash and text
        text = f"{icon}{spacing}{feature}"
        
        txt_bbox = draw.textbbox((0, 0), text, font=font_features)
        txt_w = txt_bbox[2] - txt_bbox[0]
        feat_x = (BANNER_WIDTH - txt_w) // 2
        
        # Icon in accent color
        icon_bbox = draw.textbbox((0, 0), icon, font=font_features)
        icon_w = icon_bbox[2] - icon_bbox[0]
        spacing_bbox = draw.textbbox((0, 0), spacing, font=font_features)
        spacing_w = spacing_bbox[2] - spacing_bbox[0]
        
        draw.text((feat_x, feature_y), icon, font=font_features, fill=ACCENT + (200,))
        draw.text((feat_x + icon_w + spacing_w, feature_y), feature, font=font_features, fill=(195, 200, 205, 255))
        
        feature_y += 28
    
    # Footer
    footer = "wildflover.dev"
    foot_bbox = draw.textbbox((0, 0), footer, font=font_footer)
    foot_x = (BANNER_WIDTH - (foot_bbox[2] - foot_bbox[0])) // 2
    foot_y = BANNER_HEIGHT - 55
    
    draw.text((foot_x, foot_y), footer, font=font_footer, fill=(130, 140, 145, 140))
    
    # Save
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'discord')
    os.makedirs(output_dir, exist_ok=True)
    
    out_path = os.path.join(output_dir, 'welcome_banner.png')
    bg.convert('RGB').save(out_path, 'PNG', quality=95)
    
    embed_path = os.path.join(output_dir, 'welcome_embed.png')
    bg.resize((800, 420), Image.Resampling.LANCZOS).convert('RGB').save(embed_path, 'PNG', quality=90)
    
    print(f"[BANNER-GEN] Saved: {out_path}")
    print(f"[BANNER-GEN] Saved: {embed_path}")
    
    return True

if __name__ == "__main__":
    generate_welcome_banner()
