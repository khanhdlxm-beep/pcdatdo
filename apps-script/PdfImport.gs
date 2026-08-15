/**
 * V1.6.0 - PDF IMPORT CENTER
 * PDF gốc được đọc tại browser bằng PDF.js. Apps Script chỉ nhận text/staging đã chuẩn hóa.
 * Không gọi AI trả phí.
 */
const PDFMOD = {
  SHEETS: {
    CATALOG: '01_DM_CHITIEU',
    STAGING: '03_PDF_STAGING',
    IMPORTS: '04_PDF_IMPORT_LOG',
    RULES: '05_PDF_RULES',
    HISTORY: '06_KPI_HISTORY',
    SUMMARY: '07_PERIOD_SUMMARY',
  },
  HEADERS: {
    CATALOG: ['KPI_ID','DOMAIN_ID','DOMAIN_NAME','LABEL','UNIT','DIRECTION','AGGREGATE','DECIMALS','ALIASES','ACTIVE'],
    STAGING: ['IMPORT_ID','ROW_ID','PERIOD','DOC_TYPE','KPI_ID','DOMAIN_ID','LABEL','UNIT','SOURCE_LABEL','ACTUAL_MONTH','PLAN_MONTH','ACTUAL_YTD','PLAN_YTD','PLAN_YEAR','SAME_PERIOD_MONTH','SAME_PERIOD_YTD','STATUS_TEXT','CONFIDENCE','SOURCE_FILE','SOURCE_PAGE','SOURCE_EXCERPT','REVIEW_STATUS','ISSUES','REMEMBER_ALIAS','RAW_VALUES_JSON','CONFLICTS_JSON','REVIEW_NOTE','REVIEWED_BY','REVIEWED_AT','CREATED_AT','UPDATED_AT'],
    IMPORTS: ['IMPORT_ID','PERIOD','FILES','FINGERPRINTS','STATUS','TOTAL','AUTO_OK','NEED_REVIEW','CONFLICT','UNMAPPED','SUMMARY_JSON','CREATED_AT','APPROVED_AT','APPROVED_BY','NOTE'],
    RULES: ['RULE_ID','TYPE','SOURCE_PATTERN','KPI_ID','FIELD','VALUE','ACTION','ACTIVE','CREATED_AT','CREATED_BY'],
    HISTORY: ['ROW_KEY','PERIOD','KPI_ID','DOMAIN_ID','LABEL','UNIT','ACTUAL_MONTH','PLAN_MONTH','ACTUAL_YTD','PLAN_YTD','PLAN_YEAR','SAME_PERIOD_MONTH','SAME_PERIOD_YTD','STATUS','TONE','VALUE_STATUS','IMPORT_ID','SOURCE_FILE','SOURCE_PAGE','UPDATED_AT'],
    SUMMARY: ['PERIOD','TOTAL','PASS','PARTIAL','FAIL','IMPORT_ID','UPDATED_AT'],
  },
};

function setupPdfImportModule() {
  const ss = SpreadsheetApp.getActive();
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.CATALOG, PDFMOD.HEADERS.CATALOG);
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.STAGING, PDFMOD.HEADERS.STAGING);
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.IMPORTS, PDFMOD.HEADERS.IMPORTS);
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.RULES, PDFMOD.HEADERS.RULES);
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.HISTORY, PDFMOD.HEADERS.HISTORY);
  pdfEnsureSheet_(ss, PDFMOD.SHEETS.SUMMARY, PDFMOD.HEADERS.SUMMARY);
  if (typeof APP !== 'undefined' && APP.SHEETS && APP.SHEETS.CHANGELOG) pdfEnsureSheet_(ss, APP.SHEETS.CHANGELOG, ['TIMESTAMP','USER','ROW_KEY','FIELD','OLD_VALUE','NEW_VALUE','REASON']);
  pdfSeedCatalog_();
  return { ok:true, sheets:Object.keys(PDFMOD.SHEETS).map(function(k){ return PDFMOD.SHEETS[k]; }) };
}

function setupPdfParallelReviewModule(){
  const result=setupPdfImportModule();
  pdfConfigureParallelReviewSheet_();
  return {ok:true,version:'1.7.0',sheets:result.sheets,sheetUrl:pdfStagingSheetUrl_()};
}

