'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { DashboardBootstrap, FieldGroup, KpiCard, MetricHistory, MetricHistoryPoint, Tone } from '@/types/dashboard';
import type { ActionItem, HealthModel } from '@/types/intelligence';
import type { WeatherBundle } from '@/types/weather';
import { buildOperationsAdvice, weatherAdviceForKpi } from '@/lib/weather-advisor';
import { buildHealthModel } from '@/lib/health-score';
import { buildEarlyWarnings } from '@/lib/forecast-v2';
import { buildExecutiveBrief } from '@/lib/executive-brief';
import { mergeActionState, seedActions } from '@/lib/action-engine';
import HealthScoreCard from '@/components/dashboard/HealthScoreCard';
import FavoriteKpiStrip from '@/components/dashboard/FavoriteKpiStrip';
import ActionCenter from '@/components/actions/ActionCenter';

const AiCommandCenter = dynamic(() => import('@/components/ai/AiCommandCenter'), {
  ssr: false,
  loading: () => <div className="aiLazyLoading"><span className="loader"/><b>Đang mở AI Điều hành…</b></div>,
});

type MainTab = 'home' | 'alerts' | 'ai' | 'plans';
type ViewState =
  | { kind: 'root' }
  | { kind: 'domain'; domainId: string }
  | { kind: 'kpi'; domainId: string; kpiId: string; returnTo: 'domain' | 'alerts' };
type DetailMode = 'compare' | 'ytd' | 'same' | 'range' | 'forecast';
type SheetState =
  | null
  | { kind: 'source' }
  | { kind: 'search' }
  | { kind: 'alert'; alertId: string }
  | { kind: 'advice'; domainId: string; kpiId: string }
  | { kind: 'kpi-plan'; domainId: string; kpiId: string }
  | { kind: 'weather' }
  | { kind: 'compare' }
  | { kind: 'health' }
  | { kind: 'action'; actionId: string };

type KpiPresentation = {
  primaryValue?: string;
  primaryScope?: string;
  comparison?: string;
  comparisonRatio?: number;
  comparisonRelation?: 'gte' | 'lte' | 'info';
  ytd?: string;
  plan?: string;
  samePeriod?: string;
  insight?: string[];
  advice?: string[];
};

type CustomPlan = {
  id: string;
  title: string;
  owner: string;
  sourceKpi: string;
  createdAt: string;
};

type RangeKind = 'month' | 'quarter' | 'half';
type RangeSelection = { kind:RangeKind; year:string; index:number };
type ComparisonSelection = { left:RangeSelection; right:RangeSelection };

const DEFAULT_COMPARE:ComparisonSelection = {
  left:{kind:'month',year:'2026',index:7},
  right:{kind:'month',year:'2025',index:7},
};


const navTabs: { id: MainTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Trang chủ', icon: '⌂' },
  { id: 'alerts', label: 'Cảnh báo', icon: '△' },
  { id: 'ai', label: 'AI', icon: '✦' },
  { id: 'plans', label: 'Kế hoạch', icon: '▣' },
];

const domainMeta: Record<string, { icon: string; subtitle: string }> = {
  'kinh-doanh': { icon: '↗', subtitle: 'Điện TP · Doanh thu · Giá bán · Tổn thất' },
  dvkh: { icon: '◌', subtitle: 'CRM · HĐMBĐ · Tiếp cận điện' },
  'do-xa': { icon: '⌁', subtitle: 'Khai báo · Kết nối · Hóa đơn' },
  'ky-thuat': { icon: '⚙', subtitle: 'Sự cố · SAIFI · SAIDI · MAIFI' },
  'dau-tu-tai-chinh': { icon: '▥', subtitle: 'ĐTXD · SCL · Tồn kho · Chi phí' },
  'nhan-su': { icon: '◇', subtitle: 'CBCNV · NSLĐ · Đào tạo · VHDN' },
};

function DomainIllustration({ id }: { id: string }) {
  if (id === 'kinh-doanh') return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><path d="M20 92V61m24 31V43m24 49V55m24 37V28"/><path d="M17 52 42 39l22 10 31-28"/><path d="m86 22 10-2-2 10"/></svg>
  );
  if (id === 'dvkh') return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="47" cy="43" r="16"/><path d="M18 94c3-22 15-34 29-34s26 12 29 34"/><circle cx="82" cy="51" r="11"/><path d="M73 91c2-15 10-24 20-24 5 0 9 2 13 6"/><path d="M73 26h27a10 10 0 0 1 10 10v11a10 10 0 0 1-10 10h-6l-9 9v-9H73a10 10 0 0 1-10-10V36a10 10 0 0 1 10-10Z"/></svg>
  );
  if (id === 'do-xa') return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="79" r="7"/><path d="M43 65a24 24 0 0 1 34 0M30 51a42 42 0 0 1 60 0M18 37a59 59 0 0 1 84 0"/><rect x="42" y="84" width="36" height="18" rx="5"/></svg>
  );
  if (id === 'ky-thuat') return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 18 44 99h32L60 18Z"/><path d="M49 46h22M45 66h30M41 86h38M33 99h54"/><path d="m23 44 17 8-14 10m71-18-17 8 14 10"/></svg>
  );
  if (id === 'dau-tu-tai-chinh') return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><path d="M21 98h78M29 98V55h18v43M53 98V36h18v62M77 98V22h18v76"/><path d="M24 42 49 30l18 6 28-22"/><circle cx="94" cy="16" r="8"/></svg>
  );
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="43" cy="42" r="15"/><circle cx="80" cy="47" r="12"/><path d="M18 97c3-24 13-37 25-37s23 13 26 37M63 97c2-19 9-30 20-30 8 0 15 7 19 20"/><path d="M49 22h30v20H49zM54 27h20M54 33h14"/></svg>
  );
}
const kpiPresentation: Record<string, KpiPresentation> = {
  KD_DTP: {
    primaryValue: '165,479 Tr.kWh', primaryScope: 'Tháng 7/2026', comparison: '123,11% KH tháng', comparisonRatio: 123.11, comparisonRelation: 'gte',
    ytd: '1.041,607 Tr.kWh', plan: 'KH năm 1.613 Tr.kWh',
    insight: ['Thực hiện tháng 7 được báo cáo đạt 123,11% kế hoạch tháng.', 'Lũy kế đến hết tháng 7 đạt 64,54% kế hoạch năm.'],
    advice: ['Theo dõi sản lượng theo thành phần phụ tải để nhận biết nhóm tăng/giảm mạnh.', 'Ưu tiên so sánh tháng kế tiếp với KH tháng và cùng kỳ khi dữ liệu lịch sử được nạp đủ.'],
  },
  KD_DT: {
    primaryValue: '376,54 tỷ', primaryScope: 'Tháng 7/2026', ytd: '2.361,42 tỷ', plan: 'KH năm 3.647,667 tỷ',
    insight: ['Doanh thu tháng 7 là 376,54 tỷ đồng.', 'Lũy kế đạt 64,73% kế hoạch năm.'],
    advice: ['Theo dõi đồng thời điện thương phẩm, giá bán bình quân và doanh thu để nhận diện nguyên nhân biến động.', 'Khi có KH tháng chuẩn hóa, bổ sung cảnh báo sớm nếu doanh thu thực hiện thấp hơn tiến độ.'],
  },
  KD_GIA: {
    primaryValue: '2.264,64 đ/kWh', primaryScope: 'Lũy kế/hiện trạng', comparison: 'Nguồn KH đang có sai khác', comparisonRelation: 'info', plan: 'BC tổng hợp: 2.259 đ/kWh',
    insight: ['Hai PDF đang thể hiện kế hoạch giá bán điện bình quân khác nhau.', 'App không tự chọn một nguồn làm đúng khi chưa được xác nhận.'],
    advice: ['Xác nhận nguồn kế hoạch ưu tiên trước khi dùng KPI này cho cảnh báo tự động.', 'Giữ lịch sử nguồn dữ liệu để truy vết khi hiệu chỉnh.'],
  },
  KD_TT: {
    primaryValue: '2,53%', primaryScope: 'Tháng 7/2026', comparison: 'KH ≤ 3,12%', comparisonRatio: 81.09, comparisonRelation: 'lte', ytd: '2,90%', plan: 'Ngưỡng kế hoạch ≤ 3,12%',
    insight: ['Tổn thất tháng 7 là 2,53%, thấp hơn ngưỡng 3,12%.', 'Lũy kế đến tháng 7 là 2,90%.'],
    advice: ['Tiếp tục theo dõi các phát tuyến/TBA có tổn thất cao.', 'Ưu tiên drill-down theo khu vực, trạm và nhóm khách hàng khi dữ liệu chi tiết được kết nối.'],
  },
  CRM: {
    primaryValue: '4.574 / 4.693', primaryScope: 'Xử lý trong tháng 7', comparison: '97,46% đã xử lý', comparisonRatio: 97.46, comparisonRelation: 'gte', ytd: 'Còn 119 đang xử lý',
    insight: ['Trong tháng có 4.693 yêu cầu, đã xử lý 4.574 và còn 119 đang xử lý.'],
    advice: ['Ưu tiên phân nhóm 119 yêu cầu còn tồn theo tuổi yêu cầu và mức độ ảnh hưởng.', 'Theo dõi riêng các yêu cầu gần quá hạn để xử lý trước.'],
  },
  GANMOI: {
    primaryValue: '710', primaryScope: 'Gắn mới điện kế tháng 7', ytd: 'Lũy kế 4.338', plan: 'Không có trường hợp quá hạn theo seed',
    insight: ['Tháng 7 ghi nhận 710 trường hợp gắn mới điện kế.'],
    advice: ['Tiếp tục kiểm soát thời gian xử lý bình quân và các hồ sơ có nguy cơ quá hạn.'],
  },
  HDMBD: {
    primaryValue: '2.092 / 8.081', primaryScope: 'Lũy kế ngoài sinh hoạt', comparison: '25,9% kế hoạch', comparisonRatio: 25.89, comparisonRelation: 'gte', plan: 'Hoàn thành kế hoạch',
    insight: ['HĐMBĐ ngoài sinh hoạt mới đạt khoảng 25,9% kế hoạch và được báo cáo đánh giá chưa đạt.'],
    advice: ['Phân nhóm HĐMBĐ theo thời gian hết hiệu lực và mức độ ưu tiên.', 'Theo dõi tiến độ xử lý theo đơn vị phụ trách thay vì chờ cuối kỳ.'],
  },
  TC_DN: {
    primaryValue: '2,57 ngày', primaryScope: 'Thời gian bình quân', comparison: 'Ngưỡng ≤ 3 ngày', comparisonRatio: 85.67, comparisonRelation: 'lte', ytd: '51 công trình lũy kế',
    insight: ['Thời gian bình quân 2,57 ngày đang thấp hơn ngưỡng 3 ngày.'],
    advice: ['Duy trì kiểm soát các hồ sơ có thời gian xử lý tiến gần ngưỡng 3 ngày.'],
  },
  DX_KB: {
    primaryValue: '99,50%', primaryScope: 'Hiện trạng khai báo', comparison: '220.767 / 221.867', comparisonRatio: 99.5, comparisonRelation: 'gte',
    insight: ['Tỷ lệ khai báo đạt 99,50%.'], advice: ['Theo dõi phần chưa khai báo còn lại theo hãng công tơ và đơn vị quản lý.'],
  },
  DX_KN: {
    primaryValue: '98,20%', primaryScope: 'Hiện trạng kết nối', comparison: '216.796 / 220.767', comparisonRatio: 98.2, comparisonRelation: 'gte', ytd: '3.678 điểm mất kết nối >48h',
    insight: ['Tỷ lệ kết nối đạt 98,20%.', 'Báo cáo ghi nhận 3.678 điểm mất kết nối trên 48 giờ.'],
    advice: ['Xếp hạng mất kết nối theo hãng công tơ và thời gian mất kết nối.', 'Theo dõi backlog >48h hằng ngày để tránh dồn xử lý cuối tháng.'],
  },
  DX_HD: {
    primaryValue: '98,23%', primaryScope: 'Khai thác hóa đơn', comparison: '203.494 điểm', comparisonRatio: 98.23, comparisonRelation: 'gte',
    insight: ['Tỷ lệ khai thác hóa đơn được báo cáo là 98,23%.'], advice: ['Đối chiếu điểm đã kết nối nhưng chưa khai thác hóa đơn để ưu tiên xử lý.'],
  },
  DX_MK: {
    primaryValue: '3.678', primaryScope: 'Điểm mất kết nối >48h', comparison: 'Cần xử lý', comparisonRelation: 'info',
    insight: ['Báo cáo ghi nhận 3.678 điểm đo mất kết nối trên 48 giờ.'],
    advice: ['Tách danh sách theo hãng công tơ, đơn vị và số giờ mất kết nối.', 'Ưu tiên nhóm mất kết nối lâu nhất và nhóm có ảnh hưởng đến khai thác hóa đơn.'],
  },
  KT_SC: {
    primaryValue: '15 vụ', primaryScope: 'Sự cố trung thế tháng 7', comparison: '79 vụ lũy kế / KH 7T ≤ 61,25', comparisonRatio: 128.98, comparisonRelation: 'lte', ytd: '79 vụ', plan: 'KH 7 tháng ≤ 61,25 vụ',
    insight: ['Tháng 7 phát sinh 15 sự cố trung thế.', 'Lũy kế 79 vụ vượt chỉ tiêu 7 tháng 61,25 vụ.', 'Trong tháng, sét chiếm 40%, động vật 26,67% và cây 20%.'],
    advice: ['Ưu tiên giải pháp vào ba nguyên nhân chiếm tỷ trọng lớn trong tháng: sét, động vật và cây.', 'Theo dõi sự cố lặp theo tuyến/TBA và đánh giá hiệu quả xử lý theo tuần.'],
  },
  SAIFI: {
    primaryValue: '0,2512 lần', primaryScope: 'Tháng 7/2026', comparison: 'Lũy kế 1,6288 / ngưỡng 7T 1,71', comparisonRatio: 95.25, comparisonRelation: 'lte', ytd: '1,6288 lần', plan: 'KH 7 tháng 1,71 lần',
    insight: ['SAIFI tháng 7 là 0,2512 lần.', 'Lũy kế 1,6288 lần đang thấp hơn ngưỡng 7 tháng 1,71 lần.'], advice: ['Duy trì theo dõi nguyên nhân sự cố gây mất điện để bảo vệ dư địa chỉ tiêu.'],
  },
  SAIDI: {
    primaryValue: '35,8221 phút', primaryScope: 'Tháng 7/2026', comparison: 'Lũy kế 199,9833 / ngưỡng 223,42', comparisonRatio: 89.51, comparisonRelation: 'lte', ytd: '199,9833 phút', plan: 'KH 7 tháng 223,42 phút',
    insight: ['SAIDI tháng 7 là 35,8221 phút.', 'Lũy kế đang ở 89,51% ngưỡng 7 tháng.'], advice: ['Ưu tiên giảm thời gian xử lý các sự cố kéo dài và đánh giá các tuyến có đóng góp SAIDI lớn.'],
  },
  MAIFI: {
    primaryValue: '0 lần', primaryScope: 'Tháng 7/2026', comparison: 'Lũy kế 0,0428 / ngưỡng 0,29', comparisonRatio: 14.76, comparisonRelation: 'lte', ytd: '0,0428 lần', plan: 'KH 7 tháng 0,29 lần',
    insight: ['MAIFI tháng 7 là 0 và lũy kế thấp hơn nhiều so với ngưỡng 7 tháng.'], advice: ['Duy trì giám sát để phát hiện sớm các dao động bất thường.'],
  },
  DTXD: {
    primaryValue: '97,064 tỷ', primaryScope: 'Lũy kế thực hiện', comparison: '34,3% KH năm', comparisonRatio: 34.3, comparisonRelation: 'gte', ytd: 'Giải ngân 47,482 tỷ · 16,8%', plan: 'KH năm 283,200 tỷ',
    insight: ['Giá trị thực hiện lũy kế đạt 34,3% kế hoạch năm.', 'Giải ngân lũy kế đạt 16,8% kế hoạch năm.'],
    advice: ['Theo dõi tiến độ theo từng dự án/gói việc thay vì chỉ nhìn tổng giá trị.', 'Thiết lập mốc kiểm soát theo tuần cho các hạng mục có nguy cơ chậm giải ngân.'],
  },
  SCL: {
    primaryValue: '29,712 tỷ', primaryScope: 'Lũy kế thực hiện', comparison: '81,03% KH', comparisonRatio: 81.03, comparisonRelation: 'gte', plan: 'KH 36,669 tỷ',
    insight: ['Giá trị thực hiện SCL đạt 81,03% kế hoạch nhưng phần tổng hợp vẫn đánh giá chưa đạt tiến độ.'], advice: ['Tách tiến độ theo công trình, nghiệm thu, thanh toán và quyết toán để xác định nút thắt.'],
  },
  TONKHO: {
    primaryValue: '16,069 tỷ', primaryScope: 'Hiện trạng tồn kho', comparison: '73% định mức', comparisonRatio: 73.71, comparisonRelation: 'lte', plan: 'Định mức 21,8 tỷ',
    insight: ['Tồn kho đang trong định mức tổng thể.'], advice: ['Theo dõi tuổi tồn và nhóm vật tư chậm luân chuyển để tránh phát sinh tồn kho kéo dài.'],
  },
  CHIPHI: {
    primaryValue: '19,38 đ/kWh', primaryScope: 'Chi phí thực hiện', comparison: 'KH 17,47 đ/kWh', comparisonRatio: 110.93, comparisonRelation: 'lte', plan: 'Vượt 1,91 đ/kWh',
    insight: ['Chi phí thực hiện cao hơn kế hoạch 1,91 đ/kWh.'], advice: ['Drill-down theo khoản mục chi phí để xác định nhóm vượt kế hoạch lớn nhất.', 'Theo dõi chênh lệch chi phí theo tháng khi chuỗi dữ liệu được bổ sung.'],
  },
  CBCNV: {
    primaryValue: '355', primaryScope: 'CBCNV hiện tại', comparison: '297 nam · 58 nữ', comparisonRelation: 'info', insight: ['Quy mô CBCNV được báo cáo là 355 người.'], advice: ['Dùng làm mẫu số chuẩn cho các chỉ tiêu năng suất lao động.'],
  },
  DT_GIO: {
    primaryValue: '41,69 giờ/LĐ', primaryScope: 'Lũy kế đào tạo', comparison: '104,23% KH', comparisonRatio: 104.23, comparisonRelation: 'gte', plan: 'KH ≥ 40 giờ/LĐ', insight: ['Giờ đào tạo bình quân đã vượt kế hoạch.'], advice: ['Duy trì chất lượng và cơ cấu đào tạo, không chỉ theo số giờ.'],
  },
  NSLD_KH: {
    primaryValue: '625 KH/CBCNV', primaryScope: 'Năng suất hiện tại', comparison: 'KH 637', comparisonRatio: 98.12, comparisonRelation: 'gte', plan: 'Chưa đạt', insight: ['Chỉ tiêu khách hàng/CBCNV chưa đạt kế hoạch.'], advice: ['Theo dõi đồng thời số khách hàng và biến động nhân sự để xác định nguyên nhân chênh lệch.'],
  },
  ATTT: {
    primaryValue: '100%', primaryScope: 'Thực hiện theo báo cáo', comparison: 'Đạt', comparisonRatio: 100, comparisonRelation: 'gte', insight: ['Chỉ tiêu ATTT được báo cáo đạt.'], advice: ['Tiếp tục duy trì diễn tập và phổ biến quy trình ứng cứu.'],
  },
};

