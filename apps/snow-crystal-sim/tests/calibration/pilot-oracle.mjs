// Test-owned oracles. Nothing in this module imports the validator or production code.
import { createHash } from 'node:crypto';
import * as cryptoNamed from 'node:crypto';
import { readFileSync, openSync, readSync, closeSync, lstatSync, realpathSync } from 'node:fs';
import fs, * as fsNamed from 'node:fs';
import * as fsPromisesNamed from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as urlNamed from 'node:url';
import { resolve, dirname, win32, posix } from 'node:path';
import * as pathNamed from 'node:path';
import assert from 'node:assert/strict';
import * as assertNamed from 'node:assert/strict';
import * as bufferNamed from 'node:buffer';
import ts from 'typescript';

export { assert };
export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const DOC = resolve(ROOT, 'docs/simulators/snow-crystal-sim/tasks/T1-7');
export const CONTRACT = 't1-7-morphology-ensemble-pilot-contract/1';
export const PROTOCOL = 'morphology-ensemble-pilot/1';
export const PDF = '20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af';
export const CODEC = 'canonical-rgba8-png-stored-deflate/1';
export const POLICY = 'model-response-attempt-max-3-fresh-context/1';
export const HASH_SCHEMA = 'snow-crystal-morphology-pilot-hash/1';
export const utc = i => `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`;
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const H = label => sha(`SYN-PILOT-24/${label}`);
export function streamFileOracle(path) {
  const fd=openSync(path,'r'),digest=createHash('sha256'),buffer=Buffer.alloc(3);let byteLength=0;
  try { for(;;){const n=readSync(fd,buffer,0,buffer.length,null);if(n===0)break;byteLength+=n;digest.update(buffer.subarray(0,n));} }
  finally { closeSync(fd); }
  return {sha256:digest.digest('hex'),byteLength};
}
const immutableFixtureNodes = new WeakSet(), immutableCanonical = new WeakMap();
// Only explicitly detached, recursively frozen snapshots may share a cached
// object serialization. Mutable inputs always take the uncached path.
export function immutableSnapshot(value) {
  if (value && typeof value === 'object' && immutableFixtureNodes.has(value)) return value;
  const detached = clone(value);
  const freeze = node => {
    if (!node || typeof node !== 'object' || immutableFixtureNodes.has(node)) return;
    immutableFixtureNodes.add(node);
    Object.values(node).forEach(freeze); Object.freeze(node);
  };
  freeze(detached); return detached;
}
export const isImmutableSnapshot = value => !!value && typeof value === 'object' && immutableFixtureNodes.has(value);
export const clone = value => {
  // A frozen old graph is authority data, shared by many independent attacks.
  // Keep every mutable fixture node detached, including both inventories.
  if (value && !Array.isArray(value) && (isImmutableSnapshot(value.oldGraph) || isImmutableSnapshot(value.sources))) {
    const mutable = { ...value }, shared = {};
    for (const key of ['oldGraph', 'sources']) if (isImmutableSnapshot(value[key])) {
      shared[key] = value[key]; delete mutable[key];
    }
    // Certified frozen inventory payloads can be shared while membership and
    // row summaries stay mutable and detached. Mutable D-24 object attacks
    // remain fully copied; no payload is frozen implicitly by cloning it.
    for (const key of ['oldInventory', 'newInventory']) if (Array.isArray(value[key])) {
      shared[key] = value[key].map(row => {
        const copy = { ...row }, immutable = {};
        for (const field of ['object', 'embeddedRefs']) if (isImmutableSnapshot(row[field])) {
          immutable[field] = row[field]; delete copy[field];
        }
        return { ...structuredClone(copy), ...immutable };
      });
      delete mutable[key];
    }
    return { ...structuredClone(mutable), ...shared };
  }
  return structuredClone(value);
};
export const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const hex = bytes => Buffer.from(bytes).toString('hex');
const canonicalStrings = new Map(), canonicalScalars = new Map();
export const jcs = value => {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { assert(Number.isFinite(value) && !Object.is(value, -0)); return JSON.stringify(value); }
  if (typeof value === 'string') {
    const cache = value.length >= 1024 ? canonicalStrings : canonicalScalars, limit = value.length >= 1024 ? 128 : 4096;
    if (cache.has(value)) return cache.get(value);
    assert.equal(value.normalize('NFC'), value); const encoded = JSON.stringify(value);
    // Both prompts and repeated property tokens are immutable by value. Keep
    // separate bounded caches so many scalar mutations cannot evict prompts.
    if (cache.size === limit) cache.delete(cache.keys().next().value);
    cache.set(value, encoded);
    return encoded;
  }
  if (isImmutableSnapshot(value) && immutableCanonical.has(value)) return immutableCanonical.get(value);
  if (Array.isArray(value)) {
    const encoded = `[${value.map(jcs).join(',')}]`;
    if (isImmutableSnapshot(value)) immutableCanonical.set(value, encoded);
    return encoded;
  }
  assert(value && typeof value === 'object');
  const encoded = `{${Object.keys(value).sort(cmp).map(k => `${jcs(k)}:${jcs(value[k])}`).join(',')}}`;
  if (isImmutableSnapshot(value)) immutableCanonical.set(value, encoded);
  return encoded;
};
const immutableHashes = new WeakMap();
export const hash = value => {
  if (isImmutableSnapshot(value) && immutableHashes.has(value)) return immutableHashes.get(value);
  const digest = sha(jcs(value));
  if (isImmutableSnapshot(value)) immutableHashes.set(value, digest);
  return digest;
};
export const fileBytes = value => `${jcs(value)}\n`;
export const jsonl = records => records.map(fileBytes).join('');
export const wrapped = (purpose, rest) => ({ hashSchema: HASH_SCHEMA, purpose, ...rest });
export const whash = (purpose, rest) => hash(wrapped(purpose, rest));
export const idHash = (ids, source = false) => whash(source ? 'expected-source-id-set' : 'expected-anonymous-id-set', {
  orderedItems: [...ids].sort(cmp).map((id, ordinal) => ({ ordinal, [source ? 'sourceObservationId' : 'anonymousImageId']: id })),
});

// Recursive descent retains object member tokens, including escaped duplicate names.
export function parseUnique(text) {
  let p = 0;
  const ws = () => { while (/\s/.test(text[p] ?? '') && p < text.length) p++; };
  const string = () => {
    const start = p++;
    while (p < text.length) { const c = text[p++]; if (c === '\\') { p++; continue; } if (c === '"') return JSON.parse(text.slice(start, p)); }
    throw new SyntaxError('json-syntax field=json');
  };
  const value = () => {
    ws();
    if (text[p] === '"') return string();
    if (text[p] === '{') {
      p++; ws(); const result = {}, seen = new Set();
      if (text[p] === '}') { p++; return result; }
      for (;;) {
        ws(); if (text[p] !== '"') throw new SyntaxError('json-syntax field=json');
        const key = string(); if (seen.has(key)) throw new SyntaxError(`duplicate-key field=${key}`); seen.add(key);
        ws(); if (text[p++] !== ':') throw new SyntaxError('json-syntax field=json'); result[key] = value(); ws();
        const c = text[p++]; if (c === '}') return result; if (c !== ',') throw new SyntaxError('json-syntax field=json');
      }
    }
    if (text[p] === '[') {
      p++; ws(); const result = []; if (text[p] === ']') { p++; return result; }
      for (;;) { result.push(value()); ws(); const c = text[p++]; if (c === ']') return result; if (c !== ',') throw new SyntaxError('json-syntax field=json'); }
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(p));
    if (!match) throw new SyntaxError('json-syntax field=json'); p += match[0].length; return JSON.parse(match[0]);
  };
  const out = value(); ws(); if (p !== text.length) throw new SyntaxError('json-syntax field=json'); return out;
}

