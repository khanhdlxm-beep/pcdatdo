import { NextRequest, NextResponse } from 'next/server';
import { loadDashboard } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || undefined;
  const data = await loadDashboard(period);
  return NextResponse.json(data, { headers:{'Cache-Control':'no-store, max-age=0'} });
}