function pdfSeedCatalog_() {
  const rows = [
    ['KD_DTP','kinh-doanh','Kinh doanh','Điện thương phẩm','Tr.kWh','higher','sum',3,'sản lượng điện thương phẩm|điện thương phẩm',true],
    ['KD_DT','kinh-doanh','Kinh doanh','Doanh thu','tỷ','higher','sum',2,'tổng doanh thu|doanh thu',true],
    ['KD_GIA','kinh-doanh','Kinh doanh','Giá bán điện bình quân','đ/kWh','higher','avg',2,'giá bán điện bình quân|giá bán điện bq',true],
    ['KD_TT','kinh-doanh','Kinh doanh','Tổn thất điện năng','%','lower','avg',2,'tổn thất điện năng|tổn thất',true],
    ['CRM','dvkh','Khách hàng & DVKH','CRM đã xử lý','%','higher','avg',2,'crm đã xử lý|tỷ lệ xử lý crm|yêu cầu crm',true],
    ['GANMOI','dvkh','Khách hàng & DVKH','Gắn mới điện kế','KH','higher','sum',0,'gắn mới điện kế|gắn mới',true],
    ['HDMBD','dvkh','Khách hàng & DVKH','HĐMBĐ ngoài sinh hoạt','HĐ','higher','sum',0,'hđmbđ ngoài sinh hoạt|hợp đồng mua bán điện ngoài sinh hoạt',true],
    ['TC_DN','dvkh','Khách hàng & DVKH','Tiếp cận điện năng','ngày','lower','avg',2,'tiếp cận điện năng|thời gian tiếp cận điện năng',true],
    ['DX_KB','do-xa','Đo xa','Khai báo đo xa','%','higher','snapshot',2,'khai báo đo xa|điểm đo đã khai báo',true],
    ['DX_KN','do-xa','Đo xa','Kết nối đo xa','%','higher','snapshot',2,'kết nối đo xa|tỷ lệ kết nối|điểm đo kết nối',true],
    ['DX_HD','do-xa','Đo xa','Khai thác hóa đơn','%','higher','snapshot',2,'khai thác hóa đơn|tỷ lệ khai thác hệ thống đo xa|khai thác hệ thống đo xa',true],
    ['DX_MK','do-xa','Đo xa','Mất kết nối >48h','điểm','lower','snapshot',0,'mất kết nối >48h|mất kết nối 48h|mất kết nối trên 48 giờ',true],
    ['KT_SC','ky-thuat','Kỹ thuật','Sự cố trung thế','vụ','lower','sum',0,'sự cố lưới trung thế|sự cố trung thế',true],
    ['SAIFI','ky-thuat','Kỹ thuật','SAIFI','lần','lower','sum',4,'saifi',true],
    ['SAIDI','ky-thuat','Kỹ thuật','SAIDI','phút','lower','sum',4,'saidi',true],
    ['MAIFI','ky-thuat','Kỹ thuật','MAIFI','lần','lower','sum',4,'maifi',true],
    ['DTXD','dau-tu-tai-chinh','Đầu tư & Tài chính','ĐTXD','tỷ','higher','sum',3,'công tác đtxd|đầu tư xây dựng|đtxd',true],
    ['SCL','dau-tu-tai-chinh','Đầu tư & Tài chính','SCL','tỷ','higher','sum',3,'sửa chữa lớn|công tác scl|scl',true],
    ['TONKHO','dau-tu-tai-chinh','Đầu tư & Tài chính','Tồn kho','tỷ','lower','snapshot',3,'định mức tồn kho|tồn kho sxkd|tồn kho',true],
    ['CHIPHI','dau-tu-tai-chinh','Đầu tư & Tài chính','Chi phí định mức','đ/kWh','lower','avg',2,'chi phí định mức|chi phí 6 yếu tố',true],
    ['CBCNV','nhan-su','Nhân sự & Văn hóa','CBCNV','người','info','snapshot',0,'cbcnv|lao động sử dụng bình quân',true],
    ['DT_GIO','nhan-su','Nhân sự & Văn hóa','Giờ đào tạo','giờ/LĐ','higher','sum',2,'số giờ đào tạo|giờ đào tạo',true],
    ['NSLD_KH','nhan-su','Nhân sự & Văn hóa','KH/CBCNV','KH/CBCNV','higher','snapshot',0,'năng suất lao động theo khách hàng|khách hàng/lao động|kh/cbcnv',true],
    ['ATTT','nhan-su','Nhân sự & Văn hóa','ATTT','%','higher','snapshot',0,'an toàn thông tin|attt',true],
  ];
  const sh = SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.CATALOG);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

function getPdfRules_() {
  setupPdfImportModule();
  return readObjects_(PDFMOD.SHEETS.RULES).filter(function(r){ return pdfTruthy_(r.ACTIVE); }).map(function(r){ return { sourcePattern:String(r.SOURCE_PATTERN||''), kpiId:String(r.KPI_ID||'') }; });
}

function listPdfImports_(limit) {
  setupPdfImportModule();
  const rows = readObjects_(PDFMOD.SHEETS.IMPORTS).reverse().slice(0, Math.max(1, Math.min(Number(limit)||10, 50)));
  return rows.map(function(r){return {importId:String(r.IMPORT_ID),period:String(r.PERIOD),files:String(r.FILES||''),status:String(r.STATUS||''),total:Number(r.TOTAL||0),autoOk:Number(r.AUTO_OK||0),needReview:Number(r.NEED_REVIEW||0),conflict:Number(r.CONFLICT||0),unmapped:Number(r.UNMAPPED||0),createdAt:pdfIso_(r.CREATED_AT),approvedAt:r.APPROVED_AT?pdfIso_(r.APPROVED_AT):'',approvedBy:String(r.APPROVED_BY||'')};});
}


/**
 * V1.7 - PARALLEL REVIEW
 * Google Sheet staging và màn hình Review trên Vercel dùng chung một nguồn dữ liệu.
 * Người dùng có thể sửa ở App hoặc Sheet rồi đồng bộ hai chiều trước khi duyệt.
 */
function getPdfStaging_(importId) {
  setupPdfImportModule();
  const id=String(importId||'');
  if(!id) throw new Error('Thiếu importId');
  const rows=readObjects_(PDFMOD.SHEETS.STAGING).filter(function(r){return String(r.IMPORT_ID)===id;});
  const period=rows.length?String(rows[0].PERIOD||''):'';
  const log=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',id)||{};
  let summary={total:0,pass:0,partial:0,fail:0,detected:false}; try{if(log.SUMMARY_JSON) summary=JSON.parse(String(log.SUMMARY_JSON));}catch(e){}
  return {ok:true,importId:id,period:period,records:rows.map(pdfStagingRowToRecord_),summary:summary,sheetUrl:pdfStagingSheetUrl_(),updatedAt:new Date().toISOString()};
}

