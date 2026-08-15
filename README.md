# App Điều hành SXKD – Hybrid V1

Phương án triển khai tối ưu cho giai đoạn hiện tại:

**Vercel / Next.js frontend + Apps Script API tạm thời + Google Sheets database.**

Bản này đã được seed bằng dữ liệu thực tế từ 2 PDF:
- `1.PL1 Biểu mẫu thống kê-BC ĐHSX 7.2026.pdf`
- `4.Tổng hợp Báo cáo ĐHSX - BC ĐHSX 8.2026.pdf`

## 1. Vì sao chọn Hybrid

- Dựng UI 5 tab bằng Next.js/Vercel, dễ mở rộng và tối ưu mobile.
- Chưa phải viết lại toàn bộ backend Google ngay; Apps Script tiếp tục đọc/ghi Sheets.
- Frontend chỉ gọi `/api/dashboard` trên Vercel. Route này gọi Apps Script server-to-server; nếu chưa cấu hình Apps Script thì app tự chạy bằng PDF seed đi kèm.
- Khi backend Apps Script ổn định, có thể thay dần bằng Google Sheets API mà không phải làm lại giao diện.

## 2. Chạy local ngay

Yêu cầu Node.js >= 20.9.

```bash
npm install
npm run dev
```

Mở:

```text
http://localhost:3000
```

Không cần Google Sheet ở bước đầu: app sẽ hiển thị dữ liệu seed từ 2 PDF.

Kiểm tra API:

```text
http://localhost:3000/api/health
http://localhost:3000/api/dashboard
```

## 3. Kết nối Google Sheets qua Apps Script

Xem `apps-script/README.md`.

Sau khi deploy Apps Script, tạo `.env.local`:

```env
APPS_SCRIPT_API_URL=https://script.google.com/macros/s/...../exec
APPS_SCRIPT_API_KEY=chuoi-bi-mat-cua-ban
```

Khởi động lại:

```bash
npm run dev
```

Trên header app, nhãn dữ liệu sẽ chuyển từ **PDF seed** sang **Google Sheets**.

## 4. Deploy Vercel

Cách 1: đưa source lên GitHub và Import Project trong Vercel.

Cách 2 dùng CLI:

```bash
npm i -g vercel
vercel
```

Sau khi deploy, vào Project → Settings → Environment Variables để khai báo:

- `APPS_SCRIPT_API_URL`
- `APPS_SCRIPT_API_KEY`

Deploy lại.

## 5. 5 tab đã triển khai

### Điều hành
- 66 KPI: 60 đạt, 2 đạt một phần, 4 không đạt.
- KPI chính: điện thương phẩm, doanh thu, tổn thất, thu tiền, đo xa, ĐTXD.
- Cảnh báo ưu tiên và giải pháp tháng 8.

### Lĩnh vực
- Kinh doanh.
- Khách hàng & DVKH.
- Đo xa.
- Kỹ thuật.
- Đầu tư & Tài chính.
- Nhân sự & Văn hóa.

### Phân tích
- Điện thương phẩm: TH tháng 7, lũy kế 7 tháng, KH năm.
- SAIFI / SAIDI / MAIFI.
- Pareto nguyên nhân sự cố.
- ĐTXD / SCL.

**Không tạo số giả cho T1–T6** khi 2 PDF không có chuỗi tháng đầy đủ.

### Cảnh báo
- Cảnh báo nghiệp vụ theo đánh giá báo cáo.
- Hai sai khác giữa 2 PDF được tách thành `Kiểm tra dữ liệu nguồn`.

### Kế hoạch
- Các nhóm giải pháp/kế hoạch tháng 8 trích từ báo cáo.
- Không tự sinh deadline hay % tiến độ khi PDF không có.

## 6. Hai sai khác nguồn đã phát hiện

1. Kế hoạch giá bán điện bình quân:
   - PL1: **2.295 đ/kWh**.
   - Báo cáo tổng hợp: **2.259 đ/kWh**.

2. Lũy kế tiết kiệm điện:
   - PL1: **74,13 Tr.kWh**.
   - Báo cáo tổng hợp: **74,40 Tr.kWh**.

App không tự chọn số nào đúng. Khi dùng Google Sheets, hai trường này nằm ở `03_PDF_REVIEW` để người dùng xác nhận.

## 7. Giai đoạn tiếp theo

Sau khi V1 chạy ổn:

1. Hoàn thiện danh mục đủ 66 KPI trong `01_DM_CHITIEU`.
2. Nạp PDF hàng tháng bằng PDF.js.
3. Parser theo lĩnh vực → Staging.
4. Kiểm tra bất thường / sai khác nguồn.
5. Duyệt và ghi Google Sheets.
6. Tự hình thành chuỗi biểu đồ T1–T12.
7. Mở UI hiệu chỉnh; backend đã có nền móng `correctKpi` + `98_CHANGE_LOG`.
