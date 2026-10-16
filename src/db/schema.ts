import { pgTable, varchar, timestamp, text, boolean, customType, jsonb } from "drizzle-orm/pg-core";

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

export const documents = pgTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  title: text("title").notNull(),
  file_url: text("file_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentChunk = pgTable("document_chunks", {
  id: varchar("id", { length: 36 }).primaryKey(),
  documentId: varchar("document_id", { length: 36 })
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Sử dụng custom type vector đã định nghĩa ở trên
  embedding: vector("embedding").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunk.$inferSelect;
export type NewDocumentChunk = typeof documentChunk.$inferInsert;