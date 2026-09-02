import type { MetricHistory, MetricHistoryPoint } from '@/types/dashboard';
import type { HealthConfidence } from '@/types/intelligence';

export type UnifiedForecast = {
  future: number[];
  nextMonth: number;
  yearEnd: number;
  annualPlan?: number;
  projectedRatio?: number;
  confidence: HealthConfidence;
  coverage: number;
  pointsUsed: number;
  expectedPoints: number;
  seriesBreak?: string;
  comparableToAnnualPlan: boolean;
  basis: string;
};

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function monthOf(period: string) {
  return Number(period.slice(5, 7));
}

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

export function currentYearHistory(history: MetricHistory, period: string) {
  const year = period.slice(0, 4);
  const month = monthOf(period);
  const byPeriod = new Map<string, MetricHistoryPoint>();
  for (const point of history.points ?? []) {
    if (!point.period.startsWith(`${year}-`) || monthOf(point.period) > month) continue;
    if (num(point.actual) === undefined) continue;
    byPeriod.set(point.period, point);
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Dữ liệu báo cáo có thể đổi phạm vi/lũy kế giữa năm. Với KPI cộng dồn,
 * một cú giảm YTD lớn được xem là điểm gãy chuỗi để Forecast không nối hai
 * mặt bằng dữ liệu khác nhau thành một xu hướng giả.
 */
export function detectSeriesBreak(history: MetricHistory, points: MetricHistoryPoint[]) {
  if (history.aggregate !== 'sum' || points.length < 2) return undefined;
  let breakIndex: number | undefined;
  for (let i = 1; i < points.length; i++) {
    const previousYtd = num(points[i - 1].ytd);
    const currentYtd = num(points[i].ytd);
    if (previousYtd === undefined || currentYtd === undefined || previousYtd <= 0) continue;
    const ratio = currentYtd / previousYtd;
    if (ratio < 0.72) breakIndex = i;
  }
  return breakIndex;
}

function linearModel(points: MetricHistoryPoint[]) {
  const rows = points
    .map((point) => ({ x: monthOf(point.period), y: num(point.actual) }))
    .filter((row): row is { x: number; y: number } => row.y !== undefined);
  if (!rows.length) return undefined;
  if (rows.length === 1) return { slope: 0, intercept: rows[0].y };
  const xMean = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const yMean = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  const denominator = rows.reduce((sum, row) => sum + Math.pow(row.x - xMean, 2), 0);
  if (!denominator) return { slope: 0, intercept: yMean };
  const slope = rows.reduce((sum, row) => sum + (row.x - xMean) * (row.y - yMean), 0) / denominator;
  return { slope, intercept: yMean - slope * xMean };
}

function predict(model: { slope: number; intercept: number }, month: number) {
  return clampNonNegative(model.intercept + model.slope * month);
}

function confidenceFor(pointsUsed: number, coverage: number, seriesBreak?: string): HealthConfidence {
  let confidence: HealthConfidence = pointsUsed >= 9 && coverage >= 90 ? 'high' : pointsUsed >= 6 && coverage >= 70 ? 'medium' : 'low';
  if (seriesBreak && confidence === 'high') confidence = 'medium';
  return confidence;
}

export function buildUnifiedForecast(history: MetricHistory, period: string): UnifiedForecast | null {
  const all = currentYearHistory(history, period);
  if (!all.length) return null;

  const breakIndex = detectSeriesBreak(history, all);
  const seriesBreak = breakIndex === undefined ? undefined : all[breakIndex]?.period;
  const usable = breakIndex === undefined ? all : all.slice(breakIndex);
  // Không phát hành Forecast chỉ từ vài điểm. Sáu kỳ là ngưỡng tối thiểu
  // để tránh biến động ngắn hạn bị trình bày như một xu hướng điều hành.
  if (usable.length < 6) return null;

  const currentMonth = monthOf(period);
  const startMonth = seriesBreak ? monthOf(seriesBreak) : 1;
  const expectedPoints = Math.max(1, currentMonth - startMonth + 1);
  const coverage = Math.min(100, usable.length / expectedPoints * 100);
  const recent = usable.slice(-6);
  const model = linearModel(recent);
  if (!model) return null;

  const future = Array.from({ length:Math.max(0, 12 - currentMonth) }, (_, offset) => predict(model, currentMonth + offset + 1));
  const nextMonth = future[0] ?? predict(model, currentMonth);
  const annualPlan = num(history.annualPlans?.[period.slice(0, 4)]);

  let yearEnd: number;
  if (history.aggregate === 'sum') {
    const latestYtd = num(usable[usable.length - 1]?.ytd);
    const observed = usable.map((point) => num(point.actual)).filter((value): value is number => value !== undefined);
    yearEnd = (latestYtd ?? observed.reduce((sum, value) => sum + value, 0)) + future.reduce((sum, value) => sum + value, 0);
  } else {
    yearEnd = future.length ? future[future.length - 1] : predict(model, currentMonth);
  }

  // Nếu YTD đã bị reset giữa năm, không so Forecast sau điểm gãy với KH năm cũ.
  const comparableToAnnualPlan = !seriesBreak;
  const projectedRatio = annualPlan !== undefined && annualPlan !== 0 && history.direction !== 'info' && comparableToAnnualPlan
    ? history.direction === 'lower'
      ? annualPlan / Math.max(yearEnd, 0.000001) * 100
      : yearEnd / annualPlan * 100
    : undefined;

  const confidence = confidenceFor(usable.length, coverage, seriesBreak);
  const basis = seriesBreak
    ? `Chuỗi được tính lại từ ${seriesBreak} do phát hiện lũy kế đổi mặt bằng.`
    : `Dùng ${usable.length} kỳ hợp lệ; độ phủ ${coverage.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%.`;

  return {
    future,
    nextMonth,
    yearEnd,
    annualPlan,
    projectedRatio,
    confidence,
    coverage,
    pointsUsed: usable.length,
    expectedPoints,
    seriesBreak,
    comparableToAnnualPlan,
    basis,
  };
}

export function forecastConfidenceLabel(value: HealthConfidence) {
  return value === 'high' ? 'Cao' : value === 'medium' ? 'Trung bình' : 'Thấp';
}
