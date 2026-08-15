import type { DashboardBootstrap } from '@/types/dashboard';

// Seed dữ liệu chỉ lấy từ 2 PDF người dùng cung cấp.
// Không điền chuỗi T1-T6 khi PDF không cung cấp trực tiếp.
export const pdfSeed: DashboardBootstrap = {
  ok: true,
  period: '2026-07',
  reportingDate: '31/07/2026',
  dataMode: 'pdf-seed',
  sourceLabel: 'PL1 chỉ tiêu 7/2026 + Báo cáo ĐHSX kỳ họp 8/2026',
  summary: { total: 66, pass: 60, partial: 2, fail: 4 },
  headline: [
    { id: 'KD_DTP', label: 'Điện thương phẩm', value: '1.041,607 Tr.kWh', detail: 'Tháng 7: 165,479', plan: 'KH năm: 1.613 Tr.kWh · 64,54%', tone: 'good', status: 'Đạt', sourcePage: 1 },
    { id: 'KD_DT', label: 'Tổng doanh thu', value: '2.361,42 tỷ', detail: 'Tháng 7: 376,54 tỷ', plan: 'KH năm: 3.647,667 tỷ · 64,73%', tone: 'good', status: 'Đạt', sourcePage: 1 },
    { id: 'KD_TT', label: 'Tổn thất điện năng', value: '2,90%', detail: 'Tháng 7: 2,53%', plan: 'KH ≤ 3,12%', tone: 'good', status: 'Đạt', sourcePage: 1 },
    { id: 'THU_TIEN', label: 'Tỷ lệ thu tiền điện', value: '99,98%', detail: 'Tháng 7: 99,90%', plan: 'KH: 99,70%', tone: 'good', status: 'Đạt', sourcePage: 6 },
    { id: 'DX_KN', label: 'Kết nối đo xa', value: '98,20%', detail: '216.796 điểm kết nối', plan: '220.767 điểm đã khai báo', tone: 'warn', status: 'Theo dõi', sourcePage: 6 },
    { id: 'DTXD', label: 'ĐTXD', value: '97,064 tỷ', detail: '34,3% KH năm', plan: 'Giải ngân: 47,482 tỷ · 16,8%', tone: 'bad', status: 'Không đạt tiến độ', sourcePage: 12 },
  ],
  fields: [
    {
      id: 'kinh-doanh', title: 'Kinh doanh', items: [
        { id: 'KD_DTP', label: 'Điện thương phẩm', value: '64,54%', detail: '1.041,607 / 1.613 Tr.kWh', tone: 'good', status: 'Đạt' },
        { id: 'KD_DT', label: 'Doanh thu', value: '64,73%', detail: '2.361,42 / 3.647,667 tỷ', tone: 'good', status: 'Đạt' },
        { id: 'KD_GIA', label: 'Giá bán điện BQ', value: '2.264,64 đ/kWh', detail: 'KH trong BC tổng hợp: 2.259', tone: 'good', status: 'Đạt' },
        { id: 'KD_TT', label: 'Tổn thất', value: '2,90%', detail: 'KH ≤ 3,12%', tone: 'good', status: 'Đạt' },
      ],
    },
    {
      id: 'dvkh', title: 'Khách hàng & DVKH', items: [
        { id: 'CRM', label: 'CRM đã xử lý', value: '4.574 / 4.693', detail: 'Còn 119 đang xử lý', tone: 'good', status: '97,46%' },
        { id: 'GANMOI', label: 'Gắn mới điện kế', value: '710', detail: 'Lũy kế 4.338 · 1,894 ngày BQ', tone: 'good', status: 'Không có quá hạn' },
        { id: 'HDMBD', label: 'HĐMBĐ ngoài sinh hoạt', value: '2.092 / 8.081', detail: '25,9% KH', tone: 'bad', status: 'Không đạt' },
        { id: 'TC_DN', label: 'Tiếp cận điện năng', value: '2,57 ngày', detail: '51 công trình lũy kế', tone: 'good', status: '≤ 3 ngày' },
      ],
    },
    {
      id: 'do-xa', title: 'Đo xa', items: [
        { id: 'DX_KB', label: 'Khai báo', value: '99,50%', detail: '220.767 / 221.867', tone: 'good', status: 'Tốt' },
        { id: 'DX_KN', label: 'Kết nối', value: '98,20%', detail: '216.796 điểm', tone: 'warn', status: 'Theo dõi' },
        { id: 'DX_HD', label: 'Khai thác hóa đơn', value: '98,23%', detail: '203.494 điểm', tone: 'warn', status: 'Theo dõi' },
        { id: 'DX_MK', label: 'Mất kết nối >48h', value: '3.678', detail: 'Theo dõi theo hãng công tơ', tone: 'warn', status: 'Cần xử lý' },
      ],
    },
    {
      id: 'ky-thuat', title: 'Kỹ thuật', items: [
        { id: 'KT_SC', label: 'Sự cố trung thế', value: '79 / 61,25', detail: 'Tháng 7: 15 vụ', tone: 'bad', status: 'Không đạt 7T' },
        { id: 'SAIFI', label: 'SAIFI', value: '1,6288', detail: 'KH 7T: 1,71', tone: 'good', status: 'Đạt' },
        { id: 'SAIDI', label: 'SAIDI', value: '199,9833', detail: 'KH 7T: 223,42 phút', tone: 'good', status: 'Đạt' },
        { id: 'MAIFI', label: 'MAIFI', value: '0,0428', detail: 'KH 7T: 0,29', tone: 'good', status: 'Đạt' },
      ],
    },
    {
      id: 'dau-tu-tai-chinh', title: 'Đầu tư & Tài chính', items: [
        { id: 'DTXD', label: 'ĐTXD', value: '34,3%', detail: '97,064 / 283,200 tỷ', tone: 'bad', status: 'Không đạt' },
        { id: 'SCL', label: 'SCL', value: '81,03%', detail: '29,712 / 36,669 tỷ', tone: 'bad', status: 'Không đạt tiến độ' },
        { id: 'TONKHO', label: 'Tồn kho', value: '16,069 tỷ', detail: 'Định mức 21,8 tỷ · 73%', tone: 'good', status: 'Trong định mức' },
        { id: 'CHIPHI', label: 'Chi phí định mức', value: '19,38 đ/kWh', detail: 'KH: 17,47 đ/kWh', tone: 'bad', status: 'Không đạt' },
      ],
    },
    {
      id: 'nhan-su', title: 'Nhân sự & Văn hóa', items: [
        { id: 'CBCNV', label: 'CBCNV', value: '355', detail: '297 nam · 58 nữ', tone: 'neutral', status: 'Thông tin' },
        { id: 'DT_GIO', label: 'Giờ đào tạo', value: '41,69 giờ/LĐ', detail: 'KH ≥ 40 · 104,23%', tone: 'good', status: 'Đạt' },
        { id: 'NSLD_KH', label: 'KH/CBCNV', value: '625 / 637', detail: '98% chỉ tiêu', tone: 'bad', status: 'Chưa đạt' },
        { id: 'ATTT', label: 'ATTT', value: '100%', detail: 'Phổ biến quy trình, ứng cứu', tone: 'good', status: 'Đạt' },
      ],
    },
  ],
  reliability: [
    { id: 'SAIFI', unit: 'lần', targetYear: 2.93, targetPeriod: 1.71, month: 0.2512, ytd: 1.6288, status: 'Đạt' },
    { id: 'SAIDI', unit: 'phút', targetYear: 383, targetPeriod: 223.42, month: 35.8221, ytd: 199.9833, status: 'Đạt' },
    { id: 'MAIFI', unit: 'lần', targetYear: 0.5, targetPeriod: 0.29, month: 0, ytd: 0.0428, status: 'Đạt' },
  ],
  incidentCauses: [
    { label: 'Sét', monthValue: 6, monthShare: 40, ytdValue: 27, ytdShare: 34.18 },
    { label: 'Động vật', monthValue: 4, monthShare: 26.67, ytdValue: 19, ytdShare: 24.05 },
    { label: 'Phóng sứ thiết bị', monthValue: 0, monthShare: 0, ytdValue: 7, ytdShare: 8.86 },
    { label: 'Hư VTTB khách hàng', monthValue: 0, monthShare: 0, ytdValue: 7, ytdShare: 8.86 },
    { label: 'Cây', monthValue: 3, monthShare: 20, ytdValue: 4, ytdShare: 5.06 },
  ],
  alerts: [
    { id: 'A_SC', title: 'Sự cố lưới trung thế vượt chỉ tiêu 7 tháng', current: '79 vụ', target: '≤ 61,25 vụ', note: 'Báo cáo đánh giá không đạt chỉ tiêu 7T.', domain: 'Kỹ thuật', severity: 'red', sourcePage: 8 },
    { id: 'A_BT', title: 'Bảo trì TBĐĐ không đạt tiến độ', current: '3.412 / 12.422 và 5.611 / 37.196', target: 'Theo KH năm', note: 'Báo cáo tổng hợp đánh giá Không đạt.', domain: 'Kinh doanh', severity: 'red', sourcePage: 2 },
    { id: 'A_VP', title: 'Kiểm tra xử lý vi phạm sử dụng điện', current: '3.752 kWh', target: '90.000 kWh', note: 'Mức thực hiện 4,1%; báo cáo đánh giá Không đạt.', domain: 'Kinh doanh', severity: 'red', sourcePage: 2 },
    { id: 'A_DTXD', title: 'Công tác ĐTXD chưa đạt tiến độ', current: '34,3% giá trị KH năm', target: '283,200 tỷ', note: 'Giải ngân lũy kế 47,482 tỷ, tương ứng 16,8%.', domain: 'ĐTXD', severity: 'red', sourcePage: 12 },
    { id: 'A_SCL', title: 'Công tác SCL chưa đạt tiến độ', current: '81,03% giá trị thực hiện', target: '36,669 tỷ', note: 'Phần đánh giá tổng hợp xếp SCL là không đạt.', domain: 'SCL', severity: 'red', sourcePage: 13 },
    { id: 'A_HD', title: 'HĐMBĐ hết hiệu lực đạt một phần', current: 'Ngoài sinh hoạt: 2.092 / 8.081', target: 'Hoàn thành kế hoạch', note: 'HĐMBĐ ngoài sinh hoạt không đạt.', domain: 'DVKH', severity: 'yellow', sourcePage: 2 },
    { id: 'A_NS', title: 'Năng suất lao động đạt một phần', current: '625 KH/CBCNV', target: '637 KH/CBCNV', note: 'Chỉ tiêu khách hàng/CBCNV chưa đạt.', domain: 'Nhân sự', severity: 'yellow', sourcePage: 16 },
  ],
  conflicts: [
    { id: 'C_GIA', label: 'Kế hoạch giá bán điện bình quân', sourceA: 'PL1 chỉ tiêu 21', valueA: '2.295 đ/kWh', sourceB: 'BC ĐHSX – bảng SXKD chính', valueB: '2.259 đ/kWh', recommendation: 'Không tự chọn. Đánh dấu cần xác nhận nguồn kế hoạch ưu tiên trước khi ghi DB chính.' },
    { id: 'C_TKD', label: 'Lũy kế tiết kiệm điện', sourceA: 'PL1 chỉ tiêu 2', valueA: '74,13 Tr.kWh', sourceB: 'BC ĐHSX – chỉ tiêu SXKD', valueB: '74,40 Tr.kWh', recommendation: 'Giữ cả 2 giá trị ở staging, yêu cầu duyệt một giá trị cuối cùng.' },
  ],
  plans: [
    { id: 'P1', owner: 'Đội QLHTĐĐ', title: 'Tiếp tục kế hoạch kiện toàn hệ thống đo đếm, đẩy nhanh kiểm tra niêm chì và bảo trì công tơ/SCL HTĐĐ.', status: 'Kế hoạch tháng 8' },
    { id: 'P2', owner: 'Đội QLVH', title: 'Phối hợp lắp đặt thiết bị đóng cắt SCADA; kiểm tra Accu Recloser; lập phương án cấp điện phục vụ 2/9.', status: 'Kế hoạch tháng 8' },
    { id: 'P3', owner: 'Phòng KTAT / Đội QLLĐ', title: 'Theo dõi tải TBA, xử lý non/quá tải và kiểm tra các phát tuyến/TBA có tổn thất cao.', status: 'Kế hoạch tháng 8' },
    { id: 'P4', owner: 'Khối ĐTXD', title: 'Theo dõi phương án ĐTXD 2027, triển khai xây lắp 2026 và lắp đặt thiết bị tự động hóa.', status: 'Kế hoạch tháng 8' },
    { id: 'P5', owner: 'Phòng KD / QLHTĐĐ', title: 'Gắn mới, di dời công tơ và xử lý khiếu nại liên quan chỉ số, không để trường hợp quá hạn.', status: 'Kế hoạch tháng 8' },
  ],
  notes: [
    'Hai PDF hiện tại chỉ cung cấp đầy đủ số tháng 7 và lũy kế đến tháng 7 cho nhiều KPI; không có chuỗi T1–T6 của từng KPI để dựng xu hướng tháng mà không suy đoán.',
    'Tab Phân tích vì vậy dùng số T7, lũy kế, kế hoạch và các bảng có chuỗi thật; chuỗi 12 tháng sẽ hình thành tự động khi nạp PDF từng kỳ tiếp theo.',
    'Các sai khác giữa 2 PDF được đưa vào Cảnh báo dữ liệu thay vì tự động ghi đè.',
  ],
};
