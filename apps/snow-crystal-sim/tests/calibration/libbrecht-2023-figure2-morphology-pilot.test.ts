// Only test-owned synthetic fixtures are used. The future validator is loaded
// after its explicit existence assertion, then receives EVERY registered case.
// @ts-expect-error Node typings are outside this browser workspace.
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
// @ts-expect-error Node typings are outside this browser workspace.
import { resolve } from 'node:path';
// @ts-expect-error Node typings are outside this browser workspace.
import { pathToFileURL } from 'node:url';
// @ts-expect-error Node typings are outside this browser workspace.
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Test-only ESM support has no browser-runtime exports.
import { assert, cases, ROOT, DOC, sha, hash, clone, hex, SCHEMA_PROPERTIES, schemaAccepts, assertValidatorDependencies, dependencyGateOracle, builtinCapabilityOracle, guardValidatorEffects, validatorFsGuardOracle } from './pilot-oracle.mjs';
// @ts-expect-error Test-only ESM support.
import { imageCases, png, maskedPixels, rgbaHash } from './pilot-images.mjs';
// @ts-expect-error Test-only ESM support.
import { buildContract, contractCases } from './pilot-contract-fixtures.mjs';
// @ts-expect-error Test-only ESM support.
import { buildWorkflow, workflowCases } from './pilot-workflow-fixtures.mjs';
// @ts-expect-error Test-only ESM support.
import { attemptCases, d20DuplicateInvalidEvidenceProbe, reissueCases, slotCases, adjudicationCases, approvalCases } from './pilot-state-cases.mjs';
// @ts-expect-error Test-only ESM support.
import { schemaCases, exerciseSchema, parserOracleCases } from './pilot-schema-cases.mjs';
// @ts-expect-error Test-only independent implementation-review regressions.
import { buildReviewGapRows, registerReviewGapRows } from './pilot-d20-review-gap-cases.mjs';
// @ts-expect-error Test-only signature and mutation audit.
import { assertReviewGapRows } from './pilot-d20-review-gap-selfcheck.mjs';
// @ts-expect-error Test-only ESM support.
import { createIsolatedRoot, repositorySnapshot, isolatedSnapshot, isolationCases, guardEffects, effectGuardOracle, metricsCases, inside, wilson, kappa } from './pilot-metrics-isolation.mjs';

const VALIDATOR_REL = 'apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-morphology-pilot-validator.mjs';
type FixtureCase = { caseName: string; fixture: unknown; expected?: unknown; errorClass?: 'SyntaxError' | 'TypeError' | 'RangeError'; field?: string; reason?: string; label: string };
type Validator = { validatePilot(caseName: string, fixture: unknown): unknown | Promise<unknown> };
// The API returns exactly each independent result. Validation-only operations
// return true, never arbitrary truthy objects. These are test-only operation IDs.
let contract: any;
let workflow: any;
let workRoot: string;
let initialRepository: unknown;
let inputSnapshot: unknown;
let initialOwnFiles: unknown;
let networkGuard: any;
const ownSnapshot = () => readdirSync(resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration')).filter((name: string) => name.startsWith('pilot-') || name === 'libbrecht-2023-figure2-morphology-pilot.test.ts').sort().map((name: string) => [name, sha(readFileSync(resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration', name)))]);

