import { KPI_BY_ID, normalizeLookup } from '@/lib/kpi-catalog';
import { parseViNumber } from '@/lib/pdf-parser';
import type { PdfExtractedDocument, PdfImportRecord, PdfNumericValues, PdfParseResult, PdfPeriodSummary } from '@/types/pdf-import';

export const PDF_PARSER_VERSION = '1.8.2-history';

type ExtractedRow = { page:number; rowNo:string; text:string; normalized:string };
type LineRef = { page:number; text:string; normalized:string };

const NUM_RE=/-?\s*\d[\d.,]*/g;

function nums(text:string){
  const clean=String(text||'')
    .replace(/(\d)\.\s+(\d{3})(?!\d)/g,'$1.$2')
    .replace(/(\d),\s+(\d{3})(?!\d)/g,'$1,$2');
  return (clean.match(NUM_RE)||[]).map(parseViNumber).filter((x):x is number=>x!==undefined);
}

function hasValue(v:PdfNumericValues){return Object.values(v).some((x)=>x!==undefined&&Number.isFinite(Number(x)));}

function statusFrom(text:string){
  const n=normalizeLookup(text);
  if(n.includes('dat 1 phan')||n.includes('dat mot phan'))return 'Đạt một phần';
  if(n.includes('chua dat')||n.includes('khong dat')||n.includes('k dat'))return 'Không đạt';
  if(n.includes('chua thuc hien'))return 'Chưa thực hiện';
  if(/(^| )dat( |$)/.test(n))return 'Đạt';
  return '';
}

function collectRows(doc:PdfExtractedDocument):ExtractedRow[]{
  const out:ExtractedRow[]=[];
  for(const page of doc.pages){
    let current:string[]=[];let rowNo='';
    const flush=()=>{if(!current.length||!rowNo)return;const text=current.join(' ').replace(/\s+/g,' ').trim();out.push({page:page.page,rowNo,text,normalized:normalizeLookup(text)});current=[];rowNo='';};
    for(const raw of page.lines||[]){
      const line=String(raw||'').trim();
      const m=line.match(/^(\d{1,2}(?:[.,]\d+)?)\s+(.+)/);
      if(m){flush();rowNo=m[1].replace(',','.');current=[line];}
      else if(current.length){if(/^[IVX]+\.?\s+[A-ZÀ-Ỹ]/.test(line)||/^\d+\.?\s*Công tác\b/i.test(line))flush();else current.push(line);}
    }
    flush();
  }
  return out;
}

function pageLines(doc:PdfExtractedDocument,needles:string[]):LineRef[]{
  const ns=needles.map(normalizeLookup);const out:LineRef[]=[];
  for(const page of doc.pages){const pageNorm=normalizeLookup(page.text||'');if(!ns.every((n)=>pageNorm.includes(n)))continue;for(const line of page.lines||[]){const text=String(line||'').replace(/\s+/g,' ').trim();if(text)out.push({page:page.page,text,normalized:normalizeLookup(text)});}}
  return out;
}

function after(text:string,re:RegExp){const m=re.exec(text);if(!m)return [];return nums(text.slice(m.index+m[0].length));}
function millionKwh(n:number|undefined){if(n===undefined)return undefined;return Math.abs(n)>=100000?n/1_000_000:n;}
function billion(n:number|undefined){if(n===undefined)return undefined;return Math.abs(n)>=100000?n/1000:n;}
function price(n:number|undefined){if(n===undefined)return undefined;return Math.abs(n)>0&&Math.abs(n)<10?n*1000:n;}

function standardPlanMonthYtd(n:number[],opts:{allowPlanYtd?:boolean;transform?:(x:number|undefined)=>number|undefined}={}):PdfNumericValues{
  const cv=opts.transform||((x:number|undefined)=>x);
  if(n.length>=4&&opts.allowPlanYtd&&Math.abs(n[1])>Math.max(1,Math.abs(n[2]))*1.35)return {planYear:cv(n[0]),planYtd:cv(n[1]),actualMonth:cv(n[2]),actualYtd:cv(n[3])};
  if(n.length>=3)return {planYear:cv(n[0]),actualMonth:cv(n[1]),actualYtd:cv(n[2])};
  if(n.length===2)return {actualMonth:cv(n[0]),actualYtd:cv(n[1])};
  if(n.length===1)return {actualMonth:cv(n[0])};
  return {};
}

