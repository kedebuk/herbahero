/**
 * Google Apps Script — Order Management Backend
 *
 * Setup:
 * 1. Buat Google Sheet baru, rename sheet pertama → "Orders"
 * 2. Extensions → Apps Script → paste kode ini
 * 3. Deploy → New deployment → Web app (Execute as Me, Anyone can access)
 * 4. Copy URL, paste ke LP_CONFIG.webhookUrl
 *
 * Header row otomatis dibuat kalau belum ada.
 * Mendukung Facebook Conversions API (CAPI) server-side.
 * Mendukung UTM tracking (utm_source, utm_medium, utm_campaign, utm_content).
 */

var SHEET_NAME = 'Orders';

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ID','Timestamp','Nama','WA','Alamat','Kecamatan','Kota','Provinsi','Wilayah','Produk','Qty','Ongkir','Total','MetodeBayar','Catatan','Upsell','LPSource','Status','UTM_Source','UTM_Medium','UTM_Campaign','UTM_Content']);
    sh.getRange('A1:V1').setFontWeight('bold');
  }
  return sh;
}

function genId() { return 'ORD-' + new Date().getTime().toString(36).toUpperCase(); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── SHA-256 helper untuk CAPI user data hashing ── */
function sha256Hex(str) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (str || '').toLowerCase().trim(),
    Utilities.Charset.UTF_8
  );
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/* Normalisasi nomor WA ke format internasional tanpa '+' */
function normalizePhone(wa) {
  var n = (wa || '').replace(/\D/g, '');
  if (n.charAt(0) === '0') n = '62' + n.slice(1);
  if (n.slice(0, 2) !== '62') n = '62' + n;
  return n;
}

