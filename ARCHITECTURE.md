# Herbahero — Architecture (Revised v2)
**Revisi: JPG-based LP Platform with Overlay Order Form**

> Status: Draft v2 — menunggu konfirmasi open questions sebelum coding

---

## Konsep Inti

**Bukan** visual HTML builder. **Bukan** template system.

Platform ini bekerja seperti ini:
1. Admin upload **file JPG** sebagai konten LP (desain sudah jadi, dibuat di Canva/Figma/dll)
2. Platform serve JPG tersebut sebagai halaman LP
3. **Form order** di-overlay di atas JPG — isi nama, HP, alamat, pilih produk
4. Form otomatis kalkulasi ongkir via RajaOngkir Komerce API
5. Order masuk ke Google Sheets via GAS webhook

---

## User Flow (End-to-end)

```
[Admin]
  Upload JPG ke admin dashboard
  Set config per slug: nama produk, harga paket, payment method
  (Global settings: gudang asal, RajaOngkir key, GAS webhook URL)
       ↓
[Platform]
  Simpan JPG ke storage (Cloudflare R2)
  Simpan config ke Cloudflare KV
       ↓
[Customer visit: herbahero.my.id/angetpol atau angetpol.com]
  Halaman tampil: JPG sebagai background/hero image
  Form order floating/overlay di bawah atau samping JPG
  Customer isi:
    - Nama lengkap
    - Nomor HP
    - Alamat lengkap
    - Kecamatan/kota tujuan
    - Pilih paket produk
  Sistem kalkulasi ongkir otomatis (RajaOngkir Komerce API)
  Customer konfirmasi → submit order
       ↓
[GAS / Backend]
  Order masuk ke Google Sheets
  FB Pixel + CAPI event fired (Purchase/Lead)
  [TBD] Payment: gateway atau instruksi manual transfer
```

---

## Komponen

### 1. Cloudflare Worker — Router
**File:** `worker/router.js`

Sama dengan proposal sebelumnya:
- Route `herbahero.my.id/:slug` → serve LP page
- Route custom domain → lookup slug di KV → serve LP page
- Route `/admin/*` → serve admin SPA
- Route `/api/*` → internal CRUD API

LP page yang di-serve adalah **HTML shell sederhana** yang:
- Load JPG dari R2 sebagai hero image
- Render form order di atasnya (JS-driven)
- Handle ongkir calculation client-side (call ke GAS atau direct ke RajaOngkir)

### 2. Storage

#### Cloudflare R2 — JPG Files
```
r2://herbahero-media/
  lp/angetpol.jpg
  lp/produk-b.jpg
  lp/jamu-tetes.jpg
```

Public URL: `https://media.herbahero.my.id/lp/{slug}.jpg`

#### Cloudflare KV — Config & Routing

| Key | Value | Keterangan |
|---|---|---|
| `lp:{slug}:cfg` | JSON | Config per LP |
| `domain:{domain}` | string | Custom domain → slug |
| `slugs:index` | JSON array | List semua slug |
| `config:global` | JSON | Global settings (gudang, API key, dll) |

#### LP Config JSON Schema

```json
{
  "slug": "angetpol",
  "productName": "Anget Pol Jamu Herbal",
  "status": "active",
  "customDomain": "angetpol.com",
  "jpgUrl": "https://media.herbahero.my.id/lp/angetpol.jpg",
  "packages": [
    { "label": "1 Botol", "qty": 1, "price": 85000 },
    { "label": "3 Botol HEMAT", "qty": 3, "price": 220000 }
  ],
  "payment": {
    "method": "manual",
    "bankName": "BCA",
    "accountNumber": "1234567890",
    "accountName": "PT Herbahero"
  },
  "gasWebhookUrl": "https://script.google.com/...",
  "fbPixelId": "123456789",
  "capiToken": "...",
  "waNumber": "6281234567890",
  "createdAt": "2026-03-11T00:00:00Z",
  "updatedAt": "2026-03-11T00:00:00Z"
}
```