function rec(period:string,doc:PdfExtractedDocument,row:{page:number;text:string},id:string,values:PdfNumericValues,confidence:number,issues:string[]=[]):PdfImportRecord|undefined{
  const k=KPI_BY_ID[id];if(!k||!hasValue(values))return undefined;
  return {rowId:`${period}|${id}`,period,docType:'DHSX',kpiId:id,domainId:k.domainId,label:k.label,unit:k.unit,sourceLabel:'DHSX-history',values,statusText:statusFrom(row.text),confidence,sourceFile:doc.name,sourcePage:row.page,sourceExcerpt:row.text.slice(0,900),reviewStatus:confidence>=.9?'AUTO_OK':'NEED_REVIEW',issues,conflicts:[]};
}

function findRow(rows:ExtractedRow[],needles:string[],rowNos:string[]=[]){const ns=needles.map(normalizeLookup);return rows.find((r)=>(!rowNos.length||rowNos.includes(r.rowNo))&&ns.every((n)=>r.normalized.includes(n)));}

function extractBusiness(period:string,doc:PdfExtractedDocument,rows:ExtractedRow[]){
  const out:PdfImportRecord[]=[];const add=(x:PdfImportRecord|undefined)=>{if(x)out.push(x);};let r:ExtractedRow|undefined;
  r=findRow(rows,['dien nhan'],['2']);if(r){const n=after(r.text,/Tr\.?\s*kW\s*h|Tr\.?\s*kWh/i);const v=n.length>=4?{planYear:millionKwh(n[0]),planYtd:millionKwh(n[1]),actualMonth:millionKwh(n[2]),actualYtd:millionKwh(n[3])}:n.length>=2?{actualMonth:millionKwh(n[0]),actualYtd:millionKwh(n[1])}:{};add(rec(period,doc,r,'KD_DIENNHAN',v,.98));}
  r=findRow(rows,['co cau dien mua'],['3']);if(r){const direct=nums(r.text.replace(/^3\s+/,'')).filter((x)=>x>=0&&x<=100);if(direct.length>=2)add(rec(period,doc,r,'KD_COCADIENMUA',{actualMonth:direct[0],actualYtd:direct[1]},.96));else{const peak=findRow(rows,['cao diem'],['3.1']),low=findRow(rows,['thap diem'],['3.2']),normal=findRow(rows,['binh thuong'],['3.3']);const parts=[peak,low,normal].map((x)=>x?after(x.text,/%|Tr\.?\s*kW\s*h|Tr\.?\s*kWh/i):[]);if(parts.every((x)=>x.length)){const month=parts.reduce((s,x)=>s+(x[0]||0),0),ytd=parts.reduce((s,x)=>s+(x[1]??x[0]??0),0);add(rec(period,doc,r,'KD_COCADIENMUA',{actualMonth:Number(month.toFixed(2)),actualYtd:Number(ytd.toFixed(2))},.9,['Tổng cơ cấu được cộng từ Cao điểm/Thấp điểm/Bình thường.']));}}}
  r=findRow(rows,['san luong','dien thuong'],['4']);if(r)add(rec(period,doc,r,'KD_DTP',standardPlanMonthYtd(after(r.text,/Tr\.?\s*kW\s*h|Tr\.?\s*kWh/i),{allowPlanYtd:true,transform:millionKwh}),.99));
  r=findRow(rows,['tong doanh thu'],['5']);if(r)add(rec(period,doc,r,'KD_DT',standardPlanMonthYtd(after(r.text,/Tỷ\s*đồng|Ty\s*dong/i),{transform:billion}),.99));
  r=findRow(rows,['gia ban dien','binh quan'],['6']);if(r)add(rec(period,doc,r,'KD_GIA',standardPlanMonthYtd(after(r.text,/đ\s*\/\s*kWh|d\s*\/\s*kWh/i),{transform:price}),.99));
  r=findRow(rows,['gia mua dien','binh quan'],['7']);if(r)add(rec(period,doc,r,'KD_GIAMUA',standardPlanMonthYtd(after(r.text,/đ\s*\/\s*kWh|d\s*\/\s*kWh/i),{transform:price}),.96));
  r=findRow(rows,['ton that','dien nang'],['8.1']);if(r)add(rec(period,doc,r,'KD_TT',standardPlanMonthYtd(after(r.text,/%/i)),.99));
  r=findRow(rows,['bao tri'],['9']);if(r){const n=nums(r.text.replace(/^9\s+/,'')).filter((x)=>x<1000000);const v=n.length>=3?{planYear:n[0],actualMonth:n[1],actualYtd:n[2]}:n.length>=2?{actualMonth:n[0],actualYtd:n[1]}:{};add(rec(period,doc,r,'KD_CONGTO',v,.9,['Chỉ lấy số trên đúng dòng Bảo trì TBĐĐ; không suy số từ câu mô tả công tơ 1 giá/năm.']));}
  r=findRow(rows,['kiem tra xu ly','vi pham','su dung dien'],['10']);if(r)add(rec(period,doc,r,'KD_VIPHAM',standardPlanMonthYtd(after(r.text,/kWh/i)),.95));
  r=findRow(rows,['tiet kiem dien'],['11','9']);if(r)add(rec(period,doc,r,'KD_TKIEM',standardPlanMonthYtd(after(r.text,/Tr\.?\s*kW\s*h|Tr\.?\s*kWh/i),{allowPlanYtd:true,transform:millionKwh}),.97));
  const thuRows=rows.filter((x)=>x.normalized.includes('ty le thu tien dien')&&!x.normalized.includes('theo phien'));r=thuRows.find((x)=>after(x.text,/%/).length>=3)||thuRows[0];if(r){const n=after(r.text,/%/i);const v=n.length>=3?{planYear:n[0],actualMonth:n[1],actualYtd:n[2]}:n.length===2?{planYear:n[0],actualMonth:n[1],actualYtd:n[1]}:{};add(rec(period,doc,r,'KD_THUNGAN',v,n.length>=3?.98:.88,n.length>=3?[]:['Báo cáo chỉ thể hiện một giá trị thực hiện; cần kiểm tra trước khi duyệt.']));}
  r=findRow(rows,['hdmbd','ngoai sinh','het hieu luc'],['13.2','14.2']);if(r)add(rec(period,doc,r,'HDMBD',standardPlanMonthYtd(after(r.text,/HĐ|HD/i),{allowPlanYtd:true}),.97));
  r=findRow(rows,['hdmbd','chuyen chu'],['14']);if(r){const n=after(r.text,/HĐ|HD/i);add(rec(period,doc,r,'DV_CHUYENCHU',n.length>=2?{actualMonth:n[n.length-2],actualYtd:n[n.length-1]}:{},.88,['Chỉ tiêu chuyển chủ thay đổi cách trình bày theo kỳ; cần kiểm tra nếu có số tổng khách hàng rất lớn.']));}
  r=findRow(rows,['phat trien','khach hang'],['1']);if(r){const n=after(r.text,/KH/i);if(n.length>=2)add(rec(period,doc,r,'GANMOI',{actualMonth:n[n.length-2],actualYtd:n[n.length-1]},.96));}
  return out;
}

