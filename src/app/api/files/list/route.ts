import { connection, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";

import { UPLOAD_PURPOSE } from "@/constants/files";
import { db } from "@/db";
import { files } from "@/db/schema";

// Trả về tài liệu trong knowledge base (kho tài liệu để AI tra cứu) cùng trạng thái xử lý.
// Giao diện gọi lặp lại route này để cập nhật thanh tiến độ.
export async function GET() {
  // Báo Next.js chạy route khi có request, vì tiến độ phải luôn là dữ liệu mới nhất.
  await connection();

  try {
    const rows = await db
      .select({
        id: files.id,
        file_name: files.file_name,
        processing_status: files.processing_status,
        page_count: files.page_count,
        error_message: files.error_message,
        metadata: files.metadata,
        // Viết rõ tên bảng, vì Drizzle bỏ tiền tố bảng khi truy vấn chỉ có một bảng,
        // khiến "id" bị hiểu nhầm thành cột của file_contents trong truy vấn con.
        has_content: sql<boolean>`exists (
          select 1 from file_contents where file_contents.file_id = files.id
        )`,
        created_at: files.created_at,
      })
      .from(files)
      .where(eq(files.purpose, UPLOAD_PURPOSE.KNOWLEDGE_BASE))
      .orderBy(desc(files.created_at));

    return NextResponse.json(rows);
  } catch (error) {
    // cause là lỗi gốc từ DB; thông báo ngoài cùng của Drizzle chỉ chứa câu truy vấn.
    console.error("Error fetching documents:", error, (error as Error).cause);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}
