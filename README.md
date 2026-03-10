# LP Website — Landing Page Builder & Order Management

Multi-landing-page website dengan builder visual, order form multi-step, dan dashboard CS.

## 🚀 Quick Start

### 1. Deploy ke GitHub Pages
```bash
# Fork / clone repo ini
git clone https://github.com/YOUR_USERNAME/lp-website.git
cd lp-website

# Push ke GitHub
git add . && git commit -m "initial" && git push

# Settings → Pages → Source: main branch / root → Save
# Situs live di: https://YOUR_USERNAME.github.io/lp-website/
```

### 2. Setup Google Apps Script (Backend Order)
1. Buka [Google Sheets](https://sheets.google.com), buat spreadsheet baru
2. Buka **Extensions → Apps Script**
3. Hapus kode default, paste isi file `gas/Code.gs`
4. Klik **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy URL deployment (format: `https://script.google.com/macros/s/xxx/exec`)

### 3. Konfigurasi LP

#### Cara A: Pakai Builder (Recommended)
1. Buka `builder/index.html` (atau `https://YOUR_SITE/builder/`)
2. Isi semua field: nama produk, harga, paket, benefits, testimoni
3. Upload foto hero (drag & drop)
4. Paste URL webhook GAS
5. Atur ongkir (custom table atau RajaOngkir API)
6. Klik **"Generate & Download"**
7. Upload file HTML yang di-download ke root repo → push ke GitHub

#### Cara B: Edit Manual
1. Duplikat `lp-template.html` → rename (misal `produk-baru.html`)
2. Edit `LP_CONFIG` di bagian atas file
3. Ganti `webhookUrl` dengan URL GAS
4. Upload foto hero ke `assets/images/`
5. Push ke GitHub

### 4. Setup Admin Dashboard
1. Buka `admin/index.html`
2. Edit `ADMIN_CONFIG.webhookUrl` → paste URL GAS yang sama
3. Edit `ADMIN_CONFIG.password` → ganti password default
4. Login ke dashboard untuk kelola order

## 📁 Struktur File

```
lp-website/
├── index.html              → Halaman utama (hub semua LP)
├── lp-template.html        → Template LP kosong (duplikat untuk LP baru)
├── lp-example.html         → Contoh LP (AngetPol)
├── admin/
│   └── index.html          → CS Dashboard (login + order management)
├── builder/
│   └── index.html          → LP Builder visual (generate HTML)
├── assets/
│   ├── style.css           → Shared CSS
│   └── images/             → Foto produk
├── gas/
│   └── Code.gs             → Google Apps Script (copy ke GAS)
└── README.md
```

## 📦 LP_CONFIG Reference

```js
const LP_CONFIG = {
  title: "Judul Hero",
  pixelId: "FB_PIXEL_ID",
  heroImage: "assets/images/foto.jpg",  // atau base64
  heroAlt: "Alt text",
  heroSubtitle: "Subtitle",
  productName: "Nama Produk",
  productPrice: 99000,
  productOptions: ["Paket 1", "Paket 2"],
  benefits: [{icon:"✅", title:"...", desc:"..."}],
  testimonials: [{text:"...", author:"...", stars:5}],
  webhookUrl: "https://script.google.com/macros/s/.../exec",
  waNumber: "628xxx",
  waMessageTemplate: "Halo, saya ingin order {product} atas nama {name}",
  themeColor: "#2563eb",
  shipping: {
    provider: "rajaongkir",       // "rajaongkir" atau "custom_table"
    apiKey: "YOUR_API_KEY",        // RajaOngkir API key
    originCityId: "501",           // ID kota asal
    couriers: ["jne","jnt"],       // Kurir yang ditampilkan
    weightGram: 500,               // Berat default
    fallbackRates: [               // Tabel ongkir manual / fallback
      {wilayah:"Jabodetabek", ongkir:15000, estimasi:"1-2 hari"},
      // ...
    ],
    freeThreshold: 0               // Gratis ongkir jika subtotal >= nilai ini
  }
};
```

## 🚚 Sistem Ongkir

### Mode 1: RajaOngkir (API)
- Set `shipping.provider: "rajaongkir"` dan isi `apiKey`
- User ketik kota → autocomplete dari API → pilih kurir → cek ongkir realtime
- Kalau API gagal → otomatis fallback ke tabel manual

### Mode 2: Tabel Custom (tanpa API)
- Set `shipping.provider: "custom_table"` atau biarkan apiKey default
- User pilih wilayah dari dropdown → ongkir dari tabel `fallbackRates`
- Tidak perlu API key, semua client-side

### Gratis Ongkir
- Set `shipping.freeThreshold: 250000` → gratis ongkir untuk order ≥ Rp 250.000

## 📊 Admin Dashboard

- Login dengan password (default: `admin123` — **GANTI!**)
- Statistik: Total, Pending, Diproses, Selesai
- Update status order: Pending → Diproses → Dikirim → Selesai
- Search by nama/WA/produk
- Filter by status
- Export CSV
- Link langsung ke WhatsApp customer

## 🛠️ Builder

- Visual editor dengan live preview
- Upload foto hero (encode base64 → self-contained)
- Edit semua field LP_CONFIG via form
- Edit tabel ongkir custom
- Konfigurasi RajaOngkir
- Draft auto-save ke localStorage
- Generate & download HTML siap deploy
- Copy HTML ke clipboard

## 📝 Form Order (Multi-Step)

**Step 1 — Data Diri:**
Nama, WhatsApp (validasi 08xx), Alamat, Kecamatan, Provinsi, Catatan

**Step 2 — Pengiriman & Produk:**
Pilih produk/paket, Qty, Wilayah/kota tujuan, Ongkir (auto-calculate), Total, Metode bayar

**Step 3 — Konfirmasi:**
Review ringkasan order → Submit

## ⚡ Tech Stack

- **Zero dependencies** — pure HTML/CSS/JS
- **GitHub Pages** compatible
- **Google Sheets** sebagai database (via Apps Script)
- **Facebook Pixel** tracking built-in
- **RajaOngkir API** integration (optional)
- **Mobile-first** responsive design
