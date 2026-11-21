// Tìm file trong bảng files.
// Tạo signed URL để Python đọc PDF trong bucket private.
// Gọi Python bằng spawn, truyền URL qua stdin.
// Nhận JSON OCR, lưu kết quả vào file_contents.
// Chia văn bản thành các chunk và lưu vào file_chunks.
// Cập nhật trạng thái thành công hoặc thất bại.


import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { files, fileContents, fileChunks } from "@/db/schema";
import { OcrProcessResponse } from "@/features/ocr-process/ocr-process.types";
import { EXTRACTING_PROGRESS, ocrProgress } from "@/constants/progress";
import { finishJob, startJob, updateJob } from "@/server/processing-jobs";
import { extractAndSaveFacts } from "@/server/save-financials";

export const maxDuration = 300;

type ExtractedPage = {
    page_number: number;
    text: string;
    text_source: "native" | "tesseract";
    tables: unknown[];
};

type ExtractionResult = {
    extraction_version: string;
    page_count: number;
    pages: ExtractedPage[];
};

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, serviceKey);


// Chạy script Python để trích xuất PDF và trả về kết quả đã kiểm tra cấu trúc.
// spawn mở Python thành một tiến trình con (chương trình chạy song song với Node.js).
// Hai bên trao đổi qua stdin (luồng nhập) và stdout (luồng xuất): URL được ghi vào stdin,
// kết quả là dòng stdout bắt đầu bằng __OCR_RESULT__.
// Promise là giá trị sẽ có trong tương lai, ở đây là khi Python chạy xong.
// onPage được gọi mỗi khi Python báo đã xử lý xong một trang.
// Khi signal phát tín hiệu dừng, tiến trình Python bị tắt ngay.
function runPython(
    pdfUrl: string,
    onPage: (current: number, total: number) => void,
    signal: AbortSignal,
): Promise<ExtractionResult> {
    return new Promise((resolve, reject) => {
        const pythonPath =
            process.env.PYTHON_PATH ||
            path.join(process.cwd(), ".venv", "Scripts", "python.exe");

        const scriptPath = path.join(
            process.cwd(),
            "python",
            "process_pdf_api.py",
        );

        const child = spawn(pythonPath, [scriptPath], {
            cwd: process.cwd(),
            env: process.env,
            windowsHide: true,
            shell: false,
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let settled = false;

        // Từ chối Promise một lần duy nhất, kể cả khi nhiều sự kiện lỗi xảy ra.
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        signal.addEventListener(
            "abort",
            () => {
                child.kill();
                fail(signal.reason as Error);
            },
            { once: true },
        );

        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");

        child.stdout.on("data", (data: string) => {
            stdout += data;

            // Tránh giữ lượng output không giới hạn trong RAM.
            if (stdout.length > 2_000_000) {
                child.kill();
                fail(new Error("Python stdout vượt giới hạn 2 MB."));
            }
        });

        child.stderr.on("data", (data: string) => {
            stderr += data;
            process.stderr.write(`[PYTHON STDERR] ${data}`);

            // Python in tiến độ theo dạng "page 3/86: tesseract".
            for (const match of data.matchAll(/^page (\d+)\/(\d+):/gm)) {
                onPage(Number(match[1]), Number(match[2]));
            }
        });

        child.on("error", (error) => {
            fail(
                new Error(
                    `Không khởi chạy được Python (${pythonPath}): ${error.message}`,
                ),
            );
        });

        child.stdin.on("error", (error) => {
            // Python có thể thoát trước khi nhận hết stdin.
            // Sự kiện close sẽ báo lỗi nếu tiến trình thất bại.
            process.stderr.write(
                `[PYTHON STDIN] ${error.message}\n`,
            );
        });

        child.on("close", (code) => {
            if (settled) return;

            if (code !== 0) {
                fail(
                    new Error(
                        stderr.trim() ||
                        `Python exited with code ${code}`,
                    ),
                );
                return;
            }

            const marker = "__OCR_RESULT__";
            const resultLine = stdout
                .split(/\r?\n/)
                .find((line) => line.startsWith(marker));

            if (!resultLine) {
                fail(
                    new Error(
                        [
                            "Python không trả về kết quả OCR hợp lệ.",
                            `stdout: ${stdout.slice(0, 1000)}`,
                            `stderr: ${stderr.slice(0, 2000)}`,
                        ].join("\n"),
                    ),
                );
                return;
            }

            try {
                const result = JSON.parse(
                    resultLine.slice(marker.length),
                ) as ExtractionResult;

                if (
                    !Array.isArray(result.pages) ||
                    typeof result.page_count !== "number" ||
                    typeof result.extraction_version !== "string"
                ) {
                    throw new Error(
                        "Python trả về JSON không đúng cấu trúc.",
                    );
                }

                for (const page of result.pages) {
                    if (
                        typeof page.page_number !== "number" ||
                        typeof page.text !== "string" ||
                        !Array.isArray(page.tables)
                    ) {
                        throw new Error(
                            "Dữ liệu một trang OCR không hợp lệ.",
                        );
                    }
                }

                settled = true;
                resolve(result);
            } catch (error) {
                fail(
                    error instanceof Error
                        ? error
                        : new Error("Không parse được JSON OCR."),
                );
            }
        });

        child.stdin.end(JSON.stringify({ pdfUrl }));
    });
}


// Chia văn bản thành các chunk (đoạn nhỏ) dài tối đa chunkSize ký tự, ưu tiên cắt ở ranh giới từ.
// Cần chia nhỏ vì RAG chỉ lấy vài đoạn liên quan nhất cho AI, không gửi cả tài liệu.
// Overlap là phần chồng lấn: hai chunk liền nhau có chung overlap ký tự,
// để ý nằm ngay chỗ cắt không bị mất.
function splitText(
    text: string,
    chunkSize = 1200,
    overlap = 200,
): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();

    if (!normalized) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < normalized.length) {
        let end = Math.min(start + chunkSize, normalized.length);

        // Cố gắng cắt tại ranh giới từ.
        if (end < normalized.length) {
            const spaceIndex = normalized.lastIndexOf(" ", end);

            if (spaceIndex > start + chunkSize * 0.6) {
                end = spaceIndex;
            }
        }

        const chunk = normalized.slice(start, end).trim();

        if (chunk) chunks.push(chunk);

        if (end >= normalized.length) break;

        start = Math.max(end - overlap, start + 1);
    }

    return chunks;
}

