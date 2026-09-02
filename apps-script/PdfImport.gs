/**
 * V1.8.2 - PRODUCTION PDF IMPORT BACKEND
 * - Một luồng duy nhất: browser PDF.js -> staging -> review -> KPI_HISTORY.
 * - PERIOD luôn chuẩn hóa yyyy-MM và lưu dạng Plain text.
 * - Chặn staging/approve rỗng.
 * - Chống trùng theo fingerprint + parser version.
 * - Cho phép reprocess PDF cũ khi parser được nâng cấp; import cũ được đánh SUPERSEDED.
 * - Ghi HISTORY/STAGING/CHANGELOG theo batch để giảm timeout Apps Script.
 */

const PDFMOD = {
  VERSION: '1.8.2',
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

const PDF_CATALOG_V18_2 = [
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
  ['KD_TKIEM','kinh-doanh','Kinh doanh','Tiết kiệm điện','Tr.kWh','higher','sum',3,'tiết kiệm điện',true],
  ['KD_THUNGAN','kinh-doanh','Kinh doanh','Công tác quản lý thu ngân','%','higher','avg',2,'công tác quản lý thu ngân|tỷ lệ thu tiền điện|tỷ lệ thu tiền điện theo phiên|tỷ lệ không dùng tiền mặt',true],
  ['CRM','dvkh','Khách hàng & DVKH','CRM đã xử lý','%','higher','avg',2,'crm đã xử lý|tỷ lệ xử lý crm|yêu cầu crm',true],
  ['GANMOI','dvkh','Khách hàng & DVKH','Gắn mới điện kế','KH','higher','sum',0,'gắn mới điện kế|gắn mới|phát triển khách hàng',true],
  ['HDMBD','dvkh','Khách hàng & DVKH','HĐMBĐ ngoài sinh hoạt','HĐ','higher','sum',0,'hđmbđ ngoài sinh hoạt|hợp đồng mua bán điện ngoài sinh hoạt',true],
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
  ['ATTT','nhan-su','Nhân sự & Văn hóa','ATTT','%','higher','snapshot',0,'an toàn thông tin|attt',true],
];

function setupPdfImportModule() {
  const ss=SpreadsheetApp.getActive();
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.CATALOG,PDFMOD.HEADERS.CATALOG);
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.STAGING,PDFMOD.HEADERS.STAGING);
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.IMPORTS,PDFMOD.HEADERS.IMPORTS);
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.RULES,PDFMOD.HEADERS.RULES);
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.HISTORY,PDFMOD.HEADERS.HISTORY);
  pdfEnsureSheet_(ss,PDFMOD.SHEETS.SUMMARY,PDFMOD.HEADERS.SUMMARY);
  if(typeof APP!=='undefined'&&APP.SHEETS&&APP.SHEETS.CHANGELOG) pdfEnsureSheet_(ss,APP.SHEETS.CHANGELOG,['TIMESTAMP','USER','ROW_KEY','FIELD','OLD_VALUE','NEW_VALUE','REASON']);
  [PDFMOD.SHEETS.STAGING,PDFMOD.SHEETS.IMPORTS,PDFMOD.SHEETS.HISTORY,PDFMOD.SHEETS.SUMMARY].forEach(function(name){pdfFormatPeriodColumn_(ss.getSheetByName(name));});
  pdfEnsureCatalogV18_2_();
  return {ok:true,version:PDFMOD.VERSION,sheets:Object.keys(PDFMOD.SHEETS).map(function(k){return PDFMOD.SHEETS[k];})};
}

function setupPdfParallelReviewModule(){
  const r=setupPdfImportModule();
  return {ok:true,version:PDFMOD.VERSION,sheets:r.sheets,sheetUrl:pdfStagingSheetUrl_()};
}

function pdfEnsureCatalogV18_2_(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('PDF_CATALOG_VERSION')===PDFMOD.VERSION)return;
  const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.CATALOG);
  const headers=pdfHeaders_(sh), idx=pdfIndex_(headers);
  const existing=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
  const byId={}; existing.forEach(function(row,i){const id=String(row[idx.KPI_ID]||'');if(id)byId[id]=i;});
  PDF_CATALOG_V18_2.forEach(function(src){
    const obj={};PDFMOD.HEADERS.CATALOG.forEach(function(h,i){obj[h]=src[i];});
    const matrix=headers.map(function(h){return obj[h]===undefined?'':obj[h];});
    const pos=byId[String(obj.KPI_ID)];
    if(pos===undefined){existing.push(matrix);byId[String(obj.KPI_ID)]=existing.length-1;}
    else existing[pos]=matrix;
  });
  if(existing.length)sh.getRange(2,1,existing.length,headers.length).setValues(existing);
  props.setProperty('PDF_CATALOG_VERSION',PDFMOD.VERSION);
}

function getPdfRules_(){
  setupPdfImportModule();
  return readObjects_(PDFMOD.SHEETS.RULES).filter(function(r){return pdfTruthy_(r.ACTIVE);}).map(function(r){return {sourcePattern:String(r.SOURCE_PATTERN||''),kpiId:String(r.KPI_ID||'')};});
}

function listPdfImports_(limit){
  setupPdfImportModule();
  return readObjects_(PDFMOD.SHEETS.IMPORTS).reverse().slice(0,Math.max(1,Math.min(Number(limit)||20,100))).map(function(r){return {
    importId:String(r.IMPORT_ID||''),period:pdfNormalizePeriod_(r.PERIOD)||String(r.PERIOD||''),files:String(r.FILES||''),status:String(r.STATUS||''),
    total:Number(r.TOTAL||0),autoOk:Number(r.AUTO_OK||0),needReview:Number(r.NEED_REVIEW||0),conflict:Number(r.CONFLICT||0),unmapped:Number(r.UNMAPPED||0),
    createdAt:pdfIso_(r.CREATED_AT),approvedAt:r.APPROVED_AT?pdfIso_(r.APPROVED_AT):'',approvedBy:String(r.APPROVED_BY||''),note:String(r.NOTE||'')
  };});
}