function savePdfStaging_(payload) {
  setupPdfImportModule();
  const importId=String(payload.importId||'');
  const incoming=Array.isArray(payload.records)?payload.records:[];
  const user=String(payload.user||'app-review');
  if(!importId) throw new Error('Thiếu importId');
  if(!incoming.length && !payload.summary) return {ok:true,importId:importId,saved:0,conflicts:0,records:getPdfStaging_(importId).records,sheetUrl:pdfStagingSheetUrl_()};
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.STAGING);
    if(!sh||sh.getLastRow()<2) throw new Error('Staging chưa có dữ liệu');
    const all=sh.getDataRange().getValues();
    const headers=all[0].map(String), cols={}; headers.forEach(function(h,i){cols[h]=i;});
    const byId={}; incoming.forEach(function(r){byId[String(r.rowId||'')]=r;});
    let saved=0,conflicts=0; const stamp=new Date();
    for(let i=1;i<all.length;i++){
      if(String(all[i][cols.IMPORT_ID])!==importId) continue;
      const rowId=String(all[i][cols.ROW_ID]); const r=byId[rowId]; if(!r) continue;
      const sheetUpdated=all[i][cols.UPDATED_AT] ? new Date(all[i][cols.UPDATED_AT]).getTime() : 0;
      const clientUpdated=r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if(clientUpdated && sheetUpdated > clientUpdated + 1500 && !payload.force){ conflicts++; continue; }
      const v=r.values||{};
      const update={
        KPI_ID:String(r.kpiId||''),DOMAIN_ID:String(r.domainId||''),LABEL:String(r.label||''),UNIT:String(r.unit||''),SOURCE_LABEL:String(r.sourceLabel||''),
        ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),
        REVIEW_STATUS:String(r.reviewStatus||''),REMEMBER_ALIAS:Boolean(r.rememberAlias),REVIEW_NOTE:String(r.reviewNote||''),REVIEWED_BY:String(r.reviewedBy||user),UPDATED_AT:stamp
      };
      if(['VERIFIED','SKIP'].indexOf(update.REVIEW_STATUS)>=0) update.REVIEWED_AT=stamp;
      Object.keys(update).forEach(function(name){ if(cols[name]!==undefined) all[i][cols[name]]=update[name]; });
      sh.getRange(i+1,1,1,headers.length).setValues([all[i]]);
      saved++;
    }
    if(payload.summary){ const current=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{}; pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:current.PERIOD||'',FILES:current.FILES||'',FINGERPRINTS:current.FINGERPRINTS||'',STATUS:current.STATUS||'REVIEWING',TOTAL:current.TOTAL||0,AUTO_OK:current.AUTO_OK||0,NEED_REVIEW:current.NEED_REVIEW||0,CONFLICT:current.CONFLICT||0,UNMAPPED:current.UNMAPPED||0,SUMMARY_JSON:JSON.stringify(payload.summary),CREATED_AT:current.CREATED_AT||stamp,APPROVED_AT:current.APPROVED_AT||'',APPROVED_BY:current.APPROVED_BY||'',NOTE:current.NOTE||'V1.7 parallel review'}); }
    pdfUpdateImportCounts_(importId);
    const latest=getPdfStaging_(importId);
    return {ok:true,importId:importId,saved:saved,conflicts:conflicts,records:latest.records,sheetUrl:latest.sheetUrl,updatedAt:latest.updatedAt};
  } finally { lock.releaseLock(); }
}

function pdfStagingRowToRecord_(r){
  return {
    rowId:String(r.ROW_ID||''),period:String(r.PERIOD||''),docType:String(r.DOC_TYPE||'OTHER'),kpiId:String(r.KPI_ID||'')||undefined,domainId:String(r.DOMAIN_ID||'')||undefined,label:String(r.LABEL||''),unit:String(r.UNIT||'')||undefined,sourceLabel:String(r.SOURCE_LABEL||''),
    values:{actualMonth:pdfMaybeNumber_(r.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(r.PLAN_MONTH),actualYtd:pdfMaybeNumber_(r.ACTUAL_YTD),planYtd:pdfMaybeNumber_(r.PLAN_YTD),planYear:pdfMaybeNumber_(r.PLAN_YEAR),samePeriodMonth:pdfMaybeNumber_(r.SAME_PERIOD_MONTH),samePeriodYtd:pdfMaybeNumber_(r.SAME_PERIOD_YTD)},
    statusText:String(r.STATUS_TEXT||''),confidence:Number(r.CONFIDENCE||0),sourceFile:String(r.SOURCE_FILE||''),sourcePage:Number(r.SOURCE_PAGE||0),sourceExcerpt:String(r.SOURCE_EXCERPT||''),reviewStatus:String(r.REVIEW_STATUS||'NEED_REVIEW'),issues:pdfJsonArray_(r.ISSUES),conflicts:pdfJsonArray_(r.CONFLICTS_JSON),rememberAlias:pdfTruthy_(r.REMEMBER_ALIAS),reviewNote:String(r.REVIEW_NOTE||''),reviewedBy:String(r.REVIEWED_BY||''),reviewedAt:r.REVIEWED_AT?pdfIso_(r.REVIEWED_AT):'',updatedAt:r.UPDATED_AT?pdfIso_(r.UPDATED_AT):''
  };
}

function pdfUpdateImportCounts_(importId){
  const rows=readObjects_(PDFMOD.SHEETS.STAGING).filter(function(r){return String(r.IMPORT_ID)===String(importId);});
  if(!rows.length)return;
  const current=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{};
  pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:current.PERIOD||rows[0].PERIOD,FILES:current.FILES||'',FINGERPRINTS:current.FINGERPRINTS||'',STATUS:current.STATUS==='APPROVED'?'APPROVED':'REVIEWING',TOTAL:rows.length,AUTO_OK:rows.filter(function(r){return String(r.REVIEW_STATUS)==='AUTO_OK';}).length,NEED_REVIEW:rows.filter(function(r){return String(r.REVIEW_STATUS)==='NEED_REVIEW';}).length,CONFLICT:rows.filter(function(r){return String(r.REVIEW_STATUS)==='CONFLICT';}).length,UNMAPPED:rows.filter(function(r){return String(r.REVIEW_STATUS)==='UNMAPPED';}).length,SUMMARY_JSON:current.SUMMARY_JSON||'',CREATED_AT:current.CREATED_AT||new Date(),APPROVED_AT:current.APPROVED_AT||'',APPROVED_BY:current.APPROVED_BY||'',NOTE:'V1.7 parallel review'});
}

function pdfStagingSheetUrl_(){
  const ss=SpreadsheetApp.getActive(); const sh=ss.getSheetByName(PDFMOD.SHEETS.STAGING);
  return ss.getUrl()+(sh?'#gid='+sh.getSheetId():'');
}

function pdfJsonArray_(value){
  if(Array.isArray(value))return value;
  if(!value)return [];
  try{const x=JSON.parse(String(value));return Array.isArray(x)?x:[];}catch(e){return [];}
}

