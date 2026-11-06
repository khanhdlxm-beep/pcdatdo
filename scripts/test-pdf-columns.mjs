import assert from 'node:assert/strict';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

registerHooks({ resolve(specifier, context, next) {
  return specifier.startsWith('@/') ? next(pathToFileURL(path.resolve(specifier.slice(2) + '.ts')).href, context) : next(specifier, context);
}});
const { parseViNumber } = await import('../lib/vi-number.ts');
const { applyColumnExtraction } = await import('../lib/pdf-columns.ts');
const { applyHistoricalDhsxExtractors } = await import('../lib/pdf-dhsx-history.ts');
for (const [raw, expected] of [['3.246',3246],['1.987,654',1987.654],['123, 4',123.4],['2.93',2.93],['0,003',0.003],['',undefined],['-',undefined],['-,000',undefined],['2,272,52',undefined]]) {
  assert.equal(parseViNumber(raw), expected, raw);
}
const item=(text,x,y,width=20)=>({text,x,y,width});
const items=[
  item('Chỉ tiêu',110,700,38),item('ĐVT',205,700),item('Kế hoạch',255,706,44),
  item('Thực hiện',323,706,48),item('Thực hiện',392,706,48),item('So với',456,719,29),item('So với',502,719,29),item('Đánh',550,706,28),
  item('1',52,660,6),item('Phát triển khách hàng',76,660,108),item('KH',208,660,12),item('42',340,660,18),item('850',407,660,24),item('Đạt',550,660,18),
  item('4',52,630,6),item('Sản lượng điện',76,636,75),item('thương phẩm',76,624,66),item('Tr.kWh',198,630,37),item('1.000',264,630,30),item('80, 2',332,630,29),item('740,5',398,630,38),item('74,05',457,636,28),item('Đạt',550,630,18),
  item('10',50,600,12),item('Kiểm tra xử lý vi',76,606,75),item('phạm sử dụng điện',76,594,90),item('kWh',205,600,20),item('80.000',263,600,34),item('-',345,600,4),item('12.345',401,600,33),item('15,4%',456,600,27),item('K Đạt',550,600,24),
];
const doc={name:'bao cao DHSX.pdf',size:1,fingerprint:'fake',pages:[{page:1,text:'',lines:[],items}]};
const old={kpiId:'KD_DTP',values:{planMonth:99,actualMonth:999},issues:[],reviewStatus:'AUTO_OK'};
const result=applyColumnExtraction({period:'2026-10',records:[old],notes:[]},[doc]);
const get=id=>result.records.find(x=>x.kpiId===id);
assert.deepEqual(get('KD_DTP').values,{planYear:1000,actualMonth:80.2,actualYtd:740.5});
assert.equal(get('KD_DTP').sourceCells.compareYear,'74,05');
assert.equal(get('KD_DTP').sourceCells.comparePeriod,'');
assert.equal(get('GANMOI').values.planYear,undefined);
assert.equal(get('KD_VIPHAM').values.actualMonth,undefined);
assert.equal(get('KD_VIPHAM').values.actualYtd,12345);
assert.equal(get('KD_VIPHAM').statusText,'Không đạt');
const noCoordinates=applyColumnExtraction({period:'2026-10',records:[old],notes:[]},[{...doc,pages:[{page:1,text:'',lines:[]}]}]);
assert.deepEqual(noCoordinates.records[0].values,{});
assert.equal(noCoordinates.records[0].reviewStatus,'NEED_REVIEW');
// Different tables may have unrelated columns and deliberately empty months.
const forecastItems=[item('* Dự báo Điện thương phẩm:',60,700,140),
  item('Dự báo',140,680,30),item('Thực hiện',240,680,50),item('Sai số',360,680,30),item('Đánh giá',460,680,45),
  item('100.000',140,650,35),item('110.000',240,650,35),item('7,25%',360,650,30),item('Không đạt',460,650,48)];
const staffItems=[item('Chỉ',300,700,15),item('Trong',340,700,23),item('Lũy kế',390,700,30),item('% so với',450,700,35),item('Đánh',510,700,25),
  item('Số khách hàng/ Số',130,650,85),item('CBCNV',130,637,35),item('KH',260,644,15),item('500',300,644,20),item('480,25',390,644,35),item('96,05%',450,644,35),item('Dự kiến',510,650,32),item('đạt',510,637,16)];
const sclItems=[item('Kế',290,700,15),item('tháng',340,700,25),item('lũy kế',390,700,30),item('Tỷ lệ',450,700,25),item('Ghi chú',500,700,35),
  item('Giá trị thực hiện',110,650,80),item('Tỷ đồng',230,650,40),item('20,000',290,650,35),item('15,250',390,650,35),item('76,25',450,650,25)];
const crmItems=[item('Hệ thống CRM',90,700,85),item('Tiếp nhận',250,680,35),item('Đã xử',310,680,25),item('Đang xử',350,680,32),item('Tiếp',410,680,20),item('Đã xử',455,680,25),item('Đang',510,680,25),
  item('Tổng cộng',140,640,55),item('100',255,640,20),item('75',315,640,15),item('25',355,640,15),item('1.000',410,640,30),item('900',455,640,20),item('100',510,640,20)];
