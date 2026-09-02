'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { DashboardBootstrap } from '@/types/dashboard';
import type { ActionItem, AiAnswer, EarlyWarning, ExecutiveBrief, HealthModel } from '@/types/intelligence';
import type { WeatherBundle } from '@/types/weather';
import { answerExecutiveQuestion, buildAiRuntimeIndex } from '@/lib/ai-local';
import { buildOperationsAdvice } from '@/lib/weather-advisor';
import { healthConfidenceLabel } from '@/lib/health-score';

const quickQuestions = [
  'Vấn đề nào cần ưu tiên?',
  'Top 5 KPI yếu nhất?',
  'KPI nào có nguy cơ cuối năm?',
  'KPI nào tốt nhất?',
  'Lĩnh vực nào yếu nhất?',
  'Xu hướng KPI so tháng trước?',
  'Bao nhiêu KPI đang rủi ro?',
  'Đề xuất hành động tuần này',
  'Tóm tắt để giao ban',
];

export default function AiCommandCenter({
  data,
  health,
  warnings,
  actions,
  brief,
  weather,
  goAlerts,
  goPlans,
}: {
  data: DashboardBootstrap;
  health: HealthModel;
  warnings: EarlyWarning[];
  actions: ActionItem[];
  brief: ExecutiveBrief;
  weather: WeatherBundle | null;
  goAlerts: () => void;
  goPlans: () => void;
}) {
  const aiIndex = useMemo(
    () => buildAiRuntimeIndex(data, health, warnings, actions, brief),
    [data, health, warnings, actions, brief],
  );

  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<AiAnswer>(() =>
    answerExecutiveQuestion('tóm tắt giao ban', aiIndex),
  );

  const weatherAdvice = useMemo(
    () => buildOperationsAdvice(data, weather).slice(0, 3),
    [data, weather],
  );

  useEffect(() => {
    setAnswer(answerExecutiveQuestion(query.trim() || 'tóm tắt giao ban', aiIndex));
    // Chỉ refresh tự động khi kỳ dữ liệu đổi. Các thay đổi action được dùng ở lần hỏi kế tiếp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.period]);

  const ask = (text: string) => {
    const next = text.trim();
    if (!next) return;
    setQuery(next);
    setAnswer(answerExecutiveQuestion(next, aiIndex));
  };

  return (
    <>
      <div className="pageTitle aiTitle">
        <div>
          <small>Local Analytics</small>
          <h2>✦ Trợ lý điều hành</h2>
        </div>
        <span className="freeAiBadge">Nội bộ · không gửi dữ liệu ra ngoài</span>
      </div>

      <section className="aiHero">
        <div>
          <small>Sức khỏe SXKD</small>
          <strong>
            {health.overall.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            <em>/100</em>
          </strong>
          <small>Độ phủ {health.coverage.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}% · tin cậy {healthConfidenceLabel(health.confidence).toLowerCase()}</small>
        </div>
        <p>{brief.summary}</p>
        <div className="aiHeroActions">
          <button type="button" onClick={goAlerts}>
            ⚠ {warnings.length} cảnh báo sớm
          </button>
          <button type="button" onClick={goPlans}>
            ▣ {actions.filter((action) => action.status !== 'done').length} hành động mở
          </button>
        </div>
      </section>

      <section className="aiBriefCard">
        <div className="aiSectionTitle">
          <b>Bản tin điều hành</b>
          <small>{data.period}</small>
        </div>
        <div className="aiBriefGrid">
          <div>
            <span className="good">↑</span>
            <b>Điểm tích cực</b>
            {brief.positives.slice(0, 3).map((text) => <p key={text}>{text}</p>)}
          </div>
          <div>
            <span className="bad">!</span>
            <b>Cần ưu tiên</b>
            {brief.priorities.slice(0, 3).map((text) => <p key={text}>{text}</p>)}
          </div>
        </div>
        {brief.earlyWarnings.length > 0 && (
          <div className="aiEarly">
            <b>🔮 Cảnh báo sớm</b>
            {brief.earlyWarnings.slice(0, 3).map((text) => <p key={text}>{text}</p>)}
          </div>
        )}
      </section>

      <section className="aiQuick">
        <div className="aiSectionTitle">
          <b>Hỏi nhanh</b>
          <small>Rule-based analytics · dùng dữ liệu Production đã nạp</small>
        </div>
        <div>
          {quickQuestions.map((question) => (
            <button type="button" key={question} onClick={() => ask(question)}>
              {question}
            </button>
          ))}
        </div>
      </section>

      <section className="aiAskBox">
        <textarea
          value={query}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setQuery(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              ask(query);
            }
          }}
          placeholder="Ví dụ: Doanh thu hiện thế nào? Top 5 KPI yếu nhất? KPI nào có nguy cơ cuối năm?"
          rows={2}
          aria-label="Câu hỏi phân tích điều hành"
        />
        <button
          type="button"
          onClick={() => ask(query)}
          disabled={!query.trim()}
          aria-label="Phân tích câu hỏi"
        >
          Phân tích
        </button>
      </section>

      <section className="aiAnswer" aria-live="polite">
        <div className="aiSectionTitle">
          <b>{answer.title}</b>
          <small>Phân tích từ dữ liệu đã nạp</small>
        </div>
        <p className="aiAnswerSummary">{answer.summary}</p>
        <ul>
          {answer.bullets.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
        </ul>
        {answer.suggestedActions.length > 0 && (
          <div className="aiSuggestions">
            <b>Hành động đề xuất</b>
            {answer.suggestedActions.map((item, index) => (
              <p key={`${index}-${item}`}>→ {item}</p>
            ))}
          </div>
        )}
        <details>
          <summary>Căn cứ dữ liệu</summary>
          {answer.evidence.map((item, index) => <p key={`${index}-${item}`}>{item}</p>)}
        </details>
      </section>

      {weatherAdvice.length > 0 && (
        <section className="aiWeather">
          <div className="aiSectionTitle">
            <b>☁ Thời tiết & điều hành</b>
            <small>Gợi ý theo địa bàn</small>
          </div>
          {weatherAdvice.map((item) => (
            <p key={`${item.domain}-${item.text}`}>• {item.text}</p>
          ))}
        </section>
      )}

      <section className="aiDeepPlaceholder">
        <div>
          <b>Phân tích sâu bằng AI API</b>
          <small>Tùy chọn sau này · chỉ bật khi có cơ chế bảo vệ dữ liệu phù hợp</small>
        </div>
        <button type="button" disabled>Chưa kích hoạt</button>
      </section>
    </>
  );
}
