import { apiClient } from "@/lib/axios";
import type { UploadResponse } from "./upload.types";

export const uploadApi = {
  // onProgress nhận phần trăm đã gửi lên server, dùng cho thanh tiến độ.
  upload: async (
    formData: FormData,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
  ): Promise<UploadResponse> => {
    const response = await apiClient.post<UploadResponse>("/upload", formData, {
      signal,
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    });
    return response.data;
  },
};