function stagePdfImport_(payload){
  setupPdfImportModule();
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    const importId=String(payload.importId||'').trim();
    const period=pdfNormalizePeriod_(payload.period);
    const docs=Array.isArray(payload.documents)?payload.documents:[];
    const records=Array.isArray(payload.records)?payload.records:[];
    const parserVersion=String(payload.parserVersion||'unknown').trim()||'unknown';
    if(!importId||!period)throw new Error('Import ID / period không hợp lệ.');
    if(!docs.length)throw new Error('Không có tài liệu PDF để staging.');
    if(!records.length)throw new Error('PDF không nhận dạng được KPI nào. Không tạo staging rỗng.');
    const fps=Array.from(new Set(docs.map(function(d){return String(d.fingerprint||'').trim();}).filter(Boolean)));
    if(!fps.length)throw new Error('PDF thiếu fingerprint; không thể kiểm soát trùng lặp.');

    const imports=readObjects_(PDFMOD.SHEETS.IMPORTS);
    const sameFingerprint=imports.filter(function(r){
      if(String(r.STATUS)!=='APPROVED')return false;
      const oldFps=pdfSplitFingerprints_(r.FINGERPRINTS);
      return fps.some(function(fp){return oldFps.indexOf(fp)>=0;});
    });
    const sameParser=sameFingerprint.find(function(r){
      return pdfNormalizePeriod_(r.PERIOD)===period && pdfParserVersionFromNote_(r.NOTE)===parserVersion;
    });
    if(sameParser){
      return {ok:false,duplicate:true,existingImportId:String(sameParser.IMPORT_ID||''),period:period,error:'PDF này đã được duyệt bằng parser '+parserVersion+' cho kỳ '+period+'. Không tạo bản trùng.'};
    }
    const supersedes=sameFingerprint.map(function(r){return String(r.IMPORT_ID||'');}).filter(Boolean);

    pdfDeleteRowsByKey_(PDFMOD.SHEETS.STAGING,'IMPORT_ID',importId);
    const stamp=new Date();
    const stageRows=records.map(function(r){
      const v=r.values||{};
      return {
        IMPORT_ID:importId,ROW_ID:String(r.rowId||''),PERIOD:period,DOC_TYPE:String(r.docType||''),KPI_ID:String(r.kpiId||''),DOMAIN_ID:String(r.domainId||''),LABEL:String(r.label||''),UNIT:String(r.unit||''),SOURCE_LABEL:String(r.sourceLabel||''),
        ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),
        STATUS_TEXT:String(r.statusText||''),CONFIDENCE:Number(r.confidence||0),SOURCE_FILE:String(r.sourceFile||''),SOURCE_PAGE:Number(r.sourcePage||0),SOURCE_EXCERPT:String(r.sourceExcerpt||''),REVIEW_STATUS:String(r.reviewStatus||''),ISSUES:JSON.stringify(r.issues||[]),REMEMBER_ALIAS:Boolean(r.rememberAlias),RAW_VALUES_JSON:JSON.stringify(v),CONFLICTS_JSON:JSON.stringify(r.conflicts||[]),REVIEW_NOTE:String(r.reviewNote||''),REVIEWED_BY:String(r.reviewedBy||''),REVIEWED_AT:r.reviewedAt?new Date(r.reviewedAt):'',CREATED_AT:stamp,UPDATED_AT:stamp
      };
    });
    appendObjects_(PDFMOD.SHEETS.STAGING,stageRows);
    const note='PARSER_VERSION='+parserVersion+(supersedes.length?';SUPERSEDES='+supersedes.join(','):'')+';Browser PDF.js staging';
    pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{
      IMPORT_ID:importId,PERIOD:period,FILES:docs.map(function(d){return String(d.name||'');}).join(' | '),FINGERPRINTS:fps.join(' | '),STATUS:'STAGED',TOTAL:records.length,
      AUTO_OK:records.filter(function(r){return r.reviewStatus==='AUTO_OK';}).length,NEED_REVIEW:records.filter(function(r){return r.reviewStatus==='NEED_REVIEW';}).length,CONFLICT:records.filter(function(r){return r.reviewStatus==='CONFLICT';}).length,UNMAPPED:records.filter(function(r){return r.reviewStatus==='UNMAPPED';}).length,
      SUMMARY_JSON:JSON.stringify(payload.summary||{}),CREATED_AT:stamp,NOTE:note
    });
    return {ok:true,importId:importId,period:period,staged:stageRows.length,parserVersion:parserVersion,supersedes:supersedes,sheetUrl:pdfStagingSheetUrl_()};
  }finally{lock.releaseLock();}
}

function getPdfStaging_(importId){
  setupPdfImportModule();
  const id=String(importId||'').trim();if(!id)throw new Error('Thiếu importId');
  const rows=readObjects_(PDFMOD.SHEETS.STAGING).filter(function(r){return String(r.IMPORT_ID)===id;});
  const log=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',id)||{};
  const period=rows.length?(pdfNormalizePeriod_(rows[0].PERIOD)||''):(pdfNormalizePeriod_(log.PERIOD)||'');
  let summary={total:0,pass:0,partial:0,fail:0,detected:false};try{if(log.SUMMARY_JSON)summary=JSON.parse(String(log.SUMMARY_JSON));}catch(e){}
  return {ok:true,importId:id,period:period,records:rows.map(pdfStagingRowToRecord_),summary:summary,sheetUrl:pdfStagingSheetUrl_(),updatedAt:new Date().toISOString()};
}

