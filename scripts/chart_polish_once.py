from pathlib import Path

p = Path('components/AppShell.tsx')
s = p.read_text()
old = '''function niceAxisScale(values: number[], includeZero = false) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1, step: 0.5, ticks: [0, 0.5, 1] };
  const rawMin = Math.min(...finite);
  const rawMax = Math.max(...finite);
  const magnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const rawSpan = Math.max(rawMax - rawMin, 0);
  const relativeSpan = rawSpan / magnitude;
  let step = relativeSpan < 0.08
    ? niceStep(Math.max(rawSpan / 2, magnitude * 0.01))
    : niceStep(magnitude / 4);
  if (magnitude >= 20 && step < 1) step = 1;
  let min = includeZero ? 0 : Math.floor(rawMin / step) * step;
  let max = Math.ceil(rawMax / step) * step;
  if (min === max) {
    min = includeZero ? 0 : Math.max(0, min - step);
    max += step;
  }
  // Luôn có ít nhất 3 mốc để trục tung dễ đọc trên điện thoại.
  while ((max - min) / step < 2) {
    if (!includeZero && min - step >= 0) min -= step;
    else max += step;
  }
  const ticks: number[] = [];
  for (let value = min; value <= max + step * 0.01; value += step) {
    ticks.push(Number(value.toPrecision(12)));
    if (ticks.length >= 6) break;
  }
  return { min, max, step, ticks };
}

function axisLabel(value: number, step = 1) {
  if (!Number.isFinite(value)) return '—';
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return value.toLocaleString('vi-VN', { maximumFractionDigits: digits });
}'''
new = '''function niceAxisScale(values: number[], includeZero = false) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1, step: 0.25, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const rawMin = Math.min(...finite);
  const rawMax = Math.max(...finite);
  const rawSpan = Math.max(rawMax - rawMin, 0);
  const magnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const targetIntervals = 4;
  const paddedSpan = rawSpan > 0 ? rawSpan * 1.18 : magnitude * 0.12;
  let step = niceStep(Math.max(paddedSpan / targetIntervals, magnitude * 0.0025));
  if (magnitude >= 20 && step < 1) step = 1;
  const pad = Math.max(step * 0.35, rawSpan * 0.08);
  let min = includeZero ? 0 : Math.floor((rawMin - pad) / step) * step;
  let max = Math.ceil((rawMax + pad) / step) * step;
  if (rawMin >= 0 && min < 0) min = 0;
  if (min === max) max = min + step * targetIntervals;
  let intervals = Math.round((max - min) / step);
  while (intervals > 4) {
    step = niceStep(step * 1.25);
    min = includeZero ? 0 : Math.floor((rawMin - pad) / step) * step;
    if (rawMin >= 0 && min < 0) min = 0;
    max = Math.ceil((rawMax + pad) / step) * step;
    intervals = Math.round((max - min) / step);
  }
  while (intervals < 3) {
    max += step;
    intervals = Math.round((max - min) / step);
  }
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => Number((min + index * step).toPrecision(12)));
  return { min, max, step, ticks };
}

function axisLabel(value: number, step = 1) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M`;
  if (abs >= 10_000) return `${(value / 1_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  const digits = step >= 10 ? 0 : step >= 1 ? (Math.abs(step % 1) > 0.001 ? 1 : 0) : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return value.toLocaleString('vi-VN', { maximumFractionDigits: digits });
}'''
if old not in s:
    raise SystemExit('axis block not found')
s = s.replace(old, new)
s = s.replace('const plotLeft = 50, plotRight = 374, plotTop = 24, plotBottom = 132;', 'const plotLeft = 58, plotRight = 374, plotTop = 22, plotBottom = 132;')
s = s.replace('const plotLeft=50,plotRight=374,plotTop=24,plotBottom=132;', 'const plotLeft=58,plotRight=374,plotTop=22,plotBottom=132;')
s = s.replace('''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ ${mode === 'ytd' ? 'lũy kế' : 'dự báo'} ${kpiId}`}>
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} className="chartPlotDismiss" onPointerDown={() => setSelectedIndex(null)} />''', '''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ ${mode === 'ytd' ? 'lũy kế' : 'dự báo'} ${kpiId}`}>
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} rx="10" className="chartPlotSurface" />
      <rect x={Math.max(plotLeft, x(month - 1) - 12)} y={plotTop} width="24" height={plotBottom - plotTop} rx="8" className="chartCurrentBand" />
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} className="chartPlotDismiss" onPointerDown={() => setSelectedIndex(null)} />''')
s = s.replace('''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ cột thực hiện và mốc kế hoạch ${kpiId}`}>
      {grid.map''', '''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ cột thực hiện và mốc kế hoạch ${kpiId}`}>
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} rx="10" className="chartPlotSurface" />
      <rect x={Math.max(plotLeft, x(currentIndex) - 12)} y={plotTop} width="24" height={plotBottom - plotTop} rx="8" className="chartCurrentBand" />
      {grid.map''')
