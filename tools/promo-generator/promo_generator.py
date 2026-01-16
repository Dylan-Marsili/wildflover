"""
File: promo_generator.py
Author: Wildflover
Description: Professional promotional banner generator for Wildflover application
Language: Python 3.x
Dependencies: Pillow (PIL)
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
from pathlib import Path


class PromoConfig:
    INPUT_IMAGE = "public/assets/backgrounds/wildflover_bg.jpg"
    OUTPUT_IMAGE = "tools/promo-generator/wildflover_promo.png"
    DISCORD_LINK = "discord.com/invite/QxJG4TENdD"
    TAGLINE = "PROFESSIONAL SKIN MANAGER"
    FEATURES = ["Instant Activation", "All Skins & Chromas", "Safe & Secure", "Custom Mods"]


def get_font(size, bold=False):
    paths = [
        ("C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeui.ttf"),
        ("C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"),
    ]
    for bold_p, reg_p in paths:
        path = bold_p if bold else reg_p
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()


def render_text_image(text, font, fill):
    """[RENDER] Creates a cropped image of text with exact bounds"""
    temp = Image.new('RGBA', (1000, 200), (0, 0, 0, 0))
    temp_draw = ImageDraw.Draw(temp)
    temp_draw.text((50, 50), text, font=font, fill=fill)
    bbox = temp.getbbox()
    if bbox:
        return temp.crop(bbox)
    return temp


class PromoGenerator:
    def __init__(self, config=None):
        self.config = config or PromoConfig()
        self.image = None
        self.width = 0
        self.height = 0
    
    def load_background(self):
        try:
            bg_path = Path(self.config.INPUT_IMAGE)
            if not bg_path.exists():
                print(f"[LOAD-ERROR] Not found: {bg_path}")
                return False
            self.image = Image.open(bg_path).convert('RGBA')
            self.width, self.height = self.image.size
            print(f"[LOAD-SUCCESS] Background: {self.width}x{self.height}")
            return True
        except Exception as e:
            print(f"[LOAD-ERROR] {e}")
            return False
    
    def apply_overlay(self):
        overlay = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        for y in range(self.height):
            if y < self.height * 0.08:
                alpha = int(70 * (1 - y / (self.height * 0.08)))
                draw.line([(0, y), (self.width, y)], fill=(0, 0, 0, alpha))
            elif y > self.height * 0.92:
                progress = (y - self.height * 0.92) / (self.height * 0.08)
                alpha = int(50 * progress)
                draw.line([(0, y), (self.width, y)], fill=(0, 0, 0, alpha))
        self.image = Image.alpha_composite(self.image, overlay)
        print("[OVERLAY-APPLIED] Vignette added")
    
    def draw_discord_badge(self):
        layer = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        font = get_font(18, bold=True)
        
        text_img = render_text_image(self.config.DISCORD_LINK, font, (255, 255, 255, 255))
        text_w, text_h = text_img.size
        
        icon_size = 10
        icon_gap = 12
        pad_x, pad_y = 20, 10
        
        badge_w = icon_size * 2 + icon_gap + text_w + pad_x * 2
        badge_h = max(text_h, icon_size * 2) + pad_y * 2
        
        badge_x = (self.width - badge_w) // 2
        badge_y = 25
        
        # [BG] Badge background
        draw.rounded_rectangle(
            [badge_x, badge_y, badge_x + badge_w, badge_y + badge_h],
            radius=badge_h // 2,
            fill=(20, 20, 35, 220),
            outline=(88, 101, 242, 200),
            width=2
        )
        
        # [ICON] Discord icon - simple filled circle
        icon_cx = badge_x + pad_x + icon_size
        icon_cy = badge_y + badge_h // 2
        draw.ellipse(
            [icon_cx - icon_size, icon_cy - icon_size, icon_cx + icon_size, icon_cy + icon_size],
            fill=(88, 101, 242, 255)
        )
        
        # [TEXT] Paste text
        text_x = icon_cx + icon_size + icon_gap
        text_y = badge_y + (badge_h - text_h) // 2
        layer.paste(text_img, (text_x, text_y), text_img)
        
        self.image = Image.alpha_composite(self.image, layer)
        print("[DISCORD-BADGE] Badge rendered")
    
    def draw_title(self):
        layer = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        
        font_size = min(85, self.width // 11)
        font = get_font(font_size, bold=True)
        
        wild_img = render_text_image("Wild", font, (255, 255, 255, 255))
        wild_w, wild_h = wild_img.size
        
        flover_img = render_text_image("flover", font, (255, 255, 255, 255))
        flover_w, flover_h = flover_img.size
        
        # [GRADIENT] Pink gradient for flover
        for py in range(flover_img.height):
            progress = py / flover_img.height
            r = 255
            g = int(150 - progress * 70)
            b = int(175 - progress * 25)
            for px in range(flover_img.width):
                pixel = flover_img.getpixel((px, py))
                if pixel[3] > 0:
                    flover_img.putpixel((px, py), (r, g, b, pixel[3]))
        
        total_w = wild_w + flover_w - 5
        start_x = (self.width - total_w) // 2
        y = int(self.height * 0.24)
        
        layer.paste(wild_img, (start_x, y), wild_img)
        layer.paste(flover_img, (start_x + wild_w - 5, y), flover_img)
        
        self.image = Image.alpha_composite(self.image, layer)
        print("[TITLE-DRAWN] Split title rendered")
    
    def draw_tagline(self):
        layer = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        font = get_font(18, bold=True)
        
        text_img = render_text_image(self.config.TAGLINE, font, (255, 255, 255, 255))
        text_w, text_h = text_img.size
        
        x = (self.width - text_w) // 2
        y = int(self.height * 0.40)
        
        # [SHADOW] Dark shadow for better visibility
        shadow_img = render_text_image(self.config.TAGLINE, font, (0, 0, 0, 180))
        layer.paste(shadow_img, (x + 2, y + 2), shadow_img)
        
        # [TEXT] Main text
        layer.paste(text_img, (x, y), text_img)
        
        # [UNDERLINE] Subtle pink accent line
        line_w = text_w // 3
        line_x = (self.width - line_w) // 2
        line_y = y + text_h + 8
        draw.rounded_rectangle(
            [line_x, line_y, line_x + line_w, line_y + 2],
            radius=1,
            fill=(255, 150, 180, 200)
        )
        
        self.image = Image.alpha_composite(self.image, layer)
        print("[TAGLINE-DRAWN] Tagline rendered")
    
    def draw_features(self):
        layer = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        font = get_font(13, bold=True)
        
        pad_x, pad_y, spacing = 18, 10, 14
        
        pill_data = []
        for f in self.config.FEATURES:
            # [FIX] Full opacity white text
            text_img = render_text_image(f, font, (255, 255, 255, 255))
            tw, th = text_img.size
            pw = tw + pad_x * 2
            ph = th + pad_y * 2
            pill_data.append((text_img, tw, th, pw, ph))
        
        total_w = sum(p[3] for p in pill_data) + spacing * (len(self.config.FEATURES) - 1)
        max_h = max(p[4] for p in pill_data)
        
        start_x = (self.width - total_w) // 2
        y = int(self.height * 0.52)
        
        current_x = start_x
        for text_img, tw, th, pw, ph in pill_data:
            # [PILL] More visible background
            draw.rounded_rectangle(
                [current_x, y, current_x + pw, y + max_h],
                radius=max_h // 2,
                fill=(30, 30, 45, 180),
                outline=(255, 180, 200, 150),
                width=1
            )
            
            text_x = current_x + (pw - tw) // 2
            text_y = y + (max_h - th) // 2
            layer.paste(text_img, (text_x, text_y), text_img)
            
            current_x += pw + spacing
        
        self.image = Image.alpha_composite(self.image, layer)
        print("[FEATURES-DRAWN] Feature pills rendered")
    
    def draw_cta_button(self):
        layer = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        font = get_font(17, bold=True)
        
        # [FIX] Full opacity text
        text_img = render_text_image("Join Us", font, (255, 255, 255, 255))
        text_w, text_h = text_img.size
        
        pad_x, pad_y = 38, 12
        btn_w = text_w + pad_x * 2
        btn_h = text_h + pad_y * 2
        
        btn_x = (self.width - btn_w) // 2
        btn_y = int(self.height * 0.66)
        
        # [BTN] More visible glass button
        draw.rounded_rectangle(
            [btn_x, btn_y, btn_x + btn_w, btn_y + btn_h],
            radius=btn_h // 2,
            fill=(40, 40, 60, 180),
            outline=(255, 160, 190, 220),
            width=2
        )
        
        text_x = btn_x + (btn_w - text_w) // 2
        text_y = btn_y + (btn_h - text_h) // 2
        layer.paste(text_img, (text_x, text_y), text_img)
        
        self.image = Image.alpha_composite(self.image, layer)
        print("[CTA-DRAWN] Glass button rendered")
    
    def add_glow(self):
        glow = Image.new('RGBA', (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(glow)
        cx, cy = int(self.width * 0.75), int(self.height * 0.25)
        for r in range(100, 0, -4):
            alpha = int(6 * (r / 100))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 105, 180, alpha))
        glow = glow.filter(ImageFilter.GaussianBlur(30))
        self.image = Image.alpha_composite(self.image, glow)
        print("[GLOW-APPLIED] Ambient glow added")
    
    def save(self):
        try:
            output = Path(self.config.OUTPUT_IMAGE)
            output.parent.mkdir(parents=True, exist_ok=True)
            self.image.convert('RGB').save(output, 'PNG', quality=95)
            print(f"[SAVE-SUCCESS] {output}")
            return True
        except Exception as e:
            print(f"[SAVE-ERROR] {e}")
            return False
    
    def generate(self):
        print("\n" + "=" * 50)
        print("[PROMO-GEN] Wildflover Banner Generator")
        print("=" * 50 + "\n")
        if not self.load_background():
            return False
        self.apply_overlay()
        self.add_glow()
        self.draw_discord_badge()
        self.draw_title()
        self.draw_tagline()
        self.draw_features()
        self.draw_cta_button()
        return self.save()


if __name__ == "__main__":
    PromoGenerator().generate()