export const cases = [];
export const good = (caseName, fixture, expected = true, label = 'positive') => {
  cases.push({ caseName, fixture: clone(fixture), expected: clone(expected), label }); return fixture;
};
export const bad = (caseName, base, mutate, reason, field, errorClass = 'RangeError', label = field) => {
  const fixture = clone(base); mutate(fixture);
  cases.push({ caseName, fixture, errorClass, reason, field, label }); return fixture;
};
// D-18: deliberately restricted JavaScript, not a general-purpose taint analyser.
// This gate runs BEFORE import. Only these exact modules and literal static
// imports are supported. Adding a file, capability, or syntax requires review.
const VALIDATOR_DIRECTORY = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration');
const VALIDATOR_FILES = Object.freeze([
  'libbrecht-2023-figure2-morphology-pilot-validator.mjs',
  'libbrecht-2023-figure2-morphology-pilot-validator-core.mjs',
  'libbrecht-2023-figure2-morphology-pilot-validator-schema.mjs',
  'libbrecht-2023-figure2-morphology-pilot-validator-io.mjs',
]);
// Each allowed filesystem capability has a matching guard event and a live
// probe below. Do not permit objects (promises/constants), streams, FileHandles,
// unmonitored readers such as openAsBlob, or extra mutation APIs such as cp.
const VALIDATOR_FS_EVENTS = Object.freeze({
  'node:fs': Object.freeze({ readFileSync: 'read', openSync: 'open', writeFileSync: 'write',
    fsyncSync: 'flush', closeSync: 'close', renameSync: 'rename', unlinkSync: 'remove' }),
  'node:fs/promises': Object.freeze({ readFile: 'read' }),
});
const VALIDATOR_BUILTINS = new Map(Object.entries({
  'node:crypto': ['createHash'],
  'node:fs': Object.keys(VALIDATOR_FS_EVENTS['node:fs']),
  'node:fs/promises': Object.keys(VALIDATOR_FS_EVENTS['node:fs/promises']),
  'node:path': ['resolve', 'relative', 'isAbsolute', 'dirname', 'basename'],
  'node:url': ['fileURLToPath'],
  'node:buffer': ['Buffer'],
  'node:assert/strict': ['strictEqual', 'deepStrictEqual'],
}).map(([specifier, names]) => [specifier, new Set(names)]));
// Capture original Node exports before the test's effect guards replace fs
// functions. Namespace snapshots keep the native functions' property surfaces
// visible to the capability audit, rather than auditing only our wrappers.
const NATIVE_BUILTIN_NAMESPACES = new Map([
  ['node:crypto', cryptoNamed], ['node:fs', fsNamed], ['node:fs/promises', fsPromisesNamed],
  ['node:path', pathNamed], ['node:url', urlNamed], ['node:buffer', bufferNamed],
  ['node:assert/strict', assertNamed],
]);
const NATIVE_BUILTIN_EXPORTS = new Map([...NATIVE_BUILTIN_NAMESPACES]
  .map(([specifier, namespace]) => [specifier, Object.freeze({ ...namespace })]));
const VALIDATOR_GLOBALS = new Set([
  'undefined', 'NaN', 'Infinity', 'Array', 'ArrayBuffer', 'BigInt', 'Boolean',
  'Buffer', 'DataView', 'Date', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Number', 'Object', 'String', 'RegExp',
  'Math', 'JSON', 'Promise', 'Uint8Array', 'Uint8ClampedArray', 'Uint16Array',
  'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array',
  'Float64Array', 'BigInt64Array', 'BigUint64Array', 'TextEncoder', 'TextDecoder',
  'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'encodeURIComponent',
  'decodeURIComponent', 'structuredClone',
]);
// No computed properties (including destructuring), reflection, ambient runtime
// objects or constructor/prototype escape hatches. This is intentionally stricter
// than normal JS: an unrecognised spelling/form is rejected, not inferred safe.
const UNSAFE_NAMES = new Set([
  'require', 'createRequire', 'module', 'exports', 'process', 'global', 'globalThis',
  'window', 'self', 'eval', 'Function', 'AsyncFunction', 'GeneratorFunction',
  'AsyncGeneratorFunction', 'Reflect', 'Proxy', 'WebAssembly', 'getBuiltinModule',
  'constructor', 'prototype', '__proto__', 'caller', 'callee', 'arguments',
  'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors', 'defineProperty', 'defineProperties',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
  'prepareStackTrace', 'captureStackTrace', 'getFunction', 'getThis',
]);
const VALIDATOR_SYNTAX = new Set([
  'SourceFile', 'EndOfFileToken', 'ImportDeclaration', 'ImportClause',
  'NamedImports', 'ImportSpecifier', 'ExportKeyword',
  'DefaultKeyword', 'AsyncKeyword', 'AwaitKeyword', 'ExportAssignment',
  'Identifier', 'StringLiteral', 'NumericLiteral', 'BigIntLiteral',
  'TrueKeyword', 'FalseKeyword', 'NullKeyword', 'RegularExpressionLiteral',
  'NoSubstitutionTemplateLiteral', 'TemplateExpression', 'TemplateSpan',
  'TemplateHead', 'TemplateMiddle', 'TemplateTail', 'VariableStatement',
  'VariableDeclarationList', 'VariableDeclaration', 'FunctionDeclaration',
  'FunctionExpression', 'ArrowFunction', 'Parameter', 'Block', 'ReturnStatement',
  'ThrowStatement', 'ExpressionStatement', 'EmptyStatement', 'IfStatement',
  'SwitchStatement', 'CaseBlock', 'CaseClause', 'DefaultClause', 'TryStatement',
  'CatchClause', 'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement',
  'DoStatement', 'BreakStatement', 'ContinueStatement', 'CallExpression',
  'NewExpression', 'PropertyAccessExpression', 'ParenthesizedExpression',
  'AwaitExpression', 'ConditionalExpression', 'BinaryExpression',
  'PrefixUnaryExpression', 'PostfixUnaryExpression', 'TypeOfExpression',
  'VoidExpression', 'ArrayLiteralExpression', 'ObjectLiteralExpression',
  'PropertyAssignment', 'ShorthandPropertyAssignment', 'MethodDeclaration',
  'SpreadAssignment', 'SpreadElement', 'ObjectBindingPattern', 'ArrayBindingPattern',
  'BindingElement', 'OmittedExpression', 'DotDotDotToken', 'QuestionDotToken',
  'EqualsGreaterThanToken', 'QuestionToken', 'ColonToken',
  'PlusToken', 'MinusToken', 'AsteriskToken', 'AsteriskAsteriskToken', 'SlashToken',
  'PercentToken', 'PlusPlusToken', 'MinusMinusToken', 'LessThanLessThanToken',
  'GreaterThanGreaterThanToken', 'GreaterThanGreaterThanGreaterThanToken',
  'AmpersandToken', 'BarToken', 'CaretToken', 'ExclamationToken', 'TildeToken',
  'AmpersandAmpersandToken', 'BarBarToken', 'QuestionQuestionToken',
  'LessThanToken', 'LessThanEqualsToken', 'GreaterThanToken', 'GreaterThanEqualsToken',
  'EqualsEqualsToken', 'ExclamationEqualsToken', 'EqualsEqualsEqualsToken',
  'ExclamationEqualsEqualsToken', 'EqualsToken', 'PlusEqualsToken', 'MinusEqualsToken',
  'AsteriskEqualsToken', 'AsteriskAsteriskEqualsToken', 'SlashEqualsToken',
  'PercentEqualsToken', 'LessThanLessThanEqualsToken', 'GreaterThanGreaterThanEqualsToken',
  'GreaterThanGreaterThanGreaterThanEqualsToken', 'AmpersandEqualsToken',
  'BarEqualsToken', 'CaretEqualsToken', 'AmpersandAmpersandEqualsToken',
  'BarBarEqualsToken', 'QuestionQuestionEqualsToken', 'InKeyword', 'InstanceOfKeyword',
].map(name => { assert.equal(typeof ts.SyntaxKind[name], 'number', name); return ts.SyntaxKind[name]; }));
const nativePaths = process.platform === 'win32' ? win32 : posix;
const dependencyKey = (file, paths = nativePaths) => {
  const absolute = paths.resolve(file).replaceAll('\\', '/');
  return paths === win32 ? absolute.toLowerCase() : absolute;
};
const dependencyAssert = (condition, reason, file) => assert(condition,
  `validator-test-oracle-import-forbidden: ${reason} (${file})`);

function assertDependencyIdentity(file, paths = nativePaths, io = { lstatSync, realpathSync }) {
  // Reject links/junctions in EVERY component, before reading any source. Comparing
  // realpath as well protects against alternate filesystem spellings/redirects.
  for (let part = paths.resolve(file); ; part = paths.dirname(part)) {
    const stat = io.lstatSync(part);
    dependencyAssert(!stat.isSymbolicLink(), 'symlink-or-junction', part);
    dependencyAssert(part !== paths.resolve(file) || stat.isFile(), 'not-regular-file', part);
    if (paths.dirname(part) === part) break;
  }
  dependencyAssert(dependencyKey(io.realpathSync(file), paths) === dependencyKey(file, paths),
    'realpath-identity-mismatch', file);
}

