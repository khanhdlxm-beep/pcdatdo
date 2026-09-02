import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendPost } from '@/lib/pdf-backend';
import { PDF_PARSER_VERSION } from '@/lib/pdf-dhsx-history';

export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  const body=await request.json().catch(()=>({}));
  const records=Array.isArray(body?.records)?body.records:[];
  const recordPeriod=records.find((r:unknown)=>r && typeof r==='object' && 'period' in r && /^\d{4}-\d{2}$/.test(String((r as {period?:unknown}).period||''))) as {period?:string}|undefined;
  const period=recordPeriod?.period||String(body?.period||'');
  try{
    return NextResponse.json(await pdfBackendPost('stagePdfImport',{...body,period,parserVersion:PDF_PARSER_VERSION}),{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({ok:false,error:String(error)},{status:502});
  }
}
