import type { DashboardBootstrap } from '@/types/dashboard';
import type { WeatherBundle, WeatherRisk } from '@/types/weather';

const riskRank:Record<WeatherRisk,number> = { green:0, yellow:1, red:2 };

function severeAreas(weather:WeatherBundle) {
  return weather.areas.filter((area)=>riskRank[area.risk] >= 1);
}

export function weatherAdviceForKpi(domainId:string, kpiId:string, weather?:WeatherBundle | null) {
  if (!weather?.ok || !weather.areas.length) return [] as string[];
  const risky = severeAreas(weather);
  const heavyRain = weather.areas.some((x)=>x.precipitation24h >= 20 || x.precipitationProbability >= 70 || x.thunderProbability >= 30);
  const strongWind = weather.areas.some((x)=>x.maxGustKmh >= 45 || x.maxWindKmh >= 30);
  const hot = weather.areas.some((x)=>x.maxTemperature24h >= 35);
  const areaText = risky.length ? risky.map((x)=>x.name).join(', ') : 'toàn địa bàn';
  const tips:string[] = [];

  if (domainId === 'ky-thuat') {
    if (heavyRain || strongWind) tips.push(`Thời tiết ${areaText} có rủi ro mưa/dông/gió: ưu tiên trực vận hành, phát quang điểm xung yếu và chuẩn bị phương án xử lý sự cố để bảo vệ SAIFI/SAIDI.`);
    if (kpiId === 'KT_SC') tips.push('Kết hợp dự báo mưa dông với lịch sử nguyên nhân sự cố để tăng kiểm tra tại tuyến/TBA có sự cố lặp trước thời điểm thời tiết xấu.');
    if (['SAIFI','SAIDI','MAIFI'].includes(kpiId)) tips.push('Theo dõi riêng sự cố do thời tiết và thời gian khôi phục cấp điện; ưu tiên nguồn lực cho khu vực có nguy cơ làm tăng chỉ số độ tin cậy.');
  }
  if (domainId === 'do-xa') {
    if (heavyRain || strongWind) tips.push(`Tăng theo dõi mất kết nối đo xa tại ${areaText}; tạo danh sách điểm mất kết nối mới sau mưa/dông để xử lý sớm trước kỳ hóa đơn.`);
    tips.push('Đối chiếu nhóm đã kết nối nhưng chưa khai thác hóa đơn; xếp ưu tiên theo số giờ mất kết nối và ảnh hưởng đến ghi chỉ số.');
  }
  if (domainId === 'kinh-doanh') {
    if (hot) tips.push('Nhiệt độ cao có thể làm phụ tải biến động: theo dõi điện thương phẩm, công suất TBA và sản lượng theo nhóm phụ tải theo ngày để điều chỉnh dự báo tháng.');
    if (heavyRain) tips.push('Trong ngày mưa lớn, tách ảnh hưởng vận hành khỏi biến động thương phẩm/doanh thu và tăng theo dõi các khu vực bị gián đoạn cấp điện.');
    if (kpiId === 'KD_TT' && heavyRain) tips.push('Sau mưa lớn, đối chiếu các TBA/phát tuyến có tổn thất tăng bất thường để khoanh vùng kiểm tra thay vì đánh giá chỉ từ tỷ lệ toàn Công ty.');
  }
  if (domainId === 'dvkh') {
    if (heavyRain || strongWind) tips.push('Ưu tiên kênh CSKH trực tuyến/điện thoại trong thời tiết xấu; tách yêu cầu mất điện, sự cố và dịch vụ thông thường để xử lý theo mức độ khẩn cấp.');
    tips.push('Theo dõi backlog và SLA theo ngày; đưa hồ sơ gần quá hạn lên đầu thay vì chờ tổng hợp cuối tháng.');
  }
  if (domainId === 'dau-tu-tai-chinh') {
    if (heavyRain || strongWind) tips.push('Rà soát công việc ĐTXD/SCL ngoài trời theo dự báo 24–48 giờ; ưu tiên an toàn, chuyển việc có thể thực hiện sang hồ sơ/nghiệm thu/vật tư trong thời tiết xấu.');
    tips.push('Gắn tiến độ giải ngân với tiến độ hiện trường; khi thời tiết làm chậm thi công cần cập nhật lại forecast hoàn thành/giải ngân ngay trong tháng.');
  }
  if (domainId === 'nhan-su') {
    if (heavyRain || strongWind) tips.push('Bố trí nhân lực trực ứng phó, nhắc lại an toàn điện và công tác ngoài trời; tránh bố trí đào tạo/việc không cấp thiết trùng thời điểm nguy cơ thời tiết cao.');
    if (hot) tips.push('Với ngày nắng nóng, điều chỉnh thời gian công tác ngoài trời và theo dõi sức khỏe/hiệu suất đội hiện trường.');
  }
  if (!tips.length) tips.push('Thời tiết 24 giờ tới chưa tạo tín hiệu rủi ro nổi bật cho KPI này; duy trì kế hoạch tháng và tiếp tục theo dõi chênh lệch TH/KH để phát hiện sớm biến động.');
  return Array.from(new Set(tips)).slice(0,4);
}

export function buildOperationsAdvice(data:DashboardBootstrap, weather?:WeatherBundle | null) {
  const rows:{domain:string;level:'red'|'yellow'|'info';text:string}[] = [];
  if (weather?.ok) {
    const risky = severeAreas(weather);
    if (risky.length) rows.push({domain:'Thời tiết',level:weather.overallRisk==='red'?'red':'yellow',text:`${risky.length}/${weather.areas.length} khu vực cần lưu ý: ${risky.map((x)=>x.name).join(', ')}. Ưu tiên theo dõi mưa/dông/gió trước khi phân công công việc hiện trường.`});
  }
  data.fields.forEach((field)=>{
    const risks = field.items.filter((item)=>item.tone==='bad'||item.tone==='warn');
    if (!risks.length) return;
    const top = risks.slice(0,2).map((x)=>x.label).join(', ');
    const weatherTips = weatherAdviceForKpi(field.id, risks[0]?.id ?? '', weather);
    rows.push({domain:field.title,level:risks.some((x)=>x.tone==='bad')?'red':'yellow',text:`Ưu tiên ${top}. ${weatherTips[0] ?? 'Theo dõi chênh lệch TH/KH tháng và cập nhật giải pháp xử lý theo tuần.'}`});
  });
  return rows.slice(0,10);
}
