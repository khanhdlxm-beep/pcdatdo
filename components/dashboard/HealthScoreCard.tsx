'use client';

import type { HealthModel } from '@/types/intelligence';
import { healthBandLabel } from '@/lib/health-score';

export default function HealthScoreCard({ model, onOpen }: { model: HealthModel; onOpen?: () => void }) {
  const delta = model.deltaVsPrevious;
  return (
    <button className={`healthScoreCard ${model.band}`} onClick={onOpen} type="button">
      <div>
        <small>Sức khỏe SXKD</small>
        <b>{healthBandLabel(model.band)}</b>
      </div>
      <strong>{model.overall.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}<em>/100</em></strong>
      <span className={delta === null ? 'neutral' : delta >= 0 ? 'up' : 'down'}>
        {delta === null ? 'Chưa đủ kỳ so sánh' : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} điểm`}
      </span>
      <i>›</i>
    </button>
  );
}
