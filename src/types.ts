export interface TranslationOptions {
  inputPath: string;
  targetLanguage: string;
  outputPath?: string;
  verbose?: boolean;
}

export interface TextChunk {
  index: number;
  content: string;
  isTableContent: boolean;
  startOffset: number;
  endOffset: number;
}

export interface TranslationChunk {
  chunkIndex: number;
  originalContent: string;
  translatedContent: string;
  prefillText?: string;
}

export interface ProgressUpdate {
  chunkIndex: number;
  totalChunks: number;
  status: "processing" | "completed" | "error";
  message?: string;
}

export interface MergeConfig {
  overlappingParagraphIndices: number[];
}
