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
// @ts-expect-error Test-local Phase A oracle imports.
import * as phaseACrypto from 'node:crypto';
// @ts-expect-error Test-local Phase A oracle imports.
import * as phaseAFs from 'node:fs';
// @ts-expect-error Test-local Phase A oracle imports.
import * as phaseAPath from 'node:path';
// @ts-expect-error Test-local Phase A oracle imports.
import * as phaseAChildProcess from 'node:child_process';
// @ts-expect-error Test-local Phase A oracle imports.
import { tmpdir as phaseATmpdir } from 'node:os';
// @ts-expect-error Test-local Phase A oracle imports.
import { fileURLToPath as phaseAFileURLToPath } from 'node:url';
// @ts-expect-error Test-local Phase A oracle imports.
import phaseAAssert from 'node:assert/strict';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error Test-only ESM support has no browser-runtime exports.
import { assert, cases, ROOT, DOC, sha, hash, clone, hex, SCHEMA_PROPERTIES, schemaAccepts, assertValidatorDependencies, dependencyGateOracle, builtinCapabilityOracle, guardValidatorEffects, validatorFsGuardOracle } from './pilot-oracle.mjs';
// @ts-expect-error Test-only ESM support.
import { imageCases, png, maskedPixels, rgbaHash } from './pilot-images.mjs';
// @ts-expect-error Test-only ESM support.
import { buildContract, contractCases } from './pilot-contract-fixtures.mjs';
// @ts-expect-error Test-only real frozen-input selection oracle.
import { buildRealSelectionFixture, realSelectionBoundaryMutations, REAL_SELECTION_SNAPSHOT } from './pilot-real-selection-cases.mjs';
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
// @ts-expect-error Test-only deeper implementation-review regressions.
import { buildDepthRows, registerDepthRows } from './pilot-d24-depth-cases.mjs';
// @ts-expect-error Independent signature and target-isolation audit.
import { assertDepthRows } from './pilot-d24-depth-selfcheck.mjs';
// @ts-expect-error Test-only graph-completeness omission fixtures.
import { buildCompletenessRows, registerCompletenessRows } from './pilot-d25-completeness-cases.mjs';
// @ts-expect-error Independent frozen-graph and identity-set audit.
import { assertCompletenessRows, assertImmutableRegistrySharing } from './pilot-d25-completeness-selfcheck.mjs';
// @ts-expect-error Independent concrete transition-authority audit.
import { assertTransitionAuthorities } from './pilot-transition-authority-selfcheck.mjs';
// @ts-expect-error Test-only ESM support.
import { createIsolatedRoot, repositorySnapshot, isolatedSnapshot, isolationCases, guardEffects, effectGuardOracle, metricsCases, inside, wilson, kappa } from './pilot-metrics-isolation.mjs';