const officialPlanByDomain: Record<string, string[]> = {
  'kinh-doanh': ['P1', 'P5'],
  dvkh: ['P5'],
  'do-xa': ['P1'],
  'ky-thuat': ['P2', 'P3'],
  'dau-tu-tai-chinh': ['P4'],
  'nhan-su': [],
};

const alertToKpi: Record<string, { domainId: string; kpiId?: string }> = {
  A_SC: { domainId: 'ky-thuat', kpiId: 'KT_SC' },
  A_BT: { domainId: 'kinh-doanh' },
  A_VP: { domainId: 'kinh-doanh' },
  A_DTXD: { domainId: 'dau-tu-tai-chinh', kpiId: 'DTXD' },
  A_SCL: { domainId: 'dau-tu-tai-chinh', kpiId: 'SCL' },
  A_HD: { domainId: 'dvkh', kpiId: 'HDMBD' },
  A_NS: { domainId: 'nhan-su', kpiId: 'NSLD_KH' },
};

function defaultCompareFor(period:string, available:string[] = []) : ComparisonSelection {
  const [year,monthText]=period.split('-');
  const month=Number(monthText);
  const priorYear=String(Number(year)-1);
  const prior=`${priorYear}-${monthText}`;
  if(available.includes(prior)) return {left:{kind:'month',year,index:month},right:{kind:'month',year:priorYear,index:month}};
  const previousMonth=month>1?month-1:month;
  return {left:{kind:'month',year,index:month},right:{kind:'month',year,index:previousMonth}};
}

function periodLabel(period: string) {
  const [year, month] = period.split('-');
  return `Tháng ${Number(month)}/${year}`;
}

function nextPeriodLabel(period: string) {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 1);
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
}

function toneLabel(tone: Tone, explicit?: string) {
  if (explicit) return explicit;
  if (tone === 'good') return 'Đạt';
  if (tone === 'bad') return 'Không đạt';
  if (tone === 'warn') return 'Theo dõi';
  return 'Thông tin';
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function metricFormat(history: MetricHistory, value: unknown, fallback = '—') {
  const numeric = numericValue(value);
  if (numeric === undefined) return fallback;
  const decimals = Number.isFinite(history.decimals) ? Math.max(0, history.decimals) : 2;
  const text = numeric.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals > 0 ? Math.min(decimals, 2) : 0,
    maximumFractionDigits: decimals,
  });
  return history.unit ? `${text} ${history.unit}` : text;
}

function historyPoint(data: DashboardBootstrap, kpiId: string, period = data.period) {
  const points = data.history?.[kpiId]?.points;
  return Array.isArray(points) ? points.find((point) => point.period === period) : undefined;
}

function previousYearPeriod(period: string) {
  const [year, month] = period.split('-');
  return `${Number(year) - 1}-${month}`;
}

function metricRatio(history: MetricHistory, point: MetricHistoryPoint) {
  const actual = numericValue(point.actual);
  const plan = numericValue(point.planMonth);
  if (actual === undefined || plan === undefined || plan === 0) return undefined;
  return actual / plan * 100;
}

function getPresentation(item: KpiCard, data?: DashboardBootstrap): KpiPresentation {
  const history = data?.history?.[item.id];
  const point = data && history ? historyPoint(data, item.id) : undefined;
  if (history && point && data) {
    const ratio = metricRatio(history, point);
    const same = historyPoint(data, item.id, previousYearPeriod(data.period));
    const sameChange = same && same.actual !== 0 ? (point.actual / same.actual - 1) * 100 : undefined;
    const year = data.period.slice(0, 4);
    const annualPlan = history.annualPlans?.[year];
    const relation = history.direction === 'lower' ? 'lte' : history.direction === 'higher' ? 'gte' : 'info';
    const compareText = history.direction === 'info'
      ? 'Thông tin kỳ báo cáo'
      : ratio !== undefined
        ? `${ratio.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% KH tháng`
        : 'Chưa có KH tháng';
    const insight = [
      `Thực hiện ${periodLabel(data.period).toLowerCase()}: ${metricFormat(history, point.actual)}; kế hoạch tháng: ${metricFormat(history, point.planMonth)}.`,
      history.aggregate === 'sum'
        ? `Lũy kế: ${metricFormat(history, point.ytd)} / KH lũy kế ${metricFormat(history, point.planYtd)}.`
        : `Giá trị lũy kế/hiện trạng: ${metricFormat(history, point.ytd)}.`,
    ];
    if (same && sameChange !== undefined) insight.push(`So cùng kỳ ${Number(year)-1}: ${sameChange >= 0 ? '+' : ''}${sameChange.toLocaleString('vi-VN',{maximumFractionDigits:1})}%.`);
    return {
      primaryValue: metricFormat(history, point.actual),
      primaryScope: periodLabel(data.period),
      comparison: compareText,
      comparisonRatio: ratio,
      comparisonRelation: relation,
      ytd: metricFormat(history, point.ytd),
      plan: `KH tháng ${metricFormat(history, point.planMonth)} · KH năm ${metricFormat(history, annualPlan)}`,
      samePeriod: same ? `${metricFormat(history, same.actual)} (${periodLabel(previousYearPeriod(data.period))})` : undefined,
      insight,
      advice: kpiPresentation[item.id]?.advice ?? ['Theo dõi chênh lệch TH/KH tháng và xu hướng các kỳ gần nhất.', 'Khi KPI lệch kế hoạch, ưu tiên xác định nguyên nhân theo lĩnh vực trước khi đưa vào kế hoạch hành động.'],
    };
  }
  return kpiPresentation[item.id] ?? {
    primaryValue: item.value,
    primaryScope: item.detail || 'Hiện trạng',
    comparison: item.status,
    ytd: item.detail,
    plan: item.plan,
    insight: [item.detail ? `${item.label}: ${item.detail}.` : `${item.label}: ${item.value}.`],
    advice: ['Tiếp tục theo dõi KPI theo kỳ báo cáo và đối chiếu kế hoạch khi dữ liệu mới được cập nhật.'],
  };
}

function miniProgressWidth(ratio?: number) {
  if (ratio === undefined || Number.isNaN(ratio)) return 0;
  return Math.max(4, Math.min(ratio, 110));
}

function statusToneClass(tone: Tone) {
  if (tone === 'bad') return 'danger';
  if (tone === 'warn') return 'warning';
  if (tone === 'good') return 'success';
  return 'neutral';
}

function forecastFor(history: MetricHistory, period: string) {
  const points = Array.isArray(history.points) ? history.points : [];
  const currentIndex = points.findIndex((point) => point.period === period);
  if (currentIndex < 0) return null;
  const window = points.slice(Math.max(0, currentIndex - 5), currentIndex + 1);
  if (window.length < 6) return null;
  const values = window.map((point) => numericValue(point.actual)).filter((value): value is number => value !== undefined);
  if (values.length < 6) return null;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;
  const [year, monthText] = period.split('-');
  const month = Number(monthText);
  const futureCount = Math.max(0, 12 - month);
  const future = Array.from({ length: futureCount }, (_, offset) => Math.max(0, intercept + slope * (n + offset)));
  const current = points[currentIndex];
  const yearActual = points.filter((point) => point.period.startsWith(year) && Number(point.period.slice(5)) <= month).map((point) => numericValue(point.actual)).filter((value): value is number => value !== undefined);
  let yearEnd: number;
  const currentYtd = numericValue(current.ytd);
  if (history.aggregate === 'sum') yearEnd = (currentYtd ?? yearActual.reduce((a, b) => a + b, 0)) + future.reduce((a, b) => a + b, 0);
  else if (history.aggregate === 'avg') yearEnd = [...yearActual, ...future].reduce((a, b) => a + b, 0) / Math.max(1, yearActual.length + future.length);
  else yearEnd = future.length ? future[future.length - 1] : (numericValue(current.actual) ?? 0);
  const nextMonth = future[0] ?? numericValue(current.actual) ?? 0;
  const annualPlan = history.annualPlans?.[year];
  return {
    future,
    nextMonth,
    yearEnd,
    annualPlan,
    confidence: currentIndex >= 11 ? 'Cao' : 'Trung bình',
  };
}

