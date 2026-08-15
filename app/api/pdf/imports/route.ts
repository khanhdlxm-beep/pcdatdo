import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendGet } from '@/lib/pdf-backend';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  try{return NextResponse.json(await pdfBackendGet('pdfImports',{limit:request.nextUrl.searchParams.get('limit')||'10'}),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:String(error)},{status:502});}
}
