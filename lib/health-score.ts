import type { DashboardBootstrap, MetricHistory, MetricHistoryPoint } from '@/types/dashboard';
import type { DomainHealth, HealthBand, HealthModel, KpiHealth } from '@/types/intelligence';

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
  return 1;
}

function actualDirectionRatio(history: MetricHistory, current?: MetricHistoryPoint, base?: MetricHistoryPoint) {
  const actual = num(current?.actual);
  const previous = num(base?.actual);
  if (actual === undefined || previous === undefined || previous === 0) return undefined;
  if (history.direction === 'lower') return actual === 0 ? 1.12 : previous / actual;
  if (history.direction === 'higher') return actual / previous;
  return 1;
}

function componentScore(ratio: number | undefined, neutral = 0.75) {
  if (ratio === undefined || !Number.isFinite(ratio)) return neutral;
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
  if (values.length < 3) return 0.72;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0.8;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / Math.abs(mean);
  return clamp(1 - cv / 0.25, 0.25, 1);
}

function annualProjection(history: MetricHistory, period: string) {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5));
  const points = history.points
    .filter((point) => point.period.startsWith(`${year}-`) && Number(point.period.slice(5)) <= month)
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!points.length) return undefined;
  const current = points[points.length - 1];
  const annualPlan = num(history.annualPlans?.[year]);
  if (annualPlan === undefined || annualPlan === 0) return undefined;
  const currentYtd = num(current.ytd);
  if (currentYtd !== undefined && month > 0) {
    const projected = currentYtd / month * 12;
    return history.direction === 'lower' ? annualPlan / Math.max(projected, 0.000001) : projected / annualPlan;
  }
  const actuals = points.map((point) => num(point.actual)).filter((value): value is number => value !== undefined);
  if (!actuals.length) return undefined;
  if (history.aggregate === 'sum') {
    const projected = actuals.reduce((sum, value) => sum + value, 0) / actuals.length * 12;
    return history.direction === 'lower' ? annualPlan / Math.max(projected, 0.000001) : projected / annualPlan;
  }
  const latest = actuals[actuals.length - 1];
  return history.direction === 'lower' ? annualPlan / Math.max(latest, 0.000001) : latest / annualPlan;
}

function kpiHealth(data: DashboardBootstrap, domainId: string, kpiId: string, label: string, period = data.period): KpiHealth {
  const history = data.history?.[kpiId];
  if (!history) {
    const item = data.fields.find((field) => field.id === domainId)?.items.find((kpi) => kpi.id === kpiId);
    const score = item?.tone === 'good' ? 84 : item?.tone === 'warn' ? 68 : item?.tone === 'bad' ? 48 : 72;
    return { kpiId, domainId, label, score, band: bandFor(score), planScore: score * 0.4, trendScore: score * 0.2, samePeriodScore: score * 0.15, forecastScore: score * 0.15, stabilityScore: score * 0.1, trend: 'unknown' };
  }
  const current = pointFor(history, period);
  const previous = pointFor(history, previousMonth(period));
  const same = pointFor(history, previousYear(period));
  const plan = componentScore(performanceRatio(history, current));
  const trendRatio = actualDirectionRatio(history, current, previous);
  const trend = trendRatio === undefined ? 'unknown' : trendRatio > 1.015 ? 'improve' : trendRatio < 0.985 ? 'worsen' : 'stable';
  const trendScoreRaw = componentScore(trendRatio, 0.76);
  const sameScoreRaw = componentScore(actualDirectionRatio(history, current, same), 0.76);
  const forecastRaw = componentScore(annualProjection(history, period), plan);
  const stabilityRaw = stabilityScore(history, period);
  const score = Math.round((plan * 40 + trendScoreRaw * 20 + sameScoreRaw * 15 + forecastRaw * 15 + stabilityRaw * 10) * 10) / 10;
  return {
    kpiId,
    domainId,
    label,
    score,
    band: bandFor(score),
    planScore: Math.round(plan * 40 * 10) / 10,
    trendScore: Math.round(trendScoreRaw * 20 * 10) / 10,
    samePeriodScore: Math.round(sameScoreRaw * 15 * 10) / 10,
    forecastScore: Math.round(forecastRaw * 15 * 10) / 10,
    stabilityScore: Math.round(stabilityRaw * 10 * 10) / 10,
    trend,
  };
}

export function buildHealthModel(data: DashboardBootstrap): HealthModel {
  const kpis = data.fields.flatMap((field) => field.items.map((item) => kpiHealth(data, field.id, item.id, item.label, data.period)));
  const domains: DomainHealth[] = data.fields.map((field) => {
    const rows = kpis.filter((kpi) => kpi.domainId === field.id);
    const score = rows.length ? rows.reduce((sum, row) => sum + row.score, 0) / rows.length : 0;
    return { domainId: field.id, title: field.title, score: Math.round(score * 10) / 10, band: bandFor(score), kpis: rows };
  });
  const overall = domains.length ? domains.reduce((sum, domain) => sum + domain.score, 0) / domains.length : 0;
  const priorPeriod = previousMonth(data.period);
  let deltaVsPrevious: number | null = null;
  if (data.availablePeriods?.includes(priorPeriod)) {
    const priorScores = data.fields.flatMap((field) => field.items.map((item) => kpiHealth(data, field.id, item.id, item.label, priorPeriod).score));
    if (priorScores.length) {
      const prior = priorScores.reduce((sum, value) => sum + value, 0) / priorScores.length;
      deltaVsPrevious = Math.round((overall - prior) * 10) / 10;
    }
  }
  const rounded = Math.round(overall * 10) / 10;
  return { overall: rounded, band: bandFor(rounded), deltaVsPrevious, domains, kpis };
}

export function healthBandLabel(band: HealthBand) {
  if (band === 'excellent') return 'Rất tốt';
  if (band === 'good') return 'Tốt';
  if (band === 'watch') return 'Theo dõi';
  return 'Nguy cơ';
}
