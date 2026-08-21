'use client';

import { useMemo, useState } from 'react';
import type { DashboardBootstrap } from '@/types/dashboard';
import type { ActionItem, EarlyWarning, ExecutiveBrief, HealthModel } from '@/types/intelligence';
import type { WeatherBundle } from '@/types/weather';
import { answerExecutiveQuestion } from '@/lib/ai-local';
import { buildOperationsAdvice } from '@/lib/weather-advisor';

const quickQuestions = [
  'Vấn đề nào cần ưu tiên?',
  'KPI nào có nguy cơ cuối năm?',
  'Lĩnh vực nào yếu nhất?',
  'Đề xuất hành động tuần này',
  'Tóm tắt để giao ban',
];

export default function AiCommandCenter({ data, health, warnings, actions, brief, weather, goAlerts, goPlans }: {
  data:DashboardBootstrap;
  health:HealthModel;
  warnings:EarlyWarning[];
  actions:ActionItem[];
  brief:ExecutiveBrief;
  weather:WeatherBundle|null;
  goAlerts:()=>void;
  goPlans:()=>void;
}) {
  const [query,setQuery]=useState('');
  const [answer,setAnswer]=useState(()=>answerExecutiveQuestion('tóm tắt giao ban',data,health,warnings,actions,brief));
  const weatherAdvice=useMemo(()=>buildOperationsAdvice(data,weather).slice(0,3),[data,weather]);
  const ask=(text:string)=>{const next=text.trim(); if(!next)return; setQuery(next); setAnswer(answerExecutiveQuestion(next,data,health,warnings,actions,brief));};
  return <>
    <div className="pageTitle aiTitle"><div><small>Executive Intelligence</small><h2>✦ AI Điều hành</h2></div><span className="freeAiBadge">AI nội bộ · Free</span></div>
    <section className="aiHero">
      <div><small>Sức khỏe SXKD</small><strong>{health.overall.toLocaleString('vi-VN',{maximumFractionDigits:1})}<em>/100</em></strong></div>
      <p>{brief.summary}</p>
      <div className="aiHeroActions"><button onClick={goAlerts}>⚠ {warnings.length} cảnh báo sớm</button><button onClick={goPlans}>▣ {actions.filter((a)=>a.status!=='done').length} hành động mở</button></div>
    </section>
    <section className="aiBriefCard">
      <div className="aiSectionTitle"><b>Bản tin điều hành</b><small>{data.period}</small></div>
      <div className="aiBriefGrid"><div><span className="good">↑</span><b>Điểm tích cực</b>{brief.positives.slice(0,3).map((x)=><p key={x}>{x}</p>)}</div><div><span className="bad">!</span><b>Cần ưu tiên</b>{brief.priorities.slice(0,3).map((x)=><p key={x}>{x}</p>)}</div></div>
      {brief.earlyWarnings.length>0&&<div className="aiEarly"><b>🔮 Cảnh báo sớm</b>{brief.earlyWarnings.slice(0,3).map((x)=><p key={x}>{x}</p>)}</div>}
    </section>
    <section className="aiQuick"><div className="aiSectionTitle"><b>Hỏi nhanh</b><small>Không gọi API trả phí</small></div><div>{quickQuestions.map((q)=><button key={q} onClick={()=>ask(q)}>{q}</button>)}</div></section>
    <section className="aiAskBox"><textarea value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Hỏi AI về tình hình SXKD..." rows={2}/><button onClick={()=>ask(query)}>Phân tích</button></section>
    <section className="aiAnswer">
      <div className="aiSectionTitle"><b>{answer.title}</b><small>Phân tích từ dữ liệu đã nạp</small></div>
      <p className="aiAnswerSummary">{answer.summary}</p>
      <ul>{answer.bullets.map((item)=><li key={item}>{item}</li>)}</ul>
      {answer.suggestedActions.length>0&&<div className="aiSuggestions"><b>Hành động đề xuất</b>{answer.suggestedActions.map((item)=><p key={item}>→ {item}</p>)}</div>}
      <details><summary>Căn cứ dữ liệu</summary>{answer.evidence.map((item)=><p key={item}>{item}</p>)}</details>
    </section>
    {weatherAdvice.length>0&&<section className="aiWeather"><div className="aiSectionTitle"><b>☁ Thời tiết & điều hành</b><small>Gợi ý theo địa bàn</small></div>{weatherAdvice.map((item)=><p key={`${item.domain}-${item.text}`}>• {item.text}</p>)}</section>}
    <section className="aiDeepPlaceholder"><div><b>Phân tích sâu bằng AI API</b><small>Tùy chọn sau này · không tải khi chưa bật</small></div><button disabled>Chưa kích hoạt</button></section>
  </>;
}
