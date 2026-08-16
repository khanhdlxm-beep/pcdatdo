import { pdfSeed } from '@/data/pdf-seed';
import type { AlertItem, DashboardBootstrap, FieldGroup, KpiCard, MetricHistory, MetricHistoryPoint, Tone } from '@/types/dashboard';

type Direction = 'higher' | 'lower' | 'info';
type Aggregate = 'sum' | 'avg' | 'snapshot';

type MetricConfig = {
  id: string;
  unit: string;
  direction: Direction;
  aggregate: Aggregate;
  plan2025: number;
  plan2026: number;
  performance2025: number;
  performance2026: number;
  volatility: number;
  seed: number;
  decimals?: number;
  weights?: number[];
  manual?: Record<string, number>;
};

const sumWeights = [0.073,0.069,0.075,0.078,0.082,0.086,0.091,0.091,0.086,0.085,0.083,0.101];
const investWeights = [0.035,0.045,0.055,0.06,0.07,0.09,0.08,0.09,0.105,0.12,0.12,0.13];
const incidentWeights = [0.075,0.065,0.07,0.075,0.08,0.12,0.145,0.13,0.09,0.06,0.045,0.045];
const trainingWeights = [0.06,0.07,0.08,0.08,0.09,0.12,0.10,0.10,0.08,0.07,0.07,0.08];

