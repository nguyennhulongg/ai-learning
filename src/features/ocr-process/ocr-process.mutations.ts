import { useMutation } from "@tanstack/react-query";
import { ocrProcessApi } from "./ocr-process.api";

export function useOcrProcess() {
    return useMutation({
        mutationFn: (fileId: string) => ocrProcessApi.process(fileId),
    });
}
