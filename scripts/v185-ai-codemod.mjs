import fs from 'node:fs';

const file = 'lib/ai-local.ts';
let text = fs.readFileSync(file, 'utf8');
const before = text;

function replaceOnce(search, replacement, label) {
  if (text.includes(replacement)) return;
  if (!text.includes(search)) throw new Error(`Không tìm thấy đoạn AI cần nâng cấp: ${label}`);
  text = text.replace(search, replacement);
}

replaceOnce(
  "        healthTrend: healthRow?.trend,\n        planScore: healthRow?.planScore,",
  "        healthTrend: healthRow?.trend,\n        healthCoverage: healthRow?.coverage,\n        healthConfidence: healthRow?.confidence,\n        planScore: healthRow?.planScore,",
  'health coverage trong KPI index',
);

replaceOnce(
  "        projectedRatio: warning?.projectedRatio,\n        projectedValue: warning?.projectedValue,",
  "        projectedRatio: warning?.projectedRatio,\n        projectedValue: warning?.projectedValue,\n        forecastConfidence: warning?.confidence,\n        forecastCoverage: warning?.coverage,",
  'forecast confidence trong KPI index',
);

replaceOnce(
  "    totalKpis: data.summary.total,\n    overallHealth: health.overall,\n    healthBand: health.band,\n    healthDelta: health.deltaVsPrevious,",
  "    totalKpis: data.fields.reduce((sum, field) => sum + field.items.length, 0),\n    overallHealth: health.overall,\n    healthBand: health.band,\n    healthDelta: health.deltaVsPrevious,\n    healthCoverage: health.coverage,\n    healthConfidence: health.confidence,",
  'tracked KPI count và health quality',
);

text = text.replace(
  /\.filter\(\(row\) => row\.healthScore !== undefined\)/g,
  ".filter((row) => row.healthScore !== undefined && row.direction !== 'info' && (row.healthCoverage ?? 0) > 0)",
);

replaceOnce(
  ".filter((row) => row.warningRisk || row.healthBand === 'risk' || row.healthBand === 'watch')",
  ".filter((row) => row.direction !== 'info' && (row.healthCoverage ?? 0) > 0 && (row.warningRisk || row.healthBand === 'risk' || row.healthBand === 'watch'))",
  'lọc KPI info khỏi risk ranking',
);

replaceOnce(
  "    `Health Score: ${score(row.healthScore)} · ${healthBandLabel(row.healthBand)} · Xu hướng sức khỏe: ${healthTrendLabel(row.healthTrend)}.`,",
  "    `Health Score: ${score(row.healthScore)} · ${healthBandLabel(row.healthBand)} · Xu hướng sức khỏe: ${healthTrendLabel(row.healthTrend)} · độ phủ ${percent(row.healthCoverage)} · tin cậy ${row.healthConfidence ?? 'thấp'}.`,",
  'health quality trong câu trả lời KPI',
);

replaceOnce(
  "      `Forecast: ${row.forecastText ?? 'Đã có dự báo'}${row.projectedValue !== undefined ? ` · Giá trị dự phóng ${metric(row.projectedValue, row.unit)}` : ''}${row.projectedRatio !== undefined ? ` · Mức dự phóng ${percent(row.projectedRatio)}` : ''}.`,",
  "      `Forecast: ${row.forecastText ?? 'Đã có dự báo'}${row.projectedValue !== undefined ? ` · Giá trị dự phóng ${metric(row.projectedValue, row.unit)}` : ''}${row.projectedRatio !== undefined ? ` · Mức dự phóng ${percent(row.projectedRatio)}` : ''}${row.forecastCoverage !== undefined ? ` · độ phủ ${percent(row.forecastCoverage)}` : ''}.`,",
  'forecast coverage trong câu trả lời KPI',
);

replaceOnce(
  "    summary: `Health Score toàn đơn vị ${score(index.overallHealth)}. Có ${index.warnings.length} cảnh báo forecast và ${open.length} hành động đang mở.`,",
  "    summary: `Health Score toàn đơn vị ${score(index.overallHealth)} · độ phủ ${percent(index.healthCoverage)} · tin cậy ${index.healthConfidence ?? 'thấp'}. Có ${index.warnings.length} cảnh báo forecast và ${open.length} hành động đang mở.`,",
  'overview health quality',
);

replaceOnce(
  "        `${action.title} · owner ${action.owner} · ưu tiên ${action.priority} · trạng thái ${action.status} · tiến độ ${action.progress}%${action.dueDate ? ` · hạn ${action.dueDate}` : ''}.`,",
  "        `${action.title} · owner ${action.owner} · ưu tiên ${action.priority} · trạng thái ${action.status} · ${action.progressConfirmed ? `tiến độ ${action.progress}%` : 'tiến độ chưa xác nhận'}${action.dueDateConfirmed && action.dueDate ? ` · hạn ${action.dueDate}` : ' · chưa có hạn chính thức'}.`,",
  'action progress provenance',
);

replaceOnce(
  "        `Cập nhật ${action.title} trước ${action.dueDate ?? 'mốc giao ban kế tiếp'}.`,",
  "        action.dueDateConfirmed && action.dueDate ? `Cập nhật ${action.title} trước ${action.dueDate}.` : `Xác nhận tiến độ và thời hạn chính thức cho ${action.title}.`,",
  'không tự suy deadline trong AI',
);

if (text !== before) {
  fs.writeFileSync(file, text);
  console.log(`updated ${file}`);
} else {
  console.log(`${file} already stabilized`);
}
