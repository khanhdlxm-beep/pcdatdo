import type { DashboardBootstrap, MetricHistory, MetricHistoryPoint } from '@/types/dashboard';
import type { DomainHealth, HealthBand, HealthConfidence, HealthModel, KpiHealth } from '@/types/intelligence';
import { buildUnifiedForecast } from '@/lib/forecast-core';

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function bandFor(score: number): HealthBand {
  if (score >= 90) return 'excellent';
  if (score >= 78) return 'good';
  if (score >= 62) return 'watch';
  return 'risk';
}

function confidenceFor(coverage: number, components: number): HealthConfidence {
  if (coverage >= 80 && components >= 4) return 'high';
  if (coverage >= 45 && components >= 2) return 'medium';
  return 'low';
}

function pointFor(history: MetricHistory | undefined, period: string) {
  return history?.points?.find((point) => point.period === period);
}

function previousMonth(period: string) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousYear(period: string) {
  const [year, month] = period.split('-');
  return `${Number(year) - 1}-${month}`;
}

function performanceRatio(history: MetricHistory, point?: MetricHistoryPoint) {
  const actual = num(point?.actual);
  const plan = num(point?.planMonth);
  if (actual === undefined || plan === undefined || plan === 0) return undefined;
  if (history.direction === 'lower') return actual === 0 ? 1.12 : plan / actual;
  if (history.direction === 'higher') return actual / plan;
  return undefined;
}

function actualDirectionRatio(history: MetricHistory, current?: MetricHistoryPoint, base?: MetricHistoryPoint) {
  const actual = num(current?.actual);
  const previous = num(base?.actual);
  if (actual === undefined || previous === undefined || previous === 0) return undefined;
  if (history.direction === 'lower') return actual === 0 ? 1.12 : previous / actual;
  if (history.direction === 'higher') return actual / previous;
  return undefined;
}

function componentScore(ratio: number | undefined) {
  if (ratio === undefined || !Number.isFinite(ratio)) return undefined;
  return clamp((ratio - 0.55) / 0.55, 0, 1);
}

function stabilityScore(history: MetricHistory, period: string) {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5));
  const values = history.points
    .filter((point) => point.period.startsWith(`${year}-`) && Number(point.period.slice(5)) <= month)
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-4)
    .map((point) => num(point.actual))
    .filter((value): value is number => value !== undefined);
  if (values.length < 3) return undefined;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0.8;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return clamp(1 - cv / 0.25, 0.25, 1);
}

type Component = { key:'plan'|'trend'|'same'|'forecast'|'stability'; weight:number; value:number|undefined };

function weightedHealth(components: Component[]) {
  const available = components.filter((row): row is Component & { value:number } => row.value !== undefined && Number.isFinite(row.value));
  const usedWeight = available.reduce((sum, row) => sum + row.weight, 0);
  const score = usedWeight
    ? available.reduce((sum, row) => sum + row.value * row.weight, 0) / usedWeight * 100
    : 75;
  return {
    score: Math.round(score * 10) / 10,
    coverage: usedWeight,
    componentsUsed: available.length,
    component: Object.fromEntries(components.map((row) => [row.key, row.value === undefined ? 0 : Math.round(row.value * row.weight * 10) / 10])) as Record<Component['key'], number>,
  };
}

