/**
 * APP ĐIỀU HÀNH SXKD - HYBRID BACKEND V1
 * Google Sheets = database; Vercel/Next.js = frontend.
 *
 * Luồng V1:
 * 1) Chạy setupDatabase()
 * 2) Chạy seedJuly2026FromTwoPdfs()
 * 3) Deploy Apps Script dạng Web App (Execute as: Me)
 * 4) Dán URL /exec vào biến APPS_SCRIPT_API_URL trên Vercel
 */

const APP = {
  PERIOD: '2026-07',
  REPORTING_DATE: '31/07/2026',
  SOURCE_LABEL: 'PL1 chỉ tiêu 7/2026 + Báo cáo ĐHSX kỳ họp 8/2026',
  SHEETS: {
    CONFIG: '00_CONFIG',
    KPI: '02_KPI_THANG',
    REVIEW: '03_PDF_REVIEW',
    RELIABILITY: '17_DO_TIN_CAY',
    INCIDENTS: '16_SU_CO',
    PLANS: '24_KE_HOACH_GIAI_PHAP',
    ALERTS: '90_CANH_BAO',
    CHANGELOG: '98_CHANGE_LOG',
  },
};

function doGet(e) {
  try {
    if (!isAuthorized_(e)) return json_({ ok: false, error: 'Unauthorized' });
    const action = String((e && e.parameter && e.parameter.action) || 'bootstrap');
    if (action === 'health') return json_({ ok: true, app: 'dieu-hanh-sxkd', now: new Date().toISOString() });
    if (action === 'bootstrap') return json_(getBootstrap_((e && e.parameter && e.parameter.period) || APP.PERIOD));
    if (action === 'pdfRules') return json_({ ok:true, rules:getPdfRules_() });
    if (action === 'pdfImports') return json_({ ok:true, imports:listPdfImports_((e && e.parameter && e.parameter.limit) || 10) });
    if (action === 'pdfPeriodData') return json_({ ok:true, records:getPdfPeriodData_((e && e.parameter && e.parameter.period) || '') });
    if (action === 'pdfStaging') return json_(getPdfStaging_((e && e.parameter && e.parameter.importId) || ''));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!isAuthorizedPayload_(payload)) return json_({ ok: false, error: 'Unauthorized' });
    if (payload.action === 'correctKpi') return json_(correctKpi_(payload));
    if (payload.action === 'stagePdfImport') return json_(stagePdfImport_(payload));
    if (payload.action === 'approvePdfImport') return json_(approvePdfImport_(payload));
    if (payload.action === 'correctImportedKpi') return json_(correctImportedKpi_(payload));
    if (payload.action === 'savePdfStaging') return json_(savePdfStaging_(payload));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setupDatabase() {
  const defs = {};
  defs[APP.SHEETS.CONFIG] = ['KEY', 'VALUE', 'NOTE'];
  defs[APP.SHEETS.KPI] = ['ROW_KEY','PERIOD','GROUP_ID','GROUP_NAME','KPI_ID','LABEL','VALUE','DETAIL','PLAN','TONE','STATUS','IS_HEADLINE','SOURCE_PAGE'];
  defs[APP.SHEETS.REVIEW] = ['ID','PERIOD','LABEL','SOURCE_A','VALUE_A','SOURCE_B','VALUE_B','RECOMMENDATION','STATUS'];
  defs[APP.SHEETS.RELIABILITY] = ['PERIOD','ID','UNIT','TARGET_YEAR','TARGET_PERIOD','MONTH','YTD','STATUS'];
  defs[APP.SHEETS.INCIDENTS] = ['PERIOD','CAUSE','MONTH_VALUE','MONTH_SHARE','YTD_VALUE','YTD_SHARE'];
  defs[APP.SHEETS.PLANS] = ['ID','PERIOD','OWNER','TITLE','STATUS','NOTE'];
  defs[APP.SHEETS.ALERTS] = ['ID','PERIOD','TITLE','CURRENT','TARGET','NOTE','DOMAIN','SEVERITY','SOURCE_PAGE'];
  defs[APP.SHEETS.CHANGELOG] = ['TIMESTAMP','USER','ROW_KEY','FIELD','OLD_VALUE','NEW_VALUE','REASON'];

  const ss = SpreadsheetApp.getActive();
  Object.keys(defs).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.clear();
    sh.getRange(1, 1, 1, defs[name].length).setValues([defs[name]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, defs[name].length).setFontWeight('bold');
  });

  writeConfig_({
    CURRENT_PERIOD: APP.PERIOD,
    REPORTING_DATE: APP.REPORTING_DATE,
    SOURCE_LABEL: APP.SOURCE_LABEL,
    KPI_TOTAL: 66,
    KPI_PASS: 60,
    KPI_PARTIAL: 2,
    KPI_FAIL: 4,
  });
}

