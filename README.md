# App Điều hành SXKD — Production V1.8.5

Dashboard điều hành SXKD dùng **Next.js/Vercel + Google Apps Script + Google Sheets**. Production chỉ hiển thị dữ liệu PDF đã được duyệt vào `06_KPI_HISTORY`; không dùng số demo/seed làm dữ liệu chính thức.

## Kiến trúc

```text
PDF báo cáo
  ↓
PDF.js đọc trên trình duyệt
  ↓
Parser V1.8.3 Production
  ↓
03_PDF_STAGING
  ↓ review / xác nhận
06_KPI_HISTORY + 07_PERIOD_SUMMARY
  ↓
Apps Script API
  ↓
Next.js / Vercel
  ↓
Dashboard · Cảnh báo · Trợ lý điều hành · Hành động
```

Nguyên tắc dữ liệu: **không thay đổi số thực hiện/kế hoạch đã duyệt khi nâng cấp giao diện hoặc logic phân tích**. Mọi hiệu chỉnh sau duyệt phải đi qua chức năng correction và được ghi `98_CHANGE_LOG`/`MANUAL_OVERRIDE`.

## V1.8.5 Stabilization

V1.8.5 tập trung tăng độ tin cậy, không thêm số liệu giả:

- Giữ nguyên KPI/history đã duyệt.
- Tách rõ số KPI app đang theo dõi với tổng số chỉ tiêu của báo cáo nguồn.
- Health Score chỉ chấm trên thành phần có dữ liệu thực; hiển thị Data Coverage và Confidence.
- KPI `direction=info` không kéo Health Score lên/xuống.
- Forecast, Early Warning và Health Score dùng chung một Forecast engine.
- Forecast cần tối thiểu 6 kỳ hợp lệ; tự phát hiện điểm gãy khi lũy kế bị đổi mặt bằng và không nối hai chuỗi khác nhau.
- Action Center không tự sinh deadline/progress và phân biệt `Theo báo cáo` / `Gợi ý hệ thống` / `Người dùng tạo`.
- Dashboard có cache ngắn 60 giây; cache được xóa sau khi duyệt PDF.
- Có kiểm tra tự động TypeScript, Production build và đồng bộ KPI catalog.

## Môi trường Production

```env
APPS_SCRIPT_API_URL=https://script.google.com/macros/s/.../exec
APPS_SCRIPT_API_KEY=...
PDF_ADMIN_PIN=...
PDF_ADMIN_SECRET=...
WEATHER_USER_AGENT=sxkd-dashboard/1.8.5 contact@example.com
AI_MODE=local
```

`PDF_ADMIN_SECRET` nên là secret riêng, không dùng chung với API key. API health chỉ trả trạng thái cấu hình, không trả giá trị secret.

## Chạy local

Yêu cầu Node.js >= 20.9.

```bash
npm ci
npm run check
npm run dev
```

Kiểm tra Production build:

```bash
npm run build
```

Kiểm tra consistency:

```bash
npm run verify
```

`npm run verify` kiểm tra version, KPI catalog TypeScript ↔ Apps Script, Forecast engine thống nhất, Action Center không tự tạo deadline và loại bỏ dấu vết `USE_DEMO_DATA` khỏi source Production.

## Nhập PDF

Mở `/pdf-import` và nhập từng kỳ theo thứ tự thời gian.

Luồng chuẩn:

1. Chọn PDF.
2. `Đọc & phân tích PDF`.
3. Kiểm tra kỳ dữ liệu hệ thống tự nhận từ nội dung PDF.
4. Xử lý `Cần kiểm tra` / `Xung đột`.
5. Duyệt staging → `06_KPI_HISTORY`.
6. Kiểm tra Dashboard.

Backend chống trùng bằng fingerprint + parser version và `ROW_KEY = PERIOD|KPI_ID`. Nếu cùng PDF đã được duyệt bằng cùng parser, hệ thống không tạo thêm dữ liệu chính thức.

## Health / System info

```text
/api/health
```

Endpoint hiển thị an toàn:

- App version.
- Parser version.
- Data schema version.
- Apps Script configured hay chưa.
- PDF Admin có dedicated secret hay chưa.
- Weather configured hay chưa.

Không endpoint nào được phép trả PIN, API key hoặc secret.

## Quy ước phiên bản

- `APP_VERSION`: giao diện/logic điều hành.
- `PDF_PARSER_VERSION`: quy tắc đọc PDF.
- `DATA_SCHEMA_VERSION`: schema Apps Script/Google Sheets.

V1.8.5 không tự sửa số liệu KPI đã duyệt. Thay đổi logic Health/Forecast chỉ ảnh hưởng **chỉ số phân tích được tính từ dữ liệu**, không thay đổi dữ liệu gốc.
