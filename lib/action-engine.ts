import type { DashboardBootstrap, PlanItem } from '@/types/dashboard';
import type { ActionItem, ActionPriority, ActionStatus, EarlyWarning } from '@/types/intelligence';

export type CustomPlanLike = { id:string; title:string; owner:string; sourceKpi:string; createdAt:string };

function toIsoDate(period: string, offsetDays = 21) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 1);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function priorityOf(plan: PlanItem): ActionPriority {
  if (plan.priority === 'Cao') return 'high';
  if (plan.priority === 'Trung bình') return 'medium';
  return 'normal';
}

function progressFromStatus(status: string) {
  const text = status.toLowerCase();
  if (text.includes('hoàn') || text.includes('xong')) return 100;
  if (text.includes('đang')) return 55;
  return 15;
}

function statusFromProgress(progress: number, dueDate?: string): ActionStatus {
  if (progress >= 100) return 'done';
  if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) return 'overdue';
  if (progress > 20) return 'doing';
  return 'new';
}

export function seedActions(data: DashboardBootstrap, customPlans: CustomPlanLike[], warnings: EarlyWarning[]): ActionItem[] {
  const now = new Date().toISOString();
  const reportActions: ActionItem[] = data.plans.map((plan, index) => {
    const progress = progressFromStatus(plan.status);
    const dueDate = plan.deadline && /^\d{4}-\d{2}-\d{2}$/.test(plan.deadline) ? plan.deadline : toIsoDate(data.period, 15 + index * 3);
    return {
      id: `REPORT_${plan.id}`,
      title: plan.title,
      owner: plan.owner,
      source: 'report',
      status: statusFromProgress(progress, dueDate),
      priority: priorityOf(plan),
      dueDate,
      progress,
      objective: plan.objective ?? `Bảo đảm tiến độ ${plan.title.toLowerCase()} và hạn chế phát sinh chỉ tiêu không đạt.`,
      steps: plan.actions?.length ? plan.actions : [plan.title, 'Cập nhật tiến độ và vướng mắc theo tuần.', 'Đánh giá kết quả cuối kỳ và điều chỉnh khi cần.'],
      expectedResult: plan.expectedResult ?? 'Hoàn thành đúng tiến độ, có số liệu xác nhận và giảm tồn đọng.',
      measure: plan.measure,
      note: plan.note,
      createdAt: now,
      updatedAt: now,
    };
  });

  const customActions: ActionItem[] = customPlans.map((plan, index) => ({
    id: `CUSTOM_${plan.id}`,
    title: plan.title,
    owner: plan.owner,
    source: 'user',
    sourceKpiLabel: plan.sourceKpi,
    status: 'new',
    priority: 'medium',
    dueDate: toIsoDate(data.period, 10 + index),
    progress: 10,
    objective: `Xử lý đề xuất liên quan KPI ${plan.sourceKpi}.`,
    steps: [plan.title, 'Xác định đầu mối phụ trách.', 'Cập nhật kết quả sau khi thực hiện.'],
    expectedResult: 'Có kết quả xử lý rõ ràng và cập nhật lại KPI liên quan.',
    createdAt: plan.createdAt,
    updatedAt: now,
  }));

  const warningActions: ActionItem[] = warnings.slice(0, 5).map((warning, index) => ({
    id: `WARNING_${warning.kpiId}`,
    title: `Xử lý nguy cơ ${warning.label}`,
    owner: data.fields.find((field) => field.id === warning.domainId)?.title ?? 'Đơn vị phụ trách',
    source: 'warning',
    sourceKpiId: warning.kpiId,
    sourceKpiLabel: warning.label,
    status: 'new',
    priority: warning.risk === 'high' ? 'high' : warning.risk === 'medium' ? 'medium' : 'normal',
    dueDate: toIsoDate(data.period, 7 + index * 2),
    progress: 5,
    objective: `Chủ động xử lý nguy cơ trước khi ${warning.label} chuyển sang trạng thái không đạt.`,
    steps: ['Rà soát chênh lệch thực hiện/kế hoạch và xu hướng gần nhất.', 'Xác định nguyên nhân chính có thể tác động KPI.', 'Chốt hành động tuần và theo dõi lại forecast sau cập nhật.'],
    expectedResult: `Giảm mức rủi ro dự báo của ${warning.label} và đưa tiến độ về quỹ đạo kế hoạch.`,
    measure: warning.forecastText,
    createdAt: now,
    updatedAt: now,
  }));

  const seen = new Set<string>();
  return [...warningActions, ...customActions, ...reportActions].filter((item) => {
    const key = `${item.title}|${item.owner}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeActionState(seed: ActionItem[], stored: ActionItem[]) {
  const byId = new Map(stored.map((item) => [item.id, item]));
  return seed.map((item) => {
    const saved = byId.get(item.id);
    const merged = { ...item, ...(saved ?? {}), title: item.title, owner: saved?.owner ?? item.owner };
    if (merged.status !== 'done' && merged.dueDate && new Date(`${merged.dueDate}T23:59:59`).getTime() < Date.now()) merged.status = 'overdue';
    return merged;
  });
}

export function actionStatusLabel(status: ActionStatus) {
  if (status === 'doing') return 'Đang làm';
  if (status === 'overdue') return 'Quá hạn';
  if (status === 'done') return 'Hoàn thành';
  return 'Mới';
}

export function actionPriorityLabel(priority: ActionPriority) {
  return priority === 'high' ? 'Cao' : priority === 'medium' ? 'Trung bình' : 'Bình thường';
}
