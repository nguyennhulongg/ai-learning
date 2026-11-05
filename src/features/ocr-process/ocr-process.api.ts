import { apiClient } from "@/lib/axios";
import { OcrProcessResponse } from "./ocr-process.types";

export const ocrProcessApi = {
    process: async (fileId: string): Promise<OcrProcessResponse> => {
        const response = await apiClient.post<OcrProcessResponse>(`/files/${fileId}/process`);
        return response.data;
    },
};
