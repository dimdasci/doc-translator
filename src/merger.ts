import type { TranslationChunk } from "./types.js";

/**
 * Finds the best match position for overlap cleanup
 * Compares the prefill text with the translated content to find where they end
 */
function findOverlapBoundary(prefillText: string, translatedContent: string): number {
  // Split prefill into sentences/parts for matching
  const prefillParts = prefillText.split(/(?<=[.!?])\s+/);

  // Try to find the end of the prefill in the translated content
  // Start from the end and work backwards
  for (let i = prefillParts.length; i > 0; i--) {
    const partToMatch = prefillParts.slice(0, i).join(" ");

    // Check if this part exists in the translated content
    if (translatedContent.includes(partToMatch)) {
      // Find the position right after this match
      const matchIndex = translatedContent.lastIndexOf(partToMatch);
      const endPosition = matchIndex + partToMatch.length;

      // Find the next sentence boundary after this position
      const nextBoundaryMatch = translatedContent.substring(endPosition).match(/^[.!?]*\s+/);
      if (nextBoundaryMatch) {
        return endPosition + nextBoundaryMatch[0].length;
      }

      return endPosition;
    }
  }

  // Fallback: if we can't find exact match, skip at least the beginning
  return 0;
}

/**
 * Merges translated chunks, removing overlapping text from prefill
 */
export function mergeTranslations(chunks: TranslationChunk[]): string {
  if (chunks.length === 0) return "";

  if (chunks.length === 1) {
    return chunks[0].translatedContent;
  }

  const result: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (i === 0) {
      // First chunk: add as-is
      result.push(chunk.translatedContent);
    } else {
      // Subsequent chunks: remove prefill overlap if present
      const prefillText = chunk.prefillText;

      if (prefillText) {
        const boundaryIndex = findOverlapBoundary(prefillText, chunk.translatedContent);

        // Get the content after the overlap
        const contentWithoutOverlap = chunk.translatedContent.substring(boundaryIndex).trim();

        if (contentWithoutOverlap) {
          result.push(`\n\n${contentWithoutOverlap}`);
        }
      } else {
        result.push(`\n\n${chunk.translatedContent}`);
      }
    }
  }

  return result.join("");
}

/**
 * Cleans up merged text by normalizing paragraph separators
 */
export function cleanupMergedText(text: string): string {
  // Normalize multiple newlines to double newlines
  return text
    .replace(/\n\n\n+/g, "\n\n")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}
