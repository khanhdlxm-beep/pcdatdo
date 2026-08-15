import { KPI_BY_ID, KPI_CATALOG, normalizeLookup, type KpiCatalogEntry } from '@/lib/kpi-catalog';
import type { PdfDocType, PdfExtractedDocument, PdfFieldConflict, PdfImportRecord, PdfNumericValues, PdfParseResult, PdfPeriodSummary } from '@/types/pdf-import';

type AliasRule={ sourcePattern:string; kpiId:string };
type RowBlock={ page:number; text:string; firstLine:string; normalized:string; rowNo?:number; statusText?:string };

type Candidate={ entry:KpiCatalogEntry; docType:PdfDocType; page:number; block:string; values:PdfNumericValues; statusText?:string; confidence:number; issues:string[]; sourceFile:string; sourceLabel:string };

const NUMBER_RE=/-?\s*\d[\d.,]*/g;
const PERCENT_RE=/-?\s*\d+(?:[.,]\d+)?\s*%/g;

function normalizeMalformedNumberText(text:string){
  // PDF text extraction occasionally turns Vietnamese thousands+decimal values
  // such as 2.272,52 into 2,272,52. Reconstruct the intended separator
  // before tokenization so the entire number is handled as one value.
  return String(text||'').replace(/(?<!\d)(-?\d{1,3}),(\d{3}),(\d{2,3})(?!\d)/g,'$1.$2,$3');
}

export function parseViNumber(raw:string):number|undefined{
  let s=normalizeMalformedNumberText(String(raw||'')).trim().replace(/\s/g,'').replace(/[–—]/g,'-');
  s=s.replace(/[^0-9,.-]/g,'');
  if(!s||s==='-'||s==='.'||s===',') return undefined;
  const neg=s.startsWith('-'); s=s.replace(/-/g,'');
  if(s.includes(',')&&s.includes('.')){
    const comma=s.lastIndexOf(','), dot=s.lastIndexOf('.');
    if(comma>dot) s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  } else if(s.includes(',')){
    const parts=s.split(',');
    if(parts.length===2 && parts[1].length<=4) s=`${parts[0].replace(/\./g,'')}.${parts[1]}`;
    else s=s.replace(/,/g,'');
  } else if((s.match(/\./g)||[]).length>1){
    const parts=s.split('.'); const tail=parts[parts.length-1];
    if(tail.length<=2) s=parts.slice(0,-1).join('')+'.'+tail; else s=parts.join('');
  }
  const n=Number(s); return Number.isFinite(n)?(neg?-n:n):undefined;
}

function detectDocType(doc:PdfExtractedDocument):PdfDocType{
  const sample=normalizeLookup(doc.pages.slice(0,3).map((p)=>p.text).join('\n'));
  const name=normalizeLookup(doc.name);
  if(name.includes('pl1')||sample.includes('phu luc 1')||sample.includes('tinh hinh thuc hien cac chi tieu')) return 'PL1';
  if(name.includes('dhsx')||sample.includes('bao cao dhsx')||sample.includes('bao cao dieu hanh')) return 'DHSX';
  return 'OTHER';
}

function statusFrom(text:string){
  const n=normalizeLookup(text);
  if(n.includes('dat mot phan')) return 'Đạt một phần';
  if(n.includes('khong dat')) return 'Không đạt';
  if(/(^|\s)dat($|\s)/.test(n)) return 'Đạt';
  return '';
}

function segmentRows(doc:PdfExtractedDocument):RowBlock[]{
  const out:RowBlock[]=[];
  for(const page of doc.pages){
    let current:string[]=[]; let rowNo:number|undefined;
    const flush=()=>{if(!current.length)return;const text=current.join(' ').replace(/\s+/g,' ').trim();out.push({page:page.page,text,firstLine:current[0]||text,normalized:normalizeLookup(text),rowNo,statusText:statusFrom(text)});current=[];rowNo=undefined;};
    for(const line of page.lines){
      const m=line.match(/^\s*(\d{1,3})\s+(?:\(\d+\)|\d+\b)/);
      if(m){flush();rowNo=Number(m[1]);current=[line];}
      else if(current.length) current.push(line);
    }
    flush();
  }
  return out;
}


