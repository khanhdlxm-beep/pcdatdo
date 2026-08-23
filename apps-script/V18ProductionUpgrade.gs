/**
 * V1.8 PRODUCTION UPGRADE
 * Chạy 1 lần trong Apps Script sau khi cập nhật Code.gs + PdfImport.gs.
 * Mục tiêu:
 * - Bổ sung/chuẩn hóa danh mục KPI để các KPI V1.8 không bị skip khi approve PDF.
 * - Không xóa dữ liệu hiện có.
 * - Cung cấp chẩn đoán backend Production mà không lộ API key.
 */

function upgradePdfCatalogV18Production() {
  if (typeof setupPdfImportModule !== 'function') throw new Error('Thiếu PdfImport.gs hoặc chưa cập nhật module PDF Import.');
  setupPdfImportModule();

  var ss = SpreadsheetApp.getActive();
  var sheetName = (typeof PDFMOD !== 'undefined' && PDFMOD.SHEETS && PDFMOD.SHEETS.CATALOG) ? PDFMOD.SHEETS.CATALOG : '01_DM_CHITIEU';
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Không tìm thấy sheet ' + sheetName);

  var rows = [
    ['KD_DIENNHAN','kinh-doanh','Kinh doanh','Điện nhận','Tr.kWh','info','sum',3,'điện nhận',true],
    ['KD_COCADIENMUA','kinh-doanh','Kinh doanh','Cơ cấu điện mua','','info','snapshot',0,'cơ cấu điện mua',true],
    ['KD_DTP','kinh-doanh','Kinh doanh','Điện thương phẩm','Tr.kWh','higher','sum',3,'sản lượng điện thương phẩm|điện thương phẩm',true],
    ['KD_DT','kinh-doanh','Kinh doanh','Doanh thu','Tỷ đồng','higher','sum',2,'tổng doanh thu|doanh thu',true],
    ['KD_GIA','kinh-doanh','Kinh doanh','Giá bán điện bình quân','đ/kWh','higher','avg',2,'giá bán điện bình quân|giá bán điện bq',true],
    ['KD_GIAMUA','kinh-doanh','Kinh doanh','Giá mua điện bình quân','đ/kWh','lower','avg',2,'giá mua điện bình quân|giá mua điện bq',true],
    ['KD_TT','kinh-doanh','Kinh doanh','Tổn thất điện năng','%','lower','avg',2,'tổn thất điện năng|tổn thất',true],
    ['KD_DBPT','kinh-doanh','Kinh doanh','Dự báo phụ tải (điện thương phẩm)','%','lower','avg',2,'dự báo điện thương phẩm|dự báo phụ tải',true],
    ['KD_CONGTO','kinh-doanh','Kinh doanh','Thay / bảo trì công tơ','Cái','higher','sum',0,'bảo trì tbđđ|bảo trì theo luật đo lường|bảo trì điều phối|thay bảo trì công tơ',true],
    ['KD_VIPHAM','kinh-doanh','Kinh doanh','Kiểm tra xử lý vi phạm sử dụng điện','kWh','higher','sum',0,'kiểm tra xử lý vi phạm sử dụng điện|vi phạm sử dụng điện',true],
    ['KD_TKIEM','kinh-doanh','Kinh doanh','Tiết kiệm điện','Tr.kWh','higher','sum',2,'tiết kiệm điện',true],
    ['KD_THUNGAN','kinh-doanh','Kinh doanh','Công tác quản lý thu ngân','%','higher','avg',2,'công tác quản lý thu ngân|tỷ lệ thu tiền điện|tỷ lệ thu tiền điện theo phiên|tỷ lệ không dùng tiền mặt',true],

    ['CRM','dvkh','Khách hàng & DVKH','CRM đã xử lý','%','higher','avg',2,'crm đã xử lý|tỷ lệ xử lý crm|yêu cầu crm',true],
    ['GANMOI','dvkh','Khách hàng & DVKH','Gắn mới điện kế','KH','higher','sum',0,'gắn mới điện kế|gắn mới',true],
    ['HDMBD','dvkh','Khách hàng & DVKH','HĐMBĐ ngoài sinh hoạt','HĐ','higher','sum',0,'hđmbđ ngoài sinh hoạt|hợp đồng mua bán điện ngoài sinh hoạt|hợp đồng mua bán điện',true],
    ['DV_CHUYENCHU','dvkh','Khách hàng & DVKH','HĐMBĐ chuyển chủ thể','HĐ','info','sum',0,'hđmbđ chuyển chủ thể|chuyển chủ thể',true],
    ['TC_DN','dvkh','Khách hàng & DVKH','Tiếp cận điện năng','ngày','lower','avg',2,'tiếp cận điện năng|thời gian tiếp cận điện năng',true],

    ['DX_KB','do-xa','Đo xa','Khai báo đo xa','%','higher','snapshot',2,'khai báo đo xa|điểm đo đã khai báo',true],
    ['DX_KN','do-xa','Đo xa','Kết nối đo xa','%','higher','snapshot',2,'kết nối đo xa|tỷ lệ kết nối|điểm đo kết nối',true],
    ['DX_HD','do-xa','Đo xa','Khai thác hóa đơn','%','higher','snapshot',2,'khai thác hóa đơn|tỷ lệ khai thác hệ thống đo xa|khai thác hệ thống đo xa',true],
    ['DX_MK','do-xa','Đo xa','Mất kết nối >48h','','lower','snapshot',0,'mất kết nối >48h|mất kết nối 48h|mất kết nối trên 48 giờ',true],

    ['KT_SC','ky-thuat','Kỹ thuật','Sự cố trung thế','Vụ','lower','sum',0,'sự cố lưới trung thế|sự cố trung thế',true],
    ['SAIFI','ky-thuat','Kỹ thuật','SAIFI','lần','lower','sum',4,'saifi',true],
    ['SAIDI','ky-thuat','Kỹ thuật','SAIDI','phút','lower','sum',4,'saidi',true],
    ['MAIFI','ky-thuat','Kỹ thuật','MAIFI','lần','lower','sum',4,'maifi',true],

    ['DTXD','dau-tu-tai-chinh','Đầu tư & Tài chính','ĐTXD','Tỷ đồng','higher','sum',3,'công tác đtxd|đầu tư xây dựng|đtxd',true],
    ['SCL','dau-tu-tai-chinh','Đầu tư & Tài chính','SCL','Tỷ đồng','higher','sum',3,'sửa chữa lớn|công tác scl|scl',true],
    ['TONKHO','dau-tu-tai-chinh','Đầu tư & Tài chính','Tồn kho','Tỷ đồng','lower','snapshot',3,'định mức tồn kho|tồn kho sxkd|tồn kho',true],
    ['CHIPHI','dau-tu-tai-chinh','Đầu tư & Tài chính','Chi phí định mức','đ/kWh','lower','avg',2,'chi phí định mức|chi phí 6 yếu tố|chi phí định mức (6 yếu tố)',true],

    ['CBCNV','nhan-su','Nhân sự & Văn hóa','CBCNV','Người','info','snapshot',0,'cbc nv|cbcnv|lao động sử dụng bình quân',true],
    ['DT_GIO','nhan-su','Nhân sự & Văn hóa','Giờ đào tạo','Giờ','higher','sum',2,'số giờ đào tạo|giờ đào tạo',true],
    ['NSLD_KH','nhan-su','Nhân sự & Văn hóa','KH/CBCNV','KH','higher','snapshot',0,'năng suất lao động theo khách hàng|khách hàng/lao động|kh/cbcnv',true],
    ['ATTT','nhan-su','Nhân sự & Văn hóa','ATTT','%','higher','snapshot',0,'an toàn thông tin|attt',true]
  ];

  var headers = ['KPI_ID','DOMAIN_ID','DOMAIN_NAME','LABEL','UNIT','DIRECTION','AGGREGATE','DECIMALS','ALIASES','ACTIVE'];
  var existing = sh.getDataRange().getValues();
  var existingHeaders = existing.length ? existing[0].map(String) : [];
  if (!existingHeaders.length) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    existingHeaders = headers.slice();
    existing = [headers.slice()];
  }

  var idx = {};
  existingHeaders.forEach(function(h,i){ idx[h] = i; });
  headers.forEach(function(h){ if (idx[h] === undefined) throw new Error('Thiếu cột catalog: ' + h); });

  var byId = {};
  for (var r=1; r<existing.length; r++) {
    var id = String(existing[r][idx.KPI_ID] || '');
    if (id) byId[id] = r + 1;
  }

  var inserted = 0, updated = 0;
  rows.forEach(function(src){
    var obj = {};
    headers.forEach(function(h,i){ obj[h] = src[i]; });
    var rowNo = byId[obj.KPI_ID];
    var matrix = existingHeaders.map(function(h){ return obj[h] === undefined ? '' : obj[h]; });
    if (rowNo) {
      sh.getRange(rowNo,1,1,existingHeaders.length).setValues([matrix]);
      updated++;
    } else {
      sh.appendRow(matrix);
      byId[obj.KPI_ID] = sh.getLastRow();
      inserted++;
    }
  });

  sh.setFrozenRows(1);
  return {ok:true, inserted:inserted, updated:updated, totalCatalog:sh.getLastRow()-1, diagnostic:diagnosePdfProductionV18()};
}

