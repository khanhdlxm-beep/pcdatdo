import { NextRequest, NextResponse } from 'next/server';
import { loadDashboard } from '@/lib/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') || undefined;
  try {
    const data = await loadDashboard(period);
    return NextResponse.json(data, {
      headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=120'},
    });
  } catch (error) {
    console.error('dashboard-load-failed', error);
    return NextResponse.json({ ok:false, error:String(error instanceof Error ? error.message : error) }, {
      status:503,
      headers:{'Cache-Control':'no-store'},
    });
  }
}
