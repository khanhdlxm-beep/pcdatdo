import type { DashboardBootstrap } from '@/types/dashboard';

const MONTHS: Record<string, string> = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
};

function normalizePeriod(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;

  const direct = raw.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (direct) return `${direct[1]}-${direct[2]}`;

  const appsScriptDate = raw.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+(\d{4})\b/);
  if (appsScriptDate) return `${appsScriptDate[2]}-${MONTHS[appsScriptDate[1]]}`;

  const ym = raw.match(/\b(\d{4})[-\/.](0?[1-9]|1[0-2])\b/);
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
  return undefined;
}

function normalizeDashboardPeriods(data: DashboardBootstrap): DashboardBootstrap {
  const rawPeriods = Array.isArray(data.availablePeriods) ? data.availablePeriods : [];
  const normalizedPeriods = Array.from(new Set(
    [...rawPeriods, data.period]
      .map(normalizePeriod)
      .filter((value): value is string => Boolean(value)),
  )).sort();

  const normalizedHistory = data.history
    ? Object.fromEntries(Object.entries(data.history).map(([id, history]) => [id, {
        ...history,
        annualPlans: Object.fromEntries(
          Object.entries(history.annualPlans ?? {}).filter(([year]) => /^\d{4}$/.test(year)),
        ),
        points: (history.points ?? []).map((point) => ({
          ...point,
          period: normalizePeriod(point.period) ?? point.period,
        })),
      }]))
    : data.history;

  return {
    ...data,
    period: normalizePeriod(data.period) ?? data.period,
    availablePeriods: normalizedPeriods.length ? normalizedPeriods : data.availablePeriods,
    history: normalizedHistory,
    dataMode: 'apps-script',
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBootstrap(baseUrl: string, key: string, period: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const endpoint = new URL(baseUrl);
    endpoint.searchParams.set('action', 'bootstrap');
    endpoint.searchParams.set('period', period);
    endpoint.searchParams.set('apiKey', key);

    try {
      const response = await fetch(endpoint.toString(), {
        cache: 'no-store',
        redirect: 'follow',
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
      const data = (await response.json()) as DashboardBootstrap;
      if (!data?.ok) throw new Error('Apps Script returned ok=false');
      return normalizeDashboardPeriods(data);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function loadDashboard(period?: string): Promise<DashboardBootstrap> {
  const url = process.env.APPS_SCRIPT_API_URL;
  const key = process.env.APPS_SCRIPT_API_KEY;
  if (!url) throw new Error('Production chưa cấu hình APPS_SCRIPT_API_URL.');
  if (!key) throw new Error('Production chưa cấu hình APPS_SCRIPT_API_KEY.');

  const requested = period ? (normalizePeriod(period) ?? period) : 'latest';
  const first = await fetchBootstrap(url, key, requested);
  if (period) return first;

  const candidates = Array.from(new Set(
    [...(first.availablePeriods ?? []), first.period]
      .map(normalizePeriod)
      .filter((value): value is string => Boolean(value)),
  )).sort();
  const latest = candidates[candidates.length - 1];

  return latest && first.period !== latest
    ? fetchBootstrap(url, key, latest)
    : first;
}
