"""
File: generate_login_guide.py
Author: Wildflover
Description: Generates bilingual login guide image (TR/EN)
             - Uses wildflover_splash_login.jpg as base
             - Professional gradient overlays matching image palette
             - Step-by-step login instructions
Language: Python
"""

from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
import os

# [CONFIG] Output dimensions
OUTPUT_WIDTH = 1400
OUTPUT_HEIGHT = 900

# [COLORS] Purple/Pink theme from splash image
GRADIENT_PRIMARY = (180, 100, 160)    # Purple-pink
GRADIENT_SECONDARY = (220, 140, 180)  # Light pink
ACCENT = (200, 120, 170)
DARK_BG = (25, 15, 35)

def create_step_box(draw, x, y, width, height, step_num, title_en, title_tr, desc_en, desc_tr, fonts, colors):
    """Draw a step instruction box"""
    # Semi-transparent background
    box_color = (30, 20, 45, 200)
    
    # Box with rounded feel (rectangle for simplicity)
    for i in range(height):
        alpha = 180 + int(20 * (1 - i/height))
        draw.line([(x, y + i), (x + width, y + i)], fill=(25, 18, 38, alpha))
    
    # Left accent bar
    bar_width = 4
    for i in range(height - 20):
        ratio = i / height
        r = int(GRADIENT_PRIMARY[0] + (GRADIENT_SECONDARY[0] - GRADIENT_PRIMARY[0]) * ratio)
        g = int(GRADIENT_PRIMARY[1] + (GRADIENT_SECONDARY[1] - GRADIENT_PRIMARY[1]) * ratio)
        b = int(GRADIENT_PRIMARY[2] + (GRADIENT_SECONDARY[2] - GRADIENT_PRIMARY[2]) * ratio)
        draw.line([(x, y + 10 + i), (x + bar_width, y + 10 + i)], fill=(r, g, b, 255))
    
    # Step number circle
    circle_x = x + 30
    circle_y = y + 25
    circle_r = 18
    
    # Draw circle
    for angle_offset in range(360):
        import math
        rad = math.radians(angle_offset)
        for r_off in range(circle_r):
            px = int(circle_x + r_off * math.cos(rad))
            py = int(circle_y + r_off * math.sin(rad))
            if r_off < circle_r - 2:
                ratio = angle_offset / 360
                cr = int(GRADIENT_PRIMARY[0] + (GRADIENT_SECONDARY[0] - GRADIENT_PRIMARY[0]) * ratio)
                cg = int(GRADIENT_PRIMARY[1] + (GRADIENT_SECONDARY[1] - GRADIENT_PRIMARY[1]) * ratio)
                cb = int(GRADIENT_PRIMARY[2] + (GRADIENT_SECONDARY[2] - GRADIENT_PRIMARY[2]) * ratio)
    
    # Simple filled circle
    draw.ellipse([circle_x - circle_r, circle_y - circle_r, 
                  circle_x + circle_r, circle_y + circle_r], 
                 fill=GRADIENT_PRIMARY + (255,))
    
    # Step number
    num_text = str(step_num)
    num_bbox = draw.textbbox((0, 0), num_text, font=fonts['number'])
    num_w = num_bbox[2] - num_bbox[0]
    num_h = num_bbox[3] - num_bbox[1]
    draw.text((circle_x - num_w//2, circle_y - num_h//2 - 2), num_text, 
              font=fonts['number'], fill=(255, 255, 255, 255))
    
    # Titles (EN / TR)
    title_x = x + 60
    title_y = y + 12
    
    # English title
    draw.text((title_x, title_y), title_en, font=fonts['title'], fill=(255, 255, 255, 255))
    
    # Turkish title (smaller, below)
    draw.text((title_x, title_y + 22), title_tr, font=fonts['title_small'], 
              fill=(180, 170, 190, 220))
    
    # Descriptions
    desc_y = y + 58
    
    # English description
    draw.text((title_x, desc_y), desc_en, font=fonts['desc'], fill=(200, 195, 210, 255))
    
    # Turkish description
    draw.text((title_x, desc_y + 20), desc_tr, font=fonts['desc_small'], 
              fill=(160, 150, 170, 200))

def generate_login_guide():
    """Generate bilingual login guide image"""
    print("[LOGIN-GUIDE] Creating login guide...")
    
    # Load splash image
    source_path = os.path.join(os.path.dirname(__file__), '..', 
                               'public', 'assets', 'backgrounds', 'wildflover_splash_login.jpg')
    
    if not os.path.exists(source_path):
        print(f"[LOGIN-GUIDE] Error: Source not found: {source_path}")
        return False
    
    bg = Image.open(source_path).convert('RGBA')
    print(f"[LOGIN-GUIDE] Loaded: {bg.size}")
    
    # Resize to output dimensions
    bg_ratio = bg.width / bg.height
    target_ratio = OUTPUT_WIDTH / OUTPUT_HEIGHT
    
    if bg_ratio > target_ratio:
        new_width = int(bg.height * target_ratio)
        left = (bg.width - new_width) // 2
        bg = bg.crop((left, 0, left + new_width, bg.height))
    else:
        new_height = int(bg.width / target_ratio)
        top = (bg.height - new_height) // 2
        bg = bg.crop((0, top, bg.width, top + new_height))
    
    bg = bg.resize((OUTPUT_WIDTH, OUTPUT_HEIGHT), Image.Resampling.LANCZOS)
    
    # Darken for readability
    bg = ImageEnhance.Brightness(bg).enhance(0.7)
    
    # Add gradient overlay (darker on right side for text)
    overlay = Image.new('RGBA', (OUTPUT_WIDTH, OUTPUT_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    for x in range(OUTPUT_WIDTH):
        # Stronger on right side
        ratio = x / OUTPUT_WIDTH
        alpha = int(50 + 120 * ratio)
        overlay_draw.line([(x, 0), (x, OUTPUT_HEIGHT)], fill=(20, 12, 30, alpha))
    
    bg = Image.alpha_composite(bg, overlay)
    
    # Load fonts
    try:
        fonts = {
            'header': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 42),
            'header_small': ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 28),
            'number': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 22),
            'title': ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", 18),
            'title_small': ImageFont.truetype("C:/Windows/Fonts/calibrii.ttf", 14),
            'desc': ImageFont.truetype("C:/Windows/Fonts/calibri.ttf", 15),
            'desc_small': ImageFont.truetype("C:/Windows/Fonts/calibrii.ttf", 13),
            'footer': ImageFont.truetype("C:/Windows/Fonts/calibril.ttf", 14)
        }
    except:
        default = ImageFont.load_default()
        fonts = {k: default for k in ['header', 'header_small', 'number', 'title', 
                                       'title_small', 'desc', 'desc_small', 'footer']}
    
    draw = ImageDraw.Draw(bg)
    
    # Header section
    header_en = "How to Login"
    header_tr = "Nasıl Giriş Yapılır"
    
    # Position header on right side
    header_x = OUTPUT_WIDTH - 450
    header_y = 60
    
    # Draw header with gradient effect
    for i, char in enumerate(header_en):
        ratio = i / max(len(header_en) - 1, 1)
        r = int(GRADIENT_PRIMARY[0] + (GRADIENT_SECONDARY[0] - GRADIENT_PRIMARY[0]) * ratio)
        g = int(GRADIENT_PRIMARY[1] + (GRADIENT_SECONDARY[1] - GRADIENT_PRIMARY[1]) * ratio)
        b = int(GRADIENT_PRIMARY[2] + (GRADIENT_SECONDARY[2] - GRADIENT_PRIMARY[2]) * ratio)
        
        char_bbox = draw.textbbox((0, 0), header_en[:i], font=fonts['header'])
        char_x = header_x + (char_bbox[2] - char_bbox[0])
        draw.text((char_x, header_y), char, font=fonts['header'], fill=(r, g, b, 255))
    
    # Turkish header
    draw.text((header_x, header_y + 48), header_tr, font=fonts['header_small'], 
              fill=(160, 140, 170, 200))
    
    # Divider line
    div_y = header_y + 90
    div_width = 350
    for i in range(div_width):
        ratio = i / div_width
        alpha = int(200 * (1 - abs(ratio - 0.5) * 2) * 0.7)
        r = int(GRADIENT_PRIMARY[0] + (GRADIENT_SECONDARY[0] - GRADIENT_PRIMARY[0]) * ratio)
        g = int(GRADIENT_PRIMARY[1] + (GRADIENT_SECONDARY[1] - GRADIENT_PRIMARY[1]) * ratio)
        b = int(GRADIENT_PRIMARY[2] + (GRADIENT_SECONDARY[2] - GRADIENT_PRIMARY[2]) * ratio)
        draw.point((header_x + i, div_y), fill=(r, g, b, alpha))
    
    # Steps data
    steps = [
        {
            'title_en': "Open Wildflover",
            'title_tr': "Wildflover'ı Açın",
            'desc_en': "Launch the application from your desktop",
            'desc_tr': "Masaüstünden uygulamayı başlatın"
        },
        {
            'title_en': "Click Discord Login",
            'title_tr': "Discord ile Giriş'e Tıklayın",
            'desc_en': "Press the Discord button on login screen",
            'desc_tr': "Giriş ekranındaki Discord butonuna basın"
        },
        {
            'title_en': "Authorize Access",
            'title_tr': "Erişime İzin Verin",
            'desc_en': "Allow Wildflover to access your Discord",
            'desc_tr': "Wildflover'ın Discord'unuza erişmesine izin verin"
        },
        {
            'title_en': "Join Our Server",
            'title_tr': "Sunucumuza Katılın",
            'desc_en': "You must be a member of our Discord server",
            'desc_tr': "Discord sunucumuzun üyesi olmalısınız"
        },
        {
            'title_en': "Start Using",
            'title_tr': "Kullanmaya Başlayın",
            'desc_en': "Select skins and apply them to your game",
            'desc_tr': "Skinleri seçin ve oyununuza uygulayın"
        }
    ]
    
    # Draw steps
    step_x = OUTPUT_WIDTH - 480
    step_y = div_y + 30
    step_height = 95
    step_width = 420
    
    for i, step in enumerate(steps):
        create_step_box(draw, step_x, step_y + i * (step_height + 15), 
                       step_width, step_height, i + 1,
                       step['title_en'], step['title_tr'],
                       step['desc_en'], step['desc_tr'],
                       fonts, None)
    
    # Footer note
    footer_y = OUTPUT_HEIGHT - 50
    footer_en = "Need help? Join our Discord community for support"
    footer_tr = "Yardıma mı ihtiyacınız var? Destek için Discord sunucumuza katılın"
    
    draw.text((header_x, footer_y - 20), footer_en, font=fonts['footer'], 
              fill=(180, 170, 190, 180))
    draw.text((header_x, footer_y), footer_tr, font=fonts['footer'], 
              fill=(140, 130, 150, 150))
    
    # Wildflover branding (bottom left)
    brand_x = 40
    brand_y = OUTPUT_HEIGHT - 60
    
    # "Wild" in white
    draw.text((brand_x, brand_y), "Wild", font=fonts['header_small'], 
              fill=(255, 255, 255, 200))
    
    # "flover" in gradient
    wild_bbox = draw.textbbox((0, 0), "Wild", font=fonts['header_small'])
    flover_x = brand_x + (wild_bbox[2] - wild_bbox[0])
    
    for i, char in enumerate("flover"):
        ratio = i / 5
        r = int(GRADIENT_PRIMARY[0] + (GRADIENT_SECONDARY[0] - GRADIENT_PRIMARY[0]) * ratio)
        g = int(GRADIENT_PRIMARY[1] + (GRADIENT_SECONDARY[1] - GRADIENT_PRIMARY[1]) * ratio)
        b = int(GRADIENT_PRIMARY[2] + (GRADIENT_SECONDARY[2] - GRADIENT_PRIMARY[2]) * ratio)
        
        char_bbox = draw.textbbox((0, 0), "flover"[:i], font=fonts['header_small'])
        char_x = flover_x + (char_bbox[2] - char_bbox[0])
        draw.text((char_x, brand_y), char, font=fonts['header_small'], fill=(r, g, b, 200))
    
    # Save output
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'discord')
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, 'login_guide.png')
    bg.convert('RGB').save(output_path, 'PNG', quality=95)
    
    # Smaller version
    small_path = os.path.join(output_dir, 'login_guide_small.png')
    bg.resize((1000, 643), Image.Resampling.LANCZOS).convert('RGB').save(small_path, 'PNG', quality=90)
    
    print(f"[LOGIN-GUIDE] Saved: {output_path}")
    print(f"[LOGIN-GUIDE] Saved: {small_path}")
    
    return True

if __name__ == "__main__":
    generate_login_guide()
