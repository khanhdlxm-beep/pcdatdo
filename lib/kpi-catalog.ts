import type { MetricHistory } from '@/types/dashboard';

export type KpiCatalogEntry = {
  id: string;
  domainId: string;
  domainName: string;
  label: string;
  unit: string;
  direction: MetricHistory['direction'];
  aggregate: MetricHistory['aggregate'];
  decimals: number;
  aliases: string[];
  pl1RowNo?: number;
};

export const KPI_CATALOG: KpiCatalogEntry[] = [
  { id:'KD_DIENNHAN', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Điện nhận', unit:'Tr.kWh', direction:'info', aggregate:'sum', decimals:3, aliases:['điện nhận'] },
  { id:'KD_COCADIENMUA', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Cơ cấu điện mua', unit:'', direction:'info', aggregate:'snapshot', decimals:0, aliases:['cơ cấu điện mua'] },
  { id:'KD_DTP', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Điện thương phẩm', unit:'Tr.kWh', direction:'higher', aggregate:'sum', decimals:3, aliases:['sản lượng điện thương phẩm','điện thương phẩm'], pl1RowNo:1 },
  { id:'KD_DT', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Doanh thu', unit:'Tỷ đồng', direction:'higher', aggregate:'sum', decimals:2, aliases:['tổng doanh thu','doanh thu'] },
  { id:'KD_GIA', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Giá bán điện bình quân', unit:'đ/kWh', direction:'higher', aggregate:'avg', decimals:2, aliases:['giá bán điện bình quân','giá bán điện bq'], pl1RowNo:21 },
  { id:'KD_GIAMUA', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Giá mua điện bình quân', unit:'đ/kWh', direction:'lower', aggregate:'avg', decimals:2, aliases:['giá mua điện bình quân','giá mua điện bq'] },
  { id:'KD_TT', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Tổn thất điện năng', unit:'%', direction:'lower', aggregate:'avg', decimals:2, aliases:['tổn thất điện năng','tổn thất'], pl1RowNo:3 },
  { id:'KD_DBPT', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Dự báo phụ tải (điện thương phẩm)', unit:'%', direction:'lower', aggregate:'avg', decimals:2, aliases:['dự báo điện thương phẩm','dự báo phụ tải'] },
  { id:'KD_CONGTO', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Thay / bảo trì công tơ', unit:'Cái', direction:'higher', aggregate:'sum', decimals:0, aliases:['bảo trì tbđđ','bảo trì theo luật đo lường','bảo trì điều phối','thay bảo trì công tơ'] },
  { id:'KD_VIPHAM', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Kiểm tra xử lý vi phạm sử dụng điện', unit:'kWh', direction:'higher', aggregate:'sum', decimals:0, aliases:['kiểm tra xử lý vi phạm sử dụng điện','vi phạm sử dụng điện'] },
  { id:'KD_TKIEM', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Tiết kiệm điện', unit:'Tr.kWh', direction:'higher', aggregate:'sum', decimals:2, aliases:['tiết kiệm điện'] },
  { id:'KD_THUNGAN', domainId:'kinh-doanh', domainName:'Kinh doanh', label:'Công tác quản lý thu ngân', unit:'%', direction:'higher', aggregate:'avg', decimals:2, aliases:['công tác quản lý thu ngân','tỷ lệ thu tiền điện','tỷ lệ thu tiền điện theo phiên','tỷ lệ không dùng tiền mặt'] },

  { id:'CRM', domainId:'dvkh', domainName:'Khách hàng & DVKH', label:'CRM đã xử lý', unit:'%', direction:'higher', aggregate:'avg', decimals:2, aliases:['crm đã xử lý','tỷ lệ xử lý crm','yêu cầu crm'] },
  { id:'GANMOI', domainId:'dvkh', domainName:'Khách hàng & DVKH', label:'Gắn mới điện kế', unit:'KH', direction:'higher', aggregate:'sum', decimals:0, aliases:['gắn mới điện kế','gắn mới'] },
  { id:'HDMBD', domainId:'dvkh', domainName:'Khách hàng & DVKH', label:'HĐMBĐ ngoài sinh hoạt', unit:'HĐ', direction:'higher', aggregate:'sum', decimals:0, aliases:['hđmbđ ngoài sinh hoạt','hợp đồng mua bán điện ngoài sinh hoạt','hợp đồng mua bán điện'] },
  { id:'DV_CHUYENCHU', domainId:'dvkh', domainName:'Khách hàng & DVKH', label:'HĐMBĐ chuyển chủ thể', unit:'HĐ', direction:'info', aggregate:'sum', decimals:0, aliases:['hđmbđ chuyển chủ thể','chuyển chủ thể'] },
  { id:'TC_DN', domainId:'dvkh', domainName:'Khách hàng & DVKH', label:'Tiếp cận điện năng', unit:'ngày', direction:'lower', aggregate:'avg', decimals:2, aliases:['tiếp cận điện năng','thời gian tiếp cận điện năng'], pl1RowNo:22 },

  { id:'DX_KB', domainId:'do-xa', domainName:'Đo xa', label:'Khai báo đo xa', unit:'%', direction:'higher', aggregate:'snapshot', decimals:2, aliases:['khai báo đo xa','điểm đo đã khai báo'] },
  { id:'DX_KN', domainId:'do-xa', domainName:'Đo xa', label:'Kết nối đo xa', unit:'%', direction:'higher', aggregate:'snapshot', decimals:2, aliases:['kết nối đo xa','tỷ lệ kết nối','điểm đo kết nối'] },
  { id:'DX_HD', domainId:'do-xa', domainName:'Đo xa', label:'Khai thác hóa đơn', unit:'%', direction:'higher', aggregate:'snapshot', decimals:2, aliases:['khai thác hóa đơn','tỷ lệ khai thác hệ thống đo xa','khai thác hệ thống đo xa'], pl1RowNo:30 },
  { id:'DX_MK', domainId:'do-xa', domainName:'Đo xa', label:'Mất kết nối >48h', unit:'', direction:'lower', aggregate:'snapshot', decimals:0, aliases:['mất kết nối >48h','mất kết nối 48h','mất kết nối trên 48 giờ'] },

  { id:'KT_SC', domainId:'ky-thuat', domainName:'Kỹ thuật', label:'Sự cố trung thế', unit:'Vụ', direction:'lower', aggregate:'sum', decimals:0, aliases:['sự cố lưới trung thế','sự cố trung thế'], pl1RowNo:7 },
  { id:'SAIFI', domainId:'ky-thuat', domainName:'Kỹ thuật', label:'SAIFI', unit:'lần', direction:'lower', aggregate:'sum', decimals:4, aliases:['saifi'], pl1RowNo:4 },
  { id:'SAIDI', domainId:'ky-thuat', domainName:'Kỹ thuật', label:'SAIDI', unit:'phút', direction:'lower', aggregate:'sum', decimals:4, aliases:['saidi'], pl1RowNo:5 },
  { id:'MAIFI', domainId:'ky-thuat', domainName:'Kỹ thuật', label:'MAIFI', unit:'lần', direction:'lower', aggregate:'sum', decimals:4, aliases:['maifi'], pl1RowNo:6 },

  { id:'DTXD', domainId:'dau-tu-tai-chinh', domainName:'Đầu tư & Tài chính', label:'ĐTXD', unit:'Tỷ đồng', direction:'higher', aggregate:'sum', decimals:3, aliases:['công tác đtxd','đầu tư xây dựng','đtxd'], pl1RowNo:35 },
  { id:'SCL', domainId:'dau-tu-tai-chinh', domainName:'Đầu tư & Tài chính', label:'SCL', unit:'Tỷ đồng', direction:'higher', aggregate:'sum', decimals:3, aliases:['sửa chữa lớn','công tác scl','scl'], pl1RowNo:37 },
  { id:'TONKHO', domainId:'dau-tu-tai-chinh', domainName:'Đầu tư & Tài chính', label:'Tồn kho', unit:'Tỷ đồng', direction:'lower', aggregate:'snapshot', decimals:3, aliases:['định mức tồn kho','tồn kho sxkd','tồn kho'], pl1RowNo:42 },
  { id:'CHIPHI', domainId:'dau-tu-tai-chinh', domainName:'Đầu tư & Tài chính', label:'Chi phí định mức', unit:'đ/kWh', direction:'lower', aggregate:'avg', decimals:2, aliases:['chi phí định mức','chi phí 6 yếu tố','chi phí định mức (6 yếu tố)'], pl1RowNo:39 },

  { id:'CBCNV', domainId:'nhan-su', domainName:'Nhân sự & Văn hóa', label:'CBCNV', unit:'Người', direction:'info', aggregate:'snapshot', decimals:0, aliases:['cbc nv','cbcnv','lao động sử dụng bình quân'], pl1RowNo:44 },
  { id:'DT_GIO', domainId:'nhan-su', domainName:'Nhân sự & Văn hóa', label:'Giờ đào tạo', unit:'Giờ', direction:'higher', aggregate:'sum', decimals:2, aliases:['số giờ đào tạo','giờ đào tạo'], pl1RowNo:49 },
  { id:'NSLD_KH', domainId:'nhan-su', domainName:'Nhân sự & Văn hóa', label:'KH/CBCNV', unit:'KH', direction:'higher', aggregate:'snapshot', decimals:0, aliases:['năng suất lao động theo khách hàng','khách hàng/lao động','kh/cbcnv'], pl1RowNo:46 },
  { id:'ATTT', domainId:'nhan-su', domainName:'Nhân sự & Văn hóa', label:'ATTT', unit:'%', direction:'higher', aggregate:'snapshot', decimals:0, aliases:['an toàn thông tin','attt'], pl1RowNo:55 },
];

export const KPI_BY_ID = Object.fromEntries(KPI_CATALOG.map((x)=>[x.id,x]));

export function normalizeLookup(text:string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9%><=]+/g,' ').replace(/\s+/g,' ').trim();
}
