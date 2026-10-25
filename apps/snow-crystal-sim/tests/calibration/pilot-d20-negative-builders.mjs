// D-22 negative materializers. Positive builders are immutable inputs.
// Every row carries a concrete baseline and a single named mutation source.
import { assert, clone, fileBytes, hash, jcs, sha, whash, utc, bad } from './pilot-oracle.mjs';
import { materializePromptChain, materializeReplacementCampaign, materializeValidWrapper,
  materializeOldInvalidEvidence, flattenArtifactReferences, collectArtifactInventory, renderExactTemplate } from './pilot-d20-builders.mjs';
import { makeLedger } from './pilot-workflow-fixtures.mjs';

export const REPLACEMENT_REASONS = ['model-retry', 'input-change'];
export const AUTHORITY_COLUMNS = ['active-file', 'current-table', 'new-table', 'stale-artifact',
  'future-artifact', 'schema-file', 'template-file', 'prompt-variables'];
export const ZERO_COLLECTIONS = ['MaterializedRoots', 'Runs', 'Campaigns', 'InvalidEvidence',
  'LedgerEntries', 'Snapshots', 'SecondPlans', 'Approvals', 'Coverage'];

const imageInput = table => whash('ordered-image-input', {
  orderedItems: table.orderedItems.map(({ attachmentSlot, ...row }) => row),
});
export function signArtifact(artifact) {
  artifact.bytes = [artifact.header, ...artifact.records].map(fileBytes).join('');
  artifact.fileSha256 = sha(artifact.bytes);
  return artifact;
}
export function signInvalid(fixture) {
  fixture.evidence.campaignIdSha256 = hash(fixture.campaign);
  const { invalidAttemptEvidenceId, ...body } = fixture.evidence;
  void invalidAttemptEvidenceId;
  fixture.evidence.invalidAttemptEvidenceId = whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body });
  fixture.evidenceBytes = fileBytes(fixture.evidence);
  fixture.evidenceFileSha256 = sha(fixture.evidenceBytes);
  fixture.evidenceFilename = fixture.evidence.invalidAttemptEvidenceId + '.json';
}
export function signClosure(fixture) {
  const { planClosureId, ...body } = fixture.closure;
  void planClosureId;
  fixture.closure.planClosureId = whash('plan-closure-id', { closureWithoutPlanClosureId: body });
  fixture.closureBytes = fileBytes(fixture.closure);
  fixture.closureFileSha256 = sha(fixture.closureBytes);
  fixture.closureFilename = fixture.closure.planClosureId + '.json';
}
function row(rows, baseline, key, mutate, field, options = {}) {
  const fixture = clone(baseline), baselineHash = hash(baseline);
  mutate(fixture);
  assert.equal(hash(baseline), baselineHash, 'mutation must not modify baseline');
  assert.notEqual(hash(fixture), baselineHash, 'negative must change its baseline: ' + key);
  rows.push({ key, baseline, fixture, baselineHash,
    caseName: options.caseName ?? 'invalid-attempt',
    errorClass: options.errorClass ?? 'RangeError',
    reason: options.reason ?? 'invalid-attempt-evidence', field,
    mutation: options.mutation ?? key });
}
export function registerNegativeRows(rows) {
  for (const r of rows) bad(r.caseName, r.fixture, () => {}, r.reason, r.field, r.errorClass, 'd22/' + r.key);
}

