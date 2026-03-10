# Herbahero — LP Management System

Platform LP Management untuk COD e-commerce Indonesia + Meta Ads. Buat, kelola, dan monitor landing page produk dari satu tempat.

**Live Demo:** [herbahero.my.id](https://herbahero.my.id)

## Features

- **LP Builder** — Buat landing page baru dengan upload foto, konfigurasi harga, benefit, testimonial, dan ongkir
- **LP Manager** — Kelola semua LP: edit, preview, hapus, copy URL
- **Order Dashboard** — Monitor order real-time, filter by status/tanggal, export CSV, detail modal
- **Meta Pixel + CAPI** — Tracking otomatis: PageView, ViewContent, InitiateCheckout, Lead, Purchase + server-side CAPI via GAS
- **UTM Tracking** — Capture utm_source, utm_medium, utm_campaign dari URL dan simpan ke order
- **Multi-step Order Form** — Form 3 langkah: Data Diri → Pengiriman → Konfirmasi
- **Ongkir Integration** — RajaOngkir API atau fallback rate manual per wilayah
- **Sticky CTA Mobile** — Tombol order mengambang yang selalu terlihat di mobile
- **Countdown Timer** — Timer penawaran terbatas untuk meningkatkan urgency
- **Stok Counter** — Tampilkan sisa stok untuk scarcity
- **WhatsApp Follow-up** — Link WA otomatis setelah order berhasil
- **Cloudflare Custom Domain** — Integrasi custom domain per LP via Cloudflare Workers

## Quick Start

### 1. Setup GitHub Token

Buka **Settings** → Masukkan GitHub Personal Access Token (repo scope).

### 2. Setup Google Apps Script (GAS) Backend

1. Buat Google Spreadsheet baru
2. Buka Extensions → Apps Script
3. Copy-paste isi file `gas/Code.gs`
4. Deploy → New Deployment → Web App → Execute as Me, Anyone can access
5. Copy URL webhook, paste di Settings

### 3. Setup Meta Pixel & CAPI

1. Buka [Facebook Events Manager](https://business.facebook.com/events_manager)
2. Buat atau pilih Pixel ID
3. Generate Conversions API Token
4. Masukkan di Settings atau langsung di LP Builder

### 4. Buat LP Pertama

Buka **LP Builder** → Isi nama, slug, upload foto → Publish ke website.

### 5. Go Live!

Pasang URL LP di Meta Ads → Monitor order di Dashboard → Scale!

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend / Hosting | GitHub Pages (static HTML/CSS/JS) |
| Backend / Database | Google Apps Script + Google Sheets |
| Tracking (client) | Meta Pixel (fbevents.js) |
| Tracking (server) | Facebook Conversions API via GAS |
| Order Follow-up | WhatsApp API link |
| Custom Domain | Cloudflare Workers (opsional) |
| Ongkir | RajaOngkir API / Fallback rates |

## File Structure

```
herbahero/
├── index.html              # Hub page — dashboard utama
├── lp-template.html        # Template LP kosong (untuk builder)
├── lp-example.html         # Contoh LP (AngetPol)
├── assets/
│   ├── style.css           # Shared CSS styles
│   └── images/             # Folder gambar produk
├── admin/
│   ├── index.html          # Order Management Dashboard
│   ├── pages.html          # LP Manager
│   └── settings.html       # Settings (GitHub, Pixel, CAPI, GAS)
├── builder/
│   └── index.html          # LP Builder
├── gas/
│   └── Code.gs             # Google Apps Script backend
├── _lps/                   # LP config files (JSON, auto-generated)
└── README.md
```

## GAS Setup Guide

### Spreadsheet Headers (auto-created)

```
ID | Timestamp | Nama | WA | Alamat | Kecamatan | Kota | Provinsi | Wilayah | Produk | Qty | Ongkir | Total | MetodeBayar | Catatan | Upsell | LPSource | Status | UTM_Source | UTM_Medium | UTM_Campaign | UTM_Content
```

### Endpoints

**POST** — Terima order baru
```
POST https://script.google.com/.../exec
Body: { nama, wa, alamat, produk, qty, ongkir, total, metodeBayar, utm_source, utm_medium, utm_campaign, utm_content, _capi: {...} }
```

**GET** — Ambil semua order
```
GET https://script.google.com/.../exec?action=get_orders
```

**GET** — Update status order
```
GET https://script.google.com/.../exec?action=update_status&id=ORD-XXX&status=Selesai
```

## Meta Pixel + CAPI Events

| Event | Trigger | Deduplicated |
|-------|---------|-------------|
| PageView | Halaman dimuat | Yes (eventID) |
| ViewContent | Halaman dimuat | Yes |
| InitiateCheckout | Step 2 (Pengiriman) | Yes |
| Lead | Step 3 (Konfirmasi) | Yes |
| Purchase | Form submit berhasil | Yes (client + server) |

## LP_CONFIG Reference

```js
const LP_CONFIG = {
  title: "Judul Hero",
  pixelId: "FB_PIXEL_ID",
  capiToken: "",                    // Facebook CAPI Token
  capiTestCode: "",                 // CAPI Test Event Code
  heroImage: "assets/images/foto.jpg",
  heroSubtitle: "Subtitle",
  productName: "Nama Produk",
  productPrice: 99000,
  productOptions: ["Paket 1 — Rp 99.000"],
  benefits: [{icon:"✅", title:"...", desc:"..."}],
  testimonials: [{text:"...", author:"...", stars:5}],
  webhookUrl: "https://script.google.com/.../exec",
  waNumber: "628xxx",
  waMessageTemplate: "Halo, saya ingin order {product} atas nama {name}",
  themeColor: "#2563eb",
  scrollToCta: true,                // Sticky CTA button di mobile
  countdownEnabled: false,          // Timer countdown
  countdownMinutes: 30,
  stockEnabled: false,              // Stock counter
  stockCount: 47,
  shipping: {
    provider: "rajaongkir",
    apiKey: "YOUR_API_KEY",
    originCityId: "501",
    couriers: ["jne","jnt"],
    weightGram: 500,
    fallbackRates: [
      {wilayah:"Jabodetabek", ongkir:15000, estimasi:"1-2 hari"}
    ],
    freeThreshold: 0
  }
};
```

## Admin Dashboard

- Login dengan password (default: `admin123` — **GANTI!**)
- Statistik: Total, Pending, Diproses, Selesai, Total Revenue
- Order detail modal — klik baris untuk lihat detail lengkap
- Date range filter — filter order berdasarkan tanggal
- Update status order: Pending → Diproses → Dikirim → Selesai
- Toast notification saat status berhasil diupdate
- Search by nama/WA/produk
- Filter by status
- Export CSV (termasuk UTM data)
- Keyboard shortcut: Escape untuk tutup modal

## License

MIT License — free to use, modify, and distribute.
