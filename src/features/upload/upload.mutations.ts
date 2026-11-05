import { useMutation } from "@tanstack/react-query";
import { uploadApi } from "./upload.api";

export function useUploadFile() {
  return useMutation({
    mutationFn: (formData: FormData) => uploadApi.upload(formData),
  });
}
