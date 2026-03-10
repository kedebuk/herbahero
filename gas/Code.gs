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
 */

var SHEET_NAME = 'Orders';

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ID','Timestamp','Nama','WA','Alamat','Kecamatan','Kota','Provinsi','Wilayah','Produk','Qty','Ongkir','Total','MetodeBayar','Catatan','LPSource','Status']);
    sh.getRange('A1:Q1').setFontWeight('bold');
  }
  return sh;
}

function genId() { return 'ORD-' + new Date().getTime().toString(36).toUpperCase(); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = getSheet();
    var id = genId();
    var ts = new Date().toLocaleString('id-ID', {timeZone:'Asia/Jakarta'});
    sh.appendRow([
      id, ts, d.nama||'', d.wa||'', d.alamat||'', d.kecamatan||'', d.kota||'',
      d.provinsi||'', d.wilayah||'', d.produk||'', d.qty||1,
      d.ongkir||0, d.total||0, d.metodeBayar||'', d.catatan||'',
      d.lpSource||'', 'Pending'
    ]);
    return json({success:true, orderId:id});
  } catch(err) {
    return json({success:false, error:err.toString()});
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
      return json({success:true, orders:orders});
    }
    if (action === 'update_status') {
      var tid = p.id||'';
      var ns = p.status||'';
      if (!tid || !ns) return json({success:false, error:'Missing id or status'});
      var sh = getSheet();
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] === tid) {
          sh.getRange(i+1, 17).setValue(ns);
          return json({success:true});
        }
      }
      return json({success:false, error:'Order not found'});
    }
    return json({success:false, error:'Unknown action'});
  } catch(err) {
    return json({success:false, error:err.toString()});
  }
}