describe('T1-7 morphology ensemble pilot — synthetic independent conformance corpus', () => {
  beforeAll(() => {
    initialRepository = repositorySnapshot(); initialOwnFiles = ownSnapshot();
    workRoot = createIsolatedRoot(); networkGuard = guardEffects(workRoot, true);
  });
  afterAll(() => {
    networkGuard?.restore();
    expect(repositorySnapshot()).toEqual(initialRepository);
    expect(ownSnapshot()).toEqual(initialOwnFiles);
    if (inputSnapshot) expect(isolatedSnapshot(workRoot)).toEqual(inputSnapshot);
    expect(networkGuard.networkCalls).toEqual([]);
    assert(!inside(ROOT, workRoot));
    rmSync(workRoot, { recursive: true, force: true });
  });
  it('TC-PILOT authority hashes and duplicate-aware parser oracle remain frozen', () => {
    for (const [name, expected] of [
      ['DESIGN.md', '88dd9568e737a5abac9f25a120cdd24fcb9c701dbcb437509cb161e1bedba781'],
      ['MORPHOLOGY-ENSEMBLE-PILOT-PROTOCOL.md', 'bdf96f43db8f042ee2b83afee804f3b398c57f5dbc77d7940c842f78d1267e40'],
      ['TESTCASES.md', 'fa16236613963557bbcc3f2d2979b8b63b8af98f0de02e4129b7945312e17b52'],
    ]) expect(sha(readFileSync(resolve(DOC, name)))).toBe(expected);
    parserOracleCases();
    dependencyGateOracle();
    expect(builtinCapabilityOracle()).toMatchObject({
      moduleCount: 7, exportCount: 18, exposureCount: 0, failedAccessorCount: 0,
    });
  });
  it('TC-PILOT-DERIVATIVE-001 exact PNG/RGBA/CRC/Adler/stored-block/crop oracles and mutations', () => {
    imageCases();
    expect(hex(png(3, 2, maskedPixels))).toBe('89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a00000025494441547801011a00e5ff00010203ff7f7f7fff070809ff000a0b0cff0d0e0fff101112ff67c90814287917b50000000049454e44ae426082');
  });
  it('TC-PILOT-MAPPING-001..004 exhaustive legal/illegal counts 76/44/93/27 and payload mutations', () => {
    contract = buildContract();
    for (const [key, total, valid] of [['growth', 243, 76], ['branching', 2304, 44], ['hollowing', 243, 93], ['confidence', 81, 27]] as const) {
      expect(contract.tables[key]).toHaveLength(total);
      expect(contract.tables[key].filter((r: any) => r.valid)).toHaveLength(valid);
    }
  });
  it('TC-PILOT-SELECTION-001..002, DERIVATIVE-002, TRANSPORT-001, PROMPT-001..003, SCHEMA-001 complete bound inputs', () => {
    contractCases(contract);
    expect(contract.candidateSet.rows).toHaveLength(206);
    expect(contract.plan.slots).toHaveLength(24);
    expect(contract.manifest.batches.map((b: any) => b.orderedAnonymousImageIds.length)).toEqual([12, 12]);
    expect(Object.keys(contract.protocol.schemaFiles)).toEqual(SCHEMA_PROPERTIES);
    expect(cases.filter((c: FixtureCase) => c.caseName === 'transport' && c.label === 'positive')).toHaveLength(5);
  });
  it('TC-PILOT-RUN-001..002, CONSENSUS-001 complete six-run/72-record immutable artifact chain', () => {
    workflow = buildWorkflow(contract); workflowCases(contract, workflow);
    expect(workflow.runs.flatMap((r: any) => r.records)).toHaveLength(72);
    expect(workflow.consensus.records).toHaveLength(24);
    expect(hash(contract.truthTable)).toBe('7794c28359dc2fa7d918a49b2ba4f0cad335d6b54c5d589ca8da95940b7686d7');
  });
  it('TC-PILOT-ATTEMPT-001 all state-sensitive root/model-retry/input-change campaigns, immutable raw files, UTC order and provenance mutations', () => {
    attemptCases(contract, workflow, workRoot);
    const normative = cases.filter((c: FixtureCase) => c.caseName === 'attempt-state-transition');
    expect(normative).toHaveLength(18);
    expect(new Set(normative.map((c: FixtureCase) => hash(c.fixture))).size).toBe(18);
  });
  it('TC-PILOT-REISSUE-001 closes the old plan and creates an unexecuted, unlinked new plan', () => {
    reissueCases(contract, workflow);
  }, 30000); // Full independent schema/byte/graph checks for all 12 reissues.
  it('TC-PILOT D-20 implementation-review gaps have independent signed fixtures and exact registration', () => {
    const rows = buildReviewGapRows(contract, workflow, resolve(workRoot, 'inputs/attempts/original.txt'));
    registerReviewGapRows(rows);
    expect(assertReviewGapRows(contract, workflow, rows, cases)).toMatchObject({ status: 'green', totalRows: 14, registeredRows: 14 });
  });
  it('TC-PILOT-SLOTS-001..003 both plans, Q20+4, ledgers, active snapshots and normative DAG mutations', () => {
    slotCases(contract, workflow);
    expect(workflow.firstPlan.slots).toHaveLength(7);
    expect(workflow.freshPlan.slots).toHaveLength(4);
  });
  it('TC-PILOT-ADJUDICATION-001 fresh displayed family, aliases, dispositions and four fallback reasons', () => {
    adjudicationCases(contract, workflow);
    expect(workflow.aliases.entries).toHaveLength(workflow.Q.length);
  });
  it('TC-PILOT-APPROVAL-001..002 active-source approvals 8+16, exact24 coverage and production exclusion', () => {
    approvalCases(contract, workflow);
    expect(workflow.approvals.map((a: any) => a.records[0].targets.length)).toEqual([8, 16]);
    expect(workflow.coverage.records[0].coveredFinals).toHaveLength(24);
  });
  it('TC-PILOT-SCHEMA-001 every normative schema accepts its complete fixture and rejects property mutations', () => {
    const samples = schemaCases(contract, workflow);
    samples.invalidAttemptEvidence = cases.find((c: any) => c.caseName === 'invalid-attempt' && c.label === 'positive').fixture.evidence;
    samples.planClosure = cases.find((c: any) => c.caseName === 'plan-closure' && !c.errorClass).fixture.closure;
    expect(Object.keys(samples)).toHaveLength(23);
    for (const [key, sample] of Object.entries(samples)) exerciseSchema(contract, key, sample);
    const ledgerRecord = cases.find((c: any) => c.caseName === 'active-ledger' && !c.errorClass && c.fixture.ledger.records.length > 1).fixture.ledger.records[1];
    const artifactMembers = [workflow.runs[0].header, workflow.runs[0].records[0], workflow.consensus.records[0], workflow.adjudication.records[0], workflow.emptyLedger.records[0], ledgerRecord, workflow.approvals[0].records[0], workflow.coverage.records[0]];
    expect(new Set(artifactMembers.map((v: any) => v.recordType)).size).toBe(8);
    for (const sample of artifactMembers) {
      expect(schemaAccepts(contract.bundle.artifactSchemaFileSha256.object, sample)).toBe(true);
      exerciseSchema(contract, 'artifact', sample);
    }
    for (const sample of [workflow.emptyLedger.header, workflow.emptyLedger.records[0], ledgerRecord]) exerciseSchema(contract, 'supersessionLedger', sample);
    exerciseSchema(contract, 'humanApproval', workflow.approvals[1].records[0]);
    exerciseSchema(contract, 'postConsensusRouteSlotPlan', workflow.skippedPlan);
    exerciseSchema(contract, 'artifact', workflow.consensus.header);
    exerciseSchema(contract, 'artifact', workflow.adjudication.header);
  });
  it('TC-PILOT-ISOLATION-001 actual temp root, immutable sentinel hashes and forbidden output/atomic mutations', async () => {
    const { base } = isolationCases(workRoot); effectGuardOracle(workRoot, base);
    expect(await validatorFsGuardOracle(workRoot, base, guardEffects)).toMatchObject({
      guardedCapabilities: 8, positiveCases: 17, attackCases: 62,
    });
    inputSnapshot = isolatedSnapshot(workRoot);
    expect(repositorySnapshot()).toEqual(initialRepository);
  });
  it('TC-PILOT-METRICS-001 coverage, attempts, confusion, weighted kappa, Wilson, human/adjudication/time aggregates', () => {
    const metrics = metricsCases(contract, workflow);
    expect(metrics.threeActorMorphologyExact).toEqual({ numerator: 20, denominator: 24, interval95: wilson(20, 24).value, undefinedReason: null });
    expect(metrics.threeActorVoteExact).toEqual({ numerator: 18, denominator: 24, interval95: wilson(18, 24).value, undefinedReason: null });
    expect(metrics.remainingUnpromoted).toBe(182);
  });
  it('every case has an exact result or typed first-error oracle; no empty fixture', () => {
    expect(cases.length).toBeGreaterThan(7553);
    const negativeMatrix = cases.filter((c: FixtureCase) => c.label.startsWith('d22/'));
    expect(negativeMatrix).toHaveLength(253);
    expect(new Set(negativeMatrix.map((c: FixtureCase) => c.label)).size).toBe(253);
    expect(cases.filter((c: FixtureCase) => c.label.startsWith('d23/'))).toHaveLength(14);
    for (const c of cases as FixtureCase[]) {
      expect(c.caseName).not.toBe(''); expect(c.fixture).not.toBeNull();
      if (c.errorClass) { expect(c.field).toBeTruthy(); expect(c.reason).toBeTruthy(); }
      else expect(Object.hasOwn(c, 'expected')).toBe(true);
    }
  });
  it('TC-PILOT-RED-001 sole expected Red: jointly spoofed selection PDF authority must be rejected', async () => {
    const path = resolve(ROOT, VALIDATOR_REL);
    expect(existsSync(path), `missing pilot validator artifact: ${VALIDATOR_REL}`).toBe(true);
    const dependencyGraph = assertValidatorDependencies(path);
    expect(dependencyGraph.nodes.some((file: string) => /[\\/]pilot-.*\.mjs$/.test(file))).toBe(false);
    const guard = guardValidatorEffects(workRoot, guardEffects);
    try {
      const loaded = await import(/* @vite-ignore */ pathToFileURL(path).href) as Validator;
      expect(typeof loaded.validatePilot, 'missing validatePilot(caseName, fixture) API').toBe('function');
      const runOne = async (c: FixtureCase) => {
        const fixture = c.caseName.startsWith('isolation') ? clone(c.fixture) : { ...clone(c.fixture) as object, PILOT_WORK_ROOT: workRoot };
        guard.beginCall(c, fixture);
        const inputBefore = clone(fixture);
        try {
          if (!c.errorClass) expect(await loaded.validatePilot(c.caseName, fixture), `${c.caseName}/${c.label}`).toEqual(c.expected);
          else {
            let error: unknown;
            try { await loaded.validatePilot(c.caseName, fixture); } catch (caught) { error = caught; }
            const constructor = { SyntaxError, TypeError, RangeError }[c.errorClass];
            expect(error, `${c.caseName}/${c.label}`).toBeInstanceOf(constructor);
            expect((error as Error).message).toContain(c.reason);
            expect((error as Error).message).toContain(c.field);
          }
        } finally { guard.endCall(); }
        expect(fixture, `${c.caseName}/${c.label}: input mutation`).toEqual(inputBefore);
        if (c.caseName === 'isolation' && !c.errorClass) {
          const output = (fixture as any).requestedOutputs[0].destination;
          expect(existsSync(output)).toBe(true);
          expect(sha(readFileSync(output))).toBe((c.expected as any).outputFileSha256);
          expect(existsSync(resolve((fixture as any).outputRoot, (fixture as any).atomicWrite.temporaryBasename))).toBe(false);
        }
        if (c.caseName === 'isolation-atomic-failure') {
          expect(existsSync((fixture as any).requestedOutputs[0].destination)).toBe(false);
          expect(existsSync(resolve((fixture as any).outputRoot, (fixture as any).atomicWrite.temporaryBasename))).toBe(false);
        }
      };
      // Deterministic first assertion for the new review gaps. Once fixed,
      // all fourteen rows still run through the guarded randomized registry.
      const pdfProbe = (cases as FixtureCase[]).find(c => c.label === 'd23/selection/joint-pdf-spoof');
      expect(pdfProbe).toBeDefined();
      await runOne(pdfProbe!);
      // Retain the earlier D-20 duplicate-evidence regression before shuffle.
      // Both evidence records are fully signed but claim attempt number 1.
      const duplicateProbe = d20DuplicateInvalidEvidenceProbe();
      let duplicateError: unknown;
      try { await loaded.validatePilot('attempt-campaign', { ...clone(duplicateProbe), PILOT_WORK_ROOT: workRoot }); } catch (caught) { duplicateError = caught; }
      expect(duplicateError).toBeInstanceOf(RangeError);
      expect((duplicateError as Error).message).toContain('attempt-campaign-invalid');
      expect((duplicateError as Error).message).toContain('invalidEvidence');
      // A per-run unpredictable order prevents a fixed registry-order replay.
      // Repeating representatives in reverse order also rejects call-count state.
      const nonce = randomBytes(32).toString('hex');
      const shuffled = (cases as FixtureCase[]).map((c, i) => ({ c, key: sha(`${nonce}/${i}`) })).sort((a, b) => a.key < b.key ? -1 : 1).map(({ c }) => c);
      expect(shuffled.some((c, i) => c !== cases[i])).toBe(true);
      for (const c of shuffled) await runOne(c);
      const repeated = new Map<string, FixtureCase>();
      for (const c of shuffled) if (!repeated.has(`${c.caseName}/${Boolean(c.errorClass)}`)) repeated.set(`${c.caseName}/${Boolean(c.errorClass)}`, c);
      for (const c of [...repeated.values()].reverse()) { await runOne(c); await runOne(c); }
      // Fresh metamorphic inputs are NOT registered in the exported case table.
      for (const c of freshMetamorphicCases()) await runOne(c);
      expect(guard.networkCalls).toEqual([]);
      expect(isolatedSnapshot(workRoot)).toEqual(inputSnapshot);
    } finally { guard.restore(); }
    expect(repositorySnapshot()).toEqual(initialRepository);
  }, 120_000);
});

