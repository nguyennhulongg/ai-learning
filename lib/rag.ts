// lib/rag.ts
import { db } from '@/db';
import { documentChunk } from '@/db/schema';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import { sql, desc, gt } from 'drizzle-orm';

const EMBEDDING_MODEL = 'gemini-embedding-001'

export async function retrieveContext(userQuery: string): Promise<string> {
  // 1. Tạo vector embedding cho câu hỏi của user
  const { embedding: queryEmbedding } = await embed({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    value: userQuery,
  });

  // Chuyển mảng thành định dạng chuỗi vector chuẩn của pgvector: '[0.12,-0.45,...]'
  const vectorString = `[${queryEmbedding.join(',')}]`;

  // 2. Viết câu lệnh truy vấn vector search bằng Drizzle sql template
  // Toán tử <=> tính khoảng cách cosine distance, 1 - distance = similarity
  const similarityScore = sql`1 - (${documentChunk.embedding} <=> ${vectorString}::vector)`;

  const results = await db
    .select({
      content: documentChunk.content,
      similarity: similarityScore,
    })
    .from(documentChunk)
    .where(gt(similarityScore, 0.5)) // Lọc các chunk có độ khớp lớn hơn 0.5 (Threshold)
    .orderBy(desc(similarityScore))  // Sắp xếp theo độ tương đồng giảm dần
    .limit(3);                       // Lấy Top 3 kết quả tốt nhất

  if (results.length === 0) {
    return "Không tìm thấy thông tin phù hợp trong cơ sở dữ liệu.";
  }

  // 3. Gộp nội dung các chunk lại thành một khối ngữ cảnh hoàn chỉnh cho AI
  return results.map((row) => row.content).join("\n\n");
}