function validatorImports(file, code) {
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  dependencyAssert(ast.parseDiagnostics.length === 0, 'unparsed-or-ambiguous-syntax', file);
  // Resolve lexical bindings only. No library, filesystem, package resolution or
  // type checking of application values is used to grant ambient capabilities.
  const isSource = name => dependencyKey(name) === dependencyKey(file);
  const host = {
    getSourceFile: name => isSource(name) ? ast : undefined,
    getDefaultLibFileName: () => '', writeFile: () => {}, getCurrentDirectory: () => dirname(file),
    getDirectories: () => [], fileExists: isSource,
    readFile: name => isSource(name) ? code : undefined,
    getCanonicalFileName: dependencyKey, useCaseSensitiveFileNames: () => nativePaths === posix,
    getNewLine: () => '\n',
  };
  const program = ts.createProgram([file], {
    allowJs: true, noLib: true, noResolve: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  }, host);
  dependencyAssert(program.getSyntacticDiagnostics(ast).length === 0, 'non-javascript-syntax', file);
  const checker = program.getTypeChecker(), imports = [];
  const propertyName = node => {
    const p = node.parent;
    return (ts.isPropertyAccessExpression(p) && p.name === node)
      || ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p)) && p.name === node)
      || ((ts.isBindingElement(p) || ts.isImportSpecifier(p)) && p.propertyName === node);
  };
  function walk(node) {
    dependencyAssert(VALIDATOR_SYNTAX.has(node.kind), `unsupported-syntax:${ts.SyntaxKind[node.kind]}`, file);
    dependencyAssert(!node.asteriskToken && !node.type && !node.typeParameters
      && !node.typeArguments && !node.decorators, 'unsupported-declaration', file);
    if (ts.isImportDeclaration(node)) {
      dependencyAssert(node.parent === ast && !node.modifiers && !node.attributes && !node.assertClause
        && !node.importClause?.isTypeOnly && !node.importClause?.phaseModifier,
      'non-static-import-declaration', file);
      dependencyAssert(ts.isStringLiteral(node.moduleSpecifier), 'nonliteral-specifier', file);
      const specifier = node.moduleSpecifier.text, raw = node.moduleSpecifier.getText(ast);
      dependencyAssert(raw === `'${specifier}'` || raw === `"${specifier}"`, 'escaped-specifier', file);
      const clause = node.importClause, bindings = clause?.namedBindings;
      dependencyAssert(clause && !clause.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0, 'named-value-imports-only', file);
      const names = bindings.elements.map(item => (item.propertyName ?? item.name).text);
      dependencyAssert(!names.includes('default'), 'default-export-import-forbidden', file);
      imports.push({ specifier, names });
    }
    if (ts.isImportSpecifier(node)) dependencyAssert(!node.isTypeOnly
      && (!node.propertyName || ts.isIdentifier(node.propertyName)), 'non-value-import', file);
    if (ts.isExportAssignment(node)) dependencyAssert(!node.isExportEquals, 'commonjs-export', file);
    if (ts.isIdentifier(node) || (ts.isStringLiteral(node) && propertyName(node))) {
      dependencyAssert(!UNSAFE_NAMES.has(node.text), `runtime-or-reflection-name:${node.text}`, file);
      if (ts.isIdentifier(node) && !propertyName(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent)
          ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
        dependencyAssert(VALIDATOR_GLOBALS.has(node.text)
          || symbol?.declarations?.some(declaration => declaration.getSourceFile() === ast),
        `unbound-identifier:${node.text}`, file);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return imports;
}

export function assertValidatorDependencies(entry, virtualSources = null) {
  const allowed = new Map(VALIDATOR_FILES.map(name => {
    const file = resolve(VALIDATOR_DIRECTORY, name); return [dependencyKey(file), file];
  }));
  const relatives = new Map(VALIDATOR_FILES.map(name => [`./${name}`, resolve(VALIDATOR_DIRECTORY, name)]));
  dependencyAssert(dependencyKey(entry) === dependencyKey(resolve(VALIDATOR_DIRECTORY, VALIDATOR_FILES[0])),
    'entry-not-allowlisted', entry);
  const sources = virtualSources === null ? null : new Map();
  if (sources) for (const [file, code] of Object.entries(virtualSources)) {
    const key = dependencyKey(file);
    dependencyAssert(!sources.has(key), 'ambiguous-source-identity', file);
    sources.set(key, code);
  }
  const seen = new Set(), edges = [], builtins = new Set();
  function visit(file) {
    const key = dependencyKey(file);
    dependencyAssert(allowed.has(key), 'path-not-allowlisted', file);
    file = allowed.get(key);
    if (seen.has(file)) return;
    seen.add(file);
    let code;
    if (sources) code = sources.get(key);
    else {
      try { assertDependencyIdentity(file); code = readFileSync(file, 'utf8'); }
      catch (error) { dependencyAssert(false, `unreadable-or-redirected-source:${error.message}`, file); }
    }
    dependencyAssert(typeof code === 'string', 'missing-source', file);
    for (const { specifier, names } of validatorImports(file, code)) {
      if (VALIDATOR_BUILTINS.has(specifier)) {
        for (const name of names) dependencyAssert(VALIDATOR_BUILTINS.get(specifier).has(name),
          `builtin-export-not-allowlisted:${specifier}/${name}`, file);
        builtins.add(specifier); continue;
      }
      // Exact source spellings only: no URL, package, extension search, casing
      // alias, percent escape, separator alias, query/hash, traversal or JSON.
      dependencyAssert(relatives.has(specifier), `specifier-not-allowlisted:${specifier}`, file);
      const target = relatives.get(specifier);
      edges.push([file, target]); visit(target);
    }
  }
  visit(entry);
  return { nodes: [...seen], edges, builtins: [...builtins].sort() };
}

export function dependencyGateOracle() {
  const [entry, middle, leaf] = VALIDATOR_FILES.map(name => resolve(VALIDATOR_DIRECTORY, name));
  const middleImport = `import {valid} from './${VALIDATOR_FILES[1]}'; export const root=valid;`;
  const forbiddenNames = ['pilot-oracle.mjs', 'pilot-contract-fixtures.mjs', 'libbrecht-2023-figure2-morphology-pilot.test.ts'];
  const attacks = [
    ['static-import', "import './TARGET';"],
    ['namespace-import', "import * as m from 'node:module'; const r=m.createRequire(import.meta.url); r('./TARGET');"],
    ['default-import', "import m from 'node:module'; const r=m.createRequire(import.meta.url); r('./TARGET');"],
    ['namespace-default-property', "import * as m from 'node:module'; const r=m.default.createRequire(import.meta.url); r('./TARGET');"],
    ['named-default-import', "import {default as m} from 'node:module'; const r=m.createRequire(import.meta.url); r('./TARGET');"],
    ['named-alias', "import {createRequire as factory} from 'node:module'; const r=factory(import.meta.url); r('./TARGET');"],
    ['literal-property-access', "import m from 'module'; const r=m['createRequire'](import.meta.url); r('./TARGET');"],
    ['destructuring-and-alias-chain', "import * as m from 'node:module'; const moduleAlias=m; const {createRequire: factory}=moduleAlias; const factoryAlias=factory; const r=factoryAlias(import.meta.url); const requireAlias=r; requireAlias('./TARGET');"],
    ['assigned-alias-chain', "import m from 'node:module'; let factory, r, requireAlias; factory=m.createRequire; r=factory(import.meta.url); requireAlias=r; requireAlias('./TARGET');"],
    ['inline-created-require', "import m from 'node:module'; m.createRequire(import.meta.url)('./TARGET');"],
    ['computed-key', "import * as m from 'node:module'; const key='createRequire'; const f=m[key]; f(import.meta.url)('./TARGET');"],
    ['computed-destructuring', "import * as m from 'node:module'; const key='createRequire'; const {[key]: f}=m; f(import.meta.url)('./TARGET');"],
    ['bind', "import * as m from 'node:module'; const f=m.createRequire.bind(m); f(import.meta.url)('./TARGET');"],
    ['call', "import * as m from 'node:module'; m.createRequire.call(m,import.meta.url)('./TARGET');"],
    ['apply', "import * as m from 'node:module'; m.createRequire.apply(m,[import.meta.url])('./TARGET');"],
    ['reflect-get', "import * as m from 'node:module'; Reflect.get(m,'createRequire')(import.meta.url)('./TARGET');"],
    ['comma-alias', "import * as m from 'node:module'; const f=(0,m.createRequire); f(import.meta.url)('./TARGET');"],
    ['process-builtin', "process.getBuiltinModule('module').createRequire(import.meta.url)('./TARGET');"],
    ['computed-process-builtin', "const key='get'+'BuiltinModule'; const p=process; p[key]('module').createRequire(import.meta.url)('./TARGET');"],
    ['global-process-builtin', "globalThis['process']['getBuiltinModule']('module').createRequire(import.meta.url)('./TARGET');"],
    ['bare-require', "require('./TARGET');"],
    ['commonjs-loader', "module.require('./TARGET');"],
    ['require-resolve', "require(require.resolve('./TARGET'));"],
    ['import-equals', "import r = require('./TARGET');"],
    ['dynamic-import-literal', "await import('./TARGET');"],
    ['dynamic-import-computed', "const name='./TARGET'; await import(name);"],
    ['dynamic-import-template', "await import(`./TARGET`);"],
    ['dynamic-import-comment', "await import /*hidden*/ ('./TARGET');"],
    ['export-from', "export {cases} from './TARGET';"],
    ['export-star', "export * from './TARGET';"],
    ['export-namespace', "export * as oracle from './TARGET';"],
    ['eval-alias', "const run=eval; run(\"import('./TARGET')\");"],
    ['indirect-eval', "(0,eval)(\"import('./TARGET')\");"],
    ['function-alias', "const run=Function; run(\"return import('./TARGET')\")();"],
    ['function-apply', "Function.apply(null,[\"return import('./TARGET')\"])();"],
    ['async-function', "AsyncFunction(\"return import('./TARGET')\")();"],
    ['generator-function', "GeneratorFunction(\"return import('./TARGET')\")();"],
    ['async-generator-function', "AsyncGeneratorFunction(\"return import('./TARGET')\")();"],
    ['constructor', "(()=>{}).constructor(\"return import('./TARGET')\")();"],
    ['async-constructor', "(async()=>{}).constructor(\"return import('./TARGET')\")();"],
    ['split-constructor', "const key='con'+'structor'; (()=>{})[key](\"return import('./TARGET')\")();"],
    ['prototype-constructor', "Object.getPrototypeOf(async()=>{}).constructor(\"return import('./TARGET')\")();"],
    ['descriptor-constructor', "Object.getOwnPropertyDescriptors(()=>{}).constructor.value(\"return import('./TARGET')\")();"],
    ['destructured-constructor', "const {'constructor': f}=()=>{}; f(\"return import('./TARGET')\")();"],
    ['global-eval-split', "globalThis['ev'+'al'](\"import('./TARGET')\");"],
    ['escaped-identifier', "const run=ev\\u0061l; run(\"import('./TARGET')\");"],
    ['escaped-property', "(()=>{}).constr\\u0075ctor(\"return import('./TARGET')\")();"],
    ['import-meta-resolve', "const name=import.meta.resolve('./TARGET');"],
    ['unknown-ambient-loader', "Deno.mainModule('./TARGET');"],
    ['unknown-ambient-shorthand', "export const x={Deno}; const path='./TARGET';"],
    ['scope-confusion', "function local(Deno){return Deno;} Deno.mainModule('./TARGET');"],
    ['stack-reflection', "Error.prepareStackTrace=(_,stack)=>stack; new Error().stack.at(0).getFunction()('./TARGET');"],
  ];
  let attackCases = 0, positiveCases = 0;
  const reject = (sources, offendingFile, label, reason = /oracle-import-forbidden/) => {
    assert.throws(() => assertValidatorDependencies(entry, sources), error =>
      reason.test(error.message) && error.message.includes(offendingFile), label);
    attackCases++;
  };
  for (const [label, code] of attacks) for (const name of forbiddenNames) {
    const attack = code.replaceAll('TARGET', name), target = resolve(VALIDATOR_DIRECTORY, name);
    reject({ [entry]: attack, [target]: 'export const cases=[];' }, entry, `${label}/${name}/direct`);
    reject({ [entry]: middleImport, [middle]: attack, [target]: 'export const cases=[];' }, middle, `${label}/${name}/transitive`);
  }
  // Old "normal" dynamic-loader examples are now forbidden even for a safe builtin.
  for (const [label, code] of attacks.slice(1)) reject({ [entry]: code.replaceAll('./TARGET', 'node:crypto') }, entry, `${label}/dynamic-builtin`);
  const badSpecifiers = [
    'node:module', 'module', 'crypto', 'fs', 'node:vm', 'node:worker_threads',
    'node:child_process', 'node:process', 'node:inspector', 'node:http', 'typescript',
    'data:text/javascript,export default 1', 'https://example.invalid/validator.mjs',
    `file:///${middle.replaceAll('\\', '/')}`, middle, `./${VALIDATOR_FILES[1]}?x`,
    `./${VALIDATOR_FILES[1]}#x`, `./${VALIDATOR_FILES[1].toUpperCase()}`,
    `./sub/../${VALIDATOR_FILES[1]}`, `../calibration/${VALIDATOR_FILES[1]}`,
    `./%2e%2e/${VALIDATOR_FILES[1]}`, `.\\${VALIDATOR_FILES[1]}`, `./${VALIDATOR_FILES[1]}.json`,
    './unlisted-validator-helper.mjs', './pilot-images.mjs', './pilot-workflow-fixtures.mjs',
    './pilot-state-cases.mjs', './pilot-schema-cases.mjs', './pilot-metrics-isolation.mjs',
  ];
  for (const specifier of badSpecifiers) for (const transitive of [false, true]) {
    const code = `import ${JSON.stringify(specifier)};`, target = transitive ? middle : entry;
    reject({ [entry]: transitive ? middleImport : code, ...(transitive ? { [middle]: code } : {}) }, target, `specifier/${specifier}/${transitive}`);
  }
  const unknownSyntax = [
    "import ('node:crypto', {with:{type:'json'}});", "import name from name;",
    "import name from `node:crypto`;", "import name from 'node:crypto' with {type:'json'};",
    "import name from 'node:crypto' assert {type:'json'};", "import type {Hash} from 'node:crypto';",
    "import {type Hash} from 'node:crypto';", "import source name from 'node:crypto';",
    "import defer * as name from 'node:crypto';", "import 'node:cr\\u0079pto';",
    "import './unterminated;", "import * from 'node:crypto';", "export = {};",
    "export {x};", "const value = 1 as number;", "const x=<number>1;",
    "const x='test'; x[0];", "const x={}; const {[String(1)]: y}=x;",
    "const fn=String; fn`test`;", "with({}){}", "export const x=this;",
    "class Escape extends Array {}", "const x=1; eval?.('1');",
    "Object['get'+'PrototypeOf'](()=>{});", "const get=Reflect.get; get({}, 'constructor');",
    "const x={get constructor(){return String;}};", "const x = Bun;",
  ];
  for (const code of unknownSyntax) for (const transitive of [false, true]) {
    reject({ [entry]: transitive ? middleImport : code, ...(transitive ? { [middle]: code } : {}) },
      transitive ? middle : entry, `unknown-syntax/${code}/${transitive}`);
  }
  const accept = (sources, nodes, edges, builtins, label) => {
    assert.deepEqual(assertValidatorDependencies(entry, sources), { nodes, edges, builtins }, label);
    positiveCases++;
  };
  for (const [builtin, names] of VALIDATOR_BUILTINS) {
    for (const form of [
      `import '${builtin}';`, `import * as safe from '${builtin}'; export const value=safe;`,
      `import safe from '${builtin}'; export const value=safe;`,
      `import {default as safe} from '${builtin}'; export const value=safe;`,
      `import safe, {${[...names][0]} as value} from '${builtin}';`,
      `import {} from '${builtin}';`, `import {unlistedCapability as safe} from '${builtin}';`,
    ]) for (const transitive of [false, true]) {
      reject({ [entry]: transitive ? middleImport : form, ...(transitive ? { [middle]: form } : {}) },
        transitive ? middle : entry, `builtin-import-form/${form}/${transitive}`);
    }
    for (const name of names) for (const alias of [false, true]) {
      const form = `import {${name}${alias ? ' as safe' : ''}} from '${builtin}'; export const valid=true;`;
      accept({ [entry]: form }, [entry], [], [builtin], `named-export/${name}/${alias}/direct`);
      accept({ [entry]: middleImport, [middle]: form }, [entry, middle], [[entry, middle]], [builtin],
        `named-export/${name}/${alias}/transitive`);
    }
  }
  const forbiddenReadNames = [...new Set([...forbiddenNames, 'pilot-images.mjs',
    'pilot-workflow-fixtures.mjs', 'pilot-state-cases.mjs', 'pilot-schema-cases.mjs', 'pilot-metrics-isolation.mjs'])];
  for (const name of forbiddenReadNames) for (const alias of [false, true]) {
    const path = JSON.stringify(resolve(VALIDATOR_DIRECTORY, name));
    const code = `import {openAsBlob${alias ? ' as read' : ''}} from 'node:fs';
      export const valid=async()=> (await ${alias ? 'read' : 'openAsBlob'}(${path})).text();`;
    for (const transitive of [false, true]) reject({ [entry]: transitive ? middleImport : code,
      ...(transitive ? { [middle]: code } : {}) }, transitive ? middle : entry,
    `unmonitored-oracle-read/${name}/${alias}/${transitive}`);
  }
  for (const [builtin, names] of [
    ['node:fs', ['openAsBlob', 'read', 'readSync', 'readv', 'readvSync', 'createReadStream', 'promises',
      'cp', 'cpSync', 'mkdtemp', 'mkdtempSync', 'mkdtempDisposableSync', 'copyFile', 'copyFileSync',
      'link', 'linkSync', 'symlink', 'symlinkSync', 'createWriteStream', 'watch', 'constants']],
    ['node:fs/promises', ['open', 'cp', 'mkdtemp', 'mkdtempDisposable', 'copyFile', 'link', 'symlink',
      'writeFile', 'appendFile', 'truncate', 'rename', 'unlink', 'mkdir', 'rm', 'watch', 'constants']],
  ]) for (const name of names) for (const transitive of [false, true]) {
    const code = `import {${name} as capability} from '${builtin}'; export const valid=capability;`;
    reject({ [entry]: transitive ? middleImport : code, ...(transitive ? { [middle]: code } : {}) },
      transitive ? middle : entry, `forbidden-filesystem-capability/${builtin}/${name}/${transitive}`);
  }
  for (const code of [
    "import {cpSync} from 'node:fs'; export const valid=()=>cpSync('input','untracked-unknown-output.json');",
    "import fs from 'node:fs'; export const valid=()=>fs.promises.cp('input','untracked-unknown-output.json');",
    "import {cp} from 'node:fs/promises'; export const valid=()=>cp('input','untracked-unknown-output.json');",
  ]) for (const transitive of [false, true]) reject({ [entry]: transitive ? middleImport : code,
    ...(transitive ? { [middle]: code } : {}) }, transitive ? middle : entry, `untracked-output/${code}/${transitive}`);
  for (const transitive of [false, true]) for (const form of [
    `import './${VALIDATOR_FILES[2]}';`,
    `import * as safe from './${VALIDATOR_FILES[2]}';`,
    `import safe from './${VALIDATOR_FILES[2]}';`,
    `import {default as safe} from './${VALIDATOR_FILES[2]}';`,
  ]) reject({ [entry]: transitive ? middleImport : form, ...(transitive ? { [middle]: form } : {}),
    [leaf]: 'export const valid=true;' }, transitive ? middle : entry, `relative-import-form/${form}/${transitive}`);
  for (const property of ['strict', 'fail', 'Assert']) for (const alias of [false, true]) {
    const binding = alias ? 'permitted' : 'ok';
    const code = `import {ok${alias ? ' as permitted' : ''}} from 'node:assert/strict';
      export const valid=${binding}.${property};`;
    for (const transitive of [false, true]) reject({ [entry]: transitive ? middleImport : code,
      ...(transitive ? { [middle]: code } : {}) }, transitive ? middle : entry,
    `assert-ok-property/${property}/${alias}/${transitive}`,
    /builtin-export-not-allowlisted:node:assert\/strict\/ok/);
  }
  for (const transitive of [false, true]) {
    const code = "import {Buffer} from 'node:buffer'; const [key]=Object.getOwnPropertySymbols(Buffer); export const valid=Buffer[key];";
    reject({ [entry]: transitive ? middleImport : code, ...(transitive ? { [middle]: code } : {}) },
      transitive ? middle : entry, `buffer-symbol-property/${transitive}`);
  }
  accept({ [entry]: "import {createHash as digest} from 'node:crypto'; export const validatePilot=value=>digest('sha256').update(JSON.stringify(value)).digest('hex');" },
    [entry], [], ['node:crypto'], 'named-static-crypto');
  const booleanCheck = "import {strictEqual} from 'node:assert/strict'; export const valid=input=>{strictEqual(input.valid,true);return true;};";
  accept({ [entry]: booleanCheck }, [entry], [], ['node:assert/strict'], 'strict-equality-boolean-check/direct');
  accept({ [entry]: middleImport, [middle]: booleanCheck }, [entry, middle], [[entry, middle]],
    ['node:assert/strict'], 'strict-equality-boolean-check/transitive');
  accept({ [entry]: `import {check} from './${VALIDATOR_FILES[1]}'; export const validatePilot=x=>check(x);`,
    [middle]: `import {identity} from './${VALIDATOR_FILES[2]}'; export const check=x=>identity(x);`,
    [leaf]: "import {createHash} from 'node:crypto'; export const identity=x=>x;" },
  [entry, middle, leaf], [[entry, middle], [middle, leaf]], ['node:crypto'], 'static-relative-closure');
  for (const name of VALIDATOR_FILES.slice(1)) {
    const target = resolve(VALIDATOR_DIRECTORY, name);
    accept({ [entry]: `import {valid} from './${name}';`, [target]: "import {createHash} from 'node:crypto'; export const valid=true;" },
      [entry, target], [[entry, target]], ['node:crypto'], `exact-helper/${name}`);
  }
  accept({ [entry]: middleImport, [middle]: `import {root} from './${VALIDATOR_FILES[0]}'; export const valid=true;` },
    [entry, middle], [[entry, middle], [middle, entry]], [], 'cycle-terminates-after-checking-both-files');
  accept({ [entry]: `// import('not-an-import'); require('not-a-call');
    export async function validatePilot(input) {
      const {values: items} = input; const result = [];
      for (const item of items) { if (item.valid) result.push(item.value); }
      const [first, ...rest] = result;
      return {first, rest, text: 'eval Function import(node:module)'};
    }` }, [entry], [], [], 'safe-code-comments-strings-bindings');
  reject({ [entry]: middleImport }, middle, 'missing-allowlisted-source');
  assert.throws(() => assertValidatorDependencies(resolve(VALIDATOR_DIRECTORY, 'unlisted.mjs'), {}), /entry-not-allowlisted/); attackCases++;
  if (nativePaths === win32) {
    reject({ [entry]: '', [entry.toUpperCase()]: '' }, entry.toUpperCase(), 'case-fold-source-collision');
  }
  // Path fixtures exercise both platforms even on a Windows-only CI worker.
  let pathCases = 0;
  for (const paths of [win32, posix]) {
    const file = paths === win32 ? 'C:\\validator\\allowed.mjs' : '/validator/allowed.mjs';
    const parent = paths.dirname(file), outside = paths === win32 ? 'C:\\test\\pilot-oracle.mjs' : '/test/pilot-oracle.mjs';
    const io = { lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => true }), realpathSync: () => file };
    assert.doesNotThrow(() => assertDependencyIdentity(file, paths, io)); pathCases++;
    for (const redirected of [file, parent]) {
      assert.throws(() => assertDependencyIdentity(file, paths, {
        ...io, lstatSync: part => ({ isSymbolicLink: () => part === redirected, isFile: () => true }),
      }), /symlink-or-junction/); pathCases++;
    }
    assert.throws(() => assertDependencyIdentity(file, paths, { ...io, realpathSync: () => outside }), /realpath-identity-mismatch/); pathCases++;
    assert.throws(() => assertDependencyIdentity(file, paths, {
      ...io, lstatSync: () => ({ isSymbolicLink: () => false, isFile: () => false }),
    }), /not-regular-file/); pathCases++;
    assert.equal(dependencyKey(file, paths) === dependencyKey(file.toUpperCase(), paths), paths === win32); pathCases++;
    assert.equal(dependencyKey(file, paths) === dependencyKey(outside, paths), false); pathCases++;
  }
  assertDependencyIdentity(fileURLToPath(import.meta.url)); pathCases++;
  return { attackForms: attacks.length, forbiddenTargets: forbiddenNames.length, attackCases, positiveCases, pathCases,
    builtins: Object.fromEntries([...VALIDATOR_BUILTINS].map(([name, names]) => [name, [...names]])),
    filesystemGuardEvents: VALIDATOR_FS_EVENTS, files: [...VALIDATOR_FILES] };
}