> **Pixel inheritance rule:** `fbPixelId` dan `capiToken` di per-slug config bersifat **opsional**.
> Worker resolve pixel dengan urutan: `slug.fbPixelId` → `global.fbPixelId`.
> Kalau slug tidak set → pakai global default. Ini memungkinkan satu akun pixel untuk semua LP,
> atau override per-produk kalau ada BM/pixel terpisah.
```

#### Global Settings JSON Schema

```json
{
  "warehouseOrigin": {
    "city": "Jakarta Selatan",
    "cityId": "151",
    "province": "DKI Jakarta"
  },
  "rajaOngkirKey": "saFoHFPsoPBkJdQbZyDVOvAvVFKYYEpP",
  "rajaOngkirEndpoint": "https://rajaongkir.komerce.id",
  "gasWebhookUrl": "https://script.google.com/...",
  "analytics": {
    "fbPixelId": "9876543210",
    "capiToken": "EAAxxxxxxx"
  },
  "adminToken": "..."
}
```

> **Global analytics** adalah satu backend GAS + satu FB Pixel default yang dipakai semua LP.
> Per-slug bisa override `fbPixelId` / `capiToken` jika LP tersebut punya BM/pixel sendiri.
```

### 3. LP Page — HTML Shell

Bukan static HTML file. Worker generate HTML shell ini on-the-fly dari config:

```html
<!DOCTYPE html>
<html>
<head>
  <title>{productName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- FB Pixel snippet -->
</head>
<body>
  <!-- LP = JPG image -->
  <div id="lp-image">
    <img src="{jpgUrl}" alt="{productName}">
  </div>

  <!-- Order form overlay -->
  <div id="order-form">
    <h2>Pesan Sekarang</h2>
    <!-- Pilih paket -->
    <!-- Form fields: nama, HP, alamat, kecamatan -->
    <!-- Kalkulasi ongkir -->
    <!-- Total & submit -->
  </div>

  <!-- Config injected by Worker -->
  <script>
    window.LP_CONFIG = {slug};  // inject JSON config
  </script>
  <script src="/static/lp-form.js"></script>
</body>
</html>
```

### 4. Shipping Calculation — RajaOngkir Komerce

**Endpoint:** `https://rajaongkir.komerce.id`  
**Key:** `saFoHFPsoPBkJdQbZyDVOvAvVFKYYEpP`

Flow:
```
Customer ketik kecamatan tujuan
       ↓
Search endpoint: GET /starter/destination?search={query}
       ↓
Customer pilih kecamatan dari dropdown
       ↓
Cost endpoint: POST /starter/cost
  { origin: {warehouseOriginId}, destination: {destId}, weight: 1000 }
       ↓
Tampilkan opsi kurir + harga
Customer pilih kurir
       ↓
Total = harga produk + ongkir
```

> **Catatan:** Key `saFoHFPsoPBkJdQbZyDVOvAvVFKYYEpP` sebelumnya test 401.
> Perlu konfirmasi dari Roni apakah sudah aktif di dashboard RajaOngkir Komerce.
> Jika belum aktif, fallback ke static rates dulu.

### 5. Form Fields (TBD — menunggu konfirmasi Roni)

Kandidat fields:
- [ ] Nama lengkap *
- [ ] Nomor HP/WA *
- [ ] Alamat lengkap *
- [ ] Kecamatan/kota tujuan * (dengan search dropdown → RajaOngkir)
- [ ] Provinsi (auto-fill dari pilih kecamatan)
- [ ] Kode pos (auto-fill)
- [ ] Pilihan paket *
- [ ] Pilihan kurir * (setelah ongkir dihitung)
- [ ] Catatan (opsional)

*= wajib

### 6. Admin Dashboard — Simplified

