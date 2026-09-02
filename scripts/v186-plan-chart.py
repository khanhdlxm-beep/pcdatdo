from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'components' / 'AppShell.tsx'
CSS = ROOT / 'app' / 'globals.css'
VERIFY = ROOT / 'scripts' / 'verify-production.mjs'
PKG = ROOT / 'package.json'
LOCK = ROOT / 'package-lock.json'
VERSION = ROOT / 'lib' / 'app-version.ts'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, new_block: str, label: str) -> str:
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f'{label}: start marker missing')
    j = text.find(end, i)
    if j < 0:
        raise RuntimeError(f'{label}: end marker missing')
    return text[:i] + new_block.rstrip() + '\n\n' + text[j:]


app = APP.read_text(encoding='utf-8')

metric_ratio = """function metricRatio(history: MetricHistory, point: MetricHistoryPoint) {
  const actual = numericValue(point.actual);
  const plan = numericValue(point.planMonth);
  if (actual === undefined || plan === undefined || plan === 0) return undefined;
  return actual / plan * 100;
}
"""
plan_helpers = metric_ratio + """
type PlanFocus = 'month' | 'ytd';

function planReferenceValues(history: MetricHistory, point: MetricHistoryPoint | undefined, year: string) {
  return {
    month: numericValue(point?.planMonth),
    ytd: numericValue(point?.planYtd),
    annual: numericValue(history.annualPlans?.[year]),
  };
}

function planSummaryText(history: MetricHistory, point: MetricHistoryPoint | undefined, year: string) {
  const refs = planReferenceValues(history, point, year);
  return [
    `KH tháng ${metricFormat(history, refs.month)}`,
    `KH lũy kế ${metricFormat(history, refs.ytd)}`,
    `KH năm ${metricFormat(history, refs.annual)}`,
  ].join(' · ');
}

function currentPlanTarget(history: MetricHistory, point: MetricHistoryPoint, year: string) {
  const refs = planReferenceValues(history, point, year);
  if (refs.month !== undefined) return { value: refs.month, label: 'KH tháng' };
  if (history.aggregate === 'snapshot' || history.aggregate === 'avg') {
    if (refs.ytd !== undefined) return { value: refs.ytd, label: 'KH kỳ' };
    if (refs.annual !== undefined) return { value: refs.annual, label: 'KH năm' };
  }
  return { value: undefined, label: 'KH tháng' };
}

function PlanReferenceStrip({ history, point, year, focus = 'month' }: {
  history: MetricHistory;
  point?: MetricHistoryPoint;
  year: string;
  focus?: PlanFocus;
}) {
  const refs = planReferenceValues(history, point, year);
  const missingFocus = focus === 'month' ? refs.month === undefined : refs.ytd === undefined;
  return <div className="chartPlanReference" aria-label="Các mốc kế hoạch chính thức">
    <span className={refs.month === undefined ? 'missing' : ''}><small>KH tháng</small><b>{metricFormat(history, refs.month)}</b></span>
    <span className={refs.ytd === undefined ? 'missing' : ''}><small>KH lũy kế</small><b>{metricFormat(history, refs.ytd)}</b></span>
    <span className={refs.annual === undefined ? 'missing' : ''}><small>KH năm</small><b>{metricFormat(history, refs.annual)}</b></span>
    {missingFocus && <em>{focus === 'month' ? 'PDF nguồn chưa có KH tháng; app không tự chia KH năm theo tháng.' : 'PDF nguồn chưa có KH lũy kế cho kỳ này; app không tự nội suy.'}</em>}
  </div>;
}
"""
app = replace_once(app, metric_ratio, plan_helpers, 'insert plan helpers')

app = replace_once(
    app,
    "    const annualPlan = history.annualPlans?.[year];\n",
    "",
    'remove duplicate annualPlan local',
)
app = replace_once(
    app,
    "      plan: `KH tháng ${metricFormat(history, point.planMonth)} · KH năm ${metricFormat(history, annualPlan)}`,",
    "      plan: planSummaryText(history, point, year),",
    'presentation plan summary',
)
app = replace_once(
    app,
    "    <span className={planClass}>{planGap === undefined ? 'KH: —' : `${planGap >= 0 ? '✓' : '⚠'} ${Math.abs(planGap).toLocaleString('vi-VN',{maximumFractionDigits:1})}% so KH`}</span>",
    "    <span className={planClass}>{planGap === undefined ? 'KH tháng: chưa có nguồn' : `${planGap >= 0 ? '✓' : '⚠'} ${Math.abs(planGap).toLocaleString('vi-VN',{maximumFractionDigits:1})}% so KH tháng`}</span>",
    'mini insight plan wording',
)

