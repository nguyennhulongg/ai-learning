import { apiClient } from "@/lib/axios";
import { OcrProcessResponse } from "./ocr-process.types";

export const ocrProcessApi = {
    process: async (fileId: string): Promise<OcrProcessResponse> => {
        const response = await apiClient.post<OcrProcessResponse>(`/files/${fileId}/process`);
        return response.data;
    },

    // Chạy lại bước trích số từ nội dung đã OCR.
    retry: async (fileId: string): Promise<OcrProcessResponse> => {
        const response = await apiClient.post<OcrProcessResponse>(`/files/${fileId}/retry`);
        return response.data;
    },
};