function smoothChartPath(values: number[], x: (index: number) => number, y: (value: number) => number) {
  const segments: { index: number; value: number }[][] = [];
  let active: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (Number.isFinite(value)) active.push({ index, value });
    else if (active.length) { segments.push(active); active = []; }
  });
  if (active.length) segments.push(active);
  return segments.map((segment) => {
    if (segment.length === 1) return `M ${x(segment[0].index)} ${y(segment[0].value)}`;
    let d = `M ${x(segment[0].index)} ${y(segment[0].value)}`;
    for (let i = 1; i < segment.length; i += 1) {
      const prev = segment[i - 1];
      const current = segment[i];
      const x0 = x(prev.index); const y0 = y(prev.value);
      const x1 = x(current.index); const y1 = y(current.value);
      const midX = (x0 + x1) / 2;
      d += ` C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }).join(' ');
}

function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function niceAxisScale(values: number[], includeZero = false) {
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
}

function performanceDelta(history: MetricHistory, actual?: number, plan?: number) {
  if (actual === undefined || plan === undefined || plan === 0) return undefined;
  const raw = (actual / plan - 1) * 100;
  return history.direction === 'lower' ? -raw : raw;
}

function changeDelta(current?: number, base?: number) {
  if (current === undefined || base === undefined || base === 0) return undefined;
  return (current / base - 1) * 100;
}

function compactPercent(value?: number, signed = false) {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

function MonthDetailPanel({ history, index, year, actual, plan, sameDelta, label = 'Chi tiết tháng', close }: {
  history: MetricHistory;
  index: number;
  year: string;
  actual?: number;
  plan?: number;
  sameDelta?: number;
  label?: string;
  close?: () => void;
}) {
  const ratio = actual !== undefined && plan !== undefined && plan !== 0 ? actual / plan * 100 : undefined;
  return <div className="chartMobileDetail" role="status" aria-live="polite">
    <div className="chartMobileDetailHead"><div><b>{`T${index + 1}/${year}`}</b><span>{label}</span></div>{close && <button type="button" onClick={close} aria-label="Đóng chi tiết tháng">×</button>}</div>
    <div className="chartMobileDetailGrid">
      <div><small>TH</small><b>{metricFormat(history, actual)}</b></div>
      <div><small>KH</small><b>{metricFormat(history, plan)}</b></div>
      <div><small>TH/KH</small><b>{compactPercent(ratio)}</b></div>
      <div><small>Cùng kỳ</small><b>{compactPercent(sameDelta, true)}</b></div>
    </div>
  </div>;
}

function ChartMiniInsight({ history, current, priorMonth, priorYear }: { history: MetricHistory; current?: MetricHistoryPoint; priorMonth?: MetricHistoryPoint; priorYear?: MetricHistoryPoint }) {
  const actual = numericValue(current?.actual);
  const plan = numericValue(current?.planMonth);
  const planGap = performanceDelta(history, actual, plan);
  const mom = changeDelta(actual, numericValue(priorMonth?.actual));
  const yoy = changeDelta(actual, numericValue(priorYear?.actual));
  const planClass = planGap === undefined ? 'neutral' : planGap >= 0 ? 'good' : 'risk';
  const changeClass = (value?: number) => value === undefined ? 'neutral' : value >= 0 ? 'good' : 'risk';
  return <div className="chartMiniInsight" aria-label="Tóm tắt biến động">
    <span className={planClass}>{planGap === undefined ? 'KH: —' : `${planGap >= 0 ? '✓' : '⚠'} ${Math.abs(planGap).toLocaleString('vi-VN',{maximumFractionDigits:1})}% so KH`}</span>
    <span className={changeClass(yoy)}>{yoy === undefined ? 'Cùng kỳ: —' : `${yoy >= 0 ? '↑' : '↓'} ${Math.abs(yoy).toLocaleString('vi-VN',{maximumFractionDigits:1})}% cùng kỳ`}</span>
    <span className={changeClass(mom)}>{mom === undefined ? 'Tháng trước: —' : `${mom >= 0 ? '↑' : '↓'} ${Math.abs(mom).toLocaleString('vi-VN',{maximumFractionDigits:1})}% tháng trước`}</span>
  </div>;
}

function HistoryChart({ data, kpiId, mode }: { data: DashboardBootstrap; kpiId: string; mode: 'ytd' | 'forecast' }) {
  const history = data.history?.[kpiId];
  if (!history) return <div className="lockedPanel"><span>⌁</span><b>Chưa có dữ liệu biểu đồ</b></div>;
  const year = data.period.slice(0, 4);
  const month = Number(data.period.slice(5));
  const historyPoints = Array.isArray(history.points) ? history.points : [];
  const slots = useMemo(() => Array.from({ length: 12 }, (_, index) => historyPoints.find((point) => point.period === `${year}-${String(index + 1).padStart(2, '0')}`)), [historyPoints, year]);
  const priorSlots = useMemo(() => Array.from({ length: 12 }, (_, index) => historyPoints.find((point) => point.period === `${Number(year) - 1}-${String(index + 1).padStart(2, '0')}`)), [historyPoints, year]);
  const forecast = useMemo(() => forecastFor(history, data.period), [history, data.period]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  useEffect(() => { setSelectedIndex(null); setHoveredIndex(null); }, [data.period, kpiId, mode]);
  const activeIndex = selectedIndex ?? hoveredIndex;

  const actualValues = slots.map((point, index) => index < month ? (numericValue(mode === 'ytd' ? point?.ytd : point?.actual) ?? NaN) : NaN);
  const planValues = slots.map((point) => numericValue(mode === 'ytd' ? point?.planYtd : point?.planMonth) ?? NaN);
  const forecastValues = slots.map((point, index) => {
    if (mode !== 'forecast') return NaN;
    if (index < month - 1) return NaN;
    if (index === month - 1) return numericValue(point?.actual) ?? NaN;
    return forecast?.future[index - month] ?? NaN;
  });
  const all = [...actualValues, ...planValues, ...forecastValues].filter(Number.isFinite) as number[];
  if (!all.length) return <div className="lockedPanel"><span>⌁</span><b>Chưa có dữ liệu biểu đồ</b><p>Hãy chọn kỳ có dữ liệu lịch sử.</p></div>;

  const axis = niceAxisScale(all);
  const { min, max, step, ticks: gridValues } = axis;
  const span = Math.max(max - min, step || 1);
  const plotLeft = 50, plotRight = 374, plotTop = 24, plotBottom = 132;
  const x = (index: number) => plotLeft + index * ((plotRight - plotLeft) / 11);
  const y = (value: number) => plotBottom - ((value - min) / span) * (plotBottom - plotTop);
  const actualPath = smoothChartPath(actualValues, x, y), planPath = smoothChartPath(planValues, x, y), forecastPath = smoothChartPath(forecastValues, x, y);
  const detailIndex = activeIndex;
  const selectedPoint = detailIndex === null ? undefined : slots[detailIndex];
  const selectedPrior = detailIndex === null ? undefined : priorSlots[detailIndex];
  const selectedActual = numericValue(mode === 'ytd' ? selectedPoint?.ytd : selectedPoint?.actual);
  const selectedPlan = numericValue(mode === 'ytd' ? selectedPoint?.planYtd : selectedPoint?.planMonth);
  const selectedPriorActual = numericValue(selectedPrior?.actual);
  const ratio = selectedActual !== undefined && selectedPlan !== undefined && selectedPlan !== 0 ? selectedActual / selectedPlan * 100 : undefined;
  const sameDelta = changeDelta(selectedActual, selectedPriorActual);
  const hasDetail = detailIndex !== null && (selectedActual !== undefined || selectedPlan !== undefined || selectedPriorActual !== undefined);
  const detailValue = selectedActual ?? selectedPlan;
  const detailX = detailIndex === null ? x(Math.max(0, month - 1)) : x(detailIndex);
  const detailY = detailValue === undefined ? plotBottom : y(detailValue);
  const pin = (index: number) => setSelectedIndex((current) => current === index ? null : index);
  return <div className="historyChartWrap interactiveChartWrap" onMouseLeave={() => setHoveredIndex(null)}>
    <div className="chartUnitLabel">Đơn vị: <b>{history.unit || 'Giá trị'}</b></div>
    <svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ ${mode === 'ytd' ? 'lũy kế' : 'dự báo'} ${kpiId}`}>
      <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} className="chartPlotDismiss" onPointerDown={() => setSelectedIndex(null)} />
      {gridValues.map((value, index) => <g key={`${value}-${index}`}><line x1={plotLeft} y1={y(value)} x2={plotRight} y2={y(value)} className={`chartGrid chartGrid${index}`} /><text x={plotLeft - 7} y={y(value) + 3.5} textAnchor="end" className="chartAxisLabel">{axisLabel(value, step)}</text></g>)}
      <path d={planPath} className="chartPlan"/><path d={actualPath} className="chartActual"/>{mode === 'forecast' && forecast && <path d={forecastPath} className="chartForecast"/>}
      {slots.map((point,index)=>{const av=numericValue(mode==='ytd'?point?.ytd:point?.actual);const prev=index>0?slots[index-1]:undefined;if(index>=month||av===undefined||!isAnomalyPoint(history,point,prev))return null;return <g key={`anomaly-${index}`} className="chartAnomaly"><circle cx={x(index)} cy={y(av)} r="7"/><text x={x(index)} y={y(av)+3} textAnchor="middle">!</text></g>})}
      {slots.map((point,index)=>{const value=numericValue(mode === 'ytd' ? point?.ytd : point?.actual) ?? numericValue(mode === 'ytd' ? point?.planYtd : point?.planMonth);if(value===undefined)return null;return <circle key={index} cx={x(index)} cy={y(value)} r="14" className="chartTouchPoint" onPointerDown={(event)=>{event.stopPropagation();pin(index)}} onMouseEnter={()=>{if(selectedIndex===null)setHoveredIndex(index)}}/>})}
      {hasDetail && detailValue !== undefined && <g className="chartSelectedAnchor"><line x1={detailX} y1={detailY} x2={detailX} y2={plotBottom} className="chartCurrentGuide"/><circle cx={detailX} cy={detailY} r="5" className="chartAnchor"/></g>}
      {Array.from({length:12},(_,index)=><text key={index} x={x(index)} y="151" textAnchor="middle" className={index===activeIndex?'chartLabel current':index===month-1?'chartLabel currentPeriod':'chartLabel'} onPointerDown={(event)=>{event.stopPropagation();if(slots[index])pin(index)}} onMouseEnter={()=>{if(slots[index]&&selectedIndex===null)setHoveredIndex(index)}}>{`T${index+1}`}</text>)}
    </svg>
    {hasDetail && detailIndex !== null && <div className="chartFloatingPopup"><div><b>{`T${detailIndex+1}/${year}`}</b><span>{mode==='ytd'?'Lũy kế':'Dự báo'}</span></div><dl><div><dt>TH</dt><dd>{metricFormat(history,selectedActual)}</dd></div><div><dt>KH</dt><dd>{metricFormat(history,selectedPlan)}</dd></div><div><dt>TH/KH</dt><dd>{compactPercent(ratio)}</dd></div><div><dt>Cùng kỳ</dt><dd>{compactPercent(sameDelta,true)}</dd></div></dl></div>}
    {selectedIndex !== null && hasDetail && <MonthDetailPanel history={history} index={selectedIndex} year={year} actual={selectedActual} plan={selectedPlan} sameDelta={sameDelta} label={mode==='ytd'?'Lũy kế':'Dự báo'} close={()=>setSelectedIndex(null)}/>}
    <div className="chartLegend"><span className="actual">TH</span><span className="plan">KH</span>{mode==='forecast'&&<span className="forecast">Dự báo</span>}<small>ⓘ Chạm hoặc kéo theo tháng</small></div>
  </div>;
}

function MonthlyActualTargetChart({ data, kpiId }: { data: DashboardBootstrap; kpiId: string }) {
  const history = data.history?.[kpiId];
  if (!history) return <div className="lockedPanel"><span>▥</span><b>Chưa có dữ liệu biểu đồ</b></div>;
  const year = data.period.slice(0,4), month = Number(data.period.slice(5));
  const source = Array.isArray(history.points) ? history.points : [];
  const points = useMemo(()=>Array.from({length:12},(_,i)=>source.find((p)=>p.period===`${year}-${String(i+1).padStart(2,'0')}`)),[source,year]);
  const prior = useMemo(()=>Array.from({length:12},(_,i)=>source.find((p)=>p.period===`${Number(year)-1}-${String(i+1).padStart(2,'0')}`)),[source,year]);
  const values = points.flatMap((p)=>[numericValue(p?.actual),numericValue(p?.planMonth)]).filter((v):v is number=>v!==undefined);
  if(!values.length) return <div className="lockedPanel"><span>▥</span><b>Chưa có dữ liệu biểu đồ</b></div>;
  const axis=niceAxisScale(values);
  const {min,max,step,ticks:grid}=axis;
  const span=Math.max(max-min,step||1);
  const plotLeft=50,plotRight=374,plotTop=24,plotBottom=132;
  const x=(i:number)=>plotLeft+i*((plotRight-plotLeft)/11), y=(v:number)=>plotBottom-((v-min)/span)*(plotBottom-plotTop);
  const [selected,setSelected]=useState<number|null>(null), [hovered,setHovered]=useState<number|null>(null);
  useEffect(()=>{setSelected(null);setHovered(null)},[data.period,kpiId]);
  const active=selected??hovered;
  const choose=(index:number,sticky=false)=>{const valid=Math.max(0,Math.min(11,index));if(sticky)setSelected(valid);else if(selected===null)setHovered(valid)};
  const pick=(event: { clientX:number; currentTarget: SVGRectElement })=>{const rect=event.currentTarget.getBoundingClientRect();const ratio=(event.clientX-rect.left)/Math.max(rect.width,1);return Math.max(0,Math.min(11,Math.round(ratio*11)))};
  const chosen=active===null?undefined:points[active], actual=numericValue(chosen?.actual), plan=numericValue(chosen?.planMonth), priorActual=numericValue(active===null?undefined:prior[active]?.actual);
  const ratio=actual!==undefined&&plan!==undefined&&plan!==0?actual/plan*100:undefined, sameDelta=changeDelta(actual,priorActual), hasDetail=active!==null&&(actual!==undefined||plan!==undefined);
  const currentIndex=Math.max(0,month-1), current=points[currentIndex], previous=currentIndex>0?points[currentIndex-1]:undefined, previousYear=prior[currentIndex];
  const barWidth=15;
  return <div className="historyChartWrap interactiveChartWrap adaptiveMonthlyChart" onMouseLeave={()=>setHovered(null)}>
    <div className="chartUnitLabel">Đơn vị: <b>{history.unit||'Giá trị'}</b></div>
    <svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label={`Biểu đồ cột thực hiện và mốc kế hoạch ${kpiId}`}>
      {grid.map((v,i)=><g key={i}><line x1={plotLeft} x2={plotRight} y1={y(v)} y2={y(v)} className={`chartGrid chartGrid${i}`}/><text x={plotLeft-7} y={y(v)+3.5} textAnchor="end" className="chartAxisLabel">{axisLabel(v,step)}</text></g>)}
      {points.map((point,i)=>{const av=numericValue(point?.actual),pv=numericValue(point?.planMonth),cx=x(i),showActual=i<month&&av!==undefined;return <g key={i} className={`monthlyBarGroup ${active===i?'active':''}`}>
        {showActual&&<rect x={cx-barWidth/2} y={y(av!)} width={barWidth} height={Math.max(1,plotBottom-y(av!))} rx="4" className="monthlyActualBar"/>}
        {pv!==undefined&&<line x1={cx-10} x2={cx+10} y1={y(pv)} y2={y(pv)} className="monthlyPlanTarget"/>}
        {i===currentIndex&&showActual&&<circle cx={cx} cy={y(av!)} r="3.5" className="currentBarAnchor"/>}
        {showActual&&isAnomalyPoint(history,point,i>0?points[i-1]:undefined)&&<text x={cx} y={Math.max(plotTop+7,y(av!)-7)} textAnchor="middle" className="chartAnomalyMark">!</text>}
        <text x={cx} y="151" textAnchor="middle" className={active===i?'chartLabel current':i===currentIndex?'chartLabel currentPeriod':'chartLabel'}>{`T${i+1}`}</text>
      </g>})}
      <rect x={plotLeft-12} y={plotTop} width={plotRight-plotLeft+24} height={plotBottom-plotTop+24} className="chartScrubberLayer"
        onPointerDown={(event)=>{event.currentTarget.setPointerCapture?.(event.pointerId);choose(pick(event),true)}}
        onPointerMove={(event)=>{if(event.pointerType==='mouse'&&event.buttons===0)choose(pick(event),false);else if(event.buttons!==0||event.pointerType==='touch')choose(pick(event),true)}}
      />
      {active!==null&&<line x1={x(active)} x2={x(active)} y1={plotTop} y2={plotBottom} className="chartCurrentGuide"/>}
    </svg>
    {hasDetail&&active!==null&&<div className="chartFloatingPopup"><div><b>{`T${active+1}/${year}`}</b><span>TH tháng & mốc KH</span></div><dl><div><dt>TH</dt><dd>{metricFormat(history,actual)}</dd></div><div><dt>KH</dt><dd>{metricFormat(history,plan)}</dd></div><div><dt>TH/KH</dt><dd>{compactPercent(ratio)}</dd></div><div><dt>Cùng kỳ</dt><dd>{compactPercent(sameDelta,true)}</dd></div></dl></div>}
    {selected!==null&&hasDetail&&<MonthDetailPanel history={history} index={selected} year={year} actual={actual} plan={plan} sameDelta={sameDelta} close={()=>setSelected(null)}/>}
    <ChartMiniInsight history={history} current={current} priorMonth={previous} priorYear={previousYear}/>
    <div className="chartLegend"><span className="actual bar">TH</span><span className="plan target">KH</span><small>ⓘ Chạm/kéo T1–T12 để xem</small></div>
  </div>;
}

