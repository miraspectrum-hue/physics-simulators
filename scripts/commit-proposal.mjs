#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot, parseNamedArgs } from './lib/project.mjs';

const [command = 'status', ...rest] = process.argv.slice(2);
const args = parseNamedArgs(rest);
const repoRoot = getRepoRoot();
const stateDir = path.join(repoRoot, '.agent-state');
const statePath = path.join(stateDir, 'commit-proposal.json');

try {
  if (command === 'create') {
    createProposal();
  } else if (command === 'approve') {
    approveProposal();
  } else if (command === 'invalidate') {
    invalidateProposal();
  } else if (command === 'status') {
    printStatus();
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`Commit proposal error: ${error.message}\n`);
  process.exitCode = 1;
}

function createProposal() {
  const task = requiredArg('task');
  const stage = requiredArg('stage');
  const message = requiredArg('message');
  const validStages = new Set(['design', 'test', 'implementation', 'lightweight', 'emergency']);
  if (!validStages.has(stage)) {
    throw new Error(`Invalid --stage: ${stage}`);
  }
  const current = readState(false);
  if (current && ['awaiting-approval', 'approved'].includes(current.status)) {
    throw new Error(`Active proposal ${current.proposal_id} must be committed or invalidated first`);
  }

  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    throw new Error('No staged files');
  }

  const now = new Date();
  const proposal = {
    proposal_id: `${task}-${stage}-${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
    task_id: task,
    stage,
    session: args.session ?? process.env.CODEX_THREAD_ID ?? 'current-conversation',
    status: 'awaiting-approval',
    staged_files: stagedFiles,
    cached_diff_sha256: getCachedDiffHash(),
    message,
    created_at: now.toISOString(),
    approved_at: null,
  };

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  printProposal(proposal);
}

function approveProposal() {
  const id = requiredArg('id');
  const proposal = readState(true);
  if (proposal.proposal_id !== id || proposal.status !== 'awaiting-approval') {
    throw new Error('Proposal ID is not the active awaiting-approval proposal');
  }
  verifyUnchanged(proposal);
  proposal.status = 'approved';
  proposal.approved_at = new Date().toISOString();
  writeFileSync(statePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  process.stdout.write(`Approved proposal state recorded for ${id}.\n`);
}

function invalidateProposal() {
  const proposal = readState(true);
  proposal.status = 'invalidated';
  proposal.invalidated_at = new Date().toISOString();
  proposal.approved_at = null;
  writeFileSync(statePath, `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  process.stdout.write(`Invalidated ${proposal.proposal_id}.\n`);
}

function printStatus() {
  const proposal = readState(false);
  if (!proposal) {
    process.stdout.write('No commit proposal state exists.\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
}

function verifyUnchanged(proposal) {
  const stagedFiles = getStagedFiles();
  if (JSON.stringify(stagedFiles) !== JSON.stringify(proposal.staged_files)) {
    throw new Error('Staged file list changed; create a new proposal');
  }
  if (getCachedDiffHash() !== proposal.cached_diff_sha256) {
    throw new Error('Staged diff changed; create a new proposal');
  }
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

function readState(required) {
  if (!existsSync(statePath)) {
    if (required) {
      throw new Error('No commit proposal state exists');
    }
    return null;
  }
  return JSON.parse(readFileSync(statePath, 'utf8'));
}

function requiredArg(name) {
  if (typeof args[name] !== 'string' || args[name].length === 0) {
    throw new Error(`Missing --${name}`);
  }
  return args[name];
}

function printProposal(proposal) {
  process.stdout.write(`## コミット候補\n\n`);
  process.stdout.write(`**工程**: ${proposal.stage}\n\n`);
  process.stdout.write(`**Proposal ID**: \`${proposal.proposal_id}\`\n\n`);
  process.stdout.write('**ステージ済みファイル**:\n');
  for (const file of proposal.staged_files) {
    process.stdout.write(`- \`${file}\`\n`);
  }
  process.stdout.write(`\n**コミットメッセージ案**:\n\n\`\`\`text\n${proposal.message}\n\`\`\`\n\n`);
  process.stdout.write(`**ステージ差分ハッシュ**: \`${proposal.cached_diff_sha256}\`\n\n`);
  process.stdout.write('内容を確認し、実行する場合は「コミットしてください」と送信してください。\n');
}

function usage() {
  process.stderr.write(
    'Usage:\n'
      + '  node scripts/commit-proposal.mjs create --task <id> --stage <stage> --message <message>\n'
      + '  node scripts/commit-proposal.mjs approve --id <proposal-id>\n'
      + '  node scripts/commit-proposal.mjs invalidate\n'
      + '  node scripts/commit-proposal.mjs status\n',
  );
}
