#!/usr/bin/env node
import { getRepoRoot, parseNamedArgs, runNodeScript, runWorkspaceScripts } from './lib/project.mjs';

const args = parseNamedArgs(process.argv.slice(2));
const workspace = typeof args.workspace === 'string' ? args.workspace : undefined;

try {
  const repoRoot = getRepoRoot();
  runNodeScript({
    repoRoot,
    script: 'scripts/check-architecture.mjs',
    args: workspace ? ['--workspace', workspace] : [],
  });
  runWorkspaceScripts({
    repoRoot,
    workspace,
    scriptNames: ['lint', 'typecheck', 'test'],
  });
  process.stdout.write('\nFast verification passed.\n');
} catch (error) {
  process.stderr.write(`\nFast verification failed: ${error.message}\n`);
  process.exitCode = 1;
}
