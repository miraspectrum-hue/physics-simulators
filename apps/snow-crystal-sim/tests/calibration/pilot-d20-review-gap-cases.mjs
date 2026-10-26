// Regressions for the first D-20/D-22 implementation review. No validator import.
import { assert, bad, clone, fileBytes, hash, sha, whash, PDF, utc } from './pilot-oracle.mjs';
import { materializePromptChain, materializeReplacementCampaign, materializeValidWrapper,
  materializeOldInvalidEvidence, materializeOldGraph, materializeReissuePlan,
  REISSUE_CAUSES, collectArtifactInventory } from './pilot-d20-builders.mjs';

const signWrapper = wrapper => {
  wrapper.bytes = [wrapper.header, ...wrapper.records].map(fileBytes).join('');
  wrapper.fileSha256 = sha(wrapper.bytes);
};
const signEvidence = f => {
  f.evidence.campaignIdSha256 = hash(f.campaign);
  const { invalidAttemptEvidenceId, ...body } = f.evidence;
  void invalidAttemptEvidenceId;
  f.evidence.invalidAttemptEvidenceId = whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body });
  f.evidenceBytes = fileBytes(f.evidence);
  f.evidenceFileSha256 = sha(f.evidenceBytes);
  f.evidenceFilename = f.evidence.invalidAttemptEvidenceId + '.json';
};
const orderedHash = table => whash('ordered-image-input', {
  orderedItems: table.orderedItems.map(({ attachmentSlot, ...item }) => item),
});

function replacement(contract, workflow, table, rawResponseFile) {
  const run = workflow.runs[0];
  const chain = materializePromptChain({ protocol: contract.protocol,
    schemaObject: clone(contract.bundle.annotationPayloadSchemaFileSha256.object), table: clone(table),
    templateBytes: run.prompt.template, rendererId: contract.protocol.prompts.rendererId });
  const campaign = materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, promptChain: chain, reasonCode: 'input-change' });
  campaign.orderedInputSha256 = orderedHash(table);
  const f = { protocol: contract.protocol, firstPlan: workflow.firstPlan, plannedRun: run,
    ...materializeOldInvalidEvidence(contract, workflow), campaign, rawResponseFile, chain };
  f.evidence.campaignKind = campaign.campaignKind;
  f.evidence.replacementReasonCode = campaign.replacementReasonCode;
  f.evidence.changedInputSha256 = campaign.changedInputSha256;
  f.evidence.promptRefs = { promptRole: 'annotator', promptTemplateFileSha256: sha(chain.templateBytes),
    promptVariablesObjectSha256: hash(chain.variables), schemaFileSha256: chain.schemaFileSha256,
    modelPayloadSchemaObjectSha256: chain.modelPayloadSchemaObjectSha256,
    renderedPromptEvidenceObjectSha256: hash(chain.evidence), renderedPromptSha256: sha(chain.rendered) };
  f.evidence.inputRefs.batchInputTableObjectSha256 = hash(table);
  f.evidence.inputRefs.orderedInputSha256 = campaign.orderedInputSha256;
  f.replacementInputs = { chain, table: chain.table, tableObjectSha256: hash(table),
    schema: { object: chain.schemaObject, bytes: chain.schemaBytes, fileSha256: chain.schemaFileSha256,
      objectSha256: chain.modelPayloadSchemaObjectSha256 },
    prompt: { template: chain.templateBytes, variables: chain.variables, evidence: chain.evidence,
      rendered: chain.rendered, variablesObjectSha256: hash(chain.variables) } };
  f.validWrapper = materializeValidWrapper({ run, firstPlan: workflow.firstPlan, campaign,
    promptChain: chain, attemptNumber: 2, artifactId: 'review-gap-input-replacement' });
  f.validWrapper.header.orderedInputSha256 = campaign.orderedInputSha256;
  signWrapper(f.validWrapper); signEvidence(f);
  return f;
}

