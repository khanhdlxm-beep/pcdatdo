import { KPI_BY_ID, normalizeLookup } from '@/lib/kpi-catalog';
import { parseViNumber } from '@/lib/vi-number';
import type { PdfExtractedDocument, PdfExtractedPage, PdfImportRecord, PdfNumericValues, PdfParseResult } from '@/types/pdf-import';

type Item = NonNullable<PdfExtractedPage['items']>[number];
type CellName = 'planYear' | 'planYtd' | 'actualMonth' | 'actualYtd' | 'samePeriodYtd' | 'samePeriodRate' | 'compareYear' | 'comparePeriod' | 'status' | 'forecast' | 'observed' | 'other' | 'other2' | 'monthCount' | 'monthTotal' | 'ytdCount' | 'ytdTotal' | 'monthReceived' | 'monthResolved' | 'monthPending' | 'ytdReceived' | 'ytdResolved' | 'ytdPending';
type Columns = Partial<Record<CellName, number>>;
type PhysicalRow = { page:number; label:string; cells:Record<string,string>; excerpt:string; id:string; issues:string[] };
const center = (item:Item) => item.x + item.width / 2;
const norm = (text:string) => normalizeLookup(text);
const blank = (text:string) => !text.trim() || /^[-–—]+$/.test(text.trim());

function join(items:Item[]) {
  return items.slice().sort((a,b)=>Math.abs(a.y-b.y)>3?b.y-a.y:a.x-b.x)
    .map((item)=>item.text).join(' ').replace(/\s+/g,' ').trim();
}

/** Header positions are taken from the PDF itself, never from numeric token order. */
function businessHeaders(items:Item[]):{columns:Columns; labelX:number; unitX:number; y:number}[] {
  const result:{columns:Columns; labelX:number; unitX:number; y:number}[]=[];
  for(const label of items.filter((i)=>norm(i.text)==='chi tieu')){
    const near=items.filter((i)=>Math.abs(i.y-label.y)<35);
    const unit=near.find((i)=>norm(i.text)==='dvt'&&i.x>label.x);
    const plan=near.find((i)=>norm(i.text)==='ke hoach'&&i.x>(unit?.x??label.x));
    const actual=near.filter((i)=>norm(i.text)==='thuc hien'&&i.x>(plan?.x??label.x)).sort((a,b)=>a.x-b.x);
    const comparisons=near.filter((i)=>norm(i.text)==='so voi'&&i.x>(actual[1]?.x??1e9)).sort((a,b)=>a.x-b.x);
    const status=near.find((i)=>norm(i.text)==='danh'&&i.x>(actual[1]?.x??1e9));
    if(!unit||!plan||actual.length!==2||comparisons.length<2||!status)continue;
    result.push({labelX:label.x,unitX:unit.x,y:label.y,columns:{
      planYear:center(plan),actualMonth:center(actual[0]),actualYtd:center(actual[1]),
      compareYear:center(comparisons[0]),comparePeriod:center(comparisons[1]),status:center(status),
    }});
  }
  return result;
}

function mainId(label:string):string|undefined {
  const n=norm(label);
  if(n.includes('phat trien khach hang'))return 'GANMOI';
  if(n==='dien nhan')return 'KD_DIENNHAN';
  if(n==='co cau dien mua')return 'KD_COCADIENMUA';
  if(n.includes('san luong dien thuong pham'))return 'KD_DTP';
  if(n==='tong doanh thu')return 'KD_DT';
  if(n.includes('gia ban dien binh quan'))return 'KD_GIA';
  if(n.includes('gia mua dien binh quan'))return 'KD_GIAMUA';
  if(n.includes('ton that dien nang'))return 'KD_TT';
  if(n.includes('bao tri theo luat do luong'))return 'KD_CONGTO';
  if(n.includes('kiem tra xu ly vi pham su dung dien'))return 'KD_VIPHAM';
  if(n==='tiet kiem dien')return 'KD_TKIEM';
  if(n.includes('ty le thu tien dien')&&!n.includes('theo phien'))return 'KD_THUNGAN';
  if(n.includes('hdmbd ngoai sinh hoat het hieu luc'))return 'HDMBD';
  return undefined;
}

