import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendGet } from '@/lib/pdf-backend';

export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  const period=request.nextUrl.searchParams.get('period')||'';
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ok:false,error:'Kỳ dữ liệu không hợp lệ.'},{status:400});
  try{return NextResponse.json(await pdfBackendGet('pdfPeriodData',{period}),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:String(error)},{status:502});}
}
