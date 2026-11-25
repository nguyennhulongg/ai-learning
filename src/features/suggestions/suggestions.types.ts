// Một kỳ báo cáo. fiscalQuarter: 1-4 là quý, 0 là cả năm (giống bảng reports).
export interface SuggestionPeriod {
  fiscalYear: number;
  fiscalQuarter: number;
}

// Danh mục gợi ý: mỗi phần tử là một công ty đã có báo cáo, kèm các kỳ (mới nhất trước).
export type SuggestionCatalog = {
  ticker: string;
  name: string;
  periods: SuggestionPeriod[];
}[];

// Một gợi ý hiển thị trong danh sách.
// - nextText: toàn bộ nội dung ô nhập sau khi chọn gợi ý này (đã thay chữ đang gõ dở).
// - title / description: dòng chính và dòng phụ hiển thị trong danh sách.
export interface InputSuggestion {
  nextText: string;
  title: string;
  description: string;
}
