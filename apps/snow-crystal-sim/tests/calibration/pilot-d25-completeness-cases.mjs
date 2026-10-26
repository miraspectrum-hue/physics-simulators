// D-25: omit concrete inventory rows while retaining the complete frozen old
// graph. Every remaining row and both self-reported identity sets stay valid.
// No validator is imported by these test-only fixture materializers.
import { assert, bad, clone, hash, immutableSnapshot } from './pilot-oracle.mjs';
import { materializeDepthReissue } from './pilot-d24-depth-cases.mjs';

// This is the pre-existing inventory identity contract, not the completeness
// oracle. The independent selfcheck derives identities separately from bytes.
const executionReference = /(?:^|\.)(?:[^.]*[aA]rtifact(?:Id|FileSha256)|[^.]*[rR]ecordObjectSha256|[^.]*[pP]lanObjectSha256|protocolObjectSha256|blindedManifestObjectSha256|restrictedMappingObjectSha256|[^.]*SnapshotSha256|supersessionLedgerFileSha256|campaignIdSha256|invalidAttemptEvidenceId|approvalId|promptVariablesObjectSha256|renderedPromptEvidenceObjectSha256|renderedPromptSha256|batchInputTableObjectSha256|candidateAliasManifestObjectSha256|candidatePayloadTableObjectSha256|candidateInputSha256|consensusInputSha256|finalValuesSha256|approvalTargetObjectSha256|modelPayloadObjectSha256)$/;
const identities = inventory => [...new Set(inventory.filter(row => row.planOwned).flatMap(row => [
  row.objectSha256, row.fileSha256, row.artifactId,
  ...row.embeddedRefs.filter(([path]) => executionReference.test(path)).map(([, value]) => value),
]).filter(value => value !== null && value !== undefined))].sort();

export function buildCompletenessRows(c, w) {
  const baselines = Object.fromEntries([['no-second-plan', null], ['fresh', w.freshPlan], ['skipped', w.skippedPlan]]
    .map(([route, plan]) => [route, immutableSnapshot(materializeDepthReissue(c, w, plan))]));
  const probes = [
    // Keep this exact review reproduction first, ahead of every shuffled case.
    ['coordinated-campaign-evidence', 'no-second-plan', ['campaign/6', 'invalidEvidence/0']],
    ['fresh/coordinated-campaign-evidence', 'fresh', ['campaign/7', 'invalidEvidence/0']],
    ['skipped/coordinated-campaign-evidence', 'skipped', ['campaign/6', 'invalidEvidence/0']],
    ['root-artifact', 'no-second-plan', ['run/0']],
    ['consensus-artifact', 'no-second-plan', ['consensus']],
    ['ledger', 'no-second-plan', ['ledger']],
    ['first-plan', 'no-second-plan', ['firstPlan']],
    ['selection-plan', 'no-second-plan', ['selection']],
    ['fresh/second-plan', 'fresh', ['secondPlan/0']],
    ['fresh/adjudication-artifact', 'fresh', ['adjudication']],
    ['fresh/snapshot', 'fresh', ['snapshot/0']],
    ['fresh/approval', 'fresh', ['approval/0']],
    ['fresh/coverage', 'fresh', ['coverage/0']],
    ['skipped/snapshot', 'skipped', ['snapshot/2']],
    ['skipped/approval', 'skipped', ['approval/1']],
    ['skipped/coverage', 'skipped', ['coverage/0']],
    ['invalid-evidence', 'no-second-plan', ['invalidEvidence/0']],
  ];
  return probes.map(([key, route, omittedNames]) => {
    const baseline = baselines[route], fixture = clone(baseline);
    for (const name of omittedNames) assert.equal(fixture.oldInventory.filter(row => row.name === name).length, 1);
    fixture.oldInventory = fixture.oldInventory.filter(row => !omittedNames.includes(row.name));
    fixture.oldIds = identities(fixture.oldInventory);
    fixture.newIds = identities(fixture.newInventory);
    return { key, route, omittedNames, baseline, baselineHash: hash(baseline), fixture,
      caseName: 'plan-reissue', errorClass: 'RangeError', reason: 'protocol-reissue-required', field: 'newInventory' };
  });
}

export function registerCompletenessRows(rows) {
  for (const row of rows) bad(row.caseName, row.fixture, () => {}, row.reason, row.field, row.errorClass, 'd25/' + row.key);
}
