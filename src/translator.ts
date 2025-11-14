import Anthropic from "@anthropic-ai/sdk";
import { chunkText, extractLastParagraph } from "./chunker.js";
import type { ProgressUpdate, TextChunk, TranslationChunk } from "./types.js";

type ProgressCallback = (update: ProgressUpdate) => void;

export class DocumentTranslator {
  private client: Anthropic;
  private model: string;
  private onProgress: ProgressCallback;

  constructor(apiKey: string, model: string, onProgress?: ProgressCallback) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.onProgress = onProgress
      || (() => {
        // Default no-op
      });
  }

  /**
   * Translates a document to the target language
   */
  async translateDocument(content: string, targetLanguage: string): Promise<string> {
    const chunks = chunkText(content);

    if (chunks.length === 0) {
      throw new Error("No content to translate");
    }

    const translatedChunks: TranslationChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      this.onProgress({
        chunkIndex: i,
        totalChunks: chunks.length,
        status: "processing",
        message: `Translating chunk ${i + 1} of ${chunks.length}...`,
      });

      try {
        const translatedContent = await this.translateChunk(
          chunk,
          targetLanguage,
          i > 0 ? chunks[i - 1] : undefined,
        );

        translatedChunks.push({
          chunkIndex: i,
          originalContent: chunk.content,
          translatedContent,
          prefillText: i > 0 ? extractLastParagraph(chunks[i - 1].content) : undefined,
        });

        this.onProgress({
          chunkIndex: i,
          totalChunks: chunks.length,
          status: "completed",
          message: `Chunk ${i + 1} completed`,
        });
      } catch (error) {
        this.onProgress({
          chunkIndex: i,
          totalChunks: chunks.length,
          status: "error",
          message: `Failed to translate chunk ${i + 1}`,
        });

        throw error;
      }
    }

    return this.mergeTranslatedChunks(translatedChunks);
  }

  /**
   * Translates a single chunk with optional prefill support
   */
  private async translateChunk(
    chunk: TextChunk,
    targetLanguage: string,
    previousChunk?: TextChunk,
  ): Promise<string> {
    const systemPrompt =
      `You are a professional translator. Translate the provided markdown text to ${targetLanguage}.
Keep the markdown formatting intact, including headers, lists, code blocks, and tables.
Maintain the structure and tone of the original document.
If there are code blocks or technical terms, preserve them as-is.
Do not add any explanations or meta-commentary outside the translation.`;

    // Build the user message with prefill if this is not the first chunk
    const messages: Anthropic.MessageParam[] = [];

    if (previousChunk && !chunk.isTableContent) {
      // Add context from the previous chunk
      const overlapParagraph = extractLastParagraph(previousChunk.content);

      // Include the overlap paragraph at the start of the user message (original language)
      // Plus the chunk content to translate
      const userContent =
        `Here is the text to translate to ${targetLanguage}:\n\n${overlapParagraph}\n\n${chunk.content}`;

      messages.push({
        role: "user",
        content: userContent,
      });

      // Use prefill feature - add an assistant message that starts with the translated overlap
      // This helps Claude understand the context and maintain continuity
      // We'll remove this prefill text during merge
      const translatedOverlap = overlapParagraph;

      messages.push({
        role: "assistant",
        content: translatedOverlap,
      });
    } else {
      messages.push({
        role: "user",
        content: `Translate the following markdown text to ${targetLanguage}:\n\n${chunk.content}`,
      });
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system: systemPrompt,
      messages,
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    // If we used prefill, remove the prefill marker from the response
    let result = textContent.text;

    if (previousChunk && !chunk.isTableContent) {
      result = result.replace(/^\[Previous context translated\]:.*?\n\n/, "");
    }

    return result.trim();
  }

  /**
   * Merges translated chunks into a single document
   */
  private mergeTranslatedChunks(chunks: TranslationChunk[]): string {
    if (chunks.length === 0) return "";

    const result: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i === 0) {
        result.push(chunk.translatedContent);
      } else {
        // Remove the prefill context if present
        let cleanedContent = chunk.translatedContent;

        if (chunk.prefillText) {
          // Try to find and remove the overlap
          // Look for the exact prefill text in the content
          const prefillIndex = cleanedContent.indexOf(chunk.prefillText);

          if (prefillIndex !== -1) {
            // Found the prefill, skip to after it
            const endIndex = prefillIndex + chunk.prefillText.length;
            // Skip any trailing newlines/whitespace
            const remainingContent = cleanedContent.substring(endIndex).trimStart();
            cleanedContent = remainingContent;
          }
        }

        if (cleanedContent) {
          result.push(`\n\n${cleanedContent}`);
        }
      }
    }

    return result
      .join("")
      .replace(/\n\n\n+/g, "\n\n")
      .trim();
  }
}
