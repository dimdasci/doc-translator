import fs from "node:fs";
import path from "node:path";

const APPROX_TOKENS_PER_WORD = 0.75;

/**
 * Estimates token count for text
 */
export function estimateTokens(text: string): number {
	const words = text.split(/\s+/).filter((w) => w.length > 0).length;
	return Math.ceil(words * APPROX_TOKENS_PER_WORD);
}

/**
 * Reads a markdown file and returns its content
 */
export async function readMarkdownFile(filePath: string): Promise<string> {
	try {
		const content = await fs.promises.readFile(filePath, "utf-8");
		return content;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to read file ${filePath}: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Writes translated content to file
 */
export async function writeTranslatedFile(content: string, outputPath: string): Promise<void> {
	try {
		const dir = path.dirname(outputPath);

		// Ensure directory exists
		await fs.promises.mkdir(dir, { recursive: true });

		await fs.promises.writeFile(outputPath, content, "utf-8");
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to write file ${outputPath}: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Generates output path with language suffix
 * Example: doc.md + 'es' -> doc_es.md
 */
export function generateOutputPath(inputPath: string, languageCode: string): string {
	const ext = path.extname(inputPath);
	const basename = path.basename(inputPath, ext);
	const dir = path.dirname(inputPath);

	return path.join(dir, `${basename}_${languageCode}${ext}`);
}

/**
 * Validates that the input file exists and is readable
 */
export async function validateInputFile(filePath: string): Promise<void> {
	try {
		await fs.promises.access(filePath, fs.constants.R_OK);
	} catch {
		throw new Error(`Input file is not readable: ${filePath}`);
	}
}

/**
 * Validates that the output directory is writable
 */
export async function validateOutputDirectory(filePath: string): Promise<void> {
	const dir = path.dirname(filePath);

	try {
		// Try to create directory if it doesn't exist
		await fs.promises.mkdir(dir, { recursive: true });

		// Check if we can write by trying to create a temp file
		const testFile = path.join(dir, `.test_${Date.now()}`);
		await fs.promises.writeFile(testFile, "test");
		await fs.promises.unlink(testFile);
	} catch {
		throw new Error(`Output directory is not writable: ${dir}`);
	}
}

/**
 * Extracts language code from language name (for display purposes)
 * Simple heuristic: takes first 2 letters and converts to lowercase
 */
export function extractLanguageCode(languageName: string): string {
	// If it's already a short code (2-3 letters), return as-is
	if (languageName.length <= 3) {
		return languageName.toLowerCase();
	}

	// Otherwise, try to extract code from common formats
	const match = languageName.match(/^([a-z]{2})/i);
	return match ? match[1].toLowerCase() : languageName.toLowerCase().slice(0, 2);
}

/**
 * Formats bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(2)} ${units[unitIndex]}`;
}
