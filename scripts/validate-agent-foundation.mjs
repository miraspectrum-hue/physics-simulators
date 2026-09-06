#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot } from './lib/project.mjs';

const repoRoot = getRepoRoot();
const failures = [];

validateSkills();
validateAgents();
validateHooks();
validateFoundationFiles();
validateRuntimeStateIgnore();

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.stderr.write(`Agent foundation validation failed (${failures.length} issue(s)).\n`);
  process.exit(1);
}

process.stdout.write('Agent foundation validation passed.\n');

function validateSkills() {
  const skillsRoot = path.join(repoRoot, '.agents', 'skills');
  const expected = [
    'commit-proposal',
    'physics-validation',
    'simulator-review',
    'simulator-scaffold',
    'simulator-task-cycle',
    'ui-acceptance',
  ];
  for (const skillName of expected) {
    const skillPath = path.join(skillsRoot, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      failures.push(`Missing skill: ${skillName}`);
      continue;
    }
    const content = readFileSync(skillPath, 'utf8');
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) {
      failures.push(`${skillName}: missing YAML frontmatter`);
      continue;
    }
    if (!new RegExp(`^name:\\s*${escapeRegex(skillName)}\\s*$`, 'm').test(frontmatter[1])) {
      failures.push(`${skillName}: frontmatter name must match directory`);
    }
    if (!/^description:\s*\S.+$/m.test(frontmatter[1])) {
      failures.push(`${skillName}: non-empty description is required`);
    }
    if (/\b(?:TODO|TBD)\b|Example content/i.test(content)) {
      failures.push(`${skillName}: unfinished scaffold marker in SKILL.md`);
    }
  }

  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !expected.includes(entry.name) && entry.name !== '.gitkeep') {
      const skillPath = path.join(skillsRoot, entry.name, 'SKILL.md');
      if (existsSync(skillPath)) {
        validateUnexpectedSkill(entry.name, skillPath);
      }
    }
  }
}

function validateUnexpectedSkill(name, skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  if (!content.startsWith('---')) {
    failures.push(`${name}: existing skill has invalid frontmatter`);
  }
}

function validateAgents() {
  const configPath = path.join(repoRoot, '.codex', 'config.toml');
  if (!existsSync(configPath)) {
    failures.push('Missing .codex/config.toml');
    return;
  }
  const config = readFileSync(configPath, 'utf8');
  const agents = [
    ['architect_physics', 'architect-physics.toml'],
    ['reviewer', 'reviewer.toml'],
    ['delivery_builder', 'delivery-builder.toml'],
  ];

  for (const [name, file] of agents) {
    if (!config.includes(`[agents.${name}]`) || !config.includes(`config_file = "./agents/${file}"`)) {
      failures.push(`Agent ${name} is not registered correctly`);
    }
    const agentPath = path.join(repoRoot, '.codex', 'agents', file);
    if (!existsSync(agentPath)) {
      failures.push(`Missing agent config: ${file}`);
      continue;
    }
    const agent = readFileSync(agentPath, 'utf8');
    for (const key of ['name', 'description', 'model', 'model_reasoning_effort', 'sandbox_mode', 'developer_instructions']) {
      if (!new RegExp(`^${key}\\s*=`, 'm').test(agent)) {
        failures.push(`${file}: missing ${key}`);
      }
    }
  }
}

function validateHooks() {
  const hookPath = path.join(repoRoot, '.codex', 'hooks.json');
  try {
    const hooks = JSON.parse(readFileSync(hookPath, 'utf8'));
    const handlers = hooks?.hooks?.PreToolUse?.[0]?.hooks;
    if (!Array.isArray(handlers) || handlers[0]?.type !== 'command') {
      failures.push('hooks.json must configure a command PreToolUse handler');
    }
    if (!handlers?.[0]?.command?.includes('.codex/hooks/git-guard.mjs')) {
      failures.push('hooks.json must invoke the repository Git guard');
    }
  } catch (error) {
    failures.push(`Invalid hooks.json: ${error.message}`);
  }
}

function validateFoundationFiles() {
  const required = [
    '.codex/hooks/git-guard.mjs',
    'scripts/check-architecture.mjs',
    'scripts/commit-approved.mjs',
    'scripts/commit-proposal.mjs',
    'scripts/hash-files.mjs',
    'scripts/verify-fast.mjs',
    'scripts/verify-task-state.mjs',
    'scripts/verify.mjs',
  ];
  for (const relativePath of required) {
    if (!existsSync(path.join(repoRoot, relativePath))) {
      failures.push(`Missing foundation file: ${relativePath}`);
    }
  }
}

function validateRuntimeStateIgnore() {
  const ignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  if (!/^\.agent-state\/$/m.test(ignore)) {
    failures.push('.agent-state/ must be ignored by Git');
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
