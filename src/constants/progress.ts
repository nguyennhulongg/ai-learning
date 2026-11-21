// Một thanh tiến độ duy nhất chạy xuyên suốt quá trình xử lý tài liệu.
// Các mốc dưới đây chia thanh theo thời gian mỗi giai đoạn thường tốn, OCR là lâu nhất.

export type DocumentProgress = {
  percent: number;
  label: string;
};

// Mốc phần trăm kết thúc từng giai đoạn.
const UPLOAD_END = 10;
const OCR_END = 90;
const EXTRACTING_PERCENT = 95;

export const WAITING_PROGRESS: DocumentProgress = { percent: 0, label: "Đang chờ" };

export const PREPARING_PROGRESS: DocumentProgress = {
  percent: UPLOAD_END,
  label: "Đang chuẩn bị",
};

export const EXTRACTING_PROGRESS: DocumentProgress = {
  percent: EXTRACTING_PERCENT,
  label: "Đang trích số liệu",
};

// Tiến độ khi đang tải file lên, uploaded là phần trăm đã gửi của riêng giai đoạn này.
export function uploadProgress(uploaded: number): DocumentProgress {
  return { percent: Math.round((uploaded / 100) * UPLOAD_END), label: "Đang tải lên" };
}

// Tiến độ khi đang OCR, tính theo số trang đã xong.
export function ocrProgress(current: number, total: number): DocumentProgress {
  return {
    percent: Math.round(UPLOAD_END + (current / total) * (OCR_END - UPLOAD_END)),
    label: `Đang đọc trang ${current}/${total}`,
  };
}
