import type { PdfExtractedDocument, PdfImportRecord, PdfNumericValues, PdfParseResult } from '@/types/pdf-import';

function normalize(text:string){
  return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/\s+/g,' ').trim();
}

function vi(raw?:string):number|undefined{
  if(!raw) return undefined;
  let s=String(raw).trim().replace(/\s/g,'').replace(/[–—]/g,'-').replace(/[^0-9,.-]/g,'');
  if(!s||s==='-') return undefined;
  const neg=s.startsWith('-'); s=s.replace(/-/g,'');
  if(s.includes(',')&&s.includes('.')){
    const c=s.lastIndexOf(','), d=s.lastIndexOf('.');
    s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  }else if(s.includes(',')){
    const p=s.split(',');
    s=p.length===2&&p[1].length<=4?`${p[0].replace(/\./g,'')}.${p[1]}`:s.replace(/,/g,'');
  }else if((s.match(/\./g)||[]).length>1){
    const p=s.split('.');
    const tail=p[p.length-1];
    s=tail.length<=2?p.slice(0,-1).join('')+'.'+tail:p.join('');
  }
  const n=Number(s); return Number.isFinite(n)?(neg?-n:n):undefined;
}

function rec(period:string,doc:PdfExtractedDocument,page:number,id:string,label:string,unit:string|undefined,values:PdfNumericValues,statusText:string,excerpt:string,issues:string[]=[]):PdfImportRecord{
  return {
    rowId:`${period}|${id}`,
    period,
    docType:'DHSX',
    kpiId:id,
    domainId:id==='DV_CHUYENCHU'?'dvkh':'kinh-doanh',
    label,
    unit,
    sourceLabel:'DHSX-real-v1.8',
    values,
    statusText,
    confidence:.99,
    sourceFile:doc.name,
    sourcePage:page,
    sourceExcerpt:excerpt.slice(0,900),
    reviewStatus:'AUTO_OK',
    issues,
    conflicts:[],
  };
}

function findNums(text:string,pattern:RegExp){
  const m=text.match(pattern); if(!m) return undefined;
  return m.slice(1).map(vi);
}