function rootAttempt(contract, workflow, attemptNumber, rawResponseFile) {
  const run = workflow.runs[0], campaign = clone(run.campaign);
  const prior = { ...materializeOldInvalidEvidence(contract, workflow), campaign, rawResponseFile };
  prior.evidence.campaignKind = campaign.campaignKind;
  prior.evidence.activeArtifactBeforeCampaign = null;
  prior.evidence.replacementReasonCode = null;
  prior.evidence.changedInputSha256 = null;
  prior.evidence.run.startedAtUtc = utc(0); prior.evidence.run.completedAtUtc = utc(1);
  prior.evidence.run.responseCapturedAtUtc = utc(2);
  signEvidence(prior);
  const validWrapper = materializeValidWrapper({ run, firstPlan: workflow.firstPlan, campaign, attemptNumber });
  if (attemptNumber === 2) {
    validWrapper.header.generator.startedAtUtc = utc(3); validWrapper.header.generator.completedAtUtc = utc(4);
    validWrapper.header.generator.responseCapture.capturedAtUtc = utc(5); validWrapper.header.createdAtUtc = utc(6);
    signWrapper(validWrapper);
  }
  return { protocol: contract.protocol, firstPlan: workflow.firstPlan, plannedRun: run, campaign,
    submissions: Array.from({ length: attemptNumber }, (_, i) => ({ attemptNumber: i + 1,
      state: i === attemptNumber - 1 ? 'valid' : 'invalid', freshContext: true })),
    invalidEvidence: attemptNumber === 1 ? [] : [prior], validWrapper,
    activeBefore: null, atomicReplacement: false, activeDuringInvalid: null,
    requiredAnnotationRoot: true, failurePolicy: 'stop-pilot', invalidEvidenceInLedger: [], invalidEvidenceInSnapshots: [] };
}

function reissue(contract, workflow) {
  const oldGraph = materializeOldGraph(contract, workflow, null);
  const b = materializeReissuePlan({ contract, workflow, cause: REISSUE_CAUSES[0], oldSecondPlan: null, oldGraph });
  return { protocol: contract.protocol, selectionPlan: contract.plan, oldFirstPlan: workflow.firstPlan,
    oldSecondPlan: null, oldLedger: workflow.emptyLedger, oldGraph, closure: b.closure, closureBytes: b.closureBytes,
    closureFileSha256: b.closureFileSha256, closureFilename: b.closureFilename, freezeOrder: b.freezeOrder,
    newProtocol: b.protocol, newSelection: b.selection, newManifest: b.manifest, newRestricted: b.restricted,
    newTable: b.table, newVariables: b.prompt.variables, newEvidence: b.prompt.evidence, newRendered: b.prompt.rendered,
    newFirstPlan: b.firstPlan, newSchema: { object: b.schema, bytes: fileBytes(b.schema),
      fileSha256: sha(fileBytes(b.schema)), objectSha256: hash(b.schema) }, newTemplateBytes: b.template,
    oldInventory: b.oldInventory, newInventory: b.newInventory, oldIds: b.oldIds, newIds: b.newIds,
    oldPlanSubmissionsAfterClosure: [], oldPlanRootsAfterClosure: [], oldPlanLedgerEntriesAfterClosure: [],
    oldPlanApprovalsAfterClosure: [], oldPlanCoverageAfterClosure: [], crossPlanReferences: [],
    ...Object.fromEntries(['MaterializedRoots', 'Runs', 'Campaigns', 'InvalidEvidence', 'LedgerEntries',
      'Snapshots', 'SecondPlans', 'Approvals', 'Coverage'].map(key => ['newPlan' + key, []])) };
}

