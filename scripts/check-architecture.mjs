#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { getRepoRoot, parseNamedArgs, resolveInsideRepo } from './lib/project.mjs';

const args = parseNamedArgs(process.argv.slice(2));
const repoRoot = getRepoRoot();
const roots = typeof args.workspace === 'string'
  ? [resolveInsideRepo(repoRoot, args.workspace)]
  : findWorkspaceRoots(repoRoot);
const failures = [];

for (const workspaceRoot of roots) {
  for (const domainRoot of findDomainRoots(workspaceRoot)) {
    inspectDomain(domainRoot, workspaceRoot);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`- ${failure}\n`);
  }
  process.stderr.write(`Architecture check failed (${failures.length} issue(s)).\n`);
  process.exit(1);
}

process.stdout.write('Architecture boundary check passed.\n');

function findWorkspaceRoots(root) {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const patterns = packageJson.workspaces ?? [];
  const result = [];
  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) {
      continue;
    }
    const parent = resolveInsideRepo(root, pattern.slice(0, -2));
    if (!existsSync(parent)) {
      continue;
    }
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      const candidate = path.join(parent, entry.name);
      if (entry.isDirectory() && existsSync(path.join(candidate, 'package.json'))) {
        result.push(candidate);
      }
    }
  }
  return result;
}

function findDomainRoots(workspaceRoot) {
  const sourceRoot = path.join(workspaceRoot, 'src');
  if (!existsSync(sourceRoot)) {
    return [];
  }

  const result = [];
  const legacyOptics = path.join(sourceRoot, 'optics');
  if (existsSync(legacyOptics)) {
    result.push(legacyOptics);
  }

  const simulatorsRoot = path.join(sourceRoot, 'simulators');
  if (existsSync(simulatorsRoot)) {
    for (const entry of readdirSync(simulatorsRoot, { withFileTypes: true })) {
      const domain = path.join(simulatorsRoot, entry.name, 'domain');
      if (entry.isDirectory() && existsSync(domain)) {
        result.push(domain);
      }
    }
  }
  return result;
}

function inspectDomain(domainRoot, workspaceRoot) {
  for (const filePath of walkSourceFiles(domainRoot)) {
    const source = readFileSync(filePath, 'utf8');
    const relativeFile = normalize(path.relative(repoRoot, filePath));
    const specifiers = extractModuleSpecifiers(source);
    for (const specifier of specifiers) {
      const normalized = specifier.replaceAll('\\', '/');
      if (isForbiddenPackage(normalized) || resolvesToForbiddenLayer(normalized, filePath, workspaceRoot)) {
        failures.push(`${relativeFile}: domain code must not import ${specifier}`);
      }
    }

    const browserGlobal = source.match(/\b(?:document|window|navigator)\s*\.|\b(?:HTMLElement|HTMLCanvasElement|WebGLRenderingContext)\b/);
    if (browserGlobal) {
      failures.push(`${relativeFile}: domain code uses browser global ${browserGlobal[0].trim()}`);
    }
  }
}

function walkSourceFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkSourceFiles(candidate));
    } else if (/\.(?:[cm]?[jt]sx?)$/i.test(entry.name) && statSync(candidate).isFile()) {
      result.push(candidate);
    }
  }
  return result;
}

function extractModuleSpecifiers(source) {
  const result = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\(|\bimport\s+)\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    result.push(match[1]);
  }
  return result;
}

function isForbiddenPackage(specifier) {
  return /^(?:three|react|react-dom|vue|@react-three)(?:\/|$)/.test(specifier);
}

function resolvesToForbiddenLayer(specifier, filePath, workspaceRoot) {
  if (!specifier.startsWith('.')) {
    return false;
  }
  const target = normalize(path.relative(workspaceRoot, path.resolve(path.dirname(filePath), specifier)));
  return /(?:^|\/)(?:app|scene|ui)(?:\/|$)/.test(target);
}

function normalize(value) {
  return value.replaceAll('\\', '/');
}