s = s.replace('''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label="Biểu đồ cột cùng kỳ">
      {grid.map''', '''<svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label="Biểu đồ cột cùng kỳ">
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} rx="10" className="chartPlotSurface" />
      <rect x={Math.max(plotLeft, x(month - 1) - 12)} y={plotTop} width="24" height={plotBottom - plotTop} rx="8" className="chartCurrentBand" />
      {grid.map''')
p.write_text(s)

css = Path('app/globals.css')
c = css.read_text()
marker = '/* V1.8.4 — CHART VISUAL POLISH */'
if marker not in c:
    c += '''\n\n/* V1.8.4 — CHART VISUAL POLISH */
.historyChartWrap.interactiveChartWrap{margin-top:8px;padding:32px 8px 10px;border:1px solid #E8EEF4;border-radius:16px;background:linear-gradient(180deg,#FFFFFF 0%,#FBFDFE 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 5px 16px rgba(15,23,42,.035)}
.historyChart{filter:drop-shadow(0 1px 0 rgba(255,255,255,.85))}
.chartPlotSurface{fill:#FCFDFE;stroke:#EDF2F7;stroke-width:1;vector-effect:non-scaling-stroke;pointer-events:none}
.chartCurrentBand{fill:#ECFDF5;opacity:.72;pointer-events:none}
.chartGrid{stroke:#E9EEF4;stroke-width:.85;stroke-dasharray:2 4;opacity:.95}
.chartAxisLabel{fill:#526174;font-size:8.5px;font-weight:650;letter-spacing:-.08px;font-variant-numeric:tabular-nums;paint-order:stroke;stroke:#fff;stroke-width:2.6px;stroke-linejoin:round}
.chartLabel{fill:#8A99AA;font-size:7px;font-weight:600}
.chartLabel.currentPeriod,.chartLabel.current{fill:#047857;font-weight:850}
.chartUnitLabel{left:10px;top:8px;padding:4px 7px;border:1px solid #E5EBF1;border-radius:999px;background:#F8FAFC;color:#64748B;line-height:1;letter-spacing:.02em}
.chartUnitLabel b{color:#334155;font-weight:800}
.chartActual{stroke:#0B8A61;stroke-width:3.1}
.chartPlan{stroke:#A5B1BF;stroke-width:1.8;stroke-dasharray:5 5}
.chartForecast{stroke:#D97706;stroke-width:2.2;stroke-dasharray:6 5}
.monthlyActualBar{filter:drop-shadow(0 2px 3px rgba(5,150,105,.16))}
.monthlyBarGroup.active .monthlyActualBar{filter:drop-shadow(0 3px 5px rgba(5,150,105,.28))}
.monthlyPlanTarget{stroke-width:2.1;stroke-linecap:round}
.chartSelectedAnchor .chartAnchor,.currentBarAnchor{filter:drop-shadow(0 2px 3px rgba(5,150,105,.3))}
.chartLegend{margin-top:2px;padding:5px 4px 0;border-top:1px solid #F0F3F6}
.chartLegend span{font-size:8.5px}.chartLegend small{color:#94A3B8}
.chartFloatingPopup{border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(8px)}
@media(max-width:520px){.historyChartWrap.interactiveChartWrap{padding:30px 5px 8px;border-radius:14px}.chartAxisLabel{font-size:8px;stroke-width:2.2px}.chartUnitLabel{left:7px;top:7px;font-size:8.5px}.chartLabel{font-size:6.6px}}
'''
css.write_text(c)
