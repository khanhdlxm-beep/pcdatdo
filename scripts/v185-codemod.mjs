import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function writeIfChanged(file, before, after) {
  if (before === after) return false;
  fs.writeFileSync(file, after);
  console.log(`updated ${file}`);
  return true;
}
function replaceRequired(text, pattern, replacement, label) {
  if (typeof pattern === 'string') {
    if (!text.includes(pattern)) {
      if (text.includes(replacement)) return text;
      throw new Error(`Không tìm thấy đoạn cần nâng cấp: ${label}`);
    }
    return text.replace(pattern, replacement);
  }
  if (!pattern.test(text)) {
    if (typeof replacement === 'string' && text.includes(replacement.slice(0, Math.min(80, replacement.length)))) return text;
    throw new Error(`Không tìm thấy mẫu cần nâng cấp: ${label}`);
  }
  return text.replace(pattern, replacement);
}

let app = read('components/AppShell.tsx');
const appBefore = app;

if (!app.includes("@/lib/forecast-core")) {
  app = replaceRequired(
    app,
    "import { buildEarlyWarnings } from '@/lib/forecast-v2';",
    "import { buildEarlyWarnings } from '@/lib/forecast-v2';\nimport { buildUnifiedForecast, forecastConfidenceLabel } from '@/lib/forecast-core';",
    'forecast-core import',
  );
}

app = app.replace("loading: () => <div className=\"aiLazyLoading\"><span className=\"loader\"/><b>Đang mở AI Điều hành…</b></div>,", "loading: () => <div className=\"aiLazyLoading\"><span className=\"loader\"/><b>Đang mở Trợ lý điều hành…</b></div>,");
app = app.replace("{ id: 'ai', label: 'AI', icon: '✦' },", "{ id: 'ai', label: 'Trợ lý', icon: '✦' },");