function segmentSummaryRows(doc:PdfExtractedDocument):RowBlock[]{
  const out:RowBlock[]=[];
  for(const page of doc.pages){
    const lines=page.lines||[];
    for(let i=0;i<lines.length;i++){
      const current=lines[i];
      const m=current.match(/^\s*(\d{1,3}(?:[.,]\d+)?)\s+/);
      if(!m) continue;
      const context=[lines[i-1]||'',current,lines[i+1]||''].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
      out.push({page:page.page,text:context,firstLine:current,normalized:normalizeLookup(context),statusText:statusFrom(context)});
    }
  }
  return out;
}

function allNumericTokens(text:string){
  const normalizedText=normalizeMalformedNumberText(text);
  const raw=[...(normalizedText.match(NUMBER_RE)||[])];
  return raw.map((r)=>({raw:r,value:parseViNumber(r)})).filter((x)=>x.value!==undefined) as {raw:string;value:number}[];
}

function lastNumbers(block:string,count:number){return allNumericTokens(block).slice(-count).map((x)=>x.value);}

function valuesByKnownStrategy(entry:KpiCatalogEntry,line:string,docType:PdfDocType,fullBlock=line):{values:PdfNumericValues;confidence:number;issues:string[]}{
  const cleanLine=docType==='PL1'
    ? line.replace(/^\s*\d{1,3}\s+\(\d+\)\s*/, '')
    : line.replace(/^\s*\d{1,3}(?:[.,]\d+)?\s+/, '');
  const nums=allNumericTokens(cleanLine).map((x)=>x.value);
  const issues:string[]=[]; const v:PdfNumericValues={};
  if(!nums.length) return {values:v,confidence:.35,issues:['Không tìm thấy số trong dòng chỉ tiêu.']};

  // PL1 generally follows: KH năm | KH đến kỳ | TH tháng | Lũy kế | so sánh kỳ | so sánh năm.
  if(docType==='PL1'){
    const id=entry.id;
    if(['SAIFI','SAIDI','MAIFI'].includes(id) && nums.length>=6){
      const x=nums.slice(-6); v.planYear=x[0];v.planYtd=x[1];v.actualMonth=x[2];v.actualYtd=x[3];return {values:v,confidence:.93,issues};
    }
    if(['KD_DTP','KD_TT'].includes(id) && nums.length>=3){
      const x=nums.slice(-4);v.planYear=id==='KD_DTP'&&x[0]<10?x[0]*1000:x[0];v.actualMonth=x[1];v.actualYtd=x[2];return {values:v,confidence:.9,issues};
    }
    if(id==='KD_GIA' && nums.length>=3){const x=nums.slice(-3);v.planYear=x[0]<10?x[0]*1000:x[0];v.actualMonth=x[1];v.actualYtd=x[2];return {values:v,confidence:.91,issues};}
    if(id==='KT_SC'){
      if(nums.length>=6){v.planYear=nums[1]??nums[0];v.actualMonth=nums[2];v.actualYtd=nums[3];}
      const fullNums=allNumericTokens(fullBlock.replace(/^\s*\d{1,3}\s+\(\d+\)\s*/, '')).map((x)=>x.value);
      const p=fullNums.find((n)=>n>50&&n<70&&n!==v.actualYtd); if(p!==undefined)v.planYtd=p;
      return {values:v,confidence:v.actualMonth!==undefined&&v.actualYtd!==undefined?.84:.5,issues:v.planYtd===undefined?['Sự cố trung thế có KH đến kỳ ở dòng xuống; cần kiểm tra.']:[]};
    }
    if(id==='CRM' || id==='HDMBD' || id==='GANMOI'){
      // These frequently live in narrative sections rather than a consistent PL1 numeric row.
      const x=nums.slice(-4); if(x.length>=2){v.actualMonth=x[x.length-2];v.actualYtd=x[x.length-1];}
      return {values:v,confidence:.55,issues:['Chỉ tiêu dịch vụ có bố cục biến đổi; nên đối chiếu nguồn.']};
    }
    if(id==='TC_DN' && nums.length>=2){const x=nums.slice(-5);v.planYear=x[0];if(x.length>=3){v.actualMonth=x[x.length-2];v.actualYtd=x[x.length-1];}return {values:v,confidence:.74,issues:['Kiểm tra đơn vị ngày và cột lũy kế.']};}
    if(id==='DX_HD'){
      const perc=(cleanLine.match(PERCENT_RE)||[]).map(parseViNumber).filter((x):x is number=>x!==undefined);
      if(perc.length) v.actualMonth=perc[perc.length-1];
      return {values:v,confidence:v.actualMonth!==undefined?.75:.45,issues:['Đo xa thường được trình bày theo tỷ lệ hiện trạng.']};
    }
    if(id==='SCL' && nums.length>=4){const x=nums.slice(-6);const plan=x.find((n)=>n>30&&n<50);const actual=[...x].reverse().find((n)=>n>15&&n<35&&n!==plan);v.planYear=plan;v.actualYtd=actual;return {values:v,confidence:v.planYear!==undefined&&v.actualYtd!==undefined?.82:.6,issues:['SCL trong PL1 trình bày theo công trình/giá trị; ưu tiên giá trị lũy kế.']};}
    if(id==='DT_GIO' && nums.length>=4){v.planYear=nums[0];v.planYtd=nums[1];v.actualMonth=nums[2];v.actualYtd=nums[3];return {values:v,confidence:.9,issues};}
    if(id==='NSLD_KH' && nums.length>=5){const x=nums.slice(-5);v.planYear=x[0];v.planYtd=x[1];v.actualMonth=x[2];v.actualYtd=x[3];return {values:v,confidence:.88,issues};}
    if(id==='CHIPHI' && nums.length>=4){const x=nums.slice(-4);v.planYear=x[0];v.planYtd=x[1];v.actualMonth=x[2];v.actualYtd=x[3];return {values:v,confidence:.88,issues};}
    if(id==='TONKHO' && nums.length>=2){const x=nums.slice(-3);v.planYear=x[0];v.planYtd=x.length>2?x[1]:undefined;return {values:v,confidence:.68,issues:['PL1 hiện chưa thể hiện rõ giá trị tồn kho thực tế; không tự điền TH nếu không chắc chắn.']};}
    if(id==='ATTT' && nums.length>=4){v.planYear=nums[0];v.planYtd=nums[1];v.actualMonth=nums[2];v.actualYtd=nums[3];return {values:v,confidence:.92,issues};}

    const x=nums.slice(-6);
    if(x.length>=4){v.planYear=x[0];v.planYtd=x.length>=5?x[1]:undefined;v.actualMonth=x[x.length>=5?2:1];v.actualYtd=x[x.length>=5?3:2];}
    else if(x.length===3){v.planYear=x[0];v.actualMonth=x[1];v.actualYtd=x[2];}
    else if(x.length===2){v.actualMonth=x[0];v.actualYtd=x[1];}
    else v.actualMonth=x[0];
    return {values:v,confidence:.62,issues:['Áp dụng quy tắc cột PL1 tổng quát; cần kiểm tra nếu bố cục PDF thay đổi.']};
  }

  // DHSX summary tables are more stable for several key indicators. Prefer
  // the first data columns on the physical table row and ignore trailing % columns.
  if(docType==='DHSX'){
    const id=entry.id;
    if(['KD_DTP','KD_DT','KD_GIA','KD_TT'].includes(id) && nums.length>=3){
      v.planYear=(id==='KD_DTP'||id==='KD_GIA')&&nums[0]<10?nums[0]*1000:nums[0];v.actualMonth=nums[1];v.actualYtd=nums[2];
      return {values:v,confidence:.96,issues};
    }
    if(id==='GANMOI' && nums.length>=2){v.actualMonth=nums[0];v.actualYtd=nums[1];return {values:v,confidence:.93,issues};}
    if(id==='HDMBD' && nums.length>=3){v.planYear=nums[0];v.actualMonth=nums[1];v.actualYtd=nums[2];return {values:v,confidence:.93,issues};}
    if(['SAIFI','SAIDI','MAIFI'].includes(id) && nums.length>=4){v.planYear=nums[0];v.planYtd=nums[1];v.actualMonth=nums[2];v.actualYtd=nums[3];return {values:v,confidence:.96,issues};}
    if(id==='NSLD_KH' && nums.length>=3){v.planYear=nums[0];v.actualMonth=nums[1];v.actualYtd=nums[2];return {values:v,confidence:.94,issues};}
    if(id==='DT_GIO' && nums.length>=3){v.planYear=nums[0];v.actualMonth=nums[1];v.actualYtd=nums[2];return {values:v,confidence:.94,issues};}
    if(id==='CBCNV' && nums.length>=1){v.actualMonth=nums[0];v.actualYtd=nums[0];return {values:v,confidence:.9,issues};}
  }

  // Other narrative/summary content: capture a plausible suggestion only and force review.
  const tail=lastNumbers(fullBlock,5);
  if(entry.aggregate==='sum' && tail.length>=2){v.actualMonth=tail[tail.length-2];v.actualYtd=tail[tail.length-1];}
  else if(tail.length) v.actualMonth=tail[tail.length-1];
  return {values:v,confidence:.52,issues:['Nguồn báo cáo tổng hợp không có cấu trúc cột cố định; cần duyệt trước khi ghi dữ liệu.']};
}

