import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDirectory = process.cwd();
const sourceDirectory = path.join(rootDirectory, 'src');
const allowedFiles = new Set([
  path.join(sourceDirectory, 'services', 'browserStorage.ts'),
]);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const forbiddenPatterns = [
  /\blocalStorage\s*\.(?:getItem|setItem|removeItem|clear)\s*\(/g,
  /\bsessionStorage\s*\.(?:getItem|setItem|removeItem|clear)\s*\(/g,
  /\bindexedDB\s*\.(?:open|deleteDatabase|databases)\s*\(/g,
];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(entryPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

async function main() {
  const sourceStats = await stat(sourceDirectory);
  if (!sourceStats.isDirectory()) {
    throw new Error(`Missing source directory: ${sourceDirectory}`);
  }

  const files = await collectSourceFiles(sourceDirectory);
  const violations = [];

  for (const filePath of files) {
    if (allowedFiles.has(filePath)) {
      continue;
    }

    const content = await readFile(filePath, 'utf8');

    for (const pattern of forbiddenPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        violations.push({
          filePath,
          line: getLineNumber(content, match.index),
          token: match[0].trim(),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('Browser storage guard passed.');
    return;
  }

  console.error('Direct browser storage access is not allowed in src outside src/services/browserStorage.ts.');
  for (const violation of violations) {
    console.error(`- ${path.relative(rootDirectory, violation.filePath)}:${violation.line} (${violation.token})`);
  }
  process.exitCode = 1;
}

await main();