app = replace_once(
    app,
    "  const forecast = useMemo(() => buildUnifiedForecast(history, data.period), [history, data.period]);\n",
    "  const forecast = useMemo(() => buildUnifiedForecast(history, data.period), [history, data.period]);\n  const annualPlan = numericValue(history.annualPlans?.[year]);\n  const annualPlanForChart = mode === 'ytd' ? annualPlan : undefined;\n",
    'history annual plan reference',
)
app = replace_once(
    app,
    "  const all = [...actualValues, ...planValues, ...forecastValues].filter(Number.isFinite) as number[];",
    "  const all = [...actualValues, ...planValues, ...forecastValues, ...(annualPlanForChart !== undefined ? [annualPlanForChart] : [])].filter(Number.isFinite) as number[];",
    'history axis includes annual plan',
)
app = replace_once(
    app,
    "      <path d={planPath} className=\"chartPlan\"/><path d={actualPath} className=\"chartActual\"/>{mode === 'forecast' && forecast && <path d={forecastPath} className=\"chartForecast\"/>}",
    "      {annualPlanForChart !== undefined && <g className=\"chartAnnualPlanGroup\"><line x1={plotLeft} x2={plotRight} y1={y(annualPlanForChart)} y2={y(annualPlanForChart)} className=\"chartAnnualPlan\"/><text x={plotRight - 4} y={Math.max(plotTop + 10, y(annualPlanForChart) - 5)} textAnchor=\"end\" className=\"chartAnnualPlanLabel\">KH năm {axisLabel(annualPlanForChart, step)}</text></g>}\n      <path d={planPath} className=\"chartPlan\"/><path d={actualPath} className=\"chartActual\"/>{mode === 'forecast' && forecast && <path d={forecastPath} className=\"chartForecast\"/>}",
    'draw annual plan line in ytd',
)
app = replace_once(
    app,
    "    </svg>\n    {hasDetail && detailIndex !== null && <div className=\"chartFloatingPopup\"><div><b>{`T${detailIndex+1}/${year}`}</b><span>{mode==='ytd'?'Lũy kế':'Dự báo'}</span></div>",
    "    </svg>\n    <PlanReferenceStrip history={history} point={slots[Math.max(0, month - 1)]} year={year} focus={mode === 'ytd' ? 'ytd' : 'month'} />\n    {hasDetail && detailIndex !== null && <div className=\"chartFloatingPopup\"><div><b>{`T${detailIndex+1}/${year}`}</b><span>{mode==='ytd'?'Lũy kế':'Dự báo'}</span></div>",
    'history plan strip',
)
app = replace_once(
    app,
    "<div><dt>KH</dt><dd>{metricFormat(history,selectedPlan)}</dd></div>",
    "<div><dt>{mode === 'ytd' ? 'KH lũy kế' : 'KH tháng'}</dt><dd>{metricFormat(history,selectedPlan)}</dd></div>",
    'history popup plan label',
)
app = replace_once(
    app,
    "    <div className=\"chartLegend\"><span className=\"actual\">TH</span><span className=\"plan\">KH</span>{mode==='forecast'&&<span className=\"forecast\">Dự báo</span>}<small>ⓘ Chạm hoặc kéo theo tháng</small></div>",
    "    <div className=\"chartLegend\"><span className=\"actual\">TH</span><span className=\"plan\">{mode === 'ytd' ? 'KH lũy kế' : 'KH tháng'}</span>{mode === 'ytd' && annualPlanForChart !== undefined && <span className=\"annualPlan\">KH năm</span>}{mode==='forecast'&&<span className=\"forecast\">Dự báo</span>}<small>ⓘ Chạm hoặc kéo theo tháng</small></div>",
    'history legend plan scopes',
)

app = replace_once(
    app,
    "    </svg>\n    {hasDetail&&active!==null&&<div className=\"chartFloatingPopup\"><div><b>{`T${active+1}/${year}`}</b><span>TH tháng & mốc KH</span></div>",
    "    </svg>\n    <PlanReferenceStrip history={history} point={current} year={year} focus=\"month\" />\n    {hasDetail&&active!==null&&<div className=\"chartFloatingPopup\"><div><b>{`T${active+1}/${year}`}</b><span>TH tháng & mốc KH tháng</span></div>",
    'monthly plan strip',
)
app = replace_once(
    app,
    "<div><dt>KH</dt><dd>{metricFormat(history,plan)}</dd></div><div><dt>TH/KH</dt>",
    "<div><dt>KH tháng</dt><dd>{metricFormat(history,plan)}</dd></div><div><dt>TH/KH</dt>",
    'monthly popup plan label',
)
app = replace_once(
    app,
    "    <div className=\"chartLegend\"><span className=\"actual bar\">TH</span><span className=\"plan target\">KH</span><small>ⓘ Chạm/kéo T1–T12 để xem</small></div>",
    "    <div className=\"chartLegend\"><span className=\"actual bar\">TH</span><span className=\"plan target\">KH tháng</span><small>ⓘ Vạch ngang chỉ xuất hiện khi PDF có KH tháng</small></div>",
    'monthly legend plan scope',
)