function pdfConfigureParallelReviewSheet_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.STAGING); if(!sh)return;
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String), idx={}; h.forEach(function(x,i){idx[x]=i+1;});
  sh.setFrozenRows(1); sh.setFrozenColumns(Math.min(8,sh.getLastColumn()));
  sh.getRange(1,1,1,sh.getLastColumn()).setBackground('#005A36').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  if(idx.REVIEW_STATUS){
    const rule=SpreadsheetApp.newDataValidation().requireValueInList(['AUTO_OK','NEED_REVIEW','CONFLICT','UNMAPPED','VERIFIED','SKIP'],true).setAllowInvalid(false).build();
    sh.getRange(2,idx.REVIEW_STATUS,Math.max(sh.getMaxRows()-1,1),1).setDataValidation(rule);
    const range=sh.getRange(2,idx.REVIEW_STATUS,Math.max(sh.getMaxRows()-1,1),1);
    const rules=sh.getConditionalFormatRules().filter(function(r){return !r.getRanges().some(function(x){return x.getColumn()===idx.REVIEW_STATUS;});});
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('VERIFIED').setBackground('#ECFDF5').setFontColor('#047857').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('AUTO_OK').setBackground('#ECFDF5').setFontColor('#047857').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('NEED_REVIEW').setBackground('#FFFBEB').setFontColor('#B45309').setRanges([range]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('CONFLICT').setBackground('#FEF2F2').setFontColor('#B91C1C').setRanges([range]).build());
    sh.setConditionalFormatRules(rules);
  }
  ['SOURCE_EXCERPT','RAW_VALUES_JSON','CONFLICTS_JSON','ISSUES'].forEach(function(name){if(idx[name])sh.hideColumns(idx[name]);});
  ['LABEL','SOURCE_FILE','REVIEW_NOTE'].forEach(function(name){if(idx[name])sh.setColumnWidth(idx[name],name==='REVIEW_NOTE'?220:180);});
  ['ACTUAL_MONTH','PLAN_MONTH','ACTUAL_YTD','PLAN_YTD','PLAN_YEAR','SAME_PERIOD_MONTH','SAME_PERIOD_YTD'].forEach(function(name){if(idx[name])sh.setColumnWidth(idx[name],105);});
  if(!sh.getFilter() && sh.getLastRow()>=1) sh.getRange(1,1,Math.max(sh.getLastRow(),1),sh.getLastColumn()).createFilter();
}


function onOpen(){
  try{
    SpreadsheetApp.getUi().createMenu('PDF Review')
      .addItem('Mở bảng kiểm tra song song','openPdfStaging_')
      .addSeparator()
      .addItem('Xác nhận các dòng đang chọn','verifySelectedPdfRows_')
      .addItem('Bỏ qua các dòng đang chọn','skipSelectedPdfRows_')
      .addToUi();
  }catch(e){}
}

function openPdfStaging_(){
  const ss=SpreadsheetApp.getActive(); const sh=ss.getSheetByName(PDFMOD.SHEETS.STAGING); if(sh)ss.setActiveSheet(sh);
}
function verifySelectedPdfRows_(){pdfMarkSelectedRows_('VERIFIED');}
function skipSelectedPdfRows_(){pdfMarkSelectedRows_('SKIP');}
function pdfMarkSelectedRows_(status){
  const ss=SpreadsheetApp.getActive(), sh=ss.getActiveSheet(); if(!sh||sh.getName()!==PDFMOD.SHEETS.STAGING)throw new Error('Hãy chọn dòng trong 03_PDF_STAGING');
  const range=sh.getActiveRange(); if(!range)return; const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String), idx={};headers.forEach(function(h,i){idx[h]=i+1;});
  if(!idx.REVIEW_STATUS)return; const start=Math.max(2,range.getRow()), end=range.getLastRow(), user=Session.getActiveUser().getEmail()||'sheet-user', stamp=new Date();
  for(let row=start;row<=end;row++){sh.getRange(row,idx.REVIEW_STATUS).setValue(status);if(idx.REVIEWED_BY)sh.getRange(row,idx.REVIEWED_BY).setValue(user);if(idx.REVIEWED_AT)sh.getRange(row,idx.REVIEWED_AT).setValue(stamp);if(idx.UPDATED_AT)sh.getRange(row,idx.UPDATED_AT).setValue(stamp);}
}

/**
 * Khi người dùng sửa trực tiếp 03_PDF_STAGING trên Google Sheet:
 * - đánh dấu NEED_REVIEW nếu số liệu/KPI bị thay đổi;
 * - ghi thời gian để màn hình App biết Sheet có bản mới hơn;
 * - VERIFIED/SKIP được xem như quyết định review hợp lệ.
 */
function onEdit(e){
  try{
    if(!e||!e.range)return; const sh=e.range.getSheet(); if(sh.getName()!==PDFMOD.SHEETS.STAGING||e.range.getRow()<=1)return;
    const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String), idx={}; headers.forEach(function(h,i){idx[h]=i+1;});
    const row=e.range.getRow(), editedHeader=headers[e.range.getColumn()-1]||'', statusCell=idx.REVIEW_STATUS?sh.getRange(row,idx.REVIEW_STATUS):null;
    const valueFields=['KPI_ID','DOMAIN_ID','LABEL','UNIT','ACTUAL_MONTH','PLAN_MONTH','ACTUAL_YTD','PLAN_YTD','PLAN_YEAR','SAME_PERIOD_MONTH','SAME_PERIOD_YTD'];
    if(valueFields.indexOf(editedHeader)>=0 && statusCell){ const st=String(statusCell.getValue()||''); if(st!=='SKIP') statusCell.setValue('NEED_REVIEW'); }
    const user=(Session.getActiveUser().getEmail()||'sheet-user');
    if(idx.UPDATED_AT) sh.getRange(row,idx.UPDATED_AT).setValue(new Date());
    if(idx.REVIEWED_BY) sh.getRange(row,idx.REVIEWED_BY).setValue(user);
    if(editedHeader==='REVIEW_STATUS' && ['VERIFIED','SKIP'].indexOf(String(e.value||''))>=0 && idx.REVIEWED_AT) sh.getRange(row,idx.REVIEWED_AT).setValue(new Date());
  }catch(err){console.warn('PDF staging onEdit',err);}
}

