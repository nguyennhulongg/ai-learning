// Bỏ dấu, viết thường và gộp ký tự đặc biệt thành dấu cách, giữ nguyên phần trong ngoặc.
// Khác normalizeCompanyName ở chỗ không bỏ tên viết tắt như "(Techcombank)".
// Ví dụ "Hòa Phát" → "hoa phat", "quý" → "quy". Dùng được cả ở server lẫn trình duyệt.
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