function parseCells(items:Item[], columns:Columns, unitX:number):Record<string,string> {
  const ordered=Object.entries(columns).filter((pair):pair is [CellName,number]=>typeof pair[1]==='number').sort((a,b)=>a[1]-b[1]);
  const cells:Record<string,string>={};
  ordered.forEach(([key,x],idx)=>{
    const min=idx===0?(unitX+x)/2:(ordered[idx-1][1]+x)/2;
    const max=idx===ordered.length-1?Infinity:(x+ordered[idx+1][1])/2;
    cells[key]=join(items.filter((item)=>center(item)>=min&&center(item)<max));
  });
  return cells;
}

function readBusiness(page:PdfExtractedPage):PhysicalRow[] {
  const items=page.items??[], output:PhysicalRow[]=[];
  for(const header of businessHeaders(items)){
    // The row number occupies the narrow first column, separate from the label.
    const rowIds=items.filter((i)=>i.y<header.y-20&&i.x<header.labelX-45&&/^\d{1,2}(?:[.,]\d+)?$/.test(i.text.trim()))
      .sort((a,b)=>b.y-a.y);
    rowIds.forEach((anchor,index)=>{
      const top=index===0?header.y-20:(rowIds[index-1].y+anchor.y)/2;
      const bottom=index===rowIds.length-1?anchor.y-28:(anchor.y+rowIds[index+1].y)/2;
      const row=items.filter((i)=>i.y<=top&&i.y>bottom);
      const label=join(row.filter((i)=>i.x>=header.labelX-45&&i.x<header.unitX-15));
      const id=mainId(label); if(!id)return;
      const cells=parseCells(row,header.columns,center({text:'',x:header.unitX,y:0,width:20}));
      output.push({page:page.page,id,label,cells,excerpt:join(row),issues:[]});
    });
  }
  return output;
}

/** The SAIFI/SAIDI/MAIFI table has a separate header and two plan columns. */
function readReliability(page:PdfExtractedPage):PhysicalRow[] {
  const items=page.items??[], out:PhysicalRow[]=[];
  for(const label of items.filter((i)=>['SAIFI','SAIDI','MAIFI'].includes(i.text.trim().toUpperCase()))){
    const upper=items.filter((i)=>i.y>label.y+5&&i.y<label.y+160);
    const chi=upper.filter((i)=>norm(i.text)==='chi'&&i.x>label.x+70&&i.x<label.x+165).sort((a,b)=>a.x-b.x);
    const actual=upper.find((i)=>norm(i.text)==='thuc'&&i.x>(chi[1]?.x??1e9));
    const ytd=upper.find((i)=>norm(i.text)==='luy ke'&&i.x>(actual?.x??1e9));
    const unit=items.find((i)=>Math.abs(i.y-label.y)<4&&/^(lan|phut)$/.test(norm(i.text))&&i.x>label.x);
    if(chi.length<2||!actual||!ytd||!unit)continue;
    const same=upper.find((i)=>norm(i.text)==='luy'&&i.x>ytd.x&&Math.abs(i.y-ytd.y)<8);
    const rate=upper.find((i)=>norm(i.text)==='ty le'&&i.x>(same?.x??1e9));
    const comparison=upper.filter((i)=>norm(i.text)==='so voi'&&i.x>ytd.x).sort((a,b)=>a.x-b.x);
    const assessment=upper.find((i)=>norm(i.text)==='danh'&&i.x>ytd.x);
    // Without the subsequent columns, a filled comparison may be joined to lũy kế.
    if(!same||!rate||comparison.length<2||!assessment)continue;
    const columns:Columns={planYear:center(chi[0]),planYtd:center(chi[1]),actualMonth:center(actual),actualYtd:center(ytd),
      samePeriodYtd:center(same),samePeriodRate:center(rate),comparePeriod:center(comparison[0]),compareYear:center(comparison[1]),status:center(assessment)};
    const rows=items.filter((i)=>Math.abs(i.y-label.y)<5);
    const cells=parseCells(rows,columns,center(unit));
    out.push({page:page.page,id:label.text.toUpperCase(),label:label.text,cells,excerpt:join(rows),issues:[]});
  }
  return out;
}