export function buildReviewGapRows(contract, workflow, rawResponseFile = null) {
  const rows = [];
  const add = (key, caseName, baseline, mutate, reason, field) => {
    const baselineHash = hash(baseline), fixture = clone(baseline); mutate(fixture);
    assert.equal(hash(baseline), baselineHash);
    rows.push({ key, caseName, baseline, baselineHash, fixture, errorClass: 'RangeError', reason, field });
  };
  const selection = { protocol: contract.protocol, candidateSet: contract.candidateSet,
    proxyInput: contract.proxyInput, selectionPlan: contract.plan };
  add('selection/joint-pdf-spoof', 'selection', selection, f => {
    // A concrete alternate PDF byte fixture, not a hash of an arbitrary label.
    f.alternatePdfBytes = '%PDF-1.7\n% synthetic non-authority PDF\n%%EOF\n';
    f.candidateSet.sourcePdfSha256 = sha(f.alternatePdfBytes);
    f.selectionPlan.sourcePdfSha256 = sha(f.alternatePdfBytes);
    f.selectionPlan.candidateSetObjectSha256 = hash(f.candidateSet);
    assert.notEqual(f.selectionPlan.sourcePdfSha256, PDF);
  }, 'selection-invalid', 'sourcePdfSha256');

  const table = clone(workflow.runs[0].table); table.orderedItems[0].attachmentSlot += '-changed';
  const inputBase = replacement(contract, workflow, table, rawResponseFile);
  for (const [key, mutate, field] of [
    ['protocolObjectSha256', t => { t.protocolObjectSha256 = hash(workflow.firstPlan); }, 'protocolObjectSha256'],
    ['blindedManifestObjectSha256', t => { t.blindedManifestObjectSha256 = hash(contract.restricted); }, 'blindedManifestObjectSha256'],
    ['batchId', t => { t.batchId = 'batch-02'; }, 'batchId'],
    ['ordinal', t => { t.orderedItems[0].ordinal = 99; }, 'orderedInputSha256'],
    ['no-attachment-delta', t => { t.orderedItems[0].attachmentSlot = workflow.runs[0].table.orderedItems[0].attachmentSlot; }, 'batchInputTableObjectSha256'],
  ]) add('input-change/' + key, 'invalid-attempt', inputBase, f => {
    const changed = clone(table); mutate(changed);
    Object.assign(f, replacement(contract, workflow, changed, rawResponseFile));
  }, 'invalid-attempt-evidence', field);

  add('attempt/valid-one-null-replacement', 'attempt-campaign', rootAttempt(contract, workflow, 1, rawResponseFile), f => {
    f.campaign.campaignKind = 'replacement-materialization';
    f.campaign.replacementReasonCode = 'model-retry'; f.campaign.changedInputSha256 = workflow.runs[0].fileSha256;
    f.validWrapper.campaign = clone(f.campaign);
    f.validWrapper.header.generator.campaignIdSha256 = hash(f.campaign); signWrapper(f.validWrapper);
  }, 'attempt-campaign-invalid', 'activeArtifactIdBeforeCampaign');
  const second = rootAttempt(contract, workflow, 2, rawResponseFile);
  for (const defect of ['evidence-id', 'file-hash', 'both']) add('attempt/prior-' + defect, 'attempt-campaign', second, f => {
    const prior = f.invalidEvidence[0];
    if (defect !== 'file-hash') {
      prior.evidence.invalidAttemptEvidenceId = hash(prior.evidence);
      prior.evidenceBytes = fileBytes(prior.evidence);
      prior.evidenceFileSha256 = sha(prior.evidenceBytes);
      prior.evidenceFilename = prior.evidence.invalidAttemptEvidenceId + '.json';
    }
    if (defect !== 'evidence-id') prior.evidenceFileSha256 = hash(prior.evidence);
    // The enclosing valid attempt's bytes, campaign and signatures stay coherent.
  }, 'attempt-campaign-invalid', 'invalidEvidence');

  const reissueBase = reissue(contract, workflow);
  for (const target of ['old-plan', 'closure']) add('reissue/hidden-' + target, 'plan-reissue', reissueBase, f => {
    // Concrete, type-valid authority carrier proves this is an embedded ref,
    // while all authoritative new objects and the self-reported ID set stay intact.
    f.referenceCarrier = clone(f.newFirstPlan);
    f.referenceCarrier.protocolObjectSha256 = target === 'old-plan' ? hash(f.oldFirstPlan) : hash(f.closure);
    const node = collectArtifactInventory([f.referenceCarrier])[0];
    f.newInventory.push({ ...node, name: 'reference-carrier', planOwned: true,
      format: 'json', schemaKey: 'annotationConsensusSlotPlanSchemaFileSha256' });
  }, 'protocol-reissue-required', 'newInventory');

  const schemaBase = { protocol: contract.protocol, schemaBundle: contract.bundle };
  const a = 'selectionCandidateSetSchemaFileSha256', b = 'selectionProxyInputSchemaFileSha256';
  for (const mode of ['swap', 'duplicate']) add('schema-role/' + mode, 'schema-bundle', schemaBase, f => {
    const first = clone(f.schemaBundle[a]);
    const replaceRole = (key, schema) => { f.schemaBundle[key] = { ...clone(schema), filename: f.schemaBundle[key].filename };
      f.protocol.schemaFiles[key] = f.schemaBundle[key].fileSha256; };
    replaceRole(a, f.schemaBundle[b]);
    if (mode === 'swap') replaceRole(b, first);
  }, 'schema-file-binding', a);
  return rows;
}

export function registerReviewGapRows(rows) {
  for (const row of rows) bad(row.caseName, row.fixture, () => {}, row.reason, row.field, row.errorClass, 'd23/' + row.key);
}