function savePdfStaging_(payload){
  setupPdfImportModule();
  const importId=String(payload.importId||'').trim();
  const incoming=Array.isArray(payload.records)?payload.records:[];
  const user=String(payload.user||'app-review');
  if(!importId)throw new Error('Thiếu importId');
  const currentLog=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{};
  if(String(currentLog.STATUS)==='APPROVED'||String(currentLog.STATUS)==='SUPERSEDED')throw new Error('Phiên này đã chốt; không thể sửa staging.');
  if(!incoming.length&&!payload.summary)return getPdfStaging_(importId);
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try{
    const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.STAGING);
    if(!sh||sh.getLastRow()<2)throw new Error('Staging chưa có dữ liệu');
    const headers=pdfHeaders_(sh),idx=pdfIndex_(headers),matrix=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();
    const byId={};incoming.forEach(function(r){byId[String(r.rowId||'')]=r;});
    let saved=0,conflicts=0;const stamp=new Date();
    matrix.forEach(function(row){
      if(String(row[idx.IMPORT_ID])!==importId)return;
      const r=byId[String(row[idx.ROW_ID]||'')];if(!r)return;
      const sheetUpdated=row[idx.UPDATED_AT]?new Date(row[idx.UPDATED_AT]).getTime():0;
      const clientUpdated=r.updatedAt?new Date(r.updatedAt).getTime():0;
      if(clientUpdated&&sheetUpdated>clientUpdated+1500&&!payload.force){conflicts++;return;}
      const v=r.values||{};
      const updates={KPI_ID:String(r.kpiId||''),DOMAIN_ID:String(r.domainId||''),LABEL:String(r.label||''),UNIT:String(r.unit||''),SOURCE_LABEL:String(r.sourceLabel||''),ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),REVIEW_STATUS:String(r.reviewStatus||''),REMEMBER_ALIAS:Boolean(r.rememberAlias),REVIEW_NOTE:String(r.reviewNote||''),REVIEWED_BY:String(r.reviewedBy||user),UPDATED_AT:stamp};
      if(['VERIFIED','SKIP'].indexOf(updates.REVIEW_STATUS)>=0)updates.REVIEWED_AT=stamp;
      Object.keys(updates).forEach(function(name){if(idx[name]!==undefined)row[idx[name]]=updates[name];});saved++;
    });
    if(matrix.length)sh.getRange(2,1,matrix.length,headers.length).setValues(matrix);
    if(payload.summary){
      const c=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||currentLog;
      pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:pdfNormalizePeriod_(c.PERIOD)||'',FILES:c.FILES||'',FINGERPRINTS:c.FINGERPRINTS||'',STATUS:c.STATUS||'STAGED',TOTAL:c.TOTAL||0,AUTO_OK:c.AUTO_OK||0,NEED_REVIEW:c.NEED_REVIEW||0,CONFLICT:c.CONFLICT||0,UNMAPPED:c.UNMAPPED||0,SUMMARY_JSON:JSON.stringify(payload.summary),CREATED_AT:c.CREATED_AT||stamp,NOTE:c.NOTE||''});
    }
    pdfUpdateImportCounts_(importId);
    const latest=getPdfStaging_(importId);
    return {ok:true,importId:importId,period:latest.period,saved:saved,conflicts:conflicts,records:latest.records,summary:latest.summary,sheetUrl:latest.sheetUrl,updatedAt:latest.updatedAt};
  }finally{lock.releaseLock();}
}

function approvePdfImport_(payload){
  setupPdfImportModule();
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const importId=String(payload.importId||'').trim();if(!importId)throw new Error('Thiếu importId');
    const currentLog=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{};
    if(String(currentLog.STATUS)==='APPROVED')return {ok:true,alreadyApproved:true,importId:importId,period:pdfNormalizePeriod_(currentLog.PERIOD)||'',upserted:Number(currentLog.AUTO_OK||0),skipped:Number(currentLog.UNMAPPED||0),locked:0};
    if(String(currentLog.STATUS)==='SUPERSEDED')throw new Error('Phiên import này đã được thay thế bởi bản mới hơn.');

    let records=Array.isArray(payload.records)?payload.records:[];
    let summary=payload.summary||{};
    let period=pdfNormalizePeriod_(payload.period);
    if(payload.useStaging){
      const staged=getPdfStaging_(importId);records=staged.records;period=pdfNormalizePeriod_(staged.period)||period;if(!summary||!Number(summary.total))summary=staged.summary||summary;
    }
    if(!period)throw new Error('Period không hợp lệ.');
    if(!records.length)throw new Error('Staging không có KPI. Không thể duyệt phiên rỗng.');
    const unresolved=records.filter(function(r){return ['NEED_REVIEW','CONFLICT'].indexOf(String(r.reviewStatus))>=0;});
    if(unresolved.length)throw new Error('Còn '+unresolved.length+' dòng chưa xử lý.');

    const catalogRows=readObjects_(PDFMOD.SHEETS.CATALOG).filter(function(r){return pdfTruthy_(r.ACTIVE);});
    const catalogById={};catalogRows.forEach(function(r){catalogById[String(r.KPI_ID||'')]=r;});
    const writable=records.filter(function(r){return String(r.reviewStatus)!=='SKIP'&&r.kpiId&&catalogById[String(r.kpiId)];});
    if(!writable.length)throw new Error('Không có KPI hợp lệ để ghi vào KPI_HISTORY.');

    const historySh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.HISTORY);
    const hHeaders=pdfHeaders_(historySh),hIdx=pdfIndex_(hHeaders);
    const hMatrix=historySh.getLastRow()>=2?historySh.getRange(2,1,historySh.getLastRow()-1,hHeaders.length).getValues():[];
    const keyToRow={};
    hMatrix.forEach(function(row,i){
      const p=pdfNormalizePeriod_(row[hIdx.PERIOD]);const id=String(row[hIdx.KPI_ID]||'');
      if(p){row[hIdx.PERIOD]=p;if(id)row[hIdx.ROW_KEY]=p+'|'+id;}
      if(id&&p)keyToRow[p+'|'+id]=i;
    });

    let upserted=0,skipped=records.length-writable.length,locked=0;const stamp=new Date();const changeRows=[];const aliasRows=[];
    writable.forEach(function(r){
      const cat=catalogById[String(r.kpiId)];const rowKey=period+'|'+String(r.kpiId);const pos=keyToRow[rowKey];
      let existing=null;if(pos!==undefined){existing={};hHeaders.forEach(function(h,j){existing[h]=hMatrix[pos][j];});}
      if(existing&&String(existing.VALUE_STATUS)==='MANUAL_OVERRIDE'&&!payload.force){locked++;return;}
      const v=r.values||{};const sourceTone=pdfToneFromStatus_(r.statusText);const tone=sourceTone||pdfTone_(cat,v);const status=String(r.statusText||pdfStatusFromTone_(tone));
      const next={ROW_KEY:rowKey,PERIOD:period,KPI_ID:String(r.kpiId),DOMAIN_ID:String(r.domainId||cat.DOMAIN_ID),LABEL:String(r.label||cat.LABEL),UNIT:String(r.unit!==undefined?r.unit:cat.UNIT),ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),STATUS:status,TONE:tone,VALUE_STATUS:'PDF_APPROVED',IMPORT_ID:importId,SOURCE_FILE:String(r.sourceFile||''),SOURCE_PAGE:Number(r.sourcePage||0),UPDATED_AT:stamp};
      const matrixRow=hHeaders.map(function(h){return next[h]===undefined?'':next[h];});
      if(pos===undefined){keyToRow[rowKey]=hMatrix.length;hMatrix.push(matrixRow);}else hMatrix[pos]=matrixRow;
      changeRows.push([stamp,String(payload.approvedBy||'pdf-admin'),rowKey,'PDF_IMPORT',existing?JSON.stringify(existing):'',JSON.stringify(next),'Approve import '+importId]);
      if(r.rememberAlias&&r.sourceLabel)aliasRows.push({source:String(r.sourceLabel),kpiId:String(r.kpiId)});
      upserted++;
    });
    if(!upserted&&locked===writable.length)throw new Error('Tất cả KPI đang bị khóa MANUAL_OVERRIDE; không có dữ liệu mới để duyệt.');
    if(hMatrix.length){historySh.getRange(2,hIdx.PERIOD+1,hMatrix.length,1).setNumberFormat('@');historySh.getRange(2,1,hMatrix.length,hHeaders.length).setValues(hMatrix);}

    pdfUpsertObject_(PDFMOD.SHEETS.SUMMARY,'PERIOD',{PERIOD:period,TOTAL:Number(summary.total||0),PASS:Number(summary.pass||0),PARTIAL:Number(summary.partial||0),FAIL:Number(summary.fail||0),IMPORT_ID:importId,UPDATED_AT:stamp});
    pdfUpdateStagingFromApprovalBatch_(importId,records);
    pdfSaveAliasRulesBatch_(aliasRows,String(payload.approvedBy||'pdf-admin'));
    if(changeRows.length&&typeof APP!=='undefined'&&APP.SHEETS&&APP.SHEETS.CHANGELOG){const logSh=SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CHANGELOG);if(logSh)logSh.getRange(logSh.getLastRow()+1,1,changeRows.length,7).setValues(changeRows);}

    pdfFinalizeImportLog_(importId,period,records,summary,stamp,String(payload.approvedBy||'pdf-admin'));
    SpreadsheetApp.flush();
    return {ok:true,importId:importId,period:period,upserted:upserted,skipped:skipped,locked:locked};
  }finally{lock.releaseLock();}
}

