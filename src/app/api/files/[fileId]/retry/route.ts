import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { fileContents, files } from "@/db/schema";
import type { OcrProcessResponse } from "@/features/ocr-process/ocr-process.types";
import { EXTRACTING_PROGRESS } from "@/constants/progress";
import { finishJob, startJob, updateJob } from "@/server/processing-jobs";
import { extractAndSaveFacts } from "@/server/save-financials";
import type { ExtractablePage } from "@/server/extract-financials";

// Chạy lại riêng bước trích số từ nội dung đã OCR, không tốn thời gian OCR lại.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  const [content] = await db
    .select({ content_json: fileContents.content_json })
    .from(fileContents)
    .where(eq(fileContents.file_id, fileId))
    .limit(1);

  if (!content) {
    return NextResponse.json(
      { error: "File chưa có nội dung OCR để thử lại." },
      { status: 404 },
    );
  }

  const pages = content.content_json.pages as ExtractablePage[];
  const job = startJob(fileId);

  try {
    await db
      .update(files)
      .set({ processing_status: "processing", error_message: null })
      .where(eq(files.id, fileId));

    updateJob(fileId, EXTRACTING_PROGRESS);

    const extraction = await extractAndSaveFacts(fileId, pages, job.signal);
    job.signal.throwIfAborted();

    await db
      .update(files)
      .set({ processing_status: "completed", processed_at: new Date(), error_message: null })
      .where(eq(files.id, fileId));

    return NextResponse.json<OcrProcessResponse>({
      fileId,
      processingStatus: "completed",
      pageCount: pages.length,
      chunkCount: 0,
      extraction,
    });
  } catch (error) {
    // Huỷ là thao tác của người dùng chứ không phải lỗi, nên trả về 200.
    // Route cancel đã cập nhật trạng thái nên không ghi đè ở đây.
    if (job.signal.aborted) {
      return NextResponse.json({ cancelled: true });
    }

    const message = error instanceof Error ? error.message : "Thử lại thất bại";
    console.error("Retry extraction error:", { fileId, message });

    await db
      .update(files)
      .set({ processing_status: "failed", error_message: message.slice(-2000) })
      .where(eq(files.id, fileId));

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    finishJob(fileId, job);
  }
}
