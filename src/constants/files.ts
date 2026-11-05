export const FILE_STATUS = {
    UPLOADED: "uploaded",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    NOT_REQUIRED: "not_required",
} as const;

export const UPLOAD_PURPOSE = {
    KNOWLEDGE_BASE: "knowledge_base",
    PROMPT_ATTACHMENT: "prompt_attachment",
} as const;

export type FileStatus = typeof FILE_STATUS[keyof typeof FILE_STATUS];
export type UploadPurpose = typeof UPLOAD_PURPOSE[keyof typeof UPLOAD_PURPOSE];


