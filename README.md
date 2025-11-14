# Document Translator CLI

A TypeScript-based CLI tool for translating markdown documents using the Anthropic API. Handles large documents intelligently by splitting them into manageable chunks while preserving tables and maintaining seamless text flow.

## Features

- **Smart Document Chunking**: Splits documents at paragraph/sentence boundaries without breaking tables
- **Seamless Translation**: Uses Anthropic's prefill feature to maintain context and coherence across chunks
- **Progress Indicators**: Real-time progress updates for large document translations
- **Flexible Output**: Save to custom path or auto-generate filename with language code suffix
- **Token Management**: Estimates document size and respects API token limits (~4000 tokens per chunk)

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"  # or your preferred model
```

## Usage

### Development Mode

Run the CLI directly with TypeScript compilation via `tsx`:

```bash
npm run dev <input-file> <language-code> [options]
```

Examples:

```bash
npm run dev path/to/document.md es
npm run dev path/to/document.md fr -o output/translated.md
npm run dev path/to/document.md de -v
```

### Built CLI Mode

First, build the project:

```bash
npm run build
```

Then run the compiled JavaScript directly:

```bash
node dist/index.js <input-file> <language-code> [options]
```

Or install globally for system-wide access:

```bash
npm install -g .
doc-translate <input-file> <language-code> [options]
```

Examples:

```bash
node dist/index.js document.md es
node dist/index.js document.md fr -o output/translated.md
node dist/index.js document.md de -v
```

## Code Quality

### Linting

```bash
npm run lint
```

Runs Biome linter with auto-fix.

### Formatting

```bash
npm run format
```

Formats code with Biome formatter.

### Check

```bash
npm run check
```

Runs full Biome check (lint + format without modifying).

## Project Structure

- **src/index.ts** - CLI entry point
- **src/translator.ts** - Core translation logic
- **src/chunker.ts** - Intelligent text splitting
- **src/merger.ts** - Result merging with overlap cleanup
- **src/utils.ts** - Utility functions (I/O, validation, formatting)
- **src/types.ts** - TypeScript type definitions

## How It Works

1. **Reading**: Loads the markdown file
2. **Chunking**: Intelligently splits document into ~4000 token chunks:
   - Preserves tables as atomic units
   - Breaks at paragraph boundaries when possible
   - Falls back to sentence boundaries if needed
3. **Translating**: Translates each chunk sequentially using Anthropic API:
   - Uses the last paragraph of previous chunk as context via prefill
   - Maintains formatting and structure
4. **Merging**: Combines translated chunks:
   - Removes overlapping prefill text
   - Normalizes paragraph separators
   - Returns seamless final document

## Environment Variables

- `ANTHROPIC_API_KEY` (required): Your Anthropic API key
- `ANTHROPIC_MODEL` (required): The Claude model to use (e.g., `claude-3-5-sonnet-20241022`)

## Error Handling

The tool validates:
- Input file exists and is readable
- Output directory is writable
- Environment variables are set
- API responses are valid

Detailed error messages guide troubleshooting.
