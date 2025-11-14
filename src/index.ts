#!/usr/bin/env node

import fs from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import { DocumentTranslator } from "./translator.js";
import type { ProgressUpdate } from "./types.js";
import {
	estimateTokens,
	extractLanguageCode,
	formatFileSize,
	generateOutputPath,
	readMarkdownFile,
	validateInputFile,
	validateOutputDirectory,
	writeTranslatedFile,
} from "./utils.js";

const program = new Command();

program
	.name("doc-translate")
	.description("Translate markdown documents using Anthropic API")
	.version("1.0.0")
	.argument("<input-file>", "Path to markdown file to translate")
	.argument("<target-language>", "Target language for translation")
	.option("-o, --output <path>", "Output file path (optional, defaults to input_lang.md)")
	.option("-v, --verbose", "Show verbose output")
	.action(async (inputFile, targetLanguage, options) => {
		try {
			// Validate environment variables
			const apiKey = process.env.ANTHROPIC_API_KEY;
			const model = process.env.ANTHROPIC_MODEL;

			if (!apiKey) {
				console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable not set"));
				process.exit(1);
			}

			if (!model) {
				console.error(chalk.red("Error: ANTHROPIC_MODEL environment variable not set"));
				process.exit(1);
			}

			// Validate input file
			await validateInputFile(inputFile);

			// Determine output path
			const languageCode = extractLanguageCode(targetLanguage);
			const outputPath = options.output || generateOutputPath(inputFile, languageCode);

			// Validate output directory
			await validateOutputDirectory(outputPath);

			// Read input file
			console.log(chalk.blue("📖 Reading input file..."));
			const content = await readMarkdownFile(inputFile);

			const fileSize = Buffer.byteLength(content, "utf-8");
			const estimatedTokens = estimateTokens(content);

			console.log(chalk.cyan(`   File size: ${formatFileSize(fileSize)}`));
			console.log(chalk.cyan(`   Estimated tokens: ~${estimatedTokens.toLocaleString()}`));

			// Initialize translator
			const translator = new DocumentTranslator(apiKey, model, (update: ProgressUpdate) => {
				if (update.status === "processing") {
					console.log(chalk.yellow(`   ⏳ ${update.message}`));
				} else if (update.status === "completed") {
					console.log(chalk.green(`   ✓ ${update.message}`));
				} else if (update.status === "error") {
					console.error(chalk.red(`   ✗ ${update.message}`));
				}
			});

			// Translate document
			console.log(chalk.blue(`\n🌐 Translating to ${targetLanguage}...`));
			const translatedContent = await translator.translateDocument(content, targetLanguage);

			// Write output
			console.log(chalk.blue("\n💾 Writing output file..."));
			await writeTranslatedFile(translatedContent, outputPath);

			const outputSize = Buffer.byteLength(translatedContent, "utf-8");
			console.log(chalk.green(`   ✓ Output file size: ${formatFileSize(outputSize)}`));

			// Success message
			console.log(chalk.green("\n✨ Translation complete!"));
			console.log(chalk.cyan(`   Input:  ${inputFile}`));
			console.log(chalk.cyan(`   Output: ${outputPath}`));
		} catch (error) {
			if (error instanceof Error) {
				console.error(chalk.red(`\n✗ Error: ${error.message}`));
			} else {
				console.error(chalk.red("\n✗ An unexpected error occurred"));
			}

			process.exit(1);
		}
	});

program.parse(process.argv);