new_gauge = """function GaugeChart({ history, point, year }: { history:MetricHistory; point:MetricHistoryPoint; year:string }) {
  const actual = numericValue(point.actual);
  const target = currentPlanTarget(history, point, year);
  const plan = target.value;
  const [open,setOpen]=useState(false);
  if (actual === undefined) return <div className=\"lockedPanel\"><span>◌</span><b>Chưa có dữ liệu thực hiện</b></div>;
  const rawRatio = plan !== undefined && plan !== 0 ? actual / plan * 100 : undefined;
  const score = rawRatio === undefined ? 0 : history.direction === 'lower' && plan !== undefined ? Math.min(100, plan / Math.max(actual,.00001) * 100) : Math.min(100, rawRatio);
  const radius = 42, circumference = 2*Math.PI*radius;
  return <div className=\"adaptiveGauge interactiveSnapshot\" onClick={()=>setOpen((v)=>!v)} role=\"button\" tabIndex={0}>
    <svg viewBox=\"0 0 120 120\" role=\"img\" aria-label=\"Biểu đồ tỷ lệ hoàn thành theo mốc kế hoạch chính thức\"><circle cx=\"60\" cy=\"60\" r={radius} className=\"gaugeTrack\"/><circle cx=\"60\" cy=\"60\" r={radius} className=\"gaugeValue\" strokeDasharray={`${circumference*score/100} ${circumference}`}/><text x=\"60\" y=\"56\" textAnchor=\"middle\" className=\"gaugeMain\">{rawRatio === undefined ? '—' : `${rawRatio.toLocaleString('vi-VN',{maximumFractionDigits:1})}%`}</text><text x=\"60\" y=\"72\" textAnchor=\"middle\" className=\"gaugeSub\">{rawRatio === undefined ? 'Chưa có mốc KH' : `TH / ${target.label}`}</text></svg>
    <div className=\"gaugeFacts\"><span><small>Thực hiện</small><b>{metricFormat(history,actual)}</b></span><span><small>{target.label}</small><b>{metricFormat(history,plan)}</b></span></div>
    <PlanReferenceStrip history={history} point={point} year={year} focus=\"month\" />
    {open&&<div className=\"snapshotPopup\"><b>Chi tiết chỉ tiêu</b><span>TH: {metricFormat(history,actual)}</span><span>{target.label}: {metricFormat(history,plan)}</span><span>Tỷ lệ: {rawRatio === undefined ? '—' : `${rawRatio.toLocaleString('vi-VN',{maximumFractionDigits:1})}%`}</span></div>}
  </div>;
}"""
app = replace_between(app, 'function GaugeChart(', 'function ThresholdChart(', new_gauge, 'replace gauge chart')

new_threshold = """function ThresholdChart({ history, point, year }: { history:MetricHistory; point:MetricHistoryPoint; year:string }) {
  const actual = numericValue(point.actual);
  const target = currentPlanTarget(history, point, year);
  const plan = target.value;
  const [open,setOpen]=useState(false);
  if(actual===undefined) return <div className=\"lockedPanel\"><span>—</span><b>Chưa có dữ liệu thực hiện</b></div>;
  const max=Math.max(actual,plan??0,1)*1.25,actualWidth=Math.min(100,actual/max*100),planLeft=plan===undefined?undefined:Math.min(100,plan/max*100),good=plan===undefined?undefined:history.direction==='lower'?actual<=plan:actual>=plan;
  return <div className=\"thresholdChart interactiveSnapshot\" onClick={()=>setOpen((v)=>!v)} role=\"button\" tabIndex={0}>
    <div className=\"thresholdLabels\"><span><small>TH</small><b>{metricFormat(history,actual)}</b></span><span><small>{target.label}</small><b>{metricFormat(history,plan)}</b></span></div>
    <div className=\"thresholdTrack\"><span className={good===undefined?'neutral':good?'good':'risk'} style={{width:`${actualWidth}%`}}/>{planLeft!==undefined&&<i style={{left:`${planLeft}%`}}/>}</div>
    <small>{plan===undefined?'Chưa có ngưỡng/KH tương thích trong nguồn; app không tự suy diễn.':history.direction==='lower'?'Vạch đứng là mức tối đa/kế hoạch':'Vạch đứng là kế hoạch cần đạt'} · Chạm để xem chi tiết</small>
    <PlanReferenceStrip history={history} point={point} year={year} focus=\"month\" />
    {open&&<div className=\"snapshotPopup\"><b>{good===undefined?'Chưa đủ mốc KH':good?'Đang trong ngưỡng':'Cần chú ý'}</b><span>TH: {metricFormat(history,actual)}</span><span>{target.label}: {metricFormat(history,plan)}</span></div>}
  </div>;
}"""
app = replace_between(app, 'function ThresholdChart(', 'function ParetoIncidentChart(', new_threshold, 'replace threshold chart')