declare const Buffer: any;
declare const process: any;

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
let completenessRows: any[];
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
      ['TESTCASES.md', '9dae14fb9378ca01e345c4915e7af6c84fe3a23c9eaf0044edafe888d98adc49'],
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
  it('TC-PILOT-SELECTION-001 real 206-input page domain and batch-order snapshot', async () => {
    const fixture = buildRealSelectionFixture(contract.protocol);
    expect(fixture.selectionPlan.slots.map((slot: any) => slot.sourceObservationId)).toEqual(REAL_SELECTION_SNAPSHOT);
    const path = resolve(ROOT, VALIDATOR_REL);
    const loaded = await import(/* @vite-ignore */ pathToFileURL(path).href) as Validator;
    expect(await loaded.validatePilot('selection', fixture)).toEqual(fixture.selectionPlan);
    for (const mutation of realSelectionBoundaryMutations(fixture)) {
      let error: unknown;
      try { await loaded.validatePilot('selection', mutation.fixture); } catch (caught) { error = caught; }
      expect(error, `page ${mutation.page} must reject ${mutation.sourceObservationId}`).toBeInstanceOf(RangeError);
      expect((error as Error).message).toContain('selection-invalid');
      expect((error as Error).message).toContain('sourceObservationId');
    }
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
    expect(assertTransitionAuthorities(contract, workflow, cases)).toMatchObject({ status: 'green', totalRows: 18, isolatedRows: 18 });
  });
  it('TC-PILOT-REISSUE-001 closes the old plan and creates an unexecuted, unlinked new plan', () => {
    reissueCases(contract, workflow);
    completenessRows = buildCompletenessRows(contract, workflow);
    registerCompletenessRows(completenessRows);
    expect(assertCompletenessRows(contract, workflow, completenessRows, cases)).toMatchObject({
      status: 'green', totalRows: 17, registeredRows: 17, frozenOldGraphs: 3, mutableAliasCount: 0,
    });
  }, 30000); // Full independent schema/byte/graph checks for all 12 reissues.
  it('TC-PILOT D-20 implementation-review gaps have independent signed fixtures and exact registration', () => {
    const rows = buildReviewGapRows(contract, workflow, resolve(workRoot, 'inputs/attempts/original.txt'));
    registerReviewGapRows(rows);
    expect(assertReviewGapRows(contract, workflow, rows, cases)).toMatchObject({ status: 'green', totalRows: 14, registeredRows: 14 });
  });
  it('TC-PILOT D-24 deeper authority regressions have coherent bytes, signatures and isolated semantic defects', () => {
    const rows = buildDepthRows(contract, workflow);
    registerDepthRows(rows);
    expect(assertDepthRows(contract, workflow, rows, cases)).toMatchObject({ status: 'green', totalRows: 18, registeredRows: 18 });
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
    expect(cases.filter((c: FixtureCase) => c.label.startsWith('d24/'))).toHaveLength(18);
    expect(cases.filter((c: FixtureCase) => c.label.startsWith('d25/'))).toHaveLength(17);
    expect(assertImmutableRegistrySharing(contract, workflow, cases)).toMatchObject({ status: 'green', mutableAliasCount: 0 });
    for (const c of cases as FixtureCase[]) {
      expect(c.caseName).not.toBe(''); expect(c.fixture).not.toBeNull();
      if (c.errorClass) { expect(c.field).toBeTruthy(); expect(c.reason).toBeTruthy(); }
      else expect(Object.hasOwn(c, 'expected')).toBe(true);
    }
  });
  it('TC-PILOT-FREEZE-001..003 freezes only the reviewed contract and selection inventory', async () => {
    const { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } = phaseAFs;
    const { spawnSync } = phaseAChildProcess;
    const { ASSET_PATHS, CLI, CONTRACT_ROOT, EXPECTED_FINAL_PATHS, LIBRARY, PHASE_A_OBJECT_HASHES, assertAssets, assertFinalInventory, assertPhaseAFinalBytes, assertPublicationOperations, assertSentinels, captureProtectedAreas, disposeSandbox, expectRange, filesUnder, jcs, makeSandbox, recordingFileSystem, sha: phaseASha, statMap, tempFiles } = createPhaseAOracle();
    const sha = phaseASha;
        // Keep the pre-implementation Red an assertion failure. Do not import a
        // missing module or spawn the missing CLI before this contract exists.
        expect({ library: existsSync(LIBRARY), cli: existsSync(CLI) }).toEqual({ library: true, cli: true });

        expect(assertAssets()).toEqual({ assetCount: 30, schemaCount: 23, finalCount: 35 });
        expect(ASSET_PATHS).toHaveLength(30);
        expect(EXPECTED_FINAL_PATHS).toHaveLength(35);
        expect(existsSync(CONTRACT_ROOT)).toBe(true);

        const phase = await import(/* @vite-ignore */ new URL('./morphology-pilot-freeze.mjs', import.meta.url).href) as {
          freezeMorphologyPilotPhaseA: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
          createPhaseAFileSystemAdapter: () => Record<string, (...args: any[]) => any>;
        };
        expect(typeof phase.freezeMorphologyPilotPhaseA).toBe('function');
        expect(typeof phase.createPhaseAFileSystemAdapter).toBe('function');
        // The production-free builder must not use a prior pilot answer as an oracle.
        for (const source of [readFileSync(LIBRARY, 'utf8'), readFileSync(CLI, 'utf8')]) {
          expect(source).not.toMatch(/(?:pilot-oracle|pilot-images|pilot-real-selection-cases)\.mjs/);
          expect(source).not.toMatch(/(?:--fault|PILOT_.*(?:FAULT|FILESYSTEM)|process\.env\s*\[?.*(?:FAULT|FILESYSTEM))/i);
        }

        const sandbox = makeSandbox();
        try {
          const baseFilesystem: any = phase.createPhaseAFileSystemAdapter();
          const recorded=recordingFileSystem(baseFilesystem, sandbox.work);
          const filesystem: any=recorded.filesystem;
          const input = { pilotWorkRoot:sandbox.work, repositoryRoot:sandbox.repository, workspaceRoot:sandbox.workspace, locatorInventoryPath:sandbox.locatorInventoryPath, draftAPath:sandbox.draftAPath, draftBPath:sandbox.draftBPath, filesystem };
          const created = await phase.freezeMorphologyPilotPhaseA(input);
          expect(created).toMatchObject({ status:'created', ownedFinalCount:35, protocolObjectSha256:PHASE_A_OBJECT_HASHES.protocol, candidateSetObjectSha256:PHASE_A_OBJECT_HASHES.candidate, proxyInputObjectSha256:PHASE_A_OBJECT_HASHES.proxy, selectionPlanObjectSha256:PHASE_A_OBJECT_HASHES.plan });
          const finalOracle=assertPhaseAFinalBytes(sandbox.work); assertSentinels(sandbox);
          expect(created).toMatchObject({ inventoryFileSha256:finalOracle.inventoryFileSha256 });
          // Every public final is published by wx temp -> file flush/close -> reread
          // verification -> exclusive link -> parent sync -> temp unlink -> parent sync.
          assertPublicationOperations(recorded.operations, EXPECTED_FINAL_PATHS);

          const before = statMap(sandbox.work);
          recorded.operations.length=0;
          const unchanged = await phase.freezeMorphologyPilotPhaseA(input);
          expect(unchanged).toMatchObject({ status:'unchanged', ownedFinalCount:35 });
          expect(statMap(sandbox.work)).toEqual(before);
          expect(recorded.operations.filter((operation:any) => /(?:write|link|unlink)/i.test(operation.operation))).toEqual([]);

          // A partial tree without an inventory resumes only when every retained final has exact bytes.
          const partial = makeSandbox();
          try {
            const partialInput = { ...input, pilotWorkRoot:partial.work, repositoryRoot:partial.repository, workspaceRoot:partial.workspace, locatorInventoryPath:partial.locatorInventoryPath, draftAPath:partial.draftAPath, draftBPath:partial.draftBPath };
            const partialFirst = await phase.freezeMorphologyPilotPhaseA(partialInput);
            expect(partialFirst.status).toBe('created');
            const retained=statMap(partial.work);
            filesystem.unlink(resolve(partial.work, 'frozen/protocol/phase-a-hash-inventory.json'));
            // Resume is not allowed to merely recreate the completion marker: it
            // must regenerate exactly the normal final that is absent.
            filesystem.unlink(resolve(partial.work, 'frozen/prompts/adjudicator-template.md'));
            const partialRecorded=recordingFileSystem(baseFilesystem, partial.work);
            expect((await phase.freezeMorphologyPilotPhaseA({ ...partialInput, filesystem:partialRecorded.filesystem })).status).toBe('resumed');
            const resumedPaths=new Set(partialRecorded.operations.filter((row:any) => /link/i.test(row.operation)).map((row:any) => row.related));
            expect(resumedPaths).toEqual(new Set(['frozen/prompts/adjudicator-template.md','frozen/protocol/phase-a-hash-inventory.json']));
            for (const [path, saved] of Object.entries(retained)) if (!resumedPaths.has(path)) expect(statMap(partial.work)[path]).toEqual(saved);
            assertPhaseAFinalBytes(partial.work); assertSentinels(partial);
          } finally { disposeSandbox(partial); }

          const reject = async (target: any, options: Record<string, unknown>, reason:string, field:string) => {
            let caught: unknown; try { await phase.freezeMorphologyPilotPhaseA(options); } catch (error) { caught=error; }
            expectRange(caught, reason, field); assertSentinels(target);
          };
          // Before the completion marker exists, a mismatched owned final is a
          // final conflict.  It is deliberately distinct from a completed but
          // broken inventory, which is an incomplete publication.
          const conflictBeforeInventory = makeSandbox();
          try {
            mkdirSync(resolve(conflictBeforeInventory.work, 'restricted/selection'), { recursive:true });
            writeFileSync(resolve(conflictBeforeInventory.work, 'restricted/selection/candidate-set.json'), 'x', { flag:'wx' });
            await reject(conflictBeforeInventory, { ...input, pilotWorkRoot:conflictBeforeInventory.work, repositoryRoot:conflictBeforeInventory.repository, workspaceRoot:conflictBeforeInventory.workspace, locatorInventoryPath:conflictBeforeInventory.locatorInventoryPath, draftAPath:conflictBeforeInventory.draftAPath, draftBPath:conflictBeforeInventory.draftBPath }, 'phase-a-final-conflict', 'restricted/selection/candidate-set.json');
          } finally { disposeSandbox(conflictBeforeInventory); }
          await reject(sandbox, { ...input, pilotWorkRoot:sandbox.repository }, 'phase-a-root-invalid', 'pilotWorkRoot');

          const incomplete = makeSandbox();
          try {
            const incompleteInput = { ...input, pilotWorkRoot:incomplete.work, repositoryRoot:incomplete.repository, workspaceRoot:incomplete.workspace, locatorInventoryPath:incomplete.locatorInventoryPath, draftAPath:incomplete.draftAPath, draftBPath:incomplete.draftBPath };
            await phase.freezeMorphologyPilotPhaseA(incompleteInput);
            unlinkSync(resolve(incomplete.work, 'frozen/prompts/annotator-template.md'));
            await reject(incomplete, incompleteInput, 'phase-a-incomplete', 'frozen/prompts/annotator-template.md');
          } finally { disposeSandbox(incomplete); }

          const incompleteMismatch = makeSandbox();
          try {
            const mismatchInput = { ...input, pilotWorkRoot:incompleteMismatch.work, repositoryRoot:incompleteMismatch.repository, workspaceRoot:incompleteMismatch.workspace, locatorInventoryPath:incompleteMismatch.locatorInventoryPath, draftAPath:incompleteMismatch.draftAPath, draftBPath:incompleteMismatch.draftBPath };
            await phase.freezeMorphologyPilotPhaseA(mismatchInput);
            writeFileSync(resolve(incompleteMismatch.work, 'restricted/selection/candidate-set.json'), 'x', { flag:'w' });
            await reject(incompleteMismatch, mismatchInput, 'phase-a-incomplete', 'restricted/selection/candidate-set.json');
          } finally { disposeSandbox(incompleteMismatch); }

          for (const [, mutateInventory] of [
            ['extra-entry', (inventory:any) => ({ ...inventory, entries:[...inventory.entries, { relativePath:'frozen/extra.txt', contentKind:'exact-text', byteLength:1, fileSha256:'0'.repeat(64), objectSha256:null }] })],
            ['entry-order', (inventory:any) => ({ ...inventory, entries:[...inventory.entries].reverse() })],
          ] as const) {
            const inventoryBroken = makeSandbox();
            try {
              const inventoryInput = { ...input, pilotWorkRoot:inventoryBroken.work, repositoryRoot:inventoryBroken.repository, workspaceRoot:inventoryBroken.workspace, locatorInventoryPath:inventoryBroken.locatorInventoryPath, draftAPath:inventoryBroken.draftAPath, draftBPath:inventoryBroken.draftBPath };
              await phase.freezeMorphologyPilotPhaseA(inventoryInput);
              const inventoryPath=resolve(inventoryBroken.work, 'frozen/protocol/phase-a-hash-inventory.json');
              const inventory=JSON.parse(readFileSync(inventoryPath, 'utf8'));
              writeFileSync(inventoryPath, `${jcs(mutateInventory(inventory))}\n`, { flag:'w' });
              await reject(inventoryBroken, inventoryInput, 'phase-a-incomplete', 'frozen/protocol/phase-a-hash-inventory.json');
            } finally { disposeSandbox(inventoryBroken); }
          }

          // An orphan is operator-visible evidence. It is never silently removed or resumed.
          const orphan = makeSandbox();
          try {
            mkdirSync(resolve(orphan.work, 'frozen/schema'), { recursive:true });
            writeFileSync(resolve(orphan.work, 'frozen/schema/.protocol-object.schema.json.phase-a.tmp'), 'orphan\n', { flag:'wx' });
            await reject(orphan, { ...input, pilotWorkRoot:orphan.work, repositoryRoot:orphan.repository, workspaceRoot:orphan.workspace, locatorInventoryPath:orphan.locatorInventoryPath, draftAPath:orphan.draftAPath, draftBPath:orphan.draftBPath }, 'phase-a-temp-present', 'frozen/schema/.protocol-object.schema.json.phase-a.tmp');
          } finally { disposeSandbox(orphan); }

          const conflictingAdapter = { ...filesystem, link: (..._args:any[]) => { const error=Object.assign(new Error('exists'), { code:'EEXIST' }); throw error; } };
          const conflict = makeSandbox();
          try { await reject(conflict, { ...input, pilotWorkRoot:conflict.work, repositoryRoot:conflict.repository, workspaceRoot:conflict.workspace, locatorInventoryPath:conflict.locatorInventoryPath, draftAPath:conflict.draftAPath, draftBPath:conflict.draftBPath, filesystem:conflictingAdapter }, 'phase-a-write-conflict', 'frozen/'); expect(existsSync(conflict.work)?filesUnder(conflict.work):[]).toEqual([]); }
          finally { disposeSandbox(conflict); }

          const tempCollision = makeSandbox();
          try {
            const wxAdapter = { ...filesystem, writeFile: (...args:any[]) => { void args; const error=Object.assign(new Error('temp exists'), { code:'EEXIST' }); throw error; } };
            await reject(tempCollision, { ...input, pilotWorkRoot:tempCollision.work, repositoryRoot:tempCollision.repository, workspaceRoot:tempCollision.workspace, locatorInventoryPath:tempCollision.locatorInventoryPath, draftAPath:tempCollision.draftAPath, draftBPath:tempCollision.draftBPath, filesystem:wxAdapter }, 'phase-a-write-conflict', 'frozen/');
          } finally { disposeSandbox(tempCollision); }

          const hardlinkUnsupported = { ...filesystem, link: (..._args:any[]) => { const error=Object.assign(new Error('unsupported'), { code:'EPERM' }); throw error; } };
          const noLink = makeSandbox();
          try { await reject(noLink, { ...input, pilotWorkRoot:noLink.work, repositoryRoot:noLink.repository, workspaceRoot:noLink.workspace, locatorInventoryPath:noLink.locatorInventoryPath, draftAPath:noLink.draftAPath, draftBPath:noLink.draftBPath, filesystem:hardlinkUnsupported }, 'phase-a-hardlink-unsupported', 'frozen/'); expect(existsSync(noLink.work)?filesUnder(noLink.work):[]).toEqual([]); }
          finally { disposeSandbox(noLink); }

          // This injected resolver is mandatory even where creating a Windows junction/symlink is unavailable.
          const redirected = makeSandbox();
          try {
            await reject(redirected, { ...input, pilotWorkRoot:redirected.work, repositoryRoot:redirected.repository, workspaceRoot:redirected.workspace, locatorInventoryPath:redirected.locatorInventoryPath, draftAPath:redirected.draftAPath, draftBPath:redirected.draftBPath, canonicalize: (path:string) => path === redirected.work ? redirected.repository : path }, 'phase-a-root-invalid', 'pilotWorkRoot');
          } finally { disposeSandbox(redirected); }

          // Try the native Windows junction/symlink path as well.  A platform that
          // forbids it records the capability code, but must still pass the injected
          // resolver case above.
          const reparse = makeSandbox();
          try {
            const linked=resolve(reparse.root, 'repository-link');
            let capability:{kind:string,code:string|null};
            try { symlinkSync(reparse.repository, linked, 'junction'); capability={kind:'junction',code:null}; }
            catch (error:any) { capability={kind:'unavailable',code:String(error?.code ?? error?.name ?? 'unknown')}; }
            expect(['junction','unavailable']).toContain(capability.kind);
            if (capability.kind==='unavailable') expect(capability.code).toMatch(/\S/);
            else await reject(reparse, { ...input, pilotWorkRoot:linked, repositoryRoot:reparse.repository, workspaceRoot:reparse.workspace, locatorInventoryPath:reparse.locatorInventoryPath, draftAPath:reparse.draftAPath, draftBPath:reparse.draftBPath }, 'phase-a-root-invalid', 'pilotWorkRoot');
          } finally { disposeSandbox(reparse); }

          // Resolver checks are repeated: a target that becomes inside the repository
          // during publication is as unsafe as one that starts there.
          const replaced = makeSandbox();
          try {
            let canonicalizeCalls = 0;
            await reject(replaced, { ...input, pilotWorkRoot:replaced.work, repositoryRoot:replaced.repository, workspaceRoot:replaced.workspace, locatorInventoryPath:replaced.locatorInventoryPath, draftAPath:replaced.draftAPath, draftBPath:replaced.draftBPath, canonicalize: (path:string) => {
              canonicalizeCalls += 1;
              return canonicalizeCalls > 8 && path.includes('frozen') ? replaced.repository : path;
            } }, 'phase-a-root-invalid', 'pilotWorkRoot');
            expect(canonicalizeCalls).toBeGreaterThan(8);
          } finally { disposeSandbox(replaced); }

          const rawMutation = makeSandbox();
          try {
            filesystem.writeFile(rawMutation.draftAPath, Buffer.from('{}\n'));
        // This negative fixture intentionally changes raw input.  Its immutable
        // baseline starts after that setup mutation, not before it.
        (rawMutation as any).protectedAreas = captureProtectedAreas(rawMutation);
            await reject(rawMutation, { ...input, pilotWorkRoot:rawMutation.work, repositoryRoot:rawMutation.repository, workspaceRoot:rawMutation.workspace, locatorInventoryPath:rawMutation.locatorInventoryPath, draftAPath:rawMutation.draftAPath, draftBPath:rawMutation.draftBPath }, 'phase-a-input-invalid', 'draftAPath');
          } finally { disposeSandbox(rawMutation); }

          const assetMutation = makeSandbox();
          try {
            const mutatingReadAdapter = { ...filesystem, readFile: (path:string, ...args:any[]) => path.endsWith('annotator-template.md') ? Buffer.from('mutated asset\n') : filesystem.readFile(path, ...args) };
            await reject(assetMutation, { ...input, pilotWorkRoot:assetMutation.work, repositoryRoot:assetMutation.repository, workspaceRoot:assetMutation.workspace, locatorInventoryPath:assetMutation.locatorInventoryPath, draftAPath:assetMutation.draftAPath, draftBPath:assetMutation.draftBPath, filesystem:mutatingReadAdapter }, 'phase-a-input-invalid', 'prompts/annotator-template.md');
          } finally { disposeSandbox(assetMutation); }

          // The contract is a closed set: absence and addition are both input
          // corruption, and neither may create even a partial external tree.
          const missingAsset = makeSandbox();
          try {
            const missingAdapter = { ...filesystem, readFile: (path:string, ...args:any[]) => path.endsWith('adjudicator-template.md') ? (() => { const error:any=new Error('missing'); error.code='ENOENT'; throw error; })() : filesystem.readFile(path, ...args) };
            await reject(missingAsset, { ...input, pilotWorkRoot:missingAsset.work, repositoryRoot:missingAsset.repository, workspaceRoot:missingAsset.workspace, locatorInventoryPath:missingAsset.locatorInventoryPath, draftAPath:missingAsset.draftAPath, draftBPath:missingAsset.draftBPath, filesystem:missingAdapter }, 'phase-a-input-invalid', 'prompts/adjudicator-template.md');
            expect(existsSync(missingAsset.work) ? filesUnder(missingAsset.work) : []).toEqual([]);
          } finally { disposeSandbox(missingAsset); }
          const extraAsset = makeSandbox();
          try {
            const extraAdapter = { ...filesystem, readdir: (path:string, ...args:any[]) => {
              const rows:any=filesystem.readdir(path, ...args);
              return String(path).replace(/\\/g,'/').endsWith('/morphology-pilot-contract-v1') ? [...rows, 'unexpected-contract-file.txt'] : rows;
            }};
            await reject(extraAsset, { ...input, pilotWorkRoot:extraAsset.work, repositoryRoot:extraAsset.repository, workspaceRoot:extraAsset.workspace, locatorInventoryPath:extraAsset.locatorInventoryPath, draftAPath:extraAsset.draftAPath, draftBPath:extraAsset.draftBPath, filesystem:extraAdapter }, 'phase-a-input-invalid', 'contract');
            expect(existsSync(extraAsset.work) ? filesUnder(extraAsset.work) : []).toEqual([]);
          } finally { disposeSandbox(extraAsset); }

          // Fault callbacks are an internal library-only injection: the CLI must have
          // no matching option or environment variable. A post-link crash leaves an
          // operator-visible orphan, and only explicit cleanup enables resume.
          const fault = makeSandbox();
          try {
            const faultInput = { ...input, pilotWorkRoot:fault.work, repositoryRoot:fault.repository, workspaceRoot:fault.workspace, locatorInventoryPath:fault.locatorInventoryPath, draftAPath:fault.draftAPath, draftBPath:fault.draftBPath, faults:{ afterLink: () => { throw new Error('test-after-link'); } } };
            await expect(phase.freezeMorphologyPilotPhaseA(faultInput)).rejects.toThrow('test-after-link');
            assertSentinels(fault);
            expect(tempFiles(fault.work)).not.toEqual([]);
            await reject(fault, { ...faultInput, faults:undefined }, 'phase-a-temp-present', 'frozen/');
            for (const path of tempFiles(fault.work)) rmSync(resolve(fault.work, path));
            expect((await phase.freezeMorphologyPilotPhaseA({ ...faultInput, faults:undefined })).status).toBe('resumed');
            assertFinalInventory(fault.work); assertSentinels(fault);
          } finally { disposeSandbox(fault); }

          const writeFault = makeSandbox();
          try {
            const writeFaultInput = { ...input, pilotWorkRoot:writeFault.work, repositoryRoot:writeFault.repository, workspaceRoot:writeFault.workspace, locatorInventoryPath:writeFault.locatorInventoryPath, draftAPath:writeFault.draftAPath, draftBPath:writeFault.draftBPath, faults:{ afterTempWrite: () => { throw new Error('test-after-temp-write'); } } };
            await expect(phase.freezeMorphologyPilotPhaseA(writeFaultInput)).rejects.toThrow('test-after-temp-write');
            assertSentinels(writeFault);
            expect(tempFiles(writeFault.work)).not.toEqual([]);
            expect(filesUnder(writeFault.work).filter((path:string) => !/\.phase-a\.tmp$/.test(path))).toEqual([]);
            await reject(writeFault, { ...writeFaultInput, faults:undefined }, 'phase-a-temp-present', 'frozen/');
          } finally { disposeSandbox(writeFault); }

          // The close -> reread boundary is a verification boundary, not a hint.
          // Mutate the *closed* temp file without throwing so that the SUT's
          // own separate reread detects the corruption before publication.
          const rereadFault = makeSandbox();
          try {
            const rereadInput = { ...input, pilotWorkRoot:rereadFault.work, repositoryRoot:rereadFault.repository, workspaceRoot:rereadFault.workspace, locatorInventoryPath:rereadFault.locatorInventoryPath, draftAPath:rereadFault.draftAPath, draftBPath:rereadFault.draftBPath, faults:{ afterCloseBeforeReread: (context:any) => {
              const tempPath = typeof context === 'string' ? context : context?.tempPath;
              expect(typeof tempPath).toBe('string');
              writeFileSync(tempPath, Buffer.from('corrupted-after-close\\n'), { flag:'w' });
            } } };
            await reject(rereadFault, rereadInput, 'phase-a-temp-invalid', '.phase-a.tmp');
            expect(filesUnder(rereadFault.work).filter((path:string) => !/\.phase-a\.tmp$/.test(path))).toEqual([]);
            const corruptedTemp = tempFiles(rereadFault.work);
            expect(corruptedTemp).toHaveLength(1);
            await reject(rereadFault, { ...rereadInput, faults:undefined }, 'phase-a-temp-present', corruptedTemp[0]!);
          } finally { disposeSandbox(rereadFault); }

          // A crash after unlink has a fully published final and no temp file; it
          // is therefore a normal final-only resume, not an orphan repair.
          const finalOnly = makeSandbox();
          try {
            const finalOnlyInput = { ...input, pilotWorkRoot:finalOnly.work, repositoryRoot:finalOnly.repository, workspaceRoot:finalOnly.workspace, locatorInventoryPath:finalOnly.locatorInventoryPath, draftAPath:finalOnly.draftAPath, draftBPath:finalOnly.draftBPath, faults:{ afterTempUnlink: () => { throw new Error('test-after-temp-unlink'); } } };
            await expect(phase.freezeMorphologyPilotPhaseA(finalOnlyInput)).rejects.toThrow('test-after-temp-unlink');
            assertSentinels(finalOnly);
            expect(tempFiles(finalOnly.work)).toEqual([]);
            expect((await phase.freezeMorphologyPilotPhaseA({ ...finalOnlyInput, faults:undefined })).status).toBe('resumed');
            assertFinalInventory(finalOnly.work); assertSentinels(finalOnly);
          } finally { disposeSandbox(finalOnly); }

          // Directory durability has a narrow, explicit portability exception.
          // Known unsupported errors continue; every other directory-sync failure
          // is fail-closed and may not leave a final outside the controlled root.
          const dirSyncUnsupported = makeSandbox();
          try {
            const unsupported:any = { ...filesystem, syncDirectory: () => { const error:any=new Error('unsupported directory fsync'); error.code='EINVAL'; throw error; } };
            await expect(phase.freezeMorphologyPilotPhaseA({ ...input, pilotWorkRoot:dirSyncUnsupported.work, repositoryRoot:dirSyncUnsupported.repository, workspaceRoot:dirSyncUnsupported.workspace, locatorInventoryPath:dirSyncUnsupported.locatorInventoryPath, draftAPath:dirSyncUnsupported.draftAPath, draftBPath:dirSyncUnsupported.draftBPath, filesystem:unsupported })).resolves.toMatchObject({ status:'created' });
            assertFinalInventory(dirSyncUnsupported.work); assertSentinels(dirSyncUnsupported);
          } finally { disposeSandbox(dirSyncUnsupported); }
          const dirSyncUnknown = makeSandbox();
          try {
            const unknown:any = { ...filesystem, syncDirectory: () => { const error:any=new Error('unexpected directory fsync'); error.code='EIO'; throw error; } };
            await reject(dirSyncUnknown, { ...input, pilotWorkRoot:dirSyncUnknown.work, repositoryRoot:dirSyncUnknown.repository, workspaceRoot:dirSyncUnknown.workspace, locatorInventoryPath:dirSyncUnknown.locatorInventoryPath, draftAPath:dirSyncUnknown.draftAPath, draftBPath:dirSyncUnknown.draftBPath, filesystem:unknown }, 'phase-a-directory-sync-failed', 'frozen/');
            assertSentinels(dirSyncUnknown);
          } finally { disposeSandbox(dirSyncUnknown); }

          // This tree snapshot deliberately includes directories (including
          // empty ones) and exact file bytes.  It protects the only two Phase A
          // output prefixes when a CLI request tries to use the real repository.
          const exactTree = (root:string) => {
            const visit = (directory:string, prefix:string): any[] => (phaseAFs.readdirSync(directory, { withFileTypes:true }) as any[])
              .sort((left:any, right:any) => String(left.name).localeCompare(String(right.name)))
              .flatMap((entry:any) => {
                const relativePath=prefix ? `${prefix}/${entry.name}` : String(entry.name);
                const absolutePath=resolve(directory, entry.name);
                if (entry.isDirectory()) return [{ relativePath, entryType:'directory' }, ...visit(absolutePath, relativePath)];
                if (entry.isFile()) {
                  const bytes=Buffer.from(readFileSync(absolutePath));
                  return [{ relativePath, entryType:'file', byteLength:bytes.length, sha256:sha(bytes), bytes }];
                }
                return [{ relativePath, entryType:entry.isSymbolicLink() ? 'symlink' : 'other' }];
              });
            return visit(root, '');
          };
          const phaseAOutputSnapshot = (root:string) => Object.fromEntries(['frozen','restricted'].map(relativePath => {
            const absolutePath=resolve(root, relativePath);
            let entry:any;
            try { entry=phaseAFs.lstatSync(absolutePath); }
            catch (error:any) { if (error?.code === 'ENOENT') return [relativePath, { entryType:'missing' }]; throw error; }
            if (entry.isDirectory()) return [relativePath, { entryType:'directory', tree:exactTree(absolutePath) }];
            if (entry.isFile()) {
              const bytes=Buffer.from(readFileSync(absolutePath));
              return [relativePath, { entryType:'file', byteLength:bytes.length, sha256:sha(bytes), bytes }];
            }
            if (entry.isSymbolicLink()) return [relativePath, { entryType:'symlink', target:phaseAFs.readlinkSync(absolutePath, 'utf8') }];
            const entryType=entry.isBlockDevice?.() ? 'block-device' : entry.isCharacterDevice?.() ? 'character-device' : entry.isFIFO?.() ? 'fifo' : entry.isSocket?.() ? 'socket' : 'other';
            return [relativePath, { entryType }];
          }));

          const cli = spawnSync(process.execPath, [CLI, '--work-root', resolve(sandbox.root, 'cli'), '--locator-inventory', sandbox.locatorInventoryPath, '--draft-a', sandbox.draftAPath, '--draft-b', sandbox.draftBPath], { encoding:'utf8' });
          expect(cli.status).toBe(0); expect(cli.stderr).toBe('');
      assertSentinels(sandbox);
          expect(cli.stdout.endsWith('\n')).toBe(true); expect(cli.stdout.includes('\r\n')).toBe(false);
          const summary=JSON.parse(cli.stdout); expect(Object.keys(summary).sort()).toEqual(['candidateSetObjectSha256','inventoryFileSha256','ownedFinalCount','protocolObjectSha256','proxyInputObjectSha256','schemaVersion','selectionPlanObjectSha256','status']);
          expect(summary).toEqual({ schemaVersion:'snow-crystal-morphology-pilot-phase-a-result/1', status:'created', ownedFinalCount:35, protocolObjectSha256:PHASE_A_OBJECT_HASHES.protocol, candidateSetObjectSha256:PHASE_A_OBJECT_HASHES.candidate, proxyInputObjectSha256:PHASE_A_OBJECT_HASHES.proxy, selectionPlanObjectSha256:PHASE_A_OBJECT_HASHES.plan, inventoryFileSha256:sha(readFileSync(resolve(sandbox.root, 'cli/frozen/protocol/phase-a-hash-inventory.json'))) });
          expect(cli.stdout).toBe(`${jcs(summary)}\n`);
          const cliUnchanged=spawnSync(process.execPath, [CLI, '--work-root', resolve(sandbox.root, 'cli'), '--locator-inventory', sandbox.locatorInventoryPath, '--draft-a', sandbox.draftAPath, '--draft-b', sandbox.draftBPath], { encoding:'utf8' });
          expect(cliUnchanged.status).toBe(0); expect(cliUnchanged.stderr).toBe('');
      assertSentinels(sandbox);
          const unchangedSummary=JSON.parse(cliUnchanged.stdout);
          expect(Object.keys(unchangedSummary).sort()).toEqual(Object.keys(summary).sort());
          expect(unchangedSummary).toEqual({ ...summary, status:'unchanged' });
          expect(cliUnchanged.stdout).toBe(`${jcs(unchangedSummary)}\n`);
          // The CLI itself derives its protected repository root from its module
          // location.  A synthetic sibling directory is a legitimate shared
          // PILOT_WORK_ROOT, even if it has unrelated files, so exercise the
          // actual protected boundary rather than inventing a sentinel rule.
          const cliRepositoryRoot=phaseAPath.resolve(phaseAPath.dirname(CLI), '../../../../');
          const protectedBefore=repositorySnapshot();
          const protectedPhaseAOutputsBefore=phaseAOutputSnapshot(cliRepositoryRoot);
          const cliInvalid=spawnSync(process.execPath, [CLI, '--work-root', cliRepositoryRoot, '--locator-inventory', sandbox.locatorInventoryPath, '--draft-a', sandbox.draftAPath, '--draft-b', sandbox.draftBPath], { encoding:'utf8' });
          expect(cliInvalid.status).not.toBe(0); expect(cliInvalid.stderr).toMatch(/phase-a-root-invalid/); expect(cliInvalid.stderr).not.toContain(cliRepositoryRoot);
          expect(repositorySnapshot()).toEqual(protectedBefore);
          expect(phaseAOutputSnapshot(cliRepositoryRoot)).toEqual(protectedPhaseAOutputsBefore);
      assertSentinels(sandbox);
          const requiredOptions = ['--work-root','--locator-inventory','--draft-a','--draft-b'] as const;
          const invalidRoots = new Set<string>();
          const emptyWorkRootCwd=resolve(sandbox.root, 'invalid-empty-work-root-cwd');
          mkdirSync(emptyWorkRootCwd, { recursive:true });
          const baseCli = (workRoot:string) => ['--work-root', workRoot, '--locator-inventory', sandbox.locatorInventoryPath, '--draft-a', sandbox.draftAPath, '--draft-b', sandbox.draftBPath];
          const cliInvalidCases: Array<{ argv:string[]; field:string; roots:string[]; cwd?:string }> = [
            // Resolve a relative root only inside this isolated cwd, then track
            // that resolved absent target explicitly.
            { argv:['--work-root', 'relative-root', '--locator-inventory', sandbox.locatorInventoryPath, '--draft-a', sandbox.draftAPath, '--draft-b', sandbox.draftBPath], field:'--work-root', roots:[resolve(sandbox.root, 'relative-root')], cwd:sandbox.root },
            { argv:['--unknown-option', 'x', ...baseCli(resolve(sandbox.root, 'unknown-option'))], field:'--unknown-option', roots:[resolve(sandbox.root, 'unknown-option')] },
          ];
          for (const option of requiredOptions) {
            const missingRoot=resolve(sandbox.root, `invalid-missing-${option.slice(2)}`), missing=baseCli(missingRoot), missingIndex=missing.indexOf(option);
            missing.splice(missingIndex, 2);
            cliInvalidCases.push({ argv:missing, field:option, roots:[missingRoot] });
            const duplicateRoot=resolve(sandbox.root, `invalid-duplicate-${option.slice(2)}`), duplicate=baseCli(duplicateRoot), duplicateValue=option === '--work-root' ? resolve(sandbox.root, `invalid-duplicate-value-${option.slice(2)}`) : `${option.slice(2)}-duplicate`;
            duplicate.push(option, duplicateValue);
            cliInvalidCases.push({ argv:duplicate, field:option, roots:option === '--work-root' ? [duplicateRoot, duplicateValue] : [duplicateRoot] });
            const emptyRoot=resolve(sandbox.root, `invalid-empty-${option.slice(2)}`), empty=baseCli(emptyRoot), emptyIndex=empty.indexOf(option);
            empty[emptyIndex + 1] = '';
            cliInvalidCases.push({ argv:empty, field:option, roots:option === '--work-root' ? [] : [emptyRoot], ...(option === '--work-root' ? { cwd:emptyWorkRootCwd } : {}) });
          }
          for (const { argv, field, roots, cwd } of cliInvalidCases) {
            for (const root of roots) invalidRoots.add(root);
            const absentBefore=roots.filter(root => !existsSync(root));
            const existingBefore=Object.fromEntries(roots.filter(root => existsSync(root)).map(root => [root, filesUnder(root)]));
            const cwdBefore=cwd ? exactTree(cwd) : null;
            const invalid = spawnSync(process.execPath, [CLI, ...argv], { encoding:'utf8', ...(cwd ? { cwd } : {}) });
            expect(invalid.status).not.toBe(0); expect(invalid.stderr).toMatch(/phase-a-cli-invalid/); expect(invalid.stderr).toContain(field); expect(invalid.stderr).not.toContain(sandbox.root); expect(invalid.stderr).not.toMatch(/(?:stack|at\s+\w+\s*\()/i);
            assertSentinels(sandbox);
            for (const root of absentBefore) expect(existsSync(root), `pre-write rejection must not create ${root}`).toBe(false);
            for (const [root, files] of Object.entries(existingBefore)) expect(filesUnder(root)).toEqual(files);
            if (cwd) expect(exactTree(cwd)).toEqual(cwdBefore);
            for (const root of invalidRoots) if (existsSync(root)) expect(filesUnder(root)).toEqual([]);
          }
        } finally { disposeSandbox(sandbox); }
  }, 120_000);


  it('TC-PILOT-RED-001 sole expected Red: D-25 coordinated old-graph inventory omission must be rejected', async () => {
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
      // D-25 isolates graph completeness: the complete byte-identical baseline
      // accepts before the exact coordinated omission must fail. This first
      // semantic probe keeps the new Red deterministic, ahead of shuffle.
      const omissionProbe = (cases as FixtureCase[]).find(c => c.label === 'd25/coordinated-campaign-evidence');
      expect(omissionProbe).toBeDefined();
      for (const baseline of new Set(completenessRows.map(row => row.baseline))) {
        await runOne({ caseName: 'plan-reissue', fixture: baseline, expected: true, label: 'd25/complete-old-graph' });
      }
      await runOne(omissionProbe!);
      // Retain the earlier D-24 protocol-authority regression.
      // All 18 D-24 cases remain in the guarded randomized registry afterward.
      const protocolProbe = (cases as FixtureCase[]).find(c => c.label === 'd24/selection/absent-protocol');
      expect(protocolProbe).toBeDefined();
      await runOne(protocolProbe!);
      // Retain the D-23 deterministic PDF-authority regression as well.
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

// Phase A's independent oracle is deliberately test-local; production has no import path to it.
const createPhaseAOracle = () => {
  const { createHash } = phaseACrypto;
  const { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } = phaseAFs;
  const { relative, resolve, sep } = phaseAPath;
  const tmpdir = phaseATmpdir;
  const fileURLToPath = phaseAFileURLToPath;
  const assert = phaseAAssert;

  const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
  const CONTRACT_ROOT = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration/fixtures/morphology-pilot-contract-v1');
  const LIBRARY = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration/morphology-pilot-freeze.mjs');
  const CLI = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration/prepare-morphology-pilot.mjs');
  const REAL_INPUT_ROOT = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration/fixtures/real-pilot-selection-206');
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const sha = value => createHash('sha256').update(value).digest('hex');
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const jcs = value => {
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') { assert(Number.isFinite(value) && !Object.is(value, -0)); return JSON.stringify(value); }
    if (typeof value === 'string') { assert.equal(value.normalize('NFC'), value); return JSON.stringify(value); }
    if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
    assert(value && typeof value === 'object');
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    return `{${Object.keys(value).sort().map(key => `${jcs(key)}:${jcs(value[key])}`).join(',')}}`;
  };
  // JSON.parse silently accepts {"x":1,"x":2}; production input must never
  // get that ambiguity.  This small scanner is deliberately independent of the
  // builder and walks enough JSON grammar to reject duplicates before JSON.parse.
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const parseUniqueJson = (bytes, label = 'json') => {
    const text = Buffer.isBuffer(bytes) ? bytes.toString('utf8') : String(bytes);
    let i = 0;
    const white = () => { while (/\s/.test(text[i] ?? '')) i += 1; };
    const string = () => {
      assert.equal(text[i], '"', `${label}: JSON string`); const start = i++;
      while (i < text.length) { const c = text[i++]; if (c === '\\') { i += 1; continue; } if (c === '"') return text.slice(start, i); }
      assert.fail(`${label}: unterminated JSON string`);
    };
    const scalar = () => { const start = i; while (i < text.length && !/[\s,\]}]/.test(text[i])) i += 1; assert(i > start, `${label}: JSON scalar`); };
    const value = () => {
      white(); const c = text[i];
      if (c === '"') { string(); return; }
      if (c === '[') { i += 1; white(); if (text[i] === ']') { i += 1; return; } while (true) { value(); white(); if (text[i] === ']') { i += 1; return; } assert.equal(text[i++], ',', `${label}: JSON array delimiter`); } }
      if (c === '{') { i += 1; const keys = new Set(); white(); if (text[i] === '}') { i += 1; return; } while (true) { white(); const raw = string(); const key = JSON.parse(raw); assert(!keys.has(key), `${label}: duplicate JSON key ${key}`); keys.add(key); white(); assert.equal(text[i++], ':', `${label}: JSON object delimiter`); value(); white(); if (text[i] === '}') { i += 1; return; } assert.equal(text[i++], ',', `${label}: JSON object separator`); } }
      scalar();
    };
    value(); white(); assert.equal(i, text.length, `${label}: trailing JSON bytes`);
    return JSON.parse(text);
  };
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const assertCanonicalJson = (bytes, label) => {
    const object = parseUniqueJson(bytes, label);
    assert.deepEqual(Buffer.from(bytes), Buffer.from(`${jcs(object)}\n`), `${label}: exact JCS+LF bytes`);
    return object;
  };
  const PHASE_A_OBJECT_HASHES = Object.freeze({
    figure2Projection: '2195316a0480e2b204ccd2e0f41211ccd44b319ac7090fa999ead6e76b792953',
    growthTruth: 'b8f89729365eef88aaba56803627abd3eba8cc63765bc7be8f6f2cf6f0f817d5',
    branchingTruth: '8593fc2ef7078001e256bb951bacd7f5fc121dd71779773f763f7bbf3b6342ea',
    hollowingTruth: '77f8f298bd4ec609b1ad24a43de1317fd9e8c42775692b62697c2d00b252df70',
    consensusTruth: '7794c28359dc2fa7d918a49b2ba4f0cad335d6b54c5d589ca8da95940b7686d7',
    protocol: 'a4e03bf680979cc65ec6389ca89475201a73c77163bf2533845b8ee75be13b68',
    candidate: '2ed0c86bd7484e2fa25117eedfc81116263029f6a76bba7fb137ab72aaf2f716',
    proxy: '3ab6789058efcc435ad90ac17e9d4a34510940a0db6c288eb4159d4d82db35b8',
    plan: 'cc90c71fee3dcae0c19ae55433f145d449d3c4d5860bcf1c1dd0245357b6408a',
  });
  const SCHEMA_BASENAMES = Object.freeze([
    'protocol-object.schema.json','selection-candidate-set.schema.json','selection-proxy-input.schema.json','selection-plan.schema.json','blinded-manifest.schema.json','restricted-map.schema.json','batch-input-table.schema.json','annotation-payload.schema.json','adjudication-payload.schema.json','consensus-routing-truth-table.schema.json','artifact.schema.json','candidate-alias.schema.json','candidate-payload-table.schema.json','annotation-consensus-slot-plan.schema.json','active-annotation-consensus-snapshot.schema.json','supersession-ledger.schema.json','invalid-attempt-evidence.schema.json','rendered-prompt-evidence.schema.json','post-consensus-route-slot-plan.schema.json','active-upstream-snapshot.schema.json','human-approval.schema.json','pilot-coverage.schema.json','plan-closure.schema.json',
  ]);
  const SCHEMA_OBJECT_HASHES = Object.freeze([
    'd9bb04631676938972e56649c00a5d535f577f652d042d61534e7be6f6eee570',
    '71c6977025a67f0d3937c3f1641317be0ab68f932b403959ebd6baaa1150f05f',
    'eec17d7ff8864dd895a052f84bb84770e96364c61a2a0e842c95f9b7ef8dc0a9',
    '93f7273b00476915b42b9d7685e4c7b004df7119a14f4b1898b0c2d4d87d0131',
    'a6148351a2482ffa888461237bc1fca26e013669916227f101eee2635ee41255',
    '1fc183decea30de6606b0d0b79df87f9d2065c6a54341165187c8f4e57299046',
    'd63a1b0838ef8e39465e351d249688efaedf815254eb8300c2284b3e2fc4e0ae',
    'a226ede088e61519d11cbfb20786fa99507d17b9320b393152ce630cf5760824',
    '5181773032a67aa2471242c87a22518f9fb0e1de1fa8ae94974c006b14aceac6',
    '3bc2bef1bc5d407dfdcd0d72b10fc21bfa8703c394a7d7eb84b3b7a76f0129e9',
    '45801c730863d490c1f5a6a23d3b868fed6964e24fa3a30ad9a773a400a49bff',
    '79c6112db03f29fa0906219944b31f0a5e5994909c5a310831d03ac62b797a7a',
    'e36d7dfc247b7865bea9c8034e8d2e2ee94b5e168f6258854dc5ccfef0b71311',
    '9fe4b6876b0704220e2ecbfb894990ef78a06982749ba0f6891c6f3212423e32',
    '7e9f764e8b3dc9c310738e6f4456f32a0fd2271092016c312615be2a22a0fd9c',
    '09d3a83d5c8d7055eb92f1ee2bfba197ac37b361a3f6d4b7788bfc3162cd2ed9',
    '1fc624e7aaa936f9f2e693dad7470b74bd61640b3617840b61e7b9e1c3cdc38c',
    '76683a3339821a03ced03437e419971cfec11b3a93b841bbdd850915350ad9fd',
    '3d1645dad6807ef4c894ffdcd97aa0ac1feae6e0f2ebb1d40e16dcb2317973af',
    '41849e761c8bc117778f08e787f0f1e623726c220667a903ef6abe1d5bfe87ea',
    '987cb3797e623889aabd56a217188e3373bd0f4392135c78be84adda0923a08c',
    '7330206b22dd670906f95cfbdd9219b479f6406eb31e4dc1f408909a8d513ea5',
    '22e8bf3bc1c8ec002bc30a4cf1dc815403f1715c697128019c1c083b71d37e80',
  ]);
  const ASSET_PATHS = Object.freeze([
    ...SCHEMA_BASENAMES.map(name => `schema/${name}`),
    'prompts/annotator-template.md','prompts/adjudicator-template.md',
    'protocol/growth-truth-table.json','protocol/branching-truth-table.json','protocol/hollowing-truth-table.json','protocol/consensus-routing-truth-table.json','protocol/figure2-projection-v1.json',
  ]);
  const EXPECTED_FINAL_PATHS = Object.freeze([
    ...ASSET_PATHS.map(path => `frozen/${path}`),
    'frozen/protocol/morphology-ensemble-pilot-v1.json',
    'restricted/selection/candidate-set.json',
    'restricted/selection/proxy-input.json',
    'restricted/selection/pilot-selection-plan.json',
    'frozen/protocol/phase-a-hash-inventory.json',
  ].sort());
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function filesUnder(root, at = root) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    return readdirSync(at, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(root, resolve(at, entry.name)) : [relative(root, resolve(at, entry.name)).split(sep).join('/')]);
  }
  function assertAssets() {
    assert.deepEqual(filesUnder(CONTRACT_ROOT).sort(), [...ASSET_PATHS].sort());
    const schemaFileHashes=[]; const schemaProperties=[];
    for (const [index, name] of SCHEMA_BASENAMES.entries()) {
      const bytes=readFileSync(resolve(CONTRACT_ROOT, 'schema', name));
      schemaFileHashes.push(sha(bytes)); schemaProperties.push(schemaKey(name));
      assert.equal(sha(jcs(assertCanonicalJson(bytes, `schema/${name}`))), SCHEMA_OBJECT_HASHES[index], `schema object ${name}`);
    }
    assert.equal(new Set(SCHEMA_BASENAMES).size, 23, 'unique schema basenames');
    assert.equal(new Set(schemaProperties).size, 23, 'unique protocol schema properties');
    assert.equal(new Set(schemaFileHashes).size, 23, 'unique schema file hashes');
    assert.equal(new Set(SCHEMA_OBJECT_HASHES).size, 23, 'unique schema object hashes');
    for (const path of ASSET_PATHS) {
      const bytes = readFileSync(resolve(CONTRACT_ROOT, path));
      assert(bytes.length > 0, `empty asset ${path}`);
      assert.equal(bytes.includes(Buffer.from('\r\n')), false, `CRLF ${path}`);
      assert.equal(bytes.at(-1), 10, `LF ${path}`);
      assert.equal(bytes.at(-2) === 10, false, `extra LF ${path}`);
      if (path.endsWith('.json')) assertCanonicalJson(bytes, path);
    }
    assert.equal(readFileSync(resolve(CONTRACT_ROOT, 'prompts/annotator-template.md')).length, 4531);
    assert.equal(sha(readFileSync(resolve(CONTRACT_ROOT, 'prompts/annotator-template.md'))), 'd5d5f557b701e76cb1c71b86c378e59cb44a8ddb81dba33577a248767bb5ed8c');
    assert.equal(readFileSync(resolve(CONTRACT_ROOT, 'prompts/adjudicator-template.md')).length, 3133);
    assert.equal(sha(readFileSync(resolve(CONTRACT_ROOT, 'prompts/adjudicator-template.md'))), '21c13a7dc4a782181dc0df55ac24a17f1840bf457b4196a09894160fc4174a03');
    for (const [path, key] of [
      ['protocol/figure2-projection-v1.json','figure2Projection'], ['protocol/growth-truth-table.json','growthTruth'],
      ['protocol/branching-truth-table.json','branchingTruth'], ['protocol/hollowing-truth-table.json','hollowingTruth'],
      ['protocol/consensus-routing-truth-table.json','consensusTruth'],
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    ]) assert.equal(sha(jcs(assertCanonicalJson(readFileSync(resolve(CONTRACT_ROOT, path)), path))), PHASE_A_OBJECT_HASHES[key]);
    return { assetCount: ASSET_PATHS.length, schemaCount: SCHEMA_BASENAMES.length, finalCount: EXPECTED_FINAL_PATHS.length };
  }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function assertExternal(root, repositoryRoot, workspaceRoot) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const outside = candidate => { const rel = relative(candidate, root); return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !resolve(root).startsWith(`${resolve(candidate)}${sep}`)); };
    assert.equal(outside(repositoryRoot), false, 'repository root must be rejected');
    assert.equal(outside(workspaceRoot), false, 'workspace root must be rejected');
  }

  function makeSandbox() {
    const root=mkdtempSync(resolve(tmpdir(), 'snow-crystal-phase-a-'));
    const input=resolve(root, 'input'); const work=resolve(root, 'pilot'); const repository=resolve(root, 'repository'); const workspace=resolve(root, 'workspace'); const outside=resolve(root, 'outside');
    cpSync(REAL_INPUT_ROOT, input, { recursive:true });
    mkdirSync(repository); mkdirSync(workspace); mkdirSync(outside);
    writeFileSync(resolve(repository, 'sentinel.txt'), 'repository sentinel\n', { flag:'wx' });
    writeFileSync(resolve(workspace, 'sentinel.txt'), 'workspace sentinel\n', { flag:'wx' });
    writeFileSync(resolve(outside, 'SOURCE-AUDIT.json'), '{"source":"sentinel"}\n', { flag:'wx' });
    writeFileSync(resolve(outside, 'approval.json'), '{"approval":"sentinel"}\n', { flag:'wx' });
    writeFileSync(resolve(outside, 'localStorage-export.json'), '{"localStorage":"sentinel"}\n', { flag:'wx' });
    // Preserve both recursive path inventory and exact bytes.  A hash alone
    // is not the oracle: this detects additions, removals, renames and every
    // byte mutation across all protected areas.
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const protectedSnapshot = areaRoot => filesUnder(areaRoot).sort().map(relativePath => {
      const bytes = Buffer.from(readFileSync(resolve(areaRoot, relativePath)));
      return { relativePath, byteLength:bytes.length, sha256:sha(bytes), bytes };
    });
    const sandbox: any = {
      root, input, work, repository, workspace, outside,
      locatorInventoryPath:resolve(input, 'candidate-data.js'), draftAPath:resolve(input, 'draft-a-final.json'), draftBPath:resolve(input, 'draft-b-final.json'),
      sentinels: Object.freeze({ repository:sha(readFileSync(resolve(repository, 'sentinel.txt'))), workspace:sha(readFileSync(resolve(workspace, 'sentinel.txt'))), locator:sha(readFileSync(resolve(input, 'candidate-data.js'))), draftA:sha(readFileSync(resolve(input, 'draft-a-final.json'))), draftB:sha(readFileSync(resolve(input, 'draft-b-final.json'))), sourceAudit:sha(readFileSync(resolve(outside, 'SOURCE-AUDIT.json'))), approval:sha(readFileSync(resolve(outside, 'approval.json'))), localStorage:sha(readFileSync(resolve(outside, 'localStorage-export.json'))) }),
    };
    sandbox.protectedAreas = Object.freeze({ repository:protectedSnapshot(repository), workspace:protectedSnapshot(workspace), rawInput:protectedSnapshot(input), rootOutside:protectedSnapshot(outside) });
    return sandbox;
  }

// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function captureProtectedAreas(sandbox) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const snapshot = areaRoot => filesUnder(areaRoot).sort().map(relativePath => {
      const bytes = Buffer.from(readFileSync(resolve(areaRoot, relativePath)));
      return { relativePath, byteLength:bytes.length, sha256:sha(bytes), bytes };
    });
    return Object.freeze({ repository:snapshot(sandbox.repository), workspace:snapshot(sandbox.workspace), rawInput:snapshot(sandbox.input), rootOutside:snapshot(sandbox.outside) });
  }

// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function disposeSandbox(sandbox) { rmSync(sandbox.root, { recursive:true, force:true }); }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function assertSentinels(sandbox) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const protectedSnapshot = areaRoot => filesUnder(areaRoot).sort().map(relativePath => {
      const bytes = Buffer.from(readFileSync(resolve(areaRoot, relativePath)));
      return { relativePath, byteLength:bytes.length, sha256:sha(bytes), bytes };
    });
    for (const [name, root] of Object.entries({ repository:sandbox.repository, workspace:sandbox.workspace, rawInput:sandbox.input, rootOutside:sandbox.outside })) {
      assert.deepEqual(protectedSnapshot(root), sandbox.protectedAreas[name], `protected ${name}: paths and exact bytes`);
    }
    assert.equal(sha(readFileSync(resolve(sandbox.repository, 'sentinel.txt'))), sandbox.sentinels.repository);
    assert.equal(sha(readFileSync(resolve(sandbox.workspace, 'sentinel.txt'))), sandbox.sentinels.workspace);
    // Raw inputs are covered as a complete recursive byte snapshot above.
    // A malformed-input fixture may intentionally refresh that baseline.
    assert.equal(sha(readFileSync(resolve(sandbox.outside, 'SOURCE-AUDIT.json'))), sandbox.sentinels.sourceAudit);
    assert.equal(sha(readFileSync(resolve(sandbox.outside, 'approval.json'))), sandbox.sentinels.approval);
    assert.equal(sha(readFileSync(resolve(sandbox.outside, 'localStorage-export.json'))), sandbox.sentinels.localStorage);
  }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function statMap(root) { return Object.fromEntries(EXPECTED_FINAL_PATHS.map(path => { const s=statSync(resolve(root,path)); return [path,{mtimeMs:s.mtimeMs,hash:sha(readFileSync(resolve(root,path)))}]; })); }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function assertFinalInventory(root) { assert.deepEqual(filesUnder(root).sort(), [...EXPECTED_FINAL_PATHS].sort()); }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function expectedInventoryFromFinalBytes(root) {
    const entries = EXPECTED_FINAL_PATHS.filter(path => !path.endsWith('/phase-a-hash-inventory.json')).sort().map(path => {
      const bytes = readFileSync(resolve(root, path));
      const isJson = path.endsWith('.json');
      return {
        relativePath:path,
        contentKind:isJson?'jcs-json':'exact-text',
        byteLength: bytes.length,
        fileSha256: sha(bytes),
        objectSha256: isJson ? sha(jcs(JSON.parse(bytes))) : null,
      };
    });
    return { schemaVersion:'snow-crystal-morphology-pilot-phase-a-inventory/1', contractId:'t1-7-morphology-ensemble-pilot-contract/1', entryCount:34, entries };
  }
  // This oracle deliberately has no dependency on the Phase-A builder, CLI, or
  // pre-existing morphology helpers.  It parses the frozen raw sources itself,
  // canonicalizes them here, and reproduces the reviewed selection algorithm.
  const CONTRACT='t1-7-morphology-ensemble-pilot-contract/1';
  const PDF='20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af';
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const cmp=(a,b)=>a<b?-1:a>b?1:0;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const schemaKey=name=>name.replace(/\.schema\.json$/, '').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())+'SchemaFileSha256';
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const rawCandidates=path=>{
    const text=readFileSync(path,'utf8').trim();
    const match=/window\.SOURCE_AUDIT_CANDIDATES\s*=\s*(\[.*\]);?$/.exec(text);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    assert(match, 'candidate-data exact assignment'); return parseUniqueJson(match[1], 'candidate-data');
  };
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  const vote=row=>({ growthAxis:row.growthAxis, basalBranchingLevel:row.basalBranchingLevel, hollowing:row.hollowing, confidence:row.confidence });
  function independentlyExpectedPhaseAObjects(inputRoot=REAL_INPUT_ROOT) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const asset=path=>readFileSync(resolve(CONTRACT_ROOT,path));
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const parsed=path=>assertCanonicalJson(asset(path), path);
    const schemas=Object.fromEntries(SCHEMA_BASENAMES.map(name=>[schemaKey(name),sha(asset(`schema/${name}`))]));
    const annotation=parsed('schema/annotation-payload.schema.json');
    const truth={growth:parsed('protocol/growth-truth-table.json'),branching:parsed('protocol/branching-truth-table.json'),hollowing:parsed('protocol/hollowing-truth-table.json'),consensus:parsed('protocol/consensus-routing-truth-table.json'),raster:parsed('protocol/figure2-projection-v1.json')};
    const annotator=asset('prompts/annotator-template.md').toString('utf8');
    const adjudicator=asset('prompts/adjudicator-template.md').toString('utf8');
    const placeholders=[...adjudicator.matchAll(/\{\{[A-Z_]+\}\}/g)].map(match=>match[0]);
    const protocol={schemaVersion:'snow-crystal-morphology-pilot-protocol/1',contractId:CONTRACT,protocolId:'morphology-ensemble-pilot/1',sourcePdfSha256:PDF,
      decisionContract:{observationSchemaObjectSha256:sha(jcs(annotation.properties.observations)),classificationSchemaObjectSha256:sha(jcs(annotation.properties.classification)),growthTruthTableObjectSha256:sha(jcs(truth.growth)),branchingTruthTableObjectSha256:sha(jcs(truth.branching)),hollowingTruthTableObjectSha256:sha(jcs(truth.hollowing)),confidenceRule:'minimum-of-three-field-confidences',consensusRoutingTruthTableObjectSha256:sha(jcs(truth.consensus))},
      schemaFiles:schemas,prompts:{rendererId:'ascii-placeholder-exact-replacement/1',annotatorTemplateFileSha256:sha(annotator),adjudicatorTemplateFileSha256:sha(adjudicator),annotatorAllowedPlaceholders:placeholders.slice(0,3),adjudicatorAllowedPlaceholders:placeholders},
      execution:{annotators:[{actorId:'annotator-1',requiredModelFamily:'claude'},{actorId:'annotator-2',requiredModelFamily:'openai'},{actorId:'annotator-3',requiredModelFamily:'google'}],imageCount:24,pageCounts:[[11,6],[12,6],[13,6],[14,6]],batchIds:['batch-01','batch-02'],batchSizes:[12,12],option:'A-all-24-human-final',modelAttemptPolicy:{policyId:'model-response-attempt-max-3-fresh-context/1',maximumAttemptsPerCampaign:3,retryContext:'fresh',invalidAttemptConsumesSlotArtifactId:false,invalidAttemptEntersSupersessionLedger:false}},
      rasterization:{inheritedProtocolId:'figure2-projection-v1',inheritedProtocolObjectSha256:sha(jcs(truth.raster)),codecId:'canonical-rgba8-png-stored-deflate/1',maskRgba:[127,127,127,255],paddingAllowed:false,imageTextOverlayAllowed:false},serialization:{json:'rfc8785-jcs-object-plus-lf-file',jsonl:'jcs-object-per-line-utf8-no-bom-lf-final-lf',unicodeNormalization:'NFC-before-JCS-or-prompt-render',hashAlgorithm:'sha256'},consensusPolicyId:'exclusive-DULOH/1',approvalPolicyId:'pilot-24-all-human/1'};
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const candidates=rawCandidates(resolve(inputRoot,'candidate-data.js')).map(row=>[row.id,row.locator.pdfPage,row.locator.pagePanelOrdinal]).sort((a,b)=>cmp(a[0],b[0]));
    const candidateSet={schemaVersion:'snow-crystal-morphology-pilot-candidate-set/1',sourcePdfSha256:PDF,rows:candidates};
    // These are independently produced raw drafts, not frozen contract assets.
    // Reject duplicate keys before use, then canonicalize only the derived output.
    const a=parseUniqueJson(readFileSync(resolve(inputRoot,'draft-a-final.json')), 'draft-a-final.json'), b=parseUniqueJson(readFileSync(resolve(inputRoot,'draft-b-final.json')), 'draft-b-final.json');
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const byId=new Map(a.entries.map(row=>[row.sourceObservationId,vote(row)])); const byIdB=new Map(b.entries.map(row=>[row.sourceObservationId,vote(row)]));
    const fields=['growthAxis','basalBranchingLevel','hollowing','confidence'];
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const proxyInput={schemaVersion:'snow-crystal-morphology-pilot-selection-proxy/1',annotatorAArtifactFileSha256:sha(readFileSync(resolve(inputRoot,'draft-a-final.json'))),annotatorBArtifactFileSha256:sha(readFileSync(resolve(inputRoot,'draft-b-final.json'))),rows:candidates.map(([sourceObservationId])=>{const av=byId.get(sourceObservationId),bv=byIdB.get(sourceObservationId);assert(av&&bv,`draft row ${sourceObservationId}`);return{sourceObservationId,annotatorA:av,annotatorB:bv,proxySignature:fields.map(field=>av[field]===bv[field]?av[field]:'disagreement')};})};
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const proxyById=new Map(proxyInput.rows.map(row=>[row.sourceObservationId,row.proxySignature]));
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const members=candidates.map(([sourceObservationId,pdfPage])=>{const proxySignature=proxyById.get(sourceObservationId);return{sourceObservationId,pdfPage,proxySignature,selectionKeySha256:sha(`snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/selection\0${jcs([pdfPage,proxySignature,sourceObservationId])}`),batchOrderKeySha256:sha(`snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/batch-order\0${sourceObservationId}`)}});
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const slots=[11,12,13,14].flatMap(pdfPage=>{const groups=new Map();for(const row of members.filter(row=>row.pdfPage===pdfPage)){const key=jcs(row.proxySignature);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}const ranked=[...groups.values()].flatMap(group=>group.sort((x,y)=>cmp(x.selectionKeySha256,y.selectionKeySha256)||cmp(x.sourceObservationId,y.sourceObservationId)).map((row,rank)=>({...row,rank})));return ranked.sort((x,y)=>x.rank-y.rank||cmp(x.selectionKeySha256,y.selectionKeySha256)||cmp(x.sourceObservationId,y.sourceObservationId)).slice(0,6).map(({rank,...row},pageSlot)=>({...row,pageSlot:pageSlot+1}));}).sort((x,y)=>cmp(x.batchOrderKeySha256,y.batchOrderKeySha256)||cmp(x.sourceObservationId,y.sourceObservationId)).map((row,ordinal)=>({ordinal,...row}));
    const plan={schemaVersion:'snow-crystal-morphology-pilot-selection/1',contractId:CONTRACT,protocolObjectSha256:sha(jcs(protocol)),sourcePdfSha256:PDF,candidateSetObjectSha256:sha(jcs(candidateSet)),proxyInputObjectSha256:sha(jcs(proxyInput)),algorithmId:'page-proxy-round-robin-hash-v1',selectionSeed:'snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/selection',slots};
    const result={protocol,candidateSet,proxyInput,plan};
    assert.equal(sha(jcs(protocol)),PHASE_A_OBJECT_HASHES.protocol); assert.equal(sha(jcs(candidateSet)),PHASE_A_OBJECT_HASHES.candidate); assert.equal(sha(jcs(proxyInput)),PHASE_A_OBJECT_HASHES.proxy); assert.equal(sha(jcs(plan)),PHASE_A_OBJECT_HASHES.plan);
    return result;
  }
  function expectedPhaseAFinalBytes(inputRoot=REAL_INPUT_ROOT) {
    const objects=independentlyExpectedPhaseAObjects(inputRoot); const output=new Map(ASSET_PATHS.map(path=>[`frozen/${path}`,readFileSync(resolve(CONTRACT_ROOT,path))]));
    output.set('frozen/protocol/morphology-ensemble-pilot-v1.json',Buffer.from(`${jcs(objects.protocol)}\n`)); output.set('restricted/selection/candidate-set.json',Buffer.from(`${jcs(objects.candidateSet)}\n`)); output.set('restricted/selection/proxy-input.json',Buffer.from(`${jcs(objects.proxyInput)}\n`)); output.set('restricted/selection/pilot-selection-plan.json',Buffer.from(`${jcs(objects.plan)}\n`));
    const entries=[...output].sort(([a],[b])=>cmp(a,b)).map(([relativePath,bytes])=>({relativePath,contentKind:relativePath.endsWith('.json')?'jcs-json':'exact-text',byteLength:bytes.length,fileSha256:sha(bytes),objectSha256:relativePath.endsWith('.json')?sha(jcs(JSON.parse(bytes))):null}));
    output.set('frozen/protocol/phase-a-hash-inventory.json',Buffer.from(`${jcs({schemaVersion:'snow-crystal-morphology-pilot-phase-a-inventory/1',contractId:CONTRACT,entryCount:34,entries})}\n`)); return output;
  }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function assertPhaseAFinalBytes(root) {
    assertFinalInventory(root);
    // Thirty files are copied exactly; the five constructed JSON artifacts are
    // independently pinned by canonical-object hash and canonical LF bytes.
    for (const path of ASSET_PATHS) assert.deepEqual(readFileSync(resolve(root, 'frozen', path)), readFileSync(resolve(CONTRACT_ROOT, path)), `exact asset ${path}`);
    const expectedBytes=expectedPhaseAFinalBytes();
    const constructed = ['frozen/protocol/morphology-ensemble-pilot-v1.json','restricted/selection/candidate-set.json','restricted/selection/proxy-input.json','restricted/selection/pilot-selection-plan.json'];
    for (const path of constructed) {
      const bytes = readFileSync(resolve(root, path));
      assert.equal(bytes.at(-1), 10, `${path} LF`); assert.equal(bytes.includes(Buffer.from('\r\n')), false, `${path} CRLF`);
      assert.deepEqual(bytes, expectedBytes.get(path), `${path} independent JCS+LF bytes`);
    }
    const inventoryPath='frozen/protocol/phase-a-hash-inventory.json';
    const saved=readFileSync(resolve(root, inventoryPath));
    assert.deepEqual(saved, expectedBytes.get(inventoryPath), 'independently rebuilt inventory JCS+LF bytes');
    return { inventory:JSON.parse(saved), inventoryFileSha256:sha(saved), finalCount:EXPECTED_FINAL_PATHS.length };
  }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function tempFiles(root) {
    if (!existsSync(root)) return [];
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    return filesUnder(root).filter(path => /(?:^|\/)\.[^/]+\.phase-a\.tmp$/.test(path));
  }
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function expectRange(error, reason, field) {
    assert(error instanceof RangeError, `expected RangeError, received ${error?.constructor?.name}`);
    assert.match(error.message, new RegExp(`\\b${reason}\\b`));
    assert.match(error.message, new RegExp(`\\b${field.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`));
  }

// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function recordingFileSystem(adapter, root) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const operations=[];
    const handles=new Map();
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const rel=value => typeof value === 'string' ? relative(root, value).split(sep).join('/') : null;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const handleKey=value => value !== null && (typeof value === 'number' || typeof value === 'object') ? `${typeof value}:${String(value)}` : null;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const record=(property,args,result) => {
      const operation=String(property); const first=rel(args[0]); const second=rel(args[1]);
      const suppliedHandle=handleKey(args[0]); const resultHandle=handleKey(result);
      const known=handles.get(suppliedHandle) ?? null;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const flags=typeof args[1] === 'string' ? args[1] : args.find(arg => arg && typeof arg === 'object' && typeof arg.flag === 'string')?.flag ?? null;
      if (/^open$/i.test(operation) && resultHandle && first !== null) handles.set(resultHandle, first);
      operations.push({ operation, target:known ?? first, related:/^link$/i.test(operation) ? second : null, handleKind:known ? 'file' : (suppliedHandle ? typeof args[0] : null), flags });
    };
    const wrapped=new Proxy(adapter, { get(target, property) {
      const value=target[property];
      if (typeof value !== 'function') return value;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      return (...args) => {
        const result=value.apply(target,args);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
        if (result && typeof result.then === 'function') return result.then(resolved => { record(property,args,resolved); return resolved; });
        record(property,args,result); return result;
      };
    }});
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    return { filesystem:wrapped, operations };
  }

// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function assertPublicationOperations(operations, expectedFinalPaths) {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    const mutations=operations.filter(row => /(?:open|write|sync|close|read|link|unlink)/i.test(row.operation));
    for (const finalPath of expectedFinalPaths) {
      const basename=finalPath.slice(finalPath.lastIndexOf('/')+1);
      const tempPath=`${finalPath.slice(0, finalPath.lastIndexOf('/')+1)}.${basename}.phase-a.tmp`;
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const start=mutations.findIndex(row => row.target===tempPath && /(?:open|write)/i.test(row.operation) && row.flags==='wx');
      assert(start >= 0, `missing exclusive temp operation ${tempPath}`);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const nextStart=mutations.findIndex((row,index) => index>start && /(?:open|write)/i.test(row.operation) && row.flags==='wx');
      // A publication is checked in its own exclusive-temp operation window.
      // This prevents another final's flush/close/read from satisfying this one.
      const tail=mutations.slice(start, nextStart === -1 ? undefined : nextStart);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const requireAfter=(pattern, after, label, target=tempPath) => {
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
        const index=tail.findIndex((row,index) => index>after && pattern.test(row.operation) && (target === null || row.target===target));
        assert(index >= 0, `missing ${label} for ${finalPath}`); return index;
      };
      const fileSync=requireAfter(/(?:^|[^a-z])(?:sync|fsync)(?:$|[^a-z])/i,0,'file sync');
      const close=requireAfter(/close/i,fileSync,'close');
      const reread=requireAfter(/read/i,close,'separate reread');
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const link=tail.findIndex((row,index) => index>reread && /link/i.test(row.operation) && row.related===finalPath);
      assert(link >= 0, `missing exclusive link ${finalPath}`);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const directorySync=requireAfter(/(?:syncDirectory|directorySync|fsyncDir)/i,link,'directory sync',null);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      const unlink=tail.findIndex((row,index) => index>directorySync && /unlink/i.test(row.operation) && row.target===tempPath);
      assert(unlink >= 0, `missing temp unlink ${tempPath}`);
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
      requireAfter(/(?:syncDirectory|directorySync|fsyncDir)/i,unlink,'final directory sync',null);
    }
  }

// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
  function selfCheckPhaseA() {
    const counts=assertAssets();
    const objects=independentlyExpectedPhaseAObjects();
    const finalBytes=expectedPhaseAFinalBytes();
    assert.equal(finalBytes.size, 35);
    for (const [key, value] of Object.entries({
      protocol:objects.protocol, candidate:objects.candidateSet,
      proxy:objects.proxyInput, plan:objects.plan,
// @ts-expect-error Phase A test-local oracle uses dynamic Node adapter shapes.
    })) assert.equal(sha(jcs(value)), PHASE_A_OBJECT_HASHES[key]);
    return counts;
  }


  return { ASSET_PATHS, CLI, CONTRACT_ROOT, EXPECTED_FINAL_PATHS, LIBRARY, PHASE_A_OBJECT_HASHES, assertAssets, assertFinalInventory, assertPhaseAFinalBytes, assertPublicationOperations, assertSentinels, captureProtectedAreas, disposeSandbox, expectRange, filesUnder, jcs, makeSandbox, recordingFileSystem, sha, statMap, tempFiles };
};