function SamePeriodColumnsChart({ data, kpiId }: { data: DashboardBootstrap; kpiId: string }) {
  const history=data.history?.[kpiId];
  if(!history) return <div className="lockedPanel"><span>↔</span><b>Chưa có dữ liệu cùng kỳ</b></div>;
  const year=data.period.slice(0,4), month=Number(data.period.slice(5)), source=Array.isArray(history.points)?history.points:[];
  const current=useMemo(()=>Array.from({length:12},(_,i)=>source.find((p)=>p.period===`${year}-${String(i+1).padStart(2,'0')}`)),[source,year]);
  const prior=useMemo(()=>Array.from({length:12},(_,i)=>source.find((p)=>p.period===`${Number(year)-1}-${String(i+1).padStart(2,'0')}`)),[source,year]);
  const values=[...current,...prior].flatMap((p)=>numericValue(p?.actual)===undefined?[]:[numericValue(p?.actual)!]);
  if(!values.length)return <div className="lockedPanel"><span>↔</span><b>Chưa có dữ liệu cùng kỳ</b></div>;
  const axis=niceAxisScale(values,true);
  const {max,step,ticks:grid}=axis;
  const plotLeft=50,plotRight=374,plotTop=24,plotBottom=132, x=(i:number)=>plotLeft+i*((plotRight-plotLeft)/11),y=(v:number)=>plotBottom-(v/max)*(plotBottom-plotTop);
  const [selected,setSelected]=useState<number|null>(null),[hovered,setHovered]=useState<number|null>(null);useEffect(()=>{setSelected(null);setHovered(null)},[data.period,kpiId]);const active=selected??hovered;
  const pick=(event:{clientX:number;currentTarget:SVGRectElement})=>{const rect=event.currentTarget.getBoundingClientRect();return Math.max(0,Math.min(11,Math.round(((event.clientX-rect.left)/Math.max(rect.width,1))*11)))};
  const ca=numericValue(active===null?undefined:current[active]?.actual),pa=numericValue(active===null?undefined:prior[active]?.actual),delta=changeDelta(ca,pa),hasDetail=active!==null&&(ca!==undefined||pa!==undefined);
  return <div className="historyChartWrap interactiveChartWrap samePeriodColumns" onMouseLeave={()=>setHovered(null)}>
    <div className="chartUnitLabel">Đơn vị: <b>{history.unit||'Giá trị'}</b></div><svg className="historyChart" viewBox="0 0 390 158" role="img" aria-label="Biểu đồ cột cùng kỳ">
      {grid.map((v,i)=><g key={i}><line x1={plotLeft} x2={plotRight} y1={y(v)} y2={y(v)} className={`chartGrid chartGrid${i}`}/><text x={plotLeft-7} y={y(v)+3.5} textAnchor="end" className="chartAxisLabel">{axisLabel(v,step)}</text></g>)}
      {current.map((point,i)=>{const cv=numericValue(point?.actual),pv=numericValue(prior[i]?.actual),cx=x(i);return <g key={i}>{pv!==undefined&&<rect x={cx-11} y={y(pv)} width="9" height={plotBottom-y(pv)} rx="3" className="samePriorBar"/>}{i<month&&cv!==undefined&&<rect x={cx+2} y={y(cv)} width="9" height={plotBottom-y(cv)} rx="3" className="sameCurrentBar"/>}<text x={cx} y="151" textAnchor="middle" className={active===i?'chartLabel current':i===month-1?'chartLabel currentPeriod':'chartLabel'}>{`T${i+1}`}</text></g>})}
      <rect x={plotLeft-12} y={plotTop} width={plotRight-plotLeft+24} height={plotBottom-plotTop+24} className="chartScrubberLayer" onPointerDown={(event)=>{event.currentTarget.setPointerCapture?.(event.pointerId);setSelected(pick(event))}} onPointerMove={(event)=>{const idx=pick(event);if(event.pointerType==='mouse'&&event.buttons===0&&selected===null)setHovered(idx);else if(event.buttons!==0||event.pointerType==='touch')setSelected(idx)}}/>
      {active!==null&&<line x1={x(active)} x2={x(active)} y1={plotTop} y2={plotBottom} className="chartCurrentGuide"/>}
    </svg>
    {hasDetail&&active!==null&&<div className="chartFloatingPopup"><div><b>{`T${active+1}`}</b><span>So cùng kỳ</span></div><dl><div><dt>{year}</dt><dd>{metricFormat(history,ca)}</dd></div><div><dt>{Number(year)-1}</dt><dd>{metricFormat(history,pa)}</dd></div><div><dt>Chênh lệch</dt><dd>{compactPercent(delta,true)}</dd></div></dl></div>}
    {selected!==null&&hasDetail&&<div className="chartMobileDetail"><div className="chartMobileDetailHead"><div><b>{`T${selected+1}`}</b><span>So sánh cùng kỳ</span></div><button onClick={()=>setSelected(null)} aria-label="Đóng">×</button></div><div className="chartMobileDetailGrid"><div><small>{year}</small><b>{metricFormat(history,ca)}</b></div><div><small>{Number(year)-1}</small><b>{metricFormat(history,pa)}</b></div><div><small>Chênh lệch</small><b>{compactPercent(delta,true)}</b></div></div></div>}
    <div className="chartLegend"><span className="currentYear">{year}</span><span className="priorYear">{Number(year)-1}</span><small>ⓘ Chạm/kéo tháng để đối chiếu</small></div>
  </div>;
}

function chartKindFor(kpiId:string, history:MetricHistory) {
  if (kpiId === 'KT_SC') return 'pareto';
  if (history.aggregate === 'snapshot' && ['CRM','DX_KB','DX_KN','DX_HD','ATTT','NSLD_KH'].includes(kpiId)) return 'gauge';
  if (history.aggregate === 'snapshot' && history.direction === 'lower') return 'threshold';
  return 'monthly';
}

function GaugeChart({ history, point }: { history:MetricHistory; point:MetricHistoryPoint }) {
  const actual = numericValue(point.actual), plan = numericValue(point.planMonth);
  const [open,setOpen]=useState(false);
  if (actual === undefined) return <div className="lockedPanel"><span>◌</span><b>Chưa có dữ liệu thực hiện</b></div>;
  const rawRatio = plan && plan !== 0 ? actual / plan * 100 : 100;
  const score = history.direction === 'lower' && plan !== undefined ? Math.min(100, plan / Math.max(actual,.00001) * 100) : Math.min(100, rawRatio);
  const radius = 42, circumference = 2*Math.PI*radius;
  return <div className="adaptiveGauge interactiveSnapshot" onClick={()=>setOpen((v)=>!v)} role="button" tabIndex={0}><svg viewBox="0 0 120 120" role="img" aria-label="Biểu đồ tỷ lệ hoàn thành"><circle cx="60" cy="60" r={radius} className="gaugeTrack"/><circle cx="60" cy="60" r={radius} className="gaugeValue" strokeDasharray={`${circumference*score/100} ${circumference}`}/><text x="60" y="56" textAnchor="middle" className="gaugeMain">{rawRatio.toLocaleString('vi-VN',{maximumFractionDigits:1})}%</text><text x="60" y="72" textAnchor="middle" className="gaugeSub">TH / KH tháng</text></svg><div className="gaugeFacts"><span><small>Thực hiện</small><b>{metricFormat(history,actual)}</b></span><span><small>Kế hoạch</small><b>{metricFormat(history,plan)}</b></span></div>{open&&<div className="snapshotPopup"><b>Chi tiết chỉ tiêu</b><span>TH: {metricFormat(history,actual)}</span><span>KH: {metricFormat(history,plan)}</span><span>Tỷ lệ: {rawRatio.toLocaleString('vi-VN',{maximumFractionDigits:1})}%</span></div>}</div>;
}

function ThresholdChart({ history, point }: { history:MetricHistory; point:MetricHistoryPoint }) {
  const actual=numericValue(point.actual),plan=numericValue(point.planMonth);const[open,setOpen]=useState(false);if(actual===undefined)return <div className="lockedPanel"><span>—</span><b>Chưa có dữ liệu thực hiện</b></div>;const max=Math.max(actual,plan??0,1)*1.25,actualWidth=Math.min(100,actual/max*100),planLeft=plan===undefined?undefined:Math.min(100,plan/max*100),good=plan===undefined?true:history.direction==='lower'?actual<=plan:actual>=plan;
  return <div className="thresholdChart interactiveSnapshot" onClick={()=>setOpen((v)=>!v)} role="button" tabIndex={0}><div className="thresholdLabels"><span><small>TH</small><b>{metricFormat(history,actual)}</b></span><span><small>Ngưỡng/KH</small><b>{metricFormat(history,plan)}</b></span></div><div className="thresholdTrack"><span className={good?'good':'risk'} style={{width:`${actualWidth}%`}}/>{planLeft!==undefined&&<i style={{left:`${planLeft}%`}}/>}</div><small>{history.direction==='lower'?'Vạch đứng là mức tối đa/khuyến nghị':'Vạch đứng là kế hoạch cần đạt'} · Chạm để xem chi tiết</small>{open&&<div className="snapshotPopup"><b>{good?'Đang trong ngưỡng':'Cần chú ý'}</b><span>TH: {metricFormat(history,actual)}</span><span>KH/ngưỡng: {metricFormat(history,plan)}</span></div>}</div>;
}

function ParetoIncidentChart({ data }: { data:DashboardBootstrap }) {
  const causes=Array.isArray(data.incidentCauses)?data.incidentCauses:[];const[selected,setSelected]=useState(0);if(!causes.length)return <div className="lockedPanel"><span>≡</span><b>Chưa có cơ cấu nguyên nhân sự cố</b></div>;const max=Math.max(...causes.map((x)=>numericValue(x.monthShare)??0),1),picked=causes[Math.min(selected,causes.length-1)];return <div className="paretoChart interactivePareto"><div className="paretoTitle">Cơ cấu nguyên nhân sự cố tháng <small>· chạm thanh để xem chi tiết</small></div>{causes.slice(0,5).map((cause,i)=><button className={`paretoRow ${selected===i?'active':''}`} key={cause.label} onClick={()=>setSelected(i)}><span>{cause.label}</span><div><i style={{width:`${(numericValue(cause.monthShare)??0)/max*100}%`}}/></div><b>{metricFormat({id:'incident',unit:'%',direction:'info',aggregate:'snapshot',decimals:1,annualPlans:{},points:[]},cause.monthShare)}</b></button>)}<div className="paretoPopup"><b>{picked.label}</b><span>Tháng: {picked.monthValue} vụ · {picked.monthShare}%</span><span>Lũy kế: {picked.ytdValue} vụ · {picked.ytdShare}%</span></div></div>;
}

function AdaptiveCurrentChart({ data, kpiId }: { data:DashboardBootstrap; kpiId:string }) {
  const history=data.history?.[kpiId],point=historyPoint(data,kpiId);if(!history||!point)return null;const kind=chartKindFor(kpiId,history);if(kind==='pareto')return <ParetoIncidentChart data={data}/>;if(kind==='gauge')return <GaugeChart history={history} point={point}/>;if(kind==='threshold')return <ThresholdChart history={history} point={point}/>;return <MonthlyActualTargetChart data={data} kpiId={kpiId}/>;
}