function stagePdfImport_(payload) {
  setupPdfImportModule();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const importId = String(payload.importId||''); const period=String(payload.period||'');
    if(!importId || !/^\d{4}-\d{2}$/.test(period)) throw new Error('Import ID / period không hợp lệ');
    const docs=Array.isArray(payload.documents)?payload.documents:[]; const records=Array.isArray(payload.records)?payload.records:[];
    const fps=docs.map(function(d){return String(d.fingerprint||'');}).filter(Boolean);
    const dup=readObjects_(PDFMOD.SHEETS.IMPORTS).find(function(r){return String(r.STATUS)==='APPROVED' && fps.length && fps.some(function(fp){return String(r.FINGERPRINTS||'').indexOf(fp)>=0;});});
    if(dup) return {ok:false,duplicate:true,error:'PDF này đã được duyệt trước đó ở import '+dup.IMPORT_ID};

    pdfDeleteRowsByKey_(PDFMOD.SHEETS.STAGING,'IMPORT_ID',importId);
    const stamp=new Date();
    const stageRows=records.map(function(r){const v=r.values||{};return {
      IMPORT_ID:importId,ROW_ID:String(r.rowId||''),PERIOD:period,DOC_TYPE:String(r.docType||''),KPI_ID:String(r.kpiId||''),DOMAIN_ID:String(r.domainId||''),LABEL:String(r.label||''),UNIT:String(r.unit||''),SOURCE_LABEL:String(r.sourceLabel||''),
      ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),
      STATUS_TEXT:String(r.statusText||''),CONFIDENCE:Number(r.confidence||0),SOURCE_FILE:String(r.sourceFile||''),SOURCE_PAGE:Number(r.sourcePage||0),SOURCE_EXCERPT:String(r.sourceExcerpt||''),REVIEW_STATUS:String(r.reviewStatus||''),ISSUES:JSON.stringify(r.issues||[]),REMEMBER_ALIAS:Boolean(r.rememberAlias),RAW_VALUES_JSON:JSON.stringify(v),CONFLICTS_JSON:JSON.stringify(r.conflicts||[]),REVIEW_NOTE:String(r.reviewNote||''),REVIEWED_BY:String(r.reviewedBy||''),REVIEWED_AT:r.reviewedAt?new Date(r.reviewedAt):'',CREATED_AT:stamp,UPDATED_AT:stamp
    };});
    appendObjects_(PDFMOD.SHEETS.STAGING,stageRows);
    pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:period,FILES:docs.map(function(d){return d.name;}).join(' | '),FINGERPRINTS:fps.join(' | '),STATUS:'STAGED',TOTAL:records.length,AUTO_OK:records.filter(function(r){return r.reviewStatus==='AUTO_OK';}).length,NEED_REVIEW:records.filter(function(r){return r.reviewStatus==='NEED_REVIEW';}).length,CONFLICT:records.filter(function(r){return r.reviewStatus==='CONFLICT';}).length,UNMAPPED:records.filter(function(r){return r.reviewStatus==='UNMAPPED';}).length,SUMMARY_JSON:JSON.stringify(payload.summary||{}),CREATED_AT:stamp,NOTE:'Browser PDF.js staging'});
    return {ok:true,importId:importId,staged:stageRows.length,sheetUrl:pdfStagingSheetUrl_()};
  } finally { lock.releaseLock(); }
}

function approvePdfImport_(payload) {
  setupPdfImportModule();
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const importId=String(payload.importId||''); const period=String(payload.period||''); let records=Array.isArray(payload.records)?payload.records:[]; let summary=payload.summary||{};
    if(payload.useStaging){ const staged=getPdfStaging_(importId); records=staged.records; if(!summary||!Number(summary.total)) summary=staged.summary||summary; }
    if(!importId||!period) throw new Error('Thiếu importId/period');
    const unresolved=records.filter(function(r){return ['NEED_REVIEW','CONFLICT'].indexOf(String(r.reviewStatus))>=0;});
    if(unresolved.length) throw new Error('Còn '+unresolved.length+' dòng chưa xử lý');
    let upserted=0,skipped=0,locked=0; const stamp=new Date();
    records.forEach(function(r){
      if(String(r.reviewStatus)==='SKIP' || !r.kpiId){ skipped++; return; }
      const catalog=pdfCatalogById_(String(r.kpiId)); if(!catalog){skipped++;return;}
      const rowKey=period+'|'+r.kpiId; const existing=pdfFindObject_(PDFMOD.SHEETS.HISTORY,'ROW_KEY',rowKey);
      if(existing && String(existing.VALUE_STATUS)==='MANUAL_OVERRIDE' && !payload.force){ locked++; return; }
      const v=r.values||{}; const sourceTone=pdfToneFromStatus_(r.statusText); const tone=sourceTone||pdfTone_(catalog,v); const status=String(r.statusText||pdfStatusFromTone_(tone));
      const nextRow={ROW_KEY:rowKey,PERIOD:period,KPI_ID:String(r.kpiId),DOMAIN_ID:String(r.domainId||catalog.DOMAIN_ID),LABEL:String(r.label||catalog.LABEL),UNIT:String(r.unit||catalog.UNIT),ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),STATUS:status,TONE:tone,VALUE_STATUS:'PDF_APPROVED',IMPORT_ID:importId,SOURCE_FILE:String(r.sourceFile||''),SOURCE_PAGE:Number(r.sourcePage||0),UPDATED_AT:stamp};
      pdfUpsertObject_(PDFMOD.SHEETS.HISTORY,'ROW_KEY',nextRow);
      if (typeof APP !== 'undefined' && APP.SHEETS && APP.SHEETS.CHANGELOG) {
        const logSh=SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CHANGELOG);
        if(logSh) logSh.appendRow([stamp,String(payload.approvedBy||'pdf-admin'),rowKey,'PDF_IMPORT',existing?JSON.stringify(existing):'',JSON.stringify(nextRow),'Approve import '+importId]);
      }
      if(r.rememberAlias && r.sourceLabel){ pdfSaveAliasRule_(String(r.sourceLabel),String(r.kpiId),String(payload.approvedBy||'pdf-admin')); }
      upserted++;
    });
    pdfUpsertObject_(PDFMOD.SHEETS.SUMMARY,'PERIOD',{PERIOD:period,TOTAL:Number(summary.total||0),PASS:Number(summary.pass||0),PARTIAL:Number(summary.partial||0),FAIL:Number(summary.fail||0),IMPORT_ID:importId,UPDATED_AT:stamp});
    pdfUpdateStagingFromApproval_(importId,records);
    const log=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{};
    pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:period,FILES:log.FILES||'',FINGERPRINTS:log.FINGERPRINTS||'',STATUS:'APPROVED',TOTAL:records.length,AUTO_OK:records.filter(function(r){return r.reviewStatus==='AUTO_OK';}).length,NEED_REVIEW:0,CONFLICT:0,UNMAPPED:records.filter(function(r){return r.reviewStatus==='UNMAPPED';}).length,SUMMARY_JSON:log.SUMMARY_JSON||JSON.stringify(summary||{}),CREATED_AT:log.CREATED_AT||stamp,APPROVED_AT:stamp,APPROVED_BY:String(payload.approvedBy||'pdf-admin'),NOTE:payload.useStaging?'Approved from V1.7 synchronized staging':'Approved from Vercel PDF Import Center'});
    return {ok:true,importId:importId,upserted:upserted,skipped:skipped,locked:locked};
  } finally { lock.releaseLock(); }
}


