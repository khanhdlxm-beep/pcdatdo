import { NextRequest, NextResponse } from 'next/server';
import { bearerToken, verifyPdfAdminToken } from '@/lib/pdf-admin-auth';
import { pdfBackendPost } from '@/lib/pdf-backend';

export const dynamic='force-dynamic';

export async function POST(request:NextRequest){
  if(!verifyPdfAdminToken(bearerToken(request))) return NextResponse.json({ok:false,error:'Phiên quản trị không hợp lệ.'},{status:401});
  const body=await request.json().catch(()=>({}));
  try{return NextResponse.json(await pdfBackendPost('approvePdfImport',body),{headers:{'Cache-Control':'no-store'}});}
  catch(error){return NextResponse.json({ok:false,error:String(error)},{status:502});}
}
