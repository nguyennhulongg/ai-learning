export const OCR_PROCESS_KEYS = {
    ocrProcess: "ocr-process",
} as const;

export type OcrProcessResponse = {
    fileId: string;
    processingStatus: "completed" | "failed";
    pageCount: number;
    chunkCount: number;
    extraction: {
        status: "completed" | "no_statements" | "skipped" | "failed";
        report: {
            ticker: string;
            fiscal_year: number;
            fiscal_quarter: number;
        } | null;
        factCount: number;
        rejected: string[];
        warnings: string[];
    };
};
