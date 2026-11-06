import { KPI_BY_ID, normalizeLookup } from '@/lib/kpi-catalog';
import { parseViNumber } from '@/lib/vi-number';
import type { PdfExtractedDocument, PdfExtractedPage, PdfImportRecord, PdfNumericValues, PdfParseResult } from '@/types/pdf-import';

type Item = NonNullable<PdfExtractedPage['items']>[number];
type CellName = 'planYear' | 'planYtd' | 'actualMonth' | 'actualYtd' | 'samePeriodYtd' | 'samePeriodRate' | 'compareYear' | 'comparePeriod' | 'status';
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

function status(text:string):string {
  const n=norm(text).replace(/\s+/g,'');
  if(n.includes('dat1phan')||n.includes('datmotphan'))return 'Đạt một phần';
  if(n.includes('khongdat')||n.includes('chuadat')||n.includes('kdat'))return 'Không đạt';
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
  // Evaluate this check after every cell has been assigned.
  if(entry.aggregate==='sum' && values.actualMonth!==undefined && values.actualYtd!==undefined && values.actualMonth>=0 && values.actualYtd>=0 && values.actualMonth>values.actualYtd){
    delete values.actualMonth;
    issues.push('Thực hiện tháng lớn hơn lũy kế; kiểm tra dấu phân cách hoặc số liệu nguồn.');
  }
  const empty=!Object.values(values).some((x)=>x!==undefined);
  if(empty)issues.push('Các ô số của chỉ tiêu không có dữ liệu hoặc chưa đọc chắc; giữ trống.');
  const sourceColumns=['planYear','planYtd','actualMonth','actualYtd','compareYear','comparePeriod','status']
    .filter((key)=>key in row.cells).map((key)=>`${key}=[${row.cells[key]||''}]`).join(' | ');
  return {rowId:`${period}|${row.id}`,period,docType:'DHSX',kpiId:row.id,domainId:entry.domainId,label:entry.label,unit:entry.unit,
    sourceLabel:'PDF theo cột',sourceFile:doc.name,sourcePage:row.page,sourceExcerpt:(sourceColumns+'\n'+row.excerpt).slice(0,900),sourceCells:row.cells,
    values,statusText:status(row.cells.status||''),confidence:issues.length?.7:.99,reviewStatus:issues.length?'NEED_REVIEW':'AUTO_OK',issues,conflicts:[]};
}

export function applyColumnExtraction(result:PdfParseResult,docs:PdfExtractedDocument[]):PdfParseResult {
  const columnRecords=new Map<string,PdfImportRecord>();
  for(const doc of docs){
    for(const page of doc.pages){
      for(const row of [...readBusiness(page),...readReliability(page)]){
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
