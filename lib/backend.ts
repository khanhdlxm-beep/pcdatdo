import { buildDemoDashboard } from '@/data/demo-series';
import { pdfSeed } from '@/data/pdf-seed';
import type { DashboardBootstrap } from '@/types/dashboard';

export async function loadDashboard(period?: string): Promise<DashboardBootstrap> {
  const useDemo = process.env.USE_DEMO_DATA !== 'false';
  if (useDemo) return buildDemoDashboard(period);

  const url = process.env.APPS_SCRIPT_API_URL;
  const key = process.env.APPS_SCRIPT_API_KEY;
  if (!url) return pdfSeed;

  const endpoint = new URL(url);
  endpoint.searchParams.set('action', 'bootstrap');
  // Khi người dùng không chọn kỳ cụ thể, yêu cầu Apps Script trả kỳ PDF đã duyệt mới nhất.
  // getImportedBootstrap_ sẽ tự chọn kỳ mới nhất nếu giá trị period không trùng kỳ lịch sử.
  endpoint.searchParams.set('period', period || 'latest');
  if (key) endpoint.searchParams.set('apiKey', key);

  try {
    const response = await fetch(endpoint.toString(), { cache:'no-store', redirect:'follow', signal:AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
    const data = (await response.json()) as DashboardBootstrap;
    if (!data?.ok) throw new Error('Apps Script returned ok=false');
    return { ...data, dataMode:'apps-script' };
  } catch (error) {
    console.error('Falling back to bundled PDF seed:', error);
    return pdfSeed;
  }
}
