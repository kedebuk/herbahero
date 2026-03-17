/**
 * checkout.js — Standalone checkout form widget (v2 — full checkout)
 * Host: https://kedebuk.github.io/herbahero/checkout.js
 *
 * Cara pakai di LP:
 * ──────────────────────────────────────────────────────
 * 1. Taruh config sebelum script ini:
 *    <script>
 *    var CHECKOUT_CONFIG = {
 *      pixelId: "123456789012345",
 *      productName: "Nama Produk",
 *      productPrice: 97000,
 *      waNumber: "6285270404312",
 *      packages: [
 *        "Paket Hemat (1 pcs) — Rp 97.000",
 *        "Paket Duo (2 pcs) — Rp 177.000"
 *      ],
 *      waTemplate: "...",            // custom template (simple mode)
 *      ctaText: "PESAN via WhatsApp",
 *      themeColor: "#16a34a",
 *
 *      // Full checkout mode:
 *      shippingEnabled: true,
 *      shippingApiUrl: "https://herbahero.kedebik.workers.dev/api/shipping",
 *      shippingOrigin: "",
 *      shippingWeight: 1000,
 *      paymentMethods: [
 *        {id: "mandiri", name: "Bank Mandiri", logo: ""},
 *        {id: "bca", name: "Bank Central Asia", logo: ""},
 *        {id: "cod", name: "COD", logo: ""}
 *      ]
 *    };
 *    </script>
 *
 * 2. <div id="cw-form"></div>
 * 3. <script src="https://kedebuk.github.io/herbahero/checkout.js"></script>
 * ──────────────────────────────────────────────────────
 */
