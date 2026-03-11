# Herbahero — Architecture Proposal
**Revisi: Multi-Slug LP Platform**

> Status: Draft — menunggu approval sebelum implementasi dimulai.

---

## Problem Statement (Koreksi Arah)

Arsitektur sebelumnya memperlakukan herbahero seperti _GitHub Pages static site builder_ — tiap LP di-deploy sebagai file `.html` ke repo. Ini **salah arah**.

**Yang dibutuhkan:**  
Platform terpusat (`herbahero.my.id`) yang:
- Melayani banyak LP melalui slug unik
- Support custom domain per slug
- Satu admin dashboard untuk manage semua slug

---

## Target Arsitektur

```
User → angetpol.com (CNAME → herbahero.my.id)
           │
           ▼
   Cloudflare Worker (edge router)
           │
   ┌───────┴───────┐
   │  Check host   │
   │  "angetpol.com"│
   │  → lookup KV  │
   └───────┬───────┘
           │ domain:angetpol.com = "angetpol"
           ▼
   KV: lp:angetpol:html  → serve HTML
   KV: lp:angetpol:cfg   → metadata

OR:

User → herbahero.my.id/angetpol
           │
           ▼
   Cloudflare Worker
           │
   slug = "angetpol"
           ▼
   KV: lp:angetpol:html  → serve HTML
```

---

## Komponen

### 1. Cloudflare Worker — Main Router
**File:** `worker/router.js`

Tanggung jawab:
- Handle semua request masuk ke `herbahero.my.id`
- Deteksi apakah request dari custom domain atau slug path
- Ambil LP content dari KV store
- Serve HTML response
- Route `/admin/*` ke admin SPA
- Route `/api/*` ke internal API endpoints

```javascript
// Routing logic pseudo-code
if (host !== "herbahero.my.id") {
  // Custom domain
  slug = await KV.get(`domain:${host}`)
} else {
  slug = url.pathname.slice(1).split("/")[0]  // /angetpol → "angetpol"
}

if (slug && slug !== "admin") {
  html = await KV.get(`lp:${slug}:html`)
  return new Response(html, { headers: { "Content-Type": "text/html" } })
}
```

### 2. Cloudflare KV — Data Store

| Key Pattern | Value | Keterangan |
|---|---|---|
| `lp:{slug}:html` | string (full HTML) | Konten LP |
| `lp:{slug}:cfg` | JSON | Metadata LP |
| `lp:{slug}:stats` | JSON | Stats ringan (views, ctaClicks) |
| `domain:{domain}` | string | Maps domain → slug |
| `slugs:index` | JSON array | List semua slug aktif |
| `config:global` | JSON | Global business settings |

**LP Config JSON Schema:**
```json
{
  "slug": "angetpol",
  "title": "Anget Pol — Jamu Herbal",
  "status": "active",
  "customDomain": "angetpol.com",
  "createdAt": "2026-03-11T00:00:00Z",
  "updatedAt": "2026-03-11T00:00:00Z",
  "gasWebhookUrl": "https://script.google.com/...",
  "template": "herbal"
}
```

### 3. Admin Dashboard — Single Page App
**Path:** `/admin/` (served by Worker, static files di Cloudflare Pages atau KV)

Pages:
- `/admin/` — Dashboard utama (stats, recent orders)
- `/admin/slugs` — List & manage semua slug
- `/admin/slugs/new` — Buat LP baru (builder)
- `/admin/slugs/:slug/edit` — Edit LP
- `/admin/domains` — Custom domain management
- `/admin/settings` — Global settings (CF token, GAS URL, FB Pixel, dll)
- `/admin/analytics` — Analytics per slug
- `/admin/media` — Media library

Admin berkomunikasi langsung ke Cloudflare API untuk update KV.

### 4. Internal API via Worker
Worker expose endpoint `/api/*` untuk operasi yang butuh server-side:

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/slugs` | GET | List semua slug |
| `/api/slugs` | POST | Buat slug baru |
| `/api/slugs/:slug` | PUT | Update konten/config LP |
| `/api/slugs/:slug` | DELETE | Hapus LP |
| `/api/domains` | GET/POST/DELETE | CRUD custom domain mapping |
| `/api/stats/:slug` | GET | Stats untuk slug tertentu |

API dilindungi dengan `Authorization: Bearer <admin_token>` yang disimpan di Worker Secrets.

### 5. Google Apps Script (GAS) — Order Backend
Tetap dipakai untuk:
- Menerima order dari form LP
- Menyimpan ke Google Sheets
- Forward ke CAPI Facebook

GAS URL di-store per LP di KV config (bisa global atau per slug).

---

## Routing Flow Diagram

```
Request: angetpol.com/
  │
  ├─ Cloudflare DNS: angetpol.com CNAME → herbahero.my.id
  ├─ Cloudflare Proxy: SSL terminate, forward ke Worker
  │
  ▼
