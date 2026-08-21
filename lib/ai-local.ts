import type { DashboardBootstrap } from '@/types/dashboard';
import type { ActionItem, AiAnswer, EarlyWarning, ExecutiveBrief, HealthModel } from '@/types/intelligence';

function normalized(text: string) {
  return text.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function answerExecutiveQuestion(question: string, data: DashboardBootstrap, health: HealthModel, warnings: EarlyWarning[], actions: ActionItem[], brief: ExecutiveBrief): AiAnswer {
  const q = normalized(question);
  if (q.includes('uu tien') || q.includes('can chu y') || q.includes('van de')) {
    return {
      title: 'Các vấn đề cần ưu tiên',
      summary: brief.priorities[0] ?? 'Chưa có vấn đề nổi bật.',
      bullets: brief.priorities,
      evidence: brief.evidence,
      suggestedActions: brief.actions.slice(0, 3),
    };
  }
  if (q.includes('nguy co') || q.includes('du bao') || q.includes('cuoi nam')) {
    const rows = warnings.slice(0, 5);
    return {
      title: 'Cảnh báo sớm theo Forecast',
      summary: rows.length ? `Có ${rows.length} KPI cần theo dõi sớm trong kỳ hiện tại.` : 'Chưa phát hiện KPI có rủi ro đáng kể từ forecast.',
      bullets: rows.map((row) => `${row.label}: ${row.forecastText} ${row.reason}`),
      evidence: rows.map((row) => `${row.label} · mức rủi ro ${row.risk}`),
      suggestedActions: rows.slice(0, 3).map((row) => `Rà soát nguyên nhân và lập action cho ${row.label}.`),
    };
  }
  if (q.includes('suc khoe') || q.includes('linh vuc') || q.includes('yeu')) {
    const sorted = [...health.domains].sort((a, b) => a.score - b.score);
    return {
      title: 'Sức khỏe điều hành',
      summary: `Health Score toàn đơn vị là ${health.overall.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100.`,
      bullets: sorted.map((domain) => `${domain.title}: ${domain.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100`).slice(0, 6),
      evidence: [`Kỳ dữ liệu ${data.period}.`, `Tổng ${data.summary.total} KPI.`],
      suggestedActions: sorted.slice(0, 2).map((domain) => `Ưu tiên rà các KPI Health Score thấp trong ${domain.title}.`),
    };
  }
  if (q.includes('hanh dong') || q.includes('ke hoach') || q.includes('tuan')) {
    const open = actions.filter((action) => action.status !== 'done').slice(0, 6);
    return {
      title: 'Hành động điều hành',
      summary: `Có ${open.length} hành động đang mở được ưu tiên hiển thị.`,
      bullets: open.map((action) => `${action.title} · ${action.owner} · ${action.progress}%`),
      evidence: open.map((action) => action.sourceKpiLabel ? `Nguồn KPI: ${action.sourceKpiLabel}` : `Nguồn: ${action.source}`),
      suggestedActions: open.slice(0, 3).map((action) => `Cập nhật tiến độ ${action.title} trước mốc ${action.dueDate ?? 'kế tiếp'}.`),
    };
  }
  if (q.includes('bao cao') || q.includes('tom tat') || q.includes('giao ban')) {
    return {
      title: brief.title,
      summary: brief.summary,
      bullets: [...brief.positives.map((text) => `Tích cực: ${text}`), ...brief.priorities.map((text) => `Cần chú ý: ${text}`)].slice(0, 6),
      evidence: brief.evidence,
      suggestedActions: brief.actions.slice(0, 4),
    };
  }

  const exact = data.fields.flatMap((field) => field.items.map((item) => ({ field, item }))).find(({ item }) => q.includes(normalized(item.label)) || q.includes(normalized(item.id)));
  if (exact) {
    const warning = warnings.find((row) => row.kpiId === exact.item.id);
    const healthRow = health.kpis.find((row) => row.kpiId === exact.item.id);
    return {
      title: exact.item.label,
      summary: `${exact.item.value}. Trạng thái hiện tại: ${exact.item.status ?? exact.item.tone}.`,
      bullets: [healthRow ? `Health Score: ${healthRow.score.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100.` : '', warning?.forecastText ?? '', warning?.reason ?? ''].filter(Boolean),
      evidence: [`Lĩnh vực: ${exact.field.title}.`, exact.item.detail ?? exact.item.plan ?? 'Dữ liệu lấy từ kỳ đang chọn.'],
      suggestedActions: warning ? [`Tạo action theo dõi ${exact.item.label}.`] : [`Tiếp tục theo dõi ${exact.item.label} theo kỳ và kế hoạch.`],
    };
  }

  return {
    title: 'AI Điều hành nội bộ',
    summary: brief.summary,
    bullets: ['Bạn có thể hỏi: “KPI nào cần ưu tiên?”, “KPI nào có nguy cơ cuối năm?”, “Lĩnh vực nào yếu nhất?”, “Đề xuất hành động tuần này?”'],
    evidence: brief.evidence,
    suggestedActions: brief.actions.slice(0, 3),
  };
}
