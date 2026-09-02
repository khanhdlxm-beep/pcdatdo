# Apps Script backend — V1.8.2 Production

Backend chính thức dùng Google Sheets làm database và chỉ phục vụ dữ liệu PDF đã duyệt. Không còn seed/demo trong Apps Script.

## File cần có trong Apps Script

- `Code.gs`
- `PdfImport.gs`
- `appsscript.json`

Các file migration cũ `V18PeriodRepair.gs` và `V18ProductionUpgrade.gs` đã được tích hợp vào `PdfImport.gs` và không còn cần thiết.

## Cập nhật Production

1. Extensions → Apps Script từ file Google Sheet `Dieu hanh SXKD`.
2. Thay toàn bộ nội dung `Code.gs` bằng bản trong repository.
3. Thay toàn bộ nội dung `PdfImport.gs` bằng bản trong repository.
4. Xóa `V18PeriodRepair.gs` và `V18ProductionUpgrade.gs` nếu còn trong Apps Script.
5. Save.
6. Deploy → Manage deployments → Edit → New version → Deploy.
7. Giữ nguyên Web App URL kết thúc bằng `/exec`.

Script Property cần có:

- `API_KEY`

Vercel Production cần:

- `USE_DEMO_DATA=false`
- `APPS_SCRIPT_API_URL=<Web App URL /exec>`
- `APPS_SCRIPT_API_KEY=<giống API_KEY trong Apps Script>`

## Luồng nhập PDF lịch sử

`PDF → browser PDF.js → parser → 03_PDF_STAGING → review → 06_KPI_HISTORY → Dashboard`

V1.8.2 có các bảo vệ sau:

- Tự nhận kỳ dữ liệu thực tế từ nội dung PDF. Ví dụ báo cáo họp tháng 08/2025 có thể phản ánh số thực hiện 07/2025; hệ thống dùng kỳ dữ liệu, không dùng tên file.
- PERIOD luôn được chuẩn hóa `YYYY-MM` và lưu dạng Plain text.
- Không cho tạo staging nếu nhận dạng được 0 KPI.
- Không cho Approve staging rỗng.
- Chống nhập trùng bằng fingerprint của PDF + phiên bản parser.
- Nếu PDF đã được duyệt bằng parser cũ, parser mới được phép reprocess một lần; import cũ được chuyển sang `SUPERSEDED` sau khi bản mới duyệt thành công.
- `ROW_KEY = PERIOD|KPI_ID`, vì vậy một KPI chỉ có một dòng chính thức trong một kỳ.
- `MANUAL_OVERRIDE` không bị PDF mới ghi đè trừ khi chủ động dùng force.
- NEED_REVIEW và CONFLICT bắt buộc xử lý trước khi duyệt.
- UNMAPPED không ghi vào KPI_HISTORY cho tới khi được ánh xạ KPI.
- Ghi HISTORY/STAGING/CHANGELOG theo batch để giảm thời gian chạy Apps Script.

## Thứ tự nhập lịch sử khuyến nghị

Nhập từng PDF theo thứ tự thời gian từ cũ đến mới. Có thể chọn tháng theo tên báo cáo; parser sẽ tự hiệu chỉnh về kỳ thực hiện được ghi trong PDF.

Sau mỗi PDF:

1. `Đọc & phân tích PDF`.
2. Kiểm tra kỳ mà app tự nhận.
3. Xử lý `Cần duyệt` / `Xung đột`.
4. `Duyệt staging → KPI_HISTORY`.
5. Chuyển sang PDF tiếp theo.

Nếu upload lại đúng PDF đã được duyệt bằng cùng parser, backend sẽ báo trùng và không tạo thêm dữ liệu.

## Kiểm tra nhanh API

GET health:

`?action=health&apiKey=...`

GET dashboard mới nhất:

`?action=bootstrap&period=latest&apiKey=...`

GET một kỳ:

`?action=bootstrap&period=2026-05&apiKey=...`

Lịch sử hiệu chỉnh được ghi trong `98_CHANGE_LOG`.