/* ── Kirim event ke Facebook Conversions API ── */
function sendCAPI(d, orderId) {
  var c = d._capi;
  if (!c || !c.token || !c.pixelId) return;
  try {
    var ud = {};
    if (d.wa)   ud.ph = [sha256Hex(normalizePhone(d.wa))];
    if (d.nama) {
      var parts = d.nama.trim().split(/\s+/);
      ud.fn = [sha256Hex(parts[0])];
      if (parts.length > 1) ud.ln = [sha256Hex(parts[parts.length - 1])];
    }
    if (c.fbc && c.fbc !== '') ud.fbc = c.fbc;
    if (c.fbp && c.fbp !== '') ud.fbp = c.fbp;
    if (c.clientUserAgent) ud.client_user_agent = c.clientUserAgent;

    var eventData = {
      event_name:       c.event || 'Purchase',
      event_time:       Math.floor(new Date().getTime() / 1000),
      action_source:    'website',
      event_source_url: c.eventSourceUrl || d.lpSource || d.src || '',
      event_id:         c.eventId || orderId,
      user_data:        ud,
      custom_data: {
        value:    c.value || d.total || 0,
        currency: 'IDR'
      }
    };

    var payload = { data: [eventData] };
    if (c.testCode && c.testCode !== '') payload.test_event_code = c.testCode;

    var url = 'https://graph.facebook.com/v19.0/' + c.pixelId
      + '/events?access_token=' + encodeURIComponent(c.token);

    var resp = UrlFetchApp.fetch(url, {
      method:           'post',
      contentType:      'application/json',
      payload:          JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log('CAPI response [' + resp.getResponseCode() + ']: ' + resp.getContentText());
  } catch (err) {
    Logger.log('CAPI error: ' + err.toString());
  }
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);

    /* ── Analytics tracking ── */
    if (d.action === 'track') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var trackSheet = ss.getSheetByName('Analytics') || ss.insertSheet('Analytics');
      if (trackSheet.getLastRow() === 0) {
        trackSheet.appendRow(['Timestamp','LP Slug','Event','User Agent','Referrer','Session ID','Value']);
        trackSheet.getRange('A1:G1').setFontWeight('bold');
      }
      trackSheet.appendRow([
        new Date().toISOString(),
        d.slug || '',
        d.event || '',
        d.ua || '',
        d.ref || '',
        d.sessionId || '',
        d.value || ''
      ]);
      return json({ ok: true });
    }

    var id = genId();
    var ts = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    /* ── Per-slug sheet (new format) ── */
    var slug = d.slug || '';
    if (slug) {
      var slugSheet = ss.getSheetByName(slug) || ss.insertSheet(slug);
      if (slugSheet.getLastRow() === 0) {
        slugSheet.appendRow(['Timestamp','Nama','HP','Alamat','Kecamatan','Paket','Qty',
          'Harga Produk','Kurir','Ongkir','Total','Payment','Order ID']);
        slugSheet.getRange('A1:M1').setFontWeight('bold');
      }
      slugSheet.appendRow([
        ts,
        d.nama           || '',
        d.hp             || d.wa || '',
        d.alamat         || '',
        d.kecamatan      || '',
        d.paket_label    || d.produk || '',
        d.paket_qty      || d.qty || 1,
        d.harga_produk   || 0,
        d.kurir          || '',
        d.ongkir         || 0,
        d.total          || 0,
        d.payment_method || d.metodeBayar || '',
        id
      ]);
    } else {
      /* ── Fallback: legacy Orders sheet ── */
      var sh = getSheet();
      sh.appendRow([
        id, ts,
        d.nama       || '',
        d.wa || d.hp || '',
        d.alamat     || '',
        d.kecamatan  || '',
        d.kota       || '',
        d.provinsi   || '',
        d.wilayah    || '',
        d.paket_label || d.produk || '',
        d.paket_qty  || d.qty || 1,
        d.ongkir     || 0,
        d.total      || 0,
        d.payment_method || d.metodeBayar || d.bayar || '',
        d.catatan    || '',
        d.upsell     || '',
        d.lpSource   || d.src || '',
        'Pending',
        d.utm_source   || '',
        d.utm_medium   || '',
        d.utm_campaign || '',
        d.utm_content  || ''
      ]);
    }

    /* Kirim CAPI server-side (tidak mempengaruhi respons order) */
    sendCAPI(d, id);

    return json({ success: true, orderId: id });
  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  var p = e.parameter;
  var action = p.action || '';
  try {
    if (action === 'get_orders') {
      var sh = getSheet();
      var data = sh.getDataRange().getValues();
      var headers = data[0];
      var orders = [];
      for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) row[headers[j].toString().toLowerCase()] = data[i][j];
        orders.push(row);
      }
      return json({ success: true, orders: orders });
    }
    if (action === 'update_status') {
      var tid = p.id || '';
      var ns  = p.status || '';
      if (!tid || !ns) return json({ success: false, error: 'Missing id or status' });
      var sh = getSheet();
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === tid) {
          sh.getRange(i + 1, 18).setValue(ns);
          return json({ success: true });
        }
      }
      return json({ success: false, error: 'Order not found' });
    }
    if (action === 'get_stats') {
      var sh = getSheet();
      var data = sh.getDataRange().getValues();
      var stats = {};
      for (var i = 1; i < data.length; i++) {
        var status = (data[i][17] || 'Unknown').toString();
        stats[status] = (stats[status] || 0) + 1;
      }
      return json({ success: true, stats: stats, totalOrders: data.length - 1 });
    }
    if (action === 'analytics_data') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var trackSheet = ss.getSheetByName('Analytics');
      if (!trackSheet || trackSheet.getLastRow() <= 1) {
        return json({ data: [] });
      }
      var rows = trackSheet.getRange(2, 1, trackSheet.getLastRow() - 1, 7).getValues();
      var agg = {};
      rows.forEach(function(r) {
        var slug = r[1], event = r[2];
        if (!slug) return;
        if (!agg[slug]) agg[slug] = { slug: slug, views: 0, cta_clicks: 0, form_submissions: 0 };
        if (event === 'pageview') agg[slug].views++;
        else if (event === 'cta_click') agg[slug].cta_clicks++;
        else if (event === 'form_submit') agg[slug].form_submissions++;
      });
      return json({ data: Object.keys(agg).map(function(k) { return agg[k]; }) });
    }
    return json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return json({ success: false, error: err.toString() });
  }
}
