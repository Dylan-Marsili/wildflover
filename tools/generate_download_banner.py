"""
File: generate_download_banner.py
Author: Wildflover
Description: Professional download channel banner for Discord
             - Optimized for Discord embed display (~520px width)
             - Large readable fonts for small preview
             - Minimal clean design
Language: Python
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import os

# [CONFIG] Banner dimensions - Discord embed optimized (16:9 ratio)
# Discord shows embeds at ~520px width, so we design for that scale
BANNER_WIDTH = 1040
BANNER_HEIGHT = 585

# [COLORS] Pink/Purple theme
GRADIENT_START = (201, 75, 124)   # Wildflover pink
GRADIENT_END = (160, 90, 140)     # Purple-pink
ACCENT = (220, 100, 150)
LIGHT_ACCENT = (240, 150, 180)
DARK_BG = (20, 15, 25)


def draw_download_icon(draw, x, y, size, color):
    """Draw a modern download arrow icon"""
    # Arrow body - thicker lines for visibility
    line_x = x + size // 2
    arrow_height = int(size * 0.55)
    
    # Vertical line
    draw.line([(line_x, y), (line_x, y + arrow_height)], fill=color, width=4)
    
    # Arrow head
    head_size = size // 3
    draw.line([(line_x - head_size, y + arrow_height - head_size), 
               (line_x, y + arrow_height)], fill=color, width=4)
    draw.line([(line_x + head_size, y + arrow_height - head_size), 
               (line_x, y + arrow_height)], fill=color, width=4)
    
    # Bottom tray
    tray_y = y + size - 10
    tray_width = size - 16
    draw.line([(x + 8, tray_y), (x + tray_width + 8, tray_y)], fill=color, width=4)
    draw.line([(x + 8, tray_y), (x + 8, tray_y - 10)], fill=color, width=4)
    draw.line([(x + tray_width + 8, tray_y), (x + tray_width + 8, tray_y - 10)], fill=color, width=4)


def generate_download_banner():
    """Generate professional download channel banner - Discord optimized"""
    print("[DOWNLOAD-BANNER] Creating Discord-optimized banner...")
    
    # Load background
    source_path = os.path.join(os.path.dirname(__file__), '..', 
                               'public', 'assets', 'backgrounds', 'wildflover_bg.jpg')
    
    if not os.path.exists(source_path):
        print(f"[DOWNLOAD-BANNER] Error: Source not found at {source_path}")
        return False
    
    bg = Image.open(source_path).convert('RGBA')
    print(f"[DOWNLOAD-BANNER] Loaded source: {bg.size}")
    
    # Crop and resize to target
    bg_ratio = bg.width / bg.height
    target_ratio = BANNER_WIDTH / BANNER_HEIGHT
    
    if bg_ratio > target_ratio:
        new_width = int(bg.height * target_ratio)
        left = (bg.width - new_width) // 2
        bg = bg.crop((left, 0, left + new_width, bg.height))
    else:
        new_height = int(bg.width / target_ratio)
        top = (bg.height - new_height) // 3
        bg = bg.crop((0, top, bg.width, top + new_height))
    
    bg = bg.resize((BANNER_WIDTH, BANNER_HEIGHT), Image.Resampling.LANCZOS)
    
    # Darken background significantly for text readability
    bg = ImageEnhance.Brightness(bg).enhance(0.5)
    bg = ImageEnhance.Contrast(bg).enhance(1.15)
    
    # Dark gradient overlay - stronger on left side
    overlay = Image.new('RGBA', (BANNER_WIDTH, BANNER_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    for x in range(BANNER_WIDTH):
        ratio = x / BANNER_WIDTH
        # Much darker on left for text area
        alpha = int(200 - 120 * ratio)
        overlay_draw.line([(x, 0), (x, BANNER_HEIGHT)], fill=(10, 5, 15, alpha))
    
    bg = Image.alpha_composite(bg, overlay)
    
    # Load fonts - LARGE sizes for Discord embed visibility
    try:
        fonts = {
            'title': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 72),
            'subtitle': ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 36),
            'badge': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 28),
            'feature': ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 30),
            'feature_tr': ImageFont.truetype("C:/Windows/Fonts/calibril.ttf", 24),
            'brand': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 42)
        }
    except Exception as e:
        print(f"[DOWNLOAD-BANNER] Font error: {e}, using default")
        default = ImageFont.load_default()
        fonts = {k: default for k in ['title', 'subtitle', 'badge', 'feature', 'feature_tr', 'brand']}
    
    draw = ImageDraw.Draw(bg)
    
    # === LEFT SECTION - Main Content ===
    content_x = 50
    
    # Download icon with glow circle
    icon_size = 70
    icon_x = content_x
    icon_y = 60
    
    circle_r = 50
    circle_x = icon_x + icon_size // 2
    circle_y = icon_y + icon_size // 2
    
    # Gradient glow circle
    for r in range(circle_r, 0, -1):
        ratio = r / circle_r
        alpha = int(200 * ratio)
        cr = int(GRADIENT_START[0] * ratio + 30 * (1 - ratio))
        cg = int(GRADIENT_START[1] * ratio + 15 * (1 - ratio))
        cb = int(GRADIENT_START[2] * ratio + 40 * (1 - ratio))
        draw.ellipse([circle_x - r, circle_y - r, circle_x + r, circle_y + r],
                     fill=(cr, cg, cb, alpha))
    
    draw_download_icon(draw, icon_x + 10, icon_y + 8, 55, (255, 255, 255, 255))
    
    # "Download" title - large and bold
    title_x = icon_x + icon_size + 30
    title_y = icon_y - 8
    
    # Draw with slight shadow for depth
    shadow_offset = 2
    draw.text((title_x + shadow_offset, title_y + shadow_offset), "Download", 
              font=fonts['title'], fill=(0, 0, 0, 100))
    draw.text((title_x, title_y), "Download", font=fonts['title'], fill=(255, 255, 255, 255))
    
    # Turkish subtitle
    draw.text((title_x, title_y + 75), "İndir", font=fonts['subtitle'], 
              fill=(200, 190, 210, 220))
    
    # Badge row - Wildflover + Windows
    badge_y = 200
    
    # Wildflover badge with gradient background
    badge_text = "Wildflover"
    badge_bbox = draw.textbbox((0, 0), badge_text, font=fonts['badge'])
    badge_w = badge_bbox[2] - badge_bbox[0] + 30
    badge_h = 40
    
    # Draw gradient badge
    for i in range(badge_h):
        ratio = i / badge_h
        r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * ratio)
        g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * ratio)
        b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * ratio)
        draw.line([(content_x, badge_y + i), (content_x + badge_w, badge_y + i)],
                  fill=(r, g, b, 230))
    
    # Badge text centered
    draw.text((content_x + 15, badge_y + 6), badge_text, font=fonts['badge'], 
              fill=(255, 255, 255, 255))
    
    # Windows platform text
    platform_x = content_x + badge_w + 20
    draw.text((platform_x, badge_y + 8), "Windows 10/11", font=fonts['badge'],
              fill=(180, 175, 195, 255))
    
    # Features - simplified, larger text
    features = [
        ("All Skins Unlocked", "Tüm Skinler Açık"),
        ("Safe & Undetectable", "Güvenli"),
        ("Auto Updates", "Otomatik Güncelleme")
    ]
    
    feature_y = 280
    feature_spacing = 55
    
    for feat_en, feat_tr in features:
        # Pink bullet
        bullet_color = GRADIENT_START + (255,)
        draw.text((content_x, feature_y - 2), "›", font=fonts['feature'], fill=bullet_color)
        
        # English feature - bold white
        draw.text((content_x + 25, feature_y), feat_en, font=fonts['feature'],
                  fill=(240, 235, 250, 255))
        
        # Turkish - smaller, muted
        en_bbox = draw.textbbox((0, 0), feat_en, font=fonts['feature'])
        en_w = en_bbox[2] - en_bbox[0]
        draw.text((content_x + 30 + en_w, feature_y + 4), f" / {feat_tr}",
                  font=fonts['feature_tr'], fill=(160, 150, 175, 200))
        
        feature_y += feature_spacing
    
    # === RIGHT SECTION - Branding ===
    brand_x = BANNER_WIDTH - 280
    brand_y = BANNER_HEIGHT // 2 - 25
    
    # "Wild" in white
    draw.text((brand_x, brand_y), "Wild", font=fonts['brand'], fill=(255, 255, 255, 240))
    
    # "flover" in gradient pink
    wild_bbox = draw.textbbox((0, 0), "Wild", font=fonts['brand'])
    flover_x = brand_x + (wild_bbox[2] - wild_bbox[0])
    
    for i, char in enumerate("flover"):
        ratio = i / 5
        r = int(GRADIENT_START[0] + (LIGHT_ACCENT[0] - GRADIENT_START[0]) * ratio)
        g = int(GRADIENT_START[1] + (LIGHT_ACCENT[1] - GRADIENT_START[1]) * ratio)
        b = int(GRADIENT_START[2] + (LIGHT_ACCENT[2] - GRADIENT_START[2]) * ratio)
        
        char_bbox = draw.textbbox((0, 0), "flover"[:i], font=fonts['brand'])
        char_x = flover_x + (char_bbox[2] - char_bbox[0])
        draw.text((char_x, brand_y), char, font=fonts['brand'], fill=(r, g, b, 240))
    
    # Tagline
    tagline = "LoL Skin Manager"
    draw.text((brand_x, brand_y + 55), tagline, font=fonts['feature_tr'],
              fill=(180, 170, 195, 200))
    
    # === DECORATIVE ELEMENTS ===
    
    # Bottom accent line - gradient
    line_y = BANNER_HEIGHT - 6
    for x in range(BANNER_WIDTH):
        ratio = x / BANNER_WIDTH
        alpha = int(180 * (1 - abs(ratio - 0.25) * 1.8))
        if alpha > 0:
            r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * ratio)
            g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * ratio)
            b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * ratio)
            draw.line([(x, line_y), (x, line_y + 3)], fill=(r, g, b, max(0, alpha)))
    
    # Corner accents
    corner_size = 35
    corner_color = GRADIENT_START + (150,)
    corner_width = 3
    margin = 20
    
    # Top-left
    draw.line([(margin, margin), (margin, margin + corner_size)], fill=corner_color, width=corner_width)
    draw.line([(margin, margin), (margin + corner_size, margin)], fill=corner_color, width=corner_width)
    
    # Top-right
    draw.line([(BANNER_WIDTH - margin, margin), (BANNER_WIDTH - margin, margin + corner_size)], fill=corner_color, width=corner_width)
    draw.line([(BANNER_WIDTH - margin, margin), (BANNER_WIDTH - margin - corner_size, margin)], fill=corner_color, width=corner_width)
    
    # Bottom-left
    draw.line([(margin, BANNER_HEIGHT - margin), (margin, BANNER_HEIGHT - margin - corner_size)], fill=corner_color, width=corner_width)
    draw.line([(margin, BANNER_HEIGHT - margin), (margin + corner_size, BANNER_HEIGHT - margin)], fill=corner_color, width=corner_width)
    
    # Bottom-right
    draw.line([(BANNER_WIDTH - margin, BANNER_HEIGHT - margin), (BANNER_WIDTH - margin, BANNER_HEIGHT - margin - corner_size)], fill=corner_color, width=corner_width)
    draw.line([(BANNER_WIDTH - margin, BANNER_HEIGHT - margin), (BANNER_WIDTH - margin - corner_size, BANNER_HEIGHT - margin)], fill=corner_color, width=corner_width)
    
    # === SAVE OUTPUTS ===
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'discord')
    os.makedirs(output_dir, exist_ok=True)
    
    # Main banner - full size
    output_path = os.path.join(output_dir, 'download_banner.png')
    bg.convert('RGB').save(output_path, 'PNG', quality=95)
    print(f"[DOWNLOAD-BANNER] Saved main: {output_path} ({BANNER_WIDTH}x{BANNER_HEIGHT})")
    
    # Discord embed optimized - 520px width (Discord's typical embed width)
    embed_path = os.path.join(output_dir, 'download_embed.png')
    embed_width = 520
    embed_height = int(BANNER_HEIGHT * (embed_width / BANNER_WIDTH))
    bg.resize((embed_width, embed_height), Image.Resampling.LANCZOS).convert('RGB').save(embed_path, 'PNG', quality=95)
    print(f"[DOWNLOAD-BANNER] Saved embed: {embed_path} ({embed_width}x{embed_height})")
    
    return True


if __name__ == "__main__":
    generate_download_banner()