function aliasScore(block:string,entry:KpiCatalogEntry,extra:AliasRule[]){
  const aliases=[...entry.aliases,...extra.filter((x)=>x.kpiId===entry.id).map((x)=>x.sourcePattern)].map(normalizeLookup).filter(Boolean);
  let best=''; for(const a of aliases) if(block.includes(a)&&a.length>best.length) best=a;
  return best;
}


function specialDhsxCandidates(doc:PdfExtractedDocument):Candidate[]{
  if(detectDocType(doc)!=='DHSX') return [];
  const out:Candidate[]=[];
  const add=(id:string,page:number,block:string,values:PdfNumericValues,confidence:number,issues:string[]=[])=>{
    const entry=KPI_BY_ID[id]; if(!entry)return;
    out.push({entry,docType:'DHSX',page,block,values,statusText:statusFrom(block),confidence,issues,sourceFile:doc.name,sourceLabel:'DHSX-special'});
  };
  const stripRow=(line:string)=>line.replace(/^\s*\d{1,3}(?:[.,]\d+)?\s+/,'');
  for(const page of doc.pages){
    const normPage=normalizeLookup(page.text);
    const lines=page.lines||[];
    const at=(needle:string)=>lines.findIndex((l)=>normalizeLookup(l).includes(needle));
    const ctx=(i:number,before=1,after=1)=>lines.slice(Math.max(0,i-before),Math.min(lines.length,i+after+1)).join(' ').replace(/\s+/g,' ').trim();

    // Main business table (summary report pages 1-2).
    if(normPage.includes('ket qua thuc hien cac chi tieu kinh doanh')){
      let i=at('san luong dien');
      if(i>=0){
        const actual=allNumericTokens(lines[i]).map((x)=>x.value);
        const planLine=lines.slice(i,i+3).find((l)=>/^\s*4\s+/.test(l));
        const plan=planLine?allNumericTokens(stripRow(planLine)).map((x)=>x.value):[];
        if(actual.length>=2&&plan.length>=1){const ratio=actual.length>=4&&actual[3]>50&&actual[3]<200?actual[3]:undefined;const planMonth=ratio?actual[0]/(ratio/100):undefined;add('KD_DTP',page.page,ctx(i,0,2),{planYear:plan[0]<10?plan[0]*1000:plan[0],planMonth,actualMonth:actual[0],actualYtd:actual[1]},.99);}
      }
      i=lines.findIndex((l)=>/^\s*5\s+/.test(l)&&normalizeLookup(l).includes('tong doanh thu'));
      if(i>=0){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3){const ratio=n.length>=5&&n[4]>50&&n[4]<200?n[4]:undefined;add('KD_DT',page.page,ctx(i,0,0),{planYear:n[0],planMonth:ratio?n[1]/(ratio/100):undefined,actualMonth:n[1],actualYtd:n[2]},.99);}}
      i=lines.findIndex((l)=>/^\s*6\s+/.test(l));
      if(i>=0&&normalizeLookup(ctx(i,1,1)).includes('gia ban dien binh')){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('KD_GIA',page.page,ctx(i,1,1),{planYear:n[0]<10?n[0]*1000:n[0],actualMonth:n[1],actualYtd:n[2]},.99);}
      i=lines.findIndex((l)=>/^\s*8[.,]1\s+/.test(l)&&normalizeLookup(l).includes('ton that dien nang'));
      if(i>=0){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('KD_TT',page.page,ctx(i,0,0),{planYear:n[0],actualMonth:n[1],actualYtd:n[2]},.99);}
      i=lines.findIndex((l)=>/^\s*1\s+/.test(l)&&normalizeLookup(l).includes('phat trien khach hang'));
      if(i>=0){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=2)add('GANMOI',page.page,ctx(i,0,0),{actualMonth:n[0],actualYtd:n[1]},.96);}
      i=lines.findIndex((l)=>/^\s*13[.,]2\s+/.test(l));
      if(i>=0&&normalizeLookup(ctx(i,1,1)).includes('hdmbd ngoai sinh')){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('HDMBD',page.page,ctx(i,1,1),{planYear:n[0]<10?n[0]*1000:n[0],actualMonth:n[1],actualYtd:n[2]},.97);}
    }

    // Customer service tables.
    if(normPage.includes('he thong crm')){
      const total=lines.find((l)=>normalizeLookup(l).startsWith('tong cong') && allNumericTokens(l).length>=6);
      if(total){const n=allNumericTokens(total).map((x)=>x.value);const monthRate=n[0]>0?n[1]/n[0]*100:undefined;const ytdRate=n[3]>0?n[4]/n[3]*100:undefined;if(monthRate!==undefined)add('CRM',page.page,total,{actualMonth:Number(monthRate.toFixed(2)),actualYtd:ytdRate===undefined?undefined:Number(ytdRate.toFixed(2))},.97);}
    }
    if(normPage.includes('hdmbd ngoai sinh')){
      const i=lines.findIndex((l)=>/^\s*13[.,]2\s+/.test(l));
      if(i>=0){const block=ctx(i,1,1);const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('HDMBD',page.page,block,{planYear:n[0]<10?n[0]*1000:n[0],actualMonth:n[1],actualYtd:n[2]},.97);}
    }
    if(normPage.includes('tiep can dien nang')){
      const labelIndex=lines.findIndex((l)=>normalizeLookup(l).includes('qua luoi dien trung'));
      const i=labelIndex>=0?lines.slice(labelIndex,labelIndex+3).findIndex((l)=>/^\s*I\s+/.test(l))+labelIndex:-1;
      if(i>=labelIndex&&labelIndex>=0){const n=allNumericTokens(lines[i]).map((x)=>x.value);if(n.length>=6)add('TC_DN',page.page,ctx(labelIndex,0,2),{actualMonth:n[2],actualYtd:n[5]},.94);}
    }

    // Remote-meter table: Total row columns = installed, declaration qty/%, connection qty/%, invoice qty/%.
    if(normPage.includes('khai thac hoa don do xa')){
      const total=lines.find((l)=>normalizeLookup(l).startsWith('tong cong') && allNumericTokens(l).length>=7);
      if(total){const n=allNumericTokens(total).map((x)=>x.value);add('DX_KB',page.page,total,{actualMonth:n[2],actualYtd:n[2]},.99);add('DX_KN',page.page,total,{actualMonth:n[4],actualYtd:n[4]},.99);add('DX_HD',page.page,total,{actualMonth:n[6],actualYtd:n[6]},.99);}
    }
    if(normPage.includes('mat ket noi')){
      const candidates=lines.filter((l)=>normalizeLookup(l).startsWith('tong cong'));
      const total=candidates.find((l)=>{const n=allNumericTokens(l).map((x)=>x.value);return n.length===1&&n[0]>=100;});
      if(total){const n=allNumericTokens(total).map((x)=>x.value);add('DX_MK',page.page,total,{actualMonth:n[0],actualYtd:n[0]},.98);}
    }

    // Investment table. Values are joined with the next line because the row label and numbers may be split by PDF extraction.
    if(normPage.includes('cong tac dtxd')){
      const i=at('tct giao');
      if(i>=0){const block=ctx(i,2,0);const n=allNumericTokens(block).map((x)=>x.value);const plausible=n.filter((x)=>x>0&&x<1000);if(plausible.length>=3)add('DTXD',page.page,block,{planYear:plausible[0],actualMonth:plausible[1],actualYtd:plausible[2]},.96);}
    }
    if(normPage.includes('cong tac scl')){
      const i=at('gia tri thuc hien');
      if(i>=0){const line=stripRow(lines[i]);const n=allNumericTokens(line).map((x)=>x.value);if(n.length>=3)add('SCL',page.page,lines[i],{planYear:n[0],actualYtd:n[2]},.84,['PDF trình bày TH tháng SCL ở quy mô có thể khác đơn vị tỷ; hệ thống để trống TH tháng và ưu tiên lũy kế để người dùng duyệt.']);}
    }
    if(normPage.includes('gia tri ton kho')){
      const total=lines.find((l)=>normalizeLookup(l).startsWith('tong') && allNumericTokens(l).length>=2);
      if(total){const n=allNumericTokens(total).map((x)=>x.value);add('TONKHO',page.page,total,{planYear:n[0],actualMonth:n[1],actualYtd:n[1]},.94);}
    }

    // HR summary tables.
    if(normPage.includes('so cbcnv cong ty')){
      const i=lines.findIndex((l)=>normalizeLookup(l).includes('tong so cbcnv'));
      if(i>=0){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length)add('CBCNV',page.page,lines[i],{actualMonth:n[0],actualYtd:n[0]},.96);}
    }
    if(normPage.includes('nang suat lao dong')){
      const i=lines.findIndex((l)=>/^\s*1[,.]2\s+/.test(l));
      if(i>=0&&normalizeLookup(ctx(i,0,1)).includes('so khach hang')){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('NSLD_KH',page.page,ctx(i,0,1),{planYear:n[0],actualMonth:n[1],actualYtd:n[2]},.96);}
    }
    if(normPage.includes('cong tac dao tao')){
      const i=lines.findIndex((l)=>/^\s*1[,.]2\s+/.test(l)&&normalizeLookup(l).includes('tong so gio dao tao'));
      if(i>=0){const n=allNumericTokens(stripRow(lines[i])).map((x)=>x.value);if(n.length>=3)add('DT_GIO',page.page,lines[i],{planYear:n[0],actualMonth:n[1],actualYtd:n[2]},.96);}
    }
  }
  return out;
}

