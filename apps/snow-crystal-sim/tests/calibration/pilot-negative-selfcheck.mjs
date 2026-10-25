// Independent D-22 negative-fixture audit. This file never imports or calls
// the validator. Rejection expectations are literal test-contract metadata.
import { pathToFileURL } from 'node:url';
import { assert, clone, fileBytes, hash, jcs, sha, whash, schemaAccepts, utc } from './pilot-oracle.mjs';
import { materializeOldGraph, materializeReissuePlan, REISSUE_CAUSES,
  flattenArtifactReferences } from './pilot-d20-builders.mjs';
import { buildReplacementNegativeRows, buildAttemptNegativeRows, buildReissueNegativeRows } from './pilot-d20-negative-builders.mjs';

const eq = assert.deepEqual;
const reasons = ['model-retry', 'input-change'];
const columns = ['active-file', 'current-table', 'new-table', 'stale-artifact', 'future-artifact', 'schema-file', 'template-file', 'prompt-variables'];
const nullFields = ['activeArtifactIdBeforeCampaign', 'activeArtifactFileSha256BeforeCampaign', 'replacementReasonCode', 'changedInputSha256'];
const zeroTypes = { MaterializedRoots: 'artifact', Runs: 'artifact', Campaigns: 'campaign',
  InvalidEvidence: 'invalidAttemptEvidenceSchemaFileSha256', LedgerEntries: 'supersessionLedgerSchemaFileSha256',
  Snapshots: 'activeAnnotationConsensusSnapshotSchemaFileSha256', SecondPlans: 'postConsensusRouteSlotPlanSchemaFileSha256',
  Approvals: 'humanApprovalSchemaFileSha256', Coverage: 'artifactSchemaFileSha256' };
const closureFields = {
  'old-protocol': 'oldProtocolObjectSha256', 'old-selection': 'oldSelectionPlanObjectSha256',
  'old-first-plan': 'oldAnnotationConsensusSlotPlanObjectSha256', 'old-second-plan': 'oldPostConsensusRouteSlotPlanObjectSha256',
  'old-ledger': 'oldSupersessionLedgerFileSha256', 'cutoff-terminal-plus-one': 'oldCutoffSequence',
  'cutoff-negative': 'oldCutoffSequence', 'cutoff-fraction': 'oldCutoffSequence', 'cutoff-unsafe': 'oldCutoffSequence',
  terminal: 'terminalState', reason: 'reasonCode', 'reason-valid-mismatch': 'reasonCode',
  'model-allowed': 'furtherModelSubmissionsAllowed', 'root-allowed': 'furtherRootMaterializationAllowed',
  'second-plan-to-null': 'oldPostConsensusRouteSlotPlanObjectSha256',
  'utc-fraction': 'closedAtUtc', 'utc-offset': 'closedAtUtc', 'utc-lowercase': 'closedAtUtc', 'utc-impossible': 'closedAtUtc',
  id: 'planClosureId', bytes: 'closureBytes', 'file-hash': 'closureFileSha256', filename: 'closureFilename',
};
const newReferences = ['newProtocolObjectSha256', 'newAnnotationConsensusSlotPlanObjectSha256', 'newRootArtifactId',
  'newApprovalArtifactFileSha256', 'newSupersessionLedgerFileSha256'];
const postClosureFields = { submission: 'oldPlanSubmissionsAfterClosure', root: 'oldPlanRootsAfterClosure',
  replacement: 'oldPlanRootsAfterClosure', ledger: 'oldPlanLedgerEntriesAfterClosure',
  approval: 'oldPlanApprovalsAfterClosure', coverage: 'oldPlanCoverageAfterClosure' };

