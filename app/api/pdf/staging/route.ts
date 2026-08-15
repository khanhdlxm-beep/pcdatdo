import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendGet, pdfBackendPost } from '@/lib/pdf-backend';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  const importId=request.nextUrl.searchParams.get('importId')||'';
  if(!importId) return NextResponse.json({ok:false,error:'Thiếu importId.'},{status:400});
  try{return NextResponse.json(await pdfBackendGet('pdfStaging',{importId}),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:String(error)},{status:502});}
}

export async function POST(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  const body=await request.json().catch(()=>({}));
  if(!body?.importId||!Array.isArray(body?.records)) return NextResponse.json({ok:false,error:'Thiếu importId/records.'},{status:400});
  try{return NextResponse.json(await pdfBackendPost('savePdfStaging',body),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:String(error)},{status:502});}
}
