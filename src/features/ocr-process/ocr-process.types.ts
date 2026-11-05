export const OCR_PROCESS_KEYS = {
    ocrProcess: "ocr-process",
} as const;

export type OcrProcessResponse = {
    fileId: string;
    processingStatus: "completed" | "failed";
    pageCount: number;
    chunkCount: number;
};
