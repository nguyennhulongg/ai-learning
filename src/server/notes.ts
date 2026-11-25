// Đọc phần thuyết minh báo cáo tài chính, dùng chung cho chatbot và MCP server.
//
// Thuyết minh giải thích các con số trên báo cáo chính: khoản phải thu gồm những gì, ai đang
// nợ, đầu tư vào công ty con nào, vì sao số đầu năm bị phân loại lại... Phần này là văn bản
// kèm bảng tự do, mỗi công ty trình bày một kiểu, nên không lưu thành từng con số như
// financial_facts mà tìm thẳng trong text OCR đã lưu ở file_contents.
//
// Cách tìm:
//   1. Lấy các trang từ trang thuyết minh đầu tiên trở đi, bỏ trang báo cáo chính.
//   2. Bỏ các dòng lặp lại trên nhiều trang (địa chỉ, số điện thoại ở chân trang).
//   3. Chấm điểm từng dòng theo số từ khoá có mặt, so ở dạng không dấu vì OCR hay mất dấu.
//   4. Trả về đoạn văn quanh các dòng khớp nhất, kèm số trang.
//
// Không tìm theo số mục (ví dụ "VI.3"), vì OCR hay đọc sai số mục: "VI.3" thành "V1.3",
// và tiêu đề "3. Phải thu khác" có thể thành "4. Pp hai thu khac". Tên mục thì ít hỏng hơn.
//
// Thuật ngữ:
//   - Full-text search: tìm theo từ có trong văn bản, khác với tìm theo nghĩa (embedding).
//     Ở đây tự chấm điểm bằng code vì chỉ tìm trong một file, không cần index của DB.
//   - Boilerplate: phần chữ lặp lại trên mọi trang, như đầu trang và chân trang.

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { fileContents } from "@/db/schema";
import { isNotesPage, isStatementPage, type ExtractablePage } from "./extract-financials";
import { type Report } from "@/db/schema";
import {
  bigChangeFacts,
  describePeriod,
  findReport,
  foldText,
  listReports,
  loadSourceFile,
  searchLineItems,
  toSummary,
  type PeriodQuery,
} from "./financials";

// Tỷ lệ từ khoá tối thiểu phải có trong một dòng thì dòng đó mới tính là khớp.
// Không đòi đủ 100%, vì OCR có thể làm hỏng một vài từ.
const MIN_MATCH_RATIO = 0.6;

// Đoạn chỉ được giữ khi điểm đạt ít nhất tỷ lệ này so với đoạn khớp nhất,
// để không kèm các đoạn chỉ tình cờ có vài từ giống.
const MIN_RELATIVE_SCORE = 0.75;

// Số dòng tối đa lùi lên để tìm tiêu đề mục chứa dòng khớp, nhờ đó đoạn trích có cả
// tên mục và tiêu đề cột (ví dụ "30/09/2026 01/01/2026").
const MAX_LINES_TO_HEADING = 15;

// Số dòng lấy trước dòng khớp khi không tìm thấy tiêu đề mục ở gần.
const LINES_BEFORE = 4;

// Số dòng lấy sau dòng khớp, đủ cho một bảng chi tiết cỡ vừa.
const LINES_AFTER = 30;

// Dòng ngắn hơn chừng này chữ cái và chữ số là rác OCR (vết dấu mộc, chữ ký, số lẻ).
const MIN_LINE_CHARS = 3;

// Từ quá phổ biến trong báo cáo tài chính (đã bỏ dấu), không giúp phân biệt đoạn nào liên quan.
// Bỏ khỏi từ khoá khi chấm điểm, để "các khoản phải thu" không khớp mọi dòng có "các khoản".
const STOP_WORDS = new Set([
  "cac", "khoan", "va", "cua", "la", "duoc", "trong", "cho", "theo", "voi", "tu", "den",
  "co", "khong", "nay", "do", "mot", "nhung", "ve", "tai", "khi", "thi", "bao", "nhieu",
]);

// Dòng đầu trang theo mẫu VAS (đã bỏ dấu), lặp ở mọi trang nhưng OCR làm lệch phần đầu dòng
// nên cách so chữ ký đầu dòng không bắt được.
const FORM_HEADER_PATTERNS = [
  /mau so b ?0\d/,
  /ban hanh theo thong tu/,
  /cua bo tai chinh/,
  /thuyet minh bao cao tai chinh/,
];

// Số chữ đầu dòng dùng để nhận ra dòng lặp. Chỉ so phần đầu, vì OCR hay thêm ký tự rác
// khác nhau ở cuối dòng chân trang.
const SIGNATURE_WORDS = 3;

// Số đoạn trích tối đa cho một lần tìm.
const MAX_EXCERPTS = 3;