function rangeMonths(selection:RangeSelection) {
  if(selection.kind==='month') return [selection.index];
  if(selection.kind==='quarter') { const start=(selection.index-1)*3+1; return [start,start+1,start+2]; }
  const start=selection.index===1?1:7;
  return Array.from({length:6},(_,i)=>start+i);
}
function rangeLabel(selection:RangeSelection) {
  if(selection.kind==='month') return `T${selection.index}/${selection.year}`;
  if(selection.kind==='quarter') return `Quý ${selection.index}/${selection.year}`;
  return `6T ${selection.index===1?'đầu':'cuối'}/${selection.year}`;
}
function rangeValue(history:MetricHistory, selection:RangeSelection) {
  const months=rangeMonths(selection);
  const source=Array.isArray(history.points)?history.points:[];
  const points=months.map((month)=>source.find((p)=>p.period===`${selection.year}-${String(month).padStart(2,'0')}`)).filter(Boolean) as MetricHistoryPoint[];
  const actualValues=points.map((p)=>numericValue(p.actual)).filter((value): value is number => value !== undefined);
  if(!actualValues.length) return null;
  const planValues=points.map((p)=>numericValue(p.planMonth)).filter((value): value is number => value !== undefined);
  const actual=history.aggregate==='sum'?actualValues.reduce((a,b)=>a+b,0):history.aggregate==='avg'?actualValues.reduce((a,b)=>a+b,0)/actualValues.length:actualValues[actualValues.length-1];
  const plan=planValues.length?(history.aggregate==='sum'?planValues.reduce((a,b)=>a+b,0):history.aggregate==='avg'?planValues.reduce((a,b)=>a+b,0)/planValues.length:planValues[planValues.length-1]):undefined;
  return {actual,plan,ratio:plan&&plan!==0?actual/plan*100:undefined};
}

function RangeComparisonPanel({ data, kpiId, comparison, edit }: { data:DashboardBootstrap; kpiId:string; comparison:ComparisonSelection; edit:()=>void }) {
  const history=data.history?.[kpiId];
  if(!history) return <div className="lockedPanel"><span>↔</span><b>Chưa có dữ liệu lịch sử</b></div>;
  const left=rangeValue(history,comparison.left), right=rangeValue(history,comparison.right);
  if(!left||!right) return <div className="lockedPanel"><span>↔</span><b>Kỳ so sánh chưa có dữ liệu</b><button onClick={edit}>Đổi bộ lọc</button></div>;
  const max=Math.max(left.actual,right.actual,1);
  const delta=right.actual?((left.actual/right.actual)-1)*100:0;
  const improvement=history.direction==='lower'?-delta:delta;
  return <div className="rangeComparePanel">
    <div className="rangeCompareHead"><div><b>So sánh kỳ tùy chọn</b><small>Tháng · Quý · 6 tháng</small></div><button onClick={edit}>⚙ Bộ lọc</button></div>
    <div className="rangePair">
      <article><small>{rangeLabel(comparison.left)}</small><b>{metricFormat(history,left.actual)}</b><em>{left.ratio===undefined?'Chưa có KH':`${left.ratio.toLocaleString('vi-VN',{maximumFractionDigits:1})}% KH`}</em><div><i style={{width:`${left.actual/max*100}%`}}/></div></article>
      <article><small>{rangeLabel(comparison.right)}</small><b>{metricFormat(history,right.actual)}</b><em>{right.ratio===undefined?'Chưa có KH':`${right.ratio.toLocaleString('vi-VN',{maximumFractionDigits:1})}% KH`}</em><div><i style={{width:`${right.actual/max*100}%`}}/></div></article>
    </div>
    <div className={`compareConclusion ${improvement>=0?'compareGood':'compareRisk'}`}><b>{improvement>=0?'▲ Xu hướng tích cực':'▼ Cần chú ý'}</b><span>{rangeLabel(comparison.left)} {delta>=0?'cao hơn':'thấp hơn'} {Math.abs(delta).toLocaleString('vi-VN',{maximumFractionDigits:1})}% so với {rangeLabel(comparison.right)}{history.direction==='lower'?' · KPI này giảm là tích cực':''}.</span></div>
  </div>;
}

function SamePeriodPanel({ data, kpiId }: { data: DashboardBootstrap; kpiId: string }) {
  const history = data.history?.[kpiId];
  const current = historyPoint(data, kpiId);
  const same = historyPoint(data, kpiId, previousYearPeriod(data.period));
  if (!history || !current || !same) return <div className="lockedPanel"><span>↔</span><b>Chưa có dữ liệu cùng kỳ</b></div>;
  const change = same.actual ? (current.actual / same.actual - 1) * 100 : 0;
  return (
    <>
      <div className="samePeriodPair">
        <div><small>{periodLabel(previousYearPeriod(data.period))}</small><b>{metricFormat(history, same.actual)}</b></div>
        <span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toLocaleString('vi-VN',{maximumFractionDigits:1})}%</span>
        <div><small>{periodLabel(data.period)}</small><b>{metricFormat(history, current.actual)}</b></div>
      </div>
      <SamePeriodColumnsChart data={data} kpiId={kpiId} />
    </>
  );
}

function ForecastPanel({ data, kpiId }: { data: DashboardBootstrap; kpiId: string }) {
  const history = data.history?.[kpiId];
  if (!history) return <div className="lockedPanel"><span>⌁</span><b>Chưa có dữ liệu lịch sử</b></div>;
  const forecast = forecastFor(history, data.period);
  if (!forecast) return <div className="lockedPanel"><span>⌁</span><b>Chưa đủ dữ liệu để dự báo</b><p>Cần tối thiểu 6 kỳ liên tiếp.</p></div>;
  const annualPlan = forecast.annualPlan;
  const directionGood = annualPlan === undefined
    ? undefined
    : history.direction === 'lower'
      ? forecast.yearEnd <= annualPlan
      : history.direction === 'higher'
        ? forecast.yearEnd >= annualPlan
        : true;
  return (
    <>
      <HistoryChart data={data} kpiId={kpiId} mode="forecast" />
      <div className="forecastStats">
        <div><small>Tháng kế tiếp</small><b>{metricFormat(history, forecast.nextMonth)}</b></div>
        <div><small>Dự báo cuối năm</small><b>{metricFormat(history, forecast.yearEnd)}</b></div>
        <div className={directionGood === undefined ? 'neutral' : directionGood ? 'good' : 'risk'}><small>Khả năng đạt KH</small><b>{directionGood === undefined ? 'Chưa có KH năm' : directionGood ? 'Có khả năng đạt' : 'Có nguy cơ không đạt'}</b><em>Độ tin cậy: {forecast.confidence}</em></div>
      </div>
      <p className="forecastNote">Dự báo DEMO dùng xu hướng tuyến tính 6 kỳ gần nhất để kiểm thử giao diện; không phải số liệu chính thức.</p>
    </>
  );
}