Pages yang dibutuhkan:
- `/admin/` — List semua LP (slug, status, order count)
- `/admin/slugs/new` — Form buat LP baru: nama, upload JPG, set paket harga, payment
- `/admin/slugs/:slug/edit` — Edit config LP, ganti JPG
- `/admin/domains` — Custom domain management
- `/admin/settings` — Global: gudang asal, RajaOngkir key, GAS URL, FB Pixel
- `/admin/analytics` — Stats per slug (pageview, order, conversion)

**Jauh lebih sederhana dari proposal v1** — tidak ada builder, tidak ada template selector.

### 7. Google Apps Script (GAS) — Order Backend

Tetap sama:
- Terima POST dari form
- Simpan ke Google Sheets (1 sheet per slug atau semua di 1 sheet)
- Fire FB CAPI event

### 8. Analytics — Global Infrastructure, Per-LP Pixel

**Prinsip:**
- Satu GAS backend untuk semua LP (global analytics endpoint)
- FB Pixel: global default, bisa di-override per slug

**Pixel Resolution Logic (di Worker saat generate HTML shell):**
```javascript
const pixel = slug_cfg.fbPixelId || global_cfg.analytics.fbPixelId
const capi  = slug_cfg.capiToken  || global_cfg.analytics.capiToken
// Inject ke HTML shell
```

**Use cases:**
| Skenario | Config |
|---|---|
| Semua LP pakai 1 pixel | Isi global pixel, slug tidak perlu set |
| LP A pakai pixel BM sendiri | Set `fbPixelId` di slug A config, slug lain tetap global |
| Test event code per LP | Set `testEventCode` opsional di slug config |

**Per-slug analytics fields (semua opsional):**
```json
{
  "fbPixelId": "123456789",
  "capiToken": "EAAxxxxxxx",
  "testEventCode": "TEST12345"
}
```

**Admin dashboard `/admin/analytics`:**
- Stats per slug: pageview, CTA click, order, conversion rate
- Semua data masuk ke 1 GAS backend, difilter by `slug` parameter

---

## Routing Flow

```
herbahero.my.id/angetpol
       ↓
Worker: slug = "angetpol"
KV.get("lp:angetpol:cfg") → config JSON
KV.get("config:global") → global settings
       ↓
Worker generate HTML shell dengan config injected
       ↓
Browser load JPG dari R2
JS render form order
Customer isi form → kalkulasi ongkir → submit
```

---

## Apa yang TIDAK Dibangun

| Fitur | Status |
|---|---|
| Visual HTML builder | ❌ Tidak perlu |
| Template library | ❌ Tidak perlu |
| Media Library (full) | ❌ Diganti simple JPG upload per slug |
| Drag-drop LP editor | ❌ Tidak perlu |

---

## Open Questions untuk Roni

1. **Cloudflare zone** — herbahero.my.id sudah masuk zone CF dengan Worker plan? Ini blocker untuk deploy.

2. **Payment method** — otomatis via gateway (Midtrans/Xendit/dll) atau manual (instruksi transfer ke rekening)? Kalau gateway, integrasi payment link perlu ditambah.

3. **Form fields** — konfirmasi fields yang dibutuhkan (lihat kandidat di atas).

4. **RajaOngkir key** — apakah `saFoHFPsoPBkJdQbZyDVOvAvVFKYYEpP` sudah aktif di dashboard komerce.id? Test sebelumnya 401.

5. **GAS** — satu webhook URL global untuk semua LP, atau masing-masing LP bisa override?

---

## Changelog

| Tanggal | Versi | Perubahan |
|---|---|---|
| 2026-03-11 | v1 | Initial proposal (CF Worker + KV, visual builder) |
| 2026-03-11 | v1.1 | Visual builder confirmed (Opsi A) |
| 2026-03-11 | v2 | **MAJOR REVISION** — JPG upload + overlay form, tidak ada HTML builder |

---

*Mulai coding Phase 1 setelah open questions 1–3 dijawab.*