// Inspect native function/object values, their own and inherited properties, and
// recursively the values of those properties. Reflective escape names are the
// same names rejected by validatorImports. Symbols are inspected too, although
// the validator cannot access them through computed properties. A new accessor
// that cannot be inspected or a newly exposed module capability fails closed.
function inspectBuiltinPropertyClosure(root, forbidden, label) {
  const queue = [[root, label]], seen = new Set(), exposures = [], failedAccessors = [];
  let propertyCount = 0, accessorCount = 0, symbolCount = 0, blockedNameCount = 0;
  for (let at = 0; at < queue.length; at++) {
    const [value, path] = queue[at];
    if (value === null || !['object', 'function'].includes(typeof value) || seen.has(value)) continue;
    seen.add(value);
    if (forbidden.has(value)) exposures.push({ path, exports: forbidden.get(value) });
    const keys = new Set();
    for (let level = value; level !== null; level = Object.getPrototypeOf(level)) {
      for (const key of Reflect.ownKeys(level)) {
        if (keys.has(key)) continue; keys.add(key);
        const descriptor = Object.getOwnPropertyDescriptor(level, key);
        // Object.values/entries/spread can expose own enumerable values without
        // spelling their keys, so inspect those even when direct access is banned.
        if (typeof key === 'string' && UNSAFE_NAMES.has(key)
          && !(level === value && descriptor.enumerable)) { blockedNameCount++; continue; }
        propertyCount++; if (typeof key === 'symbol') symbolCount++;
        const childPath = `${path}.${String(key)}`;
        if ('value' in descriptor) queue.push([descriptor.value, childPath]);
        else {
          accessorCount++;
          try { queue.push([Reflect.get(value, key, value), childPath]); }
          catch { failedAccessors.push(childPath); }
        }
      }
    }
  }
  return { nodes: seen.size, propertyCount, accessorCount, symbolCount, blockedNameCount,
    exposures, failedAccessors };
}

