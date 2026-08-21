import type { DashboardBootstrap } from '@/types/dashboard';
import type { ActionItem, EarlyWarning, ExecutiveBrief, HealthModel } from '@/types/intelligence';

function toneScore(tone: string) {
  return tone === 'good' ? 3 : tone === 'warn' ? 2 : tone === 'bad' ? 1 : 0;
}

export function buildExecutiveBrief(data: DashboardBootstrap, health: HealthModel, warnings: EarlyWarning[], actions: ActionItem[]): ExecutiveBrief {
  const allKpis = data.fields.flatMap((field) => field.items.map((item) => ({ ...item, domain: field.title })));
  const positives = [...allKpis]
    .filter((item) => item.tone === 'good')
    .sort((a, b) => toneScore(b.tone) - toneScore(a.tone))
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.value}${item.detail ? ` · ${item.detail}` : ''}`);

  const priorities = [...data.alerts]
    .filter((alert) => alert.severity === 'red' || alert.severity === 'yellow')
    .sort((a, b) => Number(b.severity === 'red') - Number(a.severity === 'red'))
    .slice(0, 3)
    .map((alert) => `${alert.title}: ${alert.current}${alert.target ? ` · ${alert.target}` : ''}`);

  const earlyWarnings = warnings.slice(0, 3).map((warning) => `${warning.label}: ${warning.forecastText}`);
  const actionRows = [...actions]
    .filter((action) => action.status !== 'done')
    .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || a.progress - b.progress)
    .slice(0, 4)
    .map((action) => `${action.title} · ${action.owner}${action.dueDate ? ` · hạn ${action.dueDate}` : ''}`);

  const weakest = [...health.domains].sort((a, b) => a.score - b.score)[0];
  const strongest = [...health.domains].sort((a, b) => b.score - a.score)[0];
  const summary = `Sức khỏe SXKD ${health.overall.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100. ${weakest ? `${weakest.title} là lĩnh vực cần ưu tiên nhất (${weakest.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100).` : ''}`;

  return {
    title: `Bản tin điều hành ${data.period.slice(5)}/${data.period.slice(0, 4)}`,
    summary,
    positives: positives.length ? positives : ['Chưa đủ dữ liệu để xác định điểm tích cực nổi bật.'],
    priorities: priorities.length ? priorities : ['Chưa có cảnh báo ưu tiên trong kỳ đang chọn.'],
    earlyWarnings: earlyWarnings.length ? earlyWarnings : ['Chưa phát hiện cảnh báo sớm dựa trên forecast hiện tại.'],
    actions: actionRows.length ? actionRows : ['Chưa có hành động mở cần theo dõi.'],
    evidence: [
      `Tổng KPI: ${data.summary.total}; đạt: ${data.summary.pass}; một phần: ${data.summary.partial}; không đạt: ${data.summary.fail}.`,
      strongest ? `Lĩnh vực có Health Score cao nhất: ${strongest.title} ${strongest.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100.` : '',
      weakest ? `Lĩnh vực có Health Score thấp nhất: ${weakest.title} ${weakest.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100.` : '',
    ].filter(Boolean),
  };
}