// Xử lý một file trong knowledge base (kho tài liệu để AI tra cứu):
// trích xuất PDF, chia chunk rồi lưu vào DB.
// Trạng thái xử lý được ghi vào bảng files, kể cả khi thất bại.
export async function POST(
    _req: Request,
    context: { params: Promise<{ fileId: string }> },
) {
    // Endpoint chỉ được phép chạy trong môi trường local development.
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
            { error: "Endpoint chỉ dùng cho local development." },
            { status: 403 },
        );
    }

    const { fileId } = await context.params;

    const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, fileId))
        .limit(1);

    if (!file) {
        return NextResponse.json(
            { error: "Không tìm thấy file." },
            { status: 404 },
        );
    }

    if (file.mime_type !== "application/pdf") {
        return NextResponse.json(
            { error: "Pipeline hiện chỉ hỗ trợ PDF." },
            { status: 400 },
        );
    }

    // Nếu đã thêm cột purpose, chỉ xử lý file thuộc knowledge base.
    if (file.purpose !== "knowledge_base") {
        return NextResponse.json(
            { error: "File không thuộc knowledge base." },
            { status: 400 },
        );
    }

    const job = startJob(fileId);

    try {
        await db
            .update(files)
            .set({
                processing_status: "processing",
                error_message: null,
            })
            .where(eq(files.id, fileId));

        const { data: signedData, error: signedError } =
            await supabase.storage
                .from(file.bucket_name)
                .createSignedUrl(file.storage_path, 600);

        if (signedError || !signedData?.signedUrl) {
            throw new Error(
                signedError?.message || "Không tạo được signed URL.",
            );
        }

        const result = await runPython(
            signedData.signedUrl,
            (current, total) => updateJob(fileId, ocrProgress(current, total)),
            job.signal,
        );

        const plainText = result.pages
            .map((page) => `Trang ${page.page_number}\n${page.text}`)
            .join("\n\n");

        const markdown = result.pages
            .map((page) => `## Trang ${page.page_number}\n\n${page.text}`)
            .join("\n\n");

        if (!plainText.trim()) {
            throw new Error("Không trích xuất được văn bản từ PDF.");
        }

        const chunkRows = result.pages.flatMap((page) =>
            splitText(page.text).map((content) => ({
                id: crypto.randomUUID(),
                file_id: fileId,
                chunk_index: 0, // Gán lại index duy nhất phía dưới.
                content,
                page_start: page.page_number,
                page_end: page.page_number,
                section_path: [],
                metadata: {
                    text_source: page.text_source,
                    extraction_version: result.extraction_version,
                },
            })),
        );

        // Index tăng dần trên toàn bộ file.
        const indexedChunkRows = chunkRows.map((chunk, index) => ({
            ...chunk,
            chunk_index: index,
        }));

        // Transaction gom nhiều lệnh DB thành một khối: tất cả cùng thành công hoặc cùng huỷ.
        // Nhờ vậy, nếu lỗi giữa chừng thì chunk cũ không bị mất.
        await db.transaction(async (tx) => {
            // Lưu nội dung trích xuất. Unique index trên file_id bảo đảm mỗi file chỉ có một dòng,
            // nên onConflictDoUpdate sẽ cập nhật dòng cũ thay vì báo lỗi trùng khi chạy lại.
            await tx
                .insert(fileContents)
                .values({
                    id: crypto.randomUUID(),
                    file_id: fileId,
                    content_json: result,
                    markdown,
                    plain_text: plainText,
                    extraction_version: result.extraction_version,
                })
                .onConflictDoUpdate({
                    target: fileContents.file_id,
                    set: {
                        content_json: result,
                        markdown,
                        plain_text: plainText,
                        extraction_version: result.extraction_version,
                        updated_at: new Date(),
                    },
                });

            // Xóa chunk cũ trước khi tạo lại, tránh dữ liệu trùng khi chạy lại.
            await tx
                .delete(fileChunks)
                .where(eq(fileChunks.file_id, fileId));

            if (indexedChunkRows.length > 0) {
                await tx.insert(fileChunks).values(indexedChunkRows);
            }
        });

        // Chạy sau khi OCR đã lưu xong, nên lỗi trích số không làm mất nội dung đã OCR.
        updateJob(fileId, EXTRACTING_PROGRESS);

        const extraction = await extractAndSaveFacts(fileId, result.pages, job.signal);
        job.signal.throwIfAborted();

        // Chỉ báo hoàn tất sau khi trích số xong, để giao diện không chuyển tab quá sớm.
        await db
            .update(files)
            .set({
                processing_status: "completed",
                page_count: result.page_count,
                processed_at: new Date(),
                error_message: null,
            })
            .where(eq(files.id, fileId));

        return NextResponse.json<OcrProcessResponse>({
            fileId,
            processingStatus: "completed",
            pageCount: result.page_count,
            chunkCount: indexedChunkRows.length,
            extraction,
        });
    } catch (error) {
        // Huỷ là thao tác của người dùng chứ không phải lỗi, nên trả về 200.
        // Route cancel đã cập nhật trạng thái nên không ghi đè ở đây.
        if (job.signal.aborted) {
            return NextResponse.json({ cancelled: true });
        }

        const message =
            error instanceof Error ? error.message : "OCR processing failed";

        console.error("PDF processing error:", { fileId, message });

        await db
            .update(files)
            .set({
                processing_status: "failed",
                // Lấy phần cuối vì traceback (dấu vết các hàm đang chạy khi lỗi)
                // của Python nằm sau log tiến độ.
                error_message: message.slice(-2000),
            })
            .where(eq(files.id, fileId));

        return NextResponse.json(
            { fileId, processingStatus: "failed", error: message },
            { status: 500 },
        );
    } finally {
        finishJob(fileId, job);
    }
}
