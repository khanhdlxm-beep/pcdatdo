import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendGet } from '@/lib/pdf-backend';
import { parsePdfDocuments } from '@/lib/pdf-parser';
import { applyHistoricalDhsxExtractors, detectPdfDataPeriod } from '@/lib/pdf-dhsx-history';
import type { PdfExtractedDocument } from '@/types/pdf-import';

export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ hoặc đã hết hạn.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const requestedPeriod=String(body?.period||'');
  const documents=body?.documents as PdfExtractedDocument[];
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)) return NextResponse.json({ok:false,error:'Kỳ báo cáo không hợp lệ.'},{status:400});
  if(!Array.isArray(documents)||!documents.length) return NextResponse.json({ok:false,error:'Chưa có dữ liệu PDF.'},{status:400});

  // Báo cáo họp tháng M thường phản ánh số thực hiện tháng M-1.
  // Ưu tiên kỳ dữ liệu được ghi trực tiếp trong PDF để tránh nhập lệch tháng.
  const detectedPeriod=detectPdfDataPeriod(documents);
  const period=detectedPeriod||requestedPeriod;

  const rulesResult=await pdfBackendGet('pdfRules').catch(()=>({ok:false,rules:[]}));
  const rules=Array.isArray((rulesResult as {rules?:unknown[]})?.rules)?(rulesResult as {rules:unknown[]}).rules:[];
  const parsed=parsePdfDocuments(period,documents,rules as Array<{sourcePattern:string;kpiId:string}>);
  const enriched=applyHistoricalDhsxExtractors(parsed,documents);
  if(detectedPeriod && detectedPeriod!==requestedPeriod){
    enriched.notes.unshift(`Đã tự đổi kỳ từ ${requestedPeriod} sang ${detectedPeriod} theo dòng “Thực hiện …” trong PDF.`);
  }
  return NextResponse.json(enriched,{headers:{'Cache-Control':'no-store'}});
}