(function() {
  var cfg = window.CHECKOUT_CONFIG || {};
  var pid = cfg.pixelId || "";
  var waNum = cfg.waNumber || "6285270404312";
  var prodName = cfg.productName || "Produk";
  var prodPrice = cfg.productPrice || 0;
  var packages = cfg.packages || [];
  var waTemplate = cfg.waTemplate || "Halo, saya mau order *{package}* atas nama {name}. No HP: {phone}";
  var ctaText = cfg.ctaText || "PESAN via WhatsApp 💬";
  var theme = cfg.themeColor || "#16a34a";

  // Full checkout config
  var shippingEnabled = cfg.shippingEnabled === true;
  var shippingApiUrl = cfg.shippingApiUrl || "";
  // Lincah origin code (district code, e.g. "20.71.05" for Medan Kota)
  var shippingOriginCode = cfg.shippingOriginCode || cfg.shippingOrigin || "";
  var shippingWeight = cfg.shippingWeight || 1;  // kg (Lincah uses kg, not grams)
  var paymentMethods = cfg.paymentMethods || [];
  // Keep shippingOrigin as alias for backward compat
  var shippingOrigin = shippingOriginCode;

  // State
  var state = {
    selectedPkg: packages.length > 0 ? packages[0] : prodName,
    selectedPkgPrice: prodPrice,
    selectedCity: null,     // {code, name} — Lincah district code
    selectedCourier: null,  // {name, service, price}
    selectedPayment: null,  // {id, name}
    couriers: []
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
  function fmt(n) {
    return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function parsePrice(str) {
    var m = str.match(/Rp[\s.]*([\d.]+)/i);
    if (m) return parseInt(m[1].replace(/\./g, ''), 10);
    return prodPrice;
  }

  function debounce(fn, ms) {
    var t; return function() {
      var a = arguments, c = this;
      clearTimeout(t); t = setTimeout(function(){ fn.apply(c, a); }, ms);
    };
  }

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return document.querySelectorAll(sel); }

  // ─── Meta Pixel ─────────────────────────────────────────────────────────
  if (pid && !window.fbq) {
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', pid);
    fbq('track', 'PageView');
  }
  function track(event, params) {
    if (window.fbq) fbq('track', event, params || {});
  }

  // ─── Mount ──────────────────────────────────────────────────────────────
  var mount = document.getElementById('cw-form');
  if (!mount) { console.warn('[checkout.js] #cw-form not found'); return; }

  // ─── Build HTML ─────────────────────────────────────────────────────────
  var html = [];

  // Styles
  html.push('<style>');
  html.push('#cw-form *{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif}');
  html.push('.cw-wrap{background:#fff;border:2px solid #e5e7eb;border-radius:16px;padding:28px 20px;max-width:480px;margin:0 auto}');
  html.push('.cw-title{font-size:20px;font-weight:800;text-align:center;margin-bottom:4px}');
  html.push('.cw-sub{text-align:center;color:#6b7280;font-size:14px;margin-bottom:20px}');
  html.push('.cw-section{margin-bottom:18px}');
  html.push('.cw-section-title{font-size:15px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;align-items:center;gap:8px}');
  html.push('.cw-section-num{background:'+theme+';color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0}');
  html.push('.cw-group{margin-bottom:12px}');
  html.push('.cw-group label{display:block;font-weight:600;font-size:13px;margin-bottom:5px;color:#374151}');
  html.push('.cw-group input[type="text"],.cw-group input[type="tel"]{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;transition:border-color .15s;outline:none;background:#fff}');
  html.push('.cw-group input:focus{border-color:'+theme+'}');
  // Package buttons
  html.push('.cw-packages{display:flex;flex-direction:column;gap:8px}');
  html.push('.cw-pkg-btn{width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;background:#fff;font-size:15px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s;color:#374151}');
  html.push('.cw-pkg-btn:hover{border-color:'+theme+';background:#f0fdf4}');
  html.push('.cw-pkg-active{border-color:'+theme+';background:'+theme+'14;color:'+theme+';box-shadow:0 0 0 3px '+theme+'22}');
  // Autocomplete
  html.push('.cw-ac-wrap{position:relative}');
  html.push('.cw-ac-list{position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid #e5e7eb;border-top:0;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;z-index:100;display:none}');
  html.push('.cw-ac-item{padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid #f3f4f6;color:#374151}');
  html.push('.cw-ac-item:hover{background:#f0fdf4}');
  html.push('.cw-ac-loading{padding:12px 14px;font-size:13px;color:#9ca3af;text-align:center}');
  // Radio cards (courier & payment)
  html.push('.cw-radio-list{display:flex;flex-direction:column;gap:8px}');
  html.push('.cw-radio-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;cursor:pointer;transition:all .15s;background:#fff}');
  html.push('.cw-radio-card:hover{border-color:'+theme+'}');
  html.push('.cw-radio-card.cw-rc-active{border-color:'+theme+';background:'+theme+'08;box-shadow:0 0 0 3px '+theme+'18}');
  html.push('.cw-radio-dot{width:20px;height:20px;border-radius:50%;border:2px solid #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}');
  html.push('.cw-rc-active .cw-radio-dot{border-color:'+theme+'}');
  html.push('.cw-rc-active .cw-radio-dot::after{content:"";width:10px;height:10px;border-radius:50%;background:'+theme+'}');
  html.push('.cw-radio-info{flex:1;min-width:0}');
  html.push('.cw-radio-name{font-weight:600;font-size:14px;color:#1f2937}');
  html.push('.cw-radio-detail{font-size:13px;color:#6b7280;margin-top:2px}');
  html.push('.cw-radio-price{font-weight:700;font-size:14px;color:'+theme+';white-space:nowrap;flex-shrink:0}');
  html.push('.cw-radio-logo{width:32px;height:32px;object-fit:contain;flex-shrink:0;border-radius:6px}');
  // Summary box
  html.push('.cw-summary{border:2px solid #0d9488;border-radius:12px;padding:16px;margin-bottom:18px;background:#f0fdfa}');
  html.push('.cw-summary-title{font-size:15px;font-weight:700;color:#0d9488;margin-bottom:12px}');
  html.push('.cw-summary-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:14px;color:#374151}');
  html.push('.cw-summary-row.cw-sr-total{border-top:2px solid #0d9488;margin-top:8px;padding-top:10px;font-size:16px;font-weight:800;color:#0d9488}');
  html.push('.cw-summary-label{flex:1}');
  html.push('.cw-summary-value{font-weight:600;text-align:right}');
  // CTA
  html.push('.cw-btn{width:100%;background:'+theme+';color:#fff;font-size:17px;font-weight:800;padding:16px;border:none;border-radius:12px;cursor:pointer;margin-top:6px;transition:all .15s;letter-spacing:.3px}');
  html.push('.cw-btn:hover{opacity:.88}');
  html.push('.cw-btn:disabled{opacity:.5;cursor:not-allowed}');
  html.push('.cw-note{text-align:center;font-size:13px;color:#9ca3af;margin-top:10px}');
  html.push('.cw-error{color:#dc2626;font-size:13px;margin-top:6px;display:none}');
  html.push('.cw-hidden{display:none!important}');
  // Courier loading
  html.push('.cw-courier-loading{text-align:center;padding:20px;color:#9ca3af;font-size:14px}');
  html.push('.cw-spinner{display:inline-block;width:20px;height:20px;border:3px solid #e5e7eb;border-top-color:'+theme+';border-radius:50%;animation:cw-spin .6s linear infinite;margin-right:8px;vertical-align:middle}');
  html.push('@keyframes cw-spin{to{transform:rotate(360deg)}}');
  html.push('</style>');

  // Form wrapper
  html.push('<div class="cw-wrap">');
  html.push('<div class="cw-title">🛒 Pesan Sekarang</div>');
  html.push('<div class="cw-sub">Isi data di bawah untuk melakukan pemesanan</div>');
  html.push('<form id="cw-frm" novalidate>');

  // Section 1: Data Pemesan
  var sn = 1;
  html.push('<div class="cw-section">');
  html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Data Pemesan</div>');
  html.push('<div class="cw-group"><label>Nama Lengkap *</label><input type="text" id="cw-name" placeholder="Nama kamu" autocomplete="name"></div>');
  html.push('<div class="cw-group"><label>No. WhatsApp *</label><input type="tel" id="cw-phone" placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="numeric"></div>');
  html.push('</div>');

  // Section 2: Pilih Paket
  if (packages.length > 0) {
    sn++;
    html.push('<div class="cw-section">');
    html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Pilih Paket</div>');
    html.push('<div class="cw-packages">');
    packages.forEach(function(p, i) {
      html.push('<button type="button" class="cw-pkg-btn'+(i===0?' cw-pkg-active':'')+'" data-pkg="'+p.replace(/"/g,'&quot;')+'" data-idx="'+i+'">'+p+'</button>');
    });
    html.push('</div>');
    html.push('<input type="hidden" id="cw-pkg" value="'+(packages[0] || '').replace(/"/g,'&quot;')+'">');
    html.push('</div>');
  }

  // Full checkout sections (only if shippingEnabled)
  if (shippingEnabled) {
    // Section: Alamat Pengiriman
    sn++;
    html.push('<div class="cw-section">');
    html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Alamat Pengiriman</div>');
    html.push('<div class="cw-group"><label>Kota / Kecamatan *</label>');
    html.push('<div class="cw-ac-wrap">');
    html.push('<input type="text" id="cw-city" placeholder="Ketik nama kota atau kecamatan..." autocomplete="off">');
    html.push('<div class="cw-ac-list" id="cw-ac-list"></div>');
    html.push('</div></div>');
    html.push('<div class="cw-group"><label>Alamat Lengkap *</label><input type="text" id="cw-address" placeholder="Jl. nama jalan, RT/RW, kelurahan..."></div>');
    html.push('</div>');

    // Section: Pilih Kurir
    sn++;
    html.push('<div class="cw-section" id="cw-courier-section">');
    html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Pilih Kurir</div>');
    html.push('<div id="cw-courier-list" class="cw-radio-list"><p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Pilih kota terlebih dahulu</p></div>');
    html.push('</div>');

    // Section: Metode Pembayaran
    if (paymentMethods.length > 0) {
      sn++;
      html.push('<div class="cw-section">');
      html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Metode Pembayaran</div>');
      html.push('<div class="cw-radio-list" id="cw-payment-list">');
      paymentMethods.forEach(function(pm, i) {
        var logoHtml = pm.logo ? '<img class="cw-radio-logo" src="'+pm.logo+'" alt="'+pm.name+'">' : '';
        html.push('<div class="cw-radio-card'+(i===0?' cw-rc-active':'')+'" data-pay-id="'+pm.id+'" data-pay-name="'+pm.name.replace(/"/g,'&quot;')+'">');
        html.push('<div class="cw-radio-dot"></div>');
        if (logoHtml) html.push(logoHtml);
        html.push('<div class="cw-radio-info"><div class="cw-radio-name">'+pm.name+'</div></div>');
        html.push('</div>');
      });
      html.push('</div>');
      html.push('</div>');
    }

    // Section: Rincian Pesanan (summary)
    sn++;
    html.push('<div class="cw-section">');
    html.push('<div class="cw-section-title"><span class="cw-section-num">'+sn+'</span> Rincian Pesanan</div>');
    html.push('<div class="cw-summary" id="cw-summary">');
    html.push('<div class="cw-summary-title">📋 Ringkasan Order</div>');
    html.push('<div class="cw-summary-row"><span class="cw-summary-label" id="cw-sum-prod">'+prodName+'</span><span class="cw-summary-value" id="cw-sum-price">'+fmt(prodPrice)+'</span></div>');
    html.push('<div class="cw-summary-row"><span class="cw-summary-label" id="cw-sum-ship-label">Ongkir</span><span class="cw-summary-value" id="cw-sum-ship-price">-</span></div>');
    html.push('<div class="cw-summary-row cw-sr-total"><span class="cw-summary-label">TOTAL</span><span class="cw-summary-value" id="cw-sum-total">'+fmt(prodPrice)+'</span></div>');
    html.push('</div>');
    html.push('</div>');
  }

  // Error + CTA
  html.push('<p id="cw-err" class="cw-error"></p>');
  var fullCtaText = shippingEnabled ? (cfg.ctaText || 'Klik disini untuk pesan sekarang 💬') : ctaText;
  html.push('<button type="submit" class="cw-btn" id="cw-btn">'+fullCtaText+'</button>');
  html.push('</form>');
  html.push('<p class="cw-note">🔒 Data kamu aman & terenkripsi.</p>');
  html.push('</div>');

  mount.innerHTML = html.join('');

  // ─── Package Selection ──────────────────────────────────────────────────
  mount.querySelectorAll('.cw-pkg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      mount.querySelectorAll('.cw-pkg-btn').forEach(function(b){ b.classList.remove('cw-pkg-active'); });
      btn.classList.add('cw-pkg-active');
      var hidden = qs('#cw-pkg');
      if (hidden) hidden.value = btn.getAttribute('data-pkg');
      state.selectedPkg = btn.getAttribute('data-pkg');
      state.selectedPkgPrice = parsePrice(state.selectedPkg);
      updateSummary();
    });
  });

  // Init selected package price
  if (packages.length > 0) {
    state.selectedPkgPrice = parsePrice(packages[0]);
  }

  // ─── Payment Selection ──────────────────────────────────────────────────
  if (shippingEnabled && paymentMethods.length > 0) {
    state.selectedPayment = paymentMethods[0];
    mount.querySelectorAll('#cw-payment-list .cw-radio-card').forEach(function(card) {
      card.addEventListener('click', function() {
        mount.querySelectorAll('#cw-payment-list .cw-radio-card').forEach(function(c){ c.classList.remove('cw-rc-active'); });
        card.classList.add('cw-rc-active');
        state.selectedPayment = {
          id: card.getAttribute('data-pay-id'),
          name: card.getAttribute('data-pay-name')
        };
      });
    });
  }

  // ─── City Autocomplete ──────────────────────────────────────────────────
  if (shippingEnabled && shippingApiUrl) {
    var cityInput = qs('#cw-city');
    var acList = qs('#cw-ac-list');
    var searchTimer = null;

    var doSearch = debounce(function(query) {
      if (query.length < 3) { acList.style.display = 'none'; return; }
      acList.innerHTML = '<div class="cw-ac-loading"><span class="cw-spinner"></span>Mencari...</div>';
      acList.style.display = 'block';

      // Lincah API: GET /api/shipping/search?q=...
      // Response: {success, data: [{code, fullName, province, city, name, id}]}
      fetch(shippingApiUrl + '/search?q=' + encodeURIComponent(query))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          // Lincah response: data.data[]
          var results = [];
          if (data && Array.isArray(data.data)) {
            results = data.data;
          } else if (Array.isArray(data)) {
            results = data;
          } else if (data && Array.isArray(data.results)) {
            results = data.results;
          }
          if (results.length === 0) {
            acList.innerHTML = '<div class="cw-ac-loading">Tidak ditemukan</div>';
            return;
          }
          acList.innerHTML = '';
          results.forEach(function(item) {
            var div = document.createElement('div');
            div.className = 'cw-ac-item';
            // Lincah returns fullName like "Medan Kota, Kota Medan, Sumatera Utara"
            var label = item.fullName || item.label || item.name || item.subdistrict_name || item.city_name || item.text || '';
            // Lincah district code (e.g. "20.71.05") — used as destination code in ongkir API
            var code = item.code || item.id || item.destination_id || '';
            div.textContent = label;
            div.setAttribute('data-code', code);
            div.setAttribute('data-label', label);
            div.addEventListener('click', function() {
              cityInput.value = label;
              state.selectedCity = { code: code, name: label };
              acList.style.display = 'none';
              // Fetch courier costs using district code
              fetchCouriers(code);
            });
            acList.appendChild(div);
          });
        })
        .catch(function(err) {
          console.error('[checkout] search error:', err);
          acList.innerHTML = '<div class="cw-ac-loading">Gagal memuat data</div>';
        });
    }, 300);

    cityInput.addEventListener('input', function() {
      state.selectedCity = null;
      state.selectedCourier = null;
      state.couriers = [];
      updateSummary();
      doSearch(cityInput.value.trim());
    });

    // Close autocomplete on outside click
    document.addEventListener('click', function(e) {
      if (!cityInput.contains(e.target) && !acList.contains(e.target)) {
        acList.style.display = 'none';
      }
    });

  }

  // ─── Fetch Couriers ─────────────────────────────────────────────────────
  // destCode: Lincah district code, e.g. "34.02.01"
  // Render courier cards into container
  function renderCourierCards(courierContainer, couriers) {
    courierContainer.innerHTML = '';
    couriers.forEach(function(c, idx) {
      var card = document.createElement('div');
      card.className = 'cw-radio-card';
      card.setAttribute('data-c-idx', idx);
      var etdText = c.etd ? ' (' + c.etd + ' hari)' : '';
      var titleText = c.name + (c.service ? ' - ' + c.service : '');
      var priceText = c.price > 0 ? fmt(c.price) : 'Menghitung...';
      var detailText = (c.price > 0 ? fmt(c.price) : '<span class="cw-spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle"></span> Menghitung ongkir...') + etdText;
      card.innerHTML =
        '<div class="cw-radio-dot"></div>'
        + '<div class="cw-radio-info">'
        +   '<div class="cw-radio-name">' + titleText + '</div>'
        +   '<div class="cw-radio-detail">' + detailText + '</div>'
        + '</div>'
        + (c.price > 0 ? '<div class="cw-radio-price">' + fmt(c.price) + '</div>' : '');
      if (c.price > 0) {
        card.addEventListener('click', function() {
          courierContainer.querySelectorAll('.cw-radio-card').forEach(function(cc){ cc.classList.remove('cw-rc-active'); });
          card.classList.add('cw-rc-active');
          state.selectedCourier = c;
          updateSummary();
        });
      } else {
        card.style.opacity = '0.7';
        card.style.cursor = 'wait';
      }
      courierContainer.appendChild(card);
    });
  }

  function fetchCouriers(destCode) {
    var courierContainer = qs('#cw-courier-list');
    if (!courierContainer) return;

    courierContainer.innerHTML = '<div class="cw-courier-loading"><span class="cw-spinner"></span> Mengambil kurir tersedia...</div>';
    state.selectedCourier = null;
    state.couriers = [];
    updateSummary();

    if (!shippingApiUrl) {
      courierContainer.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px 0">Layanan ongkir belum tersedia</p>';
      return;
    }

    // Step 1: Fetch available couriers first (fast endpoint, <2s)
    fetch(shippingApiUrl + '/couriers')
    .then(function(r) { return r.json(); })
    .then(function(courierData) {
      var available = [];
      if (courierData && courierData.success && Array.isArray(courierData.data)) {
        courierData.data.forEach(function(c) {
          if (c.isMain) {
            available.push({
              code: c.code || '',
              name: c.name || c.code || 'Kurir',
              service: 'Regular',
              price: 0,
              etd: '',
              image: c.image || ''
            });
          }
        });
      }

      // Show courier list immediately (without prices yet)
      if (available.length > 0) {
        state.couriers = available;
        renderCourierCards(courierContainer, available);
        // Add a note
        var note = document.createElement('p');
        note.style.cssText = 'color:#9ca3af;font-size:12px;text-align:center;padding:4px 0 8px;margin:0';
        note.innerHTML = '<span class="cw-spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Menghitung ongkir ke kotamu... (30-60 detik)';
        note.id = 'cw-cost-loading-note';
        courierContainer.appendChild(note);
      }

      // Step 2: Fetch actual costs (slow endpoint, 30-60s)
      var body = {
        originCode: shippingOriginCode || shippingOrigin || '',
        destCode: destCode,
        weight: shippingWeight || 1,
        packagePrice: state.selectedPkgPrice || prodPrice || 97000,
        isPickup: false,
        isCod: false,
        logistics: available.map(function(c) { return c.name; }),
        services: ['Regular', 'Express']
      };

      return fetch(shippingApiUrl + '/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var couriers = [];
        var raw = (data && Array.isArray(data.data)) ? data.data : (Array.isArray(data) ? data : []);

        raw.forEach(function(item) {
          if (item.costs && Array.isArray(item.costs)) {
            item.costs.forEach(function(svc) {
              var price = 0, etd = '';
              if (svc.cost) { price = svc.cost.value || 0; etd = svc.cost.etd || ''; }
              if (price > 0) {
                couriers.push({
                  code: item.code || '',
                  name: item.name || item.code || 'Kurir',
                  service: svc.service_name || svc.service || '',
                  price: price,
                  etd: etd
                });
              }
            });
          } else if (item.price !== undefined || item.cost !== undefined) {
            couriers.push({
              code: item.code || '',
              name: item.courier || item.courier_name || item.name || 'Kurir',
              service: item.service || item.service_name || '',
              price: item.price || item.cost || 0,
              etd: item.etd || item.estimation || ''
            });
          }
        });

        // Remove loading note
        var loadNote = qs('#cw-cost-loading-note');
        if (loadNote) loadNote.remove();

        if (couriers.length > 0) {
          // Sort by price ascending
          couriers.sort(function(a, b) { return a.price - b.price; });
          state.couriers = couriers;
          renderCourierCards(courierContainer, couriers);
        } else {
          // Cost API failed but couriers are shown — show message
          var failNote = document.createElement('p');
          failNote.style.cssText = 'color:#f59e0b;font-size:12px;text-align:center;padding:4px 0 8px;margin:0';
          failNote.innerHTML = 'Ongkir belum bisa dihitung otomatis. Pilih kurir, ongkir dikonfirmasi via WhatsApp.';
          courierContainer.appendChild(failNote);
          // Make courier cards clickable without price
          state.couriers.forEach(function(c) { c.price = 0; });
          courierContainer.querySelectorAll('.cw-radio-card').forEach(function(card) {
            card.style.opacity = '1';
            card.style.cursor = 'pointer';
            var idx = parseInt(card.getAttribute('data-c-idx'));
            card.addEventListener('click', function() {
              courierContainer.querySelectorAll('.cw-radio-card').forEach(function(cc){ cc.classList.remove('cw-rc-active'); });
              card.classList.add('cw-rc-active');
              state.selectedCourier = state.couriers[idx] || null;
              updateSummary();
            });
          });
        }
      })
      .catch(function(costErr) {
        console.error('[checkout] cost error:', costErr);
        var loadNote = qs('#cw-cost-loading-note');
        if (loadNote) {
          loadNote.innerHTML = '⚠️ Ongkir belum bisa dihitung. Pilih kurir, ongkir dikonfirmasi via WhatsApp.';
          loadNote.style.color = '#f59e0b';
        }
        // Make cards clickable without price
        courierContainer.querySelectorAll('.cw-radio-card').forEach(function(card) {
          card.style.opacity = '1';
          card.style.cursor = 'pointer';
          var idx = parseInt(card.getAttribute('data-c-idx'));
          card.addEventListener('click', function() {
            courierContainer.querySelectorAll('.cw-radio-card').forEach(function(cc){ cc.classList.remove('cw-rc-active'); });
            card.classList.add('cw-rc-active');
            state.selectedCourier = state.couriers[idx] || null;
            updateSummary();
          });
        });
      });
    })
    .catch(function(err) {
      console.error('[checkout] courier list error:', err);
      courierContainer.innerHTML = '<p style="color:#dc2626;font-size:13px;text-align:center;padding:12px 0">Gagal mengambil daftar kurir. <a href="#" onclick="location.reload()" style="color:#2563eb;text-decoration:underline">Coba lagi</a></p>';
    });
  }

  // ─── Update Summary ────────────────────────────────────────────────────
  function updateSummary() {
    if (!shippingEnabled) return;
    var sumProd = qs('#cw-sum-prod');
    var sumPrice = qs('#cw-sum-price');
    var sumShipLabel = qs('#cw-sum-ship-label');
    var sumShipPrice = qs('#cw-sum-ship-price');
    var sumTotal = qs('#cw-sum-total');
    if (!sumProd) return;

    var itemPrice = state.selectedPkgPrice || prodPrice;
    var pkgLabel = state.selectedPkg || prodName;
    // Shorten label for summary
    if (pkgLabel.length > 40) pkgLabel = pkgLabel.substring(0, 40) + '...';
    sumProd.textContent = pkgLabel;
    sumPrice.textContent = fmt(itemPrice);

    var shipCost = 0;
    if (state.selectedCourier) {
      shipCost = state.selectedCourier.price;
      sumShipLabel.textContent = 'Ongkir (' + state.selectedCourier.name + ' ' + state.selectedCourier.service + ')';
      sumShipPrice.textContent = fmt(shipCost);
    } else {
      sumShipLabel.textContent = 'Ongkir';
      sumShipPrice.textContent = '-';
    }

    sumTotal.textContent = fmt(itemPrice + shipCost);
  }

  // Init summary
  updateSummary();

  // ─── Track InitiateCheckout ─────────────────────────────────────────────
  var tracked = false;
  mount.addEventListener('focusin', function() {
    if (!tracked) { track('InitiateCheckout', {value: prodPrice, currency: 'IDR', content_name: prodName}); tracked = true; }
  }, {once: true});

  // ─── Form Submit ────────────────────────────────────────────────────────
  qs('#cw-frm').addEventListener('submit', function(e) {
    e.preventDefault();
    var name = qs('#cw-name').value.trim();
    var phone = qs('#cw-phone').value.trim();
    var errEl = qs('#cw-err');

    // Validate
    if (!name || !phone) {
      errEl.textContent = 'Nama dan nomor WhatsApp wajib diisi.';
      errEl.style.display = 'block';
      return;
    }

    if (shippingEnabled) {
      var city = qs('#cw-city');
      var address = qs('#cw-address');
      if (!state.selectedCity || !city.value.trim()) {
        errEl.textContent = 'Pilih kota/kecamatan tujuan pengiriman.';
        errEl.style.display = 'block';
        city.focus();
        return;
      }
      if (!address.value.trim()) {
        errEl.textContent = 'Alamat lengkap wajib diisi.';
        errEl.style.display = 'block';
        address.focus();
        return;
      }
      if (!state.selectedCourier) {
        errEl.textContent = 'Pilih kurir pengiriman.';
        errEl.style.display = 'block';
        return;
      }
      if (paymentMethods.length > 0 && !state.selectedPayment) {
        errEl.textContent = 'Pilih metode pembayaran.';
        errEl.style.display = 'block';
        return;
      }
    }

    errEl.style.display = 'none';

    // Normalize phone
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    // Fire pixels
    var totalPrice = (state.selectedPkgPrice || prodPrice) + (state.selectedCourier ? state.selectedCourier.price : 0);
    track('Lead', { content_name: prodName, value: totalPrice, currency: 'IDR' });
    track('Purchase', { value: totalPrice, currency: 'IDR', content_name: prodName, content_type: 'product' });

    // Build WhatsApp message
    var msg;
    if (shippingEnabled) {
      var pkg = qs('#cw-pkg') ? qs('#cw-pkg').value : prodName;
      var itemPrice = state.selectedPkgPrice || prodPrice;
      var shipCost = state.selectedCourier ? state.selectedCourier.price : 0;
      var courierStr = state.selectedCourier ? (state.selectedCourier.name + ' ' + state.selectedCourier.service) : '-';
      var payStr = state.selectedPayment ? state.selectedPayment.name : '-';
      var fullAddress = address.value.trim() + ', ' + state.selectedCity.name;

      msg = '🛒 *ORDER BARU*\n'
        + '━━━━━━━━━━━━━━━\n'
        + '*Nama:* ' + name + '\n'
        + '*No HP:* ' + phone + '\n'
        + '*Alamat:* ' + fullAddress + '\n'
        + '━━━━━━━━━━━━━━━\n'
        + '*Produk:* ' + pkg + '\n'
        + '*Harga:* ' + fmt(itemPrice) + '\n'
        + '*Kurir:* ' + courierStr + ' — ' + fmt(shipCost) + '\n'
        + '*Pembayaran:* ' + payStr + '\n'
        + '━━━━━━━━━━━━━━━\n'
        + '*TOTAL: ' + fmt(itemPrice + shipCost) + '*';
    } else {
      var pkg = qs('#cw-pkg') ? qs('#cw-pkg').value : prodName;
      msg = waTemplate
        .replace(/\{name\}/g, name)
        .replace(/\{phone\}/g, phone)
        .replace(/\{package\}/g, pkg)
        .replace(/\{product\}/g, prodName);
    }

    // Redirect
    var btn = qs('#cw-btn');
    btn.textContent = 'Menghubungkan ke WhatsApp...';
    btn.disabled = true;
    setTimeout(function() {
      window.location.href = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg);
    }, 400);
  });
})();