const configs: MetricConfig[] = [
  { id:'KD_DTP', unit:'Tr.kWh', direction:'higher', aggregate:'sum', plan2025:1508, plan2026:1613, performance2025:1.015, performance2026:1.02, volatility:.055, seed:1, decimals:3, weights:sumWeights,
    manual:{'2026-01':140.2,'2026-02':135.5,'2026-03':143.7,'2026-04':150.3,'2026-05':151.9,'2026-06':154.528,'2026-07':165.479}},
  { id:'KD_DT', unit:'tỷ', direction:'higher', aggregate:'sum', plan2025:3380, plan2026:3647.667, performance2025:1.01, performance2026:1.015, volatility:.05, seed:2, decimals:2, weights:sumWeights,
    manual:{'2026-01':305,'2026-02':318,'2026-03':326,'2026-04':340,'2026-05':345,'2026-06':350.88,'2026-07':376.54}},
  { id:'KD_GIA', unit:'đ/kWh', direction:'higher', aggregate:'avg', plan2025:2215, plan2026:2259, performance2025:1.006, performance2026:1.008, volatility:.012, seed:3, decimals:2,
    manual:{'2026-07':2272.52}},
  { id:'KD_TT', unit:'%', direction:'lower', aggregate:'avg', plan2025:3.25, plan2026:3.12, performance2025:.96, performance2026:.94, volatility:.075, seed:4, decimals:2,
    manual:{'2026-07':2.53}},
  { id:'CRM', unit:'%', direction:'higher', aggregate:'avg', plan2025:98, plan2026:98, performance2025:.996, performance2026:.999, volatility:.012, seed:5, decimals:2,
    manual:{'2026-07':97.46}},
  { id:'GANMOI', unit:'KH', direction:'higher', aggregate:'sum', plan2025:7200, plan2026:7800, performance2025:1.01, performance2026:1.02, volatility:.08, seed:6, decimals:0, weights:sumWeights,
    manual:{'2026-01':520,'2026-02':560,'2026-03':580,'2026-04':610,'2026-05':650,'2026-06':708,'2026-07':710}},
  { id:'HDMBD', unit:'HĐ', direction:'higher', aggregate:'sum', plan2025:7600, plan2026:8081, performance2025:.88, performance2026:.84, volatility:.1, seed:7, decimals:0, weights:sumWeights,
    manual:{'2026-01':180,'2026-02':220,'2026-03':240,'2026-04':280,'2026-05':310,'2026-06':362,'2026-07':500}},
  { id:'TC_DN', unit:'ngày', direction:'lower', aggregate:'avg', plan2025:3, plan2026:3, performance2025:.91, performance2026:.88, volatility:.07, seed:8, decimals:2,
    manual:{'2026-07':2.57}},
  { id:'DX_KB', unit:'%', direction:'higher', aggregate:'snapshot', plan2025:99.4, plan2026:99.5, performance2025:.995, performance2026:.998, volatility:.003, seed:9, decimals:2,
    manual:{'2026-07':99.5}},
  { id:'DX_KN', unit:'%', direction:'higher', aggregate:'snapshot', plan2025:98.5, plan2026:99, performance2025:.985, performance2026:.991, volatility:.006, seed:10, decimals:2,
    manual:{'2026-07':98.2}},
  { id:'DX_HD', unit:'%', direction:'higher', aggregate:'snapshot', plan2025:98.5, plan2026:99, performance2025:.982, performance2026:.988, volatility:.008, seed:11, decimals:2,
    manual:{'2026-07':98.23}},
  { id:'DX_MK', unit:'điểm', direction:'lower', aggregate:'snapshot', plan2025:3200, plan2026:3000, performance2025:1.08, performance2026:1.04, volatility:.11, seed:12, decimals:0,
    manual:{'2026-07':3678}},
  { id:'KT_SC', unit:'vụ', direction:'lower', aggregate:'sum', plan2025:112, plan2026:105, performance2025:1.02, performance2026:1.05, volatility:.14, seed:13, decimals:0, weights:incidentWeights,
    manual:{'2026-01':8,'2026-02':7,'2026-03':9,'2026-04':10,'2026-05':12,'2026-06':18,'2026-07':15}},
  { id:'SAIFI', unit:'lần', direction:'lower', aggregate:'sum', plan2025:3.05, plan2026:2.93, performance2025:.93, performance2026:.91, volatility:.09, seed:14, decimals:4, weights:incidentWeights,
    manual:{'2026-01':.21,'2026-02':.18,'2026-03':.22,'2026-04':.24,'2026-05':.2576,'2026-06':.27,'2026-07':.2512}},
  { id:'SAIDI', unit:'phút', direction:'lower', aggregate:'sum', plan2025:405, plan2026:383, performance2025:.93, performance2026:.90, volatility:.09, seed:15, decimals:4, weights:incidentWeights,
    manual:{'2026-01':22.5,'2026-02':25.4,'2026-03':27.1,'2026-04':30.2,'2026-05':28.7,'2026-06':30.2612,'2026-07':35.8221}},
  { id:'MAIFI', unit:'lần', direction:'lower', aggregate:'sum', plan2025:.55, plan2026:.5, performance2025:.62, performance2026:.56, volatility:.18, seed:16, decimals:4, weights:incidentWeights,
    manual:{'2026-01':.006,'2026-02':.004,'2026-03':.008,'2026-04':.005,'2026-05':.009,'2026-06':.0108,'2026-07':0}},
  { id:'DTXD', unit:'tỷ', direction:'higher', aggregate:'sum', plan2025:258, plan2026:283.2, performance2025:.88, performance2026:.84, volatility:.12, seed:17, decimals:3, weights:investWeights,
    manual:{'2026-01':8.5,'2026-02':10.2,'2026-03':12.3,'2026-04':14.1,'2026-05':20,'2026-06':23.172,'2026-07':8.792}},
  { id:'SCL', unit:'tỷ', direction:'higher', aggregate:'sum', plan2025:34.2, plan2026:36.669, performance2025:.92, performance2026:.91, volatility:.12, seed:18, decimals:3, weights:investWeights,
    manual:{'2026-01':2.5,'2026-02':3.1,'2026-03':4.2,'2026-04':5,'2026-05':6,'2026-06':8.362,'2026-07':.55}},
  { id:'TONKHO', unit:'tỷ', direction:'lower', aggregate:'snapshot', plan2025:21.5, plan2026:21.8, performance2025:.76, performance2026:.74, volatility:.08, seed:19, decimals:3,
    manual:{'2026-07':16.069}},
  { id:'CHIPHI', unit:'đ/kWh', direction:'lower', aggregate:'avg', plan2025:18.1, plan2026:17.47, performance2025:1.04, performance2026:1.08, volatility:.05, seed:20, decimals:2,
    manual:{'2026-07':19.38}},
  { id:'CBCNV', unit:'người', direction:'info', aggregate:'snapshot', plan2025:350, plan2026:355, performance2025:1, performance2026:1, volatility:.008, seed:21, decimals:0,
    manual:{'2026-07':355}},
  { id:'DT_GIO', unit:'giờ/LĐ', direction:'higher', aggregate:'sum', plan2025:40, plan2026:40, performance2025:1.02, performance2026:1.04, volatility:.12, seed:22, decimals:2, weights:trainingWeights,
    manual:{'2026-01':5.5,'2026-02':5.8,'2026-03':6.1,'2026-04':6,'2026-05':6.4,'2026-06':7.89,'2026-07':4}},
  { id:'NSLD_KH', unit:'KH/CBCNV', direction:'higher', aggregate:'snapshot', plan2025:620, plan2026:637, performance2025:.99, performance2026:.985, volatility:.015, seed:23, decimals:0,
    manual:{'2026-07':625}},
  { id:'ATTT', unit:'%', direction:'higher', aggregate:'snapshot', plan2025:100, plan2026:100, performance2025:1, performance2026:1, volatility:.001, seed:24, decimals:0,
    manual:{'2026-07':100}},
];

