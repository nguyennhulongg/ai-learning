// Lõi truy vấn số liệu tài chính, dùng chung cho chatbot và MCP server.
// File này không phụ thuộc Next.js: chỉ nhận tham số và trả dữ liệu thuần.
//
// Nguyên tắc:
//   - Mọi phép tính nằm ở đây, AI chỉ diễn giải kết quả, vì AI hay tính sai.
//   - Mọi số trả về kèm nguồn (file và trang), để câu trả lời trích dẫn được.
//   - Số tiền đổi về tỷ đồng, vì mỗi báo cáo dùng một đơn vị (đồng hoặc triệu đồng).
//
// Thuật ngữ:
//   - Kỳ báo cáo: fiscal_quarter 1-4 là quý, 0 là cả năm.
//   - Hợp nhất (consolidated): gồm cả công ty con. Riêng (separate): chỉ công ty mẹ.
//   - YoY (year over year): so với cùng kỳ năm trước.
//   - ROE (return on equity): lợi nhuận sau thuế chia vốn chủ sở hữu.

import { and, asc, desc, eq } from "drizzle-orm";

import { METRICS } from "@/constants/metrics";
import { db } from "@/db";
import { companies, files, financialFacts, reports, type Report } from "@/db/schema";
import { normalizeCompanyName } from "./identify-report";
import { foldText } from "@/utils/fold-text";

const MAX_COMPANY_RESULTS = 10;

// Hệ số đổi từ đơn vị gốc sang tỷ đồng.
const TO_BILLION: Record<string, number> = {
  vnd: 1e-9,
  million_vnd: 1e-3,
  billion_vnd: 1,
};

export type PeriodQuery = {
  ticker: string;
  fiscalYear: number;
  // 1-4 là quý, 0 là cả năm.
  fiscalQuarter: number;
  // Bỏ trống thì ưu tiên báo cáo hợp nhất, không có mới dùng báo cáo riêng.
  reportType?: "consolidated" | "separate";
};

// Kết quả được gửi cho AI, nên giữ thật gọn: mỗi token đều tính vào hạn mức của model.
// Tên file nguồn ghi một lần ở cấp báo cáo, từng chỉ tiêu chỉ ghi số trang.
export type FactResult = {
  metric: string;
  label: string;
  // Tỷ đồng với số tiền; đồng/cổ phiếu với EPS. Đã làm tròn, dùng để đọc và tính toán.
  value: number;
  // Số đúng như in trong báo cáo, kèm đơn vị gốc, để người dùng đối chiếu từng chữ số với PDF.
  exact: string;
  verified: boolean;
  page: number | null;
  // Mã số in trên báo cáo, chỉ ghi cho dòng ngoài danh mục chuẩn để giữ kết quả gọn.
  lineCode?: string;
  // Số đầu năm tài chính như in trong báo cáo kỳ này, chỉ có ở dòng bảng cân đối.
  // Đây là số đã trình bày lại nếu công ty phân loại lại, nên dùng số này khi tính
  // thay đổi từ đầu năm, không dùng số cuối năm trước lấy từ báo cáo năm trước.
  // change là value trừ số đầu năm, tính sẵn bằng code để AI không phải tự trừ.
  opening?: { value: number; exact: string; change: number };
  // Mã mục thuyết minh có giải thích chi tiết cho dòng này, ví dụ "VI.3".
  note?: string;
};

// Số dòng tối đa searchLineItems trả về, đủ để AI chọn mà không tốn nhiều token.
const MAX_LINE_MATCHES = 15;

// Điểm cho dòng khớp đúng mã số hoặc mã chỉ tiêu, cao hơn mọi điểm khớp theo từ.
const EXACT_CODE_SCORE = 100;

// Điểm cộng thêm khi tên dòng chứa nguyên cụm từ khoá.
const PHRASE_BONUS = 10;

// Chỉ tiêu thuộc danh mục chuẩn: có tên thống nhất giữa các công ty, dùng để tính chỉ số.
function isStandardMetric(metric: string): boolean {
  return metric in METRICS;
}

export type ReportSummary = {
  ticker: string;
  fiscalYear: number;
  fiscalQuarter: number;
  reportType: string;
  auditStatus: string;
};