function freshMetamorphicCases(): FixtureCase[] {
  const entropy = [...randomBytes(96)] as number[];
  const out: FixtureCase[] = [];
  for (let i = 0; i < 6; i++) {
    const n = 25 + entropy[i]!, k = entropy[i + 6]! % (n + 1);
    out.push({ caseName: 'wilson', fixture: { numerator: k, denominator: n }, expected: wilson(k, n), label: `fresh-rate-${i}` });
    const left = entropy.slice(i, i + 8).map(v => v % 5 === 4 ? null : v % 4);
    const right = entropy.slice(i + 20, i + 28).map(v => v % 5 === 4 ? null : v % 4);
    out.push({ caseName: 'quadratic-kappa', fixture: { left, right }, expected: kappa(left, right), label: `fresh-kappa-${i}` });
  }
  const rgba = entropy.slice(0, 48).map((v, i) => i % 4 === 3 ? 255 : v), encoded = png(4, 3, rgba), pixelHash = rgbaHash(4, 3, rgba);
  out.push({ caseName: 'canonical-png', fixture: { pngBytes: [...encoded], widthPx: 4, heightPx: 3, rgbaSha256: pixelHash }, expected: { byteLength: encoded.length, fileSha256: sha(encoded), rgbaSha256: pixelHash, storedBlockLengths: [51] }, label: 'fresh-rgba-bytes' });
  const corrupted = [...encoded]; corrupted[32] = corrupted[32]! ^ 1;
  out.push({ caseName: 'canonical-png', fixture: { pngBytes: corrupted, widthPx: 4, heightPx: 3, rgbaSha256: pixelHash }, errorClass: 'RangeError', reason: 'canonical-png', field: 'pngBytes', label: 'fresh-rgba-CRC-mutation' });
  return out;
}