function chainFor(contract, run, table = run.table, schema = contract.bundle.annotationPayloadSchemaFileSha256.object, template = run.prompt.template) {
  return materializePromptChain({ protocol: contract.protocol, schemaObject: clone(schema), table: clone(table),
    templateBytes: template, rendererId: contract.protocol.prompts.rendererId });
}
// Derive all prompt, input, campaign and wrapper references from one chain.
// The evidence contains an invalid response; validWrapper is the separately
// materialized, accepting candidate used to check the campaign authority.
function bindChain(f, chain) {
  f.chain = chain;
  f.campaign.batchInputTableObjectSha256 = hash(chain.table);
  f.campaign.promptVariablesObjectSha256 = hash(chain.variables);
  f.campaign.orderedInputSha256 = imageInput(chain.table);
  if (f.campaign.replacementReasonCode === 'input-change') f.campaign.changedInputSha256 = hash(chain.table);
  f.evidence.changedInputSha256 = f.campaign.changedInputSha256;
  f.evidence.inputRefs.batchInputTableObjectSha256 = hash(chain.table);
  f.evidence.inputRefs.orderedInputSha256 = imageInput(chain.table);
  f.evidence.promptRefs = { promptRole: 'annotator', promptTemplateFileSha256: sha(chain.templateBytes),
    promptVariablesObjectSha256: hash(chain.variables), schemaFileSha256: sha(chain.schemaBytes),
    modelPayloadSchemaObjectSha256: hash(chain.schemaObject), renderedPromptEvidenceObjectSha256: hash(chain.evidence),
    renderedPromptSha256: sha(chain.rendered) };
  f.replacementInputs = { chain, schema: { object: chain.schemaObject, bytes: chain.schemaBytes,
    fileSha256: sha(chain.schemaBytes), objectSha256: hash(chain.schemaObject) }, table: chain.table,
    tableObjectSha256: hash(chain.table), prompt: { template: chain.templateBytes, variables: chain.variables,
      evidence: chain.evidence, rendered: chain.rendered, variablesObjectSha256: hash(chain.variables) } };
  bindWrapper(f);
}
function bindWrapper(f) {
  if (f.wrapperApplicable === false) { f.validWrapper = null; signInvalid(f); return; }
  f.validWrapper = materializeValidWrapper({ run: f.plannedRun, firstPlan: f.firstPlan,
    campaign: f.campaign, promptChain: f.chain, attemptNumber: 2, artifactId: 'negative-candidate-' + f.sourceReason });
  f.validWrapper.header.orderedInputSha256 = f.campaign.orderedInputSha256;
  f.validWrapper.inventory.find(i => i.kind === 'role-schema').fileSha256 = f.chain.schemaFileSha256;
  signArtifact(f.validWrapper);
  signInvalid(f);
}