const supplement=applyColumnExtraction({period:'2026-10',records:[],notes:[]},[{...doc,pages:[
  {page:1,text:'',lines:[],items:forecastItems}, {page:2,text:'Công tác SCL',lines:[],items:[]},
  {page:3,text:'',lines:[],items:sclItems}, {page:4,text:'',lines:[],items:staffItems}, {page:5,text:'',lines:[],items:crmItems},
]}]);
const extra=id=>supplement.records.find(x=>x.kpiId===id);
assert.deepEqual(extra('KD_DBPT').values,{actualMonth:7.25});
assert.equal(extra('KD_DBPT').statusText,'Không đạt');
assert.deepEqual(extra('SCL').values,{planYear:20,actualYtd:15.25});
assert.deepEqual(extra('NSLD_KH').values,{planYear:500,actualYtd:480.25});
assert.equal(extra('NSLD_KH').statusText,'Dự kiến đạt');
assert.deepEqual(extra('CRM').values,{actualMonth:75,actualYtd:90});
const missingCrmCell=applyColumnExtraction({period:'2026-10',records:[],notes:[]},[{...doc,pages:[{page:1,text:'',lines:[],items:crmItems.filter(i=>!(i.text==='75'&&i.y===640))}]}]);
assert.deepEqual(missingCrmCell.records[0].values,{actualYtd:90});
assert.equal(missingCrmCell.records[0].reviewStatus,'NEED_REVIEW');
const missingForecastHeader=applyColumnExtraction({period:'2026-10',records:[],notes:[]},[{...doc,pages:[{page:1,text:'',lines:[],items:forecastItems.filter(i=>i.text!=='Sai số')}]}]);
assert.equal(missingForecastHeader.records.some(x=>x.kpiId==='KD_DBPT'),false);
const summaryText='Có 12/15 chỉ tiêu thực hiện đạt: 02 chỉ tiêu không đạt và 01 chỉ tiêu đạt một phần.';
const summaryResult=applyHistoricalDhsxExtractors({period:'2026-10',records:[],notes:[],summary:{total:4,pass:3,fail:1,partial:0,detected:true}},[{...doc,pages:[{page:1,text:summaryText,lines:[summaryText]}]}]);
assert.deepEqual(summaryResult.summary,{total:15,pass:12,fail:2,partial:1,detected:true});
console.log('PDF columns: number formats, blank cells, wrapped rows and unsafe fallback passed.');

// Reprocessing the same PDF must not delete an older KPI that was skipped.
const { readFileSync } = await import('node:fs');
const vm = await import('node:vm');
let didApprove=false;
let stagedRows=[{kpiId:'SAIDI',reviewStatus:'SKIP'}];
let priorRows=[{PERIOD:'2026-10',KPI_ID:'SAIDI',IMPORT_ID:'old',VALUE_STATUS:'PDF_APPROVED'}];
const gas={PDFMOD:{SHEETS:{HISTORY:'06_KPI_HISTORY'}},pdfFindObject_:()=>({NOTE:'old'}),pdfSupersedesFromNote_:()=>['old'],
  getPdfStaging_:()=>({period:'2026-10',records:stagedRows}),readObjects_:()=>priorRows,
  pdfNormalizePeriod_:x=>x,approvePdfImport_:()=>{didApprove=true;return {ok:true}},cleanupSupersededPdfData_:()=>{}};
vm.runInNewContext(readFileSync('apps-script/Code.gs','utf8'),gas);
gas.cleanupSupersededPdfData_=()=>{};gas.readObjects_=()=>priorRows;
assert.throws(()=>gas.approvePdfImportProduction_({importId:'new'}),/chưa được xác nhận/);
assert.equal(didApprove,false);
stagedRows=[{kpiId:'SAIDI',reviewStatus:'VERIFIED'}];
assert.equal(gas.approvePdfImportProduction_({importId:'new'}).ok,true);
didApprove=false;priorRows=[{PERIOD:'2026-09',KPI_ID:'SAIDI',IMPORT_ID:'old',VALUE_STATUS:'PDF_APPROVED'}];
assert.throws(()=>gas.approvePdfImportProduction_({importId:'new'}),/chưa được xác nhận/);
assert.equal(didApprove,false);
console.log('PDF re-import: skipped and different-period records cannot be removed.');

// A row with a blank monthly value must still expose its real year-to-date value.
const gasPdf={APP:{SHEETS:{}},readObjects_:()=>[]};
vm.runInNewContext(readFileSync('apps-script/PdfImport.gs','utf8'),gasPdf);
gasPdf.setupPdfImportModule=()=>{};
gasPdf.pdfNormalizePeriod_=x=>x;
gasPdf.pdfPeriodEnd_=()=>'';
gasPdf.readObjects_=(sheet)=>sheet==='06_KPI_HISTORY'?[{PERIOD:'2026-10',KPI_ID:'SCL',DOMAIN_ID:'test',LABEL:'SCL',UNIT:'Tỷ đồng',ACTUAL_MONTH:'',ACTUAL_YTD:15.25,PLAN_MONTH:'',PLAN_YTD:'',PLAN_YEAR:20,TONE:'neutral'}]:sheet==='01_DM_CHITIEU'?[{KPI_ID:'SCL',DOMAIN_ID:'test',DOMAIN_NAME:'Test',UNIT:'Tỷ đồng',ACTIVE:true}]:[];
const snapshot=gasPdf.getImportedBootstrap_('2026-10');
assert.equal(snapshot.history.SCL.points[0].actual,undefined);
assert.equal(snapshot.history.SCL.points[0].ytd,15.25);
assert.equal(snapshot.fields[0].items[0].value,'—');
assert.equal(gasPdf.pdfDecimals_({DECIMALS:0}),0);
assert.equal(gasPdf.pdfDecimals_({DECIMALS:3}),3);
assert.equal(gasPdf.pdfDecimals_({DECIMALS:''}),2);
console.log('Dashboard history: blank month and real year-to-date values are distinct.');
