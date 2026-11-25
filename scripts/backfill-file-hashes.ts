// Tính mã băm SHA-256 cho các file upload trước khi có cột content_hash,
// để file cũ cũng được nhận diện khi có người upload lại.
//
// Chạy bằng: npm run backfill:hashes
//
// Script tải từng file từ Supabase Storage nên mất thời gian tuỳ dung lượng.
// Chạy lại nhiều lần cũng được, vì chỉ xử lý file còn thiếu mã.

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { files } from "@/db/schema";

// Tải file từ Storage và tính mã băm của nội dung.
async function hashStoredFile(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error) throw new Error(`Không tải được ${storagePath}: ${error.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  return createHash("sha256").update(buffer).digest("hex");
}

// Điền mã băm cho các file còn thiếu, rồi in các nhóm file trùng nội dung.
async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const pending = await db.select().from(files).where(isNull(files.content_hash));
  console.log(`Cần tính mã cho ${pending.length} file.`);

  for (const file of pending) {
    try {
      const hash = await hashStoredFile(supabase, file.bucket_name, file.storage_path);
      await db.update(files).set({ content_hash: hash }).where(eq(files.id, file.id));
    } catch (error) {
      console.error(`Bỏ qua ${file.file_name}:`, (error as Error).message);
    }
  }

  // Nhóm file theo mã băm; nhóm có hơn một file là các bản trùng.
  const all = await db.select().from(files);
  const groups = Map.groupBy(
    all.filter((file) => file.content_hash),
    (file) => file.content_hash!,
  );

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    console.log(`\nTrùng nội dung (${group.length} file):`);
    for (const file of group) {
      console.log(`  ${file.created_at.toISOString()}  ${file.id}  ${file.file_name}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