// Số ký tự tối đa của một đoạn trích. Kết quả gửi cho AI, nên giới hạn để không tốn
// hạn mức token của model (tiếng Việt tốn nhiều token hơn tiếng Anh).
const MAX_EXCERPT_CHARS = 1800;

// Số tiêu đề mục tối đa trả về khi không tìm thấy gì, để AI thử lại bằng tên mục đúng.
const MAX_HEADINGS = 40;

// Một dòng lặp lại trên ít nhất chừng này trang thuyết minh, và trên quá nửa số trang
// (BOILERPLATE_PAGE_RATIO), thì coi là đầu trang hoặc chân trang.
const MIN_BOILERPLATE_PAGES = 4;
const BOILERPLATE_PAGE_RATIO = 0.5;

// Dòng giống tiêu đề mục: bắt đầu bằng số La Mã hoặc số thứ tự rồi dấu chấm và khoảng trắng,
// ví dụ "VI. THÔNG TIN..." hoặc "2. Đầu tư vào công ty con". Số tiền như "1.366.884" không
// khớp vì sau dấu chấm là chữ số, không phải khoảng trắng.
const HEADING_PATTERN = /^(?:[IVX]{1,4}|\d{1,2})[.,)]\s+\S/;

type NoteLine = {
  page: number;
  text: string;
  // Dạng không dấu, viết thường, dùng để so khớp.
  folded: string;
};

export type NoteExcerpt = {
  pages: number[];
  text: string;
};

// Chữ ký của một dòng để nhận ra dòng lặp: vài chữ đầu dòng, đã bỏ dấu và bỏ chữ số,
// vì chân trang thường chỉ khác nhau ở số trang và ký tự rác cuối dòng.
function lineSignature(text: string): string {
  return foldText(text)
    .replace(/[0-9]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, SIGNATURE_WORDS)
    .join(" ");
}

// Lấy các dòng của phần thuyết minh theo thứ tự trong file, đã bỏ dòng trống và dòng lặp.
function collectNoteLines(pages: ExtractablePage[]): NoteLine[] {
  const firstNotesIndex = pages.findIndex(isNotesPage);
  if (firstNotesIndex < 0) return [];

  // Lấy mọi trang từ trang thuyết minh đầu tiên, kể cả trang OCR làm mất tiêu đề,
  // chỉ bỏ trang báo cáo chính nếu có xen giữa.
  const notePages = pages.slice(firstNotesIndex).filter((page) => !isStatementPage(page));

  // Đếm số trang chứa mỗi chữ ký dòng.
  const pagesBySignature = new Map<string, number>();
  for (const page of notePages) {
    const signatures = new Set(page.text.split("\n").map(lineSignature).filter(Boolean));
    for (const signature of signatures) {
      pagesBySignature.set(signature, (pagesBySignature.get(signature) ?? 0) + 1);
    }
  }
  const minRepeats = Math.max(
    MIN_BOILERPLATE_PAGES,
    Math.ceil(notePages.length * BOILERPLATE_PAGE_RATIO),
  );

  return notePages.flatMap((page) =>
    page.text
      .split("\n")
      .map((text) => ({ page: page.page_number, text: text.trim(), folded: foldText(text) }))
      .filter((line) => {
        if (line.folded.replace(/\s/g, "").length < MIN_LINE_CHARS) return false;
        if (FORM_HEADER_PATTERNS.some((pattern) => pattern.test(line.folded))) return false;
        const signature = lineSignature(line.text);
        return !signature || (pagesBySignature.get(signature) ?? 0) < minRepeats;
      }),
  );
}

// Chấm điểm một dòng: tỷ lệ từ khoá có trong dòng, cộng 1 nếu dòng chứa nguyên cụm từ khoá.
// Trả về 0 nếu dòng có quá ít từ khoá.
function scoreNoteLine(line: NoteLine, words: string[], phrase: string): number {
  const lineWords = new Set(line.folded.split(" "));
  const ratio = words.filter((word) => lineWords.has(word)).length / words.length;
  if (ratio < MIN_MATCH_RATIO) return 0;
  return ratio + (line.folded.includes(phrase) ? 1 : 0);
}

// Số dòng cuối trang được xét để tìm dòng tổng; chân trang còn sót có thể nằm sau dòng tổng.
const TOTAL_LOOKBACK_LINES = 3;

// Trang kết thúc bằng dòng tổng của bảng ("Cộng", "Tổng cộng") trong vài dòng cuối,
// tức bảng đã hết ở trang này. pageStart là vị trí dòng đầu tiên của trang kế tiếp.
// Dùng để dừng đoạn trích khi OCR làm hỏng số của tiêu đề mục kế tiếp.
function endsWithTotal(lines: NoteLine[], pageStart: number): boolean {
  const lastPage = lines[pageStart - 1].page;
  for (let i = pageStart - 1; i >= Math.max(0, pageStart - TOTAL_LOOKBACK_LINES); i--) {
    if (lines[i].page !== lastPage) break;
    if (/^(tong )?cong\b/.test(lines[i].folded)) return true;
  }
  return false;
}