function kpiHealth(data: DashboardBootstrap, domainId: string, kpiId: string, label: string, period = data.period): KpiHealth {
  const history = data.history?.[kpiId];
  const item = data.fields.find((field) => field.id === domainId)?.items.find((kpi) => kpi.id === kpiId);
  if (!history || history.direction === 'info') {
    const score = item?.tone === 'good' ? 82 : item?.tone === 'warn' ? 72 : item?.tone === 'bad' ? 65 : 75;
    return {
      kpiId, domainId, label, score, band: bandFor(score),
      planScore:0, trendScore:0, samePeriodScore:0, forecastScore:0, stabilityScore:0,
      trend:'unknown', coverage:0, confidence:'low', eligible:false, componentsUsed:0,
    };
  }

  const current = pointFor(history, period);
  const previous = pointFor(history, previousMonth(period));
  const same = pointFor(history, previousYear(period));
  const planRaw = componentScore(performanceRatio(history, current));
  const trendRatio = actualDirectionRatio(history, current, previous);
  const trendRaw = componentScore(trendRatio);
  const sameRaw = componentScore(actualDirectionRatio(history, current, same));
  const forecast = buildUnifiedForecast(history, period);
  const forecastRaw = forecast?.projectedRatio !== undefined ? componentScore(forecast.projectedRatio / 100) : undefined;
  const stabilityRaw = stabilityScore(history, period);
  const trend = trendRatio === undefined ? 'unknown' : trendRatio > 1.015 ? 'improve' : trendRatio < 0.985 ? 'worsen' : 'stable';

  const weighted = weightedHealth([
    { key:'plan', weight:40, value:planRaw },
    { key:'trend', weight:20, value:trendRaw },
    { key:'same', weight:15, value:sameRaw },
    { key:'forecast', weight:15, value:forecastRaw },
    { key:'stability', weight:10, value:stabilityRaw },
  ]);
  const confidence = confidenceFor(weighted.coverage, weighted.componentsUsed);

  return {
    kpiId,
    domainId,
    label,
    score: weighted.score,
    band: bandFor(weighted.score),
    planScore: weighted.component.plan,
    trendScore: weighted.component.trend,
    samePeriodScore: weighted.component.same,
    forecastScore: weighted.component.forecast,
    stabilityScore: weighted.component.stability,
    trend,
    coverage: weighted.coverage,
    confidence,
    eligible: weighted.componentsUsed > 0,
    componentsUsed: weighted.componentsUsed,
  };
}

function aggregateConfidence(rows: { coverage:number }[]) {
  const coverage = rows.length ? rows.reduce((sum, row) => sum + row.coverage, 0) / rows.length : 0;
  return { coverage:Math.round(coverage * 10) / 10, confidence:confidenceFor(coverage, coverage >= 80 ? 4 : coverage >= 45 ? 2 : 1) };
}

export function buildHealthModel(data: DashboardBootstrap): HealthModel {
  const kpis = data.fields.flatMap((field) => field.items.map((item) => kpiHealth(data, field.id, item.id, item.label, data.period)));
  const domains: DomainHealth[] = data.fields.map((field) => {
    const allRows = kpis.filter((kpi) => kpi.domainId === field.id);
    const rows = allRows.filter((kpi) => kpi.eligible);
    const score = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 75;
    const quality = aggregateConfidence(rows);
    return { domainId: field.id, title: field.title, score: Math.round(score * 10) / 10, band: bandFor(score), coverage:quality.coverage, confidence:quality.confidence, kpis: allRows };
  });
  const scoredDomains = domains.filter((domain) => domain.kpis.some((kpi) => kpi.eligible));
  const overall = scoredDomains.length ? scoredDomains.reduce((sum, domain) => sum + domain.score, 0) / scoredDomains.length : 75;
  const quality = aggregateConfidence(kpis.filter((kpi) => kpi.eligible));

  const priorPeriod = previousMonth(data.period);
  let deltaVsPrevious: number | null = null;
  if (data.availablePeriods?.includes(priorPeriod)) {
    const prior = data.fields.flatMap((field) => field.items.map((item) => kpiHealth(data, field.id, item.id, item.label, priorPeriod))).filter((row) => row.eligible);
    const current = kpis.filter((row) => row.eligible);
    if (prior.length && current.length) {
      const priorScore = prior.reduce((sum, value) => sum + value.score, 0) / prior.length;
      const currentScore = current.reduce((sum, value) => sum + value.score, 0) / current.length;
      deltaVsPrevious = Math.round((currentScore - priorScore) * 10) / 10;
    }
  }

  const rounded = Math.round(overall * 10) / 10;
  return {
    overall: rounded,
    band: bandFor(rounded),
    deltaVsPrevious,
    coverage: quality.coverage,
    confidence: quality.confidence,
    domains,
    kpis,
  };
}

export function healthBandLabel(band: HealthBand) {
  if (band === 'excellent') return 'Rất tốt';
  if (band === 'good') return 'Tốt';
  if (band === 'watch') return 'Theo dõi';
  return 'Nguy cơ';
}

export function healthConfidenceLabel(value: HealthConfidence) {
  return value === 'high' ? 'Cao' : value === 'medium' ? 'Trung bình' : 'Thấp';
}