function candidatesForDoc(doc:PdfExtractedDocument,extraRules:AliasRule[]):Candidate[]{
  const docType=detectDocType(doc); const rows=docType==='PL1'?segmentRows(doc):[...segmentRows(doc),...segmentSummaryRows(doc)]; const out:Candidate[]=[];
  const specialIds=new Set(['KD_DTP','KD_DT','KD_GIA','KD_TT','GANMOI','HDMBD','DX_KB','DX_KN','DX_HD','DX_MK','DTXD','SCL','TONKHO','CBCNV','NSLD_KH','DT_GIO']);
  for(const entry of KPI_CATALOG){
    if(docType==='DHSX' && specialIds.has(entry.id)) continue;
    let best:{row:RowBlock;alias:string}|undefined;
    if(docType==='PL1' && entry.pl1RowNo){
      const row=rows.find((r)=>r.rowNo===entry.pl1RowNo);
      if(row) best={row,alias:`PL1#${entry.pl1RowNo}`};
    }
    if(!best){
      for(const row of rows){const alias=aliasScore(row.normalized,entry,extraRules);if(alias&&(!best||alias.length>best.alias.length))best={row,alias};}
    }
    if(!best) continue;
    const parsed=valuesByKnownStrategy(entry,best.row.firstLine,docType,best.row.text);
    const statusText=best.row.statusText;
    let confidence=parsed.confidence;
    if(statusText) confidence=Math.min(1,confidence+.03);
    out.push({entry,docType,page:best.row.page,block:best.row.text,values:parsed.values,statusText,confidence,issues:parsed.issues,sourceFile:doc.name,sourceLabel:best.alias});
  }
  return out;
}