function downloadSnapshot(data: DashboardBootstrap) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dieu-hanh-sxkd-${data.period}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function FavoriteButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`favoriteBtn ${active ? 'active' : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={label}
    >
      {active ? '★' : '☆'}
    </button>
  );
}

function CompactHeader({ data, openSource, openWeather, exportData, onPeriodChange, periodLoading, weather }: { data: DashboardBootstrap; openSource: () => void; openWeather: () => void; exportData: () => void; onPeriodChange: (period: string) => void; periodLoading: boolean; weather:WeatherBundle | null }) {
  const periods = data.availablePeriods ?? [data.period];
  const years = Array.from(new Set(periods.map((period)=>period.slice(0,4)))).sort();
  const selectedYear = data.period.slice(0,4);
  const selectedMonth = Number(data.period.slice(5));
  const months = periods.filter((period)=>period.startsWith(`${selectedYear}-`)).map((period)=>Number(period.slice(5)));
  const changeYear = (year:string) => {
    const preferred = `${year}-${String(selectedMonth).padStart(2,'0')}`;
    const candidates = periods.filter((period)=>period.startsWith(`${year}-`));
    onPeriodChange(periods.includes(preferred) ? preferred : candidates[candidates.length-1] ?? data.period);
  };
  const weatherClass = weather?.ok ? weather.overallRisk : 'off';
  return (
    <header className="compactHeader">
      <div className="headerBrand">✦ EVN</div>
      <h1>Điều hành SXKD{data.dataMode === 'demo' && <em className="demoChip">DEMO</em>}</h1>
      <div className="headerActions">
        <div className={`periodGroup ${periodLoading ? 'loading' : ''}`} title="Chọn năm và tháng báo cáo">
          <select value={selectedYear} onChange={(e)=>changeYear(e.target.value)} aria-label="Chọn năm" disabled={periodLoading}>
            {years.map((year)=><option key={year} value={year}>{year}</option>)}
          </select>
          <span>/</span>
          <select value={selectedMonth} onChange={(e)=>onPeriodChange(`${selectedYear}-${String(e.target.value).padStart(2,'0')}`)} aria-label="Chọn tháng" disabled={periodLoading}>
            {months.map((month)=><option key={month} value={month}>T{month}</option>)}
          </select>
        </div>
        <a className="iconBtn importBtn" href="/pdf-import" aria-label="Nhập báo cáo PDF" title="Nhập báo cáo PDF">⇧</a>
        <button className={`iconBtn weatherBtn ${weatherClass}`} onClick={openWeather} aria-label="Thời tiết và gợi ý điều hành" title="Thời tiết & gợi ý">☁</button>
        <button className="iconBtn" onClick={openSource} aria-label="Nguồn dữ liệu" title="Nguồn dữ liệu">ⓘ</button>
        <button className="iconBtn exportBtn" onClick={exportData} aria-label="Xuất dữ liệu" title="Xuất dữ liệu">⇩</button>
      </div>
    </header>
  );
}

function SummaryCompact({ data }: { data: DashboardBootstrap }) {
  const total = Math.max(data.summary.total, 1);
  const pass = data.summary.pass / total * 100;
  const partial = data.summary.partial / total * 100;
  const fail = data.summary.fail / total * 100;
  return (
    <section className="summaryCompact" aria-label="Tóm tắt KPI">
      <div className="summaryNumbers">
        <span><b>{data.summary.total}</b><small>Tổng</small></span>
        <span className="success"><b>{data.summary.pass}</b><small>Đạt</small></span>
        <span className="warning"><b>{data.summary.partial}</b><small>Một phần</small></span>
        <span className="danger"><b>{data.summary.fail}</b><small>Không đạt</small></span>
      </div>
      <div className="segmentedBar" aria-hidden="true">
        <i className="segPass" style={{ width: `${pass}%` }} />
        <i className="segPartial" style={{ width: `${partial}%` }} />
        <i className="segFail" style={{ width: `${fail}%` }} />
      </div>
    </section>
  );
}

type TrendSignal = 'improve' | 'stable' | 'worsen' | 'none';

function previousMonthPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function trendSignalForKpi(data: DashboardBootstrap, kpiId: string): TrendSignal {
  const history = data.history?.[kpiId];
  if (!history) return 'none';
  const current = historyPoint(data, kpiId);
  const previous = historyPoint(data, kpiId, previousMonthPeriod(data.period));
  const actual = numericValue(current?.actual), plan = numericValue(current?.planMonth);
  const prevActual = numericValue(previous?.actual), prevPlan = numericValue(previous?.planMonth);
  if (actual === undefined || prevActual === undefined) return 'none';
  const score = (a: number, p?: number) => {
    if (p !== undefined && p !== 0) return history.direction === 'lower' ? p / Math.max(a, .000001) : a / p;
    if (history.direction === 'lower') return 1 / Math.max(a, .000001);
    if (history.direction === 'higher') return a;
    return 1;
  };
  const nowScore = score(actual, plan), prevScore = score(prevActual, prevPlan);
  if (!Number.isFinite(nowScore) || !Number.isFinite(prevScore) || prevScore === 0) return 'none';
  const delta = (nowScore / prevScore - 1) * 100;
  if (delta > 1.5) return 'improve';
  if (delta < -1.5) return 'worsen';
  return 'stable';
}

function domainTrendSignal(data: DashboardBootstrap, field: FieldGroup): TrendSignal {
  const signals = field.items.map((item) => trendSignalForKpi(data, item.id)).filter((signal) => signal !== 'none');
  if (!signals.length) return 'none';
  const improve = signals.filter((signal) => signal === 'improve').length;
  const worsen = signals.filter((signal) => signal === 'worsen').length;
  if (worsen > improve) return 'worsen';
  if (improve > worsen) return 'improve';
  return 'stable';
}

function isAnomalyPoint(history: MetricHistory, current?: MetricHistoryPoint, previous?: MetricHistoryPoint) {
  const actual = numericValue(current?.actual), prev = numericValue(previous?.actual);
  if (actual === undefined || prev === undefined || prev === 0) return false;
  const change = Math.abs((actual / prev - 1) * 100);
  const threshold = history.unit === '%' ? 5 : history.aggregate === 'snapshot' ? 8 : 12;
  return change >= threshold;
}

const domainDifficultyDefaults: Record<string, string[]> = {
  'kinh-doanh': [
    'Biến động phụ tải, cơ cấu khách hàng và thời tiết có thể làm kết quả tháng thay đổi nhanh.',
    'Cần duy trì dữ liệu kế hoạch tháng và cùng kỳ nhất quán để đánh giá chênh lệch chính xác.',
  ],
  dvkh: [
    'Khối lượng yêu cầu dồn theo thời điểm và hồ sơ tồn có thể ảnh hưởng tỷ lệ hoàn thành.',
    'Một số trường hợp cần phối hợp nhiều bộ phận nên thời gian xử lý có thể kéo dài.',
  ],
  'do-xa': [
    'Chất lượng đường truyền, thiết bị đầu cuối và dữ liệu đo xa không đồng đều giữa các điểm đo.',
    'Các điểm mất kết nối kéo dài cần được phân nhóm để xử lý đúng nguyên nhân.',
  ],
  'ky-thuat': [
    'Sự cố đột xuất, điều kiện vận hành và thời tiết có thể làm chỉ tiêu biến động nhanh.',
    'Cần ưu tiên các khu vực có xu hướng bất thường để tránh dồn khối lượng xử lý cuối kỳ.',
  ],
  'dau-tu-tai-chinh': [
    'Thủ tục, vật tư, tiến độ nhà thầu và phối hợp hiện trường là các điểm nghẽn cần theo dõi.',
    'Tiến độ giải ngân và khối lượng thực hiện có thể lệch nhau nếu hồ sơ nghiệm thu chưa đồng bộ.',
  ],
  'nhan-su': [
    'Phân bổ nhân lực, lịch công tác và đào tạo chồng lấn có thể ảnh hưởng tiến độ thực hiện.',
    'Cần theo dõi tải công việc giữa các nhóm để hạn chế mất cân đối nguồn lực.',
  ],
};

function kpiDifficulties(data: DashboardBootstrap, domainId: string, item: KpiCard, presentation: KpiPresentation) {
  const directAlerts = data.alerts
    .filter((alert) => alert.kpiId === item.id)
    .map((alert) => `${alert.title}${alert.note ? `: ${alert.note}` : ''}`);
  const dynamic: string[] = [];
  if (!presentation.plan && !item.plan) dynamic.push('Chưa có đầy đủ kế hoạch/ngưỡng chuẩn hóa cho KPI này nên khả năng đối chiếu còn hạn chế.');
  if (item.tone === 'bad' || item.tone === 'warn') dynamic.push('Kết quả hiện tại đang cần theo dõi sát so với kế hoạch/ngưỡng để xử lý sớm chênh lệch.');
  const history = data.history?.[item.id];
  if (history) {
    const year = data.period.slice(0, 4);
    const month = Number(data.period.slice(5));
    const points = Array.isArray(history.points) ? history.points.filter((point) => point.period.startsWith(`${year}-`)) : [];
    const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
    const anomalyCount = sorted.reduce((count, point, index) => {
      if (index === 0 || Number(point.period.slice(5)) > month) return count;
      return count + (isAnomalyPoint(history, point, sorted[index - 1]) ? 1 : 0);
    }, 0);
    if (anomalyCount > 0) dynamic.push(`Có ${anomalyCount} tháng biến động đáng chú ý trong chuỗi dữ liệu hiện tại; cần kiểm tra nguyên nhân trước khi kết luận xu hướng.`);
  }
  return [...new Set([...directAlerts, ...dynamic, ...(domainDifficultyDefaults[domainId] ?? ['Cần tiếp tục theo dõi các yếu tố vận hành có thể ảnh hưởng kết quả KPI.'])])].slice(0, 3);
}

function DomainTile({ field, favorite, toggleFavorite, open, alertCount, alertTone, trend }: { field: FieldGroup; favorite: boolean; toggleFavorite: () => void; open: () => void; alertCount: number; alertTone: 'danger' | 'warning' | 'none'; trend: TrendSignal }) {
  const meta = domainMeta[field.id] ?? { icon: '▦', subtitle: 'Nhóm chỉ tiêu' };
  return (
    <article className={`domainTile domain-${field.id}`} onClick={open} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
      <div className="domainTileTop">
        <span className="domainTileIcon">{meta.icon}</span>
        <div className="domainTileControls">
          {alertCount > 0 && <span className={`domainAlertBadge ${alertTone}`} title={`${alertCount} cảnh báo cần chú ý`}>{alertCount}</span>}
          <FavoriteButton active={favorite} onClick={toggleFavorite} label={`Ưu tiên ${field.title}`} />
        </div>
      </div>
      <div className="domainTileArt"><DomainIllustration id={field.id} /></div>
      <div className="domainTileText">
        <h2>{field.title}</h2>
        <p>{meta.subtitle}</p>
        {trend !== 'none' && <span className={`domainTrend ${trend}`}>{trend === 'improve' ? '↑ Cải thiện' : trend === 'worsen' ? '↓ Cần chú ý' : '→ Ổn định'}</span>}
      </div>
      <span className="domainArrow">›</span>
    </article>
  );
}

function HomeTab({ data, favoriteDomains, favoriteKpis, health, earlyWarnings, toggleDomainFavorite, openDomain, openKpi, openSearch, goAlerts, openHealth }: {
  data: DashboardBootstrap;
  favoriteDomains: string[];
  favoriteKpis: string[];
  health: HealthModel;
  earlyWarnings: ReturnType<typeof buildEarlyWarnings>;
  toggleDomainFavorite: (id: string) => void;
  openDomain: (id: string) => void;
  openKpi: (domainId:string,kpiId:string)=>void;
  openSearch: () => void;
  goAlerts: () => void;
  openHealth: () => void;
}) {
  const homeModel = useMemo(() => {
    const alertMap = new Map<string, { count: number; tone: 'danger' | 'warning' | 'none' }>();
    data.fields.forEach((field) => {
      const rows = data.alerts.filter((alert) => (alert.domainId === field.id || alert.domain === field.title) && (alert.severity === 'red' || alert.severity === 'yellow'));
      alertMap.set(field.id, { count: rows.length, tone: rows.some((alert) => alert.severity === 'red') ? 'danger' : rows.length ? 'warning' : 'none' });
    });
    const trendMap = new Map(data.fields.map((field) => [field.id, domainTrendSignal(data, field)]));
    const allSignals = data.fields.flatMap((field) => field.items.map((item) => trendSignalForKpi(data, item.id))).filter((signal) => signal !== 'none');
    return {
      alertMap,
      trendMap,
      pulse: {
        improve: allSignals.filter((signal) => signal === 'improve').length,
        stable: allSignals.filter((signal) => signal === 'stable').length,
        worsen: allSignals.filter((signal) => signal === 'worsen').length,
      },
      activeAlerts: data.alerts.filter((alert) => alert.severity === 'red' || alert.severity === 'yellow').length,
    };
  }, [data]);
  const ordered = useMemo(() => [...data.fields].sort((a, b) => Number(favoriteDomains.includes(b.id)) - Number(favoriteDomains.includes(a.id))), [data.fields, favoriteDomains]);
  const activeAlerts = homeModel.activeAlerts;
  return (
    <>
      <HealthScoreCard model={health} onOpen={openHealth} />
      <section className="executivePulse" aria-label="Nhịp điều hành">
        <div><small>Nhịp điều hành</small><b>Xu hướng so tháng trước</b></div>
        <span className="improve">↑ {homeModel.pulse.improve} cải thiện</span>
        <span className="stable">→ {homeModel.pulse.stable} ổn định</span>
        <button className="worsen" onClick={goAlerts}>↓ {homeModel.pulse.worsen} xấu đi</button>
      </section>
      <button className="compactAlertShortcut homeAlertShortcut" onClick={goAlerts}>
        <span>⚠</span>
        <div><b>{activeAlerts} vấn đề cần chú ý</b><small>Chạm để xem cảnh báo tháng hiện tại</small></div>
        <i>›</i>
      </button>
      {earlyWarnings.length > 0 && <button className="earlyWarningShortcut" onClick={goAlerts}><span>🔮</span><div><b>{earlyWarnings.length} KPI có nguy cơ sớm</b><small>{earlyWarnings[0]?.label}: {earlyWarnings[0]?.forecastText}</small></div><i>›</i></button>}
      <FavoriteKpiStrip data={data} favoriteKpis={favoriteKpis} health={health} openKpi={openKpi} />
      <div className="sectionHeading compact">
        <div><b>Lĩnh vực</b><small>Chọn lĩnh vực để xem KPI tháng hiện tại</small></div>
        <button className="searchIcon" onClick={openSearch} aria-label="Tìm kiếm">⌕</button>
      </div>
      <div className="domainGridV15">
        {ordered.map((field) => {
          const alertInfo = homeModel.alertMap.get(field.id) ?? { count: 0, tone: 'none' as const };
          return <DomainTile key={field.id} field={field} favorite={favoriteDomains.includes(field.id)} toggleFavorite={() => toggleDomainFavorite(field.id)} open={() => openDomain(field.id)} alertCount={alertInfo.count} alertTone={alertInfo.tone} trend={homeModel.trendMap.get(field.id) ?? 'none'} />;
        })}
      </div>
    </>
  );
}

function KpiRow({ data, item, favorite, toggleFavorite, open }: { data: DashboardBootstrap; item: KpiCard; favorite: boolean; toggleFavorite: () => void; open: () => void }) {
  const p = getPresentation(item, data);
  const ratio = p.comparisonRatio;
  const toneClass = statusToneClass(item.tone);
  return (
    <article className="kpiLine" onClick={open} role="button" tabIndex={0}>
      <div className="kpiLineMain">
        <div className="kpiNameLine">
          <b>{item.label}</b>
          <FavoriteButton active={favorite} onClick={toggleFavorite} label={`Yêu thích ${item.label}`} />
        </div>
        <small>{p.primaryValue ?? item.value}{p.comparison ? ` · ${p.comparison}` : ''}</small>
      </div>
      <div className="miniProgress" aria-hidden="true">
        {ratio !== undefined ? <span className={toneClass} style={{ width: `${miniProgressWidth(ratio)}%` }} /> : <span className={`${toneClass} noRatio`} />}
      </div>
      <div className={`kpiLineRight ${toneClass}`}>
        {ratio !== undefined ? <strong>{ratio.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</strong> : <strong>{toneLabel(item.tone, item.status)}</strong>}
        <i>›</i>
      </div>
    </article>
  );
}

function DomainDetail({ data, domainId, favoriteKpis, toggleKpiFavorite, back, openKpi }: {
  data: DashboardBootstrap;
  domainId: string;
  favoriteKpis: string[];
  toggleKpiFavorite: (id: string) => void;
  back: () => void;
  openKpi: (domainId: string, kpiId: string) => void;
}) {
  const field = data.fields.find((x) => x.id === domainId);
  const [filter, setFilter] = useState<'all' | 'attention' | 'favorite'>('all');
  if (!field) return null;
  const visible = field.items
    .filter((item) => filter === 'all' || (filter === 'attention' && ['bad', 'warn'].includes(item.tone)) || (filter === 'favorite' && favoriteKpis.includes(item.id)))
    .sort((a, b) => Number(favoriteKpis.includes(b.id)) - Number(favoriteKpis.includes(a.id)));
  return (
    <>
      <div className="drillCompactHeader">
        <button onClick={back} aria-label="Quay lại">‹</button>
        <div><small>Lĩnh vực</small><h2>{field.title}</h2></div>
      </div>
      <div className="pillTabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button>
        <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Cần chú ý</button>
        <button className={filter === 'favorite' ? 'active' : ''} onClick={() => setFilter('favorite')}>★ Yêu thích</button>
      </div>
      <section className="kpiListCompact">
        {visible.map((item) => (
          <KpiRow
            key={item.id}
            data={data}
            item={item}
            favorite={favoriteKpis.includes(item.id)}
            toggleFavorite={() => toggleKpiFavorite(item.id)}
            open={() => openKpi(field.id, item.id)}
          />
        ))}
        {!visible.length && <div className="emptyState">Chưa có KPI phù hợp bộ lọc.</div>}
      </section>
      <div className="domainDetailHint"><span>✓</span><p><b>Không lặp nội dung.</b> Cảnh báo xem tại tab Cảnh báo; kế hoạch hành động xem tại tab Kế hoạch.</p></div>
    </>
  );
}

function KpiDetail({ data, domainId, kpiId, favoriteKpis, toggleKpiFavorite, back, openAdvice, openPlanDetail, comparison, openCompare, weather }: {
  data: DashboardBootstrap;
  domainId: string;
  kpiId: string;
  favoriteKpis: string[];
  toggleKpiFavorite: (id: string) => void;
  back: () => void;
  openAdvice: () => void;
  openPlanDetail: () => void;
  comparison:ComparisonSelection;
  openCompare:()=>void;
  weather:WeatherBundle | null;
}) {
  const field = data.fields.find((x) => x.id === domainId);
  const item = field?.items.find((x) => x.id === kpiId);
  const [mode, setMode] = useState<DetailMode>('compare');
  const [focusChart, setFocusChart] = useState(false);
  useEffect(() => { setFocusChart(false); }, [kpiId, mode]);
  if (!field || !item) return null;
  const p = getPresentation(item, data);
  const planIds = officialPlanByDomain[domainId] ?? [];
  const official = data.plans.filter((plan) => planIds.includes(plan.id));
  const weatherTips = weatherAdviceForKpi(domainId,kpiId,weather);
  const difficulties = kpiDifficulties(data, domainId, item, p);
  return (
    <>
      <div className="drillCompactHeader kpi">
        <button onClick={back} aria-label="Quay lại">‹</button>
        <div><small>{field.title}</small><h2>{item.label}</h2></div>
        <FavoriteButton active={favoriteKpis.includes(item.id)} onClick={() => toggleKpiFavorite(item.id)} label={`Yêu thích ${item.label}`} />
      </div>
      <section className="kpiFirstFold">
        <small>{p.primaryScope ?? periodLabel(data.period)}</small>
        <strong>{p.primaryValue ?? item.value}</strong>
        <div className="kpiFirstMeta">
          <span>{p.comparison ?? toneLabel(item.tone, item.status)}</span>
        </div>
      </section>
      <div className="detailControlRow">
        <div className="pillTabs detailModeTabs">
          <button className={mode === 'compare' ? 'active' : ''} onClick={() => setMode('compare')}>Trong tháng</button>
          <button className={mode === 'ytd' ? 'active' : ''} onClick={() => setMode('ytd')}>Lũy kế</button>
          <button className={mode === 'same' ? 'active' : ''} onClick={() => setMode('same')}>Cùng kỳ</button>
          <button className={mode === 'forecast' ? 'active' : ''} onClick={() => setMode('forecast')}>Dự báo</button>
        </div>
        <button className={`compareFilterBtn ${mode === 'range' ? 'active' : ''}`} onClick={() => { setMode('range'); openCompare(); }}>⇄ So sánh</button>
      </div>
      <section className={`detailCard chartDetailCard ${focusChart ? 'chartFocusCard' : ''}`}>
        <div className="detailCardHead"><div><div className="detailCardTitle">{mode === 'compare' ? 'Thực hiện tháng & kế hoạch' : mode === 'ytd' ? 'Lũy kế & kế hoạch' : mode === 'same' ? 'So sánh cùng kỳ' : mode === 'range' ? 'So sánh kỳ tùy chọn' : 'Dự báo xu hướng'}</div>{focusChart && <small>{item.label} · {periodLabel(data.period)}</small>}</div><button type="button" className="chartFocusBtn" onClick={() => setFocusChart((value) => !value)} aria-label={focusChart ? 'Đóng chế độ tập trung' : 'Mở chế độ tập trung'}>{focusChart ? '×' : '⛶'}</button></div>
        {mode === 'compare' && <AdaptiveCurrentChart data={data} kpiId={item.id}/>} 
        {mode === 'ytd' && <><div className="statPair"><div><small>Lũy kế / hiện trạng</small><b>{p.ytd ?? item.detail ?? item.value}</b></div><span>↔</span><div><small>Kế hoạch / ngưỡng</small><b>{p.plan ?? item.plan ?? 'Chưa có'}</b></div></div>{data.history?.[item.id] && <HistoryChart data={data} kpiId={item.id} mode="ytd" />}</>}
        {mode === 'same' && <SamePeriodPanel data={data} kpiId={item.id} />}
        {mode === 'range' && <RangeComparisonPanel data={data} kpiId={item.id} comparison={comparison} edit={openCompare}/>} 
        {mode === 'forecast' && <ForecastPanel data={data} kpiId={item.id} />}
      </section>
      <button className="kpiPlanTrigger" onClick={openPlanDetail}>
        <span>◎</span><div><small>Kế hoạch / ngưỡng</small><b>{p.plan ?? item.plan ?? 'Chưa có kế hoạch chuẩn hóa'}</b></div><i>›</i>
      </button>
      <section className="detailCard insightCompact">
        <div className="detailCardTitle">Nhận định</div>
        <ul>{(p.insight ?? []).map((text) => <li key={text}>{text}</li>)}</ul>
      </section>
      <section className="detailCard difficultyCompact">
        <div className="difficultyHeading"><span>!</span><div><b>Khó khăn</b><small>Các yếu tố cần theo dõi trước khi triển khai giải pháp</small></div></div>
        <ul>{difficulties.map((text) => <li key={text}>{text}</li>)}</ul>
      </section>
      <section className="compactSection">
        <div className="sectionHeading"><div><b>Giải pháp & Tư vấn</b><small>Vuốt ngang, chạm để xem chi tiết</small></div></div>
        <div className="horizontalCarousel adviceCarousel">
          {official.slice(0, 2).map((plan) => <button key={plan.id} className="carouselCard advice official" onClick={openAdvice}><span>{data.dataMode === 'demo' ? 'Giải pháp DEMO' : 'Theo báo cáo'}</span><b>{plan.title}</b><small>{plan.owner}</small></button>)}
          {(p.advice ?? []).slice(0, 2).map((text, i) => <button key={`${item.id}-advice-${i}`} className="carouselCard advice system" onClick={openAdvice}><span>Gợi ý hệ thống</span><b>{text}</b><small>Chạm để xem và đưa vào kế hoạch</small></button>)}
          {weatherTips.slice(0,2).map((text,i)=><button key={`${item.id}-weather-${i}`} className="carouselCard advice weather" onClick={openAdvice}><span>Thời tiết địa bàn</span><b>{text}</b><small>Gợi ý điều hành hiện tại</small></button>)}
        </div>
      </section>
    </>
  );
}

function AlertsTab({ data, earlyWarnings, openAlert, openKpi }: { data: DashboardBootstrap; earlyWarnings: ReturnType<typeof buildEarlyWarnings>; openAlert: (id: string) => void; openKpi:(domainId:string,kpiId:string)=>void }) {
  const [filter, setFilter] = useState<'all' | 'red' | 'yellow' | 'data'>('all');
  const red = data.alerts.filter((x) => x.severity === 'red').length;
  const yellow = data.alerts.filter((x) => x.severity === 'yellow').length;
  const visible = data.alerts.filter((a) => filter === 'all' || a.severity === filter);
  return (
    <>
      <div className="pageTitle"><div><small>Điều hành</small><h2>Cảnh báo</h2></div></div>
      <section className="alertSummaryCompact">
        <span className="danger"><b>{red}</b><small>Ưu tiên</small></span>
        <span className="warning"><b>{yellow}</b><small>Theo dõi</small></span>
        <span><b>{data.conflicts.length}</b><small>Sai khác dữ liệu</small></span>
      </section>
      {earlyWarnings.length > 0 && <section className="earlyWarningSection"><div className="sectionHeading compact"><div><b>🔮 Cảnh báo sớm</b><small>KPI có nguy cơ theo Forecast dù hiện tại có thể vẫn đạt</small></div></div><div className="earlyWarningRail">{earlyWarnings.slice(0,6).map((warning)=><button key={warning.id} className={`earlyWarningCard ${warning.risk}`} onClick={()=>openKpi(warning.domainId,warning.kpiId)}><span>{warning.risk==='high'?'Nguy cơ cao':warning.risk==='medium'?'Theo dõi':'Thấp'}</span><b>{warning.label}</b><p>{warning.forecastText}</p><small>{warning.reason}</small></button>)}</div></section>}
      <div className="pillTabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tất cả</button>
        <button className={filter === 'red' ? 'active' : ''} onClick={() => setFilter('red')}>Đỏ</button>
        <button className={filter === 'yellow' ? 'active' : ''} onClick={() => setFilter('yellow')}>Vàng</button>
        <button className={filter === 'data' ? 'active' : ''} onClick={() => setFilter('data')}>Dữ liệu</button>
      </div>
      {filter !== 'data' && <div className="alertListCompact">{visible.map((alert) => <button key={alert.id} className={`alertRow ${alert.severity}`} onClick={() => openAlert(alert.id)}><span>!</span><div><small>{alert.domain}</small><b>{alert.title}</b><em>{alert.current}</em></div><i>›</i></button>)}</div>}
      {(filter === 'all' || filter === 'data') && <section className="conflictCompact"><div className="sectionHeading"><div><b>Sai khác dữ liệu nguồn</b><small>Cần xác nhận trước khi ghi DB chính</small></div></div>{data.conflicts.map((c) => <article key={c.id}><b>{c.label}</b><p><span>{c.valueA}</span><i>≠</i><span>{c.valueB}</span></p><small>{c.recommendation}</small></article>)}</section>}
    </>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheetBackdrop" onClick={onClose}>
      <section className="bottomSheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheetHandle" />
        <div className="sheetHeader"><b>{title}</b><button onClick={onClose}>×</button></div>
        <div className="sheetBody">{children}</div>
      </section>
    </div>
  );
}


function CompareFilterSheet({ data, value, apply }: { data:DashboardBootstrap; value:ComparisonSelection; apply:(next:ComparisonSelection)=>void }) {
  const [draft,setDraft]=useState<ComparisonSelection>(value);
  const years=Array.from(new Set(((data.availablePeriods?.length?data.availablePeriods:[data.period])).map((p)=>p.slice(0,4)))).sort();
  const update=(side:'left'|'right', patch:Partial<RangeSelection>)=>setDraft((prev)=>({...prev,[side]:{...prev[side],...patch}}));
  const options=(kind:RangeKind)=>kind==='month'?Array.from({length:12},(_,i)=>({value:i+1,label:`Tháng ${i+1}`})):kind==='quarter'?Array.from({length:4},(_,i)=>({value:i+1,label:`Quý ${i+1}`})):[{value:1,label:'6 tháng đầu'},{value:2,label:'6 tháng cuối'}];
  const side=(key:'left'|'right', title:string)=>{
    const current=draft[key];
    return <fieldset className="compareField"><legend>{title}</legend><div className="compareSelectGrid">
      <label><small>Loại kỳ</small><select value={current.kind} onChange={(e)=>update(key,{kind:e.target.value as RangeKind,index:1})}><option value="month">Tháng</option><option value="quarter">Quý</option><option value="half">6 tháng</option></select></label>
      <label><small>Năm</small><select value={current.year} onChange={(e)=>update(key,{year:e.target.value})}>{years.map((year)=><option key={year} value={year}>{year}</option>)}</select></label>
      <label className="comparePeriodSelect"><small>Kỳ</small><select value={current.index} onChange={(e)=>update(key,{index:Number(e.target.value)})}>{options(current.kind).map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
    </div></fieldset>;
  };
  return <div className="compareSheet">{side('left','Kỳ A – đang đánh giá')}{side('right','Kỳ B – đối chiếu')}<div className="comparePreview"><span>{rangeLabel(draft.left)}</span><b>↔</b><span>{rangeLabel(draft.right)}</span></div><button className="sheetPrimary" onClick={()=>apply(draft)}>Áp dụng so sánh</button></div>;
}

function WeatherSheet({ data, weather }: { data:DashboardBootstrap; weather:WeatherBundle | null }) {
  if(!weather) return <div className="weatherEmpty"><div className="loader"/><b>Đang nạp thời tiết địa bàn…</b></div>;
  if(!weather.ok) return <div className="weatherEmpty"><span>☁</span><b>Chưa bật dữ liệu thời tiết trực tiếp</b><p>{weather.message}</p><small>Trong file .env.local hoặc Vercel, cấu hình WEATHER_USER_AGENT theo hướng dẫn README.</small></div>;
  const advice=buildOperationsAdvice(data,weather);
  return <div className="weatherSheet">
    <div className="weatherProvider"><span>☁</span><div><b>Thời tiết 24 giờ tới</b><small>{weather.provider} · cập nhật {new Date(weather.updatedAt).toLocaleString('vi-VN')}</small></div></div>
    <div className="weatherAreaGrid">{weather.areas.map((area)=><article key={area.id} className={`weatherArea ${area.risk}`}><div><b>{area.name}</b><span>{Math.round(area.temperature)}°C</span></div><p>Mưa {area.precipitation24h.toLocaleString('vi-VN',{maximumFractionDigits:1})} mm · xác suất {Math.round(area.precipitationProbability)}%</p><p>Dông {Math.round(area.thunderProbability)}% · gió giật {Math.round(area.maxGustKmh)} km/h</p></article>)}</div>
    <div className="advisorBlock"><div className="advisorTitle"><span>✦</span><div><b>Trợ lý điều hành</b><small>Kết hợp trạng thái KPI + thời tiết địa bàn</small></div></div>{advice.map((row,i)=><article key={`${row.domain}-${i}`} className={`advisorRow ${row.level}`}><b>{row.domain}</b><p>{row.text}</p></article>)}</div>
  </div>;
}

function SearchSheet({ data, openDomain, openKpi, close }: { data: DashboardBootstrap; openDomain: (id: string) => void; openKpi: (domainId: string, kpiId: string) => void; close: () => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const domains = data.fields.filter((field) => !q || field.title.toLowerCase().includes(q));
  const kpis = data.fields.flatMap((field) => field.items.filter((item) => !q || `${field.title} ${item.label}`.toLowerCase().includes(q)).map((item) => ({ field, item })));
  return (
    <>
      <input className="sheetSearch" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm lĩnh vực hoặc KPI..." />
      <div className="searchResults">
        {domains.slice(0, 6).map((field) => <button key={field.id} onClick={() => { close(); openDomain(field.id); }}><span>{domainMeta[field.id]?.icon ?? '▦'}</span><div><b>{field.title}</b><small>Lĩnh vực</small></div><i>›</i></button>)}
        {q && kpis.slice(0, 12).map(({ field, item }) => <button key={`${field.id}-${item.id}`} onClick={() => { close(); openKpi(field.id, item.id); }}><span>•</span><div><b>{item.label}</b><small>{field.title}</small></div><i>›</i></button>)}
      </div>
    </>
  );
}

export default function AppShell() {
  const [tab, setTab] = useState<MainTab>('home');
  const [view, setView] = useState<ViewState>({ kind: 'root' });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [data, setData] = useState<DashboardBootstrap | null>(null);
  const [error, setError] = useState('');
  const [favoriteDomains, setFavoriteDomains] = useState<string[]>([]);
  const [favoriteKpis, setFavoriteKpis] = useState<string[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherBundle | null>(null);
  const [comparison, setComparison] = useState<ComparisonSelection>(DEFAULT_COMPARE);
  const [actions, setActions] = useState<ActionItem[]>([]);

  const fetchDashboard = async (period?: string) => {
    setPeriodLoading(true);
    setError('');
    try {
      const query = period ? `?period=${encodeURIComponent(period)}` : '';
      const response = await fetch(`/api/dashboard${query}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json() as DashboardBootstrap;
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setPeriodLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
    void fetch('/api/weather', { cache:'no-store' }).then((response)=>response.json()).then((json)=>setWeather(json as WeatherBundle)).catch(()=>setWeather({ok:false,live:false,provider:'MET Norway Locationforecast',updatedAt:new Date().toISOString(),areas:[],overallRisk:'green',message:'Không tải được dữ liệu thời tiết.'}));
    try {
      setFavoriteDomains(JSON.parse(localStorage.getItem('sxkd:favDomains') || '[]'));
      setFavoriteKpis(JSON.parse(localStorage.getItem('sxkd:favKpis') || '[]'));
      setCustomPlans(JSON.parse(localStorage.getItem('sxkd:customPlans') || '[]'));
    } catch { /* ignore malformed local data */ }
  }, []);

  const healthModel = useMemo(() => data ? buildHealthModel(data) : null, [data]);
  const earlyWarnings = useMemo(() => data ? buildEarlyWarnings(data) : [], [data]);

  useEffect(() => {
    if (!data) return;
    const seed = seedActions(data, customPlans, earlyWarnings);
    let stored: ActionItem[] = [];
    try { stored = JSON.parse(localStorage.getItem('sxkd:actions:v1') || '[]'); } catch { stored = []; }
    const next = mergeActionState(seed, stored);
    setActions(next);
    try { localStorage.setItem('sxkd:actions:v1', JSON.stringify(next)); } catch {}
  }, [data, customPlans, earlyWarnings]);

  const updateAction = (id:string, patch:Partial<ActionItem>) => setActions((prev) => {
    const next = prev.map((action) => action.id === id ? { ...action, ...patch, updatedAt:new Date().toISOString() } : action);
    try { localStorage.setItem('sxkd:actions:v1', JSON.stringify(next)); } catch {}
    return next;
  });

  const executiveBrief = useMemo(() => data && healthModel ? buildExecutiveBrief(data, healthModel, earlyWarnings, actions) : null, [data, healthModel, earlyWarnings, actions]);

  const saveList = (key: string, values: string[]) => { try { localStorage.setItem(key, JSON.stringify(values)); } catch {} };
  const toggleDomainFavorite = (id: string) => setFavoriteDomains((prev) => { const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]; saveList('sxkd:favDomains', next); return next; });
  const toggleKpiFavorite = (id: string) => setFavoriteKpis((prev) => { const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]; saveList('sxkd:favKpis', next); return next; });
  const addPlan = (domainId: string, kpiId: string) => {
    if (!data) return;
    const field = data.fields.find((x) => x.id === domainId);
    const item = field?.items.find((x) => x.id === kpiId);
    if (!field || !item) return;
    const advice = getPresentation(item, data).advice?.[0] ?? `Theo dõi và xử lý ${item.label}.`;
    setCustomPlans((prev) => {
      if (prev.some((x) => x.sourceKpi === item.label)) return prev;
      const next = [{ id: `CUSTOM_${Date.now()}`, title: advice, owner: field.title, sourceKpi: item.label, createdAt: new Date().toISOString() }, ...prev];
      try { localStorage.setItem('sxkd:customPlans', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const changePeriod = async (period: string) => {
    if (!data || period === data.period) return;
    setSheet(null);
    setComparison(defaultCompareFor(period, data.availablePeriods ?? []));
    await fetchDashboard(period);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!data) return <main className="appShell loadingState"><div className="loader" /><b>Đang nạp dữ liệu điều hành…</b>{error && <small>{error}</small>}</main>;

  const openDomain = (id: string) => { setTab('home'); setView({ kind: 'domain', domainId: id }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openKpi = (domainId: string, kpiId: string, returnTo: 'domain' | 'alerts' = tab === 'alerts' ? 'alerts' : 'domain') => { setView({ kind: 'kpi', domainId, kpiId, returnTo }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const switchTab = (next: MainTab) => { setTab(next); setView({ kind: 'root' }); setSheet(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const backFromKpi = () => {
    if (view.kind !== 'kpi') return;
    if (view.returnTo === 'alerts') { setView({ kind: 'root' }); setTab('alerts'); }
    else setView({ kind: 'domain', domainId: view.domainId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let content: ReactNode;
  if (view.kind === 'kpi') {
    content = <KpiDetail data={data} domainId={view.domainId} kpiId={view.kpiId} favoriteKpis={favoriteKpis} toggleKpiFavorite={toggleKpiFavorite} back={backFromKpi} openAdvice={() => setSheet({ kind: 'advice', domainId: view.domainId, kpiId: view.kpiId })} openPlanDetail={() => setSheet({ kind: 'kpi-plan', domainId: view.domainId, kpiId: view.kpiId })} comparison={comparison} openCompare={() => setSheet({kind:'compare'})} weather={weather} />;
  } else if (view.kind === 'domain') {
    content = <DomainDetail data={data} domainId={view.domainId} favoriteKpis={favoriteKpis} toggleKpiFavorite={toggleKpiFavorite} back={() => setView({ kind: 'root' })} openKpi={(d, k) => openKpi(d, k, 'domain')} />;
  } else if (tab === 'home') {
    content = <HomeTab data={data} favoriteDomains={favoriteDomains} favoriteKpis={favoriteKpis} health={healthModel!} earlyWarnings={earlyWarnings} toggleDomainFavorite={toggleDomainFavorite} openDomain={openDomain} openKpi={(d,k)=>openKpi(d,k,'domain')} openSearch={() => setSheet({ kind: 'search' })} goAlerts={() => switchTab('alerts')} openHealth={()=>setSheet({kind:'health'})} />;
  } else if (tab === 'alerts') {
    content = <AlertsTab data={data} earlyWarnings={earlyWarnings} openAlert={(id) => setSheet({ kind: 'alert', alertId: id })} openKpi={(d,k)=>openKpi(d,k,'alerts')} />;
  } else if (tab === 'ai') {
    content = <AiCommandCenter data={data} health={healthModel!} warnings={earlyWarnings} actions={actions} brief={executiveBrief!} weather={weather} goAlerts={()=>switchTab('alerts')} goPlans={()=>switchTab('plans')} />;
  } else {
    content = <ActionCenter actions={actions} updateAction={updateAction} openAction={(id)=>setSheet({kind:'action',actionId:id})} />;
  }

  let sheetContent: ReactNode = null;
  let sheetTitle = '';
  if (sheet?.kind === 'health') {
    sheetTitle = 'Sức khỏe SXKD';
    sheetContent = <div className="healthSheet"><div className={`healthSheetHero ${healthModel?.band ?? 'good'}`}><small>Điểm sức khỏe toàn đơn vị</small><b>{healthModel?.overall.toLocaleString('vi-VN',{maximumFractionDigits:1}) ?? '—'}<em>/100</em></b><span>Điểm tổng hợp từ tiến độ kế hoạch, xu hướng, cùng kỳ, forecast và độ ổn định.</span></div><div className="healthDomainList">{healthModel?.domains.slice().sort((a,b)=>a.score-b.score).map((domain)=><button key={domain.domainId} onClick={()=>{setSheet(null);openDomain(domain.domainId)}}><div><b>{domain.title}</b><small>{domain.kpis.filter((kpi)=>kpi.band==='risk'||kpi.band==='watch').length} KPI cần theo dõi</small></div><strong>{domain.score.toLocaleString('vi-VN',{maximumFractionDigits:1})}</strong><i>›</i></button>)}</div></div>;
  } else if (sheet?.kind === 'action') {
    const action=actions.find((row)=>row.id===sheet.actionId);
    if(action){
      sheetTitle='Chi tiết hành động';
      sheetContent=<div className="actionSheet"><div className="actionSheetHero"><span className={`actionPriority ${action.priority}`}>{action.priority==='high'?'Cao':action.priority==='medium'?'Trung bình':'Bình thường'}</span><h3>{action.title}</h3><p>{action.owner}{action.sourceKpiLabel?` · KPI ${action.sourceKpiLabel}`:''}</p></div><div className="actionSheetGrid"><div><small>Trạng thái</small><b>{action.status==='done'?'Hoàn thành':action.status==='overdue'?'Quá hạn':action.status==='doing'?'Đang làm':'Mới'}</b></div><div><small>Tiến độ</small><b>{action.progress}%</b></div><div><small>Thời hạn</small><b>{action.dueDate??'Chưa đặt'}</b></div><div><small>Nguồn</small><b>{action.source}</b></div></div><section><b>Mục tiêu</b><p>{action.objective}</p></section><section><b>Nội dung thực hiện</b><ol>{action.steps.map((step)=><li key={step}>{step}</li>)}</ol></section><section><b>Kết quả mong đợi</b><p>{action.expectedResult}</p></section>{action.measure&&<section><b>Tiêu chí theo dõi</b><p>{action.measure}</p></section>}<div className="actionSheetButtons"><button onClick={()=>updateAction(action.id,{status:'doing',progress:Math.max(action.progress,55)})}>Đang thực hiện</button><button className="done" onClick={()=>updateAction(action.id,{status:'done',progress:100})}>✓ Hoàn thành</button></div></div>;
    }
  } else if (sheet?.kind === 'source') {
    sheetTitle = 'Nguồn dữ liệu';
    sheetContent = <div className="sourceSheet"><p><b>{data.sourceLabel}</b></p>{data.dataMode === 'demo' && <div className="demoWarning">⚠ Dữ liệu giả lập chỉ để test giao diện, tốc độ, so sánh và Forecast.</div>}<dl><div><dt>Kỳ báo cáo</dt><dd>{periodLabel(data.period)}</dd></div><div><dt>Dữ liệu đến</dt><dd>{data.reportingDate}</dd></div><div><dt>Chế độ</dt><dd>{data.dataMode === 'demo' ? 'DEMO giả lập 2025–2026' : data.dataMode === 'pdf-seed' ? 'Dữ liệu PDF mẫu' : 'Apps Script API'}</dd></div></dl><button className="sheetPrimary" onClick={() => downloadSnapshot(data)}>⇩ Xuất snapshot dữ liệu</button></div>;
  } else if (sheet?.kind === 'weather') {
    sheetTitle = 'Thời tiết & Gợi ý điều hành';
    sheetContent = <WeatherSheet data={data} weather={weather} />;
  } else if (sheet?.kind === 'compare') {
    sheetTitle = 'Bộ lọc so sánh';
    sheetContent = <CompareFilterSheet data={data} value={comparison} apply={(next)=>{ setComparison(next); setSheet(null); }} />;
  } else if (sheet?.kind === 'search') {
    sheetTitle = 'Tìm nhanh';
    sheetContent = <SearchSheet data={data} openDomain={openDomain} openKpi={(d, k) => openKpi(d, k, 'domain')} close={() => setSheet(null)} />;
  } else if (sheet?.kind === 'alert') {
    const alert = data.alerts.find((a) => a.id === sheet.alertId);
    if (alert) {
      const target = alert.domainId ? { domainId: alert.domainId, kpiId: alert.kpiId } : alertToKpi[alert.id];
      sheetTitle = 'Chi tiết cảnh báo';
      sheetContent = <div className="alertSheet"><span className={`severityBadge ${alert.severity}`}>{alert.severity === 'red' ? 'Ưu tiên' : 'Theo dõi'}</span><h3>{alert.title}</h3><div className="sheetMetric"><small>Hiện tại</small><b>{alert.current}</b></div>{alert.target && <div className="sheetMetric"><small>Kế hoạch / ngưỡng</small><b>{alert.target}</b></div>}<p>{alert.note}</p>{target && <button className="sheetPrimary" onClick={() => { setSheet(null); target.kpiId ? openKpi(target.domainId, target.kpiId, 'alerts') : openDomain(target.domainId); }}>Xem phân tích đầy đủ</button>}</div>;
    }
  } else if (sheet?.kind === 'kpi-plan') {
    const field = data.fields.find((x) => x.id === sheet.domainId);
    const item = field?.items.find((x) => x.id === sheet.kpiId);
    const history = data.history?.[sheet.kpiId];
    const point = historyPoint(data, sheet.kpiId);
    if (field && item) {
      const p = getPresentation(item, data);
      const actual = numericValue(point?.actual);
      const planMonth = numericValue(point?.planMonth);
      const ytd = numericValue(point?.ytd);
      const planYtd = numericValue(point?.planYtd);
      const annual = history?.annualPlans?.[data.period.slice(0,4)];
      const ratio = actual !== undefined && planMonth !== undefined && planMonth !== 0 ? actual / planMonth * 100 : undefined;
      const good = ratio === undefined ? undefined : history?.direction === 'lower' ? ratio <= 100 : ratio >= 100;
      const related = data.plans.filter((plan) => (officialPlanByDomain[field.id] ?? []).includes(plan.id));
      sheetTitle = 'Chi tiết kế hoạch chỉ tiêu';
      sheetContent = <div className="kpiPlanSheet"><div className="planTargetHero"><small>{item.label}</small><b>{p.plan ?? item.plan ?? 'Chưa có kế hoạch chuẩn hóa'}</b><span>{good === undefined ? 'Đang bổ sung dữ liệu kế hoạch' : good ? '✓ Đang đạt/đúng ngưỡng' : '⚠ Cần bám sát kế hoạch'}</span></div><div className="planMetricGrid"><div><small>TH tháng</small><b>{history ? metricFormat(history,actual) : item.value}</b></div><div><small>KH tháng</small><b>{history ? metricFormat(history,planMonth) : '—'}</b></div><div><small>Lũy kế TH</small><b>{history ? metricFormat(history,ytd) : '—'}</b></div><div><small>KH lũy kế</small><b>{history ? metricFormat(history,planYtd) : '—'}</b></div><div><small>KH năm</small><b>{history ? metricFormat(history,annual) : '—'}</b></div><div><small>TH/KH tháng</small><b>{ratio === undefined ? '—' : `${ratio.toLocaleString('vi-VN',{maximumFractionDigits:1})}%`}</b></div></div><div className="planExplanation"><b>Diễn giải</b><p>Kế hoạch chỉ tiêu là mốc số liệu để so với thực hiện. Biểu đồ sử dụng cùng đơn vị và cùng trục để tránh hiểu sai mức độ hoàn thành.</p></div>{related.length>0&&<div className="planRelated"><b>Hành động liên quan</b>{related.slice(0,3).map((plan)=><p key={plan.id}><span>→</span><em>{plan.title}</em><small>{plan.owner}</small></p>)}</div>}</div>;
    }
  } else if (sheet?.kind === 'advice') {
    const field = data.fields.find((x) => x.id === sheet.domainId);
    const item = field?.items.find((x) => x.id === sheet.kpiId);
    if (field && item) {
      const p = getPresentation(item, data);
      const official = data.plans.filter((plan) => (officialPlanByDomain[field.id] ?? []).includes(plan.id));
      const exists = customPlans.some((x) => x.sourceKpi === item.label);
      const weatherTips = weatherAdviceForKpi(field.id,item.id,weather);
      sheetTitle = 'Giải pháp & Tư vấn';
      sheetContent = <div className="adviceSheet"><h3>{item.label}</h3>{official.length > 0 && <div className="sheetAdvice official"><span>{data.dataMode === 'demo' ? 'Giải pháp DEMO' : 'Theo báo cáo'}</span>{official.map((plan) => <p key={plan.id}><b>{plan.title}</b><small>{plan.owner}</small></p>)}</div>}<div className="sheetAdvice system"><span>Gợi ý hệ thống</span><ol>{(p.advice ?? []).map((text) => <li key={text}>{text}</li>)}</ol></div>{weatherTips.length>0 && <div className="sheetAdvice weather"><span>Thời tiết địa bàn</span><ol>{weatherTips.map((text)=><li key={text}>{text}</li>)}</ol></div>}<button className={`sheetPrimary ${exists ? 'done' : ''}`} disabled={exists} onClick={() => { addPlan(field.id, item.id); }}>{exists ? '✓ Đã đưa vào kế hoạch' : '+ Đưa tư vấn vào kế hoạch'}</button></div>;
    }
  }

  return (
    <main className="appShell v15">
      <CompactHeader data={data} openSource={() => setSheet({ kind: 'source' })} openWeather={() => setSheet({kind:'weather'})} exportData={() => downloadSnapshot(data)} onPeriodChange={changePeriod} periodLoading={periodLoading} weather={weather} />
      {view.kind === 'root' && tab === 'home' && <SummaryCompact data={data} />}
      <div className="contentV15">{content}</div>
      <nav className="bottomNavV15">
        {navTabs.map((item) => <button key={item.id} className={tab === item.id && view.kind === 'root' ? 'active' : ''} onClick={() => switchTab(item.id)}><span>{item.icon}</span><small>{item.label}</small>{item.id === 'alerts' && <i>{data.summary.fail + data.summary.partial + earlyWarnings.filter((row)=>row.risk!=='low').length}</i>}{item.id === 'ai' && earlyWarnings.some((row)=>row.risk==='high') && <i className="aiNavDot">!</i>}</button>)}
      </nav>
      {sheet && <BottomSheet title={sheetTitle} onClose={() => setSheet(null)}>{sheetContent}</BottomSheet>}
    </main>
  );
}
