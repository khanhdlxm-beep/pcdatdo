import { NextRequest, NextResponse } from 'next/server';
import { createPdfAdminToken, pdfAdminConfigured, validatePdfAdminPin } from '@/lib/pdf-admin-auth';

export const dynamic='force-dynamic';

export async function GET(){
  return NextResponse.json({ok:true,configured:pdfAdminConfigured()},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:NextRequest){
  if(!pdfAdminConfigured()) return NextResponse.json({ok:false,configured:false,error:'Chưa cấu hình PDF_ADMIN_PIN/PDF_ADMIN_SECRET trên Vercel.'},{status:503});
  const body=await request.json().catch(()=>({}));
  if(!validatePdfAdminPin(String(body?.pin||''))) return NextResponse.json({ok:false,error:'PIN quản trị không đúng.'},{status:401});
  return NextResponse.json({ok:true,token:createPdfAdminToken(),expiresIn:14400},{headers:{'Cache-Control':'no-store'}});
}