function getPdfPeriodData_(period) {
  setupPdfImportModule();
  const p=String(period||''); if(!/^\d{4}-\d{2}$/.test(p)) return [];
  return readObjects_(PDFMOD.SHEETS.HISTORY).filter(function(r){return String(r.PERIOD)===p;}).map(function(r){return {
    period:p,kpiId:String(r.KPI_ID||''),label:String(r.LABEL||''),unit:String(r.UNIT||''),
    values:{actualMonth:pdfMaybeNumber_(r.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(r.PLAN_MONTH),actualYtd:pdfMaybeNumber_(r.ACTUAL_YTD),planYtd:pdfMaybeNumber_(r.PLAN_YTD),planYear:pdfMaybeNumber_(r.PLAN_YEAR),samePeriodMonth:pdfMaybeNumber_(r.SAME_PERIOD_MONTH),samePeriodYtd:pdfMaybeNumber_(r.SAME_PERIOD_YTD)},
    status:String(r.STATUS||''),tone:String(r.TONE||''),valueStatus:String(r.VALUE_STATUS||''),sourceFile:String(r.SOURCE_FILE||''),sourcePage:Number(r.SOURCE_PAGE||0)
  };});
}

function correctImportedKpi_(payload) {
  setupPdfImportModule();
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const period=String(payload.period||''), kpiId=String(payload.kpiId||''), field=String(payload.field||'');
    const allowed={actualMonth:'ACTUAL_MONTH',planMonth:'PLAN_MONTH',actualYtd:'ACTUAL_YTD',planYtd:'PLAN_YTD',planYear:'PLAN_YEAR',samePeriodMonth:'SAME_PERIOD_MONTH',samePeriodYtd:'SAME_PERIOD_YTD'};
    if(!/^\d{4}-\d{2}$/.test(period)||!kpiId||!allowed[field]) throw new Error('Yêu cầu hiệu chỉnh không hợp lệ');
    const rowKey=period+'|'+kpiId, sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.HISTORY); if(!sh||sh.getLastRow()<2) throw new Error('Chưa có dữ liệu lịch sử');
    const values=sh.getDataRange().getValues(), headers=values[0].map(String), keyCol=headers.indexOf('ROW_KEY'), fieldCol=headers.indexOf(allowed[field]);
    const statusCol=headers.indexOf('STATUS'),toneCol=headers.indexOf('TONE'),vsCol=headers.indexOf('VALUE_STATUS'),updatedCol=headers.indexOf('UPDATED_AT');
    for(let i=1;i<values.length;i++) if(String(values[i][keyCol])===rowKey){
      const oldValue=values[i][fieldCol], next=payload.newValue===''||payload.newValue===null?'' : Number(payload.newValue); if(next!==''&&!isFinite(next)) throw new Error('Giá trị mới không hợp lệ');
      sh.getRange(i+1,fieldCol+1).setValue(next); sh.getRange(i+1,vsCol+1).setValue('MANUAL_OVERRIDE'); sh.getRange(i+1,updatedCol+1).setValue(new Date());
      const rowObj={};headers.forEach(function(h,j){rowObj[h]=j===fieldCol?next:values[i][j];}); const cat=pdfCatalogById_(kpiId)||{}; const v={actualMonth:pdfMaybeNumber_(rowObj.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(rowObj.PLAN_MONTH),actualYtd:pdfMaybeNumber_(rowObj.ACTUAL_YTD),planYtd:pdfMaybeNumber_(rowObj.PLAN_YTD),planYear:pdfMaybeNumber_(rowObj.PLAN_YEAR)}; const tone=pdfTone_(cat,v); sh.getRange(i+1,toneCol+1).setValue(tone); sh.getRange(i+1,statusCol+1).setValue(pdfStatusFromTone_(tone));
      if(typeof APP!=='undefined'&&APP.SHEETS&&APP.SHEETS.CHANGELOG){const log=SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CHANGELOG);if(log)log.appendRow([new Date(),String(payload.user||'pdf-admin'),rowKey,allowed[field],oldValue,next,String(payload.reason||'Hiệu chỉnh dữ liệu PDF đã duyệt')]);}
      return {ok:true,rowKey:rowKey,field:field,oldValue:oldValue,newValue:next,valueStatus:'MANUAL_OVERRIDE'};
    }
    throw new Error('Không tìm thấy KPI '+rowKey);
  } finally { lock.releaseLock(); }
}

function generateApiKeyForVercel() {
  const key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
  PropertiesService.getScriptProperties().setProperty('API_KEY',key);
  console.log('APPS_SCRIPT_API_KEY='+key);
  return key;
}

