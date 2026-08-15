# Apps Script backend

1. Tạo một Google Sheet mới, ví dụ `DB_DIEU_HANH_SXKD`.
2. Extensions → Apps Script.
3. Dán `Code.gs` vào dự án.
4. Chạy `seedJuly2026FromTwoPdfs()` một lần và cấp quyền.
5. Nên vào Project Settings → Script Properties tạo `API_KEY` (chuỗi bí mật do bạn tự đặt).
6. Deploy → New deployment → Web app.
   - Execute as: Me
   - Who has access: theo chính sách tài khoản của bạn. Vercel gọi server-to-server nên vẫn nên dùng `API_KEY`.
7. Copy URL kết thúc bằng `/exec`.
8. Trên Vercel đặt:
   - `APPS_SCRIPT_API_URL=<URL /exec>`
   - `APPS_SCRIPT_API_KEY=<API_KEY>`

API GET:
`?action=bootstrap&period=2026-07&apiKey=...`

API POST (đã có nền móng hiệu chỉnh KPI):
```json
{
  "action": "correctKpi",
  "apiKey": "...",
  "rowKey": "2026-07|KD_DTP",
  "field": "VALUE",
  "newValue": "1.041,607 Tr.kWh",
  "reason": "Đối chiếu PDF nguồn"
}
```

Lịch sử sửa được ghi vào `98_CHANGE_LOG`.
