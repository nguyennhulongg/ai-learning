import { foldText } from "@/utils/fold-text";
import type { InputSuggestion, SuggestionCatalog, SuggestionPeriod } from "./suggestions.types";

const MAX_SUGGESTIONS = 6;
// Gõ ít nhất 2 ký tự mới gợi ý mã, tránh hiện danh sách mỗi khi gõ một chữ cái.
const MIN_TICKER_PREFIX = 2;
// Gõ ít nhất 3 ký tự mới so khớp theo tên công ty ("hoa" → Hòa Phát).
const MIN_NAME_PREFIX = 3;

// Tiền tố (đã bỏ dấu) kích hoạt gợi ý kỳ: "q", "qu", "quy" → các quý; "n", "na", "nam" → các năm.
const QUARTER_WORD = "quy";
const YEAR_WORD = "nam";

// Viết kỳ báo cáo thành chữ để chèn vào câu hỏi, ví dụ "quý 4 năm 2020" hoặc "năm 2020".
function periodText(period: SuggestionPeriod): string {
  return period.fiscalQuarter === 0
    ? `năm ${period.fiscalYear}`
    : `quý ${period.fiscalQuarter} năm ${period.fiscalYear}`;
}

// Tách nội dung ô nhập thành phần đứng trước và "từ đang gõ dở" ở cuối.
// Kết thúc bằng khoảng trắng nghĩa là người dùng đã gõ xong từ → không có từ đang gõ.
function splitCurrentWord(text: string): { before: string; word: string } {
  const match = text.match(/(\S+)$/);
  if (!match) return { before: text, word: "" };
  return { before: text.slice(0, text.length - match[1].length), word: match[1] };
}

// Mã cổ phiếu gần nhất đã gõ trong câu (bỏ qua từ đang gõ dở), dùng để biết gợi ý kỳ của mã nào.
// So không phân biệt hoa thường: "hpg" cũng tính là HPG.
function findLastTicker(text: string, catalog: SuggestionCatalog) {
  const tokens = text.toUpperCase().split(/[^A-Z0-9]+/).reverse();
  for (const token of tokens) {
    const company = catalog.find((c) => c.ticker === token);
    if (company) return company;
  }
  return undefined;
}

// Gợi ý mã cổ phiếu khớp với từ đang gõ: theo đầu mã ("HP" → HPG) hoặc đầu một chữ trong tên ("hoa" → Hòa Phát).
function suggestTickers(
  before: string,
  word: string,
  catalog: SuggestionCatalog,
): InputSuggestion[] {
  const upper = word.toUpperCase();
  const folded = foldText(word);

  return catalog
    .filter((company) => {
      // Đã gõ đủ mã thì không gợi ý nữa, để Enter gửi tin luôn thay vì chọn lại chính mã đó.
      if (company.ticker === upper) return false;
      const tickerMatch = word.length >= MIN_TICKER_PREFIX && company.ticker.startsWith(upper);
      const nameMatch =
        folded.length >= MIN_NAME_PREFIX && ` ${foldText(company.name)}`.includes(` ${folded}`);
      return tickerMatch || nameMatch;
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((company) => ({
      nextText: `${before}${company.ticker} `,
      title: company.ticker,
      description: company.name,
    }));
}

// Gợi ý kỳ báo cáo của mã đã gõ trước đó, khi từ đang gõ là đầu của "quý" hoặc "năm".
// Chỉ gợi ý những kỳ thật sự có trong DB, mới nhất trước.
function suggestPeriods(
  before: string,
  word: string,
  catalog: SuggestionCatalog,
): InputSuggestion[] {
  const folded = foldText(word);
  if (!folded) return [];

  const wantsQuarter = QUARTER_WORD.startsWith(folded);
  const wantsYear = YEAR_WORD.startsWith(folded);
  if (!wantsQuarter && !wantsYear) return [];

  const company = findLastTicker(before, catalog);
  if (!company) return [];

  return company.periods
    .filter((period) => (wantsQuarter ? period.fiscalQuarter !== 0 : period.fiscalQuarter === 0))
    .slice(0, MAX_SUGGESTIONS)
    .map((period) => ({
      nextText: `${before}${periodText(period)} `,
      title: periodText(period),
      description: `Báo cáo ${company.ticker} đã có`,
    }));
}

// Tính danh sách gợi ý cho nội dung hiện tại của ô nhập.
// Ưu tiên gợi ý kỳ (khi đang gõ "quý"/"năm" sau một mã), nếu không có thì gợi ý mã.
export function getInputSuggestions(
  text: string,
  catalog: SuggestionCatalog | undefined,
): InputSuggestion[] {
  if (!catalog || catalog.length === 0) return [];

  const { before, word } = splitCurrentWord(text);
  if (!word) return [];

  const periods = suggestPeriods(before, word, catalog);
  if (periods.length > 0) return periods;

  return suggestTickers(before, word, catalog);
}