function getImportedBootstrap_(period) {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(PDFMOD.SHEETS.HISTORY) || !ss.getSheetByName(PDFMOD.SHEETS.CATALOG)) return null;
  const historyRows=readObjects_(PDFMOD.SHEETS.HISTORY);
  if(!historyRows.length) return null;
  const periods=Array.from(new Set(historyRows.map(function(r){return String(r.PERIOD||'');}).filter(Boolean))).sort();
  const selected=periods.indexOf(String(period||''))>=0?String(period):periods[periods.length-1];
  const rows=historyRows.filter(function(r){return String(r.PERIOD)===selected;}); if(!rows.length)return null;
  const catalog=readObjects_(PDFMOD.SHEETS.CATALOG).filter(function(r){return pdfTruthy_(r.ACTIVE);});
  const groups={};
  rows.forEach(function(r){const c=catalog.find(function(x){return String(x.KPI_ID)===String(r.KPI_ID);})||{};const name=String(c.DOMAIN_NAME||r.DOMAIN_ID||'Khác');if(!groups[name])groups[name]=[];groups[name].push(pdfHistoryCard_(r,c));});
  const summary=pdfFindObject_(PDFMOD.SHEETS.SUMMARY,'PERIOD',selected)||{};
  const calc={pass:rows.filter(function(r){return String(r.TONE)==='good';}).length,partial:rows.filter(function(r){return String(r.TONE)==='warn';}).length,fail:rows.filter(function(r){return String(r.TONE)==='bad';}).length};
  const summaryObj={total:Number(summary.TOTAL||rows.length),pass:Number(summary.PASS||calc.pass),partial:Number(summary.PARTIAL||calc.partial),fail:Number(summary.FAIL||calc.fail)};
  const history={};
  catalog.forEach(function(c){const id=String(c.KPI_ID);const pts=historyRows.filter(function(r){return String(r.KPI_ID)===id&&r.ACTUAL_MONTH!==''&&r.ACTUAL_MONTH!==null&&r.ACTUAL_MONTH!==undefined;}).sort(function(a,b){return String(a.PERIOD).localeCompare(String(b.PERIOD));}).map(function(r){return {period:String(r.PERIOD),actual:Number(r.ACTUAL_MONTH),planMonth:r.PLAN_MONTH===''?undefined:Number(r.PLAN_MONTH),ytd:r.ACTUAL_YTD===''?undefined:Number(r.ACTUAL_YTD),planYtd:r.PLAN_YTD===''?undefined:Number(r.PLAN_YTD)};});if(pts.length)history[id]={id:id,unit:String(c.UNIT||''),direction:String(c.DIRECTION||'info'),aggregate:String(c.AGGREGATE||'snapshot'),decimals:Number(c.DECIMALS||2),annualPlans:pdfAnnualPlans_(historyRows,id),points:pts};});
  const alerts=rows.filter(function(r){return ['bad','warn'].indexOf(String(r.TONE))>=0;}).map(function(r,i){const c=catalog.find(function(x){return String(x.KPI_ID)===String(r.KPI_ID);})||{};return {id:'IMP_ALERT_'+i+'_'+r.KPI_ID,title:String(r.LABEL)+(String(r.TONE)==='bad'?': không đạt':': cần theo dõi'),current:pdfValueDisplay_(r.ACTUAL_MONTH!==''?r.ACTUAL_MONTH:r.ACTUAL_YTD,c),target:pdfTargetDisplay_(r,c),note:'Cảnh báo tự sinh từ dữ liệu PDF đã duyệt.',domain:String(c.DOMAIN_NAME||r.DOMAIN_ID||''),severity:String(r.TONE)==='bad'?'red':'yellow',domainId:String(c.DOMAIN_ID||r.DOMAIN_ID||''),kpiId:String(r.KPI_ID)};});
  const reli=['SAIFI','SAIDI','MAIFI'].map(function(id){const r=rows.find(function(x){return String(x.KPI_ID)===id;});const c=catalog.find(function(x){return String(x.KPI_ID)===id;});if(!r||!c)return null;return {id:id,unit:String(c.UNIT),targetYear:Number(r.PLAN_YEAR||0),targetPeriod:Number(r.PLAN_YTD||0),month:Number(r.ACTUAL_MONTH||0),ytd:Number(r.ACTUAL_YTD||0),status:String(r.STATUS||'')};}).filter(Boolean);
  const sourceFiles=Array.from(new Set(rows.map(function(r){return String(r.SOURCE_FILE||'');}).filter(Boolean))).join(' + ');
  return {ok:true,period:selected,reportingDate:pdfPeriodEnd_(selected),dataMode:'apps-script',sourceLabel:sourceFiles||'PDF đã duyệt',availablePeriods:periods,history:history,summary:summaryObj,headline:rows.slice(0,6).map(function(r){const c=catalog.find(function(x){return String(x.KPI_ID)===String(r.KPI_ID);})||{};return pdfHistoryCard_(r,c);}),fields:Object.keys(groups).map(function(name,i){const c=catalog.find(function(x){return String(x.DOMAIN_NAME)===name;})||{};return {id:String(c.DOMAIN_ID||'g'+(i+1)),title:name,items:groups[name]};}),reliability:reli,incidentCauses:[],alerts:alerts,conflicts:readObjects_(PDFMOD.SHEETS.STAGING).filter(function(r){return String(r.PERIOD)===selected&&String(r.REVIEW_STATUS)==='CONFLICT';}).slice(0,10).map(function(r){return {id:String(r.ROW_ID),label:String(r.LABEL),sourceA:String(r.SOURCE_FILE),valueA:String(r.SOURCE_EXCERPT).slice(0,120),sourceB:'',valueB:'',recommendation:'Xem lại staging của import '+r.IMPORT_ID};}),plans:readObjects_(APP.SHEETS.PLANS).map(function(r){return {id:String(r.ID),owner:String(r.OWNER),title:String(r.TITLE),status:String(r.STATUS),note:String(r.NOTE||'')};}),notes:['Dữ liệu lấy từ PDF đã được người dùng duyệt qua PDF Import Center.']};
}