function seedJuly2026FromTwoPdfs() {
  setupDatabase();

  const kpiRows = [
    kpi_('I','Kinh doanh','KD_DTP','Điện thương phẩm','1.041,607 Tr.kWh','Tháng 7: 165,479','KH năm: 1.613 Tr.kWh · 64,54%','good','Đạt',true,1),
    kpi_('I','Kinh doanh','KD_DT','Doanh thu','2.361,42 tỷ','Tháng 7: 376,54 tỷ','KH năm: 3.647,667 tỷ · 64,73%','good','Đạt',true,1),
    kpi_('I','Kinh doanh','KD_GIA','Giá bán điện BQ','2.264,64 đ/kWh','Tháng 7: 2.272,52','KH trong BC tổng hợp: 2.259','good','Đạt',false,1),
    kpi_('I','Kinh doanh','KD_TT','Tổn thất','2,90%','Tháng 7: 2,53%','KH ≤ 3,12%','good','Đạt',true,1),

    kpi_('II','Khách hàng & DVKH','CRM','CRM đã xử lý','4.574 / 4.693','Còn 119 đang xử lý','Tỷ lệ xử lý: 97,46%','good','97,46%',false,3),
    kpi_('II','Khách hàng & DVKH','GANMOI','Gắn mới điện kế','710','Lũy kế 4.338 · 1,894 ngày BQ','Không có trường hợp quá hạn','good','Không có quá hạn',false,3),
    kpi_('II','Khách hàng & DVKH','HDMBD','HĐMBĐ ngoài sinh hoạt','2.092 / 8.081','25,9% KH','Không đạt','bad','Không đạt',false,2),
    kpi_('II','Khách hàng & DVKH','TC_DN','Tiếp cận điện năng','2,57 ngày','51 công trình lũy kế','Mục tiêu ≤ 3 ngày','good','Đạt',false,5),

    kpi_('III','Đo xa','DX_KB','Khai báo đo xa','99,50%','220.767 / 221.867','', 'good','Tốt',false,6),
    kpi_('III','Đo xa','DX_KN','Kết nối đo xa','98,20%','216.796 điểm kết nối','220.767 điểm đã khai báo','warn','Theo dõi',true,6),
    kpi_('III','Đo xa','DX_HD','Khai thác hóa đơn','98,23%','203.494 điểm','', 'warn','Theo dõi',false,6),
    kpi_('III','Đo xa','DX_MK','Mất kết nối >48h','3.678','Theo dõi theo hãng công tơ','', 'warn','Cần xử lý',false,6),

    kpi_('IV','Kỹ thuật','KT_SC','Sự cố trung thế','79 / 61,25','Tháng 7: 15 vụ','Không đạt chỉ tiêu 7T','bad','Không đạt 7T',false,8),
    kpi_('IV','Kỹ thuật','SAIFI','SAIFI','1,6288','KH 7T: 1,71','', 'good','Đạt',false,9),
    kpi_('IV','Kỹ thuật','SAIDI','SAIDI','199,9833','KH 7T: 223,42 phút','', 'good','Đạt',false,10),
    kpi_('IV','Kỹ thuật','MAIFI','MAIFI','0,0428','KH 7T: 0,29','', 'good','Đạt',false,10),

    kpi_('V','Đầu tư & Tài chính','DTXD','ĐTXD','34,3%','97,064 / 283,200 tỷ','Giải ngân 47,482 tỷ · 16,8%','bad','Không đạt',true,12),
    kpi_('V','Đầu tư & Tài chính','SCL','SCL','81,03%','29,712 / 36,669 tỷ','Đánh giá tổng hợp: không đạt','bad','Không đạt tiến độ',false,13),
    kpi_('V','Đầu tư & Tài chính','TONKHO','Tồn kho','16,069 tỷ','Định mức 21,8 tỷ · 73%','Không vượt định mức','good','Trong định mức',false,14),
    kpi_('V','Đầu tư & Tài chính','CHIPHI','Chi phí định mức','19,38 đ/kWh','KH: 17,47 đ/kWh','Tăng 1,91 đ/kWh','bad','Không đạt',false,15),

    kpi_('VI','Nhân sự & Văn hóa','CBCNV','CBCNV','355','297 nam · 58 nữ','', 'neutral','Thông tin',false,16),
    kpi_('VI','Nhân sự & Văn hóa','DT_GIO','Giờ đào tạo','41,69 giờ/LĐ','KH ≥ 40 · 104,23%','', 'good','Đạt',false,16),
    kpi_('VI','Nhân sự & Văn hóa','NSLD_KH','KH/CBCNV','625 / 637','98% chỉ tiêu','', 'bad','Chưa đạt',false,16),
    kpi_('VI','Nhân sự & Văn hóa','ATTT','ATTT','100%','Phổ biến quy trình, ứng cứu','', 'good','Đạt',false,5),
  ];
  appendObjects_(APP.SHEETS.KPI, kpiRows);

  appendObjects_(APP.SHEETS.RELIABILITY, [
    { PERIOD: APP.PERIOD, ID: 'SAIFI', UNIT: 'lần', TARGET_YEAR: 2.93, TARGET_PERIOD: 1.71, MONTH: 0.2512, YTD: 1.6288, STATUS: 'Đạt' },
    { PERIOD: APP.PERIOD, ID: 'SAIDI', UNIT: 'phút', TARGET_YEAR: 383, TARGET_PERIOD: 223.42, MONTH: 35.8221, YTD: 199.9833, STATUS: 'Đạt' },
    { PERIOD: APP.PERIOD, ID: 'MAIFI', UNIT: 'lần', TARGET_YEAR: 0.5, TARGET_PERIOD: 0.29, MONTH: 0, YTD: 0.0428, STATUS: 'Đạt' },
  ]);

  appendObjects_(APP.SHEETS.INCIDENTS, [
    incident_('Sét',6,40,27,34.18),
    incident_('Động vật',4,26.67,19,24.05),
    incident_('Phóng sứ thiết bị',0,0,7,8.86),
    incident_('Hư VTTB khách hàng',0,0,7,8.86),
    incident_('Cây',3,20,4,5.06),
  ]);

  appendObjects_(APP.SHEETS.ALERTS, [
    alert_('A_SC','Sự cố lưới trung thế vượt chỉ tiêu 7 tháng','79 vụ','≤ 61,25 vụ','Báo cáo đánh giá không đạt chỉ tiêu 7T.','Kỹ thuật','red',8),
    alert_('A_BT','Bảo trì TBĐĐ không đạt tiến độ','3.412 / 12.422 và 5.611 / 37.196','Theo KH năm','Báo cáo tổng hợp đánh giá Không đạt.','Kinh doanh','red',2),
    alert_('A_VP','Kiểm tra xử lý vi phạm sử dụng điện','3.752 kWh','90.000 kWh','Mức thực hiện 4,1%; báo cáo đánh giá Không đạt.','Kinh doanh','red',2),
    alert_('A_DTXD','Công tác ĐTXD chưa đạt tiến độ','34,3% giá trị KH năm','283,200 tỷ','Giải ngân lũy kế 47,482 tỷ, tương ứng 16,8%.','ĐTXD','red',12),
    alert_('A_SCL','Công tác SCL chưa đạt tiến độ','81,03% giá trị thực hiện','36,669 tỷ','Phần đánh giá tổng hợp xếp SCL là không đạt.','SCL','red',13),
    alert_('A_HD','HĐMBĐ hết hiệu lực đạt một phần','Ngoài sinh hoạt: 2.092 / 8.081','Hoàn thành kế hoạch','HĐMBĐ ngoài sinh hoạt không đạt.','DVKH','yellow',2),
    alert_('A_NS','Năng suất lao động đạt một phần','625 KH/CBCNV','637 KH/CBCNV','Chỉ tiêu khách hàng/CBCNV chưa đạt.','Nhân sự','yellow',16),
  ]);

  appendObjects_(APP.SHEETS.REVIEW, [
    { ID:'C_GIA', PERIOD:APP.PERIOD, LABEL:'Kế hoạch giá bán điện bình quân', SOURCE_A:'PL1 chỉ tiêu 21', VALUE_A:'2.295 đ/kWh', SOURCE_B:'BC ĐHSX – bảng SXKD chính', VALUE_B:'2.259 đ/kWh', RECOMMENDATION:'Không tự chọn. Xác nhận nguồn kế hoạch ưu tiên trước khi ghi DB chính.', STATUS:'NEED_REVIEW' },
    { ID:'C_TKD', PERIOD:APP.PERIOD, LABEL:'Lũy kế tiết kiệm điện', SOURCE_A:'PL1 chỉ tiêu 2', VALUE_A:'74,13 Tr.kWh', SOURCE_B:'BC ĐHSX – chỉ tiêu SXKD', VALUE_B:'74,40 Tr.kWh', RECOMMENDATION:'Giữ cả hai ở staging và duyệt một giá trị cuối.', STATUS:'NEED_REVIEW' },
  ]);

  appendObjects_(APP.SHEETS.PLANS, [
    plan_('P1','Đội QLHTĐĐ','Tiếp tục kế hoạch kiện toàn hệ thống đo đếm, đẩy nhanh kiểm tra niêm chì và bảo trì công tơ/SCL HTĐĐ.'),
    plan_('P2','Đội QLVH','Phối hợp lắp đặt thiết bị đóng cắt SCADA; kiểm tra Accu Recloser; lập phương án cấp điện phục vụ 2/9.'),
    plan_('P3','Phòng KTAT / Đội QLLĐ','Theo dõi tải TBA, xử lý non/quá tải và kiểm tra các phát tuyến/TBA có tổn thất cao.'),
    plan_('P4','Khối ĐTXD','Theo dõi phương án ĐTXD 2027, triển khai xây lắp 2026 và lắp đặt thiết bị tự động hóa.'),
    plan_('P5','Phòng KD / QLHTĐĐ','Gắn mới, di dời công tơ và xử lý khiếu nại liên quan chỉ số, không để trường hợp quá hạn.'),
  ]);
}

