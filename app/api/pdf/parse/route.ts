import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendGet } from '@/lib/pdf-backend';
import { parsePdfDocuments } from '@/lib/pdf-parser';
import { applyRealBusinessPdfOverrides } from '@/lib/pdf-real-business';
import type { PdfExtractedDocument } from '@/types/pdf-import';

export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ hoặc đã hết hạn.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const period=String(body?.period||''); const documents=body?.documents as PdfExtractedDocument[];
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ok:false,error:'Kỳ báo cáo không hợp lệ.'},{status:400});
  if(!Array.isArray(documents)||!documents.length) return NextResponse.json({ok:false,error:'Chưa có dữ liệu PDF.'},{status:400});
  const rulesResult=await pdfBackendGet('pdfRules').catch(()=>({ok:false,rules:[]}));
  const rules=Array.isArray((rulesResult as any)?.rules)?(rulesResult as any).rules:[];
  const parsed=parsePdfDocuments(period,documents,rules);
  const enriched=applyRealBusinessPdfOverrides(parsed,documents);
  return NextResponse.json(enriched,{headers:{'Cache-Control':'no-store'}});
}