function materiallyDifferent(a?:number,b?:number){
  if(a===undefined||b===undefined)return false;
  const tol=Math.max(.01,Math.abs(a)*.005,Math.abs(b)*.005);
  return Math.abs(a-b)>tol;
}

function mergeCandidates(period:string,candidates:Candidate[]):PdfImportRecord[]{
  const grouped=new Map<string,Candidate[]>(); candidates.forEach((c)=>{const list=grouped.get(c.entry.id)||[];list.push(c);grouped.set(c.entry.id,list);});
  const records:PdfImportRecord[]=[];
  for(const entry of KPI_CATALOG){
    const list=grouped.get(entry.id)||[]; if(!list.length) continue;
    list.sort((a,b)=>b.confidence-a.confidence); const primary=list[0]; const values={...primary.values}; const conflicts:PdfFieldConflict[]=[];
    for(const other of list.slice(1)){
      if(other.confidence<.72) continue;
      (Object.keys(other.values) as (keyof PdfNumericValues)[]).forEach((field)=>{
        const right=other.values[field]; if(right===undefined)return;
        if(values[field]===undefined) values[field]=right;
        else if(materiallyDifferent(values[field],right)) conflicts.push({field,left:values[field],right,sourceLeft:primary.sourceFile,sourceRight:other.sourceFile});
      });
    }
    const issues=[...primary.issues]; if(conflicts.length) issues.unshift(`Có ${conflicts.length} trường dữ liệu khác nhau giữa các nguồn.`);
    const confidence=Math.max(...list.map((x)=>x.confidence));
    let reviewStatus:PdfImportRecord['reviewStatus']=conflicts.length?'CONFLICT':confidence>=.86?'AUTO_OK':'NEED_REVIEW';
    records.push({rowId:`${period}|${entry.id}`,period,docType:primary.docType,kpiId:entry.id,domainId:entry.domainId,label:entry.label,unit:entry.unit,sourceLabel:primary.sourceLabel,values,statusText:primary.statusText,confidence,sourceFile:primary.sourceFile,sourcePage:primary.page,sourceExcerpt:primary.block.slice(0,900),reviewStatus,issues,conflicts});
  }
  return records;
}

