import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, boolean, customType, jsonb, bigint, integer, numeric, check, uniqueIndex, index } from "drizzle-orm/pg-core";

const VECTOR_DIMENSION = 768; // Số chiều chuẩn của Gemini Embedding

// 1. Tạo custom type cho vector trong Drizzle
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${VECTOR_DIMENSION})`;
  },
  // Chuyển mảng number[] trong code thành chuỗi JSON dạng '[1,2,3]' khi lưu xuống DB
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  // Chuyển chuỗi từ DB về mảng number[] khi truy vấn lên
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id", { length: 36 }).primaryKey(),
  sessionId: varchar("session_id", { length: 36 })
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  parts: text("parts").notNull(),
  attachments: jsonb("attachments").$type<any[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// processing_status có thể nhận các giá trị:
// - pending: đang chờ xử lý.
// - processing: đang trích xuất nội dung.
// - completed: xử lý thành công.
// - failed: xử lý thất bại.

export const files = pgTable("files", {
  id: varchar("id", { length: 36 }).primaryKey(),

  file_name: varchar("file_name", { length: 255 }).notNull(),
  storage_path: text("storage_path").notNull(),
  bucket_name: varchar("bucket_name", { length: 255 }).notNull(),
  mime_type: varchar("mime_type", { length: 255 }).notNull(),
  file_size: bigint("file_size", { mode: "number" }),

  // Trạng thái upload và lưu trữ file
  status: varchar("status", { length: 30 })
    .notNull()
    .default("uploaded"),

  // Trạng thái xử lý PDF cho pipeline RAG
  processing_status: varchar("processing_status", { length: 30 })
    .notNull()
    .default("pending"),

  // Mục đích sử dụng file
  purpose: varchar("purpose", { length: 30 })
    .notNull()
    .default("prompt_attachment"),

  // Thông tin xử lý
  page_count: integer("page_count"),
  processed_at: timestamp("processed_at", { withTimezone: true }),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),

  error_message: text("error_message"),

  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),


});

// bảng này lưu thông tin nội dung đã được OCR từ file
// Tại sao vẫn cần content_json nếu đã có Markdown ?
//   Markdown thuận tiện cho việc đọc và chunking,
//   nhưng có thể làm mất một số cấu trúc của Docling như metadata của bảng, cấu trúc phần tử hoặc thông tin trang.
//   Giữ JSON đã loại payload ảnh giúp bạn có thể xử lý lại dữ liệu mà không cần OCR PDF thêm lần nữa.
export const fileContents = pgTable(
  "file_contents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    file_id: varchar("file_id", { length: 36 })
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),

    content_json: jsonb("content_json")
      .$type<Record<string, unknown>>()
      .notNull(),

    markdown: text("markdown").notNull(),
    plain_text: text("plain_text").notNull(),

    extraction_version: varchar("extraction_version", { length: 100 }),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("file_contents_file_id_uidx").on(table.file_id),
  ],
);

// Bảng này phục vụ tìm kiếm RAG. Mỗi file có thể có nhiều chunk;
// mỗi chunk chứa nội dung, vị trí trang, thông tin cấu trúc và embedding.
export const fileChunks = pgTable(
  "file_chunks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    file_id: varchar("file_id", { length: 36 })
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),

    // Thứ tự chunk trong file, bắt đầu từ 0
    chunk_index: integer("chunk_index").notNull(),

    content: text("content").notNull(),

    // Có thể null nếu không xác định được trang
    page_start: integer("page_start"),
    page_end: integer("page_end"),

    // Ví dụ: ["Kết quả kinh doanh", "Lợi nhuận sau thuế"]
    section_path: jsonb("section_path")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    // Thông tin bổ sung: loại nội dung, bảng, nguồn trích xuất...
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Phải khớp số chiều của model embedding
    embedding: vector("embedding"),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("file_chunks_file_id_idx").on(table.file_id),
    uniqueIndex("file_chunks_file_id_chunk_index_uidx").on(
      table.file_id,
      table.chunk_index,
    ),
  ],
);

// Bảng này lưu danh sách công ty niêm yết. Mỗi mã cổ phiếu là một dòng.
// Khoá chính (primary key) là cột định danh duy nhất của mỗi dòng, ở đây là mã như "TCB".
export const companies = pgTable("companies", {
  ticker: varchar("ticker", { length: 10 }).primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  // Sàn giao dịch: HOSE, HNX hoặc UPCOM
  exchange: varchar("exchange", { length: 20 }).notNull(),

  // Nhóm ngành lớn, ví dụ "Tài chính" gồm cả ngân hàng, chứng khoán và bảo hiểm.
  sector: varchar("sector", { length: 100 }),

  // Ngành chi tiết, chi tiết hơn sector, ví dụ "banking".
  // Ngành quyết định bộ chỉ tiêu: ngân hàng có NIM, CASA, NPL mà doanh nghiệp thường không có.
  // NULL nghĩa là chưa biết ngành, vì nguồn danh sách công ty không có thông tin này.
  industry: varchar("industry", { length: 100 }),

  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Bảng này lưu thông tin từng kỳ báo cáo tài chính của một công ty.
export const reports = pgTable(
  "reports",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    // Khoá ngoại (foreign key): giá trị phải tồn tại trong bảng được tham chiếu
    ticker: varchar("ticker", { length: 10 })
      .notNull()
      .references(() => companies.ticker, { onDelete: "cascade" }),

    fiscal_year: integer("fiscal_year").notNull(),

    // 1-4 là quý, 0 là cả năm.
    // Không dùng NULL cho cả năm vì unique index coi các NULL là khác nhau,
    // nên sẽ không chặn được báo cáo năm bị nhập trùng.
    fiscal_quarter: integer("fiscal_quarter").notNull(),

    // consolidated: báo cáo hợp nhất (gồm cả công ty con); separate: báo cáo riêng
    report_type: varchar("report_type", { length: 20 })
      .notNull()
      .default("consolidated"),

    // unaudited: chưa kiểm toán; reviewed: đã soát xét; audited: đã kiểm toán
    audit_status: varchar("audit_status", { length: 20 })
      .notNull()
      .default("unaudited"),

    // Ngày công bố khác ngày kết thúc kỳ. Backtest (thử chiến lược trên dữ liệu quá khứ)
    // chỉ được dùng báo cáo đã công bố tại thời điểm đó, nếu không kết quả sẽ đẹp giả.
    published_at: timestamp("published_at", { withTimezone: true }),

    // File PDF gốc; set null giữ lại báo cáo khi file bị xoá
    file_id: varchar("file_id", { length: 36 })
      .references(() => files.id, { onDelete: "set null" }),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reports_period_uidx").on(
      table.ticker,
      table.fiscal_year,
      table.fiscal_quarter,
      table.report_type,
    ),
    // Check constraint: quy tắc do chính DB kiểm tra mỗi khi ghi dữ liệu
    check("reports_fiscal_quarter_check", sql`${table.fiscal_quarter} between 0 and 4`),
  ],
);

// Bảng này lưu từng chỉ tiêu tài chính, mỗi chỉ tiêu của một kỳ là một dòng.
// Thiết kế theo dòng nên thêm chỉ tiêu mới không cần sửa cấu trúc bảng.
export const financialFacts = pgTable(
  "financial_facts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),

    report_id: varchar("report_id", { length: 36 })
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),

    // balance_sheet: bảng cân đối kế toán; income_statement: kết quả kinh doanh;
    // cash_flow: lưu chuyển tiền tệ; ratio: chỉ số do nguồn dữ liệu cung cấp
    statement: varchar("statement", { length: 30 }).notNull(),

    // Mã chuẩn hoá, ví dụ "net_profit", vì mỗi công ty ghi tên chỉ tiêu một kiểu
    metric_code: varchar("metric_code", { length: 64 }).notNull(),

    // Tên gốc trong báo cáo, giữ lại để đối chiếu khi chuẩn hoá sai
    source_label: text("source_label"),

    // numeric lưu chính xác từng chữ số, còn float làm tròn sai ở số tiền lớn.
    // Drizzle trả numeric về dạng chuỗi để JavaScript không làm mất độ chính xác.
    value: numeric("value", { precision: 24, scale: 4 }).notNull(),

    unit: varchar("unit", { length: 20 }).notNull().default("million_vnd"),

    // Nơi lấy số liệu, ví dụ "ocr" hoặc "manual"
    source: varchar("source", { length: 50 }).notNull(),

    // Trang trong PDF, dùng để trích dẫn nguồn trong câu trả lời
    source_page: integer("source_page"),

    // True khi số đã qua kiểm tra, ví dụ phép tính cân hoặc khớp với nguồn khác
    is_verified: boolean("is_verified").notNull().default(false),

    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Có source để cùng một chỉ tiêu từ 2 nguồn nằm cạnh nhau mà đối chiếu
    uniqueIndex("financial_facts_report_metric_source_uidx").on(
      table.report_id,
      table.metric_code,
      table.source,
    ),
    // Index giúp DB tìm nhanh hơn, cần khi so sánh một chỉ tiêu giữa nhiều công ty
    index("financial_facts_metric_code_idx").on(table.metric_code),
  ],
);


export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

export type FileContent = typeof fileContents.$inferSelect;
export type NewFileContent = typeof fileContents.$inferInsert;

export type FileChunk = typeof fileChunks.$inferSelect;
export type NewFileChunk = typeof fileChunks.$inferInsert;

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type FinancialFact = typeof financialFacts.$inferSelect;
export type NewFinancialFact = typeof financialFacts.$inferInsert;
