// Đổi thông báo lỗi kỹ thuật thành câu tiếng Việt ngắn gọn cho người dùng.
// Bản gốc vẫn được giữ trong DB và log để tra nguyên nhân.

const MAX_LENGTH = 120;

// Mẫu nhận diện lỗi và câu hiển thị. Mẫu đứng trước được ưu tiên.
const ERROR_SUMMARIES: [RegExp, string][] = [
  [/api.?key|unauthori[sz]ed|permission denied/i, "API key của AI không hợp lệ."],
  [/abort/i, "Đã huỷ xử lý."],
  [/failed query|database|postgres/i, "Lỗi cơ sở dữ liệu, hãy thử lại."],
  [/network|fetch failed|econn|etimedout|socket|timeout/i, "Lỗi kết nối, hãy thử lại."],
  [/traceback|tesseract|python|pymupdf/i, "Không đọc được nội dung file PDF."],
];

// Lấy số giờ chờ từ cụm "retry in 15h4m47s"; lỗi chờ ngắn hơn một giờ thì không có cụm giờ.
function summarizeQuota(message: string): string {
  const hours = message.match(/retry in (\d+)h/i)?.[1];
  return hours
    ? `Đã hết hạn mức AI, thử lại sau khoảng ${hours} giờ.`
    : "Đã hết hạn mức AI, hãy thử lại sau ít phút.";
}

// Tóm tắt một thông báo lỗi; lỗi chưa biết thì lấy dòng đầu và cắt bớt nếu quá dài.
export function summarizeError(message: string): string {
  if (/quota|rate.?limit/i.test(message)) return summarizeQuota(message);

  const known = ERROR_SUMMARIES.find(([pattern]) => pattern.test(message));
  if (known) return known[1];

  const firstLine = message.trim().split("\n")[0];
  return firstLine.length > MAX_LENGTH ? `${firstLine.slice(0, MAX_LENGTH)}...` : firstLine;
}