/** Secondary tables have their own headings; never borrow the main-table columns. */
function readSupplementary(page:PdfExtractedPage,previous?:PdfExtractedPage):PhysicalRow[] {
  const items=page.items??[], out:PhysicalRow[]=[];
  const add=(id:string,label:Item,columns:Columns,unitX:number,dy=4)=>{
    const row=items.filter((item)=>Math.abs(item.y-label.y)<=dy);
    out.push({page:page.page,id,label:label.text,cells:parseCells(row,columns,unitX),excerpt:join(row),issues:[]});
  };

  // The load forecast has three different values: forecast, actual and error.
  for(const section of items.filter((i)=>norm(i.text).includes('du bao dien thuong pham'))){
    const below=items.filter((i)=>i.y<section.y&&i.y>section.y-55);
    const forecast=below.find((i)=>norm(i.text)==='du bao');
    const observed=below.find((i)=>norm(i.text)==='thuc hien');
    const error=below.find((i)=>norm(i.text)==='sai so');
    const assessment=below.find((i)=>norm(i.text)==='danh gia');
    if(!forecast||!observed||!error||!assessment||!(forecast.x<observed.x&&observed.x<error.x&&error.x<assessment.x))continue;
    const value=items.find((i)=>i.y<error.y-10&&i.y>error.y-70&&Math.abs(center(i)-center(error))<25&&parseViNumber(i.text)!==undefined);
    if(value)add('KD_DBPT',value,{forecast:center(forecast),observed:center(observed),actualMonth:center(error),status:center(assessment)},0);
  }

  // CRM percentages are derived only from the two explicitly identified pairs.
  for(const section of items.filter((i)=>norm(i.text).includes('he thong crm'))){
    const area=items.filter((i)=>i.y<section.y&&i.y>section.y-210);
    const received=area.filter((i)=>['tiep nhan','tiep'].includes(norm(i.text))).sort((a,b)=>a.x-b.x);
    const resolved=area.filter((i)=>norm(i.text)==='da xu').sort((a,b)=>a.x-b.x);
    const pending=area.filter((i)=>['dang xu','dang'].includes(norm(i.text))).sort((a,b)=>a.x-b.x);
    const total=area.find((i)=>norm(i.text)==='tong cong');
    if(received.length!==2||resolved.length!==2||pending.length!==2||!total)continue;
    const xs=[received[0].x,resolved[0].x,pending[0].x,received[1].x,resolved[1].x,pending[1].x];
    if(xs.some((x,i)=>i>0&&x<=xs[i-1]))continue;
    add('CRM',total,{monthReceived:center(received[0]),monthResolved:center(resolved[0]),monthPending:center(pending[0]),ytdReceived:center(received[1]),ytdResolved:center(resolved[1]),ytdPending:center(pending[1])},total.x+30);
  }

  // Average access time is the third subcolumn of each reporting period.
  for(const section of items.filter((i)=>norm(i.text).includes('tiep can dien nang'))){
    const area=items.filter((i)=>i.y<section.y&&i.y>section.y-180);
    const label=area.find((i)=>norm(i.text)==='qua luoi dien');
    if(!label||!area.some((i)=>norm(i.text)==='trung ap'&&Math.abs(i.y-label.y)<20))continue;
    const headers=area.filter((i)=>i.y>label.y+10);
    const counts=headers.filter((i)=>norm(i.text)==='so').sort((a,b)=>a.x-b.x);
    const totals=headers.filter((i)=>['tong','tong thoi'].includes(norm(i.text))).sort((a,b)=>a.x-b.x);
    if(counts.length!==2||totals.length!==2)continue;
    const means=totals.map((total,index)=>headers.find((i)=>norm(i.text)==='thoi'&&i.x>total.x+15&&i.x<(counts[index+1]?.x??Infinity)));
    if(!means[0]||!means[1])continue;
    const xs=[counts[0].x,totals[0].x,means[0].x,counts[1].x,totals[1].x,means[1].x];
    if(xs.some((x,i)=>i>0&&x<=xs[i-1]))continue;
    add('TC_DN',label,{monthCount:center(counts[0]),monthTotal:center(totals[0]),actualMonth:center(means[0]),ytdCount:center(counts[1]),ytdTotal:center(totals[1]),actualYtd:center(means[1])},label.x+40,10);
  }

  // These are snapshots: the source has one quantity, not a year-to-date value.
  for(const section of items.filter((i)=>norm(i.text).includes('theo doi diem do mat ket noi'))){
    const area=items.filter((i)=>i.y<section.y&&i.y>section.y-250);
    const lost=area.find((i)=>['mat ket noi 48 gio','noi 48 gio'].includes(norm(i.text)));
    const other=area.find((i)=>norm(i.text)==='mat ket noi do');
    const total=area.find((i)=>norm(i.text)==='tong cong');
    if(lost&&other&&total&&lost.x<other.x)add('DX_MK',total,{actualMonth:center(lost),other:center(other)},total.x+15);
  }
  for(const section of items.filter((i)=>norm(i.text)==='gia tri ton kho')){
    const area=items.filter((i)=>i.y<section.y&&i.y>section.y-230);
    const limit=area.find((i)=>norm(i.text)==='dinh muc'),value=area.find((i)=>norm(i.text)==='gia tri'),assessment=area.find((i)=>norm(i.text)==='so kh');
    const total=area.find((i)=>norm(i.text)==='tong'),unit=total&&area.find((i)=>Math.abs(i.y-total.y)<4&&norm(i.text)==='ty dong');
    if(limit&&value&&assessment&&total&&unit&&limit.x<value.x&&value.x<assessment.x)add('TONKHO',total,{planYear:center(limit),actualMonth:center(value),status:center(assessment)},center(unit));
  }
  for(const label of items.filter((i)=>norm(i.text)==='tong so cbcnv')){
    const upper=items.filter((i)=>i.y>label.y&&i.y<label.y+90);
    const unit=items.find((i)=>Math.abs(i.y-label.y)<5&&norm(i.text)==='nguoi');
    const count=upper.find((i)=>norm(i.text)==='so luong'),note=upper.find((i)=>norm(i.text)==='bien dong trong thang');
    if(unit&&count&&note&&count.x<note.x)add('CBCNV',label,{actualMonth:center(count),other:center(note)},center(unit));
  }

  for(const label of items.filter((i)=>norm(i.text)==='su co luoi trung the')){
    const upper=items.filter((i)=>i.y>label.y+5&&i.y<label.y+120);
    const unit=items.find((i)=>Math.abs(i.y-label.y)<4&&norm(i.text)==='vu');
    const chi=upper.filter((i)=>norm(i.text)==='chi'&&i.x>(unit?.x??1e9)).sort((a,b)=>a.x-b.x);
    const month=upper.find((i)=>norm(i.text)==='trong'&&i.x>(chi[1]?.x??1e9));
    const ytd=upper.find((i)=>norm(i.text)==='luy'&&i.x>(month?.x??1e9));
    const comparisons=upper.filter((i)=>norm(i.text)==='so voi'&&i.x>(ytd?.x??1e9)).sort((a,b)=>a.x-b.x);
    const assessment=upper.find((i)=>norm(i.text)==='danh'&&i.x>(comparisons[1]?.x??1e9));
    if(unit&&chi.length===2&&month&&ytd&&comparisons.length===2&&assessment)add('KT_SC',label,{planYear:center(chi[0]),planYtd:center(chi[1]),actualMonth:center(month),actualYtd:center(ytd),comparePeriod:center(comparisons[0]),compareYear:center(comparisons[1]),status:center(assessment)},center(unit));
  }

  // Workforce productivity and training both have plan/month/year-to-date headings.
  for(const label of items.filter((i)=>norm(i.text).startsWith('so khach hang so')||norm(i.text).startsWith('tong so gio dao tao'))){
    const id=norm(label.text).startsWith('so khach hang so')?'NSLD_KH':'DT_GIO';
    if(id==='NSLD_KH'&&!items.some((i)=>norm(i.text)==='cbcnv'&&Math.abs(i.y-label.y)<25))continue;
    const upper=items.filter((i)=>i.y>label.y+12&&i.y<label.y+140);
    const unit=items.find((i)=>Math.abs(i.y-label.y)<10&&i.x>label.x+60&&['kh','gio'].includes(norm(i.text)));
    const chi=upper.filter((i)=>norm(i.text)==='chi'&&i.x>(unit?.x??1e9)).sort((a,b)=>a.y-b.y)[0];
    const month=upper.filter((i)=>norm(i.text)==='trong'&&i.x>(chi?.x??1e9)).sort((a,b)=>a.y-b.y)[0];
    const ytd=upper.filter((i)=>['luy','luy ke'].includes(norm(i.text))&&i.x>(month?.x??1e9)).sort((a,b)=>a.y-b.y)[0];
    const compare=upper.filter((i)=>['% so voi','dat so voi'].includes(norm(i.text))&&i.x>(ytd?.x??1e9)).sort((a,b)=>a.y-b.y)[0];
    const assessment=upper.filter((i)=>['danh','danh gia'].includes(norm(i.text))&&i.x>(compare?.x??1e9)).sort((a,b)=>a.y-b.y)[0];
    if(unit&&chi&&month&&ytd&&compare&&assessment)add(id,label,{planYear:center(chi),actualMonth:center(month),actualYtd:center(ytd),compareYear:center(compare),status:center(assessment)},center(unit),15);
  }

  // SCL tables can continue onto the next page. Require the SCL section title.
  const sclContext=norm(page.text+' '+(previous?.text??''));
  if(sclContext.includes('cong tac scl')||sclContext.includes('cong tac sua chua lon')){
    for(const label of items.filter((i)=>norm(i.text)==='gia tri thuc hien')){
      const upper=items.filter((i)=>i.y>label.y+10&&i.y<label.y+250);
      const unit=items.find((i)=>Math.abs(i.y-label.y)<5&&norm(i.text)==='ty dong'&&i.x>label.x);
      const plan=upper.find((i)=>norm(i.text)==='ke'&&i.x>(unit?.x??1e9));
      const month=upper.find((i)=>norm(i.text)==='thang'&&i.x>(plan?.x??1e9));
      const ytd=upper.find((i)=>norm(i.text)==='luy ke'&&i.x>(month?.x??1e9));
      const compare=upper.find((i)=>norm(i.text)==='ty le'&&i.x>(ytd?.x??1e9));
      const note=upper.find((i)=>norm(i.text)==='ghi chu'&&i.x>(compare?.x??1e9));
      if(unit&&plan&&month&&ytd&&compare&&note)add('SCL',label,{planYear:center(plan),actualMonth:center(month),actualYtd:center(ytd),compareYear:center(compare),other:center(note)},center(unit));
    }
  }
  return out;
}