function scanDoc(period:string,doc:PdfExtractedDocument):PdfImportRecord[]{
  const out:PdfImportRecord[]=[];
  for(const page of doc.pages){
    const raw=String(page.text||'').replace(/\s+/g,' ').trim();
    const n=normalize(raw);
    if(!raw) continue;

    if(n.includes('ket qua thuc hien cac chi tieu kinh doanh')){
      let x=findNums(raw,/Điện\s*nhận\s+Tr\.kWh\s+([\d.,]+)\s+([\d.,]+)/i);
      if(x?.[0]!==undefined&&x?.[1]!==undefined) out.push(rec(period,doc,page.page,'KD_DIENNHAN','Điện nhận','Tr.kWh',{actualMonth:x[0],actualYtd:x[1]},'Đạt',raw));

      x=findNums(raw,/Giá\s*mua\s*điện\s*bình\s*quân\s+đ\/kWh\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      if(x?.[0]!==undefined&&x?.[1]!==undefined&&x?.[2]!==undefined) out.push(rec(period,doc,page.page,'KD_GIAMUA','Giá mua điện bình quân','đ/kWh',{planYear:x[0],actualMonth:x[1],actualYtd:x[2]},'Không đạt',raw,['Bảng chỉ tiêu chính ghi Không đạt; phần tổng hợp cuối báo cáo có thể không liệt kê riêng chỉ tiêu này.']));

      x=findNums(raw,/Kiểm\s*tra\s*xử\s*lý\s*vi\s*phạm\s*sử\s*dụng\s*điện\s+kWh\s+([\d.,]+)\s+[-–—]?\s*([\d.,]+)/i);
      if(x?.[0]!==undefined&&x?.[1]!==undefined) out.push(rec(period,doc,page.page,'KD_VIPHAM','Kiểm tra xử lý vi phạm sử dụng điện','kWh',{planYear:x[0],actualYtd:x[1]},'Không đạt',raw));

      x=findNums(raw,/Tiết\s*kiệm\s*điện\s+Tr\.kWh\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      if(x?.[0]!==undefined&&x?.[1]!==undefined&&x?.[2]!==undefined) out.push(rec(period,doc,page.page,'KD_TKIEM','Tiết kiệm điện','Tr.kWh',{planYear:x[0],actualMonth:x[1],actualYtd:x[2]},'Đạt',raw));

      const law=findNums(raw,/Bảo\s*trì\s*theo\s*Luật\s*Đo\s*lường\s+Cái\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      const dispatch=findNums(raw,/Bảo\s*trì\s*điều\s*phối\s+Cái\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      if(law?.[0]!==undefined&&law?.[2]!==undefined){
        out.push(rec(period,doc,page.page,'KD_CONGTO','Thay / bảo trì công tơ','Cái',{planYear:law[0],actualMonth:law[1],actualYtd:law[2]},'Không đạt',raw,[dispatch?.[0]!==undefined?`Bảo trì điều phối: ${dispatch[2]}/${dispatch[0]} cái.`:'Bảo trì điều phối cần đối chiếu nếu PDF đổi bố cục.']));
      }
    }

    if(n.includes('du bao dien thuong pham')){
      const x=findNums(raw,/Trên\s*1\s*triệu[\s\S]{0,180}?([\d.,]+)%\s+([\d.,]+)%[\s\S]{0,100}?Không\s*đạt[\s\S]{0,100}?([\d.,]+)%\s+([\d.,]+)%\s+Đạt/i);
      if(x?.[0]!==undefined&&x?.[1]!==undefined&&x?.[2]!==undefined&&x?.[3]!==undefined){
        out.push(rec(period,doc,page.page,'KD_DBPT','Dự báo phụ tải (điện thương phẩm)','%',{actualMonth:x[2],actualYtd:x[3],samePeriodMonth:x[0],samePeriodYtd:x[1]},'Đạt một phần',raw,['actualMonth/actualYtd lưu sai số dự báo Tổng thương phẩm; samePeriodMonth/samePeriodYtd tạm dùng để lưu sai số nhóm Trên 1 triệu.']));
      }
    }

    if(n.includes('cong tac quan ly thu ngan')){
      const a=findNums(raw,/Tỷ\s*lệ\s*thu\s*tiền\s*điện\s+%\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      const b=findNums(raw,/Tỷ\s*lệ\s*thu\s*tiền\s*điện\s*theo\s*phiên\s+%\s+([\d.,]+)\s+([\d.,]+)(?:\s+([\d.,]+))?/i);
      const c=findNums(raw,/Tỷ\s*lệ\s*không\s*dùng\s*tiền\s*mặt[^%]*%\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      if(a?.[0]!==undefined&&a?.[1]!==undefined&&a?.[2]!==undefined){
        out.push(rec(period,doc,page.page,'KD_THUNGAN','Công tác quản lý thu ngân','%',{planYear:a[0],actualMonth:a[1],actualYtd:a[2]},'Đạt',raw,[b?.[0]!==undefined?`Thu theo phiên: KH ${b[0]}%, TH ${b[1]}%.`:'',c?.[0]!==undefined?`Không dùng tiền mặt: KH ${c[0]}%, TH ${c[1]}%.`:''].filter(Boolean)));
      }
    }

    if(n.includes('hdmbd chuyen chu the')){
      const sh=findNums(raw,/HĐMBĐ\s*sinh\s*hoạt\s+HĐ\s+([\d.,]+)\s+([\d.,]+)/i);
      const nsh=findNums(raw,/HĐMBĐ\s*ngoài\s*sinh\s*hoạt\s+HĐ\s+([\d.,]+)\s+([\d.,]+)/i);
      if(sh?.[0]!==undefined&&sh?.[1]!==undefined){
        out.push(rec(period,doc,page.page,'DV_CHUYENCHU','HĐMBĐ chuyển chủ thể','HĐ',{actualMonth:sh[0],actualYtd:sh[1]},'Thông tin',raw,[nsh?.[0]!==undefined?`Ngoài sinh hoạt: ${nsh[0]} HĐ tháng, ${nsh[1]} HĐ lũy kế.`:'']));
      }
    }

    if(n.includes('cong tac quan ly htdd')||n.includes('thay bao tri duoc')){
      const one=findNums(raw,/([\d.,]+)\/([\d.,]+)\s*công\s*tơ\s*1\s*pha/i);
      const three=findNums(raw,/([\d.,]+)\/([\d.,]+)\s*công\s*tơ\s*3\s*pha/i);
      const ti=findNums(raw,/([\d.,]+)\/([\d.,]+)\s*TI\s*hạ\s*thế\s*khách\s*hàng/i);
      if(one?.[0]!==undefined){
        const existing=out.find(r=>r.kpiId==='KD_CONGTO');
        const extra=[`Công tơ 1 pha: ${one[0]}/${one[1]}.`,three?.[0]!==undefined?`Công tơ 3 pha: ${three[0]}/${three[1]}.`:'',ti?.[0]!==undefined?`TI hạ thế KH: ${ti[0]}/${ti[1]}.`:''].filter(Boolean);
        if(existing) existing.issues=[...existing.issues,...extra];
        else out.push(rec(period,doc,page.page,'KD_CONGTO','Thay / bảo trì công tơ','Cái',{},'Không đạt',raw,extra));
      }
    }
  }
  return out;
}

function stat(result:PdfParseResult){
  return {
    total:result.records.length,
    autoOk:result.records.filter(r=>r.reviewStatus==='AUTO_OK').length,
    needReview:result.records.filter(r=>r.reviewStatus==='NEED_REVIEW').length,
    conflict:result.records.filter(r=>r.reviewStatus==='CONFLICT').length,
    unmapped:result.records.filter(r=>r.reviewStatus==='UNMAPPED').length,
  };
}

export function applyRealBusinessPdfOverrides(result:PdfParseResult,documents:PdfExtractedDocument[]):PdfParseResult{
  const extras=documents.flatMap(doc=>scanDoc(result.period,doc));
  if(!extras.length) return result;
  const map=new Map(result.records.map(r=>[r.kpiId||r.rowId,r]));
  for(const row of extras){
    const old=map.get(row.kpiId||row.rowId);
    if(old){
      map.set(row.kpiId!,{...old,...row,issues:[...new Set([...(old.issues||[]),...(row.issues||[])])],conflicts:old.conflicts||[]});
    }else map.set(row.kpiId||row.rowId,row);
  }
  const records=[...map.values()];
  const next={...result,records,notes:[...result.notes,'V1.8 real-PDF: đã bổ sung ánh xạ các KPI Kinh doanh/DVKH từ báo cáo ĐHSX chuẩn.']};
  return {...next,stats:stat(next)};
}