// Xác định đoạn trích quanh dòng khớp ở vị trí index:
//   - Đầu đoạn: tiêu đề mục gần nhất phía trên trên cùng trang (trong MAX_LINES_TO_HEADING
//     dòng), không có thì lùi LINES_BEFORE dòng. Không lùi sang trang trước, vì OCR hay làm
//     hỏng số của tiêu đề ("2." thành "ya"), khi đó sẽ lùi nhầm về mục trước đó.
//   - Cuối đoạn: trước tiêu đề mục kế tiếp, tối đa LINES_AFTER dòng sau dòng khớp.
// end là vị trí ngay sau dòng cuối cùng (không lấy dòng end).
function excerptBounds(lines: NoteLine[], index: number): { start: number; end: number } {
  const page = lines[index].page;
  let start = index;
  let headingFound = false;
  for (let i = index; i >= Math.max(0, index - MAX_LINES_TO_HEADING); i--) {
    if (lines[i].page !== page) break;
    start = i;
    if (HEADING_PATTERN.test(lines[i].text)) {
      headingFound = true;
      break;
    }
  }
  // Không có tiêu đề: lùi LINES_BEFORE dòng, nhưng vẫn không lùi sang trang trước.
  if (!headingFound) start = Math.max(start, index - LINES_BEFORE);

  let end = Math.min(lines.length, index + LINES_AFTER + 1);
  for (let i = index + 1; i < end; i++) {
    const isNewPage = lines[i].page !== lines[i - 1].page;
    if (HEADING_PATTERN.test(lines[i].text) || (isNewPage && endsWithTotal(lines, i))) {
      end = i;
      break;
    }
  }
  return { start, end };
}

// Ghép các dòng của một đoạn thành văn bản, chèn "[Trang N]" mỗi khi sang trang mới,
// và cắt ở ranh giới dòng khi vượt giới hạn ký tự.
function renderExcerpt(lines: NoteLine[]): NoteExcerpt {
  const parts: string[] = [];
  const pages: number[] = [];
  let length = 0;

  for (const line of lines) {
    const marker = pages.at(-1) === line.page ? null : `[Trang ${line.page}]`;
    const added = (marker ? marker.length + 1 : 0) + line.text.length + 1;
    if (length + added > MAX_EXCERPT_CHARS) break;

    if (marker) {
      parts.push(marker);
      pages.push(line.page);
    }
    parts.push(line.text);
    length += added;
  }
  return { pages, text: parts.join("\n") };
}

// Tìm các đoạn thuyết minh liên quan tới từ khoá trong các trang của một file.
// Tách riêng khỏi phần đọc DB để kiểm tra được bằng dữ liệu mẫu.
// maxExcerpts giới hạn số đoạn trả về, ví dụ 1 khi tự đính kèm để tiết kiệm token.
export function searchNotes(
  pages: ExtractablePage[],
  keyword: string,
  maxExcerpts = MAX_EXCERPTS,
) {
  const lines = collectNoteLines(pages);
  const phrase = foldText(keyword);
  const allWords = [...new Set(phrase.split(" ").filter(Boolean))];
  // Từ khoá chỉ gồm từ phổ biến (ví dụ "vay") thì giữ nguyên, không bỏ hết.
  const meaningful = allWords.filter((word) => !STOP_WORDS.has(word));
  const words = meaningful.length > 0 ? meaningful : allWords;

  if (lines.length === 0) return { hasNotes: false as const, excerpts: [], headings: [] };

  const ranked = words.length
    ? lines
        .map((line, index) => ({ index, score: scoreNoteLine(line, words, phrase), line }))
        .filter((item) => item.score > 0)
        // Điểm bằng nhau thì ưu tiên dòng ngắn: thường là tiêu đề mục hoặc tên dòng của bảng.
        .sort((a, b) => b.score - a.score || a.line.text.length - b.line.text.length)
    : [];

  // Chọn các đoạn không chồng lên nhau, khớp nhất trước, bỏ đoạn khớp yếu hơn hẳn.
  const bestScore = ranked[0]?.score ?? 0;
  const windows: { start: number; end: number }[] = [];
  for (const { index, score } of ranked) {
    if (windows.length >= maxExcerpts || score < bestScore * MIN_RELATIVE_SCORE) break;
    const { start, end } = excerptBounds(lines, index);
    const overlaps = windows.some((window) => start < window.end && window.start < end);
    if (!overlaps) windows.push({ start, end });
  }

  const excerpts = windows
    .sort((a, b) => a.start - b.start)
    .map((window) => renderExcerpt(lines.slice(window.start, window.end)));

  // Không khớp gì thì trả danh sách tiêu đề mục, để AI chọn từ khoá đúng tên mục rồi tìm lại.
  const headings =
    excerpts.length === 0
      ? lines
          .filter((line) => HEADING_PATTERN.test(line.text))
          .slice(0, MAX_HEADINGS)
          .map((line) => `${line.text} (trang ${line.page})`)
      : [];

  return { hasNotes: true as const, excerpts, headings };
}