if (app.includes('function forecastFor(')) {
  app = replaceRequired(
    app,
    /function forecastFor\(history: MetricHistory, period: string\) \{[\s\S]*?\n\}\n\n(?=function smoothChartPath)/,
    '',
    'Forecast engine cũ trong AppShell',
  );
}
app = app.replace(/forecastFor\(/g, 'buildUnifiedForecast(');

const forecastPanel = `function ForecastPanel({ data, kpiId }: { data: DashboardBootstrap; kpiId: string }) {
  const history = historyForKpi(data, kpiId);
  if (!history) return <div className="lockedPanel"><span>⌁</span><b>Chưa có dữ liệu lịch sử</b></div>;
  const forecast = buildUnifiedForecast(history, data.period);
  if (!forecast) return <div className="lockedPanel"><span>⌁</span><b>Chưa đủ dữ liệu để dự báo</b><p>Cần tối thiểu 6 kỳ hợp lệ sau điểm gãy dữ liệu gần nhất.</p></div>;
  const directionGood = forecast.projectedRatio === undefined ? undefined : forecast.projectedRatio >= 100;
  return (
    <>
      <HistoryChart data={data} kpiId={kpiId} mode="forecast" />
      <div className="forecastStats">
        <div><small>Tháng kế tiếp</small><b>{metricFormat(history, forecast.nextMonth)}</b></div>
        <div><small>Dự báo cuối năm</small><b>{metricFormat(history, forecast.yearEnd)}</b></div>
        <div className={directionGood === undefined ? 'neutral' : directionGood ? 'good' : 'risk'}>
          <small>Khả năng đạt KH</small>
          <b>{directionGood === undefined ? 'Chưa đủ cơ sở so KH năm' : directionGood ? 'Có khả năng đạt' : 'Có nguy cơ không đạt'}</b>
          <em>Tin cậy: {forecastConfidenceLabel(forecast.confidence)} · độ phủ {forecast.coverage.toLocaleString('vi-VN',{maximumFractionDigits:0})}%</em>
        </div>
      </div>
      <p className="forecastNote">{forecast.basis} Dự báo là tín hiệu tham khảo điều hành, không thay thế số thực hiện hoặc kế hoạch chính thức.</p>
    </>
  );
}`;
app = replaceRequired(
  app,
  /function ForecastPanel\(\{ data, kpiId \}: \{ data: DashboardBootstrap; kpiId: string \}\) \{[\s\S]*?\n\}\n\n(?=function downloadSnapshot)/,
  forecastPanel + '\n\n',
  'ForecastPanel',
);

const summaryCompact = `function SummaryCompact({ data }: { data: DashboardBootstrap }) {
  const tracked = data.fields.reduce((sum, field) => sum + field.items.length, 0);
  const total = Math.max(data.summary.total, 1);
  const pass = data.summary.pass / total * 100;
  const partial = data.summary.partial / total * 100;
  const fail = data.summary.fail / total * 100;
  return (
    <section className="summaryCompact summaryV185" aria-label="Tóm tắt KPI">
      <div className="summaryScopeRow">
        <div><b>{tracked}</b><span><strong>KPI đang theo dõi trên App</strong><small>Dùng cho biểu đồ, cảnh báo và phân tích</small></span></div>
        <div><b>{data.summary.pass}/{data.summary.total}</b><span><strong>Chỉ tiêu đạt theo báo cáo nguồn</strong><small>Giữ nguyên tổng hợp của kỳ báo cáo</small></span></div>
      </div>
      <div className="summaryNumbers reportSummaryNumbers">
        <span><b>{data.summary.total}</b><small>Tổng nguồn</small></span>
        <span className="success"><b>{data.summary.pass}</b><small>Đạt</small></span>
        <span className="warning"><b>{data.summary.partial}</b><small>Một phần</small></span>
        <span className="danger"><b>{data.summary.fail}</b><small>Không đạt</small></span>
      </div>
      <div className="segmentedBar" aria-hidden="true">
        <i className="segPass" style={{ width: pass + '%' }} />
        <i className="segPartial" style={{ width: partial + '%' }} />
        <i className="segFail" style={{ width: fail + '%' }} />
      </div>
    </section>
  );
}`;
app = replaceRequired(
  app,
  /function SummaryCompact\(\{ data \}: \{ data: DashboardBootstrap \}\) \{[\s\S]*?\n\}\n\n(?=type TrendSignal)/,
  summaryCompact + '\n\n',
  'SummaryCompact',
);

app = app.replace(/\{data\.dataMode === 'demo' \? 'Giải pháp DEMO' : 'Theo báo cáo'\}/g, 'Theo báo cáo');
app = app.replace("<h1>Điều hành SXKD{data.dataMode === 'demo' && <em className=\"demoChip\">DEMO</em>}</h1>", '<h1>Điều hành SXKD</h1>');
app = app.replace(/\{data\.dataMode === 'demo' && <div className="demoWarning">[\s\S]*?<\/div>\}/g, '');
app = app.replace("{data.dataMode === 'demo' ? 'DEMO giả lập 2025–2026' : data.dataMode === 'pdf-seed' ? 'Dữ liệu PDF mẫu' : 'Apps Script API'}", 'Apps Script API');

app = app.replace(
  '<div><small>Tiến độ</small><b>{action.progress}%</b></div>',
  "<div><small>Tiến độ</small><b>{action.progressConfirmed ? `${action.progress}%` : 'Chưa xác nhận'}</b></div>",
);
app = app.replace(
  "<div><small>Thời hạn</small><b>{action.dueDate??'Chưa đặt'}</b></div>",
  "<div><small>Thời hạn</small><b>{action.dueDateConfirmed && action.dueDate ? action.dueDate : 'Chưa có hạn chính thức'}</b></div>",
);
app = app.replace(
  "<div><small>Nguồn</small><b>{action.source}</b></div>",
  "<div><small>Nguồn</small><b>{action.origin==='official'?'Theo báo cáo':action.origin==='user'?'Người dùng tạo':'Gợi ý hệ thống'}</b></div>",
);
app = app.replace(
  '<span>Điểm tổng hợp từ tiến độ kế hoạch, xu hướng, cùng kỳ, forecast và độ ổn định.</span>',
  "<span>Chỉ chấm trên thành phần có dữ liệu thực · độ phủ {healthModel?.coverage.toLocaleString('vi-VN',{maximumFractionDigits:0}) ?? '—'}% · tin cậy {healthModel?.confidence==='high'?'cao':healthModel?.confidence==='medium'?'trung bình':'thấp'}.</span>",
);

writeIfChanged('components/AppShell.tsx', appBefore, app);

let css = read('app/globals.css');
const cssBefore = css;
const marker = '/* V1.8.5 — STABILIZATION */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.summaryV185{display:grid;gap:10px}.summaryScopeRow{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.summaryScopeRow>div{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid #E2E8F0;border-radius:12px;background:#fff}.summaryScopeRow b{font-size:19px;color:#0F172A;font-variant-numeric:tabular-nums}.summaryScopeRow span{display:grid;gap:1px;min-width:0}.summaryScopeRow strong{font-size:10.5px;color:#334155;font-weight:700}.summaryScopeRow small{font-size:9.5px;color:#64748B;line-height:1.3}.reportSummaryNumbers{padding-top:2px}.actionProgress.unconfirmed{background:#F1F5F9}.actionProgress.unconfirmed span{min-width:max-content;color:#64748B;font-size:10px}.healthScoreCard>div>small:last-child{margin-top:2px;color:#64748B;font-size:9px}.forecastNote{border-left:3px solid #CBD5E1;padding-left:9px}.forecastStats em{display:block;margin-top:2px;font-size:9px;color:#64748B;font-style:normal}@media(max-width:520px){.summaryScopeRow{grid-template-columns:1fr}.summaryScopeRow>div{padding:8px 9px}.summaryScopeRow b{font-size:18px}}\n`;
}
writeIfChanged('app/globals.css', cssBefore, css);

const pkg = JSON.parse(read('package.json'));
const lockBefore = read('package-lock.json');
const lock = JSON.parse(lockBefore);
lock.name = pkg.name;
lock.version = pkg.version;
lock.packages = lock.packages || {};
lock.packages[''] = lock.packages[''] || {};
lock.packages[''].name = pkg.name;
lock.packages[''].version = pkg.version;
const lockAfter = JSON.stringify(lock, null, 2) + '\n';
writeIfChanged('package-lock.json', lockBefore, lockAfter);

console.log('V1.8.5 codemod complete. Không chỉnh sửa dữ liệu KPI/history.');
