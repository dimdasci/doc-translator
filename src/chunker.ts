import type { TextChunk } from "./types.js";

const APPROX_TOKENS_PER_WORD = 0.75;
const MAX_TOKENS_PER_CHUNK = 6000;
const MAX_WORDS_PER_CHUNK = Math.floor(MAX_TOKENS_PER_CHUNK / APPROX_TOKENS_PER_WORD);

// Table detection regex
const TABLE_PATTERN = /^\s*\|.+\|.+\n\s*\|[\s:|-]+\|/m;

interface SplitUnit {
  type: "paragraph" | "sentence";
  content: string;
  isTable: boolean;
}

/**
 * Detects if a given text block contains a table
 */
function isTableBlock(text: string): boolean {
  return TABLE_PATTERN.test(text);
}

/**
 * Splits text by paragraphs (double newline) first
 */
function splitByParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

/**
 * Splits a paragraph by sentences while respecting abbreviations
 */
function splitBySentences(paragraph: string): string[] {
  // Handle common abbreviations and avoid splitting on them
  const sentenceEndPattern = /([.!?])\s+(?=[A-Z])/g;

  const sentences = paragraph.split(sentenceEndPattern);
  const result: string[] = [];

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const ending = sentences[i + 1] || "";

    if (sentence.trim()) {
      result.push((sentence + ending).trim());
    }
  }

  return result.length > 0 ? result : [paragraph];
}

/**
 * Counts approximate words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Chunks text intelligently:
 * 1. Never splits tables
 * 2. Splits at paragraph boundaries when possible
 * 3. Falls back to sentence boundaries if needed
 * 4. Respects maximum token limit
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let currentWords = 0;
  let chunkIndex = 0;
  let globalOffset = 0;

  const paragraphs = splitByParagraphs(text);

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    const isTable = isTableBlock(paragraph);

    // If table is too large or current chunk would overflow, flush current chunk
    if (isTable) {
      if (currentChunk.trim()) {
        chunks.push({
          index: chunkIndex,
          content: currentChunk.trim(),
          isTableContent: false,
          startOffset: globalOffset - currentChunk.length,
          endOffset: globalOffset,
        });
        chunkIndex++;
        globalOffset += 2; // Account for paragraph separator
        currentChunk = "";
        currentWords = 0;
      }

      // Add table as its own chunk
      chunks.push({
        index: chunkIndex,
        content: paragraph,
        isTableContent: true,
        startOffset: globalOffset,
        endOffset: globalOffset + paragraph.length,
      });
      chunkIndex++;
      globalOffset += paragraph.length + 2;
      continue;
    }

    // Check if adding this paragraph would exceed limit
    if (currentWords + paragraphWords > MAX_WORDS_PER_CHUNK && currentChunk.trim()) {
      // Current chunk is full, flush it
      chunks.push({
        index: chunkIndex,
        content: currentChunk.trim(),
        isTableContent: false,
        startOffset: globalOffset - currentChunk.length,
        endOffset: globalOffset,
      });
      chunkIndex++;
      globalOffset += 2; // Account for paragraph separator
      currentChunk = "";
      currentWords = 0;
    }

    // If paragraph itself is too large, split by sentences
    if (paragraphWords > MAX_WORDS_PER_CHUNK) {
      const sentences = splitBySentences(paragraph);

      for (const sentence of sentences) {
        const sentenceWords = countWords(sentence);

        if (currentWords + sentenceWords > MAX_WORDS_PER_CHUNK && currentChunk.trim()) {
          chunks.push({
            index: chunkIndex,
            content: currentChunk.trim(),
            isTableContent: false,
            startOffset: globalOffset - currentChunk.length,
            endOffset: globalOffset,
          });
          chunkIndex++;
          globalOffset += 2;
          currentChunk = "";
          currentWords = 0;
        }

        currentChunk += (currentChunk ? " " : "") + sentence;
        currentWords += sentenceWords;
        globalOffset += sentence.length + (currentChunk !== sentence ? 1 : 0);
      }
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      currentWords += paragraphWords;
      globalOffset += paragraph.length + 2;
    }
  }

  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      index: chunkIndex,
      content: currentChunk.trim(),
      isTableContent: false,
      startOffset: globalOffset - currentChunk.length,
      endOffset: globalOffset,
    });
  }

  return chunks;
}

/**
 * Extracts the last paragraph from a chunk for use as prefill text
 */
export function extractLastParagraph(text: string): string {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  return paragraphs[paragraphs.length - 1] || text;
}