// Lấy các trang OCR của file gốc của báo cáo; null khi file đã bị xoá hoặc chưa OCR.
async function loadReportPages(report: Report): Promise<ExtractablePage[] | null> {
  if (!report.file_id) return null;
  const [content] = await db
    .select({ json: fileContents.content_json })
    .from(fileContents)
    .where(eq(fileContents.file_id, report.file_id))
    .limit(1);
  return content ? ((content.json.pages ?? []) as ExtractablePage[]) : null;
}

// Số dòng đầu trong kết quả searchLineItems được xét để tự đính kèm thuyết minh.
// Chỉ xét các dòng khớp nhất, tức dòng người dùng đang hỏi, không phải dòng khớp phụ.
const AUTO_NOTE_TOP_MATCHES = 2;

// searchLineItems kèm sẵn đoạn thuyết minh khi dòng được hỏi thay đổi mạnh so với đầu năm.
// Model nhỏ (ví dụ llama trên Groq) thường bỏ qua gợi ý gọi readNotes rồi tự đoán lý do,
// nên code tự tìm và đính kèm, để câu trả lời có lý do thật từ báo cáo.
// Chỉ đính kèm 1 đoạn cho dòng biến động lớn nhất, để không tốn nhiều token.
export async function searchLineItemsWithNotes(query: PeriodQuery & { keyword: string }) {
  const result = await searchLineItems(query);
  if (!result.found) return result;

  const [target] = bigChangeFacts(result.matches.slice(0, AUTO_NOTE_TOP_MATCHES));
  if (!target) return result;

  const report = await findReport({
    ...query,
    reportType: result.report.reportType as PeriodQuery["reportType"],
  });
  const pages = report ? await loadReportPages(report) : null;
  const [excerpt] = pages ? searchNotes(pages, target.label, 1).excerpts : [];
  if (!excerpt) return result;

  // Bỏ gợi ý "gọi readNotes" của dòng này, vì đoạn thuyết minh đã có sẵn.
  const notes = result.notes.filter(
    (note) => !note.includes(`readNotes với keyword "${target.label}"`),
  );

  return {
    ...result,
    notes: [
      ...notes,
      `"${target.label}" thay đổi lớn so với đầu năm. noteExcerpt là đoạn thuyết minh liên quan, đã tìm sẵn: dùng nó để nêu thành phần và lý do biến động, trích số kèm trang. Văn bản do OCR đọc nên có thể sai; chỉ trích số đọc rõ, không đoán thêm lý do ngoài đoạn này.`,
    ],
    noteExcerpt: { forLine: target.label, ...excerpt },
  };
}

// Đọc thuyết minh của một kỳ báo cáo theo từ khoá, ví dụ "phải thu khác",
// "đầu tư vào công ty con", "vay", "bên liên quan", "phân loại lại".
export async function readNotes(query: PeriodQuery & { keyword: string }) {
  const report = await findReport(query);
  const period = describePeriod(query.fiscalYear, query.fiscalQuarter);

  if (!report) {
    return {
      found: false as const,
      message: `Chưa có báo cáo ${query.ticker.toUpperCase()} ${period}. Người dùng cần upload file PDF báo cáo này.`,
      availableReports: await listReports(query.ticker),
    };
  }

  const pages = await loadReportPages(report);
  if (!pages) {
    return {
      found: false as const,
      message: "File PDF gốc của báo cáo này đã bị xoá hoặc chưa OCR xong, không đọc được thuyết minh.",
    };
  }

  const result = searchNotes(pages, query.keyword);

  if (!result.hasNotes) {
    return {
      found: false as const,
      message: "File báo cáo này không có phần thuyết minh.",
    };
  }

  return {
    found: true as const,
    report: toSummary(report),
    period,
    sourceFile: await loadSourceFile(report),
    keyword: query.keyword,
    excerpts: result.excerpts,
    ...(result.headings.length ? { headings: result.headings } : {}),
    note:
      result.excerpts.length > 0
        ? "Văn bản do OCR đọc từ PDF nên có thể sai chữ, sai số hoặc lệch cột trong bảng. Chỉ trích những gì đọc rõ, ghi số trang, và nhắc người dùng đối chiếu PDF với các số quan trọng."
        : "Không thấy đoạn nào khớp. headings là các tiêu đề mục trong thuyết minh: chọn tiêu đề gần nhất rồi gọi lại với từ khoá là tên mục đó.",
  };
}
