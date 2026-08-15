'use client';

import { useEffect, useMemo, useState } from 'react';
import { extractPdfFile } from '@/lib/pdf-extract-client';
import { KPI_BY_ID, KPI_CATALOG } from '@/lib/kpi-catalog';
import type {
  PdfApprovedHistoryItem,
  PdfImportListItem,
  PdfImportRecord,
  PdfNumericValues,
  PdfParseResult,
  PdfPeriodSummary,
  PdfReviewStatus,
  PdfStagingSyncResult,
} from '@/types/pdf-import';

const FIELD_LABELS:Record<keyof PdfNumericValues,string>={actualMonth:'TH tháng',planMonth:'KH tháng',actualYtd:'Lũy kế TH',planYtd:'KH lũy kế',planYear:'KH năm',samePeriodMonth:'Cùng kỳ tháng',samePeriodYtd:'Cùng kỳ lũy kế'};
const FIELDS=Object.keys(FIELD_LABELS) as (keyof PdfNumericValues)[];

function vi(value?:number){return value===undefined?'':String(value).replace('.',',');}
function parseInput(value:string){if(!value.trim())return undefined;const n=Number(value.replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:undefined;}
function badge(status:PdfReviewStatus){return status==='AUTO_OK'?'Tự nhận':status==='VERIFIED'?'Đã xác nhận':status==='CONFLICT'?'Xung đột':status==='UNMAPPED'?'Chưa ánh xạ':status==='SKIP'?'Bỏ qua':'Cần kiểm tra';}
function syncClock(){return new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function countStats(rows:PdfImportRecord[]){return {total:rows.length,autoOk:rows.filter(r=>r.reviewStatus==='AUTO_OK').length,needReview:rows.filter(r=>r.reviewStatus==='NEED_REVIEW').length,conflict:rows.filter(r=>r.reviewStatus==='CONFLICT').length,unmapped:rows.filter(r=>r.reviewStatus==='UNMAPPED').length};}
function latestStamp(rows:PdfImportRecord[]){return rows.reduce((m,r)=>Math.max(m,r.updatedAt?new Date(r.updatedAt).getTime():0),0);}

async function api(path:string,token:string,init:RequestInit={}){
  const headers=new Headers(init.headers||{}); headers.set('Authorization',`Bearer ${token}`); if(init.body)headers.set('Content-Type','application/json');
  const response=await fetch(path,{...init,headers,cache:'no-store'}); const data=await response.json().catch(()=>({ok:false,error:`HTTP ${response.status}`}));
  if(!response.ok||data?.ok===false) throw new Error(data?.error||`HTTP ${response.status}`); return data;
}

export default function PdfImportCenter(){
  const now=new Date();
  const [year,setYear]=useState(String(now.getFullYear())); const [month,setMonth]=useState(String(now.getMonth()+1).padStart(2,'0'));
  const period=`${year}-${month}`;
  const [configured,setConfigured]=useState<boolean|null>(null); const [pin,setPin]=useState(''); const [token,setToken]=useState(''); const [authError,setAuthError]=useState('');
  const [files,setFiles]=useState<File[]>([]); const [busy,setBusy]=useState(''); const [progress,setProgress]=useState(''); const [result,setResult]=useState<PdfParseResult|null>(null); const [records,setRecords]=useState<PdfImportRecord[]>([]); const [filter,setFilter]=useState<'all'|'review'|'conflict'|'unmapped'>('all'); const [message,setMessage]=useState(''); const [imports,setImports]=useState<PdfImportListItem[]>([]);
  const [approvedRows,setApprovedRows]=useState<PdfApprovedHistoryItem[]>([]); const [corrKpiId,setCorrKpiId]=useState(''); const [corrField,setCorrField]=useState<keyof PdfNumericValues>('actualMonth'); const [corrValue,setCorrValue]=useState(''); const [corrReason,setCorrReason]=useState(''); const [corrBusy,setCorrBusy]=useState(false);
  const [sheetUrl,setSheetUrl]=useState(''); const [syncBusy,setSyncBusy]=useState(false); const [syncText,setSyncText]=useState('Chưa đồng bộ'); const [dirtyRows,setDirtyRows]=useState<string[]>([]); const [summaryDirty,setSummaryDirty]=useState(false); const [autoSync,setAutoSync]=useState(true);

  useEffect(()=>{fetch('/api/pdf/auth',{cache:'no-store'}).then((r)=>r.json()).then((x)=>setConfigured(Boolean(x.configured))).catch(()=>setConfigured(false));const saved=sessionStorage.getItem('PDF_ADMIN_TOKEN');if(saved)setToken(saved);},[]);
  useEffect(()=>{if(token){loadImports();loadPeriodData();}},[token,period]);
  useEffect(()=>{
    if(!autoSync||!result||(!dirtyRows.length&&!summaryDirty)||syncBusy)return;
    const id=window.setTimeout(()=>{void saveToSheet(false);},1200);
    return ()=>window.clearTimeout(id);
  },[dirtyRows,summaryDirty,autoSync,result?.importId,records]);
  useEffect(()=>{
    if(!autoSync||!token||!result?.importId)return;
    const timer=window.setInterval(async()=>{
      if(dirtyRows.length||summaryDirty||syncBusy)return;
      try{const x=await api(`/api/pdf/staging?importId=${encodeURIComponent(result.importId)}`,token) as PdfStagingSyncResult;if(latestStamp(x.records||[])>latestStamp(records)+500){applyStaging(x,result);setSyncText(`Sheet tự đồng bộ ${syncClock()}`);}}catch{/* giữ yên app nếu polling lỗi */}
    },20000);
    return ()=>window.clearInterval(timer);
  },[autoSync,token,result?.importId,dirtyRows.length,summaryDirty,syncBusy,records]);

  async function login(){setAuthError('');try{const r=await fetch('/api/pdf/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const x=await r.json();if(!r.ok||!x.ok)throw new Error(x.error||'Không đăng nhập được');setToken(x.token);sessionStorage.setItem('PDF_ADMIN_TOKEN',x.token);setPin('');}catch(e){setAuthError(String(e instanceof Error?e.message:e));}}
  async function loadImports(){try{const x=await api('/api/pdf/imports?limit=12',token);setImports(Array.isArray(x.imports)?x.imports:[]);}catch{/* backend may not be configured yet */}}
  async function loadPeriodData(){try{const x=await api(`/api/pdf/period?period=${period}`,token);const rows=Array.isArray(x.records)?x.records:[];setApprovedRows(rows);if(rows.length&&!rows.some((r:PdfApprovedHistoryItem)=>r.kpiId===corrKpiId))setCorrKpiId(rows[0].kpiId);}catch{setApprovedRows([]);}}
  function correctionCurrent(kpiId=corrKpiId,field=corrField){const r=approvedRows.find((x)=>x.kpiId===kpiId);return r?.values?.[field];}
  function chooseCorrection(kpiId:string,field:keyof PdfNumericValues=corrField){setCorrKpiId(kpiId);const value=approvedRows.find((x)=>x.kpiId===kpiId)?.values?.[field];setCorrValue(value===undefined?'':vi(value));}
  function chooseCorrectionField(field:keyof PdfNumericValues){setCorrField(field);const value=approvedRows.find((x)=>x.kpiId===corrKpiId)?.values?.[field];setCorrValue(value===undefined?'':vi(value));}
  async function submitCorrection(){if(!corrKpiId)return;const next=parseInput(corrValue);if(next===undefined){setMessage('Nhập giá trị hiệu chỉnh hợp lệ.');return;}setCorrBusy(true);try{const x=await api('/api/pdf/correct',token,{method:'POST',body:JSON.stringify({period,kpiId:corrKpiId,field:corrField,newValue:next,reason:corrReason||'Hiệu chỉnh sau duyệt',user:'pdf-admin'})});setMessage(`Đã hiệu chỉnh ${corrKpiId}: ${x.oldValue??'—'} → ${x.newValue}. Dữ liệu được khóa MANUAL_OVERRIDE để PDF sau không tự ghi đè.`);setCorrReason('');await loadPeriodData();}catch(e){setMessage(`Không hiệu chỉnh được: ${e instanceof Error?e.message:e}`);}finally{setCorrBusy(false);}}

  function applyStaging(staged:PdfStagingSyncResult,base?:PdfParseResult){
    const rows=Array.isArray(staged.records)?staged.records:[]; setRecords(rows); setSheetUrl(staged.sheetUrl||''); setDirtyRows([]); setSummaryDirty(false); setSyncText(`Đồng bộ ${syncClock()}`);
    const p=staged.period||base?.period||period; if(/^\d{4}-\d{2}$/.test(p)){setYear(p.slice(0,4));setMonth(p.slice(5,7));}
    const summary=staged.summary||base?.summary||{total:0,pass:0,partial:0,fail:0,detected:false};
    const stats=countStats(rows);
    setResult({ok:true,importId:staged.importId||base?.importId||'',period:p,documents:base?.documents||[],records:rows,summary,stats,notes:base?.notes||['V1.7: review song song App ↔ Google Sheet']});
  }

  async function parseFiles(){
    if(!files.length||!token)return; setBusy('Đang đọc PDF');setMessage('');setResult(null);setRecords([]);setDirtyRows([]);setSheetUrl('');
    try{
      const documents=[];
      for(let i=0;i<files.length;i++){
        const file=files[i]; setProgress(`Đọc ${file.name}...`);
        const doc=await extractPdfFile(file,(p,t)=>setProgress(`${file.name}: trang ${p}/${t}`)); documents.push(doc);
      }
      setBusy('Đang nhận dạng KPI'); setProgress('Phân tích cấu trúc, đối chiếu nguồn và tạo staging...');
      const parsed=await api('/api/pdf/parse',token,{method:'POST',body:JSON.stringify({period,documents})}) as PdfParseResult;
      setResult(parsed);setRecords(parsed.records);
      try{
        const staged=await api('/api/pdf/stage',token,{method:'POST',body:JSON.stringify({importId:parsed.importId,period,documents:parsed.documents,records:parsed.records,summary:parsed.summary})});
        const synced=await api(`/api/pdf/staging?importId=${encodeURIComponent(parsed.importId)}`,token) as PdfStagingSyncResult;
        applyStaging({...synced,sheetUrl:synced.sheetUrl||staged.sheetUrl},parsed);
        setMessage('Đã tạo staging. Từ đây có thể kiểm tra đồng thời trên App và Google Sheet; thay đổi trên App được tự lưu.');await loadImports();
      }catch(e){setMessage(`Đã phân tích cục bộ nhưng chưa lưu staging: ${e instanceof Error?e.message:e}`);}
    }catch(e){setMessage(`Lỗi: ${e instanceof Error?e.message:e}`);}finally{setBusy('');setProgress('');}
  }

  function markDirty(rowId:string){setDirtyRows((old)=>old.includes(rowId)?old:[...old,rowId]);setSyncText('Có thay đổi chưa lưu');}
  function updateRecord(rowId:string,patch:Partial<PdfImportRecord>){setRecords((old)=>old.map((r)=>r.rowId===rowId?{...r,...patch}:r));markDirty(rowId);}
  function updateValue(rowId:string,field:keyof PdfNumericValues,value:string){setRecords((old)=>old.map((r)=>r.rowId===rowId?{...r,values:{...r.values,[field]:parseInput(value)},reviewStatus:r.reviewStatus==='AUTO_OK'||r.reviewStatus==='VERIFIED'?'NEED_REVIEW':r.reviewStatus}:r));markDirty(rowId);}
  function mapKpi(rowId:string,kpiId:string){const k=KPI_BY_ID[kpiId];if(!k)return;setRecords((old)=>old.map((r)=>r.rowId===rowId?{...r,kpiId:k.id,domainId:k.domainId,label:k.label,unit:k.unit,reviewStatus:'NEED_REVIEW',rememberAlias:true}:r));markDirty(rowId);}
  function verify(rowId:string){updateRecord(rowId,{reviewStatus:'VERIFIED',reviewedBy:'app-review'});}
  function skip(rowId:string){updateRecord(rowId,{reviewStatus:'SKIP',reviewedBy:'app-review'});}
  function updateSummary(patch:Partial<PdfPeriodSummary>){if(!result)return;setResult({...result,summary:{...result.summary,...patch}});setSummaryDirty(true);setSyncText('Có thay đổi tổng hợp chưa lưu');}

  async function saveToSheet(explicit=true){
    if(!result||(!dirtyRows.length&&!summaryDirty))return true;
    setSyncBusy(true); if(explicit)setSyncText('Đang lưu App → Sheet...');
    try{
      const selected=dirtyRows.length?records.filter((r)=>dirtyRows.includes(r.rowId)):[];
      const x=await api('/api/pdf/staging',token,{method:'POST',body:JSON.stringify({importId:result.importId,records:selected,summary:result.summary,user:'app-review'})}) as PdfStagingSyncResult & {conflicts?:number};
      if(Number(x.conflicts||0)>0){applyStaging(x,result);setMessage(`Google Sheet có ${x.conflicts} dòng mới hơn bản App. App đã lấy bản Sheet để tránh ghi đè. Hãy kiểm tra lại các dòng vừa sửa.`);return false;}
      applyStaging(x,result); if(explicit)setMessage('Đã lưu thay đổi từ App sang Google Sheet.'); return true;
    }catch(e){setSyncText('Lỗi đồng bộ');if(explicit)setMessage(`Không lưu được staging: ${e instanceof Error?e.message:e}`);return false;}finally{setSyncBusy(false);}
  }

  async function syncFromSheet(force=false){
    if(!result)return;
    if((dirtyRows.length||summaryDirty)&&!force){const ok=window.confirm('App đang có thay đổi chưa lưu. Lấy bản Google Sheet sẽ ưu tiên dữ liệu trên Sheet. Tiếp tục?');if(!ok)return;}
    setSyncBusy(true);setSyncText('Đang lấy Sheet → App...');
    try{const x=await api(`/api/pdf/staging?importId=${encodeURIComponent(result.importId)}`,token) as PdfStagingSyncResult;applyStaging(x,result);setMessage('Đã lấy bản staging mới nhất từ Google Sheet.');}
    catch(e){setSyncText('Lỗi đồng bộ');setMessage(`Không lấy được staging: ${e instanceof Error?e.message:e}`);}finally{setSyncBusy(false);}
  }

  async function resumeImport(item:PdfImportListItem){
    if(item.status==='APPROVED'){setMessage('Import này đã duyệt. Dùng khu vực “Hiệu chỉnh dữ liệu đã duyệt” nếu cần sửa.');return;}
    setBusy('Đang mở phiên review');
    try{const x=await api(`/api/pdf/staging?importId=${encodeURIComponent(item.importId)}`,token) as PdfStagingSyncResult;applyStaging(x);setMessage(`Đã mở lại phiên ${item.period}. Có thể tiếp tục kiểm tra trên App hoặc Google Sheet.`);window.scrollTo({top:0,behavior:'smooth'});}
    catch(e){setMessage(`Không mở lại được import: ${e instanceof Error?e.message:e}`);}finally{setBusy('');}
  }

  const visible=useMemo(()=>records.filter((r)=>filter==='all'||filter==='review'&&r.reviewStatus==='NEED_REVIEW'||filter==='conflict'&&r.reviewStatus==='CONFLICT'||filter==='unmapped'&&r.reviewStatus==='UNMAPPED'),[records,filter]);
  const unresolved=records.filter((r)=>['NEED_REVIEW','CONFLICT'].includes(r.reviewStatus)).length;
  const approvedCount=records.filter((r)=>['AUTO_OK','VERIFIED'].includes(r.reviewStatus)).length;

  async function approve(){
    if(!result)return;
    setBusy('Đang kiểm tra staging mới nhất');setMessage('');
    try{
      const saved=await saveToSheet(false); if(!saved){setBusy('');return;}
      const latest=await api(`/api/pdf/staging?importId=${encodeURIComponent(result.importId)}`,token) as PdfStagingSyncResult;
      applyStaging(latest,result);
      const unresolvedLatest=latest.records.filter((r)=>['NEED_REVIEW','CONFLICT'].includes(r.reviewStatus)).length;
      if(unresolvedLatest){setMessage(`Google Sheet/App còn ${unresolvedLatest} dòng cần xử lý. Hãy xác nhận hoặc bỏ qua trước khi duyệt.`);setBusy('');return;}
      setBusy('Đang duyệt dữ liệu chính thức');
      const x=await api('/api/pdf/approve',token,{method:'POST',body:JSON.stringify({importId:result.importId,period:result.period||period,summary:latest.summary||result.summary,approvedBy:'pdf-admin',useStaging:true})});
      setMessage(`Đã duyệt thành công từ staging đồng bộ: ${x.upserted||approvedCount} KPI, ${x.skipped||0} bỏ qua, ${x.locked||0} giá trị MANUAL_OVERRIDE được giữ nguyên.`);await loadImports();await loadPeriodData();
    }catch(e){setMessage(`Không duyệt được: ${e instanceof Error?e.message:e}`);}finally{setBusy('');}
  }

  if(configured===null)return <main className="pdfCenter"><div className="pdfLoading">Đang kiểm tra module nhập PDF...</div></main>;
  if(!configured)return <main className="pdfCenter"><header className="pdfTop"><a href="/">‹</a><div><small>Công cụ quản trị</small><h1>Nhập báo cáo PDF</h1></div></header><section className="pdfSetup"><b>Chưa cấu hình quyền nhập PDF</b><p>Thêm <code>PDF_ADMIN_PIN</code> và <code>PDF_ADMIN_SECRET</code> trong Vercel → Environment Variables, sau đó Redeploy.</p><p>Google Sheets backend cũng cần <code>APPS_SCRIPT_API_URL</code> và <code>APPS_SCRIPT_API_KEY</code>.</p></section></main>;
  if(!token)return <main className="pdfCenter"><header className="pdfTop"><a href="/">‹</a><div><small>Công cụ quản trị</small><h1>Nhập báo cáo PDF</h1></div></header><section className="pdfLogin"><span>▣</span><h2>Mở khu vực nhập dữ liệu</h2><p>Nhập PIN quản trị. Quyền này chỉ dùng cho nhập/hiệu chỉnh dữ liệu, không ảnh hưởng người xem dashboard.</p><input inputMode="numeric" type="password" value={pin} onChange={(e)=>setPin(e.target.value)} placeholder="PIN quản trị" onKeyDown={(e)=>e.key==='Enter'&&login()}/><button onClick={login}>Mở công cụ</button>{authError&&<em>{authError}</em>}</section></main>;

  return <main className="pdfCenter">
    <header className="pdfTop"><a href="/">‹</a><div><small>V1.7 · Review song song App ↔ Google Sheet</small><h1>Nhập & kiểm tra PDF</h1></div><button onClick={()=>{sessionStorage.removeItem('PDF_ADMIN_TOKEN');setToken('');}}>Khóa</button></header>

    <section className="pdfIntro"><div><b>1. Chọn kỳ và PDF</b><small>PDF đọc trên thiết bị → staging Google Sheet → kiểm tra song song → duyệt.</small></div><div className="pdfPeriod"><select value={year} onChange={(e)=>setYear(e.target.value)}>{Array.from({length:5},(_,i)=>String(now.getFullYear()-3+i)).map((y)=><option key={y}>{y}</option>)}</select><select value={month} onChange={(e)=>setMonth(e.target.value)}>{Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map((m)=><option key={m} value={m}>Tháng {Number(m)}</option>)}</select></div><label className="pdfDrop"><input type="file" accept="application/pdf,.pdf" multiple onChange={(e)=>setFiles(Array.from(e.target.files||[]).slice(0,4))}/><span>＋</span><b>Chọn PDF báo cáo</b><small>Khuyến nghị: PL1 + Báo cáo ĐHSX cùng kỳ · tối đa 4 file/lần</small></label>{files.length>0&&<div className="pdfFiles">{files.map((f)=><span key={`${f.name}-${f.size}`}><b>{f.name}</b><small>{(f.size/1024/1024).toFixed(1)} MB</small></span>)}</div>}<button className="pdfPrimary" disabled={!files.length||Boolean(busy)} onClick={parseFiles}>{busy||'Đọc & phân tích PDF'}</button>{progress&&<p className="pdfProgress">{progress}</p>}</section>

    {result&&<>
      <section className="pdfParallel"><div className="pdfParallelTitle"><span className={dirtyRows.length||summaryDirty?'pending':'ok'}>●</span><div><b>Kiểm tra song song</b><small>App và <b>03_PDF_STAGING</b> dùng chung dữ liệu. Sửa App tự lưu; sửa Sheet bấm Đồng bộ.</small></div></div><div className="pdfParallelActions"><button disabled={!sheetUrl} onClick={()=>sheetUrl&&window.open(sheetUrl,'_blank','noopener,noreferrer')}>↗ Mở Google Sheet</button><button disabled={syncBusy} onClick={()=>void syncFromSheet(false)}>↻ Đồng bộ từ Sheet</button><button disabled={syncBusy||(!dirtyRows.length&&!summaryDirty)} onClick={()=>void saveToSheet(true)}>↑ Lưu App → Sheet</button></div><div className="pdfSyncState"><label><input type="checkbox" checked={autoSync} onChange={(e)=>setAutoSync(e.target.checked)}/> Tự đồng bộ</label><span>{dirtyRows.length?`${dirtyRows.length} dòng đang chờ lưu`:summaryDirty?'Tổng hợp đang chờ lưu':syncBusy?'Đang đồng bộ...':syncText}</span></div></section>

      <section className="pdfStats"><div><small>Dữ liệu nhận dạng</small><b>{records.length}</b></div><div className="ok"><small>Tự nhận</small><b>{records.filter((r)=>r.reviewStatus==='AUTO_OK').length}</b></div><div className="warn"><small>Cần duyệt</small><b>{records.filter((r)=>r.reviewStatus==='NEED_REVIEW').length}</b></div><div className="bad"><small>Xung đột</small><b>{records.filter((r)=>r.reviewStatus==='CONFLICT').length}</b></div><div className="neutral"><small>Chưa ánh xạ</small><b>{records.filter((r)=>r.reviewStatus==='UNMAPPED').length}</b></div></section>

      <section className="pdfSummaryEdit"><div><b>Tổng hợp KPI kỳ {result.period||period}</b><small>{result.summary.detected?'Đã suy ra từ PDF. V1.7 tự lưu các hiệu chỉnh tổng hợp vào phiên staging.':'Chưa suy ra đủ từ PDF.'}</small></div><label>Tổng<input type="number" value={result.summary.total} onChange={(e)=>updateSummary({total:Number(e.target.value)})}/></label><label>Đạt<input type="number" value={result.summary.pass} onChange={(e)=>updateSummary({pass:Number(e.target.value)})}/></label><label>Một phần<input type="number" value={result.summary.partial} onChange={(e)=>updateSummary({partial:Number(e.target.value)})}/></label><label>Không đạt<input type="number" value={result.summary.fail} onChange={(e)=>updateSummary({fail:Number(e.target.value)})}/></label></section>

      <section className="pdfReview"><div className="pdfReviewHead"><div><b>2. Kiểm tra & hiệu chỉnh</b><small>Chỉ NEED_REVIEW/CONFLICT bắt buộc xử lý. Có thể chia việc: một người rà trên App, một người rà trên Google Sheet.</small></div><div className="pdfPills"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tất cả</button><button className={filter==='review'?'active':''} onClick={()=>setFilter('review')}>Cần duyệt</button><button className={filter==='conflict'?'active':''} onClick={()=>setFilter('conflict')}>Xung đột</button><button className={filter==='unmapped'?'active':''} onClick={()=>setFilter('unmapped')}>Chưa ánh xạ</button></div></div>
      <div className="pdfRecordList">{visible.map((r)=><article key={r.rowId} className={`pdfRecord ${r.reviewStatus.toLowerCase()}`}><header><div><span>{r.kpiId||'?'}</span><b>{r.label}</b><small>{r.sourceFile} · trang {r.sourcePage}{r.reviewedBy?` · ${r.reviewedBy}`:''}</small></div><em>{badge(r.reviewStatus)} · {Math.round(r.confidence*100)}%</em></header>{r.reviewStatus==='UNMAPPED'&&<label className="pdfMap">Ánh xạ KPI<select value={r.kpiId||''} onChange={(e)=>mapKpi(r.rowId,e.target.value)}><option value="">-- Chọn KPI --</option>{KPI_CATALOG.map((k)=><option key={k.id} value={k.id}>{k.domainName} · {k.label}</option>)}</select></label>}<div className="pdfFieldGrid">{FIELDS.map((field)=><label key={field}><small>{FIELD_LABELS[field]}</small><input inputMode="decimal" value={vi(r.values[field])} onChange={(e)=>updateValue(r.rowId,field,e.target.value)} placeholder="—"/></label>)}</div>{r.statusText&&<p className="pdfStatusText">Trạng thái nguồn: <b>{r.statusText}</b></p>}{r.issues.length>0&&<ul>{r.issues.map((x,i)=><li key={i}>{x}</li>)}</ul>}{r.conflicts?.length?<div className="pdfConflicts">{r.conflicts.map((c,i)=><p key={i}><b>{FIELD_LABELS[c.field]}</b>: {c.left} ↔ {c.right}<small>{c.sourceLeft} / {c.sourceRight}</small></p>)}</div>:null}<label className="pdfReviewNote"><small>Ghi chú kiểm tra</small><input value={r.reviewNote||''} onChange={(e)=>updateRecord(r.rowId,{reviewNote:e.target.value})} placeholder="Ví dụ: đối chiếu trang 2, số đúng theo PL1..."/></label><details><summary>Xem đoạn nguồn</summary><pre>{r.sourceExcerpt}</pre></details><footer><label><input type="checkbox" checked={Boolean(r.rememberAlias)} onChange={(e)=>updateRecord(r.rowId,{rememberAlias:e.target.checked})}/> Ghi nhớ alias</label><div><button onClick={()=>skip(r.rowId)}>Bỏ qua</button><button className="verify" disabled={!r.kpiId} onClick={()=>verify(r.rowId)}>Xác nhận</button></div></footer></article>)}</div></section>

      <section className="pdfApprove"><div><b>3. Duyệt dữ liệu chính thức</b><small>{approvedCount} KPI sẵn sàng · {unresolved} dòng chưa xử lý · lúc duyệt backend luôn đọc lại staging mới nhất từ Google Sheet.</small></div><button disabled={Boolean(busy)||unresolved>0||approvedCount===0} onClick={approve}>{busy||'Duyệt staging → KPI_HISTORY'}</button></section>
    </>}

    {message&&<div className="pdfMessage">{message}</div>}

    <details className="pdfCorrection"><summary><span><b>Hiệu chỉnh dữ liệu đã duyệt</b><small>Kỳ {period} · mọi sửa đổi được lưu Change Log và khóa MANUAL_OVERRIDE</small></span><span>›</span></summary><div className="pdfCorrectionBody">{approvedRows.length?<><label>KPI<select value={corrKpiId} onChange={(e)=>chooseCorrection(e.target.value)}>{approvedRows.map((r)=><option key={r.kpiId} value={r.kpiId}>{r.label} · {r.kpiId}</option>)}</select></label><label>Trường dữ liệu<select value={corrField} onChange={(e)=>chooseCorrectionField(e.target.value as keyof PdfNumericValues)}>{FIELDS.map((f)=><option key={f} value={f}>{FIELD_LABELS[f]}</option>)}</select></label><label>Giá trị hiện tại<input disabled value={correctionCurrent()===undefined?'—':vi(correctionCurrent())}/></label><label>Giá trị đúng<input inputMode="decimal" value={corrValue} onChange={(e)=>setCorrValue(e.target.value)} placeholder="Nhập giá trị đúng"/></label><label className="wide">Lý do<input value={corrReason} onChange={(e)=>setCorrReason(e.target.value)} placeholder="Ví dụ: PDF đọc sai dấu phân cách"/></label><button className="pdfPrimary wide" disabled={corrBusy||!corrKpiId} onClick={submitCorrection}>{corrBusy?'Đang lưu...':'Lưu hiệu chỉnh & khóa giá trị'}</button></>:<p>Chưa có KPI đã duyệt ở kỳ này.</p>}</div></details>

    <section className="pdfHistory"><div><b>Phiên nhập gần đây</b><button onClick={loadImports}>↻</button></div>{imports.length?<div>{imports.map((x)=><article key={x.importId}><span><b>{x.period}</b><small>{x.files}</small></span><div className="pdfHistoryAction"><em className={x.status==='APPROVED'?'ok':''}>{x.status}</em>{x.status!=='APPROVED'&&<button onClick={()=>void resumeImport(x)}>Tiếp tục review</button>}</div></article>)}</div>:<small>Chưa có lịch sử hoặc backend Google Sheets chưa cấu hình.</small>}</section>
  </main>;
}