export function buildReplacementNegativeRows(contract, workflow, rawResponseFile = null) {
  const run = workflow.runs[0], changedTable = clone(run.table);
  changedTable.orderedItems[0].attachmentSlot += '-new';
  const rootChain = chainFor(contract, run), changedChain = chainFor(contract, run, changedTable);
  const stale = materializeValidWrapper({ run, firstPlan: workflow.firstPlan, campaign: run.campaign,
    promptChain: rootChain, attemptNumber: 1, artifactId: 'stored-earlier-root' });
  stale.header.createdAtUtc = utc(3); signArtifact(stale);
  const futureCampaign = materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, reasonCode: 'model-retry' });
  const future = materializeValidWrapper({ run, firstPlan: workflow.firstPlan, campaign: futureCampaign,
    promptChain: rootChain, attemptNumber: 1, artifactId: 'stored-future-replacement' });
  future.header.createdAtUtc = utc(19); signArtifact(future);
  const authorities = { active: run, currentTable: run.table, newTable: changedTable, stale, future,
    schema: { object: rootChain.schemaObject, bytes: rootChain.schemaBytes },
    templateBytes: rootChain.templateBytes, variables: changedChain.variables, images: contract.images };
  const values = { 'active-file': run.fileSha256, 'current-table': hash(run.table), 'new-table': hash(changedTable),
    'stale-artifact': stale.fileSha256, 'future-artifact': future.fileSha256,
    'schema-file': sha(rootChain.schemaBytes), 'template-file': sha(rootChain.templateBytes),
    'prompt-variables': hash(changedChain.variables) };
  const rows = [], controls = [];
  for (const reason of REPLACEMENT_REASONS) {
    const chain = reason === 'input-change' ? changedChain : rootChain;
    const baseline = { protocol: contract.protocol, firstPlan: workflow.firstPlan, plannedRun: run,
      ...materializeOldInvalidEvidence(contract, workflow), sourceReason: reason, authorities, chain,
      rawResponseFile };
    baseline.campaign = materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, promptChain: chain, reasonCode: reason });
    baseline.evidence.replacementReasonCode = reason;
    bindChain(baseline, clone(chain));
    const add = (key, mutate, field, options) => row(rows, baseline, reason + '/' + key,
      f => { mutate(f); bindWrapper(f); }, field, options);
    for (const column of AUTHORITY_COLUMNS) {
      if (values[column] === baseline.campaign.changedInputSha256) {
        controls.push({ key: reason + '/authority/' + column, fixture: baseline }); continue;
      }
      add('authority/' + column, f => {
        f.campaign.changedInputSha256 = values[column]; f.evidence.changedInputSha256 = values[column];
      }, 'changedInputSha256');
    }
    for (const [label, field, evidenceField, value] of [
      ['active-id', 'activeArtifactIdBeforeCampaign', 'artifactId', stale.header.artifactId],
      ['active-file', 'activeArtifactFileSha256BeforeCampaign', 'artifactFileSha256', stale.fileSha256],
    ]) add('binding/' + label, f => { f.campaign[field] = value; f.evidence.activeArtifactBeforeCampaign[evidenceField] = value; }, field);
    for (const field of ['activeArtifactIdBeforeCampaign', 'activeArtifactFileSha256BeforeCampaign', 'replacementReasonCode', 'changedInputSha256'])
      add('null/' + field, f => {
        f.campaign[field] = null;
        if (field.startsWith('active')) f.evidence.activeArtifactBeforeCampaign = null;
        else f.evidence[field] = null;
      }, field);
    add('null/all', f => {
      for (const field of ['activeArtifactIdBeforeCampaign', 'activeArtifactFileSha256BeforeCampaign', 'replacementReasonCode', 'changedInputSha256']) f.campaign[field] = null;
      f.evidence.activeArtifactBeforeCampaign = null; f.evidence.replacementReasonCode = null; f.evidence.changedInputSha256 = null;
    }, 'activeArtifactIdBeforeCampaign');
    add('reason-mismatch', f => { f.evidence.replacementReasonCode = reason === 'model-retry' ? 'input-change' : 'model-retry'; }, 'replacementReasonCode');
    add('authority-mismatch', f => { f.evidence.changedInputSha256 = stale.fileSha256; }, 'changedInputSha256');
    for (const invalidReason of ['schema-fix', 'prompt-change', 'unknown']) add('enum/' + invalidReason, f => {
      f.campaign.replacementReasonCode = invalidReason; f.evidence.replacementReasonCode = invalidReason;
    }, 'replacementReasonCode', { errorClass: 'TypeError', reason: 'type-or-enum' });

    const changeSource = (key, mutate, field) => add('invariant/' + key, f => {
      const input = { table: clone(f.chain.table), schema: clone(f.chain.schemaObject), template: f.chain.templateBytes };
      mutate(input, f);
      // An image-set/identity mutation cannot have a valid wrapper under the
      // unchanged manifest. Its invalid-response evidence remains complete.
      if (['derivativeFileSha256', 'derivativeRgbaSha256', 'anonymousImageId', 'order', 'count'].includes(key)) f.wrapperApplicable = false;
      bindChain(f, chainFor(contract, run, input.table, input.schema, input.template));
    }, field);
    changeSource('template-byte', input => { input.template = input.template.replace(' ', '  '); }, 'promptTemplateFileSha256');
    if (reason === 'model-retry') changeSource('input-byte', input => { input.table.orderedItems[0].attachmentSlot += 'x'; }, 'batchInputTableObjectSha256');
    else {
      changeSource('schema', input => { input.schema.$comment = 'changed payload authority'; }, 'schemaFileSha256');
      for (const field of ['derivativeFileSha256', 'derivativeRgbaSha256', 'anonymousImageId']) changeSource(field,
        input => { input.table.orderedItems[0][field] = input.table.orderedItems[1][field]; }, field);
      changeSource('order', input => { input.table.orderedItems.reverse(); }, 'orderedItems');
      changeSource('count', input => { input.table.orderedItems.pop(); }, 'orderedItems');
      add('invariant/direct-variables', f => {
        // JSON remains parseable, but is not the exact canonical table string.
        f.chain.variables.batchInputTableCanonicalJson += ' ';
        f.chain.rendered = renderExactTemplate(f.chain.templateBytes, f.chain.variables, contract.protocol.prompts.rendererId);
        f.chain.evidence.promptVariablesObjectSha256 = hash(f.chain.variables);
        f.chain.evidence.renderedPromptSha256 = sha(f.chain.rendered);
        bindChain(f, f.chain);
      }, 'promptVariablesObjectSha256');
    }
  }
  return { rows, controls };
}