export const DEMO_PERIODS = ['2025','2026'].flatMap((year) => Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`));

function deterministicNoise(index: number, seed: number) {
  return (Math.sin((index + 1) * (seed + 2) * 1.371) + Math.cos((index + 2) * (seed + 5) * .731)) / 2;
}

function planFor(config: MetricConfig, year: number, monthIndex: number) {
  const annual = year === 2025 ? config.plan2025 : config.plan2026;
  if (config.aggregate === 'sum') {
    const weights = config.weights ?? sumWeights;
    const total = weights.reduce((a,b)=>a+b,0);
    return annual * weights[monthIndex] / total;
  }
  return annual;
}

function generatedActual(config: MetricConfig, year: number, monthIndex: number) {
  const period = `${year}-${String(monthIndex+1).padStart(2,'0')}`;
  if (config.manual?.[period] !== undefined) return config.manual[period];
  const plan = planFor(config, year, monthIndex);
  const perf = year === 2025 ? config.performance2025 : config.performance2026;
  const index = (year - 2025) * 12 + monthIndex;
  const wave = deterministicNoise(index, config.seed) * config.volatility;
  const improvement = (year === 2026 ? .008 : 0) * ((monthIndex - 5.5) / 5.5);
  let actual = plan * (perf + wave + improvement);
  if (config.direction === 'lower') actual = plan * (perf + wave - improvement);
  if (config.id === 'ATTT') actual = 100;
  if (config.id === 'CBCNV') actual = Math.round(actual);
  return Math.max(0, actual);
}

function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function buildHistory(config: MetricConfig): MetricHistory {
  const points: MetricHistoryPoint[] = [];
  for (const year of [2025, 2026]) {
    const actuals: number[] = [];
    const plans: number[] = [];
    for (let m=0;m<12;m++) {
      actuals.push(generatedActual(config, year, m));
      plans.push(planFor(config, year, m));
    }
    for (let m=0;m<12;m++) {
      const ytdActual = config.aggregate === 'sum' ? actuals.slice(0,m+1).reduce((a,b)=>a+b,0)
        : config.aggregate === 'avg' ? actuals.slice(0,m+1).reduce((a,b)=>a+b,0)/(m+1)
        : actuals[m];
      const ytdPlan = config.aggregate === 'sum' ? plans.slice(0,m+1).reduce((a,b)=>a+b,0)
        : config.aggregate === 'avg' ? plans.slice(0,m+1).reduce((a,b)=>a+b,0)/(m+1)
        : plans[m];
      points.push({
        period:`${year}-${String(m+1).padStart(2,'0')}`,
        actual:round(actuals[m], config.decimals ?? 2),
        planMonth:round(plans[m], config.decimals ?? 2),
        ytd:round(ytdActual, config.decimals ?? 2),
        planYtd:round(ytdPlan, config.decimals ?? 2),
      });
    }
  }
  return {
    id:config.id,
    unit:config.unit,
    direction:config.direction,
    aggregate:config.aggregate,
    decimals:config.decimals ?? 2,
    annualPlans:{'2025':config.plan2025,'2026':config.plan2026},
    points,
  };
}

export const DEMO_HISTORY: Record<string, MetricHistory> = Object.fromEntries(configs.map((c)=>[c.id,buildHistory(c)]));

function valueText(value: number | undefined, unit: string, digits: number) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const formatted = value.toLocaleString('vi-VN',{minimumFractionDigits:digits>0?Math.min(digits,2):0,maximumFractionDigits:digits});
  return unit ? `${formatted} ${unit}` : formatted;
}

function ratioFor(history: MetricHistory, point: MetricHistoryPoint) {
  const planMonth = point.planMonth;
  if (planMonth === undefined || planMonth === 0) return 100;
  return point.actual / planMonth * 100;
}

function toneFor(history: MetricHistory, point: MetricHistoryPoint): Tone {
  if (history.direction === 'info') return 'neutral';
  const ratio = ratioFor(history, point);
  if (history.direction === 'higher') return ratio >= 100 ? 'good' : ratio >= 95 ? 'warn' : 'bad';
  return ratio <= 100 ? 'good' : ratio <= 110 ? 'warn' : 'bad';
}

function statusFor(tone: Tone) {
  if (tone === 'good') return 'Đạt';
  if (tone === 'warn') return 'Theo dõi';
  if (tone === 'bad') return 'Không đạt';
  return 'Thông tin';
}

function buildCard(template: KpiCard, period: string): KpiCard {
  const history = DEMO_HISTORY[template.id];
  if (!history) return template;
  const point = history.points.find((p)=>p.period===period) ?? history.points[0];
  const tone = toneFor(history, point);
  const ratio = ratioFor(history, point);
  const actualText = valueText(point.actual, history.unit, history.decimals);
  const planText = valueText(point.planMonth, history.unit, history.decimals);
  const ytdText = valueText(point.ytd, history.unit, history.decimals);
  return {
    ...template,
    value: actualText,
    detail: `KH tháng ${planText} · Lũy kế ${ytdText}`,
    plan: `${ratio.toLocaleString('vi-VN',{maximumFractionDigits:1})}% KH tháng`,
    tone,
    status: statusFor(tone),
    sourcePage: undefined,
  };
}

function lastDay(period: string) {
  const [y,m] = period.split('-').map(Number);
  const d = new Date(y,m,0).getDate();
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function nextPeriodText(period: string) {
  const [y,m] = period.split('-').map(Number);
  const next = new Date(y,m,1);
  return `Kế hoạch tháng ${next.getMonth()+1}/${next.getFullYear()}`;
}

function domainName(fieldId: string) {
  const names: Record<string,string> = {
    'kinh-doanh':'Kinh doanh', dvkh:'DVKH', 'do-xa':'Đo xa', 'ky-thuat':'Kỹ thuật', 'dau-tu-tai-chinh':'Đầu tư & Tài chính', 'nhan-su':'Nhân sự',
  };
  return names[fieldId] ?? fieldId;
}

function buildAlerts(fields: FieldGroup[]): AlertItem[] {
  const rows = fields.flatMap((field)=>field.items.map((item)=>({field,item})));
  return rows
    .filter(({item})=>item.tone==='bad'||item.tone==='warn')
    .sort((a,b)=>Number(a.item.tone==='warn')-Number(b.item.tone==='warn'))
    .slice(0,8)
    .map(({field,item},i)=>({
      id:`DEMO_ALERT_${i}_${item.id}`,
      title:`${item.label}: ${item.tone==='bad'?'không đạt kế hoạch':'cần theo dõi'}`,
      current:item.value,
      target:item.detail?.split('·')[0]?.replace('KH tháng ','') ?? item.plan,
      note:`Cảnh báo DEMO tự sinh từ dữ liệu giả lập của ${field.title}.`,
      domain:domainName(field.id),
      domainId:field.id,
      kpiId:item.id,
      severity:item.tone==='bad'?'red':'yellow',
    }));
}

export function buildDemoDashboard(period = '2026-07'): DashboardBootstrap {
  const safePeriod = DEMO_PERIODS.includes(period) ? period : '2026-07';
  const fields = pdfSeed.fields.map((field)=>({ ...field, items:field.items.map((item)=>buildCard(item,safePeriod)) }));
  const all = fields.flatMap((f)=>f.items);
  const trackedBad = all.filter((x)=>x.tone==='bad').length;
  const trackedWarn = all.filter((x)=>x.tone==='warn').length;
  const fail = Math.max(1, Math.min(10, trackedBad));
  const partial = Math.max(1, Math.min(8, trackedWarn));
  const summary = { total:66, fail, partial, pass:66-fail-partial };
  const headlineIds = ['KD_DTP','KD_DT','KD_TT','DX_KN','KT_SC','DTXD'];
  const headline = headlineIds.map((id)=>all.find((x)=>x.id===id)).filter(Boolean) as KpiCard[];
  const get = (id:string)=>DEMO_HISTORY[id].points.find((p)=>p.period===safePeriod)!;
  const reliability = (['SAIFI','SAIDI','MAIFI'] as const).map((id)=>{
    const h=DEMO_HISTORY[id], p=get(id), year=safePeriod.slice(0,4);
    const targetYear = h.annualPlans?.[year] ?? 0;
    return { id, unit:h.unit, targetYear, targetPeriod:p.planYtd ?? targetYear, month:p.actual, ytd:p.ytd ?? p.actual, status:statusFor(toneFor(h,p)) };
  });
  const incidentPoint = get('KT_SC');
  const incidentMonth = Math.max(1, Math.round(incidentPoint.actual));
  const incidentYtd = incidentPoint.ytd ?? incidentPoint.actual;
  const shares = [34,24,18,14,10];
  const labels = ['Sét','Động vật','Cây','Hư VTTB','Khác'];
  const incidentCauses = labels.map((label,i)=>{
    const share = shares[i] ?? 0;
    return { label, monthValue:Math.round(incidentMonth*share/100), monthShare:share, ytdValue:Math.round(incidentYtd*share/100), ytdShare:share };
  });
  const status = nextPeriodText(safePeriod);
  const plans = [
    { id:'P1', owner:'Đội QLHTĐĐ', title:'Rà soát điểm đo và nâng tỷ lệ kết nối/khai thác đo xa.', status },
    { id:'P2', owner:'Đội QLVH', title:'Giảm sự cố trung thế, ưu tiên nguyên nhân có tỷ trọng cao.', status },
    { id:'P3', owner:'Phòng Kinh doanh', title:'Theo dõi điện thương phẩm, doanh thu và hợp đồng cần xử lý.', status },
    { id:'P4', owner:'Khối ĐTXD', title:'Đẩy nhanh thực hiện, nghiệm thu và giải ngân các công trình.', status },
    { id:'P5', owner:'Phòng TCNS', title:'Theo dõi năng suất lao động và kế hoạch đào tạo.', status },
  ];
  return {
    ok:true,
    period:safePeriod,
    reportingDate:lastDay(safePeriod),
    dataMode:'demo',
    sourceLabel:'DỮ LIỆU DEMO GIẢ LẬP 2025–2026 · chỉ dùng thử giao diện/tốc độ',
    availablePeriods:DEMO_PERIODS,
    history:DEMO_HISTORY,
    summary,
    headline,
    fields,
    reliability,
    incidentCauses,
    alerts:buildAlerts(fields),
    conflicts:[],
    plans,
    notes:[
      'Toàn bộ chuỗi 2025–2026 trong chế độ này là dữ liệu giả lập để kiểm thử UI, tốc độ, bộ lọc tháng, so sánh cùng kỳ và Forecast.',
      'Không dùng các giá trị DEMO để lập báo cáo chính thức hoặc thay thế số liệu trong PDF/Google Sheets.',
      'Một số giá trị tháng 7/2026 được đặt gần dữ liệu mẫu hiện có để giao diện có cảm giác thực tế; các tháng còn lại được sinh có quy luật và nhiễu xác định.',
    ],
  };
}