function getBootstrap_(period) {
  try {
    if (typeof getImportedBootstrap_ === 'function') {
      const imported = getImportedBootstrap_(period);
      if (imported) return imported;
    }
  } catch (err) { console.warn('Imported bootstrap fallback', err); }
  return getLegacyBootstrap_();
}

function getLegacyBootstrap_() {
  const cfg = readConfig_();
  const allKpis = readObjects_(APP.SHEETS.KPI).filter(r => String(r.PERIOD) === APP.PERIOD);
  const groups = {};
  allKpis.forEach(r => {
    const name = String(r.GROUP_NAME || 'Khác');
    if (!groups[name]) groups[name] = [];
    groups[name].push({
      id: String(r.KPI_ID), label: String(r.LABEL), value: String(r.VALUE), detail: String(r.DETAIL || ''), plan: String(r.PLAN || ''),
      tone: String(r.TONE || 'neutral'), status: String(r.STATUS || ''), sourcePage: Number(r.SOURCE_PAGE || 0) || undefined,
    });
  });

  return {
    ok: true,
    period: String(cfg.CURRENT_PERIOD || APP.PERIOD),
    reportingDate: String(cfg.REPORTING_DATE || APP.REPORTING_DATE),
    dataMode: 'apps-script',
    sourceLabel: String(cfg.SOURCE_LABEL || APP.SOURCE_LABEL),
    summary: { total:Number(cfg.KPI_TOTAL||66), pass:Number(cfg.KPI_PASS||60), partial:Number(cfg.KPI_PARTIAL||2), fail:Number(cfg.KPI_FAIL||4) },
    headline: allKpis.filter(r => truthy_(r.IS_HEADLINE)).map(r => ({
      id:String(r.KPI_ID), label:String(r.LABEL), value:String(r.VALUE), detail:String(r.DETAIL||''), plan:String(r.PLAN||''), tone:String(r.TONE||'neutral'), status:String(r.STATUS||''), sourcePage:Number(r.SOURCE_PAGE||0)||undefined,
    })),
    fields: Object.keys(groups).map((name, i) => ({ id: 'g'+(i+1), title:name, items:groups[name] })),
    reliability: readObjects_(APP.SHEETS.RELIABILITY).map(r => ({ id:String(r.ID), unit:String(r.UNIT), targetYear:Number(r.TARGET_YEAR), targetPeriod:Number(r.TARGET_PERIOD), month:Number(r.MONTH), ytd:Number(r.YTD), status:String(r.STATUS) })),
    incidentCauses: readObjects_(APP.SHEETS.INCIDENTS).map(r => ({ label:String(r.CAUSE), monthValue:Number(r.MONTH_VALUE), monthShare:Number(r.MONTH_SHARE), ytdValue:Number(r.YTD_VALUE), ytdShare:Number(r.YTD_SHARE) })),
    alerts: readObjects_(APP.SHEETS.ALERTS).map(r => ({ id:String(r.ID), title:String(r.TITLE), current:String(r.CURRENT), target:String(r.TARGET||''), note:String(r.NOTE||''), domain:String(r.DOMAIN||''), severity:String(r.SEVERITY||'yellow'), sourcePage:Number(r.SOURCE_PAGE||0)||undefined })),
    conflicts: readObjects_(APP.SHEETS.REVIEW).filter(r => String(r.STATUS)!=='RESOLVED').map(r => ({ id:String(r.ID), label:String(r.LABEL), sourceA:String(r.SOURCE_A), valueA:String(r.VALUE_A), sourceB:String(r.SOURCE_B), valueB:String(r.VALUE_B), recommendation:String(r.RECOMMENDATION) })),
    plans: readObjects_(APP.SHEETS.PLANS).map(r => ({ id:String(r.ID), owner:String(r.OWNER), title:String(r.TITLE), status:String(r.STATUS), note:String(r.NOTE||'') })),
    notes: [
      'Không tạo chuỗi T1–T6 cho KPI nếu PDF hiện tại không cung cấp trực tiếp.',
      'Sai khác giữa các PDF được giữ ở 03_PDF_REVIEW để người dùng xác nhận.',
    ],
  };
}