// Missing/duplicate/foreign prior evidence is a state-machine violation even
// when every individual evidence document has a valid schema and signature.
export function buildAttemptNegativeRows(contract, workflow, rawResponseFile = null) {
  const run = workflow.runs[0], rootChain = chainFor(contract, run);
  const table = clone(run.table); table.orderedItems[0].attachmentSlot += '-retry-input';
  const changedChain = chainFor(contract, run, table);
  const source = reason => {
    const f = { protocol: contract.protocol, firstPlan: workflow.firstPlan, plannedRun: run,
      ...materializeOldInvalidEvidence(contract, workflow), sourceReason: reason, rawResponseFile };
    f.campaign = reason === 'root' ? clone(run.campaign)
      : materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, reasonCode: reason, promptChain: changedChain });
    f.evidence.campaignKind = f.campaign.campaignKind;
    f.evidence.replacementReasonCode = f.campaign.replacementReasonCode;
    f.evidence.activeArtifactBeforeCampaign = reason === 'root' ? null
      : { artifactId: run.header.artifactId, artifactFileSha256: run.fileSha256 };
    bindChain(f, clone(reason === 'input-change' ? changedChain : rootChain));
    return f;
  };
  const sources = Object.fromEntries(['root', ...REPLACEMENT_REASONS].map(reason => [reason, source(reason)]));
  const evidenceAt = (sourceFixture, number) => {
    // Keep evidence as an evidence envelope, not a recursively duplicated run,
    // plan and prompt graph. Those authorities are retained once per baseline.
    const f = clone(Object.fromEntries(['campaign', 'evidence', 'rawResponseBytes', 'rawResponseFile',
      'evidenceBytes', 'evidenceFileSha256', 'evidenceFilename'].map(key => [key, sourceFixture[key]])));
    f.evidence.attemptNumber = number;
    f.evidence.disposition = number === 3 ? 'attempt-limit-reached' : 'retry-allowed';
    f.evidence.run.startedAtUtc = utc((number - 1) * 3);
    f.evidence.run.completedAtUtc = utc((number - 1) * 3 + 1);
    f.evidence.run.responseCapturedAtUtc = utc((number - 1) * 3 + 2);
    signInvalid(f); return f;
  };
  const rows = [];
  for (const reason of ['root', ...REPLACEMENT_REASONS]) for (const attempt of [2, 3]) {
    const s = sources[reason], replacement = reason !== 'root';
    for (const state of ['valid', 'invalid']) {
      const wrapper = state === 'valid' ? materializeValidWrapper({ run, firstPlan: workflow.firstPlan,
        campaign: s.campaign, promptChain: s.chain, attemptNumber: attempt,
        artifactId: replacement ? 'attempt-negative-' + reason : run.header.artifactId }) : null;
      const baseline = { protocol: contract.protocol, firstPlan: workflow.firstPlan, campaign: s.campaign,
        submissions: Array.from({ length: attempt }, (_, index) => ({ attemptNumber: index + 1,
          state: index === attempt - 1 ? state : 'invalid', freshContext: true })),
        invalidEvidence: Array.from({ length: state === 'valid' ? attempt - 1 : attempt }, (_, index) => evidenceAt(s, index + 1)),
        validWrapper: wrapper, activeBefore: replacement ? { artifactId: run.header.artifactId, fileSha256: run.fileSha256 } : null,
        atomicReplacement: replacement, activeDuringInvalid: replacement ? run.header.artifactId : null,
        requiredAnnotationRoot: true, failurePolicy: 'stop-pilot', invalidEvidenceInLedger: [], invalidEvidenceInSnapshots: [],
        promptChain: s.chain, foreignPromptChain: sources[replacement ? 'root' : 'model-retry'].chain,
        foreignEvidenceSource: evidenceAt(sources[replacement ? 'root' : 'model-retry'], 1) };
      const add = (key, mutate, field = 'invalidEvidence') => row(rows, baseline,
        'attempt/' + reason + '/' + state + '-' + attempt + '/' + key, mutate, field,
        { caseName: 'attempt-campaign', reason: 'attempt-campaign-invalid' });
      if (state === 'valid') add('planned-direct', f => {
        f.submissions = [f.submissions.at(-1)]; f.invalidEvidence = [];
      }, 'attemptNumber');
      for (let number = 1; number < attempt; number++) {
        const index = number - 1;
        add('missing-' + number, f => { f.invalidEvidence.splice(index, 1); });
        add('duplicate-' + number, f => { f.invalidEvidence.push(clone(f.invalidEvidence[index])); });
        add('foreign-' + number, f => {
          f.invalidEvidence[index] = evidenceAt(f.foreignEvidenceSource, number);
        });
        if (attempt === 3) add('number-duplicate-' + number, f => {
          f.invalidEvidence[index].evidence.attemptNumber = number === 1 ? 2 : 1;
          signInvalid(f.invalidEvidence[index]);
        });
      }
    }
  }
  return rows;
}