function status(text:string):string {
  const n=norm(text).replace(/\s+/g,'');
  if(n.includes('dat1phan')||n.includes('datmotphan'))return 'Đạt một phần';
  if(n.includes('khongdat')||n.includes('chuadat')||n.includes('kdat'))return 'Không đạt';
  if(n.includes('dukien')&&n.includes('dat'))return 'Dự kiến đạt';
  if(n==='dat')return 'Đạt';
  return '';
}

function asRecord(period:string,doc:PdfExtractedDocument,row:PhysicalRow):PdfImportRecord {
  const entry=KPI_BY_ID[row.id];
  const values:PdfNumericValues={};
  const issues=[...row.issues];
  for(const field of ['planYear','planYtd','actualMonth','actualYtd'] as const){
    const raw=row.cells[field]??'';
    if(blank(raw))continue;
    const number=parseViNumber(raw);
    const compact=raw.replace(/\s/g,'');
    // Mixed-format reports also use a dot as decimal. Do not silently turn
    // 0.001 into 1 or a monthly 390.349 billion into 390,349 billion.
    const fractionalUnit=!['KH','HĐ','Cái','kWh','Người','Trạm'].includes(entry.unit);
    const ambiguous=fractionalUnit&&(/^[+-]?0\.\d{3}$/.test(compact)||
      (field==='actualMonth'&&/^[+-]?\d{1,3}\.\d{3}$/.test(compact)));
    if(ambiguous)issues.push(`Dấu chấm trong “${raw}” có thể là dấu thập phân; cần đối chiếu bản gốc.`);
    else if(number===undefined)issues.push(`Không đọc chắc cột ${field}: “${raw}”.`);
    else values[field]=number;
  }
  if(row.id==='CRM'){
    for(const [field,received,resolved] of [['actualMonth','monthReceived','monthResolved'],['actualYtd','ytdReceived','ytdResolved']] as const){
      const total=parseViNumber(row.cells[received]??''),done=parseViNumber(row.cells[resolved]??'');
      if(total!==undefined&&done!==undefined&&total>0&&done>=0&&done<=total)values[field]=Number((100*done/total).toFixed(2));
      else issues.push(`Không đủ số tiếp nhận và đã xử lý để tính ${field}.`);
    }
  }
  // Evaluate this check after every cell has been assigned.
  if(entry.aggregate==='sum' && values.actualMonth!==undefined && values.actualYtd!==undefined && values.actualMonth>=0 && values.actualYtd>=0 && values.actualMonth>values.actualYtd){
    delete values.actualMonth;
    issues.push('Thực hiện tháng lớn hơn lũy kế; kiểm tra dấu phân cách hoặc số liệu nguồn.');
  }
  const empty=!Object.values(values).some((x)=>x!==undefined);
  if(empty)issues.push('Các ô số của chỉ tiêu không có dữ liệu hoặc chưa đọc chắc; giữ trống.');
  const sourceColumns=['planYear','planYtd','actualMonth','actualYtd','compareYear','comparePeriod','status','monthReceived','monthResolved','ytdReceived','ytdResolved']
    .filter((key)=>key in row.cells).map((key)=>`${key}=[${row.cells[key]||''}]`).join(' | ');
  return {rowId:`${period}|${row.id}`,period,docType:'DHSX',kpiId:row.id,domainId:entry.domainId,label:entry.label,unit:entry.unit,
    sourceLabel:'PDF theo cột',sourceFile:doc.name,sourcePage:row.page,sourceExcerpt:(sourceColumns+'\n'+row.excerpt).slice(0,900),sourceCells:row.cells,
    values,statusText:status(row.cells.status||''),confidence:issues.length?.7:.99,reviewStatus:issues.length?'NEED_REVIEW':'AUTO_OK',issues,conflicts:[]};
}