function changedKeys(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => jcs(a[k] ?? null) !== jcs(b[k] ?? null)).sort();
}
function onlyKeys(a, b, allowed, label) {
  const actual = changedKeys(a, b);
  assert(actual.length, 'nonempty mutation ' + label);
  for (const key of actual) assert(allowed.includes(key), label + ': unintended mutation ' + key);
}
function checkSchema(contract, key, value) {
  assert(contract.bundle[key], 'known schema ' + key);
  assert(schemaAccepts(contract.bundle[key].object, value), key + ' accepts concrete object');
}
function checkArtifact(contract, value) {
  assert(value.header && Array.isArray(value.records));
  eq(value.bytes, [value.header, ...value.records].map(fileBytes).join(''));
  eq(value.fileSha256, sha(value.bytes));
  for (const record of [value.header, ...value.records]) checkSchema(contract, 'artifactSchemaFileSha256', record);
  if (value.campaign) eq(value.header.generator.campaignIdSha256, hash(value.campaign));
}
function checkEvidence(contract, f, enumInvalid = false) {
  const { invalidAttemptEvidenceId, ...body } = f.evidence;
  eq(invalidAttemptEvidenceId, whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body }));
  eq(f.evidenceBytes, fileBytes(f.evidence)); eq(f.evidenceFileSha256, sha(f.evidenceBytes));
  eq(f.evidenceFilename, invalidAttemptEvidenceId + '.json'); eq(f.evidence.campaignIdSha256, hash(f.campaign));
  eq(f.evidence.rawResponseSha256, sha(f.rawResponseBytes)); eq(f.evidence.rawResponseByteLength, Buffer.byteLength(f.rawResponseBytes));
  eq(schemaAccepts(contract.bundle.invalidAttemptEvidenceSchemaFileSha256.object, f.evidence), !enumInvalid);
}
function checkPromptChain(f) {
  const chain = f.chain;
  eq(chain.schemaBytes, fileBytes(chain.schemaObject)); eq(chain.schemaFileSha256, sha(chain.schemaBytes));
  eq(chain.modelPayloadSchemaObjectSha256, hash(chain.schemaObject)); eq(chain.batchInputTableObjectSha256, hash(chain.table));
  eq(chain.variables.protocolCanonicalJson, jcs(f.protocol)); eq(chain.variables.protocolObjectSha256, hash(f.protocol));
  eq(chain.variables.modelPayloadSchemaCanonicalJson, jcs(chain.schemaObject));
  eq(chain.variables.modelPayloadSchemaObjectSha256, hash(chain.schemaObject));
  eq(chain.variables.schemaFileSha256, sha(chain.schemaBytes));
  eq(chain.variables.batchInputTableObjectSha256, hash(chain.table));
  // Independently reproduce byte substitution without the positive renderer.
  const names = ['protocolCanonicalJson', 'modelPayloadSchemaCanonicalJson', 'batchInputTableCanonicalJson'];
  const tokens = ['{{PROTOCOL_CANONICAL_JSON}}', '{{MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON}}', '{{BATCH_INPUT_TABLE_CANONICAL_JSON}}'];
  const pieces = []; let cursor = 0;
  const positions = tokens.map((token, i) => ({ start: chain.templateBytes.indexOf(token), token, i })).sort((a, b) => a.start - b.start);
  for (const p of positions) { assert(p.start >= 0); pieces.push(chain.templateBytes.slice(cursor, p.start), chain.variables[names[p.i]]); cursor = p.start + p.token.length; }
  pieces.push(chain.templateBytes.slice(cursor)); eq(chain.rendered, pieces.join(''));
  eq(chain.evidence.protocolObjectSha256, hash(f.protocol));
  eq(chain.evidence.promptTemplateFileSha256, sha(chain.templateBytes));
  eq(chain.evidence.promptVariablesObjectSha256, hash(chain.variables));
  eq(chain.evidence.schemaFileSha256, sha(chain.schemaBytes));
  eq(chain.evidence.modelPayloadSchemaObjectSha256, hash(chain.schemaObject));
  eq(chain.evidence.renderedPromptSha256, sha(chain.rendered));
  eq(f.campaign.promptVariablesObjectSha256, hash(chain.variables)); eq(f.campaign.batchInputTableObjectSha256, hash(chain.table));
  eq(f.campaign.orderedInputSha256, whash('ordered-image-input', { orderedItems: chain.table.orderedItems.map(({ attachmentSlot, ...item }) => item) }));
  eq(f.evidence.inputRefs.batchInputTableObjectSha256, hash(chain.table)); eq(f.evidence.inputRefs.orderedInputSha256, f.campaign.orderedInputSha256);
  eq(f.evidence.promptRefs, { promptRole: 'annotator', promptTemplateFileSha256: sha(chain.templateBytes),
    promptVariablesObjectSha256: hash(chain.variables), schemaFileSha256: sha(chain.schemaBytes), modelPayloadSchemaObjectSha256: hash(chain.schemaObject),
    renderedPromptEvidenceObjectSha256: hash(chain.evidence), renderedPromptSha256: sha(chain.rendered) });
  eq(f.replacementInputs.chain, chain); eq(f.replacementInputs.table, chain.table);
  eq(f.replacementInputs.prompt.variables, chain.variables); eq(f.replacementInputs.prompt.evidence, chain.evidence);
  eq(f.replacementInputs.prompt.rendered, chain.rendered);
}
function replacementExpectedKeys() {
  return reasons.flatMap(reason => [
    ...columns.filter(column => column !== (reason === 'model-retry' ? 'active-file' : 'new-table')).map(column => reason + '/authority/' + column),
    ...['active-id', 'active-file'].map(key => reason + '/binding/' + key),
    ...[...nullFields, 'all'].map(key => reason + '/null/' + key), reason + '/reason-mismatch', reason + '/authority-mismatch',
    ...['schema-fix', 'prompt-change', 'unknown'].map(key => reason + '/enum/' + key),
    ...(reason === 'model-retry' ? ['template-byte', 'input-byte'] : ['template-byte', 'schema', 'derivativeFileSha256',
      'derivativeRgbaSha256', 'anonymousImageId', 'order', 'count', 'direct-variables']).map(key => reason + '/invariant/' + key),
  ]).sort();
}
export function assertReplacementNegatives(contract, matrix) {
  const { rows, controls } = matrix;
  eq(rows.map(r => r.key).sort(), replacementExpectedKeys()); eq(rows.length, 48);
  eq(controls.map(c => c.key).sort(), ['input-change/authority/new-table', 'model-retry/authority/active-file']);
  for (const { fixture: f } of controls) {
    checkEvidence(contract, f); checkPromptChain(f); checkArtifact(contract, f.validWrapper);
    eq(f.campaign.changedInputSha256, f.sourceReason === 'model-retry'
      ? sha(f.authorities.active.bytes) : hash(f.authorities.newTable));
    eq(f.evidence.changedInputSha256, f.campaign.changedInputSha256);
    eq(f.evidence.replacementReasonCode, f.sourceReason);
    eq(f.campaign.activeArtifactIdBeforeCampaign, f.plannedRun.header.artifactId);
    eq(f.campaign.activeArtifactFileSha256BeforeCampaign, f.plannedRun.fileSha256);
  }
  for (const r of rows) {
    const f = r.fixture, b = r.baseline, [reason, group, key] = r.key.split('/');
    eq(hash(b), r.baselineHash); eq(f.protocol, b.protocol); eq(f.firstPlan, b.firstPlan); eq(f.plannedRun, b.plannedRun);
    eq(f.authorities, b.authorities); eq(f.sourceReason, reason);
    const enumInvalid = group === 'enum';
    eq(r.caseName, 'invalid-attempt'); eq(r.errorClass, enumInvalid ? 'TypeError' : 'RangeError');
    eq(r.reason, enumInvalid ? 'type-or-enum' : 'invalid-attempt-evidence');
    const expectedField = group === 'authority' || group === 'authority-mismatch' ? 'changedInputSha256'
      : group === 'binding' ? key === 'active-id' ? 'activeArtifactIdBeforeCampaign' : 'activeArtifactFileSha256BeforeCampaign'
      : group === 'null' ? key === 'all' ? 'activeArtifactIdBeforeCampaign' : key
      : group === 'enum' || group === 'reason-mismatch' ? 'replacementReasonCode'
      : ({ 'template-byte': 'promptTemplateFileSha256', 'input-byte': 'batchInputTableObjectSha256', schema: 'schemaFileSha256',
        order: 'orderedItems', count: 'orderedItems', 'direct-variables': 'promptVariablesObjectSha256' }[key] ?? key);
    eq(r.field, expectedField);
    checkEvidence(contract, f, enumInvalid); checkPromptChain(f);
    const a = f.authorities;
    for (const artifact of [a.active, a.stale, a.future]) checkArtifact(contract, artifact);
    eq(a.schema.bytes, fileBytes(a.schema.object));
    const authorityValues = { 'active-file': a.active.fileSha256, 'current-table': hash(a.currentTable), 'new-table': hash(a.newTable),
      'stale-artifact': sha(a.stale.bytes), 'future-artifact': sha(a.future.bytes), 'schema-file': sha(a.schema.bytes),
      'template-file': sha(a.templateBytes), 'prompt-variables': hash(a.variables) };
    if (group !== 'invariant') eq(f.chain, b.chain);
    if (group === 'authority') {
      eq(f.campaign.changedInputSha256, authorityValues[key]); eq(f.evidence.changedInputSha256, authorityValues[key]);
      assert.notEqual(authorityValues[key], b.campaign.changedInputSha256);
      eq(changedKeys(b.campaign, f.campaign), ['changedInputSha256']);
    } else if (group === 'binding') {
      eq(changedKeys(b.campaign, f.campaign), [expectedField]);
      eq(f.campaign[expectedField], key === 'active-id' ? a.stale.header.artifactId : a.stale.fileSha256);
    } else if (group === 'null') {
      const fields = key === 'all' ? nullFields : [key];
      eq(changedKeys(b.campaign, f.campaign), [...fields].sort());
      fields.forEach(field => eq(f.campaign[field], null));
      if (key === 'all' || key.startsWith('active')) eq(f.evidence.activeArtifactBeforeCampaign, null);
    } else if (group === 'enum') {
      eq(changedKeys(b.campaign, f.campaign), ['replacementReasonCode']); eq(f.campaign.replacementReasonCode, key); eq(f.evidence.replacementReasonCode, key);
    } else if (group === 'reason-mismatch') {
      eq(f.campaign, b.campaign); eq(f.evidence.replacementReasonCode, reason === 'model-retry' ? 'input-change' : 'model-retry');
    } else if (group === 'authority-mismatch') { eq(f.campaign, b.campaign); eq(f.evidence.changedInputSha256, a.stale.fileSha256); }
    else {
      const primary = c => ({ table: c.table, schema: c.schemaObject, template: c.templateBytes,
        direct: c.variables.batchInputTableCanonicalJson === jcs(c.table) ? null : c.variables.batchInputTableCanonicalJson });
      eq(changedKeys(primary(b.chain), primary(f.chain)), [key === 'schema' ? 'schema' : key === 'template-byte' ? 'template' : key === 'direct-variables' ? 'direct' : 'table']);
      if (key === 'template-byte') eq(f.chain.templateBytes, b.chain.templateBytes.replace(' ', '  '));
      else if (key === 'schema') eq(f.chain.schemaObject, { ...b.chain.schemaObject, $comment: 'changed payload authority' });
      else if (key === 'direct-variables') eq(f.chain.variables.batchInputTableCanonicalJson, jcs(f.chain.table) + ' ');
      else {
        const expected = clone(b.chain.table);
        if (key === 'input-byte') expected.orderedItems[0].attachmentSlot += 'x';
        else if (key === 'order') expected.orderedItems.reverse();
        else if (key === 'count') expected.orderedItems.pop();
        else expected.orderedItems[0][key] = expected.orderedItems[1][key];
        eq(f.chain.table, expected);
      }
    }
    if (group !== 'invariant' || key !== 'direct-variables') eq(f.chain.variables.batchInputTableCanonicalJson, jcs(f.chain.table));
    if (f.validWrapper) {
      checkArtifact(contract, f.validWrapper); eq(f.validWrapper.campaign, f.campaign);
      eq(f.validWrapper.table, f.chain.table); eq(f.validWrapper.header.batchInputTableObjectSha256, hash(f.chain.table));
      eq(f.validWrapper.header.orderedInputSha256, f.campaign.orderedInputSha256);
      eq(f.validWrapper.header.generator.attemptNumber, 2);
      for (const [name, value] of Object.entries(f.evidence.promptRefs)) eq(f.validWrapper.header.generator[name], value);
      eq(f.validWrapper.prompt.variables, f.chain.variables); eq(f.validWrapper.prompt.evidence, f.chain.evidence);
      eq(f.validWrapper.prompt.rendered, f.chain.rendered);
    } else assert(['derivativeFileSha256', 'derivativeRgbaSha256', 'anonymousImageId', 'order', 'count'].includes(key));
  }
  eq(new Set(rows.map(r => hash(r.fixture))).size, rows.length);
  return { rows: rows.length, authorityCells: 16, authorityNegatives: 14, authorityPositiveControls: 2,
    schemaLevelTypeErrors: rows.filter(r => r.errorClass === 'TypeError').length, keys: rows.map(r => r.key) };
}