export function builtinCapabilityOracle() {
  assert.match(process.versions.node, /^24\./, 'native capability audit requires Node v24');
  const capability = value => value !== null && ['function', 'object'].includes(typeof value);
  const roots = [...VALIDATOR_BUILTINS].flatMap(([specifier, names]) => [...names].map(name => {
    const value = NATIVE_BUILTIN_EXPORTS.get(specifier)[name]; assert(capability(value), `${specifier}/${name}`);
    return { specifier, name, value };
  }));
  const allowedValues = new Set(roots.map(({ value }) => value)), forbidden = new Map(), aliases = [];
  for (const [specifier, namespace] of NATIVE_BUILTIN_NAMESPACES) forbidden.set(namespace, [`${specifier}/namespace`]);
  for (const [specifier, namespace] of NATIVE_BUILTIN_EXPORTS) for (const [name, value] of Object.entries(namespace)) {
    if (!capability(value) || VALIDATOR_BUILTINS.get(specifier).has(name)) continue;
    // An alias such as assert.equal === strictEqual adds no capability. Record
    // it explicitly; a distinct default/namespace object remains forbidden.
    if (allowedValues.has(value)) { aliases.push(`${specifier}/${name}`); continue; }
    if (!forbidden.has(value)) forbidden.set(value, []);
    forbidden.get(value).push(`${specifier}/${name}`);
  }
  const reports = roots.map(({ specifier, name, value }) => {
    const report = inspectBuiltinPropertyClosure(value, forbidden, `${specifier}/${name}`);
    assert.deepEqual(report.exposures, [], `native-builtin-capability-exposure:${specifier}/${name}`);
    assert.deepEqual(report.failedAccessors, [], `uninspectable-native-accessor:${specifier}/${name}`);
    return { specifier, name, ...report };
  });
  // Negative control: the audit must detect the exact removed ok surface,
  // including the strict default object and both unallowlisted member exports.
  const unsafe = inspectBuiltinPropertyClosure(NATIVE_BUILTIN_EXPORTS.get('node:assert/strict').ok,
    forbidden, 'node:assert/strict/ok');
  for (const [property, name] of [['strict', 'default'], ['fail', 'fail'], ['Assert', 'Assert']]) {
    assert(unsafe.exposures.some(item => item.path === `node:assert/strict/ok.${property}`
      && item.exports.includes(`node:assert/strict/${name}`)), `missing-native-negative-control:${property}`);
  }
  return { nodeVersion: process.versions.node, moduleCount: VALIDATOR_BUILTINS.size,
    exportCount: reports.length, propertyCount: reports.reduce((sum, row) => sum + row.propertyCount, 0),
    accessorCount: reports.reduce((sum, row) => sum + row.accessorCount, 0),
    symbolCount: reports.reduce((sum, row) => sum + row.symbolCount, 0),
    exposureCount: 0, failedAccessorCount: 0, negativeControlExposureCount: unsafe.exposures.length,
    aliases: aliases.sort(), reports };
}

