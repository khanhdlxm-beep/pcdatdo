/**
 * V1.8 Production repair utility
 * - Chuẩn hóa PERIOD về yyyy-MM (Google Sheets có thể tự đổi 2026-07 thành Date)
 * - Sửa ROW_KEY/ROW_ID bị kéo theo giá trị Date
 * - Đặt cột PERIOD ở dạng Plain text để các lần import sau không tái diễn
 * - Dọn các import APPROVED rỗng (TOTAL = 0) do phiên test trước đây
 *
 * Chạy 1 lần: repairPdfPeriodsV18()
 */
function repairPdfPeriodsV18() {
  if (typeof setupPdfImportModule === 'function') setupPdfImportModule();
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';

  function periodKey_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return Utilities.formatDate(value, tz, 'yyyy-MM');
    }
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    const m = raw.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (m) return m[1] + '-' + m[2];
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy-MM');
    return raw;
  }

  function headerMap_(sh) {
    if (!sh || sh.getLastRow() < 1) return {};
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const map = {};
    headers.forEach(function (h, i) { map[h] = i + 1; });
    return map;
  }

  function normalizeSheetPeriod_(sheetName, keyHeader, kpiHeader) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return { sheet: sheetName, rows: 0, changed: 0 };
    const map = headerMap_(sh);
    if (!map.PERIOD) return { sheet: sheetName, rows: sh.getLastRow() - 1, changed: 0 };

    sh.getRange(2, map.PERIOD, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');

    const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    let changed = 0;
    for (let i = 0; i < values.length; i++) {
      const p = periodKey_(values[i][map.PERIOD - 1]);
      const oldP = values[i][map.PERIOD - 1];
      if (p && String(oldP) !== p) {
        sh.getRange(i + 2, map.PERIOD).setNumberFormat('@').setValue(p);
        changed++;
      }

      if (keyHeader && map[keyHeader] && p) {
        const keyCol = map[keyHeader];
        const oldKey = String(values[i][keyCol - 1] || '');
        let newKey = oldKey;
        if (kpiHeader && map[kpiHeader]) {
          const kpi = String(values[i][map[kpiHeader] - 1] || '').trim();
          if (kpi) newKey = p + '|' + kpi;
        } else if (oldKey.indexOf('|') >= 0) {
          newKey = p + oldKey.slice(oldKey.indexOf('|'));
        }
        if (newKey && newKey !== oldKey) {
          sh.getRange(i + 2, keyCol).setNumberFormat('@').setValue(newKey);
          changed++;
        }
      }
    }
    return { sheet: sheetName, rows: values.length, changed: changed };
  }

  const report = [];
  report.push(normalizeSheetPeriod_('03_PDF_STAGING', 'ROW_ID', null));
  report.push(normalizeSheetPeriod_('04_PDF_IMPORT_LOG', null, null));
  report.push(normalizeSheetPeriod_('06_KPI_HISTORY', 'ROW_KEY', 'KPI_ID'));
  report.push(normalizeSheetPeriod_('07_PERIOD_SUMMARY', null, null));

  // Dọn các import APPROVED nhưng TOTAL = 0. Đây là các phiên test rỗng,
  // không có KPI_HISTORY tương ứng và có thể làm người dùng hiểu nhầm là đã cập nhật.
  const importSh = ss.getSheetByName('04_PDF_IMPORT_LOG');
  const emptyImportIds = [];
  if (importSh && importSh.getLastRow() >= 2) {
    const map = headerMap_(importSh);
    const vals = importSh.getRange(2, 1, importSh.getLastRow() - 1, importSh.getLastColumn()).getValues();
    const deleteRows = [];
    vals.forEach(function (row, index) {
      const status = map.STATUS ? String(row[map.STATUS - 1] || '') : '';
      const total = map.TOTAL ? Number(row[map.TOTAL - 1] || 0) : 0;
      if (status === 'APPROVED' && total === 0) {
        if (map.IMPORT_ID) emptyImportIds.push(String(row[map.IMPORT_ID - 1] || ''));
        deleteRows.push(index + 2);
      }
    });
    deleteRows.sort(function (a, b) { return b - a; }).forEach(function (r) { importSh.deleteRow(r); });
    report.push({ sheet: '04_PDF_IMPORT_LOG', removedEmptyApproved: deleteRows.length });
  }

  // Xóa summary trỏ vào import rỗng đã dọn.
  const summarySh = ss.getSheetByName('07_PERIOD_SUMMARY');
  if (summarySh && summarySh.getLastRow() >= 2 && emptyImportIds.length) {
    const map = headerMap_(summarySh);
    if (map.IMPORT_ID) {
      const vals = summarySh.getRange(2, 1, summarySh.getLastRow() - 1, summarySh.getLastColumn()).getValues();
      const deleteRows = [];
      vals.forEach(function (row, index) {
        if (emptyImportIds.indexOf(String(row[map.IMPORT_ID - 1] || '')) >= 0) deleteRows.push(index + 2);
      });
      deleteRows.sort(function (a, b) { return b - a; }).forEach(function (r) { summarySh.deleteRow(r); });
      report.push({ sheet: '07_PERIOD_SUMMARY', removedEmptySummary: deleteRows.length });
    }
  }

  SpreadsheetApp.flush();
  console.log(JSON.stringify({ ok: true, report: report }, null, 2));
  return { ok: true, report: report };
}

/** Kiểm tra nhanh sau repair. Không sửa dữ liệu. */
function auditPdfPeriodsV18() {
  const ss = SpreadsheetApp.getActive();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';
  const out = {};
  ['03_PDF_STAGING', '04_PDF_IMPORT_LOG', '06_KPI_HISTORY', '07_PERIOD_SUMMARY'].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) { out[name] = []; return; }
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const pCol = headers.indexOf('PERIOD');
    if (pCol < 0) { out[name] = []; return; }
    const values = sh.getRange(2, pCol + 1, Math.min(20, sh.getLastRow() - 1), 1).getValues();
    out[name] = values.map(function (r) {
      const v = r[0];
      return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM') + ' [DATE]' : String(v || '');
    });
  });
  console.log(JSON.stringify(out, null, 2));
  return out;
}