function pdfFinalizeImportLog_(importId,period,records,summary,stamp,user){
  const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.IMPORTS);const headers=pdfHeaders_(sh),idx=pdfIndex_(headers);
  const matrix=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];
  let currentPos=-1;matrix.forEach(function(row,i){if(String(row[idx.IMPORT_ID])===importId)currentPos=i;});
  if(currentPos<0)throw new Error('Không tìm thấy import log '+importId);
  const current={};headers.forEach(function(h,j){current[h]=matrix[currentPos][j];});
  const supersedes=pdfSupersedesFromNote_(current.NOTE);
  supersedes.forEach(function(id){matrix.forEach(function(row){if(String(row[idx.IMPORT_ID])===id&&String(row[idx.STATUS])==='APPROVED')row[idx.STATUS]='SUPERSEDED';});});
  const updates={PERIOD:period,STATUS:'APPROVED',TOTAL:records.length,AUTO_OK:records.filter(function(r){return r.reviewStatus==='AUTO_OK'||r.reviewStatus==='VERIFIED';}).length,NEED_REVIEW:0,CONFLICT:0,UNMAPPED:records.filter(function(r){return r.reviewStatus==='UNMAPPED';}).length,SUMMARY_JSON:current.SUMMARY_JSON||JSON.stringify(summary||{}),APPROVED_AT:stamp,APPROVED_BY:user,NOTE:String(current.NOTE||'')+';Approved from synchronized staging'};
  Object.keys(updates).forEach(function(name){if(idx[name]!==undefined)matrix[currentPos][idx[name]]=updates[name];});
  if(matrix.length){sh.getRange(2,idx.PERIOD+1,matrix.length,1).setNumberFormat('@');sh.getRange(2,1,matrix.length,headers.length).setValues(matrix);}
}

function getPdfPeriodData_(period){
  setupPdfImportModule();const p=pdfNormalizePeriod_(period);if(!p)return [];
  return readObjects_(PDFMOD.SHEETS.HISTORY).filter(function(r){return pdfNormalizePeriod_(r.PERIOD)===p;}).map(function(r){return {period:p,kpiId:String(r.KPI_ID||''),label:String(r.LABEL||''),unit:String(r.UNIT||''),values:{actualMonth:pdfMaybeNumber_(r.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(r.PLAN_MONTH),actualYtd:pdfMaybeNumber_(r.ACTUAL_YTD),planYtd:pdfMaybeNumber_(r.PLAN_YTD),planYear:pdfMaybeNumber_(r.PLAN_YEAR),samePeriodMonth:pdfMaybeNumber_(r.SAME_PERIOD_MONTH),samePeriodYtd:pdfMaybeNumber_(r.SAME_PERIOD_YTD)},status:String(r.STATUS||''),tone:String(r.TONE||''),valueStatus:String(r.VALUE_STATUS||''),sourceFile:String(r.SOURCE_FILE||''),sourcePage:Number(r.SOURCE_PAGE||0)};});
}

function correctImportedKpi_(payload){
  setupPdfImportModule();const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const period=pdfNormalizePeriod_(payload.period),kpiId=String(payload.kpiId||''),field=String(payload.field||'');
    const allowed={actualMonth:'ACTUAL_MONTH',planMonth:'PLAN_MONTH',actualYtd:'ACTUAL_YTD',planYtd:'PLAN_YTD',planYear:'PLAN_YEAR',samePeriodMonth:'SAME_PERIOD_MONTH',samePeriodYtd:'SAME_PERIOD_YTD'};
    if(!period||!kpiId||!allowed[field])throw new Error('Yêu cầu hiệu chỉnh không hợp lệ');
    const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.HISTORY);if(!sh||sh.getLastRow()<2)throw new Error('Chưa có dữ liệu lịch sử');
    const headers=pdfHeaders_(sh),idx=pdfIndex_(headers),matrix=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();const rowKey=period+'|'+kpiId;
    for(let i=0;i<matrix.length;i++){
      const p=pdfNormalizePeriod_(matrix[i][idx.PERIOD]),id=String(matrix[i][idx.KPI_ID]||'');if(p!==period||id!==kpiId)continue;
      const col=idx[allowed[field]],oldValue=matrix[i][col],next=payload.newValue===''||payload.newValue===null?'':Number(payload.newValue);if(next!==''&&!isFinite(next))throw new Error('Giá trị mới không hợp lệ');
      matrix[i][idx.PERIOD]=period;matrix[i][idx.ROW_KEY]=rowKey;matrix[i][col]=next;matrix[i][idx.VALUE_STATUS]='MANUAL_OVERRIDE';matrix[i][idx.UPDATED_AT]=new Date();
      const cat=pdfCatalogById_(kpiId)||{};const rowObj={};headers.forEach(function(h,j){rowObj[h]=matrix[i][j];});const v={actualMonth:pdfMaybeNumber_(rowObj.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(rowObj.PLAN_MONTH),actualYtd:pdfMaybeNumber_(rowObj.ACTUAL_YTD),planYtd:pdfMaybeNumber_(rowObj.PLAN_YTD),planYear:pdfMaybeNumber_(rowObj.PLAN_YEAR)};const tone=pdfTone_(cat,v);matrix[i][idx.TONE]=tone;matrix[i][idx.STATUS]=pdfStatusFromTone_(tone);
      sh.getRange(2,1,matrix.length,headers.length).setValues(matrix);
      if(typeof APP!=='undefined'&&APP.SHEETS&&APP.SHEETS.CHANGELOG){const log=SpreadsheetApp.getActive().getSheetByName(APP.SHEETS.CHANGELOG);if(log)log.appendRow([new Date(),String(payload.user||'pdf-admin'),rowKey,allowed[field],oldValue,next,String(payload.reason||'Hiệu chỉnh dữ liệu PDF đã duyệt')]);}
      return {ok:true,rowKey:rowKey,field:field,oldValue:oldValue,newValue:next,valueStatus:'MANUAL_OVERRIDE'};
    }
    throw new Error('Không tìm thấy KPI '+rowKey);
  }finally{lock.releaseLock();}
}