function correctKpi_(payload) {
  const rowKey = String(payload.rowKey || '');
  const field = String(payload.field || 'VALUE').toUpperCase();
  const allowed = ['VALUE','DETAIL','PLAN','STATUS','TONE'];
  if (!rowKey || allowed.indexOf(field) < 0) throw new Error('Invalid correction request');

  const sh = SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.KPI);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const keyCol = headers.indexOf('ROW_KEY');
  const fieldCol = headers.indexOf(field);
  if (keyCol < 0 || fieldCol < 0) throw new Error('Sheet schema mismatch');

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][keyCol]) === rowKey) {
      const oldValue = values[r][fieldCol];
      sh.getRange(r + 1, fieldCol + 1).setValue(payload.newValue);
      const log = SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CHANGELOG);
      log.appendRow([new Date(), Session.getActiveUser().getEmail() || 'web-api', rowKey, field, oldValue, payload.newValue, payload.reason || 'Manual correction']);
      return { ok: true, rowKey: rowKey, field: field, oldValue: oldValue, newValue: payload.newValue };
    }
  }
  throw new Error('ROW_KEY not found: ' + rowKey);
}

function kpi_(groupId, groupName, id, label, value, detail, plan, tone, status, headline, page) {
  return { ROW_KEY: APP.PERIOD + '|' + id, PERIOD:APP.PERIOD, GROUP_ID:groupId, GROUP_NAME:groupName, KPI_ID:id, LABEL:label, VALUE:value, DETAIL:detail, PLAN:plan, TONE:tone, STATUS:status, IS_HEADLINE:headline, SOURCE_PAGE:page };
}
function incident_(cause, mv, ms, yv, ys) { return { PERIOD:APP.PERIOD, CAUSE:cause, MONTH_VALUE:mv, MONTH_SHARE:ms, YTD_VALUE:yv, YTD_SHARE:ys }; }
function alert_(id,title,current,target,note,domain,severity,page) { return { ID:id, PERIOD:APP.PERIOD, TITLE:title, CURRENT:current, TARGET:target, NOTE:note, DOMAIN:domain, SEVERITY:severity, SOURCE_PAGE:page }; }
function plan_(id,owner,title) { return { ID:id, PERIOD:'2026-08', OWNER:owner, TITLE:title, STATUS:'Kế hoạch tháng 8', NOTE:'' }; }

function appendObjects_(sheetName, rows) {
  if (!rows || !rows.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const matrix = rows.map(obj => headers.map(h => obj[h] === undefined ? '' : obj[h]));
  sh.getRange(sh.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
  sh.autoResizeColumns(1, headers.length);
}

function readObjects_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.filter(row => row.some(v => v !== '')).map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}

function writeConfig_(obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CONFIG);
  const rows = Object.keys(obj).map(k => [k, obj[k], '']);
  sh.getRange(2,1,rows.length,3).setValues(rows);
}
function readConfig_() {
  const rows = readObjects_(APP.SHEETS.CONFIG);
  const out = {};
  rows.forEach(r => out[String(r.KEY)] = r.VALUE);
  return out;
}
function truthy_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1'; }
function isAuthorized_(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) return false;
  return String((e && e.parameter && e.parameter.apiKey) || '') === expected;
}
function isAuthorizedPayload_(payload) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) return false;
  return String(payload.apiKey || '') === expected;
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
