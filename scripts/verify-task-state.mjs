#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot, parseNamedArgs, resolveInsideRepo } from './lib/project.mjs';

const args = parseNamedArgs(process.argv.slice(2));
const taskDirArg = args['task-dir'];
const gate = args.gate;
const profile = args.profile ?? 'full';
const uiImpact = args['ui-impact'] ?? 'none';
const validGates = new Set(['design', 'test', 'implementation']);
const validProfiles = new Set(['full', 'ui', 'lightweight', 'emergency']);
const validUiImpact = new Set(['none', 'yes']);

if (
  typeof taskDirArg !== 'string'
  || !validGates.has(gate)
  || !validProfiles.has(profile)
  || !validUiImpact.has(uiImpact)
) {
  process.stderr.write(
    'Usage: node scripts/verify-task-state.mjs --task-dir <path> '
      + '--gate design|test|implementation [--profile full|ui|lightweight|emergency] '
      + '[--ui-impact none|yes]\n',
  );
  process.exit(2);
}

try {
  const repoRoot = getRepoRoot();
  const taskDir = resolveInsideRepo(repoRoot, taskDirArg);
  const reviewPath = path.join(taskDir, 'REVIEW.md');
  requireFile(reviewPath);

  const reviewRecords = parseReviewRecords(readFileSync(reviewPath, 'utf8'));
  const requiredReviews = reviewsForGate(gate, profile);
  for (const reviewType of requiredReviews) {
    const record = reviewRecords.get(reviewType);
    if (!record) {
      throw new Error(`Missing ${reviewType} review record`);
    }
    if (record.status !== 'approved') {
      throw new Error(`${reviewType} review is not approved: ${record.status}`);
    }
    verifyReviewedFiles(record, repoRoot);
  }

  if (profile === 'full' || profile === 'ui') {
    requireFile(path.join(taskDir, 'DESIGN.md'));
    if (gate === 'test' || gate === 'implementation') {
      requireFile(path.join(taskDir, 'TESTCASES.md'));
      const evidence = readEvidence(path.join(taskDir, 'EVIDENCE.md'));
      requireEvidence(evidence, 'baseline_status', ['green', 'approved-existing-failures']);
      requireEvidence(evidence, 'red_status', ['expected-failure']);
      if (gate === 'implementation') {
        requireEvidence(evidence, 'green_status', ['green']);
        requireEvidence(evidence, 'final_status', ['passed']);
        if (profile === 'ui' || uiImpact === 'yes') {
          requireEvidence(evidence, 'ui_acceptance', ['accepted']);
        }
      }
    }
  }

  process.stdout.write(`Task state is valid for ${gate} gate (${profile}).\n`);
} catch (error) {
  process.stderr.write(`Task state validation failed: ${error.message}\n`);
  process.exitCode = 1;
}

function reviewsForGate(currentGate, currentProfile) {
  if (currentProfile === 'lightweight' || currentProfile === 'emergency') {
    return currentGate === 'implementation' ? ['implementation'] : [];
  }
  if (currentGate === 'design') {
    return ['design'];
  }
  if (currentGate === 'test') {
    return ['design', 'testcases', 'test-code'];
  }
  return ['design', 'testcases', 'test-code', 'implementation'];
}

function parseReviewRecords(markdown) {
  const records = new Map();
  const blocks = markdown.matchAll(/```ya?ml\s*([\s\S]*?)```/gi);
  for (const match of blocks) {
    const block = match[1];
    const reviewType = scalar(block, 'review_type');
    const status = scalar(block, 'status');
    if (!reviewType || !status) {
      continue;
    }

    const files = [];
    const filePattern = /^\s*-\s+path:\s*['"]?([^'"\r\n]+?)['"]?\s*$\r?\n\s+hash:\s*['"]?(sha256:[a-f0-9]{64})['"]?\s*$/gim;
    for (const fileMatch of block.matchAll(filePattern)) {
      files.push({ path: fileMatch[1].trim(), hash: fileMatch[2].toLowerCase() });
    }
    records.set(reviewType, { status, files });
  }
  return records;
}

function scalar(block, key) {
  const match = block.match(new RegExp(`^${key}:\\s*['"]?([^'"\\r\\n]+?)['"]?\\s*$`, 'mi'));
  return match?.[1].trim();
}

function verifyReviewedFiles(record, repoRoot) {
  if (record.files.length === 0) {
    throw new Error('Approved review has no reviewed_files hashes');
  }
  for (const file of record.files) {
    const absolutePath = resolveInsideRepo(repoRoot, file.path);
    requireFile(absolutePath);
    const actual = `sha256:${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}`;
    if (actual !== file.hash) {
      throw new Error(`Review is stale for ${file.path}`);
    }
  }
}

function readEvidence(filePath) {
  requireFile(filePath);
  const content = readFileSync(filePath, 'utf8');
  const result = new Map();
  for (const match of content.matchAll(/^([a-z_]+):\s*([^\s#]+).*$/gim)) {
    result.set(match[1], match[2]);
  }
  return result;
}

function requireEvidence(evidence, key, allowed) {
  const value = evidence.get(key);
  if (!allowed.includes(value)) {
    throw new Error(`Evidence ${key} must be one of ${allowed.join(', ')}; got ${value ?? 'missing'}`);
  }
}

function requireFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Required file does not exist: ${filePath}`);
  }
}