function getImportedBootstrap_(period){
  setupPdfImportModule();const historyRows=readObjects_(PDFMOD.SHEETS.HISTORY);if(!historyRows.length)return null;
  const normalized=historyRows.map(function(r){const p=pdfNormalizePeriod_(r.PERIOD);if(!p)return null;const x=Object.assign({},r);x.PERIOD=p;x.ROW_KEY=p+'|'+String(r.KPI_ID||'');return x;}).filter(Boolean);
  const periods=Array.from(new Set(normalized.map(function(r){return r.PERIOD;}))).sort();if(!periods.length)return null;
  const requested=pdfNormalizePeriod_(period);const selected=requested&&periods.indexOf(requested)>=0?requested:periods[periods.length-1];const rows=normalized.filter(function(r){return r.PERIOD===selected;});if(!rows.length)return null;
  const catalog=readObjects_(PDFMOD.SHEETS.CATALOG).filter(function(r){return pdfTruthy_(r.ACTIVE);});const byId={};catalog.forEach(function(c){byId[String(c.KPI_ID)]=c;});
  const groups={};rows.forEach(function(r){const c=byId[String(r.KPI_ID)]||{};const name=String(c.DOMAIN_NAME||r.DOMAIN_ID||'Khác');if(!groups[name])groups[name]=[];groups[name].push(pdfHistoryCard_(r,c));});
  const summaryRows=readObjects_(PDFMOD.SHEETS.SUMMARY);const summary=summaryRows.find(function(r){return pdfNormalizePeriod_(r.PERIOD)===selected;})||{};
  const calc={pass:rows.filter(function(r){return String(r.TONE)==='good';}).length,partial:rows.filter(function(r){return String(r.TONE)==='warn';}).length,fail:rows.filter(function(r){return String(r.TONE)==='bad';}).length};
  const summaryObj={total:Number(summary.TOTAL||rows.length),pass:Number(summary.PASS||calc.pass),partial:Number(summary.PARTIAL||calc.partial),fail:Number(summary.FAIL||calc.fail)};
  const history={};catalog.forEach(function(c){const id=String(c.KPI_ID);const pts=normalized.filter(function(r){return String(r.KPI_ID)===id&&r.ACTUAL_MONTH!==''&&r.ACTUAL_MONTH!==null&&r.ACTUAL_MONTH!==undefined;}).sort(function(a,b){return a.PERIOD.localeCompare(b.PERIOD);}).map(function(r){return {period:r.PERIOD,actual:Number(r.ACTUAL_MONTH),planMonth:r.PLAN_MONTH===''?undefined:Number(r.PLAN_MONTH),ytd:r.ACTUAL_YTD===''?undefined:Number(r.ACTUAL_YTD),planYtd:r.PLAN_YTD===''?undefined:Number(r.PLAN_YTD)};});if(pts.length)history[id]={id:id,unit:String(c.UNIT||''),direction:String(c.DIRECTION||'info'),aggregate:String(c.AGGREGATE||'snapshot'),decimals:Number(c.DECIMALS||2),annualPlans:pdfAnnualPlans_(normalized,id),points:pts};});
  const alerts=rows.filter(function(r){return ['bad','warn'].indexOf(String(r.TONE))>=0;}).map(function(r,i){const c=byId[String(r.KPI_ID)]||{};return {id:'IMP_ALERT_'+i+'_'+r.KPI_ID,title:String(r.LABEL)+(String(r.TONE)==='bad'?': không đạt':': cần theo dõi'),current:pdfValueDisplay_(r.ACTUAL_MONTH!==''?r.ACTUAL_MONTH:r.ACTUAL_YTD,c),target:pdfTargetDisplay_(r,c),note:'Cảnh báo tự sinh từ dữ liệu PDF đã duyệt.',domain:String(c.DOMAIN_NAME||r.DOMAIN_ID||''),severity:String(r.TONE)==='bad'?'red':'yellow',domainId:String(c.DOMAIN_ID||r.DOMAIN_ID||''),kpiId:String(r.KPI_ID)};});
  const reli=['SAIFI','SAIDI','MAIFI'].map(function(id){const r=rows.find(function(x){return String(x.KPI_ID)===id;});const c=byId[id];if(!r||!c)return null;return {id:id,unit:String(c.UNIT||''),targetYear:Number(r.PLAN_YEAR||0),targetPeriod:Number(r.PLAN_YTD||0),month:Number(r.ACTUAL_MONTH||0),ytd:Number(r.ACTUAL_YTD||0),status:String(r.STATUS||'')};}).filter(Boolean);
  const sourceFiles=Array.from(new Set(rows.map(function(r){return String(r.SOURCE_FILE||'');}).filter(Boolean))).join(' + ');
  const plans=(typeof APP!=='undefined'&&APP.SHEETS&&APP.SHEETS.PLANS)?readObjects_(APP.SHEETS.PLANS).map(function(r){return {id:String(r.ID||''),owner:String(r.OWNER||''),title:String(r.TITLE||''),status:String(r.STATUS||''),note:String(r.NOTE||'')};}):[];
  return {ok:true,period:selected,reportingDate:pdfPeriodEnd_(selected),dataMode:'apps-script',sourceLabel:sourceFiles||'PDF đã duyệt',availablePeriods:periods,history:history,summary:summaryObj,headline:rows.slice(0,6).map(function(r){return pdfHistoryCard_(r,byId[String(r.KPI_ID)]||{});}),fields:Object.keys(groups).map(function(name,i){const c=catalog.find(function(x){return String(x.DOMAIN_NAME)===name;})||{};return {id:String(c.DOMAIN_ID||'g'+(i+1)),title:name,items:groups[name]};}),reliability:reli,incidentCauses:[],alerts:alerts,conflicts:[],plans:plans,notes:['Dữ liệu lấy từ PDF đã được duyệt qua PDF Import Center.']};
}