// Làm tròn tới số chữ số thập phân cho trước, giữ kết quả gọn khi trả cho AI.
function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// Số chữ số có nghĩa giữ lại cho số tiền dưới 1 tỷ, ví dụ 0,00346 tỷ (3,46 triệu).
const SMALL_AMOUNT_DIGITS = 3;

// Làm tròn số tiền tính bằng tỷ đồng. Số từ 1 tỷ trở lên giữ 2 chữ số thập phân;
// số nhỏ hơn giữ 3 chữ số có nghĩa, để vài triệu đồng không bị làm tròn thành 0,00.
function roundAmount(billions: number): number {
  if (billions === 0 || Math.abs(billions) >= 1) return round(billions);
  return Number(billions.toPrecision(SMALL_AMOUNT_DIGITS));
}

// Tên đơn vị gốc của báo cáo, ghi kèm số gốc để người dùng đối chiếu với PDF.
const UNIT_LABELS: Record<string, string> = {
  vnd: "đồng",
  million_vnd: "triệu đồng",
  billion_vnd: "tỷ đồng",
  vnd_per_share: "đồng/cổ phiếu",
};

// Viết số gốc theo kiểu báo cáo Việt Nam, dấu chấm ngăn nghìn, kèm đơn vị gốc.
// Ví dụ "-4836583464000.0000" thành "-4.836.583.464.000 đồng".
// Làm việc trên chuỗi thay vì Number, vì số hàng nghìn tỷ đồng có thể vượt độ chính xác của Number.
// Phần thập phân luôn là 0 với số tiền trong báo cáo nên được bỏ đi.
function formatExact(raw: string, unit: string): string {
  const [integerPart] = raw.split(".");
  const isNegative = integerPart.startsWith("-");
  const digits = integerPart.replace("-", "").replace(/^0+(?=\d)/, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${isNegative ? "-" : ""}${grouped} ${UNIT_LABELS[unit] ?? unit}`;
}

// Mô tả kỳ báo cáo bằng tiếng Việt, ví dụ "Q4/2020" hoặc "năm 2020".
export function describePeriod(fiscalYear: number, fiscalQuarter: number): string {
  return fiscalQuarter === 0 ? `năm ${fiscalYear}` : `Q${fiscalQuarter}/${fiscalYear}`;
}

// foldText dùng chung với client (gợi ý ở ô nhập), nên đặt ở utils; export lại để code cũ không phải đổi import.
export { foldText };

// Tìm công ty theo mã hoặc tên; so tên ở dạng không dấu nên "hoa phat" vẫn ra Hòa Phát.
export async function findCompanies(query: string) {
  const upper = query.trim().toUpperCase();
  const target = normalizeCompanyName(query);
  const folded = foldText(query);
  const rows = await db.select().from(companies);

  const exact = rows.filter((row) => row.ticker === upper);
  // Từ khoá rỗng sau chuẩn hoá, ví dụ chỉ gõ "công ty cổ phần", sẽ khớp mọi công ty nên bỏ qua.
  const byName = target
    ? rows
        .filter(
          (row) =>
            row.ticker !== upper &&
            (normalizeCompanyName(row.name).includes(target) ||
              foldText(row.name).includes(folded)),
        )
        // Tên ngắn hơn thường khớp sát hơn: "Tập đoàn Hòa Phát" trước "Nông nghiệp Hòa Phát".
        .sort((a, b) => normalizeCompanyName(a.name).length - normalizeCompanyName(b.name).length)
    : [];

  return [...exact, ...byName].slice(0, MAX_COMPANY_RESULTS).map((row) => ({
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange,
    sector: row.sector,
    industry: row.industry,
  }));
}

// Liệt kê các kỳ báo cáo đã có số liệu của một mã, mới nhất trước.
export async function listReports(ticker: string): Promise<ReportSummary[]> {
  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.ticker, ticker.toUpperCase()))
    .orderBy(desc(reports.fiscal_year), desc(reports.fiscal_quarter));

  return rows.map(toSummary);
}

// Đổi một dòng báo cáo thành bản tóm tắt gọn.
export function toSummary(report: Report): ReportSummary {
  return {
    ticker: report.ticker,
    fiscalYear: report.fiscal_year,
    fiscalQuarter: report.fiscal_quarter,
    reportType: report.report_type,
    auditStatus: report.audit_status,
  };
}

// Tìm báo cáo của một kỳ. Không chỉ định loại thì ưu tiên hợp nhất.
export async function findReport(query: PeriodQuery): Promise<Report | null> {
  const rows = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.ticker, query.ticker.toUpperCase()),
        eq(reports.fiscal_year, query.fiscalYear),
        eq(reports.fiscal_quarter, query.fiscalQuarter),
        query.reportType ? eq(reports.report_type, query.reportType) : undefined,
      ),
    )
    // "consolidated" đứng trước "separate" theo thứ tự chữ cái.
    .orderBy(asc(reports.report_type));

  return rows[0] ?? null;
}

// Lấy tên file gốc của báo cáo; file có thể đã bị xoá dù số liệu vẫn còn.
export async function loadSourceFile(report: Report): Promise<string> {
  if (!report.file_id) return "không rõ file";
  const [file] = await db
    .select({ name: files.file_name })
    .from(files)
    .where(eq(files.id, report.file_id))
    .limit(1);
  return file?.name ?? "không rõ file";
}

// Đổi số đã lưu sang tỷ đồng (EPS giữ nguyên đồng/cổ phiếu) và làm tròn.
function toDisplayValue(raw: string, unit: string): number {
  if (unit === "vnd_per_share") return Number(raw);
  return roundAmount(Number(raw) * (TO_BILLION[unit] ?? 1));
}

// Lấy mọi dòng đã lưu của một báo cáo, đã đổi đơn vị và gắn số trang.
// Dòng ngoài danh mục chuẩn lấy tên như in trong báo cáo.
// Số đầu năm không thành dòng riêng mà gắn vào trường opening của dòng cuối kỳ cùng mã.
// Dòng chỉ có số đầu năm (cuối kỳ để trống) bị bỏ qua, vì không có số của kỳ để trả lời.
async function loadFacts(report: Report): Promise<FactResult[]> {
  const rows = await db
    .select()
    .from(financialFacts)
    .where(eq(financialFacts.report_id, report.id));

  const openingByMetric = new Map(
    rows.filter((row) => row.is_opening).map((row) => [row.metric_code, row]),
  );

  return rows
    .filter((row) => !row.is_opening)
    .map((row) => {
      const standard = METRICS[row.metric_code];
      const opening = openingByMetric.get(row.metric_code);
      const value = toDisplayValue(row.value, row.unit);
      const openingValue = opening ? toDisplayValue(opening.value, opening.unit) : null;
      return {
        metric: row.metric_code,
        label: standard?.label ?? row.source_label ?? row.metric_code,
        value,
        exact: formatExact(row.value, row.unit),
        verified: row.is_verified,
        page: row.source_page,
        ...(!standard && row.line_code ? { lineCode: row.line_code } : {}),
        ...(opening && openingValue !== null
          ? {
              opening: {
                value: openingValue,
                exact: formatExact(opening.value, opening.unit),
                change: roundAmount(value - openingValue),
              },
            }
          : {}),
        ...(row.note_ref ? { note: row.note_ref } : {}),
      };
    });
}

// Tìm báo cáo chứa bảng cân đối cuối năm tài chính trước: báo cáo quý 4,
// không có thì báo cáo năm. Bảng cân đối của quý 4 được lưu ở báo cáo quý 4.
async function findPreviousYearEnd(report: Report): Promise<Report | null> {
  for (const fiscalQuarter of [4, 0]) {
    const found = await findReport({
      ticker: report.ticker,
      fiscalYear: report.fiscal_year - 1,
      fiscalQuarter,
      reportType: report.report_type as PeriodQuery["reportType"],
    });
    if (found) return found;
  }
  return null;
}

// Số dòng tối đa nêu trong cảnh báo trình bày lại, để cảnh báo không quá dài.
const MAX_RESTATED_LINES = 5;

// Ngưỡng coi là biến động lớn so với đầu năm: thay đổi ít nhất 30% số đầu năm
// và ít nhất 1 tỷ đồng, để bỏ qua các dòng nhỏ dao động bình thường.
const BIG_CHANGE_RATIO = 0.3;
const BIG_CHANGE_MIN_BILLION = 1;

// Số dòng biến động lớn tối đa nêu trong một cảnh báo.
const MAX_BIG_CHANGE_LINES = 3;

// Nhắc AI đọc thuyết minh cho các dòng thay đổi mạnh so với đầu năm.
// Không chỉ dựa vào system prompt, vì khi người dùng hỏi chung chung ("thì sao?") model
// thường trả số rồi tự đoán lý do. Gợi ý nằm ngay trong kết quả tool, kèm từ khoá để gọi luôn.
function bigChangeHints(facts: FactResult[]): string[] {
  return bigChangeFacts(facts).map((fact) => {
    const { value, change } = fact.opening!;
    const times = value !== 0 && Math.abs(fact.value / value) >= 2
      ? `, gấp ${round(fact.value / value, 1)} lần`
      : "";
    return `"${fact.label}" thay đổi lớn so với đầu năm (${change > 0 ? "+" : ""}${change} tỷ${times}). Trước khi nhận xét về lý do, gọi readNotes với keyword "${fact.label}" để lấy chi tiết từ thuyết minh; không tự đoán lý do.`;
  });
}

// Các dòng thay đổi mạnh so với đầu năm, lớn nhất trước, tối đa MAX_BIG_CHANGE_LINES dòng.
export function bigChangeFacts(facts: FactResult[]): FactResult[] {
  return facts
    .filter((fact) => {
      if (!fact.opening) return false;
      const { value, change } = fact.opening;
      const ratio = value === 0 ? Infinity : Math.abs(change) / Math.abs(value);
      return Math.abs(change) >= BIG_CHANGE_MIN_BILLION && ratio >= BIG_CHANGE_RATIO;
    })
    .sort((a, b) => Math.abs(b.opening!.change) - Math.abs(a.opening!.change))
    .slice(0, MAX_BIG_CHANGE_LINES);
}

// Cảnh báo về số đầu năm của các dòng bảng cân đối sắp trả cho AI:
//   - Báo cáo trích trước khi có số đầu năm: nhắc trích lại.
//   - Số đầu năm khác số cuối năm trước (lấy từ báo cáo năm trước): công ty đã phân loại lại
//     hoặc trình bày lại. Khi đó tính thay đổi từ đầu năm phải dùng số đầu năm của kỳ này.
async function openingWarnings(report: Report, facts: FactResult[]): Promise<string[]> {
  const balanceFacts = facts.filter(
    (fact) => METRICS[fact.metric]?.statement === "balance_sheet" || fact.metric.startsWith("bs_"),
  );
  if (balanceFacts.length === 0) return [];

  const withOpening = balanceFacts.filter((fact) => fact.opening);
  if (withOpening.length === 0) {
    return [
      "Báo cáo này được trích trước khi hệ thống lưu số đầu năm của bảng cân đối. Người dùng cần bấm \"Trích lại số liệu\" ở file báo cáo nếu cần số đầu năm.",
    ];
  }

  const previous = await findPreviousYearEnd(report);
  if (!previous) return [];

  const previousByMetric = new Map(
    (await loadFacts(previous)).map((fact) => [fact.metric, fact]),
  );
  const restated = withOpening.filter((fact) => {
    const before = previousByMetric.get(fact.metric);
    // So theo tỷ đồng đã làm tròn, vì hai báo cáo có thể dùng đơn vị khác nhau.
    return before && Math.abs(before.value - fact.opening!.value) >= 0.01;
  });
  if (restated.length === 0) return [];

  const details = restated
    .slice(0, MAX_RESTATED_LINES)
    .map(
      (fact) =>
        `${fact.label}: đầu năm ${fact.opening!.value} tỷ, còn báo cáo ${describePeriod(previous.fiscal_year, previous.fiscal_quarter)} ghi ${previousByMetric.get(fact.metric)!.value} tỷ`,
    )
    .join("; ");
  return [
    `Số đầu năm của một số dòng khác số cuối năm trước (${details}). Công ty đã phân loại lại hoặc trình bày lại số đầu năm; tính thay đổi từ đầu năm phải dùng số opening của kỳ này. Lý do thường nằm trong thuyết minh, gọi readNotes với từ khoá "phân loại lại" hoặc "trình bày lại".`,
  ];
}

// Lấy số liệu của một kỳ. Không có báo cáo thì trả về danh sách kỳ đang có,
// để AI nói rõ là thiếu dữ liệu thay vì tự đoán số.
// Mặc định chỉ trả các chỉ tiêu chuẩn, vì một báo cáo có tới vài trăm dòng và gửi hết
// cho AI sẽ tốn hạn mức token. Truyền metrics để lấy đúng các dòng cần, kể cả dòng
// ngoài danh mục như "bs_318".
export async function getFinancials(query: PeriodQuery, metrics?: string[]) {
  const report = await findReport(query);
  const period = describePeriod(query.fiscalYear, query.fiscalQuarter);

  if (!report) {
    return {
      found: false as const,
      message: `Chưa có báo cáo ${query.ticker.toUpperCase()} ${period}. Người dùng cần upload file PDF báo cáo này.`,
      availableReports: await listReports(query.ticker),
    };
  }

  const facts = (await loadFacts(report)).filter((fact) =>
    metrics?.length ? metrics.includes(fact.metric) : isStandardMetric(fact.metric),
  );

  return {
    found: true as const,
    report: toSummary(report),
    period,
    unit: "tỷ đồng (riêng eps là đồng/cổ phiếu)",
    sourceFile: await loadSourceFile(report),
    facts,
    warnings: [
      ...reportWarnings(report, facts),
      ...(await openingWarnings(report, facts)),
      ...bigChangeHints(facts),
    ],
  };
}

// Chấm điểm mức khớp giữa từ khoá và một dòng: khớp đúng mã số hoặc mã chỉ tiêu được điểm
// cao nhất; còn lại tính số từ trong từ khoá có mặt trong tên dòng, cộng thêm nếu khớp nguyên cụm.
function scoreLine(fact: FactResult, keyword: string): number {
  const trimmed = keyword.trim().toLowerCase();
  if (trimmed === fact.lineCode || trimmed === fact.metric) return EXACT_CODE_SCORE;

  const label = foldText(fact.label);
  const labelWords = new Set(label.split(" "));
  const phrase = foldText(keyword);
  const wordScore = phrase.split(" ").filter((word) => word && labelWords.has(word)).length;
  return wordScore + (phrase && label.includes(phrase) ? PHRASE_BONUS : 0);
}

// Tìm các dòng bất kỳ trong báo cáo theo từ khoá hoặc mã số, cho những chỉ tiêu không có
// trong getFinancials, ví dụ "doanh thu chưa thực hiện" hoặc "318".
// Tên dòng mỗi công ty ghi một kiểu, nên trả về nhiều dòng gần đúng để AI tự chọn.
export async function searchLineItems(query: PeriodQuery & { keyword: string }) {
  const report = await findReport(query);
  const period = describePeriod(query.fiscalYear, query.fiscalQuarter);

  if (!report) {
    return {
      found: false as const,
      message: `Chưa có báo cáo ${query.ticker.toUpperCase()} ${period}. Người dùng cần upload file PDF báo cáo này.`,
      availableReports: await listReports(query.ticker),
    };
  }

  const facts = await loadFacts(report);
  const matches = facts
    .map((fact) => ({ fact, score: scoreLine(fact, query.keyword) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LINE_MATCHES)
    .map((item) => item.fact);

  // Báo cáo trích trước khi hệ thống lưu mọi dòng chỉ có các chỉ tiêu chuẩn.
  const hasAllLines = facts.some((fact) => !isStandardMetric(fact.metric));
  const warnings = [
    ...reportWarnings(report, matches),
    ...(await openingWarnings(report, matches)),
    ...bigChangeHints(matches),
  ];
  const notes = hasAllLines
    ? warnings
    : [
        "Báo cáo này được trích theo cách cũ, chỉ có các chỉ tiêu chính. Người dùng cần bấm \"Trích lại số liệu\" ở file báo cáo để trích đủ mọi dòng.",
        ...warnings,
      ];

  return {
    found: true as const,
    report: toSummary(report),
    period,
    unit: "tỷ đồng (dòng lãi trên cổ phiếu là đồng/cổ phiếu)",
    sourceFile: await loadSourceFile(report),
    matches,
    notes,
  };
}

// Dòng thuộc báo cáo lưu chuyển tiền tệ: chỉ tiêu chuẩn có statement cash_flow,
// hoặc mã theo dòng có tiền tố "cf_".
function isCashFlow(metric: string): boolean {
  return METRICS[metric]?.statement === "cash_flow" || metric.startsWith("cf_");
}

// Cảnh báo kèm số liệu, để AI không diễn giải sai:
//   - Báo cáo riêng: số của công ty mẹ, không phải toàn tập đoàn.
//   - Báo cáo quý 2-3: lưu chuyển tiền tệ chỉ được công bố dạng luỹ kế từ đầu năm tài chính,
//     dù cột có thể ghi "Quý III", nên đó là số 6 hoặc 9 tháng chứ không phải của riêng quý.
//     Quý 1 thì luỹ kế trùng với quý nên không cần cảnh báo; quý 4 được lưu vào báo cáo năm.
function reportWarnings(report: Report, facts: FactResult[]): string[] {
  const warnings: string[] = [];

  if (report.report_type === "separate") {
    warnings.push(
      "Đây là báo cáo riêng của công ty mẹ, không gồm công ty con nên không phản ánh toàn tập đoàn. Lợi nhuận có thể chủ yếu là cổ tức từ công ty con.",
    );
  }

  const quarter = report.fiscal_quarter;
  if (quarter >= 2 && quarter <= 3 && facts.some((fact) => isCashFlow(fact.metric))) {
    warnings.push(
      `Số lưu chuyển tiền tệ là luỹ kế ${quarter * 3} tháng đầu năm tài chính ${report.fiscal_year}, không phải của riêng quý ${quarter}. Khi trả lời, gọi là "${quarter * 3} tháng đầu năm ${report.fiscal_year}", không gọi là "quý ${quarter}". Không lấy số luỹ kế này so với số quý của kết quả kinh doanh.`,
    );
  }

  return warnings;
}

// Chia hai số, trả về null nếu thiếu số hoặc mẫu bằng 0.
function divide(numerator?: number, denominator?: number): number | null {
  if (numerator === undefined || denominator === undefined || denominator === 0) return null;
  return numerator / denominator;
}

// Đổi tỷ lệ sang phần trăm làm tròn 2 chữ số.
function percent(ratio: number | null): number | null {
  return ratio === null ? null : round(ratio * 100);
}

// Tính các chỉ số từ số liệu của một kỳ, và tăng trưởng so với cùng kỳ năm trước.
// Chỉ số nào thiếu dữ liệu thì trả về null, không ước lượng.
export async function calculateRatios(query: PeriodQuery) {
  const current = await getFinancials(query);
  if (!current.found) return current;

  const value = (facts: FactResult[], metric: string) =>
    facts.find((fact) => fact.metric === metric)?.value;
  const facts = current.facts;
  const get = (metric: string) => value(facts, metric);

  const debt = (get("short_term_debt") ?? 0) + (get("long_term_debt") ?? 0);
  const hasDebt = get("short_term_debt") !== undefined || get("long_term_debt") !== undefined;
  const profitForEquity = get("net_profit_parent") ?? get("net_profit");

  const ratios = {
    gross_margin_pct: percent(divide(get("gross_profit"), get("net_revenue"))),
    net_margin_pct: percent(divide(get("net_profit"), get("net_revenue"))),
    // ROE của riêng kỳ này, chưa quy đổi ra năm; báo cáo quý sẽ thấp hơn ROE năm.
    roe_period_pct: percent(divide(profitForEquity, get("equity"))),
    liabilities_to_assets_pct: percent(divide(get("total_liabilities"), get("total_assets"))),
    debt_to_equity: hasDebt ? round(divide(debt, get("equity")) ?? 0, 3) : null,
    // Riêng ngân hàng: tỷ lệ cho vay trên tiền gửi khách hàng.
    loan_to_deposit_pct: percent(divide(get("customer_loans"), get("customer_deposits"))),
  };

  // Tăng trưởng so với cùng kỳ năm trước, cùng loại báo cáo để so sánh đúng.
  const previous = await getFinancials({
    ...query,
    fiscalYear: query.fiscalYear - 1,
    reportType: current.report.reportType as PeriodQuery["reportType"],
  });

  const growth = (metric: string) => {
    if (!previous.found) return null;
    const before = value(previous.facts, metric);
    const now = get(metric);
    if (before === undefined || now === undefined || before === 0) return null;
    return percent((now - before) / Math.abs(before));
  };

  // Lợi nhuận lớn hơn doanh thu nghĩa là lợi nhuận đến từ hoạt động tài chính,
  // khi đó biên lợi nhuận ròng không phản ánh hoạt động kinh doanh chính.
  const warnings = [...current.warnings];
  if (ratios.net_margin_pct !== null && ratios.net_margin_pct > 100) {
    warnings.push(
      "Lợi nhuận sau thuế lớn hơn doanh thu thuần: lợi nhuận chủ yếu từ hoạt động tài chính, biên lợi nhuận ròng không có ý nghĩa so sánh.",
    );
  }

  return {
    found: true as const,
    report: current.report,
    period: current.period,
    sourceFile: current.sourceFile,
    ratios,
    warnings,
    yoyGrowthPct: {
      comparedWith: previous.found ? previous.period : null,
      net_revenue: growth("net_revenue"),
      net_profit: growth("net_profit"),
      total_assets: growth("total_assets"),
    },
    note: "Các chỉ số được tính bằng code từ số liệu báo cáo; null nghĩa là thiếu dữ liệu.",
  };
}

// So sánh nhiều mã trong cùng một kỳ, chỉ lấy các chỉ tiêu được yêu cầu.
export async function compareCompanies(input: {
  tickers: string[];
  fiscalYear: number;
  fiscalQuarter: number;
  metrics?: string[];
}) {
  const results = await Promise.all(
    input.tickers.map(async (ticker) => {
      const data = await getFinancials({ ...input, ticker }, input.metrics);
      if (!data.found) return { ticker: ticker.toUpperCase(), found: false, message: data.message };

      return {
        ticker: ticker.toUpperCase(),
        found: true,
        report: data.report,
        sourceFile: data.sourceFile,
        facts: data.facts,
        warnings: data.warnings,
      };
    }),
  );

  return { period: describePeriod(input.fiscalYear, input.fiscalQuarter), companies: results };
}

// So sánh một mã qua nhiều kỳ: code tính chênh lệch và phần trăm thay đổi so với kỳ trước đó
// trong danh sách, để AI không phải tự làm tính.
export async function comparePeriods(input: {
  ticker: string;
  periods: { fiscalYear: number; fiscalQuarter: number }[];
  reportType?: PeriodQuery["reportType"];
  // Bỏ trống để so các chỉ tiêu chuẩn; truyền mã (kể cả mã dòng như "bs_318") để so dòng bất kỳ.
  metrics?: string[];
}) {
  const reportsData = await Promise.all(
    input.periods.map((period) =>
      getFinancials({ ...period, ticker: input.ticker, reportType: input.reportType }, input.metrics),
    ),
  );

  const found = reportsData.filter((data) => data.found);
  const missing = reportsData.filter((data) => !data.found).map((data) => data.message);
  if (found.length < 2) {
    return { found: false as const, message: "Cần ít nhất 2 kỳ có dữ liệu để so sánh.", missing };
  }

  const metrics = [...new Set(found.flatMap((data) => data.facts.map((fact) => fact.metric)))];

  const rows = metrics.map((metric) => {
    const periodFacts = found.map(
      (data) => data.facts.find((fact) => fact.metric === metric) ?? null,
    );
    const values = periodFacts.map((fact) => fact?.value ?? null);
    // Số gốc của từng kỳ, cùng thứ tự với values, để bảng ghi được số đúng như báo cáo.
    const exactValues = periodFacts.map((fact) => fact?.exact ?? null);
    // Thay đổi của kỳ cuối so với kỳ liền trước nó trong danh sách.
    const [before, after] = values.slice(-2);
    const change = before !== null && after !== null ? roundAmount(after - before) : null;
    const changePct =
      change !== null && before !== null && before !== 0
        ? round((change / Math.abs(before)) * 100)
        : null;

    // Dòng ngoài danh mục lấy tên in trong báo cáo của kỳ đầu tiên có dòng đó.
    const label = found
      .flatMap((data) => data.facts)
      .find((fact) => fact.metric === metric)?.label ?? metric;

    return {
      metric,
      label,
      values,
      exactValues,
      changeLastVsPrevious: change,
      changeLastVsPreviousPct: changePct,
    };
  });

  return {
    found: true as const,
    ticker: input.ticker.toUpperCase(),
    unit: "tỷ đồng (riêng eps là đồng/cổ phiếu)",
    periods: found.map((data) => ({
      period: data.period,
      reportType: data.report.reportType,
      sourceFile: data.sourceFile,
    })),
    rows,
    missing,
    warnings: [...new Set(found.flatMap((data) => data.warnings))],
    note: "values theo thứ tự periods; cột change so sánh kỳ cuối với kỳ liền trước. Số liệu được tính bằng code.",
  };
}

