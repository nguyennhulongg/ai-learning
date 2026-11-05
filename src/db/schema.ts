import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, text, boolean, customType, jsonb, bigint, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

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