function pdfStagingRowToRecord_(r){return {rowId:String(r.ROW_ID||''),period:pdfNormalizePeriod_(r.PERIOD)||'',docType:String(r.DOC_TYPE||'OTHER'),kpiId:String(r.KPI_ID||'')||undefined,domainId:String(r.DOMAIN_ID||'')||undefined,label:String(r.LABEL||''),unit:String(r.UNIT||'')||undefined,sourceLabel:String(r.SOURCE_LABEL||''),values:{actualMonth:pdfMaybeNumber_(r.ACTUAL_MONTH),planMonth:pdfMaybeNumber_(r.PLAN_MONTH),actualYtd:pdfMaybeNumber_(r.ACTUAL_YTD),planYtd:pdfMaybeNumber_(r.PLAN_YTD),planYear:pdfMaybeNumber_(r.PLAN_YEAR),samePeriodMonth:pdfMaybeNumber_(r.SAME_PERIOD_MONTH),samePeriodYtd:pdfMaybeNumber_(r.SAME_PERIOD_YTD)},statusText:String(r.STATUS_TEXT||''),confidence:Number(r.CONFIDENCE||0),sourceFile:String(r.SOURCE_FILE||''),sourcePage:Number(r.SOURCE_PAGE||0),sourceExcerpt:String(r.SOURCE_EXCERPT||''),reviewStatus:String(r.REVIEW_STATUS||'NEED_REVIEW'),issues:pdfJsonArray_(r.ISSUES),conflicts:pdfJsonArray_(r.CONFLICTS_JSON),rememberAlias:pdfTruthy_(r.REMEMBER_ALIAS),reviewNote:String(r.REVIEW_NOTE||''),reviewedBy:String(r.REVIEWED_BY||''),reviewedAt:r.REVIEWED_AT?pdfIso_(r.REVIEWED_AT):undefined,updatedAt:r.UPDATED_AT?pdfIso_(r.UPDATED_AT):undefined};}

function pdfUpdateStagingFromApprovalBatch_(importId,records){
  const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.STAGING);if(!sh||sh.getLastRow()<2)return;
  const headers=pdfHeaders_(sh),idx=pdfIndex_(headers),matrix=sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues(),map={};records.forEach(function(r){map[String(r.rowId||'')]=r;});const stamp=new Date();
  matrix.forEach(function(row){if(String(row[idx.IMPORT_ID])!==importId)return;const r=map[String(row[idx.ROW_ID]||'')];if(!r)return;const v=r.values||{};const updates={KPI_ID:r.kpiId||'',DOMAIN_ID:r.domainId||'',LABEL:r.label||'',UNIT:r.unit||'',ACTUAL_MONTH:pdfNumOrBlank_(v.actualMonth),PLAN_MONTH:pdfNumOrBlank_(v.planMonth),ACTUAL_YTD:pdfNumOrBlank_(v.actualYtd),PLAN_YTD:pdfNumOrBlank_(v.planYtd),PLAN_YEAR:pdfNumOrBlank_(v.planYear),SAME_PERIOD_MONTH:pdfNumOrBlank_(v.samePeriodMonth),SAME_PERIOD_YTD:pdfNumOrBlank_(v.samePeriodYtd),REVIEW_STATUS:r.reviewStatus||'',REMEMBER_ALIAS:Boolean(r.rememberAlias),UPDATED_AT:stamp};Object.keys(updates).forEach(function(name){if(idx[name]!==undefined)row[idx[name]]=updates[name];});});
  sh.getRange(2,1,matrix.length,headers.length).setValues(matrix);
}

function pdfUpdateImportCounts_(importId){
  const rows=readObjects_(PDFMOD.SHEETS.STAGING).filter(function(r){return String(r.IMPORT_ID)===importId;});const c=pdfFindObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',importId)||{};
  pdfUpsertObject_(PDFMOD.SHEETS.IMPORTS,'IMPORT_ID',{IMPORT_ID:importId,PERIOD:pdfNormalizePeriod_(c.PERIOD)||'',FILES:c.FILES||'',FINGERPRINTS:c.FINGERPRINTS||'',STATUS:c.STATUS||'STAGED',TOTAL:rows.length,AUTO_OK:rows.filter(function(r){return String(r.REVIEW_STATUS)==='AUTO_OK'||String(r.REVIEW_STATUS)==='VERIFIED';}).length,NEED_REVIEW:rows.filter(function(r){return String(r.REVIEW_STATUS)==='NEED_REVIEW';}).length,CONFLICT:rows.filter(function(r){return String(r.REVIEW_STATUS)==='CONFLICT';}).length,UNMAPPED:rows.filter(function(r){return String(r.REVIEW_STATUS)==='UNMAPPED';}).length,SUMMARY_JSON:c.SUMMARY_JSON||'',CREATED_AT:c.CREATED_AT||new Date(),APPROVED_AT:c.APPROVED_AT||'',APPROVED_BY:c.APPROVED_BY||'',NOTE:c.NOTE||''});
}

