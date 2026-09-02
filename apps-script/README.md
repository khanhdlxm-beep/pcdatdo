# Apps Script backend — Data Schema V1.8.2 / App V1.8.5

Google Sheets là database Production. Apps Script chỉ phục vụ dữ liệu PDF đã duyệt; không dùng seed/demo làm nguồn dữ liệu chính thức.

## File cần có trong Apps Script

- `Code.gs`
- `PdfImport.gs`
- `appsscript.json`

Các migration cũ `V18PeriodRepair.gs` và `V18ProductionUpgrade.gs` đã được tích hợp vào `PdfImport.gs` và nên xóa khỏi Apps Script nếu còn tồn tại.

## Cập nhật backend Production

1. Mở Google Sheet `Dieu hanh SXKD` → Extensions → Apps Script.
2. Đối chiếu `Code.gs` và `PdfImport.gs` với repository.
3. Save.
4. Deploy → Manage deployments → Edit → New version → Deploy.
5. Giữ nguyên Web App URL kết thúc bằng `/exec`.

Script Property bắt buộc:

```text
API_KEY=<khớp APPS_SCRIPT_API_KEY trên Vercel>
```

Vercel Production cần:

```text
APPS_SCRIPT_API_URL=<Web App URL /exec>
APPS_SCRIPT_API_KEY=<giống API_KEY>
PDF_ADMIN_PIN=<PIN quản trị>
PDF_ADMIN_SECRET=<secret riêng dùng ký phiên quản trị>
```

## Luồng dữ liệu

```text
PDF
→ browser PDF.js
→ parser
→ 03_PDF_STAGING
→ review
→ 06_KPI_HISTORY
→ Dashboard
```

Các bảo vệ chính:

- Tự nhận kỳ dữ liệu từ nội dung PDF.
- PERIOD chuẩn hóa `YYYY-MM` và lưu dạng Plain text.
- Không cho staging/approve rỗng.
- Chống trùng bằng fingerprint + parser version.
- Parser mới được phép reprocess PDF cũ; import cũ chỉ bị `SUPERSEDED` sau khi phiên mới duyệt thành công.
- `ROW_KEY = PERIOD|KPI_ID`: một KPI chỉ có một dòng chính thức trong một kỳ.
- `MANUAL_OVERRIDE` không bị PDF mới tự ghi đè.
- `NEED_REVIEW` và `CONFLICT` phải xử lý trước khi duyệt.
- `UNMAPPED` không ghi vào KPI history cho đến khi ánh xạ.
- HISTORY/STAGING/CHANGELOG ghi batch để giảm timeout.

## Nguyên tắc V1.8.5

Nâng cấp app không được tự sửa giá trị trong `06_KPI_HISTORY`. Health Score, Forecast, Early Warning và Trợ lý điều hành chỉ **đọc** dữ liệu đã duyệt và tính chỉ số phân tích ở lớp ứng dụng.

Nếu cần sửa số đã duyệt, dùng chức năng correction để tạo `MANUAL_OVERRIDE` và ghi `98_CHANGE_LOG`.

## Kiểm tra API

Health:

```text
?action=health&apiKey=...
```

Dashboard mới nhất:

```text
?action=bootstrap&period=latest&apiKey=...
```

Một kỳ cụ thể:

```text
?action=bootstrap&period=2026-05&apiKey=...
```

Không đưa `API_KEY` vào ảnh chụp, README public hoặc log chia sẻ bên ngoài.
