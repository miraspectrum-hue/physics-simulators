#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot, parseNamedArgs } from './lib/project.mjs';

const args = parseNamedArgs(process.argv.slice(2));
const proposalId = args.id;
if (typeof proposalId !== 'string') {
  process.stderr.write('Usage: node scripts/commit-approved.mjs --id <proposal-id>\n');
  process.exit(2);
}

const repoRoot = getRepoRoot();
const statePath = path.join(repoRoot, '.agent-state', 'commit-proposal.json');

try {
  const proposal = JSON.parse(readFileSync(statePath, 'utf8'));
  if (proposal.proposal_id !== proposalId || proposal.status !== 'approved' || !proposal.approved_at) {
    throw new Error('Proposal is not the active approved proposal');
  }

  const stagedFiles = getStagedFiles();
  if (JSON.stringify(stagedFiles) !== JSON.stringify(proposal.staged_files)) {
    throw new Error('Staged file list changed after approval');
  }
  if (getCachedDiffHash() !== proposal.cached_diff_sha256) {
    throw new Error('Staged diff changed after approval');
  }

  const result = spawnSync('git', ['commit', '-m', proposal.message], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git commit exited with ${result.status}`);
  }

  proposal.status = 'committed';
  proposal.committed_at = new Date().toISOString();
  proposal.commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  proposal.approved_at = null;
  writeFileSync(statePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  process.stdout.write(`Committed proposal ${proposalId} as ${proposal.commit}.\n`);
} catch (error) {
  process.stderr.write(`Approved commit failed: ${error.message}\n`);
  process.exitCode = 1;
}

function getStagedFiles() {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

function getCachedDiffHash() {
  const diff = execFileSync('git', ['diff', '--cached', '--binary'], {
    cwd: repoRoot,
    encoding: 'buffer',
    maxBuffer: 50 * 1024 * 1024,
  });
  return createHash('sha256').update(diff).digest('hex');
}
