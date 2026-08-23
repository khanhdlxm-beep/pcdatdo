export type HealthBand = 'excellent' | 'good' | 'watch' | 'risk';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ActionStatus = 'new' | 'doing' | 'overdue' | 'done';
export type ActionPriority = 'high' | 'medium' | 'normal';

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
};

export type DomainHealth = {
  domainId: string;
  title: string;
  score: number;
  band: HealthBand;
  kpis: KpiHealth[];
};

export type HealthModel = {
  overall: number;
  band: HealthBand;
  deltaVsPrevious: number | null;
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
  sourceKpiId?: string;
  sourceKpiLabel?: string;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate?: string;
  progress: number;
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

  openActionCount: number;
};

export type AiRuntimeIndex = {
  period: string;
  totalKpis: number;
  overallHealth: number;
  healthBand: HealthBand;
  healthDelta: number | null;
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
