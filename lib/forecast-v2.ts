import type { DashboardBootstrap, MetricHistory } from '@/types/dashboard';
import type { EarlyWarning, HealthConfidence, RiskLevel } from '@/types/intelligence';
import { buildUnifiedForecast, forecastConfidenceLabel } from '@/lib/forecast-core';

export function projectYear(history: MetricHistory, period: string) {
  const forecast = buildUnifiedForecast(history, period);
  if (!forecast || forecast.projectedRatio === undefined || forecast.annualPlan === undefined) return null;
  return {
    projectedValue: forecast.yearEnd,
    annualPlan: forecast.annualPlan,
    projectedRatio: forecast.projectedRatio,
    confidence: forecast.confidence,
    coverage: forecast.coverage,
    pointsUsed: forecast.pointsUsed,
    seriesBreak: forecast.seriesBreak,
    basis: forecast.basis,
  };
}

function riskFromRatio(ratio: number, currentTone: string, confidence: HealthConfidence): RiskLevel {
  if (currentTone === 'bad') return 'high';
  if (confidence === 'low') return ratio < 99 || currentTone === 'warn' ? 'medium' : 'low';
  if (ratio < 92) return 'high';
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
      const risk = riskFromRatio(projection.projectedRatio, item.tone, projection.confidence);
      const hiddenRisk = item.tone === 'good' && risk !== 'low';
      const visibleRisk = item.tone !== 'good' || risk !== 'low';
      if (!visibleRisk) continue;
      const relation = history.direction === 'lower' ? 'ngưỡng' : 'kế hoạch';
      const confidenceText = forecastConfidenceLabel(projection.confidence);
      rows.push({
        id: `EW_${item.id}`,
        kpiId: item.id,
        domainId: field.id,
        label: item.label,
        risk,
        reason: hiddenRisk
          ? `KPI hiện đang đạt nhưng xu hướng cuối năm cần theo dõi. Forecast có độ tin cậy ${confidenceText.toLowerCase()}, độ phủ ${projection.coverage.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%.`
          : risk === 'high'
            ? `Xu hướng hiện tại cho thấy rủi ro cao so với ${relation} cuối năm. Độ tin cậy Forecast: ${confidenceText}.`
            : `Cần theo dõi tốc độ thực hiện; độ tin cậy Forecast ${confidenceText.toLowerCase()}, độ phủ ${projection.coverage.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%.`,
        forecastText: `Dự báo khoảng ${projection.projectedRatio.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% ${relation} năm · tin cậy ${confidenceText.toLowerCase()}.`,
        projectedRatio: projection.projectedRatio,
        projectedValue: projection.projectedValue,
        annualPlan: projection.annualPlan,
        coverage: projection.coverage,
        confidence: projection.confidence,
        pointsUsed: projection.pointsUsed,
        seriesBreak: projection.seriesBreak,
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