function totalLine(doc:PdfExtractedDocument,sectionNeedles:string[],predicate:(n:number[],line:LineRef)=>boolean):LineRef|undefined{const lines=pageLines(doc,sectionNeedles);return lines.filter((l)=>l.normalized.startsWith('tong cong')||l.normalized.startsWith('tong')).find((l)=>predicate(nums(l.text),l));}

function extractCustomerAndRemote(period:string,doc:PdfExtractedDocument){
  const out:PdfImportRecord[]=[];const add=(x:PdfImportRecord|undefined)=>{if(x)out.push(x);};
  const crm=totalLine(doc,['he thong crm'],(n)=>n.length>=6);if(crm){const n=nums(crm.text),m=n[0]>0?n[1]/n[0]*100:undefined,y=n[3]>0?n[4]/n[3]*100:undefined;if(m!==undefined&&y!==undefined)add(rec(period,doc,crm,'CRM',{actualMonth:Number(m.toFixed(2)),actualYtd:Number(y.toFixed(2))},.97,['Tỷ lệ CRM tính từ dòng Tổng cộng của đúng bảng CRM.']));}
  const accessLines=pageLines(doc,['tiep can dien nang']);const access=accessLines.find((l)=>{const n=nums(l.text);return (l.normalized.startsWith('tong cong')||l.normalized.includes('qua luoi dien trung ap'))&&n.length>=6&&n[2]>=0&&n[2]<=30&&n[5]>=0&&n[5]<=30;});if(access){const n=nums(access.text);add(rec(period,doc,access,'TC_DN',{actualMonth:n[2],actualYtd:n[5]},.94,['Lấy cột thời gian trung bình, không lấy số lượng công trình.']));}
  const remote=totalLine(doc,['khai thac hoa don do xa'],(n)=>n.length>=7&&n[2]>=50&&n[2]<=100.5&&n[4]>=50&&n[4]<=100.5&&n[6]>=0&&n[6]<=100.5)||totalLine(doc,['thu thap du lieu tu xa'],(n)=>n.length>=7&&n[2]>=50&&n[2]<=100.5&&n[4]>=50&&n[4]<=100.5&&n[6]>=0&&n[6]<=100.5);if(remote){const n=nums(remote.text);add(rec(period,doc,remote,'DX_KB',{actualMonth:n[2],actualYtd:n[2]},.99));add(rec(period,doc,remote,'DX_KN',{actualMonth:n[4],actualYtd:n[4]},.99));add(rec(period,doc,remote,'DX_HD',{actualMonth:n[6],actualYtd:n[6]},.99));}
  const lost=totalLine(doc,['mat ket noi'],(n)=>n.length>=1&&n.length<=3&&n[0]>=1);if(lost){const n=nums(lost.text);add(rec(period,doc,lost,'DX_MK',{actualMonth:n[0],actualYtd:n[0]},.9,['Lấy dòng Tổng cộng trong đúng khu vực mất kết nối.']));}
  return out;
}

