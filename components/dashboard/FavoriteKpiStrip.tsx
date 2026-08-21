'use client';

import type { DashboardBootstrap } from '@/types/dashboard';
import type { HealthModel } from '@/types/intelligence';

export default function FavoriteKpiStrip({ data, favoriteKpis, health, openKpi }: {
  data: DashboardBootstrap;
  favoriteKpis: string[];
  health: HealthModel;
  openKpi: (domainId:string, kpiId:string)=>void;
}) {
  const rows = data.fields.flatMap((field) => field.items.filter((item) => favoriteKpis.includes(item.id)).map((item) => ({ field, item, health: health.kpis.find((row) => row.kpiId === item.id) }))).slice(0, 8);
  if (!rows.length) return null;
  return (
    <section className="favoriteKpiSection">
      <div className="sectionHeading compact"><div><b>★ KPI của tôi</b><small>Chạm để xem chi tiết</small></div></div>
      <div className="favoriteKpiRail">
        {rows.map(({ field, item, health: score }) => (
          <button key={item.id} className={`favoriteKpiCard ${item.tone}`} onClick={() => openKpi(field.id, item.id)}>
            <small>{field.title}</small>
            <b>{item.label}</b>
            <strong>{item.value}</strong>
            <span>{score ? `${score.score.toLocaleString('vi-VN',{maximumFractionDigits:0})}/100` : item.status ?? 'Theo dõi'}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