function pdfHistoryCard_(r,c){const val=r.ACTUAL_MONTH!==''?r.ACTUAL_MONTH:r.ACTUAL_YTD;const plan=r.PLAN_MONTH!==''?r.PLAN_MONTH:(r.PLAN_YTD!==''?r.PLAN_YTD:r.PLAN_YEAR);return {id:String(r.KPI_ID),label:String(r.LABEL||c.LABEL||r.KPI_ID),value:pdfValueDisplay_(val,c),detail:plan!==''?'KH: '+pdfValueDisplay_(plan,c):'',plan:r.ACTUAL_YTD!==''?'Lũy kế: '+pdfValueDisplay_(r.ACTUAL_YTD,c):'',tone:String(r.TONE||'neutral'),status:String(r.STATUS||''),sourcePage:Number(r.SOURCE_PAGE||0)||undefined};}
function pdfValueDisplay_(value,c){if(value===''||value===null||value===undefined)return '—';const d=Number(c.DECIMALS||2);const n=Number(value);return (isFinite(n)?n.toLocaleString('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:d}):String(value))+(c.UNIT?' '+c.UNIT:'');}
function pdfTargetDisplay_(r,c){const x=r.PLAN_MONTH!==''?r.PLAN_MONTH:(r.PLAN_YTD!==''?r.PLAN_YTD:r.PLAN_YEAR);return x===''?'':pdfValueDisplay_(x,c);}
function pdfAnnualPlans_(rows,id){const out={};rows.filter(function(r){return String(r.KPI_ID)===id&&r.PLAN_YEAR!=='';}).forEach(function(r){out[String(r.PERIOD).slice(0,4)]=Number(r.PLAN_YEAR);});return out;}
function pdfToneFromStatus_(status){const s=String(status||'').toLowerCase();if(!s)return '';if(s.indexOf('đạt một phần')>=0||s.indexOf('dat mot phan')>=0)return 'warn';if(s.indexOf('không đạt')>=0||s.indexOf('khong dat')>=0||s.indexOf('k đạt')>=0)return 'bad';if(s.indexOf('đạt')>=0||s==='dat')return 'good';return '';}
function pdfTone_(catalog,v){const dir=String(catalog.DIRECTION||'info');if(dir==='info')return 'neutral';let a,p;if(v.actualMonth!==undefined&&v.planMonth!==undefined){a=v.actualMonth;p=v.planMonth;}else if(v.actualYtd!==undefined&&v.planYtd!==undefined){a=v.actualYtd;p=v.planYtd;}else return 'neutral';if(p===undefined||Number(p)===0)return 'neutral';const ratio=Number(a)/Number(p)*100;if(dir==='higher')return ratio>=100?'good':ratio>=95?'warn':'bad';return ratio<=100?'good':ratio<=110?'warn':'bad';}
function pdfStatusFromTone_(tone){return tone==='good'?'Đạt':tone==='warn'?'Theo dõi':tone==='bad'?'Không đạt':'Thông tin';}
function pdfCatalogById_(id){return readObjects_(PDFMOD.SHEETS.CATALOG).find(function(r){return String(r.KPI_ID)===id;});}
function pdfSaveAliasRule_(source,kpiId,user){if(!source||!kpiId)return;const normalized=String(source).trim().toLowerCase();const existing=readObjects_(PDFMOD.SHEETS.RULES).find(function(r){return String(r.TYPE)==='ALIAS'&&String(r.SOURCE_PATTERN).toLowerCase()===normalized&&String(r.KPI_ID)===kpiId;});if(existing)return;appendObjects_(PDFMOD.SHEETS.RULES,[{RULE_ID:'ALIAS_'+Utilities.getUuid(),TYPE:'ALIAS',SOURCE_PATTERN:source,KPI_ID:kpiId,FIELD:'',VALUE:'',ACTION:'MAP',ACTIVE:true,CREATED_AT:new Date(),CREATED_BY:user}]);}
function pdfUpdateStagingFromApproval_(importId,records){
  const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.STAGING); if(!sh||sh.getLastRow()<2)return;
  const vals=sh.getDataRange().getValues(), h=vals[0].map(String), map={}; records.forEach(function(r){map[String(r.rowId)]=r;});
  const cols={}; h.forEach(function(name,i){cols[name]=i+1;});
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][cols.IMPORT_ID-1])!==importId)continue; const r=map[String(vals[i][cols.ROW_ID-1])]; if(!r)continue; const v=r.values||{};
    const updates={KPI_ID:r.kpiId||'',DOMAIN_ID:r.domainId||'',LABEL:r.label||'',UNIT:r.unit||'',ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),REVIEW_STATUS:r.reviewStatus||'',REMEMBER_ALIAS:Boolean(r.rememberAlias),UPDATED_AT:new Date()};
    Object.keys(updates).forEach(function(name){if(cols[name])sh.getRange(i+1,cols[name]).setValue(updates[name]);});
  }
}
function pdfEnsureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);}else{const existing=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);headers.forEach(function(h){if(existing.indexOf(h)<0){sh.getRange(1,sh.getLastColumn()+1).setValue(h);existing.push(h);}});}sh.setFrozenRows(1);sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold');return sh;}
function pdfUpsertObject_(sheetName,keyField,obj){const sh=SpreadsheetApp.getActive().getSheetByName(sheetName);const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);const keyCol=headers.indexOf(keyField);if(keyCol<0)throw new Error('Missing key '+keyField);const last=sh.getLastRow();if(last>=2){const keys=sh.getRange(2,keyCol+1,last-1,1).getValues();for(let i=0;i<keys.length;i++){if(String(keys[i][0])===String(obj[keyField])){headers.forEach(function(h,j){if(obj[h]!==undefined)sh.getRange(i+2,j+1).setValue(obj[h]);});return i+2;}}}sh.appendRow(headers.map(function(h){return obj[h]===undefined?'':obj[h];}));return sh.getLastRow();}
function pdfFindObject_(sheetName,keyField,key){return readObjects_(sheetName).find(function(r){return String(r[keyField])===String(key);});}
function pdfDeleteRowsByKey_(sheetName,keyField,key){const sh=SpreadsheetApp.getActive().getSheetByName(sheetName);if(!sh||sh.getLastRow()<2)return;const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),idx=headers.indexOf(keyField);if(idx<0)return;const vals=sh.getRange(2,idx+1,sh.getLastRow()-1,1).getValues();for(let i=vals.length-1;i>=0;i--)if(String(vals[i][0])===String(key))sh.deleteRow(i+2);}
function pdfMaybeNumber_(v){return v===undefined||v===null||v===''?undefined:Number(v);}
function pdfNumOrBlank_(v){return v===undefined||v===null||v===''?'':Number(v);}
function pdfTruthy_(v){return v===true||String(v).toUpperCase()==='TRUE'||String(v)==='1';}
function pdfIso_(v){try{return new Date(v).toISOString();}catch(e){return String(v||'');}}
function pdfPeriodEnd_(period){const p=String(period).split('-').map(Number);const d=new Date(p[0],p[1],0);return Utilities.formatDate(d,Session.getScriptTimeZone()||'Asia/Ho_Chi_Minh','dd/MM/yyyy');}
