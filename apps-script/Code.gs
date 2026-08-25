/**
 * APP ĐIỀU HÀNH SXKD - PRODUCTION BACKEND
 * Google Sheets = database; Vercel/Next.js = frontend.
 *
 * Production chỉ đọc dữ liệu PDF đã duyệt trong 06_KPI_HISTORY.
 * Không còn seed/demo/legacy bootstrap để tránh hiển thị nhầm dữ liệu cũ.
 */

const APP = {
  SHEETS: {
    PLANS: '24_KE_HOACH_GIAI_PHAP',
    CHANGELOG: '98_CHANGE_LOG',
  },
};

function doGet(e) {
  try {
    if (!isAuthorized_(e)) return json_({ ok:false, error:'Unauthorized' });
    const action = String((e && e.parameter && e.parameter.action) || 'bootstrap');
    if (action === 'health') return json_({ ok:true, app:'dieu-hanh-sxkd', mode:'production-pdf', now:new Date().toISOString() });
    if (action === 'bootstrap') return json_(getBootstrap_((e && e.parameter && e.parameter.period) || 'latest'));
    if (action === 'pdfRules') return json_({ ok:true, rules:getPdfRules_() });
    if (action === 'pdfImports') return json_({ ok:true, imports:listPdfImports_((e && e.parameter && e.parameter.limit) || 20) });
    if (action === 'pdfPeriodData') return json_({ ok:true, records:getPdfPeriodData_((e && e.parameter && e.parameter.period) || '') });
    if (action === 'pdfStaging') return json_(getPdfStaging_((e && e.parameter && e.parameter.importId) || ''));
    return json_({ ok:false, error:'Unknown action' });
  } catch (err) {
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!isAuthorizedPayload_(payload)) return json_({ ok:false, error:'Unauthorized' });
    if (payload.action === 'stagePdfImport') return json_(stagePdfImport_(payload));
    if (payload.action === 'approvePdfImport') return json_(approvePdfImportProduction_(payload));
    if (payload.action === 'correctImportedKpi') return json_(correctImportedKpi_(payload));
    if (payload.action === 'savePdfStaging') return json_(savePdfStaging_(payload));
    return json_({ ok:false, error:'Unknown action' });
  } catch (err) {
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

/**
 * Duyệt xong mới dọn các dòng của import cũ đã bị parser mới thay thế.
 * Nhờ vậy nếu phiên mới còn NEED_REVIEW/CONFLICT thì dữ liệu Production cũ vẫn nguyên vẹn.
 */
function approvePdfImportProduction_(payload) {
  const importId = String(payload.importId || '');
  const before = pdfFindObject_(PDFMOD.SHEETS.IMPORTS, 'IMPORT_ID', importId) || {};
  const supersedes = pdfSupersedesFromNote_(before.NOTE);
  const result = approvePdfImport_(payload);
  if (result && result.ok && !result.alreadyApproved && supersedes.length) {
    cleanupSupersededPdfData_(supersedes, importId);
  }
  return result;
}

function cleanupSupersededPdfData_(supersededIds, keepImportId) {
  const ids = Array.isArray(supersededIds) ? supersededIds.filter(Boolean) : [];
  if (!ids.length) return { removedHistory:0, removedSummary:0 };
  const ss = SpreadsheetApp.getActive();
  let removedHistory = 0, removedSummary = 0;

  const hist = ss.getSheetByName(PDFMOD.SHEETS.HISTORY);
  if (hist && hist.getLastRow() >= 2) {
    const headers = hist.getRange(1,1,1,hist.getLastColumn()).getValues()[0].map(String);
    const importCol = headers.indexOf('IMPORT_ID');
    const statusCol = headers.indexOf('VALUE_STATUS');
    if (importCol >= 0) {
      const matrix = hist.getRange(2,1,hist.getLastRow()-1,headers.length).getValues();
      const keep = matrix.filter(function(row){
        const oldImport = String(row[importCol] || '');
        const manual = statusCol >= 0 && String(row[statusCol] || '') === 'MANUAL_OVERRIDE';
        const remove = ids.indexOf(oldImport) >= 0 && oldImport !== keepImportId && !manual;
        if (remove) removedHistory++;
        return !remove;
      });
      if (hist.getLastRow() > 1) hist.getRange(2,1,hist.getLastRow()-1,headers.length).clearContent();
      if (keep.length) hist.getRange(2,1,keep.length,headers.length).setValues(keep);
    }
  }

  const summary = ss.getSheetByName(PDFMOD.SHEETS.SUMMARY);
  if (summary && summary.getLastRow() >= 2) {
    const headers = summary.getRange(1,1,1,summary.getLastColumn()).getValues()[0].map(String);
    const importCol = headers.indexOf('IMPORT_ID');
    if (importCol >= 0) {
      const matrix = summary.getRange(2,1,summary.getLastRow()-1,headers.length).getValues();
      const keep = matrix.filter(function(row){
        const remove = ids.indexOf(String(row[importCol] || '')) >= 0;
        if (remove) removedSummary++;
        return !remove;
      });
      if (summary.getLastRow() > 1) summary.getRange(2,1,summary.getLastRow()-1,headers.length).clearContent();
      if (keep.length) summary.getRange(2,1,keep.length,headers.length).setValues(keep);
    }
  }
  SpreadsheetApp.flush();
  return { removedHistory:removedHistory, removedSummary:removedSummary };
}

function getBootstrap_(period) {
  if (typeof getImportedBootstrap_ !== 'function') return { ok:false, error:'Thiếu module PdfImport.gs' };
  const imported = getImportedBootstrap_(period);
  if (imported) return imported;
  return {
    ok:false,
    error:'Chưa có dữ liệu PDF đã duyệt trong 06_KPI_HISTORY.',
    dataMode:'apps-script',
    availablePeriods:[],
  };
}

function appendObjects_(sheetName, rows) {
  if (!rows || !rows.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error('Không tìm thấy sheet ' + sheetName);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const matrix = rows.map(function(obj){ return headers.map(function(h){ return obj[h] === undefined ? '' : obj[h]; }); });
  sh.getRange(sh.getLastRow()+1,1,matrix.length,headers.length).setValues(matrix);
}

function readObjects_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.filter(function(row){ return row.some(function(v){ return v !== ''; }); }).map(function(row){
    const o = {};
    headers.forEach(function(h,i){ o[h] = row[i]; });
    return o;
  });
}

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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
