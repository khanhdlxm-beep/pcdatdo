# Kiến trúc Hybrid

```text
Điện thoại / PC
      |
      v
Vercel + Next.js
  - UI 5 tab
  - /api/dashboard
      |
      | server-to-server
      v
Apps Script Web App
  - doGet bootstrap
  - doPost correction
      |
      v
Google Sheets
  - KPI tháng
  - sự cố
  - độ tin cậy
  - cảnh báo
  - kế hoạch
  - review sai khác
  - change log
```

## Fallback an toàn

Nếu `APPS_SCRIPT_API_URL` chưa được cấu hình hoặc Apps Script lỗi, `/api/dashboard` dùng `data/pdf-seed.ts` để app vẫn chạy demo.

## Quy tắc dữ liệu

- Không suy đoán chuỗi tháng còn thiếu.
- KPI càng thấp càng tốt (tổn thất, SAIFI, SAIDI, MAIFI, sự cố) được đánh giá theo ngưỡng riêng.
- Sai khác 2 nguồn PDF không tự ghi đè.
- Dữ liệu hiệu chỉnh phải lưu lịch sử.
