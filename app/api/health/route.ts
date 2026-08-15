import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'dieu-hanh-sxkd-hybrid-v1',
    appsScriptConfigured: Boolean(process.env.APPS_SCRIPT_API_URL),
    now: new Date().toISOString(),
  });
}
