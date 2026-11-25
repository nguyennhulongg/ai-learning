export interface UploadResponse {
  fileId: string;
  purpose: string;
  path: string;
  signedUrl: string | null;
  name: string;
  size: number;
  type: string;
  // Tên file đã có với cùng nội dung; khi có giá trị này, server không lưu file mới.
  duplicateOf?: string;
}

export interface UploadInput {
  file: File;
  purpose: 'knowledge_base' | 'prompt_attachment';
}
