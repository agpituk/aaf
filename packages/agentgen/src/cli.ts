#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { generateSDK, generateCLI } from './sdk-generator.js';
import { generateLlmsTxt } from './llms-txt-generator.js';

function main() {
  const args = process.argv.slice(2);
  let manifestPath = '';
  let outputDir = './output';
  let llmsTxt = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manifest' && i + 1 < args.length) {
      manifestPath = args[++i];
    } else if (args[i] === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (args[i] === '--llms-txt') {
      llmsTxt = true;
    }
  }

  if (!manifestPath) {
    console.error('Usage: agentgen --manifest <path-or-url> --output <dir> [--llms-txt]');
    process.exit(1);
  }

  const manifestContent = readFileSync(resolve(manifestPath), 'utf-8');
  const manifest = JSON.parse(manifestContent);

  // Generate SDK
  const sdkDir = join(outputDir, 'sdk');
  mkdirSync(sdkDir, { recursive: true });
  const sdkFiles = generateSDK(manifest);
  for (const [filename, content] of sdkFiles) {
    writeFileSync(join(sdkDir, filename), content);
    console.log(`  SDK: ${join(sdkDir, filename)}`);
  }

  // Generate CLI
  const cliDir = join(outputDir, 'cli');
  mkdirSync(cliDir, { recursive: true });
  const cliFiles = generateCLI(manifest);
  for (const [filename, content] of cliFiles) {
    writeFileSync(join(cliDir, filename), content);
    console.log(`  CLI: ${join(cliDir, filename)}`);
  }

  // Generate llms.txt
  if (llmsTxt) {
    const llmsTxtContent = generateLlmsTxt(manifest);
    const llmsTxtPath = join(outputDir, 'llms.txt');
    writeFileSync(llmsTxtPath, llmsTxtContent);
    console.log(`  llms.txt: ${llmsTxtPath}`);
  }

  console.log('Done!');
}

main();
