import type { DashboardBootstrap } from '@/types/dashboard';
import type {
  ActionItem,
  AiAnswer,
  AiKpiSnapshot,
  AiRuntimeIndex,
  EarlyWarning,
  ExecutiveBrief,
  HealthModel,
  RiskLevel,
} from '@/types/intelligence';

function normalized(text: string) {
  return text
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !value.trim()) return undefined;

  // Chỉ parse chuỗi số thuần. Không cố đoán "2.361,42 tỷ" để tránh sai số.
  const raw = value.trim().replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(raw)) return undefined;

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let canonical = raw;

  if (lastComma > lastDot) {
    canonical = raw.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma >= 0) {
    canonical = raw.replace(/,/g, '');
  }

  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function percent(value?: number, signed = false) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function score(value?: number) {
  return value === undefined
    ? '—'
    : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/100`;
}

function metric(value?: number, unit?: string) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const text = value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
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

function changeRatio(current?: number, base?: number) {
  if (current === undefined || base === undefined || base === 0) return undefined;
  return (current / base - 1) * 100;
}

function ratio(current?: number, plan?: number) {
  if (current === undefined || plan === undefined || plan === 0) return undefined;
  return current / plan * 100;
}

function riskRank(risk?: RiskLevel) {
  if (risk === 'high') return 3;
  if (risk === 'medium') return 2;
  if (risk === 'low') return 1;
  return 0;
}

function healthBandLabel(band?: AiKpiSnapshot['healthBand']) {
  if (band === 'excellent') return 'Xuất sắc';
  if (band === 'good') return 'Tốt';
  if (band === 'watch') return 'Cần theo dõi';
  if (band === 'risk') return 'Rủi ro';
  return 'Chưa xếp hạng';
}

function healthTrendLabel(trend?: AiKpiSnapshot['healthTrend']) {
  if (trend === 'improve') return 'cải thiện';
  if (trend === 'worsen') return 'xấu đi';
  if (trend === 'stable') return 'ổn định';
  return 'chưa đủ dữ liệu';
}

function statusText(item: { status?: string; tone?: string }) {
  if (item.status) return item.status;
  if (item.tone === 'good') return 'Đạt';
  if (item.tone === 'bad') return 'Không đạt';
  if (item.tone === 'warn') return 'Theo dõi';
  return 'Thông tin';
}

export function buildAiRuntimeIndex(
  data: DashboardBootstrap,
  health: HealthModel,
  warnings: EarlyWarning[],
  actions: ActionItem[],
  brief: ExecutiveBrief,
): AiRuntimeIndex {
  const warningMap = new Map(warnings.map((row) => [row.kpiId, row]));
  const healthMap = new Map(health.kpis.map((row) => [row.kpiId, row]));
  const actionCount = new Map<string, number>();

  for (const action of actions) {
    if (action.status === 'done' || !action.sourceKpiId) continue;
    actionCount.set(action.sourceKpiId, (actionCount.get(action.sourceKpiId) ?? 0) + 1);
  }

  const prevPeriod = previousMonth(data.period);
  const samePeriod = previousYear(data.period);
  const year = data.period.slice(0, 4);

  const kpis: AiKpiSnapshot[] = [];

  for (const field of data.fields) {
    for (const item of field.items) {
      const healthRow = healthMap.get(item.id);
      const warning = warningMap.get(item.id);
      const history = data.history?.[item.id];
      const points = Array.isArray(history?.points) ? history.points : [];
      const current = points.find((point) => point.period === data.period);
      const prev = points.find((point) => point.period === prevPeriod);
      const same = points.find((point) => point.period === samePeriod);

      const actual = numberValue(current?.actual);
      const planMonth = numberValue(current?.planMonth);
      const ytd = numberValue(current?.ytd);
      const planYtd = numberValue(current?.planYtd);
      const previousActual = numberValue(prev?.actual);
      const samePeriodActual = numberValue(same?.actual);
      const annualPlan = numberValue(history?.annualPlans?.[year]) ?? warning?.annualPlan;

      kpis.push({
        kpiId: item.id,
        domainId: field.id,
        domainTitle: field.title,
        label: item.label,
        value: item.value,
        status: statusText(item),
        tone: String(item.tone ?? ''),
        detail: item.detail,
        planText: item.plan,

        healthScore: healthRow?.score,
        healthBand: healthRow?.band,
        healthTrend: healthRow?.trend,
        planScore: healthRow?.planScore,
        trendScore: healthRow?.trendScore,
        samePeriodScore: healthRow?.samePeriodScore,
        forecastScore: healthRow?.forecastScore,
        stabilityScore: healthRow?.stabilityScore,

        unit: history?.unit,
        direction: history?.direction,
        actual,
        planMonth,
        monthPlanRatio: ratio(actual, planMonth),
        ytd,
        planYtd,
        ytdPlanRatio: ratio(ytd, planYtd),
        annualPlan,
        annualProgressRatio: ratio(ytd, annualPlan),
        previousActual,
        previousChange: changeRatio(actual, previousActual),
        samePeriodActual,
        samePeriodChange: changeRatio(actual, samePeriodActual),

        warningRisk: warning?.risk,
        warningReason: warning?.reason,
        forecastText: warning?.forecastText,
        projectedRatio: warning?.projectedRatio,
        projectedValue: warning?.projectedValue,

        openActionCount: actionCount.get(item.id) ?? 0,
      });
    }
  }

  return {
    period: data.period,
    totalKpis: data.summary.total,
    overallHealth: health.overall,
    healthBand: health.band,
    healthDelta: health.deltaVsPrevious,
    kpis,
    domains: health.domains,
    warnings,
    actions,
    brief,
  };
}

function kpiSearchScore(query: string, row: AiKpiSnapshot) {
  const label = normalized(row.label);
  const id = normalized(row.kpiId);
  const domain = normalized(row.domainTitle);

  if (!query) return 0;
  if (query.includes(label) && label.length >= 3) return 100 + label.length;
  if (query.includes(id) && id.length >= 2) return 95 + id.length;

  const queryTokens = query.split(' ').filter((token) => token.length >= 3);
  const labelTokens = label.split(' ').filter((token) => token.length >= 3);
  const matches = queryTokens.filter((token) => labelTokens.includes(token)).length;

  let scoreValue = matches * 12;
  if (queryTokens.some((token) => domain.includes(token))) scoreValue += 3;
  return scoreValue;
}

function findSpecificKpi(query: string, index: AiRuntimeIndex) {
  let best: AiKpiSnapshot | undefined;
  let bestScore = 0;

  for (const row of index.kpis) {
    const currentScore = kpiSearchScore(query, row);
    if (currentScore > bestScore) {
      best = row;
      bestScore = currentScore;
    }
  }

  // Tránh bắt nhầm các câu rất chung như "KPI nào yếu nhất".
  return bestScore >= 12 ? best : undefined;
}

function kpiEvidence(row: AiKpiSnapshot, period: string) {
  const result = [
    `Kỳ dữ liệu: ${period}.`,
    `Lĩnh vực: ${row.domainTitle}.`,
    `Trạng thái nguồn: ${row.status}.`,
  ];
  if (row.detail) result.push(row.detail);
  if (row.planText) result.push(`Kế hoạch/ghi chú: ${row.planText}`);
  return result;
}

function detailedKpiAnswer(row: AiKpiSnapshot, index: AiRuntimeIndex): AiAnswer {
  const bullets: string[] = [
    `Giá trị hiện tại: ${row.value} · Trạng thái: ${row.status}.`,
    `Health Score: ${score(row.healthScore)} · ${healthBandLabel(row.healthBand)} · Xu hướng sức khỏe: ${healthTrendLabel(row.healthTrend)}.`,
  ];

  if (row.actual !== undefined || row.planMonth !== undefined) {
    bullets.push(
      `Kỳ hiện tại: TH ${metric(row.actual, row.unit)} · KH tháng ${metric(row.planMonth, row.unit)} · TH/KH ${percent(row.monthPlanRatio)}.`,
    );
  }

  if (row.ytd !== undefined || row.planYtd !== undefined || row.annualPlan !== undefined) {
    bullets.push(
      `Lũy kế: ${metric(row.ytd, row.unit)} · KH lũy kế ${metric(row.planYtd, row.unit)} · TH/KH lũy kế ${percent(row.ytdPlanRatio)} · Tiến độ KH năm ${percent(row.annualProgressRatio)}.`,
    );
  }

  if (row.previousChange !== undefined || row.samePeriodChange !== undefined) {
    bullets.push(
      `Biến động: ${percent(row.previousChange, true)} so tháng trước · ${percent(row.samePeriodChange, true)} so cùng kỳ.`,
    );
  }

  if (row.forecastText || row.projectedRatio !== undefined || row.projectedValue !== undefined) {
    bullets.push(
      `Forecast: ${row.forecastText ?? 'Đã có dự báo'}${row.projectedValue !== undefined ? ` · Giá trị dự phóng ${metric(row.projectedValue, row.unit)}` : ''}${row.projectedRatio !== undefined ? ` · Mức dự phóng ${percent(row.projectedRatio)}` : ''}.`,
    );
  }

  if (row.warningReason) {
    bullets.push(`Cảnh báo ${row.warningRisk ?? 'theo dõi'}: ${row.warningReason}`);
  }

  bullets.push(
    `Điểm thành phần: KH ${score(row.planScore)} · xu hướng ${score(row.trendScore)} · cùng kỳ ${score(row.samePeriodScore)} · forecast ${score(row.forecastScore)} · ổn định ${score(row.stabilityScore)}.`,
  );

  if (row.openActionCount > 0) {
    bullets.push(`Action Center: ${row.openActionCount} hành động đang mở liên quan KPI này.`);
  }

  const suggestedActions = row.warningRisk
    ? [
        `Rà nguyên nhân làm ${row.label} phát sinh mức rủi ro ${row.warningRisk}.`,
        row.openActionCount > 0
          ? `Cập nhật tiến độ ${row.openActionCount} action đang mở trước kỳ giao ban tiếp theo.`
          : `Tạo action theo dõi ${row.label} với người phụ trách và hạn xử lý.`,
      ]
    : [
        `Tiếp tục theo dõi ${row.label} theo TH/KH, tháng trước và cùng kỳ.`,
        row.healthTrend === 'worsen'
          ? `Ưu tiên kiểm tra nguyên nhân vì Health Trend của ${row.label} đang xấu đi.`
          : `Duy trì kiểm soát để bảo vệ xu hướng hiện tại của ${row.label}.`,
      ];

  return {
    title: `Phân tích KPI · ${row.label}`,
    summary: `${row.label} thuộc ${row.domainTitle}, Health Score ${score(row.healthScore)}, trạng thái ${row.status}.`,
    bullets,
    evidence: kpiEvidence(row, index.period),
    suggestedActions,
  };
}

function lowestKpis(index: AiRuntimeIndex, count = 5) {
  return [...index.kpis]
    .filter((row) => row.healthScore !== undefined)
    .sort((a, b) => (a.healthScore ?? 999) - (b.healthScore ?? 999))
    .slice(0, count);
}

function highestKpis(index: AiRuntimeIndex, count = 5) {
  return [...index.kpis]
    .filter((row) => row.healthScore !== undefined)
    .sort((a, b) => (b.healthScore ?? -1) - (a.healthScore ?? -1))
    .slice(0, count);
}

function atRiskKpis(index: AiRuntimeIndex, count = 6) {
  return [...index.kpis]
    .filter((row) => row.warningRisk || row.healthBand === 'risk' || row.healthBand === 'watch')
    .sort((a, b) => {
      const riskDiff = riskRank(b.warningRisk) - riskRank(a.warningRisk);
      if (riskDiff) return riskDiff;
      return (a.healthScore ?? 999) - (b.healthScore ?? 999);
    })
    .slice(0, count);
}

function overviewAnswer(index: AiRuntimeIndex): AiAnswer {
  const weak = lowestKpis(index, 3);
  const risks = atRiskKpis(index, 3);
  const open = index.actions.filter((action) => action.status !== 'done');
  const overdue = open.filter((action) => action.status === 'overdue');

  return {
    title: 'Tổng quan điều hành đa chiều',
    summary: `Health Score toàn đơn vị ${score(index.overallHealth)}. Có ${index.warnings.length} cảnh báo forecast và ${open.length} hành động đang mở.`,
    bullets: [
      `Quy mô: ${index.totalKpis} KPI · ${index.domains.length} lĩnh vực.`,
      `Health: ${score(index.overallHealth)}${index.healthDelta === null ? '' : ` · ${index.healthDelta >= 0 ? '+' : ''}${index.healthDelta.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm so kỳ trước`}.`,
      `KPI Health thấp: ${weak.map((row) => `${row.label} ${score(row.healthScore)}`).join(' · ') || 'chưa có dữ liệu'}.`,
      `Cảnh báo nổi bật: ${risks.map((row) => `${row.label} (${row.warningRisk ?? healthBandLabel(row.healthBand)})`).join(' · ') || 'chưa có cảnh báo đáng kể'}.`,
      `Action Center: ${open.length} đang mở · ${overdue.length} quá hạn.`,
      `Ưu tiên điều hành: ${index.brief.priorities[0] ?? 'Duy trì theo dõi các KPI trọng yếu.'}`,
    ],
    evidence: index.brief.evidence,
    suggestedActions: index.brief.actions.slice(0, 4),
  };
}

export function answerExecutiveQuestion(question: string, index: AiRuntimeIndex): AiAnswer {
  const q = normalized(question);
  if (!q) return overviewAnswer(index);

  // Nếu câu hỏi nêu một KPI cụ thể, ưu tiên trả phân tích nhiều chiều cho KPI đó.
  const exact = findSpecificKpi(q, index);
  if (exact) return detailedKpiAnswer(exact, index);

  const asksWorst = includesAny(q, ['yeu nhat', 'kem nhat', 'thap nhat', 'te nhat', 'can cai thien']);
  const asksBest = includesAny(q, ['tot nhat', 'cao nhat', 'manh nhat', 'tich cuc nhat']);
  const asksRisk = includesAny(q, ['nguy co', 'rui ro', 'canh bao', 'du bao', 'forecast', 'cuoi nam', 'khong dat']);
  const asksPriority = includesAny(q, ['uu tien', 'can chu y', 'van de', 'xu ly truoc']);
  const asksAction = includesAny(q, ['hanh dong', 'ke hoach', 'tuan nay', 'lam gi', 'giai phap', 'action']);
  const asksHealth = includesAny(q, ['suc khoe', 'health', 'linh vuc', 'diem suc khoe']);
  const asksSummary = includesAny(q, ['bao cao', 'tom tat', 'giao ban', 'tong quan', 'tinh hinh']);
  const asksCount = includesAny(q, ['bao nhieu', 'so luong', 'dem', 'tong so']);
  const asksTrend = includesAny(q, ['xu huong', 'tang', 'giam', 'thang truoc', 'cung ky']);

  if (asksWorst || asksBest) {
    const rows = asksBest ? highestKpis(index, 6) : lowestKpis(index, 6);
    return {
      title: asksBest ? 'KPI có sức khỏe tốt nhất' : 'KPI cần cải thiện nhất',
      summary: rows.length
        ? `${rows[0].label} đang ${asksBest ? 'dẫn đầu' : 'có Health Score thấp nhất'} trong dữ liệu kỳ ${index.period}.`
        : 'Chưa đủ dữ liệu Health Score để xếp hạng.',
      bullets: rows.map((row, i) =>
        `${i + 1}. ${row.label} · ${row.domainTitle} · Health ${score(row.healthScore)} · ${healthBandLabel(row.healthBand)} · xu hướng ${healthTrendLabel(row.healthTrend)}.`,
      ),
      evidence: [`Kỳ dữ liệu ${index.period}.`, `Xếp hạng trên ${index.kpis.length} KPI đã lập index.`],
      suggestedActions: asksBest
        ? rows.slice(0, 3).map((row) => `Duy trì kiểm soát ${row.label} và theo dõi dấu hiệu suy giảm sớm.`)
        : rows.slice(0, 3).map((row) => `Rà nguyên nhân và owner phụ trách ${row.label}.`),
    };
  }

  if (asksRisk) {
    const rows = atRiskKpis(index, 6);
    return {
      title: 'Cảnh báo & Forecast',
      summary: rows.length
        ? `Có ${rows.length} KPI nổi bật cần theo dõi theo rủi ro/Health trong kỳ hiện tại.`
        : 'Chưa phát hiện KPI có rủi ro đáng kể từ dữ liệu hiện có.',
      bullets: rows.map((row) =>
        `${row.label} · ${row.domainTitle} · Health ${score(row.healthScore)} · rủi ro ${row.warningRisk ?? healthBandLabel(row.healthBand)}${row.projectedRatio !== undefined ? ` · dự phóng ${percent(row.projectedRatio)}` : ''}${row.forecastText ? ` · ${row.forecastText}` : ''}${row.warningReason ? ` · ${row.warningReason}` : ''}`,
      ),
      evidence: index.warnings.slice(0, 6).map((row) => `${row.label} · mức rủi ro ${row.risk}`),
      suggestedActions: rows.slice(0, 4).map((row) =>
        row.openActionCount > 0
          ? `Cập nhật action đang mở của ${row.label}.`
          : `Lập action và owner cho ${row.label}.`,
      ),
    };
  }

  if (asksPriority) {
    const rows = atRiskKpis(index, 5);
    return {
      title: 'Các vấn đề cần ưu tiên',
      summary: index.brief.priorities[0] ?? 'Chưa có vấn đề nổi bật.',
      bullets: [
        ...index.brief.priorities.slice(0, 4),
        ...rows.slice(0, 3).map((row) => `KPI ưu tiên: ${row.label} · Health ${score(row.healthScore)} · ${row.warningReason ?? healthBandLabel(row.healthBand)}.`),
      ].slice(0, 7),
      evidence: index.brief.evidence,
      suggestedActions: index.brief.actions.slice(0, 4),
    };
  }

  if (asksAction) {
    const open = index.actions
      .filter((action) => action.status !== 'done')
      .sort((a, b) => {
        const priority = { high: 3, medium: 2, normal: 1 };
        return priority[b.priority] - priority[a.priority] || a.progress - b.progress;
      })
      .slice(0, 7);

    return {
      title: 'Hành động điều hành',
      summary: `Có ${index.actions.filter((action) => action.status !== 'done').length} hành động đang mở; hiển thị các việc ưu tiên nhất.`,
      bullets: open.map((action) =>
        `${action.title} · owner ${action.owner} · ưu tiên ${action.priority} · trạng thái ${action.status} · tiến độ ${action.progress}%${action.dueDate ? ` · hạn ${action.dueDate}` : ''}.`,
      ),
      evidence: open.map((action) =>
        action.sourceKpiLabel ? `Nguồn KPI: ${action.sourceKpiLabel}.` : `Nguồn: ${action.source}.`,
      ),
      suggestedActions: open.slice(0, 4).map((action) =>
        `Cập nhật ${action.title} trước ${action.dueDate ?? 'mốc giao ban kế tiếp'}.`,
      ),
    };
  }

  if (asksHealth) {
    const sorted = [...index.domains].sort((a, b) => a.score - b.score);
    const weak = lowestKpis(index, 4);
    return {
      title: 'Sức khỏe điều hành',
      summary: `Health Score toàn đơn vị ${score(index.overallHealth)} · ${healthBandLabel(index.healthBand)}.`,
      bullets: [
        ...sorted.slice(0, 6).map((domain) =>
          `${domain.title}: ${score(domain.score)} · ${healthBandLabel(domain.band)}.`,
        ),
        ...weak.slice(0, 3).map((row) =>
          `KPI cần chú ý: ${row.label} · ${score(row.healthScore)} · xu hướng ${healthTrendLabel(row.healthTrend)}.`,
        ),
      ].slice(0, 8),
      evidence: [`Kỳ dữ liệu ${index.period}.`, `Tổng ${index.totalKpis} KPI.`],
      suggestedActions: sorted.slice(0, 2).map((domain) =>
        `Ưu tiên rà các KPI Health Score thấp trong ${domain.title}.`,
      ),
    };
  }

  if (asksCount) {
    const open = index.actions.filter((action) => action.status !== 'done');
    const bad = index.kpis.filter((row) => row.tone === 'bad' || row.healthBand === 'risk');
    const watch = index.kpis.filter((row) => row.tone === 'warn' || row.healthBand === 'watch');
    return {
      title: 'Thống kê nhanh',
      summary: `Kỳ ${index.period} có ${index.totalKpis} KPI trên ${index.domains.length} lĩnh vực.`,
      bullets: [
        `KPI rủi ro/không đạt: ${bad.length}.`,
        `KPI cần theo dõi: ${watch.length}.`,
        `Cảnh báo Forecast: ${index.warnings.length}.`,
        `Hành động đang mở: ${open.length}.`,
        `Hành động quá hạn: ${open.filter((action) => action.status === 'overdue').length}.`,
        `Health Score chung: ${score(index.overallHealth)}.`,
      ],
      evidence: [`Dữ liệu kỳ ${index.period}.`],
      suggestedActions: index.brief.actions.slice(0, 3),
    };
  }

  if (asksTrend) {
    const rows = [...index.kpis]
      .filter((row) => row.previousChange !== undefined || row.samePeriodChange !== undefined)
      .sort((a, b) => Math.abs(b.previousChange ?? 0) - Math.abs(a.previousChange ?? 0))
      .slice(0, 6);
    return {
      title: 'Xu hướng & biến động KPI',
      summary: rows.length
        ? 'Các KPI có biến động đáng chú ý được xếp theo mức thay đổi so tháng trước.'
        : 'Chưa đủ chuỗi dữ liệu để phân tích xu hướng.',
      bullets: rows.map((row) =>
        `${row.label} · tháng trước ${percent(row.previousChange, true)} · cùng kỳ ${percent(row.samePeriodChange, true)} · Health ${score(row.healthScore)}.`,
      ),
      evidence: [`So sánh theo kỳ ${index.period}, kỳ trước và cùng kỳ năm trước khi dữ liệu có sẵn.`],
      suggestedActions: rows.slice(0, 3).map((row) =>
        `Kiểm tra nguyên nhân biến động của ${row.label} và đối chiếu TH/KH.`,
      ),
    };
  }

  if (asksSummary) return overviewAnswer(index);

  // Không còn "rơi im" về một câu trả lời cố định: luôn trả một tổng quan đa chiều.
  return {
    ...overviewAnswer(index),
    title: `Phân tích nhanh · ${question.trim()}`,
    summary: `Chưa nhận diện một KPI/ý định đủ cụ thể, nên hệ thống trả tổng quan đa chiều của kỳ ${index.period}.`,
  };
}
