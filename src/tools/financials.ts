// Bọc các hàm của lõi truy vấn thành tool cho chatbot (AI SDK).
// Tool là hàm mà AI được phép tự gọi: AI đọc description để biết khi nào dùng,
// inputSchema để biết cần truyền gì, rồi nhận kết quả của execute để viết câu trả lời.
//
// Logic nằm hết ở src/server/financials.ts và src/server/notes.ts; file này chỉ mô tả và
// chuyển tham số, để MCP server dùng lại cùng lõi mà không phải viết lại.

import { tool } from "ai";
import { z } from "zod";

import {
  calculateRatios,
  comparePeriods,
  compareCompanies,
  findCompanies,
  getFinancials,
  listReports,
} from "@/server/financials";
import { readNotes, searchLineItemsWithNotes } from "@/server/notes";

// Danh sách mã chỉ tiêu để so sánh, dùng chung cho comparePeriods và compareCompanies.
// Nhận chuỗi tự do thay vì enum, vì ngoài mã chuẩn còn có mã dòng lấy từ searchLineItems.
const metricsSchema = z
  .array(z.string())
  .optional()
  .describe(
    "Mã chỉ tiêu cần so sánh: mã chuẩn (net_revenue, total_assets...) hoặc trường metric lấy từ searchLineItems (ví dụ bs_318). Bỏ trống để lấy các chỉ tiêu chuẩn",
  );

// Tham số chỉ một kỳ báo cáo, dùng chung cho nhiều tool.
const periodSchema = {
  ticker: z.string().describe("Mã cổ phiếu 3 ký tự, ví dụ HPG"),
  fiscalYear: z.number().int().describe("Năm tài chính, ví dụ 2020"),
  fiscalQuarter: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("1-4 là quý; 0 là cả năm. 'Quý 4' là 4, 'cả năm' hoặc 'năm 2020' là 0"),
  reportType: z
    .enum(["consolidated", "separate"])
    .optional()
    .describe("consolidated là hợp nhất, separate là công ty mẹ; bỏ trống để ưu tiên hợp nhất"),
};

export const financialTools = {
  findCompanies: tool({
    description:
      "Tìm mã cổ phiếu từ tên công ty. Dùng khi người dùng nêu tên thay vì mã, ví dụ 'Hòa Phát'.",
    inputSchema: z.object({
      query: z.string().describe("Tên hoặc mã công ty"),
    }),
    execute: async ({ query }) => findCompanies(query),
  }),

  listReports: tool({
    description:
      "Liệt kê các kỳ báo cáo đã có số liệu của một mã. Dùng khi người dùng hỏi dữ liệu mới nhất, hoặc khi không tìm thấy kỳ được hỏi.",
    inputSchema: z.object({
      ticker: z.string().describe("Mã cổ phiếu 3 ký tự"),
    }),
    execute: async ({ ticker }) => listReports(ticker),
  }),

  getFinancials: tool({
    description:
      "Lấy các chỉ tiêu chính (doanh thu, lợi nhuận, tổng tài sản, nợ, vốn, dòng tiền...) của một mã trong một kỳ, đơn vị tỷ đồng, kèm file và trang nguồn. Chỉ tiêu khác thì dùng searchLineItems.",
    inputSchema: z.object(periodSchema),
    execute: async (input) => getFinancials(input),
  }),

  searchLineItems: tool({
    description:
      "Tìm một dòng bất kỳ trong bảng cân đối, kết quả kinh doanh hoặc lưu chuyển tiền tệ theo từ khoá hoặc mã số, ví dụ 'doanh thu chưa thực hiện', 'phải thu khách hàng', '318'. Dùng khi chỉ tiêu cần tìm không có trong getFinancials. Tên dòng mỗi công ty ghi một kiểu (ví dụ 'chờ phân bổ' và 'chưa thực hiện'), nên không thấy thì thử từ khoá khác trước khi kết luận là không có.",
    inputSchema: z.object({
      ...periodSchema,
      keyword: z.string().describe("Từ khoá trong tên dòng, hoặc mã số của dòng"),
    }),
    // Bản có kèm thuyết minh khi dòng biến động lớn; xem searchLineItemsWithNotes.
    execute: async (input) => searchLineItemsWithNotes(input),
  }),

  readNotes: tool({
    description:
      "Đọc phần thuyết minh báo cáo tài chính theo từ khoá. Thuyết minh giải thích chi tiết các con số: một khoản mục gồm những gì, ai đang nợ, đầu tư vào công ty nào, vay ai, giao dịch với bên liên quan, vì sao số đầu năm bị phân loại lại. Dùng khi người dùng hỏi chi tiết, thành phần, lý do biến động của một dòng, hoặc khi dòng có trường note. Từ khoá nên là tên mục hoặc tên dòng như in trong báo cáo (ví dụ 'phải thu khác', 'đầu tư vào công ty con', 'phân loại lại'), không dùng số mục như 'VI.3' vì OCR hay đọc sai số mục.",
    inputSchema: z.object({
      ...periodSchema,
      keyword: z.string().describe("Tên mục hoặc tên dòng cần đọc, ví dụ 'phải thu khác'"),
    }),
    execute: async (input) => readNotes(input),
  }),

  calculateRatios: tool({
    description:
      "Tính chỉ số tài chính (biên lợi nhuận, ROE, đòn bẩy, tỷ lệ cho vay/tiền gửi) và tăng trưởng so với cùng kỳ năm trước. Dùng khi người dùng hỏi phân tích, đánh giá hay so sánh hiệu quả.",
    inputSchema: z.object(periodSchema),
    execute: async (input) => calculateRatios(input),
  }),

  comparePeriods: tool({
    description:
      "So sánh một mã qua nhiều kỳ (ví dụ quý 2 với quý 3, hoặc năm nay với năm trước). Trả về số từng kỳ và chênh lệch đã tính sẵn; dùng thay vì tự tính.",
    inputSchema: z.object({
      ticker: periodSchema.ticker,
      periods: z
        .array(
          z.object({
            fiscalYear: periodSchema.fiscalYear,
            fiscalQuarter: periodSchema.fiscalQuarter,
          }),
        )
        .min(2)
        .max(8)
        .describe("Các kỳ theo thứ tự thời gian, kỳ cũ trước"),
      reportType: periodSchema.reportType,
      metrics: metricsSchema,
    }),
    execute: async (input) => comparePeriods(input),
  }),

  compareCompanies: tool({
    description: "So sánh số liệu của nhiều mã trong cùng một kỳ.",
    inputSchema: z.object({
      tickers: z.array(z.string()).min(2).max(10).describe("Danh sách mã cổ phiếu"),
      fiscalYear: periodSchema.fiscalYear,
      fiscalQuarter: periodSchema.fiscalQuarter,
      metrics: metricsSchema,
    }),
    execute: async (input) => compareCompanies(input),
  }),
};
