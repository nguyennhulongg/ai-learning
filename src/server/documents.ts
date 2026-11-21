// Các thao tác huỷ và xoá tài liệu trong knowledge base (kho tài liệu để AI tra cứu).
//
// Thuật ngữ:
//   - Transaction: gom nhiều lệnh DB thành một khối, cùng thành công hoặc cùng huỷ.
//   - Cascade: khi xoá một dòng, DB tự xoá các dòng phụ thuộc vào nó.

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { fileContents, files, reports } from "@/db/schema";
import { abortJob, CANCEL_MESSAGE } from "./processing-jobs";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceKey);

// Dừng xử lý nếu đang chạy, rồi xoá file và mọi dữ liệu sinh ra từ nó.
// Báo cáo phải xoá trước, vì nếu chỉ xoá file thì số liệu vẫn còn nhưng mất nguồn gốc.
// Nội dung OCR và chunk tự xoá theo file nhờ cascade.
export async function deleteDocument(fileId: string): Promise<boolean> {
  abortJob(fileId);

  const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
  if (!file) return false;

  await db.transaction(async (tx) => {
    await tx.delete(reports).where(eq(reports.file_id, fileId));
    await tx.delete(files).where(eq(files.id, fileId));
  });

  // Xoá trên Storage sau cùng: nếu bước này lỗi thì chỉ còn file thừa, không mất dữ liệu.
  const { error } = await supabase.storage.from(file.bucket_name).remove([file.storage_path]);
  if (error) {
    console.error("Storage delete error:", { fileId, message: error.message });
  }
  return true;
}

// Huỷ xử lý một file. Đã có nội dung OCR thì giữ lại để thử lại được,
// chưa có thì xoá hẳn vì không còn gì đáng giữ.
// Hàm này cũng dọn được file bị kẹt khi server tắt giữa chừng.
export async function cancelDocument(fileId: string): Promise<void> {
  abortJob(fileId);

  const [content] = await db
    .select({ id: fileContents.id })
    .from(fileContents)
    .where(eq(fileContents.file_id, fileId))
    .limit(1);

  if (!content) {
    await deleteDocument(fileId);
    return;
  }

  await db
    .update(files)
    .set({ processing_status: "failed", error_message: CANCEL_MESSAGE })
    .where(eq(files.id, fileId));
}
