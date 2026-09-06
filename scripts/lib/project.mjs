import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function getRepoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
}

export function parseNamedArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }

    const name = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      result[name] = true;
      continue;
    }

    result[name] = next;
    index += 1;
  }
  return result;
}

export function resolveInsideRepo(repoRoot, relativePath) {
  const resolved = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path must stay inside the repository: ${relativePath}`);
  }
  return resolved;
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function runNodeScript({ repoRoot, script, args = [] }) {
  run(process.execPath, [resolveInsideRepo(repoRoot, script), ...args], repoRoot);
}

export function runWorkspaceScripts({ repoRoot, workspace, scriptNames }) {
  const npmInvocation = process.platform === 'win32'
    ? {
        command: process.execPath,
        prefixArgs: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')],
      }
    : { command: 'npm', prefixArgs: [] };

  if (workspace) {
    const workspaceRoot = resolveInsideRepo(repoRoot, workspace);
    const packageJson = readJson(path.join(workspaceRoot, 'package.json'));
    const availableScripts = packageJson.scripts ?? {};
    let ran = 0;

    for (const scriptName of scriptNames) {
      if (!availableScripts[scriptName]) {
        continue;
      }
      run(
        npmInvocation.command,
        [...npmInvocation.prefixArgs, 'run', scriptName, `--workspace=${workspace}`],
        repoRoot,
      );
      ran += 1;
    }

    if (ran === 0) {
      throw new Error(`No requested verification scripts exist in ${workspace}`);
    }
    return;
  }

  for (const scriptName of scriptNames) {
    run(
      npmInvocation.command,
      [...npmInvocation.prefixArgs, 'run', scriptName, '--workspaces', '--if-present'],
      repoRoot,
    );
  }
}

function run(command, args, cwd) {
  const rendered = [command, ...args].join(' ');
  process.stdout.write(`\n> ${rendered}\n`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${rendered}`);
  }
}
