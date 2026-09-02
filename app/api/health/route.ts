import { NextResponse } from 'next/server';
import { APP_VERSION, DATA_SCHEMA_VERSION } from '@/lib/app-version';
import { PDF_PARSER_VERSION } from '@/lib/pdf-dhsx-history';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'dieu-hanh-sxkd',
    version: APP_VERSION,
    parserVersion: PDF_PARSER_VERSION,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    appsScriptConfigured: Boolean(process.env.APPS_SCRIPT_API_URL && process.env.APPS_SCRIPT_API_KEY),
    pdfAdminConfigured: Boolean(process.env.PDF_ADMIN_PIN && process.env.PDF_ADMIN_SECRET),
    pdfAdminDedicatedSecret: Boolean(process.env.PDF_ADMIN_SECRET),
    weatherConfigured: Boolean(process.env.WEATHER_USER_AGENT),
    aiMode: process.env.AI_MODE || 'local',
    now: new Date().toISOString(),
  });
}