// A real one-edge history is retained as a source for ledger-entry mutations.
function ledgerCandidate(contract, workflow) {
  const old = workflow.runs[0], campaign = materializeReplacementCampaign({ run: old, firstPlan: workflow.firstPlan, reasonCode: 'model-retry' });
  const replacement = materializeValidWrapper({ run: old, firstPlan: workflow.firstPlan, campaign,
    attemptNumber: 1, artifactId: 'stored-ledger-replacement' });
  const entry = { recordType: 'artifact-supersession', sequence: 1, artifactKind: old.header.artifactKind,
    logicalSlot: old.header.logicalSlot, supersededArtifactId: old.header.artifactId, supersededArtifactFileSha256: old.fileSha256,
    replacementArtifactId: replacement.header.artifactId, replacementArtifactFileSha256: replacement.fileSha256,
    reasonCode: 'model-retry', changedInputSha256: old.fileSha256 };
  return { replacement, entry, ledger: makeLedger(contract, workflow.firstPlan, [entry], workflow.emptyLedger) };
}

export function buildReissueNegativeRows(contract, workflow, built) {
  const old = built.oldGraph, next = built.newGraph, history = ledgerCandidate(contract, workflow);
  const newCampaign = { ...workflow.runs[0].campaign, slotPlanObjectSha256: hash(next.firstPlan),
    promptVariablesObjectSha256: hash(next.prompts[0].variables), batchInputTableObjectSha256: hash(next.inputTables[0]) };
  const newRun = materializeValidWrapper({ run: workflow.runs[0], firstPlan: next.firstPlan,
    campaign: newCampaign, promptChain: next.prompts[0], attemptNumber: 1, artifactId: next.firstPlan.slots[0].rootArtifactId });
  newRun.header.protocolObjectSha256 = hash(next.protocol); newRun.header.blindedManifestObjectSha256 = hash(next.manifest);
  newRun.inventory.find(i => i.kind === 'protocol-object').fileSha256 = sha(fileBytes(next.protocol));
  newRun.inventory.find(i => i.kind === 'role-schema').fileSha256 = next.prompts[0].schemaFileSha256;
  signArtifact(newRun);
  const newLedger = makeLedger({ ...contract, protocol: next.protocol, manifest: next.manifest }, next.firstPlan, [], null);
  const sources = { oldProtocol: old.protocol, oldSelection: old.selection, oldManifest: old.manifest,
    oldFirstPlan: old.firstPlan, oldSecondPlan: built.old.secondPlan, oldLedger: old.ledger,
    oldRun: old.runs[0], oldCampaign: old.campaigns[0], oldEvidence: old.invalidEvidence[0],
    oldSnapshot: old.snapshots[0], oldApproval: workflow.approvals[0], oldCoverage: workflow.coverage,
    availableSecondPlan: workflow.freshPlan, history, newRun, newLedger };
  const baseline = { protocol: old.protocol, selectionPlan: old.selection, oldFirstPlan: old.firstPlan,
    oldSecondPlan: built.old.secondPlan, oldLedger: old.ledger,
    closure: built.closure, closureBytes: built.closureBytes, closureFileSha256: built.closureFileSha256, closureFilename: built.closureFilename,
    freezeOrder: built.freezeOrder, newProtocol: next.protocol, newSelection: next.selection, newManifest: next.manifest,
    newRestricted: next.restricted, newTable: next.inputTables[0], newVariables: next.prompts[0].variables,
    newEvidence: next.prompts[0].evidence, newRendered: next.prompts[0].rendered, newFirstPlan: next.firstPlan,
    newSchema: { object: built.schema, bytes: fileBytes(built.schema), fileSha256: sha(fileBytes(built.schema)), objectSha256: hash(built.schema) },
    newTemplateBytes: built.template, oldInventory: built.oldInventory, newInventory: built.newInventory,
    oldIds: built.oldIds, newIds: built.newIds, sources,
    oldPlanSubmissionsAfterClosure: [], oldPlanRootsAfterClosure: [], oldPlanLedgerEntriesAfterClosure: [],
    oldPlanApprovalsAfterClosure: [], oldPlanCoverageAfterClosure: [], crossPlanReferences: [],
    ...Object.fromEntries(ZERO_COLLECTIONS.map(key => ['newPlan' + key, []])) };
  const rows = [], prefix = 'reissue/' + (built.old.secondPlan ? 'second-plan/' : 'no-second-plan/');
  const add = (key, mutate, field, resign = false) => row(rows, baseline, prefix + key,
    f => { mutate(f); if (resign) signClosure(f); }, field,
    { caseName: 'plan-reissue', reason: 'protocol-reissue-required' });
  for (const [key, field, value] of [
    ['old-protocol', 'oldProtocolObjectSha256', hash(next.protocol)],
    ['old-selection', 'oldSelectionPlanObjectSha256', hash(next.selection)],
    ['old-first-plan', 'oldAnnotationConsensusSlotPlanObjectSha256', hash(next.firstPlan)],
    ['old-second-plan', 'oldPostConsensusRouteSlotPlanObjectSha256', built.old.secondPlan ? hash(workflow.skippedPlan) : hash(workflow.freshPlan)],
    ['old-ledger', 'oldSupersessionLedgerFileSha256', history.ledger.fileSha256],
    ['cutoff-terminal-plus-one', 'oldCutoffSequence', old.ledger.records[0].lastSequence + 1],
    ['cutoff-negative', 'oldCutoffSequence', -1], ['cutoff-fraction', 'oldCutoffSequence', 0.5],
    ['cutoff-unsafe', 'oldCutoffSequence', Number.MAX_SAFE_INTEGER + 1],
    ['terminal', 'terminalState', 'open'], ['reason', 'reasonCode', 'schema-fix'],
    ['reason-valid-mismatch', 'reasonCode', built.closure.reasonCode === 'schema-change' ? 'prompt-change' : 'schema-change'],
    ['model-allowed', 'furtherModelSubmissionsAllowed', true], ['root-allowed', 'furtherRootMaterializationAllowed', true],
  ]) add('closure/' + key, f => { f.closure[field] = value; }, field, true);
  if (built.old.secondPlan) add('closure/second-plan-to-null', f => { f.closure.oldPostConsensusRouteSlotPlanObjectSha256 = null; }, 'oldPostConsensusRouteSlotPlanObjectSha256', true);
  for (const [key, value] of [['fraction', '2026-01-01T00:00:20.000Z'], ['offset', '2026-01-01T00:00:20+00:00'],
    ['lowercase', '2026-01-01t00:00:20z'], ['impossible', '2026-02-30T00:00:20Z']])
    add('closure/utc-' + key, f => { f.closure.closedAtUtc = value; }, 'closedAtUtc', true);
  add('closure/id', f => { f.closure.planClosureId = hash(f.closure); f.closureBytes = fileBytes(f.closure);
    f.closureFileSha256 = sha(f.closureBytes); f.closureFilename = f.closure.planClosureId + '.json'; }, 'planClosureId');
  add('closure/bytes', f => { f.closureBytes += '\n'; f.closureFileSha256 = sha(f.closureBytes); }, 'closureBytes');
  add('closure/file-hash', f => { f.closureFileSha256 = hash(f.closure); }, 'closureFileSha256');
  add('closure/filename', f => { f.closureFilename = hash(f.closure) + '.json'; }, 'closureFilename');
  for (const [field, value] of [ ['newProtocolObjectSha256', hash(next.protocol)], ['newAnnotationConsensusSlotPlanObjectSha256', hash(next.firstPlan)],
    ['newRootArtifactId', newRun.header.artifactId], ['newApprovalArtifactFileSha256', sources.oldApproval.fileSha256],
    ['newSupersessionLedgerFileSha256', newLedger.fileSha256] ])
    add('closure/unknown-' + field, f => { f.closure[field] = value; }, field, true);

  const collections = { MaterializedRoots: sources.oldRun, Runs: sources.oldRun, Campaigns: sources.oldCampaign,
    InvalidEvidence: sources.oldEvidence.evidence, LedgerEntries: history.entry, Snapshots: sources.oldSnapshot,
    SecondPlans: sources.availableSecondPlan, Approvals: sources.oldApproval.records[0], Coverage: sources.oldCoverage.records[0] };
  for (const key of ZERO_COLLECTIONS) add('nonempty/' + key, f => { f['newPlan' + key] = [clone(collections[key])]; }, 'newPlan' + key);
  for (const [kind, field, candidate] of [
    ['submission', 'oldPlanSubmissionsAfterClosure', sources.oldRun], ['root', 'oldPlanRootsAfterClosure', sources.oldRun],
    ['replacement', 'oldPlanRootsAfterClosure', history.replacement], ['ledger', 'oldPlanLedgerEntriesAfterClosure', history.entry],
    ['approval', 'oldPlanApprovalsAfterClosure', sources.oldApproval], ['coverage', 'oldPlanCoverageAfterClosure', sources.oldCoverage],
  ]) for (const time of [19, 21]) add('post-closure/' + kind + '/' + time, f => {
    const artifact = clone(kind === 'ledger' ? history.ledger : candidate);
    if (artifact.header) { artifact.header.createdAtUtc = utc(time); if (artifact.header.generator.kind === 'vision-model') {
      artifact.header.generator.startedAtUtc = utc(time); artifact.header.generator.completedAtUtc = utc(time);
      artifact.header.generator.responseCapture.capturedAtUtc = utc(time);
    } signArtifact(artifact); }
    f[field] = [kind === 'ledger' ? clone(history.entry) : artifact];
    if (kind === 'ledger') f.postClosureLedger = artifact;
  }, field);
  for (const [key, field, source] of [['selection', 'newSelection', sources.oldSelection], ['manifest', 'newManifest', sources.oldManifest],
    ['first-plan', 'newFirstPlan', sources.oldFirstPlan]]) add('reuse/' + key, f => { f[field] = clone(source); }, field);
  add('protocol-hash-only', f => { f.newFirstPlan = { ...clone(f.oldFirstPlan), protocolObjectSha256: hash(f.newProtocol) }; }, 'newFirstPlan');
  add('reuse/active-root-id', f => { f.newFirstPlan.slots[0].rootArtifactId = f.sources.oldRun.header.artifactId; }, 'rootArtifactId');
  for (const [key, source] of [['active', sources.oldRun], ['campaign', sources.oldCampaign], ['evidence', sources.oldEvidence.evidence],
    ['ledger', sources.oldLedger], ['snapshot', sources.oldSnapshot], ['approval', sources.oldApproval.records[0]], ['coverage', sources.oldCoverage.records[0]]])
    add('reuse/' + key, f => {
      const value = clone(source), inventory = value.header ? {
        objectSha256: hash([value.header, ...value.records]), fileSha256: value.fileSha256, bytesSha256: sha(value.bytes),
        artifactId: value.header.artifactId, embeddedRefs: flattenArtifactReferences([value.header, ...value.records]),
      } : collectArtifactInventory([value])[0];
      f.reusedArtifact = value; f.newInventory.push(inventory);
      f.newIds.push(inventory.objectSha256, inventory.fileSha256, ...flattenArtifactReferences(value).map(([, v]) => v));
    }, 'newInventory');
  add('cross-plan/ledger', f => {
    const entry = { ...clone(f.sources.history.entry), replacementArtifactId: f.sources.newRun.header.artifactId,
      replacementArtifactFileSha256: f.sources.newRun.fileSha256 };
    f.crossPlanLedger = makeLedger(contract, old.firstPlan, [entry], old.ledger);
    f.crossPlanReferences = [entry];
  }, 'crossPlanReferences');
  add('cross-plan/root-lineage', f => {
    const artifact = clone(f.sources.newRun);
    artifact.campaign.campaignKind = 'replacement-materialization'; artifact.campaign.replacementReasonCode = 'model-retry';
    artifact.campaign.activeArtifactIdBeforeCampaign = f.sources.oldRun.header.artifactId;
    artifact.campaign.activeArtifactFileSha256BeforeCampaign = f.sources.oldRun.fileSha256;
    artifact.campaign.changedInputSha256 = f.sources.oldRun.fileSha256;
    artifact.header.generator.campaignIdSha256 = hash(artifact.campaign); signArtifact(artifact);
    f.crossPlanReferences = [artifact];
  }, 'crossPlanReferences');
  add('new-dag/closure', f => {
    f.newFirstPlan.protocolObjectSha256 = hash(f.closure);
    const item = f.newInventory.find(value => value.name === 'firstPlan');
    item.objectSha256 = hash(f.newFirstPlan); item.fileSha256 = sha(fileBytes(f.newFirstPlan)); item.bytesSha256 = item.fileSha256;
    item.embeddedRefs = flattenArtifactReferences(f.newFirstPlan);
    f.newDagClosureReference = hash(f.closure);
  }, 'newDagClosureReference');
  add('freeze-order', f => { [f.freezeOrder[2], f.freezeOrder[3]] = [f.freezeOrder[3], f.freezeOrder[2]]; }, 'freezeOrder');
  for (const attempt of [2, 3]) add('initial-attempt/' + attempt, f => {
    f.newSubmission = clone(f.sources.newRun); f.newSubmission.header.generator.attemptNumber = attempt; signArtifact(f.newSubmission);
    f.newCampaignState = 'planned'; f.newPriorInvalidEvidence = [];
  }, 'attemptNumber');
  return rows;
}