Worker: router.js
  │
  ├─ host = "angetpol.com" → bukan herbahero.my.id
  ├─ KV.get("domain:angetpol.com") → "angetpol"
  ├─ KV.get("lp:angetpol:cfg") → { status: "active", ... }
  ├─ KV.get("lp:angetpol:html") → "<html>...</html>"
  ├─ KV analytics increment: lp:angetpol:stats
  └─ Response: 200 text/html

Request: herbahero.my.id/produk-b
  │
  ▼
Worker: router.js
  │
  ├─ host = "herbahero.my.id"
  ├─ pathname = "/produk-b"
  ├─ slug = "produk-b"
  ├─ KV.get("lp:produk-b:html") → "<html>...</html>"
  └─ Response: 200 text/html

Request: herbahero.my.id/admin/
  │
  └─ Serve admin SPA (static dari KV atau Cloudflare Pages)
```

---

## Custom Domain Setup Flow (User Perspective)

1. User buat LP di admin dashboard, tentukan slug misal `angetpol`
2. User punya domain `angetpol.com`
3. Di admin → Domains → tambah: `angetpol.com` → slug `angetpol`
4. System simpan `domain:angetpol.com = "angetpol"` ke KV
5. Admin tampilkan instruksi DNS:
   ```
   Type: CNAME
   Name: @ (atau www)
   Value: herbahero.my.id
   Proxy: ON (Cloudflare proxy)
   ```
6. User set DNS di registrar mereka
7. Cloudflare otomatis issue SSL (karena domain masuk ke Cloudflare zone via proxy)
8. Done — `https://angetpol.com` serve LP

> **Catatan:** Domain harus di-proxy melalui Cloudflare (orange cloud). Domain yang tidak di Cloudflare bisa di-CNAME tapi SSL manual (perlu sertifikat terpisah atau Cloudflare for SaaS).

---

## Keputusan Storage: Kenapa KV, Bukan GitHub?

| Aspek | GitHub JSON | Cloudflare KV |
|---|---|---|
| Latency | Tinggi (API + Git) | Sangat rendah (edge) |
| Rate limit | 5000 req/jam | 100K+ req/hari (free) |
| Operasi | Async, butuh commit | Langsung put/get |
| Custom domain routing | Tidak bisa di-edge | Native di Worker |
| Biaya | Gratis | Free tier cukup |
| Realtime update | Tidak (butuh re-deploy) | Ya, instant |

**Kesimpulan: Cloudflare KV adalah pilihan tepat untuk platform ini.**

---

## Migrasi dari Arsitektur Lama

LP yang sudah ada di GitHub (sebagai `.html` files) bisa dimigrate:
1. Script fetch semua file dari GitHub repo
2. Parse slug dari nama file
3. Push HTML ke KV `lp:{slug}:html`
4. Buat config JSON di KV `lp:{slug}:cfg`
5. Update `slugs:index`
6. Optional: redirect GitHub Pages ke platform baru

---

## Security

- Admin API dilindungi Bearer token (Worker Secret)
- Token disimpan di `localStorage` di browser admin (acceptable untuk single-user)
- LP content di KV tidak memerlukan auth (public read)
- CORS hanya untuk `/api/*` endpoints
- Rate limiting bisa ditambahkan via Cloudflare Rate Limiting rules

---

## Implementation Roadmap (Urutan Prioritas)

### Phase 1: Core Infrastructure
- [ ] Setup Cloudflare Worker + KV namespace
- [ ] Implement router.js dengan slug routing + custom domain routing
- [ ] API endpoints CRUD untuk slugs
- [ ] Test end-to-end: buat slug → akses via URL

### Phase 2: Admin Dashboard
- [ ] Slug list page (dengan status, custom domain, stats)
- [ ] LP Builder terintegrasi (save ke KV bukan GitHub)
- [ ] Custom domain management UI + DNS instructions
- [ ] Settings (admin token, GAS URL, FB Pixel global)

### Phase 3: Migration & Analytics
- [ ] Migration tool dari GitHub Pages ke KV
- [ ] Analytics per slug (pageview, CTA click, conversion)
- [ ] Media library (tetap bisa di GitHub atau Cloudflare R2)

### Phase 4: Nice to Have
- [ ] Cloudflare for SaaS (untuk domain yang tidak di Cloudflare)
- [ ] A/B testing per slug
- [ ] Multi-user admin access

---

## Open Questions untuk Roni

1. **CF Account**: Apakah Roni punya Cloudflare account dengan herbahero.my.id sudah masuk zone? KV Workers perlu di-setup di sana.
2. **Builder**: Builder tetap mau dipakai (visual drag-drop) atau cukup raw HTML editor? Ini pengaruhi kompleksitas Phase 2.
3. **Media**: Tetap di GitHub repo atau pindah ke Cloudflare R2 (lebih proper)?
4. **GAS**: Satu GAS webhook global atau masing-masing LP bisa punya webhook berbeda?

---

*Document ini adalah proposal awal. Mulai coding setelah Roni confirm.*
