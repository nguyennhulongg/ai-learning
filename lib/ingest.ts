import fs from 'fs';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { google } from '@ai-sdk/google';
import { embedMany } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import { documentChunk, documents } from '@/db/schema';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// A. Hàm trích xuất văn bản từ nhiều định dạng file khác nhau
async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);

    if (mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        return rows.map((row, i) => `Dòng ${i + 1}: ${JSON.stringify(row)}`).join('\n');
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
        return buffer.toString('utf-8');
    }

    throw new Error(`Định dạng file không được hỗ trợ: ${mimeType}`);
}

// B. Hàm chia nhỏ văn bản (Chunking) có gối đầu để giữ ngữ cảnh liền mạch
function chunkText(text: string, maxChunkLength: number = 600, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let index = 0;

    while (index < text.length) {
        let end = index + maxChunkLength;
        let chunk = text.slice(index, end);

        chunks.push(chunk.trim());
        index += maxChunkLength - overlap; // Dịch chuyển con trỏ lùi lại một đoạn (overlap)
    }

    return chunks.filter(c => c.length > 0);
}

// C. Pipeline chính xử lý toàn bộ quy trình nạp tài liệu
export async function processAndIngestDocument(filePath: string, fileName: string, mimeType: string, fileUrl: string) {
    try {
        console.log(`Đang xử lý file: ${fileName}...`);

        // 1. Trích xuất text
        const rawText = await extractTextFromFile(filePath, mimeType);

        // 2. Lưu metadata tài liệu gốc vào bảng `documents`
        const documentId = uuidv4();
        await db.insert(documents).values({
            id: documentId,
            title: fileName,
            file_url: fileUrl,
        });

        // 3. Cắt nhỏ văn bản
        const textChunks = chunkText(rawText, 600, 100);
        console.log(`Đã chia tài liệu thành ${textChunks.length} chunks.`);

        // 4. Gọi Google Gemini Embedding Model để tạo vector hàng loạt (Batch embedding)
        const { embeddings } = await embedMany({
            model: google.textEmbeddingModel('gemini-embedding-001'),
            values: textChunks,
        });

        // 5. Chuẩn bị dữ liệu và Insert vào bảng `document_chunks`
        const chunkValues = textChunks.map((chunk, i) => ({
            id: uuidv4(),
            documentId: documentId,
            content: chunk,
            embedding: embeddings[i], // Drizzle customType tự động serialize mảng số thành chuỗi vector
        }));

        await db.insert(documentChunk).values(chunkValues);

        console.log(`Hoàn tất nạp tài liệu "${fileName}" vào Vector Database!`);
        return { success: true, documentId, totalChunks: textChunks.length };

    } catch (error) {
        console.error("Lỗi trong quá trình Ingest tài liệu:", error);
        throw error;
    }
}