export function applyColumnExtraction(result:PdfParseResult,docs:PdfExtractedDocument[]):PdfParseResult {
  const columnRecords=new Map<string,PdfImportRecord>();
  for(const doc of docs){
    for(const [index,page] of doc.pages.entries()){
      for(const row of [...readBusiness(page),...readReliability(page),...readSupplementary(page,doc.pages[index-1])]){
        const record=asRecord(result.period,doc,row);
        const previous=columnRecords.get(row.id);
        if(previous){
          const differs=(Object.keys(record.values) as (keyof PdfNumericValues)[]).some((key)=>previous.values[key]!==undefined&&record.values[key]!==previous.values[key]);
          if(differs){previous.reviewStatus='CONFLICT';previous.issues.push('Hai dòng nguồn có số khác nhau; kiểm tra trước khi duyệt.');}
        } else columnRecords.set(row.id,record);
      }
    }
  }
  const records=result.records.map((record)=>{
    if(!record.kpiId||record.reviewStatus==='UNMAPPED')return record;
    const located=columnRecords.get(record.kpiId);
    if(located){columnRecords.delete(record.kpiId);return located;}
    // Sequence-based extraction cannot establish which physical column was blank.
    return {...record,values:{},confidence:0,reviewStatus:'NEED_REVIEW' as const,
      issues:[...new Set([...record.issues,'Chưa xác định chắc cột nguồn; giữ trống và kiểm tra thủ công.'])]};
  });
  records.push(...columnRecords.values());
  const stats={total:records.length,autoOk:records.filter((r)=>r.reviewStatus==='AUTO_OK').length,needReview:records.filter((r)=>r.reviewStatus==='NEED_REVIEW').length,conflict:records.filter((r)=>r.reviewStatus==='CONFLICT').length,unmapped:records.filter((r)=>r.reviewStatus==='UNMAPPED').length};
  return {...result,records,stats,notes:[...result.notes,'Đọc bảng theo vị trí cột trong PDF; ô trống được giữ trống. Các bảng chưa xác định được cột cần kiểm tra thủ công.']};
}