export function assertAttemptNegatives(contract, rows) {
  const expectedKeys = [];
  for (const reason of ['root', 'model-retry', 'input-change']) for (const attempt of [2, 3])
    for (const state of ['valid', 'invalid']) {
      const prefix = `attempt/${reason}/${state}-${attempt}/`;
      if (state === 'valid') expectedKeys.push(prefix + 'planned-direct');
      for (let number = 1; number < attempt; number++) for (const kind of
        ['missing', 'duplicate', 'foreign', ...(attempt === 3 ? ['number-duplicate'] : [])]) expectedKeys.push(prefix + kind + '-' + number);
    }
  eq(rows.map(r => r.key).sort(), expectedKeys.sort()); eq(rows.length, 72);
  for (const r of rows) {
    const b = r.baseline, f = r.fixture, [, reason, terminal, mutation] = r.key.split('/');
    const [state, textAttempt] = terminal.split('-'), attempt = Number(textAttempt);
    eq(hash(b), r.baselineHash); eq(r.caseName, 'attempt-campaign');
    eq(r.errorClass, 'RangeError'); eq(r.reason, 'attempt-campaign-invalid');
    eq(r.field, mutation === 'planned-direct' ? 'attemptNumber' : 'invalidEvidence');
    eq(b.submissions.map(s => s.attemptNumber), Array.from({ length: attempt }, (_, i) => i + 1));
    eq(b.invalidEvidence.map(e => e.evidence.attemptNumber), Array.from({ length: state === 'valid' ? attempt - 1 : attempt }, (_, i) => i + 1));
    eq(b.campaign.campaignKind, reason === 'root' ? 'root-materialization' : 'replacement-materialization');
    eq(b.campaign.replacementReasonCode, reason === 'root' ? null : reason);
    eq(f.campaign, b.campaign); eq(f.validWrapper, b.validWrapper);
    if (f.validWrapper) {
      checkArtifact(contract, f.validWrapper);
      eq(f.validWrapper.campaign, f.campaign); eq(f.validWrapper.header.generator.attemptNumber, attempt);
      eq(f.validWrapper.header.annotationConsensusSlotPlanObjectSha256, hash(f.firstPlan));
    }
    for (const e of [...b.invalidEvidence, ...f.invalidEvidence, f.foreignEvidenceSource]) {
      checkEvidence(contract, e);
      const chain = hash(e.campaign) === hash(f.campaign) ? f.promptChain : f.foreignPromptChain;
      eq(e.evidence.inputRefs.protocolObjectSha256, hash(f.protocol));
      eq(e.evidence.inputRefs.batchInputTableObjectSha256, hash(chain.table));
      eq(e.evidence.promptRefs.promptVariablesObjectSha256, hash(chain.variables));
      eq(e.evidence.promptRefs.renderedPromptEvidenceObjectSha256, hash(chain.evidence));
      eq(e.evidence.promptRefs.renderedPromptSha256, sha(chain.rendered));
      eq(e.evidence.promptRefs.schemaFileSha256, sha(chain.schemaBytes));
      eq(e.evidence.promptRefs.modelPayloadSchemaObjectSha256, hash(chain.schemaObject));
      eq(e.evidence.promptRefs.promptTemplateFileSha256, sha(chain.templateBytes));
      eq(e.evidence.slotPlanObjectSha256, hash(f.firstPlan));
    }
    if (mutation === 'planned-direct') {
      eq(changedKeys(b, f), ['invalidEvidence', 'submissions']);
      eq(f.submissions, [b.submissions.at(-1)]); eq(f.invalidEvidence, []);
    } else {
      eq(changedKeys(b, f), ['invalidEvidence']);
      const number = Number(mutation.at(-1)), index = number - 1;
      const expected = clone(b.invalidEvidence);
      if (mutation.startsWith('missing-')) expected.splice(index, 1);
      else if (mutation.startsWith('duplicate-')) expected.push(clone(expected[index]));
      else if (mutation.startsWith('foreign-')) {
        const replacement = f.invalidEvidence[index];
        assert.notEqual(hash(replacement.campaign), hash(f.campaign));
        eq(replacement.campaign, f.foreignEvidenceSource.campaign);
        eq(replacement.evidence.attemptNumber, number);
        expected[index] = replacement;
      } else {
        const replacement = f.invalidEvidence[index];
        eq(replacement.evidence.attemptNumber, number === 1 ? 2 : 1);
        const before = clone(b.invalidEvidence[index].evidence), after = clone(replacement.evidence);
        delete before.invalidAttemptEvidenceId; delete after.invalidAttemptEvidenceId;
        eq(changedKeys(before, after), ['attemptNumber']);
        eq(changedKeys(b.invalidEvidence[index], replacement), ['evidence', 'evidenceBytes', 'evidenceFileSha256', 'evidenceFilename']);
        expected[index] = replacement;
      }
      eq(f.invalidEvidence, expected);
    }
  }
  eq(new Set(rows.map(r => hash(r.fixture))).size, rows.length);
  return { rows: rows.length, keys: rows.map(r => r.key) };
}