// Keep the existing call-by-call effect monitor, and narrow its read boundary.
// Named fs imports are live bindings synchronized before validator import. No
// FileHandle/stream/namespace capability is available to escape these wrappers.
export function guardValidatorEffects(root, createEffectGuard) {
  const originals = Object.entries(VALIDATOR_FS_EVENTS).flatMap(([specifier, names]) => {
    const object = specifier === 'node:fs' ? fs : fs.promises;
    return Object.keys(names).map(name => ({ object, name, value: object[name], specifier }));
  });
  const effect = createEffectGuard(root), restores = [], descriptors = new Map();
  try {
    for (const { object, name, value, specifier } of originals) assert.notEqual(object[name], value,
      `missing-effect-guard-patch:${specifier}/${name}`);
  } catch (error) { effect.restore(); throw error; }
  const rootKey = dependencyKey(root), rootRealKey = dependencyKey(realpathSync(root));
  const checkPath = (value, write = false) => {
    if (typeof value === 'number') {
      assert(descriptors.has(value), 'validator-untracked-filesystem-descriptor');
      return checkPath(descriptors.get(value), write);
    }
    assert.equal(typeof value, 'string', 'validator-filesystem-path-must-be-string');
    const absolute = resolve(value), key = dependencyKey(absolute);
    assert(key.startsWith(`${rootKey}/`), `validator-${write ? 'write' : 'read'}-outside-work-root`);
    // Reject links in every component. For a new output, only its leaf may be
    // absent; no allowed API can create directories or links.
    for (let part = absolute; ; part = dirname(part)) {
      try { assert(!lstatSync(part).isSymbolicLink(), 'validator-filesystem-symlink-forbidden'); }
      catch (error) { if (!(write && part === absolute && error.code === 'ENOENT')) throw error; }
      if (dependencyKey(part) === rootKey) break;
    }
    if (!write) {
      assert(lstatSync(absolute).isFile(), 'validator-read-must-be-regular-file');
      assert(dependencyKey(realpathSync(absolute)).startsWith(`${rootRealKey}/`),
        'validator-read-realpath-outside-work-root');
    }
    return absolute;
  };
  const patch = (object, name, wrapper) => {
    const next = object[name]; assert.equal(typeof next, 'function', name);
    object[name] = wrapper(next); restores.push(() => { object[name] = next; });
  };
  const writeFlags = flags => typeof flags === 'number'
    ? (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0
    : /[wax+]/.test(flags);
  patch(fs, 'readFileSync', next => (path, ...args) => { checkPath(path); return next(path, ...args); });
  patch(fs, 'openSync', next => (path, flags, ...args) => {
    checkPath(path, writeFlags(flags)); const fd = next(path, flags, ...args); descriptors.set(fd, resolve(path)); return fd;
  });
  patch(fs, 'writeFileSync', next => (path, ...args) => { checkPath(path, true); return next(path, ...args); });
  patch(fs, 'fsyncSync', next => (fd, ...args) => { assert(descriptors.has(fd), 'validator-untracked-filesystem-descriptor'); return next(fd, ...args); });
  patch(fs, 'closeSync', next => (fd, ...args) => {
    assert(descriptors.has(fd), 'validator-untracked-filesystem-descriptor');
    const result = next(fd, ...args); descriptors.delete(fd); return result;
  });
  patch(fs, 'renameSync', next => (from, to, ...args) => { checkPath(from, true); checkPath(to, true); return next(from, to, ...args); });
  patch(fs, 'unlinkSync', next => (path, ...args) => { checkPath(path, true); return next(path, ...args); });
  patch(fs.promises, 'readFile', next => async (path, ...args) => { checkPath(path); return next(path, ...args); });
  syncBuiltinESMExports();
  const namespaces = { 'node:fs': fsNamed, 'node:fs/promises': fsPromisesNamed };
  for (const [specifier, events] of Object.entries(VALIDATOR_FS_EVENTS)) for (const name of Object.keys(events)) {
    const object = specifier === 'node:fs' ? fs : fs.promises;
    assert.equal(namespaces[specifier][name], object[name], `unguarded-named-binding:${specifier}/${name}`);
  }
  return { ...effect, restore() {
    restores.reverse().forEach(restore => restore()); syncBuiltinESMExports(); effect.restore();
  } };
}

// Execute every allowed fs export through the SAME monitor installed around the
// future validator. Static allowlisting alone is insufficient: these probes also
// assert the existing monitor's event, so removing a patch invalidates the test.
export async function validatorFsGuardOracle(root, base, createEffectGuard) {
  const rawRm = fs.rmSync, rawExists = fs.existsSync, guard = guardValidatorEffects(root, createEffectGuard);
  const namespaces = { 'node:fs': fsNamed, 'node:fs/promises': fsPromisesNamed };
  const covered = new Set(), roots = []; let positiveCases = 0, attackCases = 0;
  const invoke = async (specifier, name, ...args) => {
    const start = guard.events.length, result = await namespaces[specifier][name](...args);
    const expected = VALIDATOR_FS_EVENTS[specifier][name];
    assert(guard.events.slice(start).some(event => expected === 'open'
      ? ['read', 'open-write'].includes(event.operation) : event.operation === expected),
    `missing-call-guard-event:${specifier}/${name}`);
    covered.add(`${specifier}/${name}`); positiveCases++; return result;
  };
  const validationCall = () => guard.beginCall({ caseName: 'validation-only', errorClass: 'RangeError' }, {});
  const forbiddenFiles = ['pilot-oracle.mjs', 'pilot-contract-fixtures.mjs', 'pilot-images.mjs',
    'pilot-workflow-fixtures.mjs', 'pilot-state-cases.mjs', 'pilot-schema-cases.mjs',
    'pilot-metrics-isolation.mjs', 'libbrecht-2023-figure2-morphology-pilot.test.ts'];
  try {
    validationCall();
    const input = resolve(root, 'inputs', 'SOURCE-AUDIT.json');
    await invoke('node:fs', 'readFileSync', input);
    await invoke('node:fs/promises', 'readFile', input);
    const fd = await invoke('node:fs', 'openSync', input, 'r');
    await invoke('node:fs', 'readFileSync', fd);
    await invoke('node:fs', 'closeSync', fd); guard.endCall();
    for (const failure of [false, true]) {
      const fixture = clone(base), value = fileBytes(fixture.requestedOutputs[0].value);
      const call = guard.beginCall({ caseName: failure ? 'isolation-atomic-failure' : 'isolation',
        expected: { outputFileSha256: sha(value) } }, fixture); roots.push(call.callRoot);
      const outputFd = await invoke('node:fs', 'openSync', call.temp, 'wx');
      await invoke('node:fs', 'writeFileSync', outputFd, value);
      await invoke('node:fs', 'fsyncSync', outputFd);
      await invoke('node:fs', 'closeSync', outputFd);
      await invoke('node:fs', 'readFileSync', call.temp);
      if (failure) await invoke('node:fs', 'unlinkSync', call.temp);
      else await invoke('node:fs', 'renameSync', call.temp, call.final);
      guard.endCall();
    }
    assert.deepEqual([...covered].sort(), Object.entries(VALIDATOR_FS_EVENTS)
      .flatMap(([specifier, names]) => Object.keys(names).map(name => `${specifier}/${name}`)).sort());
    validationCall();
    for (const name of forbiddenFiles) for (const transitive of [false, true]) {
      const path = resolve(VALIDATOR_DIRECTORY, name);
      for (const [specifier, method, args] of [
        ['node:fs', 'readFileSync', [path]], ['node:fs', 'openSync', [path, 'r']],
        ['node:fs/promises', 'readFile', [path]],
      ]) {
        // Both an entry call and a helper call use the guarded live binding.
        const read = () => namespaces[specifier][method](...args), helper = () => read();
        await assert.rejects(async () => transitive ? helper() : read(), /validator-read-outside-work-root/); attackCases++;
      }
    }
    for (const [specifier, method] of [['node:fs', 'readFileSync'], ['node:fs/promises', 'readFile'],
      ['node:fs', 'fsyncSync'], ['node:fs', 'closeSync']]) {
      await assert.rejects(async () => namespaces[specifier][method](-1), /untracked-filesystem-descriptor/); attackCases++;
    }
    const outside = resolve(ROOT, `.d18-untracked-output-${process.pid}.json`);
    assert(!rawExists(outside), 'guard-probe-output-already-exists');
    for (const [method, args] of [['writeFileSync', [outside, 'forbidden']], ['openSync', [outside, 'wx']],
      ['renameSync', [input, outside]], ['unlinkSync', [outside]]]) {
      await assert.rejects(async () => fsNamed[method](...args), /validator-write-outside-work-root/); attackCases++;
      assert(!rawExists(outside), 'guard-probe-created-untracked-output');
    }
    guard.endCall();
    for (const method of ['writeFileSync', 'openSync', 'renameSync', 'unlinkSync', 'fsyncSync']) {
      validationCall(); const unknown = resolve(root, 'validation', 'unknown-untracked-output.json');
      let openFd;
      if (method === 'fsyncSync') openFd = fsNamed.openSync(input, 'r');
      const args = method === 'writeFileSync' ? [unknown, 'forbidden'] : method === 'openSync' ? [unknown, 'wx']
        : method === 'renameSync' ? [unknown, `${unknown}.other`] : method === 'fsyncSync' ? [openFd] : [unknown];
      assert.throws(() => fsNamed[method](...args), /validator-validation-only-write-forbidden/); attackCases++;
      if (openFd !== undefined) fsNamed.closeSync(openFd);
      assert.throws(() => guard.endCall(), /validator-validation-only-write-forbidden/);
      assert(!rawExists(unknown), 'guard-probe-created-unknown-output');
    }
    const call = guard.beginCall({ caseName: 'isolation', expected: {} }, clone(base)); roots.push(call.callRoot);
    const unknown = resolve(call.callRoot, 'unknown-untracked-output.json');
    assert.throws(() => fsNamed.writeFileSync(unknown, 'forbidden'), /validator-unknown-output-basename/); attackCases++;
    assert.throws(() => guard.endCall(), /validator-unknown-output-basename/);
    assert(!rawExists(unknown), 'guard-probe-created-unknown-output');
    return { guardedCapabilities: covered.size, positiveCases, attackCases,
      capabilities: [...covered].sort() };
  } finally {
    guard.restore();
    for (const path of roots) { assert(dependencyKey(path).startsWith(`${dependencyKey(resolve(root, 'validation'))}/`)); rawRm(path, { recursive: true, force: true }); }
  }
}
export function schemaMutations(caseName, fixture, root, path = []) {
  // Walk every object level and every required property (arrays use one representative).
  const walk = (object, at) => {
    if (Array.isArray(object)) { if (object.length) walk(object[0], [...at, 0]); return; }
    if (!object || typeof object !== 'object') return;
    const locate = f => at.reduce((v, k) => v[k], f[root]);
    bad(caseName, fixture, f => { locate(f).__unknown = true; }, 'unknown-property', [...path, ...at, '__unknown'].join('.'), 'TypeError');
    for (const key of Object.keys(object)) {
      const field = [...path, ...at, key].join('.');
      bad(caseName, fixture, f => { delete locate(f)[key]; }, 'missing-property', field, 'TypeError');
      bad(caseName, fixture, f => { locate(f)[key] = object[key] === null ? false : { invalidType: true }; }, 'type-or-enum', field, 'TypeError');
      if (object[key] !== null) bad(caseName, fixture, f => { locate(f)[key] = null; }, 'type-or-enum', field, 'TypeError');
      walk(object[key], [...at, key]);
    }
  };
  walk(fixture[root], []);
}

export const protocolText = readFileSync(resolve(DOC, 'MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md'), 'utf8');
export function template(section) {
  const tail = protocolText.slice(protocolText.indexOf(`## ${section}. exact `));
  return /```text\r?\n([\s\S]*?)```/.exec(tail)[1].replaceAll('\r\n', '\n');
}
export const templates = { annotator: template(15), adjudicator: template(16) };
export const placeholders = ['{{PROTOCOL_CANONICAL_JSON}}', '{{MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON}}', '{{BATCH_INPUT_TABLE_CANONICAL_JSON}}', '{{CANDIDATE_PAYLOAD_CANONICAL_JSON}}'];
export function render(role, vars) {
  const names = ['protocolCanonicalJson', 'modelPayloadSchemaCanonicalJson', 'batchInputTableCanonicalJson', 'candidatePayloadCanonicalJson'];
  const source = Buffer.from(templates[role], 'utf8');
  // Locate tokens only in the original template: inserted JSON can itself
  // contain placeholder strings, which must remain literal bytes (protocol §14).
  const ranges = placeholders.slice(0, role === 'annotator' ? 3 : 4).map((token, i) => {
    const bytes = Buffer.from(token, 'ascii'), start = source.indexOf(bytes);
    assert(start >= 0); assert.equal(source.indexOf(bytes, start + bytes.length), -1);
    return { start, end: start + bytes.length, value: Buffer.from(vars[names[i]], 'utf8') };
  }).sort((a, b) => a.start - b.start);
  const chunks = []; let offset = 0;
  for (const { start, end, value } of ranges) {
    chunks.push(source.subarray(offset, start), value); offset = end;
  }
  chunks.push(source.subarray(offset));
  return Buffer.concat(chunks).toString('utf8');
}

// Complete test schemas are transcribed from the normative TypeScript declarations,
// through an independent TypeScript type checker; no validator schema is imported.
export const schemaNames = {
  protocolObject: 'MorphologyPilotProtocolV1', selectionCandidateSet: 'SelectionCandidateSetV1', selectionProxyInput: 'SelectionProxyInputV1',
  selectionPlan: 'PilotSelectionPlanV1', blindedManifest: 'BlindedInputManifestV1', restrictedMap: 'RestrictedSourceMapV1', batchInputTable: 'BatchInputTableV1',
  annotationPayload: 'ModelAnnotationPayloadV1', adjudicationPayload: 'ModelAdjudicationPayloadV1', consensusRoutingTruthTable: 'ConsensusRoutingTruthTableV1',
  artifact: 'TestArtifactLineV1', candidateAlias: 'CandidateAliasManifestV1', candidatePayloadTable: 'CandidatePayloadTableV1',
  annotationConsensusSlotPlan: 'AnnotationConsensusSlotPlanV1', activeAnnotationConsensusSnapshot: 'ActiveAnnotationConsensusSnapshotV1',
  supersessionLedger: 'TestLedgerLineV1', invalidAttemptEvidence: 'InvalidAttemptEvidenceV1', renderedPromptEvidence: 'RenderedPromptEvidenceV1',
  postConsensusRouteSlotPlan: 'PostConsensusRouteSlotPlanV1', activeUpstreamSnapshot: 'ActiveUpstreamSnapshotV1', humanApproval: 'HumanApprovalRecordV1', pilotCoverage: 'PilotApprovalCoverageRecordV1',
  planClosure: 'PlanClosureV1',
};
export const SCHEMA_PROPERTIES = Object.keys(schemaNames).map(k => `${k}SchemaFileSha256`);
export const INTEGER_PROPERTIES=new Set(['ordinal','pageSlot','pdfPage','pagePanelOrdinal','widthPx','heightPx','sourceCropWidthPx','sourceCropHeightPx','pageRasterWidthPx','pageRasterHeightPx','uploadedWidthPx','uploadedHeightPx','expectedRecordCount','entryCount','lastSequence','sequence','cutoffSequence','oldCutoffSequence','rawResponseByteLength','attemptNumber','imageCount','expectedCount','maximumAttemptsPerCampaign']);
const zeroAllowed=new Set(['ordinal','cutoffSequence','oldCutoffSequence','entryCount','lastSequence']);
const aliasSchema=name=>name==='Sha256Hex'?{type:'string',pattern:'^[0-9a-f]{64}$',minLength:64,maxLength:64,format:'sha256-hex'}:name==='SourceObservationId'?{type:'string',pattern:'^L23-F2-P(?:11|12|13|14)-N[0-9]{3}$',format:'source-id'}:name==='UtcSeconds'?{type:'string',format:'utc-seconds'}:['AnonymousImageId','ArtifactId','LogicalSlot'].includes(name)?{type:'string',minLength:1,maxLength:128,format:'pilot-id'}:null;
export function schemaBundle() {
  const declarations = [...protocolText.matchAll(/```ts\r?\n([\s\S]*?)```/g)].map(m => m[1]).join('\n');
  const code = `${declarations}\ntype TestLedgerLineV1=ArtifactHeaderV1|SupersessionLedgerMetadataV1|SupersessionLedgerRecordV1;\ntype TestArtifactLineV1=ArtifactHeaderV1|AnnotationImageRecordV1|ConsensusImageRecordV1|AdjudicationImageRecordV1|SupersessionLedgerMetadataV1|SupersessionLedgerRecordV1|HumanApprovalRecordV1|PilotApprovalCoverageRecordV1;`;
  const name = resolve(ROOT, 'synthetic-pilot-normative-types.ts').replaceAll('\\', '/');
  const host = ts.createCompilerHost({ strict: true, target: ts.ScriptTarget.ES2022 });
  const oldRead = host.readFile, oldExists = host.fileExists;
  host.readFile = file => file.replaceAll('\\', '/') === name ? code : oldRead(file); host.fileExists = file => file.replaceAll('\\', '/') === name || oldExists(file);
  const program = ts.createProgram([name], { strict: true, target: ts.ScriptTarget.ES2022 }, host);
  const checker = program.getTypeChecker(), source = program.getSourceFile(name);
  const types = new Map(source.statements.filter(n => n.name).map(n => [n.name.text, checker.getTypeAtLocation(n)]));
  const cache = new Map();
  function declared(node,type){
    if(!node)return convert(type);
    if(ts.isTypeReferenceNode(node)){const special=aliasSchema(node.typeName.getText(source));if(special)return special;}
    if(ts.isUnionTypeNode(node))return{anyOf:node.types.map(n=>declared(n,checker.getTypeFromTypeNode(n)))};
    if(ts.isTypeOperatorNode(node))return declared(node.type,checker.getTypeFromTypeNode(node.type));
    if(ts.isArrayTypeNode(node))return{type:'array',items:declared(node.elementType,checker.getTypeFromTypeNode(node.elementType))};
    if(ts.isTupleTypeNode(node)){const items=node.elements.map(n=>{const inner=ts.isNamedTupleMember(n)?n.type:n;return declared(inner,checker.getTypeFromTypeNode(inner));});return{type:'array',prefixItems:items,minItems:items.length,maxItems:items.length,items:false};}
    return convert(type);
  }
  function propertyConstraints(schema,name,owner){
    if(schema.anyOf){schema.anyOf=schema.anyOf.map(s=>propertyConstraints(s,name,owner));return schema;}
    if(schema.type==='number'&&INTEGER_PROPERTIES.has(name))schema={...schema,type:'integer',minimum:zeroAllowed.has(name)?0:1,maximum:Number.MAX_SAFE_INTEGER};
    if(schema.type==='string'){
      if(name==='rationale')schema={...schema,minLength:1,maxLength:500};
      if(name==='otherLimitation')schema={...schema,minLength:1,maxLength:120};
      if(owner==='EvidencePayloadV1')schema={...schema,minLength:1,maxLength:200};
      if(/RelativePath$/.test(name))schema={...schema,format:'relative-path'};
    }
    if(schema.type==='array'){
      const counts={SelectionCandidateSetV1:{rows:206},SelectionProxyInputV1:{rows:206},PilotSelectionPlanV1:{slots:24},BlindedInputManifestV1:{entries:24,batches:2},RestrictedSourceMapV1:{entries:24},AnnotationConsensusSlotPlanV1:{slots:7},PostConsensusRouteSlotPlanV1:{slots:4},ConsensusRoutingTruthTableV1:{rows:64},PilotApprovalCoverageRecordV1:{coveredFinals:24}};
      const count=counts[owner]?.[name];if(count!==undefined)schema={...schema,minItems:count,maxItems:count};
      if(name==='orderedAnonymousImageIds')schema={...schema,minItems:12,maxItems:12};
      if(name==='maskRectanglesPx'&&schema.items?.prefixItems)schema.items.prefixItems=schema.items.prefixItems.map((s,i)=>({...s,type:'integer',minimum:i<2?0:1,maximum:Number.MAX_SAFE_INTEGER}));
      if(name==='cropPixelBounds'&&schema.prefixItems)schema.prefixItems=schema.prefixItems.map(s=>({...s,type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER}));
      if(owner==='SelectionCandidateSetV1'&&name==='rows')schema.items.prefixItems[2]={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
    }
    return schema;
  }
  function convert(type) {
    if (cache.has(type)) return clone(cache.get(type));
    let schema;
    if (type.flags & ts.TypeFlags.StringLiteral) schema = { const: type.value };
    else if (type.flags & ts.TypeFlags.NumberLiteral) schema = { const: type.value };
    else if (type.flags & ts.TypeFlags.BooleanLiteral) schema = { const: type.intrinsicName === 'true' };
    else if (type.flags & ts.TypeFlags.Null) schema = { type: 'null' };
    else if (type.isUnion()) schema = { anyOf: type.types.map(convert) };
    else if (type.flags & ts.TypeFlags.TemplateLiteral) schema = { type: 'string', pattern: type.texts[0].startsWith('L23-F2-') ? '^L23-F2-P(?:11|12|13|14)-N[0-9]{3}$' : `^${type.texts.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')}$` };
    else if (type.flags & ts.TypeFlags.String) schema = { type: 'string',minLength:1,format:'nfc-string' };
    else if (type.flags & ts.TypeFlags.Number) schema = { type: 'number',finite:true,negativeZero:false };
    else if (type.flags & ts.TypeFlags.Boolean) schema = { type: 'boolean' };
    else if (checker.isTupleType(type)) {
      const items = checker.getTypeArguments(type).map(convert); schema = { type: 'array', prefixItems: items, minItems: items.length, maxItems: items.length, items: false };
    } else if (type.getNumberIndexType()) schema = { type: 'array', items: convert(type.getNumberIndexType()) };
    else {
      const properties = {};
      for (const prop of checker.getPropertiesOfType(type)) {const declaration=prop.valueDeclaration??prop.declarations?.[0];properties[prop.name]=propertyConstraints(declared(declaration?.type,checker.getTypeOfSymbolAtLocation(prop,declaration??source)),prop.name,declaration?.parent?.name?.text);}
      const index = type.getStringIndexType();
      schema = { type: 'object', properties, required: Object.keys(properties).sort(cmp), additionalProperties: index ? convert(index) : false };
    }
    cache.set(type, schema); return clone(schema);
  }
  return Object.fromEntries(Object.entries(schemaNames).map(([key, typeName]) => {
    assert(types.has(typeName), typeName);
    const object = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `urn:snow-crystal:pilot:${key}:1`, ...convert(types.get(typeName)) };
    const bytes = fileBytes(object); assert.deepEqual(parseUnique(bytes), object);
    return [`${key}SchemaFileSha256`, { filename: `${key}.schema.json`, object, bytes, objectSha256: hash(object), fileSha256: sha(bytes) }];
  }));
}

export function schemaAccepts(schema, value) {
  if(!schema||schema===false)return false;
  if ('const' in schema) return typeof value===typeof schema.const&&Object.is(value,schema.const);
  if (schema.anyOf) return schema.anyOf.some(s => schemaAccepts(s, value));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'array') return Array.isArray(value) && (!schema.minItems || value.length >= schema.minItems) && (schema.maxItems === undefined || value.length <= schema.maxItems) && value.every((v, i) => schemaAccepts(schema.prefixItems?.[i] ?? schema.items, v));
  if (schema.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) && schema.required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => schema.properties[k] ? schemaAccepts(schema.properties[k], value[k]) : schema.additionalProperties !== false && schemaAccepts(schema.additionalProperties, value[k]));
  if(schema.type==='number'||schema.type==='integer')return typeof value==='number'&&Number.isFinite(value)&&!Object.is(value,-0)&&(schema.type!=='integer'||Number.isSafeInteger(value))&&(schema.minimum===undefined||value>=schema.minimum)&&(schema.maximum===undefined||value<=schema.maximum);
  return typeof value === schema.type && (typeof value!=='string'||validString(value,schema)) && (!schema.pattern || new RegExp(schema.pattern).test(value));
}
export function validString(value,schema={}){
  if(value.normalize('NFC')!==value||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))return false;
  const length=Array.from(value).length;if(schema.minLength!==undefined&&length<schema.minLength||schema.maxLength!==undefined&&length>schema.maxLength)return false;
  if(schema.format==='sha256-hex')return/^[0-9a-f]{64}$/.test(value);
  if(schema.format==='source-id')return/^L23-F2-P(?:11|12|13|14)-N[0-9]{3}$/.test(value);
  if(schema.format==='utc-seconds')return/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace(/Z$/,'.000Z');
  if(schema.format==='pilot-id')return length>=1&&length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f-\u009f\/\\]|L23-F2|(?:^|[-_])P(?:11|12|13|14)(?:$|[-_])|temperature|supersaturation|-?\d+(?:\.\d+)?(?:°?C|%)|@|https?:|account:|device:/i.test(value);
  if(schema.format==='relative-path')return value.length>0&&!/^(?:[A-Za-z]:|\/)|\\|(?:^|\/)\.\.(?:\/|$)|(?:^|\/)users?(?:\/|$)/i.test(value);
  return true;
}
