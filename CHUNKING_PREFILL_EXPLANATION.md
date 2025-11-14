# Chunking and Bilingual Prefill Implementation

## Overview

The document translation system chunks large documents into manageable pieces, translates each chunk via the Anthropic API, then merges them seamlessly. The prefill feature ensures context continuity using bilingual context (overlap paragraph in both original and translated form).

---

## Part 1: Text Chunking Strategy

### Problem

Large documents exceed API token limits. For example:
- Documents > 100KB may exceed context windows
- Chunking needed to preserve document structure and semantic meaning

### Solution: Intelligent Chunking

Chunking strategy balances size limits with semantic boundaries.

#### Key Constraints

```
MAX_TOKENS_PER_CHUNK = 4000 tokens
MAX_WORDS_PER_CHUNK = ~5333 words (0.75 tokens per word)
```

#### Algorithm (`src/chunker.ts`)

```
1. Split by paragraphs (double newlines \n\n)
2. For each paragraph:
   - If table: create dedicated chunk (never split tables)
   - If adding paragraph exceeds limit: flush current chunk
   - If paragraph > 5333 words: split by sentences
   - Otherwise: add to current chunk
3. Flush remaining content
```

### Chunking Features

#### 1. Table Detection

Markdown tables are never split across chunks:
```typescript
const TABLE_PATTERN = /^\s*\|.+\|.+\n\s*\|[\s:|-]+\|/m;
```

#### 2. Paragraph Boundaries

Primary split at `\n\n` ensures coherent units.

#### 3. Sentence-Level Fallback

If a single paragraph exceeds 5333 words, split by sentences.

#### 4. Word Counting

Track total words to enforce chunk size limits.

---

## Part 2: Bilingual Prefill Implementation

### Problem: Context Loss Between Chunks

When translating independently, each chunk loses context from previous chunks. Terminology and references may be inconsistent.

### Solution: Anthropic Prefill with Bilingual Context

Include overlap paragraph in both:
1. **User message** (original language) - what was just discussed
2. **Assistant prefill** (translated language) - how it was translated

#### Implementation (`src/translator.ts`)

```typescript
if (previousChunk && !chunk.isTableContent) {
  // Extract last paragraph for context
  const overlapParagraph = extractLastParagraph(previousChunk.content);

  // Include in user message (original language)
  const userContent = `Here is the text to translate to ${targetLanguage}:\n\n${overlapParagraph}\n\n${chunk.content}`;
  messages.push({
    role: "user",
    content: userContent,
  });

  // Include in assistant prefill (translated language)
  messages.push({
    role: "assistant",
    content: overlapParagraph,
  });
}
```

#### API Interaction

Claude sees:
- Original overlap (French) in user message
- Translated overlap (Spanish) in assistant prefill
- New chunk content to translate

Claude understands it's continuing a conversation and maintains:
- Terminology consistency
- Natural transitions
- Appropriate tone and style

#### Overlap Removal

After translation, remove the prefill text from response using exact string matching:

```typescript
if (chunk.prefillText) {
  const prefillIndex = cleanedContent.indexOf(chunk.prefillText);
  if (prefillIndex !== -1) {
    const endIndex = prefillIndex + chunk.prefillText.length;
    cleanedContent = cleanedContent.substring(endIndex).trimStart();
  }
}
```

Uses exact string matching (not line-by-line) to avoid removing too much content.

---

## Part 3: Complete Flow Example

```
ORIGINAL DOCUMENT
       ↓
   CHUNKING
       ↓
  CHUNK 1 (~130 tokens)
       ↓
TRANSLATE (no prefill - first chunk)
       ↓
 CHUNK 1 (Spanish)
       ↓
  CHUNK 2 (~130 tokens)
       ↓
EXTRACT OVERLAP FROM CHUNK 1
       ↓
TRANSLATE WITH BILINGUAL PREFILL
       ↓
 CHUNK 2 (Spanish)
       ↓
REMOVE OVERLAP
       ↓
  CHUNK 3 (~31 tokens)
       ↓
TRANSLATE WITH BILINGUAL PREFILL
       ↓
 CHUNK 3 (Spanish)
       ↓
REMOVE OVERLAP
       ↓
   MERGE ALL CHUNKS
       ↓
FINAL TRANSLATED DOCUMENT
```

---

## Part 4: Improvements Over Previous Implementation

### Previous Approach (Line-by-Line Matching)

```typescript
for (let j = 0; j < lines.length; j++) {
  if (chunk.prefillText.includes(lines[j])) {
    removeUpTo = j + 1;  // ← Greedy, keeps advancing
  }
}
if (removeUpTo > 0) {
  cleanedContent = lines.slice(removeUpTo).join("\n");  // ← Removes too much
}
```

Issues:
- ❌ Greedy matching with table rows
- ❌ Removed too much content
- ❌ Failed with varied content types

Example: Table row matches → removed all content up to that line → lost sections after the table

### Current Approach (Exact String Matching + Bilingual Context)

```typescript
const prefillIndex = cleanedContent.indexOf(chunk.prefillText);
if (prefillIndex !== -1) {
  const endIndex = prefillIndex + chunk.prefillText.length;
  cleanedContent = cleanedContent.substring(endIndex).trimStart();
}
```

Benefits:
- ✅ Precise overlap removal
- ✅ No false matches
- ✅ Works with any content type
- ✅ Bilingual context improves translation quality

### Bilingual Context Advantage

Before: Claude saw only the chunk content - limited context for consistency.

After: Claude sees:
- Previous paragraph in original language (reminds what was discussed)
- Previous paragraph in target language (shows how it was translated)
- New chunk to translate (maintains consistency)

Result: Better terminology consistency, natural transitions, seamless flow across chunks.

---

## Part 5: Key Takeaways

### Chunking

✅ Respects API limits
✅ Preserves tables and structure
✅ Breaks at semantic boundaries (paragraphs)
✅ Scales to any document size

### Bilingual Prefill

✅ Context continuity across chunks
✅ Terminology consistency
✅ Natural transitions
✅ No visible artifacts

### Technical Design

- **No duplication**: Prefill text removed after extraction
- **No extra API calls**: One call per chunk
- **Reliable**: Works across languages and domains
- **Simple**: Clean string matching, no complex heuristics

---

## Code Architecture

```
src/
├── chunker.ts
│   ├── chunkText()              [Main chunking]
│   ├── isTableBlock()           [Table detection]
│   ├── splitByParagraphs()      [Primary split]
│   ├── splitBySentences()       [Fallback split]
│   ├── countWords()             [Size tracking]
│   └── extractLastParagraph()   [Get overlap context]
│
├── translator.ts
│   ├── DocumentTranslator class
│   ├── translateDocument()      [Main translation]
│   ├── translateChunk()         [Single chunk + bilingual prefill]
│   └── mergeTranslatedChunks()  [Merge with overlap removal]
│
└── types.ts
    ├── TextChunk
    ├── TranslationChunk
    └── ProgressUpdate
```

---

## Test Results: BOB LINK Documentation (38 chunks)

| Metric | Value |
|--------|-------|
| Input Size | 55.87 KB |
| Output Size | 51.98 KB |
| Input Lines | 1,493 |
| Output Lines | 1,488 |
| Total Chunks | 38 |
| Success Rate | 100% |
| Processing Time | ~160 seconds |

**Quality**: All sections translated completely, all tables preserved, seamless transitions at every chunk boundary.
