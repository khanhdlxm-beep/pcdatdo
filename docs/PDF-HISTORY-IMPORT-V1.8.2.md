# PDF History Import V1.8.2

Mục tiêu: nhập lại chuỗi PDF lịch sử từ báo cáo tháng 08/2025 đến tháng 06/2026 theo đúng kỳ dữ liệu thực hiện, không tạo bản trùng.

## Nguyên tắc kỳ dữ liệu

Tên file/báo cáo là tháng họp, nhưng kỳ dữ liệu có thể là tháng trước. Parser ưu tiên dòng `Thực hiện M/YYYY` hoặc `Tháng báo cáo M/YYYY` nằm trong PDF.

Ví dụ: báo cáo họp tháng 09/2025 có cột `Thực hiện 08/2025` nên được ghi vào `2025-08`.

## Thứ tự vận hành

1. Upload một PDF mỗi lần, theo thứ tự báo cáo từ cũ đến mới.
2. Bấm `Đọc & phân tích PDF`.
3. Kiểm tra kỳ app tự nhận.
4. Xử lý toàn bộ `Cần duyệt` và `Xung đột`.
5. `Chưa ánh xạ` có thể bỏ qua hoặc ánh xạ nếu cần ghi KPI đó.
6. Bấm `Duyệt staging → KPI_HISTORY`.
7. Chỉ khi duyệt thành công mới chuyển sang PDF tiếp theo.

## Chống trùng

Backend dùng fingerprint PDF + parser version.

- Cùng PDF + cùng parser + cùng kỳ: chặn ngay, không tạo staging mới.
- Cùng PDF nhưng đã được duyệt bằng parser cũ: cho reprocess một lần.
- Sau khi bản parser mới duyệt thành công, import cũ chuyển `SUPERSEDED` và dữ liệu lịch sử cũ của import đó được dọn.
- `ROW_KEY = PERIOD|KPI_ID` đảm bảo một KPI chỉ có một dòng chính thức trong một kỳ.

## Bảo vệ dữ liệu

- 0 KPI: không tạo staging.
- staging rỗng: không được Approve.
- NEED_REVIEW/CONFLICT: chặn Approve.
- MANUAL_OVERRIDE: không bị PDF ghi đè.
- Giá trị bất thường (%, Tr.kWh quá lớn, số giống năm ở công tơ, tiếp cận điện năng quá lớn...) tự chuyển NEED_REVIEW.

## Sau khi nhập xong

Kiểm tra `06_KPI_HISTORY`:

- PERIOD chỉ có dạng `YYYY-MM`.
- Không có hai dòng cùng `ROW_KEY`.
- Không còn dữ liệu của import `SUPERSEDED` trừ dòng `MANUAL_OVERRIDE` được giữ có chủ đích.

Dashboard phải mở kỳ mới nhất dựa trên PERIOD đã chuẩn hóa, không dựa trên chuỗi Date của Google Sheets.