function pdfSaveAliasRulesBatch_(items,user){
  if(!items||!items.length)return;const sh=SpreadsheetApp.getActive().getSheetByName(PDFMOD.SHEETS.RULES),existing=readObjects_(PDFMOD.SHEETS.RULES),seen={};existing.forEach(function(r){seen[String(r.SOURCE_PATTERN||'').trim().toLowerCase()+'|'+String(r.KPI_ID||'')]=true;});const rows=[];
  items.forEach(function(x){const source=String(x.source||'').trim(),id=String(x.kpiId||'');const key=source.toLowerCase()+'|'+id;if(!source||!id||seen[key])return;seen[key]=true;rows.push({RULE_ID:'ALIAS_'+Utilities.getUuid(),TYPE:'ALIAS',SOURCE_PATTERN:source,KPI_ID:id,FIELD:'',VALUE:'',ACTION:'MAP',ACTIVE:true,CREATED_AT:new Date(),CREATED_BY:user});});if(rows.length)appendObjects_(PDFMOD.SHEETS.RULES,rows);
}

function onOpen(){try{SpreadsheetApp.getUi().createMenu('PDF Review').addItem('Mở bảng staging','openPdfStaging_').addSeparator().addItem('Xác nhận các dòng đang chọn','verifySelectedPdfRows_').addItem('Bỏ qua các dòng đang chọn','skipSelectedPdfRows_').addToUi();}catch(e){}}
function openPdfStaging_(){const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(PDFMOD.SHEETS.STAGING);if(sh)ss.setActiveSheet(sh);}
function verifySelectedPdfRows_(){pdfMarkSelectedRows_('VERIFIED');}
function skipSelectedPdfRows_(){pdfMarkSelectedRows_('SKIP');}
function pdfMarkSelectedRows_(status){const ss=SpreadsheetApp.getActive(),sh=ss.getActiveSheet();if(!sh||sh.getName()!==PDFMOD.SHEETS.STAGING)throw new Error('Hãy chọn dòng trong 03_PDF_STAGING');const range=sh.getActiveRange();if(!range)return;const headers=pdfHeaders_(sh),idx=pdfIndex_(headers),start=Math.max(2,range.getRow()),end=range.getLastRow(),user=Session.getActiveUser().getEmail()||'sheet-user',stamp=new Date();const rows=end-start+1,matrix=sh.getRange(start,1,rows,headers.length).getValues();matrix.forEach(function(row){row[idx.REVIEW_STATUS]=status;if(idx.REVIEWED_BY!==undefined)row[idx.REVIEWED_BY]=user;if(idx.REVIEWED_AT!==undefined)row[idx.REVIEWED_AT]=stamp;if(idx.UPDATED_AT!==undefined)row[idx.UPDATED_AT]=stamp;});sh.getRange(start,1,rows,headers.length).setValues(matrix);}

function onEdit(e){try{if(!e||!e.range)return;const sh=e.range.getSheet();if(sh.getName()!==PDFMOD.SHEETS.STAGING||e.range.getRow()<=1)return;const headers=pdfHeaders_(sh),idx=pdfIndex_(headers),edited=headers[e.range.getColumn()-1]||'',valueFields=['KPI_ID','DOMAIN_ID','LABEL','UNIT','ACTUAL_MONTH','PLAN_MONTH','ACTUAL_YTD','PLAN_YTD','PLAN_YEAR','SAME_PERIOD_MONTH','SAME_PERIOD_YTD'];const row=e.range.getRow();if(valueFields.indexOf(edited)>=0&&idx.REVIEW_STATUS!==undefined){const cell=sh.getRange(row,idx.REVIEW_STATUS+1);if(String(cell.getValue())!=='SKIP')cell.setValue('NEED_REVIEW');}if(idx.UPDATED_AT!==undefined)sh.getRange(row,idx.UPDATED_AT+1).setValue(new Date());if(idx.REVIEWED_BY!==undefined)sh.getRange(row,idx.REVIEWED_BY+1).setValue(Session.getActiveUser().getEmail()||'sheet-user');if(edited==='REVIEW_STATUS'&&['VERIFIED','SKIP'].indexOf(String(e.value||''))>=0&&idx.REVIEWED_AT!==undefined)sh.getRange(row,idx.REVIEWED_AT+1).setValue(new Date());}catch(err){console.warn('PDF staging onEdit',err);}}

function generateApiKeyForVercel(){const key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');PropertiesService.getScriptProperties().setProperty('API_KEY',key);console.log('APPS_SCRIPT_API_KEY='+key);return key;}

function pdfNormalizePeriod_(value){
  const tz=SpreadsheetApp.getActive().getSpreadsheetTimeZone()||Session.getScriptTimeZone()||'Asia/Ho_Chi_Minh';
  if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,tz,'yyyy-MM');
  const raw=String(value==null?'':value).trim();if(!raw)return '';
  let m=raw.match(/^(\d{4})-(0[1-9]|1[0-2])$/);if(m)return m[1]+'-'+m[2];
  m=raw.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(\d{4})\b/);if(m){const months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};return m[2]+'-'+months[m[1]];}
  m=raw.match(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])\b/);if(m)return m[1]+'-'+String(Number(m[2])).padStart(2,'0');
  const d=new Date(raw);if(!isNaN(d.getTime()))return Utilities.formatDate(d,tz,'yyyy-MM');return '';
}

function pdfEnsureSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);else{const existing=pdfHeaders_(sh);headers.forEach(function(h){if(existing.indexOf(h)<0){sh.getRange(1,sh.getLastColumn()+1).setValue(h);existing.push(h);}});}sh.setFrozenRows(1);sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold');return sh;}
function pdfFormatPeriodColumn_(sh){if(!sh)return;const headers=pdfHeaders_(sh),idx=headers.indexOf('PERIOD');if(idx<0)return;const max=Math.max(1,sh.getMaxRows()-1);sh.getRange(2,idx+1,max,1).setNumberFormat('@');}
function pdfHeaders_(sh){return sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);}
function pdfIndex_(headers){const out={};headers.forEach(function(h,i){out[h]=i;});return out;}
function pdfUpsertObject_(sheetName,keyField,obj){const sh=SpreadsheetApp.getActive().getSheetByName(sheetName),headers=pdfHeaders_(sh),idx=headers.indexOf(keyField);if(idx<0)throw new Error('Missing key '+keyField);const rows=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues():[];let pos=-1;for(let i=0;i<rows.length;i++){let key=rows[i][idx];if(keyField==='PERIOD')key=pdfNormalizePeriod_(key);if(String(key)===String(obj[keyField])){pos=i;break;}}const matrix=headers.map(function(h){return obj[h]===undefined?'':obj[h];});if(pos<0){sh.getRange(sh.getLastRow()+1,1,1,headers.length).setValues([matrix]);}else{headers.forEach(function(h,j){if(obj[h]!==undefined)rows[pos][j]=obj[h];});sh.getRange(pos+2,1,1,headers.length).setValues([rows[pos]]);}return pos<0?sh.getLastRow():pos+2;}
function pdfFindObject_(sheetName,keyField,key){return readObjects_(sheetName).find(function(r){const v=keyField==='PERIOD'?pdfNormalizePeriod_(r[keyField]):String(r[keyField]);return String(v)===String(key);});}
function pdfDeleteRowsByKey_(sheetName,keyField,key){const sh=SpreadsheetApp.getActive().getSheetByName(sheetName);if(!sh||sh.getLastRow()<2)return;const headers=pdfHeaders_(sh),idx=headers.indexOf(keyField);if(idx<0)return;const vals=sh.getRange(2,idx+1,sh.getLastRow()-1,1).getValues();for(let i=vals.length-1;i>=0;i--)if(String(vals[i][0])===String(key))sh.deleteRow(i+2);}
function pdfCatalogById_(id){return readObjects_(PDFMOD.SHEETS.CATALOG).find(function(r){return String(r.KPI_ID)===String(id);});}
function pdfMaybeNumber_(v){if(v===undefined||v===null||v==='')return undefined;const n=Number(v);return isFinite(n)?n:undefined;}
function pdfNumOrBlank_(v){if(v===undefined||v===null||v==='')return '';const n=Number(v);return isFinite(n)?n:'';}
function pdfTruthy_(v){return v===true||String(v).toUpperCase()==='TRUE'||String(v)==='1';}
function pdfJsonArray_(v){try{const x=JSON.parse(String(v||'[]'));return Array.isArray(x)?x:[];}catch(e){return [];}}
function pdfIso_(v){try{return new Date(v).toISOString();}catch(e){return String(v||'');}}
function pdfSplitFingerprints_(v){return String(v||'').split('|').map(function(x){return x.trim();}).filter(Boolean);}
function pdfParserVersionFromNote_(note){const m=String(note||'').match(/(?:^|;)PARSER_VERSION=([^;]+)/);return m?String(m[1]).trim():'';}
function pdfSupersedesFromNote_(note){const m=String(note||'').match(/(?:^|;)SUPERSEDES=([^;]+)/);return m?String(m[1]).split(',').map(function(x){return x.trim();}).filter(Boolean):[];}
function pdfStagingSheetUrl_(){const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(PDFMOD.SHEETS.STAGING);return ss.getUrl()+(sh?'#gid='+sh.getSheetId():'');}
function pdfPeriodEnd_(period){const p=String(period).split('-').map(Number),d=new Date(p[0],p[1],0);return Utilities.formatDate(d,Session.getScriptTimeZone()||'Asia/Ho_Chi_Minh','dd/MM/yyyy');}
function pdfHistoryCard_(r,c){const val=r.ACTUAL_MONTH!==''?r.ACTUAL_MONTH:r.ACTUAL_YTD,plan=r.PLAN_MONTH!==''?r.PLAN_MONTH:(r.PLAN_YTD!==''?r.PLAN_YTD:r.PLAN_YEAR);return {id:String(r.KPI_ID),label:String(r.LABEL||c.LABEL||r.KPI_ID),value:pdfValueDisplay_(val,c),detail:plan!==''?'KH: '+pdfValueDisplay_(plan,c):'',plan:r.ACTUAL_YTD!==''?'Lũy kế: '+pdfValueDisplay_(r.ACTUAL_YTD,c):'',tone:String(r.TONE||'neutral'),status:String(r.STATUS||''),sourcePage:Number(r.SOURCE_PAGE||0)||undefined};}
function pdfValueDisplay_(value,c){if(value===''||value===null||value===undefined)return '—';const d=Number(c.DECIMALS||2),n=Number(value);return (isFinite(n)?n.toLocaleString('vi-VN',{minimumFractionDigits:0,maximumFractionDigits:d}):String(value))+(c.UNIT?' '+c.UNIT:'');}
function pdfTargetDisplay_(r,c){const x=r.PLAN_MONTH!==''?r.PLAN_MONTH:(r.PLAN_YTD!==''?r.PLAN_YTD:r.PLAN_YEAR);return x===''?'':pdfValueDisplay_(x,c);}
function pdfAnnualPlans_(rows,id){const out={};rows.filter(function(r){return String(r.KPI_ID)===id&&r.PLAN_YEAR!=='';}).forEach(function(r){const p=pdfNormalizePeriod_(r.PERIOD);if(p)out[p.slice(0,4)]=Number(r.PLAN_YEAR);});return out;}
function pdfToneFromStatus_(status){const s=String(status||'').toLowerCase();if(!s)return '';if(s.indexOf('đạt một phần')>=0||s.indexOf('dat mot phan')>=0||s.indexOf('đạt 1 phần')>=0)return 'warn';if(s.indexOf('không đạt')>=0||s.indexOf('khong dat')>=0||s.indexOf('chưa đạt')>=0||s.indexOf('k.đạt')>=0||s.indexOf('k đạt')>=0)return 'bad';if(s.indexOf('đạt')>=0||s==='dat')return 'good';return '';}
function pdfTone_(catalog,v){const dir=String(catalog.DIRECTION||'info');if(dir==='info')return 'neutral';let a,p;if(v.actualMonth!==undefined&&v.planMonth!==undefined){a=v.actualMonth;p=v.planMonth;}else if(v.actualYtd!==undefined&&v.planYtd!==undefined){a=v.actualYtd;p=v.planYtd;}else if(v.actualYtd!==undefined&&v.planYear!==undefined){a=v.actualYtd;p=v.planYear;}else return 'neutral';if(p===undefined||Number(p)===0)return 'neutral';const ratio=Number(a)/Number(p)*100;if(dir==='higher')return ratio>=100?'good':ratio>=95?'warn':'bad';return ratio<=100?'good':ratio<=110?'warn':'bad';}
function pdfStatusFromTone_(tone){return tone==='good'?'Đạt':tone==='warn'?'Theo dõi':tone==='bad'?'Không đạt':'Thông tin';}
