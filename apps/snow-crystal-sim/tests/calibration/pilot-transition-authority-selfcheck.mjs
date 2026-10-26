// Independent audit of the registered transition authorities. No validator or
// materializer imports: identities and byte hashes are read from concrete data.
import { pathToFileURL } from 'node:url';
import { assert, cases, fileBytes, hash, sha, whash, schemaAccepts } from './pilot-oracle.mjs';

const eq = assert.deepEqual;
const transitions = [
  ['valid-1', 'planned', 1, []],
  ['invalid-1-retryable-2', 'planned', null, [1]],
  ['invalid-1-valid-2', 'retryable-2', 2, [1]],
  ['invalid-1-invalid-2-retryable-3', 'retryable-2', null, [1, 2]],
  ['invalid-1-invalid-2-valid-3', 'retryable-3', 3, [1, 2]],
  ['invalid-1-invalid-2-invalid-3-failed-closed', 'retryable-3', null, [1, 2, 3]],
];

function objects(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return seen;
  seen.add(value);
  for (const child of Object.values(value)) objects(child, seen);
  return seen;
}
function artifact(c, value, schemaRole) {
  eq(value.bytes, [value.header, ...value.records].map(fileBytes).join(''));
  eq(value.fileSha256, sha(value.bytes));
  eq(value.header.expectedRecordCount, value.records.length);
  for (const record of [value.header, ...value.records]) {
    assert(schemaAccepts(c.bundle[schemaRole + 'SchemaFileSha256'].object, record), schemaRole);
  }
}

export function assertTransitionAuthorities(c, w, registry) {
  const rows = registry.filter(row => row.caseName === 'attempt-state-transition');
  const labels = ['root', 'model-retry', 'input-change'].flatMap(reason => transitions.map(([name, prior, accepted, evidence]) =>
    `${reason}/${name}/prior=${prior}/accepted=${accepted ?? 'none'}/evidence=${evidence.join(',') || 'none'}`));
  eq(rows.map(row => row.label), labels); eq(rows.length, 18);
  eq(new Set(rows.map(row => hash(row.fixture))).size, 18);
  const sourceObjects = objects([c, w]), registeredObjects = new Set();
  const authorityHashes = [];
  for (const row of rows) {
    const f = row.fixture, run = f.plannedRun, ledger = f.ledger;
    assert(run && ledger, row.label + ': concrete plannedRun and ledger required');
    eq(run, w.runs[0]); eq(ledger, w.emptyLedger);
    artifact(c, run, 'artifact'); artifact(c, ledger, 'supersessionLedger');
    const planHash = hash(f.firstPlan), protocolHash = hash(f.protocol);
    const slot = f.firstPlan.slots.find(item => item.logicalSlot === f.campaign.logicalSlot);
    assert(slot); eq(slot.artifactKind, 'annotation-run');
    eq(slot.rootArtifactId, run.header.artifactId); eq(slot.logicalSlot, run.header.logicalSlot);
    eq(slot.batchId, run.header.batchId); eq(slot.actorId, run.header.generator.actorId);
    eq(f.firstPlan.protocolObjectSha256, protocolHash);
    eq(run.header.annotationConsensusSlotPlanObjectSha256, planHash);
    eq(run.header.protocolObjectSha256, protocolHash);
    eq(f.campaign.slotPlanObjectSha256, planHash);
    eq(ledger.header.protocolObjectSha256, protocolHash);
    eq(ledger.header.annotationConsensusSlotPlanObjectSha256, planHash);
    eq(ledger.header.blindedManifestObjectSha256, f.firstPlan.blindedManifestObjectSha256);
    eq(ledger.header.artifactKind, 'supersession-ledger'); eq(ledger.header.logicalSlot, 'ledger-all');
    eq(ledger.header.generator, { kind: 'deterministic-coordinator', operation: 'supersession-ledger' });
    eq(ledger.records, [{ recordType: 'supersession-ledger-metadata', previousLedgerFileSha256: null, entryCount: 0, lastSequence: 0 }]);
    eq(ledger.header.orderedInputSha256, whash('supersession-ledger-input', { previousLedgerFileSha256: null, orderedItems: [] }));
    // With no supersession edges, the frozen planned root is the terminal.
    const replacement = f.campaign.campaignKind === 'replacement-materialization';
    const active = replacement ? { artifactId: run.header.artifactId, fileSha256: run.fileSha256 } : null;
    eq(f.activeBefore, active); eq(f.activeDuringInvalid, active?.artifactId ?? null);
    eq(f.campaign.activeArtifactIdBeforeCampaign, active?.artifactId ?? null);
    eq(f.campaign.activeArtifactFileSha256BeforeCampaign, active?.fileSha256 ?? null);
    if (f.campaign.replacementReasonCode === 'model-retry') eq(f.campaign.changedInputSha256, run.fileSha256);
    for (const prior of f.invalidEvidence) {
      eq(prior.evidence.activeArtifactBeforeCampaign, active ? { artifactId: active.artifactId, artifactFileSha256: active.fileSha256 } : null);
    }
    // Registry clones must isolate all mutable nodes from the source workflow
    // and every other registered row. The response must also be independent of
    // both frozen authorities inside its own row.
    const owned = objects(f);
    for (const value of owned) {
      assert(!sourceObjects.has(value), row.label + ': source alias');
      assert(!registeredObjects.has(value), row.label + ': cross-row alias');
      registeredObjects.add(value);
    }
    const mutableResponse = objects([f.validWrapper, f.invalidEvidence, f.activeBefore, f.campaign]);
    for (const value of objects([run, ledger])) assert(!mutableResponse.has(value), row.label + ': response aliases authority');
    authorityHashes.push({ label: row.label, plannedArtifactId: run.header.artifactId,
      plannedArtifactFileSha256: run.fileSha256, ledgerArtifactId: ledger.header.artifactId, ledgerFileSha256: ledger.fileSha256 });
  }
  return { status: 'green', totalRows: rows.length, isolatedRows: rows.length, authorityHashes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const { attemptCases } = await import('./pilot-state-cases.mjs');
  const { createIsolatedRoot } = await import('./pilot-metrics-isolation.mjs');
  const { rmSync } = await import('node:fs');
  const c = buildContract(), w = buildWorkflow(c), workRoot = createIsolatedRoot();
  try {
    attemptCases(c, w, workRoot);
    console.log(JSON.stringify(assertTransitionAuthorities(c, w, cases), null, 2));
  } finally { rmSync(workRoot, { recursive: true, force: true }); }
}
