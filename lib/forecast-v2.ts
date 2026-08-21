import type { DashboardBootstrap, MetricHistory } from '@/types/dashboard';
import type { EarlyWarning, RiskLevel } from '@/types/intelligence';

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function currentYearPoints(history: MetricHistory, period: string) {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5));
  return history.points
    .filter((point) => point.period.startsWith(`${year}-`) && Number(point.period.slice(5)) <= month)
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function projectYear(history: MetricHistory, period: string) {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5));
  const annualPlan = num(history.annualPlans?.[year]);
  const points = currentYearPoints(history, period);
  if (!points.length || annualPlan === undefined || annualPlan === 0) return null;
  const latest = points[points.length - 1];
  const ytd = num(latest.ytd);
  let projectedValue: number | undefined;
  if (history.aggregate === 'sum') {
    if (ytd !== undefined && month > 0) projectedValue = ytd / month * 12;
    else {
      const values = points.map((point) => num(point.actual)).filter((value): value is number => value !== undefined);
      if (values.length) projectedValue = values.reduce((sum, value) => sum + value, 0) / values.length * 12;
    }
  } else {
    const recent = points.slice(-3).map((point) => num(point.actual)).filter((value): value is number => value !== undefined);
    if (recent.length) projectedValue = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  }
  if (projectedValue === undefined) return null;
  const projectedRatio = history.direction === 'lower' ? annualPlan / Math.max(projectedValue, 0.000001) * 100 : projectedValue / annualPlan * 100;
  return { projectedValue, annualPlan, projectedRatio };
}

function riskFromRatio(ratio: number, currentTone: string): RiskLevel {
  if (currentTone === 'bad' || ratio < 92) return 'high';
  if (currentTone === 'warn' || ratio < 99) return 'medium';
  return 'low';
}

export function buildEarlyWarnings(data: DashboardBootstrap): EarlyWarning[] {
  const rows: EarlyWarning[] = [];
  for (const field of data.fields) {
    for (const item of field.items) {
      const history = data.history?.[item.id];
      if (!history || history.direction === 'info') continue;
      const projection = projectYear(history, data.period);
      if (!projection) continue;
      const risk = riskFromRatio(projection.projectedRatio, item.tone);
      const hiddenRisk = item.tone === 'good' && risk !== 'low';
      const visibleRisk = item.tone !== 'good' || risk !== 'low';
      if (!visibleRisk) continue;
      const relation = history.direction === 'lower' ? 'ngưỡng' : 'kế hoạch';
      const gap = Math.abs(projection.projectedRatio - 100);
      rows.push({
        id: `EW_${item.id}`,
        kpiId: item.id,
        domainId: field.id,
        label: item.label,
        risk,
        reason: hiddenRisk
          ? `KPI hiện đang đạt nhưng dự báo cuối năm có nguy cơ thấp hơn ${relation}.`
          : risk === 'high'
            ? `Xu hướng hiện tại cho thấy rủi ro cao so với ${relation} cuối năm.`
            : `Cần theo dõi sát tốc độ thực hiện để bảo đảm ${relation} cuối năm.`,
        forecastText: `Dự báo đạt khoảng ${projection.projectedRatio.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% ${relation} năm.`,
        projectedRatio: projection.projectedRatio,
        projectedValue: projection.projectedValue,
        annualPlan: projection.annualPlan,
      });
    }
  }
  return rows.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 } as const;
    return rank[b.risk] - rank[a.risk] || (a.projectedRatio ?? 100) - (b.projectedRatio ?? 100);
  });
}

export function riskLabel(risk: RiskLevel) {
  return risk === 'high' ? 'Nguy cơ cao' : risk === 'medium' ? 'Cần theo dõi' : 'Rủi ro thấp';
}