function expectedReissueKeys(second) {
  const closure = Object.keys(closureFields).filter(key => second || key !== 'second-plan-to-null');
  return [ ...closure.map(key => 'closure/' + key), ...newReferences.map(key => 'closure/unknown-' + key),
    ...Object.keys(zeroTypes).map(key => 'nonempty/' + key),
    ...Object.keys(postClosureFields).flatMap(key => [19, 21].map(time => 'post-closure/' + key + '/' + time)),
    ...['selection', 'manifest', 'first-plan', 'active-root-id', 'active', 'campaign', 'evidence', 'ledger', 'snapshot', 'approval', 'coverage'].map(key => 'reuse/' + key),
    'protocol-hash-only', 'cross-plan/ledger', 'cross-plan/root-lineage', 'new-dag/closure', 'freeze-order', 'initial-attempt/2', 'initial-attempt/3',
  ].map(key => 'reissue/' + (second ? 'second-plan/' : 'no-second-plan/') + key).sort();
}
export function assertReissueNegatives(contract, rows, second) {
  eq(rows.map(r => r.key).sort(), expectedReissueKeys(second)); eq(rows.length, second ? 67 : 66);
  for (const r of rows) {
    const f = r.fixture, b = r.baseline, [, , group, key, time] = r.key.split('/');
    eq(hash(b), r.baselineHash); eq(f.sources, b.sources);
    eq(r.caseName, 'plan-reissue'); eq(r.errorClass, 'RangeError'); eq(r.reason, 'protocol-reissue-required');
    const expectedField = group === 'closure' ? key.startsWith('unknown-') ? key.slice(8) : closureFields[key]
      : group === 'nonempty' ? 'newPlan' + key : group === 'post-closure' ? postClosureFields[key]
      : group === 'reuse' ? ({ selection: 'newSelection', manifest: 'newManifest', 'first-plan': 'newFirstPlan', 'active-root-id': 'rootArtifactId' }[key] ?? 'newInventory')
      : ({ 'protocol-hash-only': 'newFirstPlan', 'cross-plan': 'crossPlanReferences', 'new-dag': 'newDagClosureReference', 'freeze-order': 'freezeOrder', 'initial-attempt': 'attemptNumber' }[group]);
    eq(r.field, expectedField);
    const { planClosureId, ...body } = f.closure;
    const integrity = [planClosureId === whash('plan-closure-id', { closureWithoutPlanClosureId: body }),
      f.closureBytes === fileBytes(f.closure), f.closureFileSha256 === sha(f.closureBytes), f.closureFilename === planClosureId + '.json'];
    const failureIndex = group === 'closure' ? ['id', 'bytes', 'file-hash', 'filename'].indexOf(key) : -1;
    eq(integrity, [0, 1, 2, 3].map(i => i !== failureIndex), r.key + ' isolated signature failure');
    if (group === 'closure') {
      const c1 = clone(b.closure), c2 = clone(f.closure); delete c1.planClosureId; delete c2.planClosureId;
      if (failureIndex < 0) eq(changedKeys(c1, c2), [expectedField]); else eq(c1, c2);
      onlyKeys(b, f, ['closure', 'closureBytes', 'closureFileSha256', 'closureFilename'], r.key);
      const schemaInvalid = ['cutoff-negative', 'cutoff-fraction', 'cutoff-unsafe', 'terminal', 'reason', 'model-allowed', 'root-allowed',
        'utc-fraction', 'utc-offset', 'utc-lowercase', 'utc-impossible'].includes(key) || key.startsWith('unknown-');
      if (schemaInvalid) assert(!schemaAccepts(contract.bundle.planClosureSchemaFileSha256.object, f.closure));
      else checkSchema(contract, 'planClosureSchemaFileSha256', f.closure);
      if (key === 'second-plan-to-null') { assert(second); eq(f.closure.oldPostConsensusRouteSlotPlanObjectSha256, null); }
      if (key === 'old-second-plan' && !second) eq(f.closure.oldPostConsensusRouteSlotPlanObjectSha256, hash(f.sources.availableSecondPlan));
    } else {
      eq(f.closure, b.closure);
      if (group === 'nonempty') {
        eq(changedKeys(b, f), [expectedField]); eq(f[expectedField].length, 1);
        const value = f[expectedField][0], type = zeroTypes[key];
        if (type === 'artifact') checkArtifact(contract, value);
        else if (type === 'campaign') { eq(value.purpose, 'model-attempt-campaign'); eq(value, f.sources.oldCampaign); }
        else checkSchema(contract, type, value);
        if (key === 'InvalidEvidence') { assert(!Object.hasOwn(value, 'evidence')); eq(value, f.sources.oldEvidence.evidence); }
        if (key === 'LedgerEntries') { eq(value.recordType, 'artifact-supersession'); assert(!Object.hasOwn(value, 'records')); eq(value, f.sources.history.ledger.records[1]); }
        if (key === 'Approvals' || key === 'Coverage') assert(!Object.hasOwn(value, 'header'));
        for (const other of Object.keys(zeroTypes).filter(k => k !== key)) eq(f['newPlan' + other], []);
      } else if (group === 'post-closure') {
        eq(f[expectedField].length, 1);
        const artifact = key === 'ledger' ? f.postClosureLedger : f[expectedField][0];
        checkArtifact(contract, artifact); eq(artifact.header.createdAtUtc, utc(Number(time)));
        eq(artifact.header.protocolObjectSha256, hash(f.protocol)); eq(artifact.header.annotationConsensusSlotPlanObjectSha256, hash(f.oldFirstPlan));
        if (key === 'ledger') eq(f[expectedField][0], artifact.records[1]);
        if (Number(time) < 20) assert(artifact.header.createdAtUtc < f.closure.closedAtUtc); else assert(artifact.header.createdAtUtc > f.closure.closedAtUtc);
        eq(changedKeys(b, f), [expectedField, ...(key === 'ledger' ? ['postClosureLedger'] : [])].sort());
      } else if (group === 'reuse') {
        if (expectedField === 'newInventory') {
          eq(changedKeys(b, f), ['newIds', 'newInventory', 'reusedArtifact']);
          eq(f.newInventory.length, b.newInventory.length + 1);
          const value = f.reusedArtifact, node = f.newInventory.at(-1);
          eq(node.embeddedRefs, flattenArtifactReferences(value.header ? [value.header, ...value.records] : value));
          eq(node.fileSha256, value.header ? sha(value.bytes) : sha(fileBytes(value)));
          assert(node.embeddedRefs.some(([, ref]) => b.oldIds.includes(ref)), 'embedded reference reaches old graph');
        } else if (key === 'active-root-id') {
          eq(changedKeys(b, f), ['newFirstPlan']);
          const expected = clone(b.newFirstPlan); expected.slots[0].rootArtifactId = f.sources.oldRun.header.artifactId; eq(f.newFirstPlan, expected);
        } else { eq(changedKeys(b, f), [expectedField]); eq(f[expectedField], f.sources[{ selection: 'oldSelection', manifest: 'oldManifest', 'first-plan': 'oldFirstPlan' }[key]]); }
      } else if (group === 'cross-plan') {
        const value = f.crossPlanReferences[0]; eq(f.crossPlanReferences.length, 1);
        if (key === 'ledger') {
          checkSchema(contract, 'supersessionLedgerSchemaFileSha256', value); checkArtifact(contract, f.crossPlanLedger);
          eq(f.crossPlanLedger.records[1], value); eq(value.supersededArtifactFileSha256, f.sources.oldRun.fileSha256);
          eq(value.replacementArtifactFileSha256, f.sources.newRun.fileSha256);
          eq(changedKeys(b, f), ['crossPlanLedger', 'crossPlanReferences']);
        } else {
          checkArtifact(contract, value); eq(value.header.annotationConsensusSlotPlanObjectSha256, hash(f.newFirstPlan));
          eq(value.campaign.activeArtifactIdBeforeCampaign, f.sources.oldRun.header.artifactId);
          eq(value.campaign.activeArtifactFileSha256BeforeCampaign, f.sources.oldRun.fileSha256);
          eq(changedKeys(b, f), ['crossPlanReferences']);
        }
      } else if (group === 'initial-attempt') {
        checkArtifact(contract, f.newSubmission); eq(f.newSubmission.header.generator.attemptNumber, Number(key));
        eq(f.newSubmission.header.protocolObjectSha256, hash(f.newProtocol));
        eq(f.newSubmission.header.annotationConsensusSlotPlanObjectSha256, hash(f.newFirstPlan));
        eq(f.newSubmission.campaign.slotPlanObjectSha256, hash(f.newFirstPlan));
        eq(f.newSubmission.header.artifactId, f.newFirstPlan.slots[0].rootArtifactId);
        eq(f.newCampaignState, 'planned'); eq(f.newPriorInvalidEvidence, []);
        eq(changedKeys(b, f), ['newCampaignState', 'newPriorInvalidEvidence', 'newSubmission']);
      } else if (group === 'freeze-order') {
        const expected = clone(b.freezeOrder); [expected[2], expected[3]] = [expected[3], expected[2]];
        eq(f.freezeOrder, expected); eq(changedKeys(b, f), ['freezeOrder']);
      } else if (group === 'protocol-hash-only') {
        eq(f.newFirstPlan, { ...b.oldFirstPlan, protocolObjectSha256: hash(f.newProtocol) }); eq(changedKeys(b, f), ['newFirstPlan']);
      } else if (group === 'new-dag') {
        eq(f.newFirstPlan.protocolObjectSha256, hash(f.closure)); eq(f.newDagClosureReference, hash(f.closure));
        const node = f.newInventory.find(n => n.name === 'firstPlan');
        eq(node.embeddedRefs, flattenArtifactReferences(f.newFirstPlan)); eq(node.objectSha256, hash(f.newFirstPlan));
        assert(node.embeddedRefs.some(([, ref]) => ref === hash(f.closure)));
        eq(changedKeys(b, f), ['newDagClosureReference', 'newFirstPlan', 'newInventory']);
      }
    }
  }
  eq(new Set(rows.map(r => hash(r.fixture))).size, rows.length);
  return { rows: rows.length, keys: rows.map(r => r.key) };
}

export function runNegativeSelfcheck(contract, workflow) {
  const replacement = assertReplacementNegatives(contract, buildReplacementNegativeRows(contract, workflow));
  const attempts = assertAttemptNegatives(contract, buildAttemptNegativeRows(contract, workflow));
  const reissues = [];
  for (const oldSecondPlan of [null, workflow.freshPlan]) {
    const oldGraph = materializeOldGraph(contract, workflow, oldSecondPlan);
    const built = materializeReissuePlan({ contract, workflow, cause: REISSUE_CAUSES[0], oldSecondPlan, oldGraph });
    reissues.push(assertReissueNegatives(contract, buildReissueNegativeRows(contract, workflow, built), oldSecondPlan !== null));
  }
  const keys = [...replacement.keys, ...attempts.keys, ...reissues.flatMap(r => r.keys)];
  eq(keys.length, 253); eq(new Set(keys).size, 253);
  return { status: 'green', totalRows: keys.length, replacement, attempts, reissues };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const contract = buildContract();
  console.log(JSON.stringify(runNegativeSelfcheck(contract, buildWorkflow(contract)), null, 2));
}
