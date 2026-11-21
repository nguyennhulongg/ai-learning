// Kiểu dữ liệu, API và cách phân loại tài liệu cho các tab của modal upload.

import { apiClient } from "@/lib/axios";
import type { OcrProcessResponse } from "@/features/ocr-process/ocr-process.types";
import { summarizeError } from "@/utils/error-message";

type ExtractionResult = OcrProcessResponse["extraction"];

export type DocumentRecord = {
  id: string;
  file_name: string;
  processing_status: string;
  page_count: number | null;
  error_message: string | null;
  // Đã có nội dung OCR thì thử lại chỉ cần chạy bước trích số.
  has_content: boolean;
  metadata: {
    extraction?: ExtractionResult;
  };
  created_at: string;
};

export type DocumentGroup = "active" | "success" | "content_only" | "failed";

export const documentsApi = {
  // Lấy danh sách tài liệu. signal cho phép huỷ request khi không còn cần kết quả.
  getAll: async (signal?: AbortSignal): Promise<DocumentRecord[]> => {
    const response = await apiClient.get<DocumentRecord[]>("/files/list", { signal });
    return response.data;
  },

  // Huỷ việc xử lý một tài liệu đang chạy.
  cancel: async (fileId: string): Promise<void> => {
    await apiClient.post(`/files/${fileId}/cancel`);
  },

  // Xoá tài liệu cùng toàn bộ dữ liệu sinh ra từ nó.
  delete: async (fileId: string): Promise<void> => {
    await apiClient.delete(`/files/${fileId}/delete`);
  },
};

// Xếp tài liệu vào một tab. Mục tiêu là có số liệu, nên OCR xong mà không lưu được
// chỉ tiêu nào vẫn tính là thất bại, trừ khi file vốn không có bảng báo cáo.
export function getDocumentGroup(document: DocumentRecord): DocumentGroup {
  const { processing_status: status, metadata } = document;

  if (status === "pending" || status === "processing") return "active";
  if (status === "failed") return "failed";

  const extraction = metadata.extraction;
  if (extraction?.status === "no_statements") return "content_only";

  const hasFacts = extraction?.status === "completed" && extraction.factCount > 0;
  return hasFacts ? "success" : "failed";
}

// Lấy lý do thất bại để hiện cho người dùng.
export function getFailureReason(document: DocumentRecord): string {
  const warnings = document.metadata.extraction?.warnings ?? [];
  return summarizeError(document.error_message ?? warnings[0] ?? "Không lưu được số liệu.");
}
