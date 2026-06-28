export type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

export interface ScannedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: ProcessingStatus;
  extractedText: string | null;
  errorMessage?: string;
}

export enum OcrMode {
  Standard = 'STANDARD',
  Formatting = 'FORMATTING', // Preserves tables, lists, etc.
  Educational = 'EDUCATIONAL', // تحليل مستندات تعليمية
}