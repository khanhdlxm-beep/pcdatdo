// Tâm địa bàn xấp xỉ để lấy dự báo thời tiết cấp khu vực.
// Có thể hiệu chỉnh lat/lon theo địa bàn quản lý thực tế mà không sửa UI.
export const MANAGEMENT_AREAS = [
  { id:'dat-do', name:'Đất Đỏ', lat:10.49, lon:107.27 },
  { id:'long-dien', name:'Long Điền', lat:10.48, lon:107.21 },
  { id:'xuyen-moc', name:'Xuyên Mộc', lat:10.63, lon:107.43 },
  { id:'chau-duc', name:'Châu Đức', lat:10.66, lon:107.25 },
] as const;
