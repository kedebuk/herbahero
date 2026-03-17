/**
 * checkout.js — Standalone checkout form widget
 * Host: https://kedebuk.github.io/herbahero/checkout.js
 *
 * Cara pakai di LP Roni:
 * ──────────────────────────────────────────────────────
 * 1. Taruh config sebelum script ini:
 *    <script>
 *    var CHECKOUT_CONFIG = {
 *      pixelId: "123456789012345",   // Meta Pixel ID
 *      productName: "Nama Produk",
 *      productPrice: 97000,
 *      waNumber: "6285270404312",
 *      packages: [                   // opsional — hapus kalau 1 paket
 *        "Paket Hemat (1 pcs) — Rp 97.000",
 *        "Paket Duo (2 pcs) — Rp 177.000"
 *      ],
 *      waTemplate: "Halo, saya mau order *{package}* atas nama {name}. No HP: {phone}",
 *      ctaText: "PESAN via WhatsApp",  // opsional
 *      themeColor: "#16a34a"           // opsional, hex
 *    };
 *    </script>
 *
 * 2. Taruh di tempat form mau muncul:
 *    <div id="cw-form"></div>
 *
 * 3. Load script ini:
 *    <script src="https://kedebuk.github.io/herbahero/checkout.js"></script>
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

  // ─── Meta Pixel Init ───────────────────────────────────────────────────────
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

  // ─── Render Form ──────────────────────────────────────────────────────────
  var mount = document.getElementById('cw-form');
  if (!mount) { console.warn('[checkout.js] Element #cw-form not found'); return; }

  var packageSelect = packages.length > 0
    ? '<div class="cw-group"><label>Pilih Paket</label>'
      + '<div class="cw-packages">' + packages.map(function(p,i){
          return '<button type="button" class="cw-pkg-btn'+(i===0?' cw-pkg-active':'')+'" data-pkg="'+p+'" onclick="cwSelectPkg(this)">'+p+'</button>';
        }).join('') + '</div>'
      + '<input type="hidden" id="cw-pkg" value="'+(packages[0] || '')+'">'
      + '</div>'
    : '';

  mount.innerHTML =
    '<style>'
    + '#cw-form *{box-sizing:border-box;font-family:inherit}'
    + '.cw-wrap{background:#fff;border:2px solid #e5e7eb;border-radius:16px;padding:28px 24px;max-width:460px;margin:0 auto}'
    + '.cw-title{font-size:20px;font-weight:800;text-align:center;margin-bottom:4px}'
    + '.cw-sub{text-align:center;color:#6b7280;font-size:14px;margin-bottom:20px}'
    + '.cw-group{margin-bottom:14px}'
    + '.cw-group label{display:block;font-weight:600;font-size:14px;margin-bottom:5px;color:#374151}'
    + '.cw-group input{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:10px;font-size:15px;transition:border-color .15s;outline:none}'
    + '.cw-group input:focus{border-color:'+theme+'}'
    + '.cw-packages{display:flex;flex-direction:column;gap:8px}'
    + '.cw-pkg-btn{width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;background:#fff;font-size:15px;font-weight:600;cursor:pointer;text-align:left;transition:all .15s;color:#374151}'
    + '.cw-pkg-btn:hover{border-color:'+theme+';background:#f0fdf4}'
    + '.cw-pkg-active{border-color:'+theme+';background:'+theme+'14;color:'+theme+';box-shadow:0 0 0 3px '+theme+'22}'
    + '.cw-btn{width:100%;background:'+theme+';color:#fff;font-size:17px;font-weight:800;padding:16px;border:none;border-radius:12px;cursor:pointer;margin-top:6px;transition:opacity .15s;letter-spacing:.3px}'
    + '.cw-btn:hover{opacity:.88}'
    + '.cw-note{text-align:center;font-size:13px;color:#9ca3af;margin-top:10px}'
    + '.cw-error{color:#dc2626;font-size:13px;margin-top:6px;display:none}'
    + '</style>'
    + '<div class="cw-wrap">'
    +   '<div class="cw-title">🛒 Pesan Sekarang</div>'
    +   '<div class="cw-sub">Isi data di bawah, kami kirim konfirmasi via WhatsApp</div>'
    +   '<form id="cw-frm" novalidate>'
    +     '<div class="cw-group"><label>Nama Lengkap *</label>'
    +       '<input type="text" id="cw-name" placeholder="Nama kamu" autocomplete="name"></div>'
    +     '<div class="cw-group"><label>No. WhatsApp *</label>'
    +       '<input type="tel" id="cw-phone" placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="numeric"></div>'
    +     packageSelect
    +     '<p id="cw-err" class="cw-error">Nama dan nomor WhatsApp wajib diisi.</p>'
    +     '<button type="submit" class="cw-btn" id="cw-btn">'+ctaText+'</button>'
    +   '</form>'
    +   '<p class="cw-note">🔒 Data kamu aman. Tidak ada spam.</p>'
    + '</div>';

  // Package selection
  window.cwSelectPkg = function(el) {
    var btns = mount.querySelectorAll('.cw-pkg-btn');
    btns.forEach(function(b){ b.classList.remove('cw-pkg-active'); });
    el.classList.add('cw-pkg-active');
    var hidden = document.getElementById('cw-pkg');
    if (hidden) hidden.value = el.getAttribute('data-pkg');
  };

  // Track InitiateCheckout saat form difokus
  var tracked = false;
  mount.addEventListener('focusin', function() {
    if (!tracked) { track('InitiateCheckout', {value: prodPrice, currency: 'IDR', content_name: prodName}); tracked = true; }
  }, {once: true});

  // Submit
  document.getElementById('cw-frm').addEventListener('submit', function(e) {
    e.preventDefault();
    var name = document.getElementById('cw-name').value.trim();
    var phone = document.getElementById('cw-phone').value.trim();
    var pkg = document.getElementById('cw-pkg') ? document.getElementById('cw-pkg').value : prodName;
    var errEl = document.getElementById('cw-err');

    if (!name || !phone) { errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    // Normalize phone: 08xxx → 628xxx
    phone = phone.replace(/\D/g,'');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);

    // Fire Meta Pixel Purchase / Lead
    track('Lead', {content_name: prodName, value: prodPrice, currency: 'IDR'});
    track('Purchase', {value: prodPrice, currency: 'IDR', content_name: prodName, content_type: 'product'});

    // Build WA message
    var msg = waTemplate
      .replace(/\{name\}/g, name)
      .replace(/\{phone\}/g, phone)
      .replace(/\{package\}/g, pkg)
      .replace(/\{product\}/g, prodName);

    // Redirect ke WA
    var btn = document.getElementById('cw-btn');
    btn.textContent = 'Menghubungkan ke WhatsApp...';
    btn.disabled = true;
    setTimeout(function() {
      window.location.href = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg);
    }, 400);
  });
})();