function genericUnmapped(period:string,docs:PdfExtractedDocument[],mappedRecords:PdfImportRecord[]):PdfImportRecord[]{
  const mappedText=mappedRecords.map((r)=>normalizeLookup(r.sourceExcerpt)); const out:PdfImportRecord[]=[]; let idx=0;
  for(const doc of docs){const type=detectDocType(doc);if(type!=='PL1')continue;for(const row of segmentRows(doc)){
    if(!row.rowNo||row.text.length<20)continue;
    const normalized=row.normalized; if(mappedText.some((x)=>x===normalized||x.includes(normalized.slice(0,60))||normalized.includes(x.slice(0,60)))) continue;
    const nums=allNumericTokens(row.text).map((x)=>x.value); if(!nums.length && !row.statusText) continue;
    const learnedLabel=row.text.replace(/^\s*\d{1,3}\s+(?:\(\d+\)\s*)?/,'').replace(/[-+]?\d[\d.,]*/g,' ').replace(/[%><=]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
    out.push({rowId:`${period}|UNMAPPED|${row.rowNo}|${idx++}`,period,docType:type,label:`Chỉ tiêu PL1 số ${row.rowNo}`,sourceLabel:learnedLabel,values:{},statusText:row.statusText,confidence:.25,sourceFile:doc.name,sourcePage:row.page,sourceExcerpt:row.text.slice(0,900),reviewStatus:'UNMAPPED',issues:['Chưa ánh xạ vào danh mục KPI của app. Dòng này không chặn duyệt; có thể ánh xạ để hệ thống ghi nhớ cho các tháng sau.']});
  }}
  return out.slice(0,100);
}

function summaryFromDocs(docs:PdfExtractedDocument[]):PdfPeriodSummary{
  // Prefer the explicit management summary when present; this avoids losing statuses
  // that are visually wrapped across rows in PL1.
  for(const doc of docs){
    if(detectDocType(doc)!=='DHSX') continue;
    const text=doc.pages.map((p)=>p.text).join('\n');
    const m=text.match(/có\s+(\d+)\s*\/\s*(\d+)\s+chỉ tiêu[^\n.]*đạt[\s\S]{0,180}?(\d+)\s+chỉ tiêu\s+không\s+đạt[\s\S]{0,100}?(\d+)\s+chỉ tiêu\s+đạt\s+một\s+phần/i);
    if(m) return {total:Number(m[2]),pass:Number(m[1]),partial:Number(m[4]),fail:Number(m[3]),detected:true};
  }
  let best:RowBlock[]=[];
  for(const doc of docs){if(detectDocType(doc)!=='PL1')continue;const rows=segmentRows(doc);if(rows.length>best.length)best=rows;}
  if(!best.length)return{total:0,pass:0,partial:0,fail:0,detected:false};
  let pass=0,partial=0,fail=0; const unique=new Set<number>();
  for(const row of best){if(!row.rowNo)continue;unique.add(row.rowNo);const s=normalizeLookup(row.statusText||'');if(s.includes('dat mot phan'))partial++;else if(s.includes('khong dat'))fail++;else if(s==='dat')pass++;}
  return {total:unique.size,pass,partial,fail,detected:unique.size>0};
}

function docHash(docs:PdfExtractedDocument[]){return docs.map((d)=>d.fingerprint.slice(0,8)).join('').slice(0,24);}

export function parsePdfDocuments(period:string,docs:PdfExtractedDocument[],rules:AliasRule[]=[]):PdfParseResult{
  const typed=docs.map((d)=>({...d,docType:detectDocType(d)}));
  const candidates=typed.flatMap((d)=>[...candidatesForDoc(d,rules),...specialDhsxCandidates(d)]);
  const mapped=mergeCandidates(period,candidates);
  const records=[...mapped,...genericUnmapped(period,typed,mapped)];
  const summary=summaryFromDocs(typed);
  const stats={total:records.length,autoOk:records.filter((r)=>r.reviewStatus==='AUTO_OK').length,needReview:records.filter((r)=>r.reviewStatus==='NEED_REVIEW').length,conflict:records.filter((r)=>r.reviewStatus==='CONFLICT').length,unmapped:records.filter((r)=>r.reviewStatus==='UNMAPPED').length};
  const importId=`IMP_${period.replace('-','')}_${Date.now()}_${docHash(typed)}`;
  return {ok:true,importId,period,documents:typed.map((d)=>({name:d.name,fingerprint:d.fingerprint,docType:d.docType!,pages:d.pages.length})),records,summary,stats,notes:['PDF được đọc ngay trên trình duyệt; file gốc không được gửi lên Apps Script.', 'AUTO_OK vẫn nên kiểm tra ngẫu nhiên trong những tháng đầu để hiệu chỉnh quy tắc.', 'UNMAPPED không được ghi vào KPI chính cho đến khi người dùng chọn mã KPI.']};
}
