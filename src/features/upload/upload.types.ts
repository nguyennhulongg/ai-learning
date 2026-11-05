export interface UploadResponse {
  fileId: string;
  purpose: string;
  path: string;
  signedUrl: string | null;
  name: string;
  size: number;
  type: string;
}

export interface UploadInput {
  file: File;
  purpose: 'knowledge_base' | 'prompt_attachment';
}
