export type HealthBand = 'excellent' | 'good' | 'watch' | 'risk';
export type HealthConfidence = 'low' | 'medium' | 'high';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ActionStatus = 'new' | 'doing' | 'overdue' | 'done';
export type ActionPriority = 'high' | 'medium' | 'normal';
export type ActionOrigin = 'official' | 'suggested' | 'user';

export type KpiHealth = {
  kpiId: string;
  domainId: string;
  label: string;
  score: number;
  band: HealthBand;
  planScore: number;
  trendScore: number;
  samePeriodScore: number;
  forecastScore: number;
  stabilityScore: number;
  trend: 'improve' | 'stable' | 'worsen' | 'unknown';
  /** Tỷ lệ thành phần đánh giá có dữ liệu thực, 0-100. */
  coverage: number;
  confidence: HealthConfidence;
  /** KPI direction=info được hiển thị nhưng không kéo Health Score lên/xuống. */
  eligible: boolean;
  componentsUsed: number;
};

export type DomainHealth = {
  domainId: string;
  title: string;
  score: number;
  band: HealthBand;
  coverage: number;
  confidence: HealthConfidence;
  kpis: KpiHealth[];
};

export type HealthModel = {
  overall: number;
  band: HealthBand;
  deltaVsPrevious: number | null;
  coverage: number;
  confidence: HealthConfidence;
  domains: DomainHealth[];
  kpis: KpiHealth[];
};

export type EarlyWarning = {
  id: string;
  kpiId: string;
  domainId: string;
  label: string;
  risk: RiskLevel;
  reason: string;
  forecastText: string;
  projectedRatio?: number;
  projectedValue?: number;
  annualPlan?: number;
  coverage?: number;
  confidence?: HealthConfidence;
  pointsUsed?: number;
  seriesBreak?: string;
};

export type ExecutiveBrief = {
  title: string;
  summary: string;
  positives: string[];
  priorities: string[];
  earlyWarnings: string[];
  actions: string[];
  evidence: string[];
};

export type ActionItem = {
  id: string;
  title: string;
  owner: string;
  source: 'report' | 'warning' | 'ai' | 'user';
  origin?: ActionOrigin;
  sourceKpiId?: string;
  sourceKpiLabel?: string;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate?: string;
  /** true khi deadline lấy từ báo cáo/người dùng, không phải hệ thống tự suy đoán. */
  dueDateConfirmed?: boolean;
  progress: number;
  /** false = chỉ là giá trị khởi tạo, chưa được người dùng xác nhận. */
  progressConfirmed?: boolean;
  objective: string;
  steps: string[];
  expectedResult: string;
  measure?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type AiKpiSnapshot = {
  kpiId: string;
  domainId: string;
  domainTitle: string;
  label: string;
  value: string;
  status: string;
  tone: string;
  detail?: string;
  planText?: string;

  healthScore?: number;
  healthBand?: HealthBand;
  healthTrend?: KpiHealth['trend'];
  healthCoverage?: number;
  healthConfidence?: HealthConfidence;
  planScore?: number;
  trendScore?: number;
  samePeriodScore?: number;
  forecastScore?: number;
  stabilityScore?: number;

  unit?: string;
  direction?: 'higher' | 'lower' | 'info';
  actual?: number;
  planMonth?: number;
  monthPlanRatio?: number;
  ytd?: number;
  planYtd?: number;
  ytdPlanRatio?: number;
  annualPlan?: number;
  annualProgressRatio?: number;
  previousActual?: number;
  previousChange?: number;
  samePeriodActual?: number;
  samePeriodChange?: number;

  warningRisk?: RiskLevel;
  warningReason?: string;
  forecastText?: string;
  projectedRatio?: number;
  projectedValue?: number;
  forecastConfidence?: HealthConfidence;
  forecastCoverage?: number;

  openActionCount: number;
};

export type AiRuntimeIndex = {
  period: string;
  totalKpis: number;
  overallHealth: number;
  healthBand: HealthBand;
  healthDelta: number | null;
  healthCoverage?: number;
  healthConfidence?: HealthConfidence;
  kpis: AiKpiSnapshot[];
  domains: DomainHealth[];
  warnings: EarlyWarning[];
  actions: ActionItem[];
  brief: ExecutiveBrief;
};

export type AiAnswer = {
  title: string;
  summary: string;
  bullets: string[];
  evidence: string[];
  suggestedActions: string[];
};
