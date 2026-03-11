/**
 * lp-shell.js — LP HTML Shell Generator
 * Generates complete LP page HTML from slug config + global config.
 */

export function generateLPShell(slugCfg, globalCfg = {}) {
  const {
    slug = '',
    productName = 'Produk Kami',
    jpgUrl = '',
    packages = [],
    payment = {},
    gasWebhookUrl = '',
    waNumber = '',
    analytics = {},
    warehouseOrigin = null,
  } = slugCfg;

  const pixelId = analytics?.fbPixelId || globalCfg?.analytics?.fbPixelId || '';
  const warehouseOriginId = (warehouseOrigin || globalCfg?.warehouseOrigin)?.cityId || '';

  const pixelSnippet = pixelId ? `
  <!-- Facebook Pixel -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>
  ` : '';

  const packagesJson = JSON.stringify(packages);
  const paymentJson = JSON.stringify(payment);

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${escHtml(productName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${pixelSnippet}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#f5f5f5;color:#1a1a1a;-webkit-font-smoothing:antialiased}
    .hero-img{width:100%;display:block;max-width:480px;margin:0 auto}
    .hero-placeholder{width:100%;max-width:480px;margin:0 auto;height:300px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:600}
    .container{max-width:480px;margin:0 auto;padding:16px}
    .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .card-title{font-size:1rem;font-weight:700;margin-bottom:14px;color:#111}
    .pkg-grid{display:flex;flex-direction:column;gap:10px}
    .pkg-item{border:2px solid #e5e7eb;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:12px}
    .pkg-item:hover{border-color:#6366f1}
    .pkg-item.selected{border-color:#6366f1;background:#eef2ff}
    .pkg-item input[type=radio]{accent-color:#6366f1;width:18px;height:18px;flex-shrink:0}
    .pkg-label{flex:1}
    .pkg-name{font-weight:600;font-size:.95rem}
    .pkg-qty{font-size:.8rem;color:#6b7280;margin-top:2px}
    .pkg-price{font-weight:700;color:#6366f1;white-space:nowrap}
    .form-group{margin-bottom:14px}
    .form-label{display:block;font-size:.85rem;font-weight:600;margin-bottom:6px;color:#374151}
    .form-input{width:100%;border:1.5px solid #d1d5db;border-radius:10px;padding:11px 14px;font-size:.95rem;font-family:inherit;transition:border-color .2s;outline:none;background:#fff}
    .form-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
    .form-input::placeholder{color:#9ca3af}
    textarea.form-input{resize:vertical;min-height:80px}
    .search-wrap{position:relative}
    .dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #d1d5db;border-top:none;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;z-index:100;display:none}
    .dropdown.open{display:block}
    .dropdown-item{padding:10px 14px;cursor:pointer;font-size:.9rem;border-bottom:1px solid #f3f4f6}
    .dropdown-item:last-child{border-bottom:none}
    .dropdown-item:hover{background:#f9fafb}
    .shipping-opts{display:flex;flex-direction:column;gap:8px;margin-top:10px}
    .shipping-item{border:2px solid #e5e7eb;border-radius:10px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all .2s}
    .shipping-item:hover{border-color:#6366f1}
    .shipping-item.selected{border-color:#6366f1;background:#eef2ff}
    .shipping-item input[type=radio]{accent-color:#6366f1;width:16px;height:16px;flex-shrink:0}
    .shipping-label{flex:1;font-size:.9rem;font-weight:500}
    .shipping-price{font-weight:700;color:#6366f1;font-size:.9rem}
    .total-box{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:14px;padding:16px 20px;text-align:center;margin-bottom:16px}
    .total-label{font-size:.85rem;opacity:.85;margin-bottom:4px}
    .total-amount{font-size:1.6rem;font-weight:800}
    .btn-order{width:100%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;padding:16px;font-size:1.05rem;font-weight:700;cursor:pointer;transition:opacity .2s;font-family:inherit}
    .btn-order:hover{opacity:.9}
    .btn-order:disabled{opacity:.5;cursor:not-allowed}
    .loading{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .success-card{background:#fff;border-radius:16px;padding:28px 20px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.1)}
    .success-icon{font-size:3rem;margin-bottom:12px}
    .success-title{font-size:1.2rem;font-weight:700;color:#111;margin-bottom:8px}
    .success-msg{font-size:.9rem;color:#6b7280;line-height:1.5;margin-bottom:20px}
    .payment-detail{background:#f9fafb;border-radius:12px;padding:16px;text-align:left;margin-bottom:16px}
    .payment-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb}
    .payment-row:last-child{border-bottom:none;font-weight:700;font-size:1.05rem}
    .payment-key{font-size:.85rem;color:#6b7280}
    .payment-val{font-size:.9rem;font-weight:600;color:#111}
    .btn-wa{display:block;width:100%;background:#25d366;color:#fff;border:none;border-radius:12px;padding:14px;font-size:.95rem;font-weight:700;cursor:pointer;text-decoration:none;text-align:center;font-family:inherit}
    .spinner-wrap{text-align:center;padding:12px;color:#9ca3af;font-size:.85rem}
    .alert{padding:10px 14px;border-radius:8px;font-size:.85rem;margin-top:8px}
    .alert-info{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
    #success-section{display:none}
    #form-section{}
  </style>
</head>
<body>

<!-- Hero Image -->
${jpgUrl
  ? `<img class="hero-img" src="${escHtml(jpgUrl)}" alt="${escHtml(productName)}" loading="eager">`
  : `<div class="hero-placeholder">${escHtml(productName)}</div>`
}

<div class="container">

  <!-- Paket Selector -->
  <div class="card" id="form-section">
    <div class="card-title">📦 Pilih Paket</div>
    <div class="pkg-grid" id="pkg-grid">
      ${packages.map((p, i) => `
      <label class="pkg-item${i === 0 ? ' selected' : ''}" onclick="selectPkg(${i})">
        <input type="radio" name="paket" value="${i}" ${i === 0 ? 'checked' : ''}>
        <div class="pkg-label">
          <div class="pkg-name">${escHtml(p.label)}</div>
          <div class="pkg-qty">${p.qty} pcs</div>
        </div>
        <div class="pkg-price">${formatRp(p.price)}</div>
      </label>`).join('')}
    </div>
  </div>

  <!-- Order Form -->
  <div class="card" id="form-section">
    <div class="card-title">📝 Data Pemesanan</div>

    <div class="form-group">
      <label class="form-label">Nama Lengkap *</label>
      <input class="form-input" id="f-nama" type="text" placeholder="Masukkan nama lengkap" required onfocus="trackInit()">
    </div>

    <div class="form-group">
      <label class="form-label">Nomor HP / WhatsApp *</label>
      <input class="form-input" id="f-hp" type="tel" placeholder="Contoh: 08123456789" required>
    </div>

    <div class="form-group">
      <label class="form-label">Alamat Lengkap *</label>
      <textarea class="form-input" id="f-alamat" placeholder="Nama jalan, nomor rumah, RT/RW" required></textarea>
    </div>

    <div class="form-group">
      <label class="form-label">Kecamatan / Kota *</label>
      <div class="search-wrap">
        <input class="form-input" id="f-kecamatan" type="text" placeholder="Ketik nama kecamatan..." autocomplete="off" required>
        <div class="dropdown" id="kec-dropdown"></div>
      </div>
      <input type="hidden" id="f-kecamatan-id">
      <input type="hidden" id="f-kecamatan-label">
    </div>

    <div id="shipping-section" style="display:none">
      <div class="form-group">
        <label class="form-label">Pilih Kurir *</label>
        <div class="shipping-opts" id="shipping-opts"></div>
      </div>
    </div>

    <div class="total-box" id="total-box">
      <div class="total-label">Total Pembayaran</div>
      <div class="total-amount" id="total-amount">Rp 0</div>
    </div>

    <button class="btn-order" id="btn-submit" onclick="submitOrder()" disabled>
      Pilih kecamatan & kurir dulu
    </button>
  </div>

  <!-- Success Section -->
  <div id="success-section">
    <div class="success-card">
      <div class="success-icon">✅</div>
      <div class="success-title" id="success-title">Pesanan Diterima!</div>
      <div class="success-msg" id="success-msg"></div>
      <div class="payment-detail" id="payment-detail"></div>
      <a class="btn-wa" id="btn-wa" href="#" target="_blank">💬 Konfirmasi via WhatsApp</a>
    </div>
  </div>

</div>

<script>
  // Injected config
  window.LP_CONFIG = ${JSON.stringify(slugCfg)};
  window.GLOBAL_CFG = ${JSON.stringify({ warehouseOrigin: globalCfg.warehouseOrigin })};
  const PACKAGES = ${packagesJson};
  const PAYMENT = ${paymentJson};
  const GAS_URL = ${JSON.stringify(gasWebhookUrl)};
  const WA_NUMBER = ${JSON.stringify(waNumber)};
  const WAREHOUSE_ID = ${JSON.stringify(warehouseOriginId)};
  const SLUG = ${JSON.stringify(slug)};

  // State
  let selPkgIdx = 0;
  let selOngkir = 0;
  let selKurir = '';
  let destId = '';
  let destLabel = '';
  let pixelInitialized = false;
  let trackInitFired = false;

  // Format currency
  function rp(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }

  // Package selection
  function selectPkg(idx) {
    selPkgIdx = idx;
    document.querySelectorAll('.pkg-item').forEach((el, i) => {
      el.classList.toggle('selected', i === idx);
    });
    updateTotal();
  }

  function updateTotal() {
    const pkg = PACKAGES[selPkgIdx] || {};
    const total = (pkg.price || 0) + selOngkir;
    document.getElementById('total-amount').textContent = rp(total);
    const ready = destId && selOngkir >= 0 && selKurir;
    const btn = document.getElementById('btn-submit');
    btn.disabled = !ready;
    btn.textContent = ready ? 'Pesan Sekarang →' : 'Pilih kecamatan & kurir dulu';
  }

  // FB Pixel tracking
  function trackInit() {
    if (trackInitFired || typeof fbq === 'undefined') return;
    trackInitFired = true;
    fbq('track', 'InitiateCheckout');
  }

  // Kecamatan search
  let kecTimer = null;
  document.getElementById('f-kecamatan').addEventListener('input', function() {
    const q = this.value.trim();
    clearTimeout(kecTimer);
    if (q.length < 3) { closeDropdown(); return; }
    kecTimer = setTimeout(() => searchKecamatan(q), 400);
  });

  document.getElementById('f-kecamatan').addEventListener('blur', function() {
    setTimeout(closeDropdown, 200);
  });

  function closeDropdown() {
    document.getElementById('kec-dropdown').classList.remove('open');
  }

  async function searchKecamatan(q) {
    const dd = document.getElementById('kec-dropdown');
    dd.innerHTML = '<div class="spinner-wrap">Mencari...</div>';
    dd.classList.add('open');
    try {
      const r = await fetch('/api/shipping/search?search=' + encodeURIComponent(q));
      const j = await r.json();
      const items = j.data || [];
      if (!items.length) { dd.innerHTML = '<div class="spinner-wrap">Tidak ditemukan</div>'; return; }
      dd.innerHTML = items.slice(0, 10).map(it =>
        '<div class="dropdown-item" data-id="' + it.id + '" data-label="' + escAttr(it.label||it.name||'') + '">' + (it.label||it.name||it.subdistrict_name||'') + '</div>'
      ).join('');
      dd.querySelectorAll('.dropdown-item').forEach(el => {
        el.addEventListener('click', function() {
          pickKecamatan(this.dataset.id, this.dataset.label);
        });
      });
    } catch(e) {
      dd.innerHTML = '<div class="spinner-wrap">Error, coba lagi</div>';
    }
  }

  async function pickKecamatan(id, label) {
    destId = id;
    destLabel = label;
    document.getElementById('f-kecamatan').value = label;
    document.getElementById('f-kecamatan-id').value = id;
    document.getElementById('f-kecamatan-label').value = label;
    closeDropdown();
    await loadShipping(id);
  }

  function escAttr(s) { return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  async function loadShipping(destId) {
    const sec = document.getElementById('shipping-section');
    const opts = document.getElementById('shipping-opts');
    sec.style.display = 'block';
    opts.innerHTML = '<div class="spinner-wrap">Menghitung ongkos kirim...</div>';
    selOngkir = 0; selKurir = ''; updateTotal();

    const FALLBACK = [
      {courier:'JNE', service:'Reguler', cost:15000},
      {courier:'JNT', service:'Express', cost:12000},
      {courier:'Sicepat', service:'Reguler', cost:13000},
    ];

    let items = [];
    try {
      const r = await fetch('/api/shipping/cost', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({origin: WAREHOUSE_ID, destId, weight:1000})
      });
      const j = await r.json();
      items = j.data || [];
    } catch(e) {}

    if (!items.length) items = FALLBACK;
    renderShipping(items);
  }

  function renderShipping(items) {
    const opts = document.getElementById('shipping-opts');
    opts.innerHTML = items.map((it, i) => {
      const cost = it.cost || it.costs?.[0]?.cost?.[0]?.value || 0;
      const label = (it.courier || it.name || '') + ' ' + (it.service || '');
      return '<label class="shipping-item" onclick="selectShipping(' + cost + ',\'' + escAttr(label.trim()) + '\')">' +
        '<input type="radio" name="kurir" value="' + i + '">' +
        '<span class="shipping-label">' + label.trim() + '</span>' +
        '<span class="shipping-price">' + rp(cost) + '</span>' +
        '</label>';
    }).join('');
  }

  function selectShipping(cost, label) {
    selOngkir = cost;
    selKurir = label;
    document.querySelectorAll('.shipping-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    updateTotal();
  }

  async function submitOrder() {
    const btn = document.getElementById('btn-submit');
    const nama = document.getElementById('f-nama').value.trim();
    const hp = document.getElementById('f-hp').value.trim();
    const alamat = document.getElementById('f-alamat').value.trim();
    if (!nama || !hp || !alamat || !destId || !selKurir) {
      alert('Lengkapi semua data ya!'); return;
    }
    const pkg = PACKAGES[selPkgIdx] || {};
    const total = (pkg.price || 0) + selOngkir;

    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Memproses...';

    const payload = {
      slug: SLUG, nama, hp, alamat,
      kecamatan: destLabel, kecamatanId: destId,
      paket_label: pkg.label, paket_qty: pkg.qty,
      harga_produk: pkg.price, kurir: selKurir,
      ongkir: selOngkir, total,
      payment_method: PAYMENT.method || 'cod',
      timestamp: new Date().toISOString()
    };

    try {
      if (GAS_URL) {
        await fetch(GAS_URL, {method:'POST', body: JSON.stringify(payload),
          headers:{'Content-Type':'application/json'}});
      }
      showSuccess(payload, total);
      if (typeof fbq !== 'undefined') fbq('track', 'Lead', {value: total, currency:'IDR'});
    } catch(e) {
      showSuccess(payload, total); // show anyway — don't block customer
    }
  }

  function showSuccess(p, total) {
    document.getElementById('form-section') && (document.querySelectorAll('#form-section').forEach(el => el.style.display='none'));
    document.getElementById('success-section').style.display = 'block';
    document.getElementById('success-title').textContent = 'Pesanan Diterima! 🎉';

    let detailHtml = '';
    let msgHtml = '';

    if (PAYMENT.method === 'bank_transfer') {
      msgHtml = 'Silakan transfer pembayaran ke rekening di bawah ini.';
      detailHtml = rows([
        ['Bank', PAYMENT.bankName],
        ['No. Rekening', PAYMENT.accountNumber],
        ['Atas Nama', PAYMENT.accountName],
        ['Nominal', rp(total)],
      ]);
    } else {
      msgHtml = 'Pesananmu sudah kami catat. Kurir akan datang ke alamatmu, bayar saat barang tiba.';
      detailHtml = rows([
        ['Produk', p.paket_label],
        ['Ongkir', rp(p.ongkir)],
        ['Total', rp(total)],
      ]);
    }

    document.getElementById('success-msg').textContent = msgHtml;
    document.getElementById('payment-detail').innerHTML = detailHtml;

    const waText = encodeURIComponent(
      'Halo, saya sudah pesan ' + p.paket_label + ' (total ' + rp(total) + ')\\n' +
      'Nama: ' + p.nama + '\\nHP: ' + p.hp + '\\nAlamat: ' + p.alamat + ', ' + p.kecamatan
    );
    document.getElementById('btn-wa').href = 'https://wa.me/' + WA_NUMBER + '?text=' + waText;
    window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
  }

  function rows(pairs) {
    return pairs.map(([k,v]) =>
      '<div class="payment-row"><span class="payment-key">' + k + '</span><span class="payment-val">' + v + '</span></div>'
    ).join('');
  }

  // Init
  updateTotal();
</script>
</body>
</html>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRp(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