old_adaptive = """function AdaptiveCurrentChart({ data, kpiId }: { data:DashboardBootstrap; kpiId:string }) {
  const history=historyForKpi(data,kpiId),point=historyPoint(data,kpiId);if(!history||!point)return null;const kind=chartKindFor(kpiId,history);if(kind==='pareto')return <ParetoIncidentChart data={data}/>;if(kind==='gauge')return <GaugeChart history={history} point={point}/>;if(kind==='threshold')return <ThresholdChart history={history} point={point}/>;return <MonthlyActualTargetChart data={data} kpiId={kpiId}/>;
}
"""
new_adaptive = """function AdaptiveCurrentChart({ data, kpiId }: { data:DashboardBootstrap; kpiId:string }) {
  const history=historyForKpi(data,kpiId),point=historyPoint(data,kpiId);if(!history||!point)return null;
  const kind=chartKindFor(kpiId,history),year=data.period.slice(0,4);
  if(kind==='pareto')return <ParetoIncidentChart data={data}/>;
  if(kind==='gauge')return <GaugeChart history={history} point={point} year={year}/>;
  if(kind==='threshold')return <ThresholdChart history={history} point={point} year={year}/>;
  return <MonthlyActualTargetChart data={data} kpiId={kpiId}/>;
}
"""
app = replace_once(app, old_adaptive, new_adaptive, 'adaptive chart plan year')

APP.write_text(app, encoding='utf-8')

css = CSS.read_text(encoding='utf-8')
marker = '/* V1.8.6 — explicit official plan references */'
if marker not in css:
    css += """

/* V1.8.6 — explicit official plan references */
.chartPlanReference{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:9px 0 3px;padding:8px;border:1px solid rgba(100,116,139,.16);border-radius:12px;background:rgba(248,250,252,.7)}
.chartPlanReference>span{min-width:0;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.78);border:1px solid rgba(148,163,184,.14)}
.chartPlanReference small{display:block;font-size:10px;line-height:1.15;color:#64748b;margin-bottom:3px}.chartPlanReference b{display:block;font-size:12px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#0f172a}
.chartPlanReference .missing b{color:#94a3b8;font-weight:600}.chartPlanReference em{grid-column:1/-1;font-size:10px;line-height:1.35;color:#64748b;font-style:normal;padding:0 2px}
.chartAnnualPlan{stroke:#7c3aed;stroke-width:1.35;stroke-dasharray:6 4;opacity:.72;pointer-events:none}.chartAnnualPlanLabel{fill:#6d28d9;font-size:8.5px;font-weight:700;paint-order:stroke;stroke:rgba(255,255,255,.92);stroke-width:2px;stroke-linejoin:round}
.chartLegend .annualPlan::before{background:#7c3aed;border-radius:999px}.thresholdTrack>span.neutral{opacity:.55}
@media(max-width:640px){.chartPlanReference{grid-template-columns:1fr 1fr}.chartPlanReference>span:last-of-type{grid-column:1/-1}.chartPlanReference b{font-size:11px}}
"""
CSS.write_text(css, encoding='utf-8')

verify = VERIFY.read_text(encoding='utf-8')
needle = "ok('AppShell đã bỏ Forecast engine/nhãn DEMO cũ');\n"
addition = needle + """if (!appShell.includes('PlanReferenceStrip')) fail('Biểu đồ chưa hiển thị bảng mốc KH tháng/lũy kế/năm');
if (!appShell.includes('app không tự chia KH năm theo tháng')) fail('Thiếu cảnh báo không tự suy diễn KH tháng');
if (!appShell.includes('chartAnnualPlan')) fail('Biểu đồ lũy kế chưa có mốc KH năm');
ok('Biểu đồ đối chiếu KH tháng/lũy kế/năm theo dữ liệu nguồn');
"""
verify = replace_once(verify, needle, addition, 'verification plan chart assertions')
VERIFY.write_text(verify, encoding='utf-8')

pkg = json.loads(PKG.read_text(encoding='utf-8'))
pkg['version'] = '1.8.6'
PKG.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock = json.loads(LOCK.read_text(encoding='utf-8'))
lock['version'] = '1.8.6'
if isinstance(lock.get('packages'), dict) and isinstance(lock['packages'].get(''), dict):
    lock['packages']['']['version'] = '1.8.6'
LOCK.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

version = VERSION.read_text(encoding='utf-8')
version = replace_once(version, "export const APP_VERSION = '1.8.5';", "export const APP_VERSION = '1.8.6';", 'app version')
VERSION.write_text(version, encoding='utf-8')

print('V1.8.6 plan chart codemod applied without touching KPI/history data.')