function extractTechnical(period:string,doc:PdfExtractedDocument,rows:ExtractedRow[]){const out:PdfImportRecord[]=[];const add=(x:PdfImportRecord|undefined)=>{if(x)out.push(x);};let r=rows.find((x)=>x.normalized.includes('su co luoi trung the')||x.normalized.includes('su co trung the'));if(r){const n=after(r.text,/Vụ|Vu/i);const v=n.length>=4?{planYear:n[0],planYtd:n[1],actualMonth:n[2],actualYtd:n[3]}:n.length>=3?{planYear:n[0],actualMonth:n[1],actualYtd:n[2]}:{};add(rec(period,doc,r,'KT_SC',v,.96));}for(const id of ['SAIFI','SAIDI','MAIFI'] as const){r=rows.find((x)=>new RegExp(`\\b${id.toLowerCase()}\\b`).test(x.normalized));if(!r)continue;const n=after(r.text,id==='SAIDI'?/phút|phut/i:/lần|lan/i);const v=n.length>=4?{planYear:n[0],planYtd:n[1],actualMonth:n[2],actualYtd:n[3]}:n.length>=3?{planYear:n[0],actualMonth:n[1],actualYtd:n[2]}:{};add(rec(period,doc,r,id,v,.96));}return out;}

function detectSummary(docs:PdfExtractedDocument[]):PdfPeriodSummary|undefined{const text=normalizeLookup(docs.map((d)=>d.pages.map((p)=>p.text).join(' ')).join(' '));const totalM=text.match(/co (\d+) chi tieu san xuat kinh doanh chinh/),passM=text.match(/thuc hien dat (\d+)(?: (\d+))? chi tieu/),failM=text.match(/(\d+)(?: \d+)? chi tieu (?:chua|khong) dat/),partialM=text.match(/(\d+)(?: \d+)? chi tieu dat (?:1|mot) phan/);const total=totalM?Number(totalM[1]):passM&&passM[2]?Number(passM[2]):0;if(!total)return undefined;return {total,pass:passM?Number(passM[1]):0,fail:failM?Number(failM[1]):0,partial:partialM?Number(partialM[1]):0,detected:true};}

export function detectPdfDataPeriod(docs:PdfExtractedDocument[]):string|undefined{for(const doc of docs){const text=doc.pages.slice(0,3).map((p)=>p.text).join(' ').replace(/\s+/g,' ');const patterns=[/Thực\s*hiện\s+(?:tháng\s*)?(0?[1-9]|1[0-2])\s*[\/.-]\s*(20\d{2})/i,/Tháng\s*báo\s*cáo\s*\(?\s*(0?[1-9]|1[0-2])\s*[\/.-]\s*(20\d{2})\s*\)?/i];for(const re of patterns){const m=text.match(re);if(m)return `${m[2]}-${String(Number(m[1])).padStart(2,'0')}`;}}return undefined;}

