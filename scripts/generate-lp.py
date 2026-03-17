#!/usr/bin/env python3
"""
generate-lp.py — Auto-generate landing page ebook dari data sheet/manual
Usage: python3 scripts/generate-lp.py --kode KKT-001
"""
import json, os, sys, re, argparse, subprocess, shutil

# ─── Config ───────────────────────────────────────────────────────────────────
EBOOK_DATA = {
    # Format: KODE -> dict
    # Tambahkan data ebook baru di sini, atau baca dari sheet
}

TEMPLATE_FILE = "lp-ebook-template.html"
OUTPUT_DIR = "ebooks"   # folder GitHub Pages: kedebuk.github.io/herbahero/ebooks/KKT-001/index.html
WA_NUMBER = "6285270404312"
PIXEL_ID = ""  # isi pixel ID Meta jika ada

# ─── Utils ────────────────────────────────────────────────────────────────────
def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s]+', '-', text.strip())
    return text[:60]

def make_config(kode, judul, tagline, price=97000, theme_color="#16a34a", hero_img="", benefits=None, testimonials=None, bonus=None):
    prod_name = judul.split(':')[0].strip() if ':' in judul else judul[:50]
    return {
        "title": f"{prod_name} — {tagline[:60] if tagline else 'Panduan Bisnis Lengkap'}",
        "pixelId": PIXEL_ID,
        "capiToken": "",
        "ogImage": hero_img or f"https://kedebuk.github.io/herbahero/ebooks/{kode}/cover.jpg",
        "ogDescription": tagline[:160] if tagline else judul[:160],
        "heroImage": hero_img or "./cover.jpg",
        "heroAlt": f"Cover Ebook {prod_name}",
        "subtitle": tagline[:120] if tagline else "Panduan lengkap step-by-step untuk pemula",
        "productName": prod_name,
        "productPrice": price,
        "productOriginalPrice": price * 2,
        "bonusItems": bonus or [
            "✅ Ebook Utama PDF (80+ halaman)",
            "✅ Bonus: Panduan Tambahan",
            "✅ Update Gratis Seumur Hidup",
            "✅ Support via WhatsApp"
        ],
        "benefits": benefits or [
            {"icon":"📖","title":"Panduan Lengkap","desc":"Step-by-step dari nol sampai profit, cocok untuk pemula"},
            {"icon":"💰","title":"Modal Kecil","desc":"Bisa mulai dari modal yang sangat terjangkau"},
            {"icon":"🏠","title":"Dari Rumah","desc":"Tidak perlu toko, tempat khusus, atau pengalaman sebelumnya"},
            {"icon":"🚀","title":"Cepat Balik Modal","desc":"Potensi BEP dalam 30-60 hari pertama"}
        ],
        "testimonials": testimonials or [
            {"text":"Ebook ini detail banget, langsung bisa dipraktekkan!","author":"Budi W. - Jakarta","stars":5},
            {"text":"Dalam 3 minggu sudah ada order pertama berkat panduan ini.","author":"Sari M. - Surabaya","stars":5},
            {"text":"Worth it, bonusnya juga sangat membantu.","author":"Dedi P. - Bandung","stars":5}
        ],
        "webhookUrl": "https://script.google.com/macros/s/XXXXX/exec",
        "waNumber": WA_NUMBER,
        "waMessageTemplate": "Halo, saya mau order ebook *{product}* atas nama {name}. No HP: {phone}",
        "themeColor": theme_color,
        "ctaText": f"DAPATKAN SEKARANG — Rp {price:,}".replace(',', '.'),
        "ctaSubtext": "Dikirim via WhatsApp dalam 5 menit ⚡",
        "urgencyText": "⚡ Harga promo terbatas!",
        "guaranteeText": "Tidak puas? Kami kembalikan uang 100% dalam 7 hari"
    }

def generate(kode, judul, tagline, **kwargs):
    # Baca template
    with open(TEMPLATE_FILE, 'r') as f:
        html = f.read()

    config = make_config(kode, judul, tagline, **kwargs)
    config_json = json.dumps(config, ensure_ascii=False, indent=2)

    # Inject config
    html = re.sub(
        r'const LP_CONFIG = \{.*?\};',
        f'const LP_CONFIG = {config_json};',
        html,
        flags=re.DOTALL
    )

    # Output
    out_dir = os.path.join(OUTPUT_DIR, kode)
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "index.html")
    with open(out_file, 'w') as f:
        f.write(html)

    print(f"✅ Generated: {out_file}")
    print(f"   URL: https://kedebuk.github.io/herbahero/ebooks/{kode}/")
    return out_file

# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate LP ebook')
    parser.add_argument('--kode', required=True, help='Kode ebook (e.g. KKT-001)')
    parser.add_argument('--judul', help='Judul lengkap ebook')
    parser.add_argument('--tagline', help='Tagline')
    parser.add_argument('--price', type=int, default=97000)
    parser.add_argument('--color', default='#16a34a', help='Hex theme color')
    parser.add_argument('--push', action='store_true', help='Auto git push setelah generate')
    args = parser.parse_args()

    kode = args.kode
    judul = args.judul or EBOOK_DATA.get(kode, {}).get('judul', kode)
    tagline = args.tagline or EBOOK_DATA.get(kode, {}).get('tagline', '')

    if not judul:
        print(f"❌ Judul tidak ditemukan untuk {kode}. Gunakan --judul")
        sys.exit(1)

    out = generate(kode, judul, tagline, price=args.price, theme_color=args.color)

    if args.push:
        print("📤 Pushing to GitHub...")
        subprocess.run(["git", "add", out], check=True)
        subprocess.run(["git", "commit", "-m", f"Add LP: {kode} — {judul[:50]}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print(f"🌐 Live: https://kedebuk.github.io/herbahero/ebooks/{kode}/")
