import { apiClient } from "@/lib/axios";
import type { UploadResponse } from "./upload.types";

export const uploadApi = {
  upload: async (formData: FormData): Promise<UploadResponse> => {
    const response = await apiClient.post<UploadResponse>("/upload", formData);
    return response.data;
  },
};