function materiallyDifferent(a?:number,b?:number){if(a===undefined||b===undefined)return false;const tol=Math.max(.01,Math.abs(a)*.005,Math.abs(b)*.005);return Math.abs(a-b)>tol;}
function mergeRecord(base:PdfImportRecord|undefined,next:PdfImportRecord):PdfImportRecord{if(!base)return next;const conflicts=(base.conflicts||[]).slice();for(const field of Object.keys(next.values) as (keyof PdfNumericValues)[]){const a=base.values[field],b=next.values[field];if(materiallyDifferent(a,b)&&base.confidence>=.86&&next.confidence>=.86)conflicts.push({field,left:a,right:b,sourceLeft:base.sourceFile,sourceRight:next.sourceFile});}if(conflicts.length)return {...(next.confidence>base.confidence?next:base),conflicts,reviewStatus:'CONFLICT',issues:[...new Set([...(base.issues||[]),...(next.issues||[]),'Có số liệu khác nhau giữa hai cách nhận dạng/nguồn; cần xác nhận trước khi duyệt.'])]};if(next.confidence>base.confidence+.01||!hasValue(base.values))return {...next,issues:[...new Set([...(base.issues||[]),...(next.issues||[])])]};return base;}

function suspicious(r:PdfImportRecord){const values=[r.values.actualMonth,r.values.actualYtd].filter((x):x is number=>x!==undefined);if(!values.length)return 'Không nhận được giá trị thực hiện.';if(r.unit==='%'&&values.some((x)=>x<0||x>100.5))return 'Giá trị % nằm ngoài khoảng hợp lý 0–100; cần kiểm tra.';if(r.unit==='Tr.kWh'&&values.some((x)=>Math.abs(x)>5000))return 'Giá trị Tr.kWh quá lớn; có thể PDF đang thể hiện kWh và cần quy đổi.';if(r.kpiId==='KD_CONGTO'&&values.some((x)=>x>=1900&&x<=2100))return 'Phát hiện số giống năm ở KPI công tơ; không tự duyệt.';if(r.kpiId==='TC_DN'&&values.some((x)=>x>30))return 'Tiếp cận điện năng >30 ngày; có thể đã lấy nhầm số lượng công trình.';if(r.kpiId==='GANMOI'&&values.some((x)=>x>50000))return 'Phát triển khách hàng có số rất lớn; có thể đã lấy tổng số khách hàng thay vì số gắn mới.';if(r.kpiId==='DV_CHUYENCHU'&&values.some((x)=>x>50000))return 'Chuyển chủ có số rất lớn; cần kiểm tra có lấy nhầm tổng số HĐMBĐ.';return '';}

export function applyHistoricalDhsxExtractors(result:PdfParseResult,docs:PdfExtractedDocument[]):PdfParseResult{const map=new Map<string,PdfImportRecord>();result.records.forEach((r)=>map.set(r.kpiId||r.rowId,r));for(const doc of docs){const name=normalizeLookup(doc.name),text=normalizeLookup(doc.pages.slice(0,3).map((p)=>p.text).join(' '));if(!name.includes('dhsx')&&!text.includes('tinh hinh thuc hien ke hoach sxkd'))continue;const rows=collectRows(doc);const extras=[...extractBusiness(result.period,doc,rows),...extractCustomerAndRemote(result.period,doc),...extractTechnical(result.period,doc,rows)];for(const next of extras){const key=next.kpiId||next.rowId;map.set(key,mergeRecord(map.get(key),next));}}const records=[...map.values()].map((r)=>{if(['UNMAPPED','CONFLICT','VERIFIED','SKIP'].includes(r.reviewStatus))return r;const problem=suspicious(r);return {...r,reviewStatus:!hasValue(r.values)||r.confidence<.86||problem?'NEED_REVIEW':'AUTO_OK',issues:problem?[...new Set([...(r.issues||[]),problem])]:r.issues};});const summary=detectSummary(docs)||result.summary;const stats={total:records.length,autoOk:records.filter((r)=>r.reviewStatus==='AUTO_OK').length,needReview:records.filter((r)=>r.reviewStatus==='NEED_REVIEW').length,conflict:records.filter((r)=>r.reviewStatus==='CONFLICT').length,unmapped:records.filter((r)=>r.reviewStatus==='UNMAPPED').length};return {...result,records,summary,stats,notes:[...result.notes,`Parser ${PDF_PARSER_VERSION}: hỗ trợ bố cục ĐHSX 2025–2026, tự nhận kỳ dữ liệu và chặn số nghi ngờ trước khi duyệt.`]};}