function diagnosePdfProductionV18() {
  var ss = SpreadsheetApp.getActive();
  var names = ['01_DM_CHITIEU','03_PDF_STAGING','04_PDF_IMPORT_LOG','05_PDF_RULES','06_KPI_HISTORY','07_PERIOD_SUMMARY'];
  var sheets = {};
  names.forEach(function(name){
    var sh = ss.getSheetByName(name);
    sheets[name] = {exists:!!sh, rows:sh ? Math.max(0, sh.getLastRow()-1) : 0};
  });

  var required = ['KD_DIENNHAN','KD_COCADIENMUA','KD_DTP','KD_DT','KD_GIA','KD_GIAMUA','KD_TT','KD_DBPT','KD_CONGTO','KD_VIPHAM','KD_TKIEM','KD_THUNGAN','DV_CHUYENCHU'];
  var catalogIds = {};
  var cat = ss.getSheetByName('01_DM_CHITIEU');
  if (cat && cat.getLastRow() > 1) {
    var values = cat.getDataRange().getValues();
    var headers = values.shift().map(String);
    var col = headers.indexOf('KPI_ID');
    values.forEach(function(row){ if (col >= 0 && row[col]) catalogIds[String(row[col])] = true; });
  }
  var missing = required.filter(function(id){ return !catalogIds[id]; });

  var periods = [];
  var hist = ss.getSheetByName('06_KPI_HISTORY');
  if (hist && hist.getLastRow() > 1) {
    var hv = hist.getDataRange().getValues();
    var hh = hv.shift().map(String);
    var pc = hh.indexOf('PERIOD');
    if (pc >= 0) periods = Array.from(new Set(hv.map(function(r){return String(r[pc]||'');}).filter(Boolean))).sort();
  }

  return {
    ok: missing.length === 0,
    apiKeyConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('API_KEY')),
    sheets: sheets,
    missingCatalogKpis: missing,
    approvedPeriods: periods,
    latestApprovedPeriod: periods.length ? periods[periods.length-1] : '',
    webAppNote: 'Sau khi cập nhật Apps Script, hãy Deploy > Manage deployments > Edit > New version > Deploy để URL /exec chạy code mới.'
  };
}
