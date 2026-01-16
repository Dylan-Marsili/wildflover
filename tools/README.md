# Icon Generator Tool

**Author**: Wildflower  
**Version**: 1.0.0  
**Language**: Python 3.x

## Açıklama

wildflower_icon.jpg dosyasını çoklu boyutlarda PNG ve ICO formatına çeviren profesyonel araç.

## Özellikler

- JPG'den PNG'ye dönüştürme
- Çoklu boyut desteği (16x16, 32x32, 64x64, 128x128, 256x256, 512x512)
- Windows ICO dosyası oluşturma
- Tauri icons klasörüne otomatik kopyalama
- Yüksek kaliteli resampling (LANCZOS)
- Optimize edilmiş PNG çıktısı

## Kurulum

```bash
pip install -r requirements.txt
```

## Kullanım

```bash
python icon_generator.py
```

## Çıktı Dosyaları

### PNG Dosyaları
- `public/assets/icons/wildflower_16x16.png`
- `public/assets/icons/wildflower_32x32.png`
- `public/assets/icons/wildflower_64x64.png`
- `public/assets/icons/wildflower_128x128.png`
- `public/assets/icons/wildflower_256x256.png`
- `public/assets/icons/wildflower_512x512.png`

### ICO Dosyası
- `public/assets/icons/wildflower.ico` (Multi-size)

### Tauri Icons
- `src-tauri/icons/32x32.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/256x256.png`
- `src-tauri/icons/icon.png` (512x512)
- `src-tauri/icons/icon.ico` (Multi-size)

## Gereksinimler

- Python 3.7+
- Pillow (PIL Fork)

## Log Formatı

Tool profesyonel log formatı kullanır:

```
[SYSTEM:START] Wildflower Icon Generator v1.0.0
[INPUT:FILE] Loading wildflower_icon.jpg
[ICON:PNG] Generated 32x32 -> public/assets/icons/wildflower_32x32.png
[ICON:ICO] Generated multi-size ICO -> public/assets/icons/wildflower.ico
[SYSTEM:SUCCESS] Icon generation completed
```

## Notlar

- Input dosyası: `wildflower_icon.jpg` (proje root'unda olmalı)
- RGBA/LA/P modları otomatik RGB'ye çevrilir
- ICO dosyası Windows standart boyutlarını içerir
- Tüm PNG'ler optimize edilir
