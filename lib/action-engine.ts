import type { DashboardBootstrap, PlanItem } from '@/types/dashboard';
import type { ActionItem, ActionPriority, ActionStatus, EarlyWarning } from '@/types/intelligence';

export type CustomPlanLike = { id:string; title:string; owner:string; sourceKpi:string; createdAt:string };

function priorityOf(plan: PlanItem): ActionPriority {
  if (plan.priority === 'Cao') return 'high';
  if (plan.priority === 'Trung bình') return 'medium';
  return 'normal';
}

function explicitProgress(status: string) {
  const text = String(status || '').trim().toLowerCase();
  if (!text) return { progress:0, status:'new' as ActionStatus, confirmed:false };
  if (text.includes('hoàn') || text.includes('xong')) return { progress:100, status:'done' as ActionStatus, confirmed:true };
  if (text.includes('đang')) return { progress:50, status:'doing' as ActionStatus, confirmed:true };
  return { progress:0, status:'new' as ActionStatus, confirmed:true };
}

function validDeadline(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function statusWithDeadline(status: ActionStatus, dueDate?: string): ActionStatus {
  if (status === 'done') return status;
  if (dueDate && new Date(`${dueDate}T23:59:59`).getTime() < Date.now()) return 'overdue';
  return status;
}

export function seedActions(data: DashboardBootstrap, customPlans: CustomPlanLike[], warnings: EarlyWarning[]): ActionItem[] {
  const now = new Date().toISOString();

  const reportActions: ActionItem[] = data.plans.map((plan) => {
    const state = explicitProgress(plan.status);
    const dueDate = validDeadline(plan.deadline) ? plan.deadline : undefined;
    const hasDetailedActions = Boolean(plan.actions?.length);
    return {
      id: `REPORT_${plan.id}`,
      title: plan.title,
      owner: plan.owner,
      source: 'report',
      origin: 'official',
      status: statusWithDeadline(state.status, dueDate),
      priority: priorityOf(plan),
      dueDate,
      dueDateConfirmed: Boolean(dueDate),
      progress: state.progress,
      progressConfirmed: state.confirmed,
      objective: plan.objective ?? 'Chưa có mục tiêu chuẩn hóa trong báo cáo nguồn.',
      steps: hasDetailedActions ? plan.actions! : [plan.title],
      expectedResult: plan.expectedResult ?? 'Chưa có kết quả mong đợi chuẩn hóa trong báo cáo nguồn.',
      measure: plan.measure,
      note: plan.note ?? (!hasDetailedActions ? 'Không tự sinh thêm bước thực hiện ngoài nội dung báo cáo.' : undefined),
      createdAt: now,
      updatedAt: now,
    };
  });

  const customActions: ActionItem[] = customPlans.map((plan) => ({
    id: `CUSTOM_${plan.id}`,
    title: plan.title,
    owner: plan.owner,
    source: 'user',
    origin: 'user',
    sourceKpiLabel: plan.sourceKpi,
    status: 'new',
    priority: 'medium',
    progress: 0,
    progressConfirmed: false,
    dueDateConfirmed: false,
    objective: `Đề xuất do người dùng tạo cho KPI ${plan.sourceKpi}.`,
    steps: [plan.title],
    expectedResult: 'Chưa xác nhận kết quả mong đợi.',
    createdAt: plan.createdAt,
    updatedAt: now,
  }));

  const warningActions: ActionItem[] = warnings.slice(0, 5).map((warning) => ({
    id: `WARNING_${warning.kpiId}`,
    title: `Xử lý nguy cơ ${warning.label}`,
    owner: data.fields.find((field) => field.id === warning.domainId)?.title ?? 'Đơn vị phụ trách',
    source: 'warning',
    origin: 'suggested',
    sourceKpiId: warning.kpiId,
    sourceKpiLabel: warning.label,
    status: 'new',
    priority: warning.risk === 'high' ? 'high' : warning.risk === 'medium' ? 'medium' : 'normal',
    progress: 0,
    progressConfirmed: false,
    dueDateConfirmed: false,
    objective: `Gợi ý hệ thống nhằm theo dõi nguy cơ của ${warning.label}; chưa phải giao việc chính thức.`,
    steps: ['Rà soát số liệu và nguyên nhân trước khi chốt hành động chính thức.'],
    expectedResult: 'Chờ người dùng xác nhận mục tiêu, đầu việc, thời hạn và kết quả mong đợi.',
    measure: warning.forecastText,
    note: `Gợi ý hệ thống · Forecast tin cậy ${warning.confidence === 'high' ? 'cao' : warning.confidence === 'medium' ? 'trung bình' : 'thấp'}.`,
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
    if (!saved) return item;

    // Không mang các deadline/progress tự sinh từ phiên bản cũ sang V1.8.5.
    // Chỉ giữ lại khi đã được đánh dấu là người dùng/nguồn chính thức xác nhận.
    const progressConfirmed = saved.progressConfirmed === true || item.progressConfirmed === true;
    const dueDateConfirmed = saved.dueDateConfirmed === true || item.dueDateConfirmed === true;
    const progress = saved.progressConfirmed === true ? saved.progress : item.progress;
    const dueDate = saved.dueDateConfirmed === true ? saved.dueDate : item.dueDate;
    const status = saved.progressConfirmed === true ? saved.status : item.status;

    return {
      ...item,
      status: statusWithDeadline(status, dueDate),
      progress,
      progressConfirmed,
      dueDate,
      dueDateConfirmed,
      owner: saved.owner ?? item.owner,
      updatedAt: saved.updatedAt ?? item.updatedAt,
    };
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

export function actionOriginLabel(action: ActionItem) {
  const origin = action.origin ?? (action.source === 'report' ? 'official' : action.source === 'user' ? 'user' : 'suggested');
  return origin === 'official' ? 'Theo báo cáo' : origin === 'user' ? 'Người dùng tạo' : 'Gợi ý hệ thống';
}
