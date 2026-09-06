#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot, resolveInsideRepo } from './lib/project.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write('Usage: node scripts/hash-files.mjs <repo-relative-path>...\n');
  process.exit(2);
}

const repoRoot = getRepoRoot();
process.stdout.write('reviewed_files:\n');
for (const file of files) {
  const absolutePath = resolveInsideRepo(repoRoot, file);
  const hash = createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
  const normalizedPath = path.relative(repoRoot, absolutePath).replaceAll('\\', '/');
  process.stdout.write(`  - path: ${normalizedPath}\n    hash: sha256:${hash}\n`);
}
