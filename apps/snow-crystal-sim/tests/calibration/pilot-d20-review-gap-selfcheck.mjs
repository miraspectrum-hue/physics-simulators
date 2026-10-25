// Independent semantic/signature audit. Never imports or invokes a validator.
import { pathToFileURL } from 'node:url';
import { assert, cases, clone, fileBytes, hash, jcs, sha, whash, schemaAccepts, PDF } from './pilot-oracle.mjs';
import { buildReviewGapRows, registerReviewGapRows } from './pilot-d20-review-gap-cases.mjs';

const keys = ['selection/joint-pdf-spoof', 'input-change/protocolObjectSha256',
  'input-change/blindedManifestObjectSha256', 'input-change/batchId', 'input-change/ordinal',
  'input-change/no-attachment-delta', 'attempt/valid-one-null-replacement',
  'attempt/prior-evidence-id', 'attempt/prior-file-hash', 'attempt/prior-both',
  'reissue/hidden-old-plan', 'reissue/hidden-closure', 'schema-role/swap', 'schema-role/duplicate'];
const expectedOracles = [
  ['selection', 'selection-invalid', 'sourcePdfSha256'],
  ...['protocolObjectSha256', 'blindedManifestObjectSha256', 'batchId', 'orderedInputSha256', 'batchInputTableObjectSha256']
    .map(field => ['invalid-attempt', 'invalid-attempt-evidence', field]),
  ['attempt-campaign', 'attempt-campaign-invalid', 'activeArtifactIdBeforeCampaign'],
  ...Array.from({ length: 3 }, () => ['attempt-campaign', 'attempt-campaign-invalid', 'invalidEvidence']),
  ...Array.from({ length: 2 }, () => ['plan-reissue', 'protocol-reissue-required', 'newInventory']),
  ...Array.from({ length: 2 }, () => ['schema-bundle', 'schema-file-binding', 'selectionCandidateSetSchemaFileSha256']),
];
const eq = assert.deepEqual;
const schema = (c, key, value) => assert(schemaAccepts(c.bundle[key + 'SchemaFileSha256'].object, value), key);
const evidenceId = evidence => {
  const { invalidAttemptEvidenceId, ...body } = evidence; void invalidAttemptEvidenceId;
  return whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body });
};
function wrapper(c, w) {
  eq(w.bytes, [w.header, ...w.records].map(fileBytes).join('')); eq(w.fileSha256, sha(w.bytes));
  for (const r of [w.header, ...w.records]) schema(c, 'artifact', r);
  eq(w.header.generator.campaignIdSha256, hash(w.campaign));
  eq(w.header.batchInputTableObjectSha256, hash(w.table));
  eq(w.campaign.batchInputTableObjectSha256, hash(w.table));
  eq(w.campaign.promptVariablesObjectSha256, hash(w.prompt.variables));
}
function evidence(c, f, defect = '') {
  schema(c, 'invalidAttemptEvidence', f.evidence);
  eq(f.evidenceBytes, fileBytes(f.evidence));
  eq(f.evidenceFilename, f.evidence.invalidAttemptEvidenceId + '.json');
  eq(f.evidence.campaignIdSha256, hash(f.campaign));
  eq(f.evidence.rawResponseSha256, sha(f.rawResponseBytes));
  eq(f.evidence.rawResponseByteLength, Buffer.byteLength(f.rawResponseBytes));
  eq(f.evidence.invalidAttemptEvidenceId === evidenceId(f.evidence), !['evidence-id', 'both'].includes(defect));
  eq(f.evidenceFileSha256 === sha(f.evidenceBytes), !['file-hash', 'both'].includes(defect));
}
function chain(c, f) {
  const p = f.chain;
  schema(c, 'batchInputTable', p.table);
  eq(Object.keys(p.variables).sort(), Object.keys(c.prompts[0].variables).sort());
  for (const [key, value] of Object.entries(p.variables)) {
    const authority = c.prompts[0].variables[key];
    if (authority === null) eq(value, null); else eq(typeof value, typeof authority);
  }
  schema(c, 'renderedPromptEvidence', p.evidence);
  eq(p.schemaBytes, fileBytes(p.schemaObject)); eq(p.schemaFileSha256, sha(p.schemaBytes));
  eq(p.modelPayloadSchemaObjectSha256, hash(p.schemaObject));
  eq(p.batchInputTableObjectSha256, hash(p.table));
  eq(p.variables.protocolCanonicalJson, jcs(f.protocol)); eq(p.variables.protocolObjectSha256, hash(f.protocol));
  eq(p.variables.modelPayloadSchemaCanonicalJson, jcs(p.schemaObject));
  eq(p.variables.modelPayloadSchemaObjectSha256, hash(p.schemaObject)); eq(p.variables.schemaFileSha256, sha(p.schemaBytes));
  eq(p.variables.batchInputTableCanonicalJson, jcs(p.table)); eq(p.variables.batchInputTableObjectSha256, hash(p.table));
  // Single-pass regex substitution never rescans placeholders inside protocol JSON.
  // This algorithm is independent of the positive builder's byte-range renderer.
  const substitutions = { PROTOCOL_CANONICAL_JSON: p.variables.protocolCanonicalJson,
    MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON: p.variables.modelPayloadSchemaCanonicalJson,
    BATCH_INPUT_TABLE_CANONICAL_JSON: p.variables.batchInputTableCanonicalJson };
  for (const token of Object.keys(substitutions)) eq(p.templateBytes.split('{{' + token + '}}').length, 2);
  const rendered = p.templateBytes.replace(/\{\{(PROTOCOL_CANONICAL_JSON|MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON|BATCH_INPUT_TABLE_CANONICAL_JSON)\}\}/g,
    (_, token) => substitutions[token]);
  eq(p.rendered, rendered); eq(p.evidence.promptVariablesObjectSha256, hash(p.variables));
  eq(p.evidence.renderedPromptSha256, sha(rendered)); eq(p.evidence.protocolObjectSha256, hash(f.protocol));
  eq(p.evidence.schemaFileSha256, sha(p.schemaBytes)); eq(p.evidence.modelPayloadSchemaObjectSha256, hash(p.schemaObject));
  eq(p.evidence.promptTemplateFileSha256, sha(p.templateBytes));
  eq(f.replacementInputs.table, p.table); eq(f.replacementInputs.tableObjectSha256, hash(p.table));
  eq(f.replacementInputs.prompt.variables, p.variables); eq(f.replacementInputs.prompt.evidence, p.evidence);
  eq(f.replacementInputs.prompt.rendered, rendered); eq(f.replacementInputs.chain, p);
  eq(f.campaign.changedInputSha256, hash(p.table)); eq(f.evidence.changedInputSha256, hash(p.table));
  eq(f.evidence.inputRefs.batchInputTableObjectSha256, hash(p.table));
  eq(f.campaign.orderedInputSha256, whash('ordered-image-input', { orderedItems: p.table.orderedItems.map(({ attachmentSlot, ...i }) => i) }));
  eq(f.evidence.inputRefs.orderedInputSha256, f.campaign.orderedInputSha256);
  eq(f.evidence.promptRefs, { promptRole: 'annotator', promptTemplateFileSha256: sha(p.templateBytes),
    promptVariablesObjectSha256: hash(p.variables), schemaFileSha256: sha(p.schemaBytes),
    modelPayloadSchemaObjectSha256: hash(p.schemaObject), renderedPromptEvidenceObjectSha256: hash(p.evidence), renderedPromptSha256: sha(rendered) });
}
function flattened(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => flattened(v, path + '[' + i + ']'));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const at = path ? path + '.' + k : k;
    return /Sha256$|ArtifactId$|Id$/.test(k) && typeof v === 'string' ? [[at, v]] : flattened(v, at);
  }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}
export function assertReviewGapRows(c, w, rows, registry) {
  eq(rows.map(r => r.key), keys); eq(new Set(rows.map(r => hash(r.fixture))).size, 14);
  const registered = registry.filter(r => r.label.startsWith('d23/'));
  eq(registered.length, 14); eq(new Set(registered.map(r => r.label)).size, 14);
  for (const [index, row] of rows.entries()) {
    const f = row.fixture, b = row.baseline;
    eq([row.caseName, row.reason, row.field], expectedOracles[index]);
    eq(hash(b), row.baselineHash); assert.notEqual(hash(f), row.baselineHash);
    eq(registered.filter(r => r.label === 'd23/' + row.key).map(r => [r.caseName, hash(r.fixture), r.errorClass, r.reason, r.field]),
      [[row.caseName, hash(f), 'RangeError', row.reason, row.field]]);
    if (row.key.startsWith('selection/')) {
      schema(c, 'selectionPlan', b.selectionPlan); schema(c, 'selectionCandidateSet', b.candidateSet);
      eq(f.protocol, c.protocol); eq(f.protocol.sourcePdfSha256, PDF); eq(f.proxyInput, b.proxyInput);
      eq(f.selectionPlan.sourcePdfSha256, sha(f.alternatePdfBytes)); eq(f.candidateSet.sourcePdfSha256, sha(f.alternatePdfBytes));
      eq(f.selectionPlan.candidateSetObjectSha256, hash(f.candidateSet));
      for (const [key, value] of [['selectionPlan', f.selectionPlan], ['selectionCandidateSet', f.candidateSet]]) {
        const shape = clone(c.bundle[key + 'SchemaFileSha256'].object);
        assert(!schemaAccepts(shape, value)); shape.properties.sourcePdfSha256 = { type: 'string', pattern: '^[0-9a-f]{64}$' };
        assert(schemaAccepts(shape, value), 'only the frozen PDF authority is invalid');
      }
      const expected = clone(b); expected.alternatePdfBytes = f.alternatePdfBytes;
      expected.candidateSet.sourcePdfSha256 = sha(f.alternatePdfBytes);
      expected.selectionPlan.sourcePdfSha256 = sha(f.alternatePdfBytes);
      expected.selectionPlan.candidateSetObjectSha256 = hash(expected.candidateSet); eq(f, expected);
    } else if (row.key.startsWith('input-change/')) {
      evidence(c, b); chain(c, b); wrapper(c, b.validWrapper);
      eq(f.protocol, b.protocol); eq(f.firstPlan, b.firstPlan); eq(f.plannedRun, b.plannedRun);
      evidence(c, f); chain(c, f); wrapper(c, f.validWrapper);
      const target = row.key.split('/')[1], expected = clone(b.chain.table);
      if (target === 'ordinal') expected.orderedItems[0].ordinal = 99;
      else if (target === 'no-attachment-delta') expected.orderedItems[0].attachmentSlot = w.runs[0].table.orderedItems[0].attachmentSlot;
      else expected[target] = f.chain.table[target];
      eq(f.chain.table, expected);
      if (target === 'no-attachment-delta') eq(f.chain.table, w.runs[0].table);
      else assert.notDeepEqual(f.chain.table, b.chain.table);
    } else if (row.key.startsWith('attempt/')) {
      wrapper(c, b.validWrapper);
      for (const prior of b.invalidEvidence) evidence(c, prior);
      wrapper(c, f.validWrapper);
      if (row.key.endsWith('null-replacement')) {
        eq(f.campaign.activeArtifactIdBeforeCampaign, null); eq(f.campaign.activeArtifactFileSha256BeforeCampaign, null);
        eq(f.campaign.campaignKind, 'replacement-materialization'); eq(f.campaign.replacementReasonCode, 'model-retry');
        eq(f.campaign.changedInputSha256, w.runs[0].fileSha256); eq(f.validWrapper.campaign, f.campaign);
        eq(f.invalidEvidence, []); eq(f.submissions, b.submissions); eq(f.activeBefore, null);
        const expected = clone(b); expected.campaign = clone(f.campaign); expected.validWrapper = clone(f.validWrapper); eq(f, expected);
      } else {
        const defect = row.key.slice('attempt/prior-'.length);
        evidence(c, f.invalidEvidence[0], defect); eq(f.validWrapper, b.validWrapper); eq(f.campaign, b.campaign);
        const expected = clone(b); expected.invalidEvidence = clone(f.invalidEvidence); eq(f, expected);
        const restored = clone(f.invalidEvidence[0]);
        restored.evidence.invalidAttemptEvidenceId = b.invalidEvidence[0].evidence.invalidAttemptEvidenceId;
        restored.evidenceBytes = b.invalidEvidence[0].evidenceBytes; restored.evidenceFilename = b.invalidEvidence[0].evidenceFilename;
        restored.evidenceFileSha256 = b.invalidEvidence[0].evidenceFileSha256; eq(restored, b.invalidEvidence[0]);
      }
    } else if (row.key.startsWith('reissue/')) {
      schema(c, 'planClosure', b.closure); schema(c, 'annotationConsensusSlotPlan', b.newFirstPlan);
      const expected = clone(b); expected.referenceCarrier = f.referenceCarrier; expected.newInventory = f.newInventory; eq(f, expected);
      schema(c, 'annotationConsensusSlotPlan', f.referenceCarrier);
      eq(f.newIds, b.newIds); eq(f.oldIds, b.oldIds);
      eq(f.newInventory.slice(0, -1), b.newInventory);
      const node = f.newInventory.at(-1); eq(node.objectSha256, hash(f.referenceCarrier));
      eq(node.fileSha256, sha(fileBytes(f.referenceCarrier))); eq(node.bytesSha256, node.fileSha256);
      eq(node.embeddedRefs, flattened(f.referenceCarrier));
      const stale = row.key.endsWith('old-plan') ? hash(f.oldFirstPlan) : hash(f.closure);
      assert(node.embeddedRefs.some(([, value]) => value === stale)); assert(!f.newIds.includes(stale));
      const { planClosureId, ...body } = f.closure;
      eq(planClosureId, whash('plan-closure-id', { closureWithoutPlanClosureId: body }));
      eq(f.closureBytes, fileBytes(f.closure)); eq(f.closureFileSha256, sha(f.closureBytes));
    } else {
      const a = 'selectionCandidateSetSchemaFileSha256', other = 'selectionProxyInputSchemaFileSha256';
      for (const [key, s] of Object.entries(f.schemaBundle)) {
        eq(s.bytes, fileBytes(s.object)); eq(s.objectSha256, hash(s.object)); eq(s.fileSha256, sha(s.bytes));
        eq(f.protocol.schemaFiles[key], s.fileSha256);
      }
      eq(f.schemaBundle[a].object, c.bundle[other].object); eq(f.schemaBundle[a].filename, c.bundle[a].filename);
      const expected = clone(b); expected.protocol.schemaFiles = clone(f.protocol.schemaFiles);
      expected.schemaBundle[a] = clone(f.schemaBundle[a]);
      if (row.key.endsWith('swap')) {
        expected.schemaBundle[other] = clone(f.schemaBundle[other]);
        eq(f.schemaBundle[other].object, c.bundle[a].object);
        eq(new Set(Object.values(f.schemaBundle).map(s => s.fileSha256)).size, 23);
      } else eq(new Set(Object.values(f.schemaBundle).map(s => s.fileSha256)).size, 22);
      eq(f, expected);
    }
  }
  return { status: 'green', totalRows: 14, registeredRows: registered.length, keys };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const c = buildContract(), w = buildWorkflow(c), rows = buildReviewGapRows(c, w);
  registerReviewGapRows(rows);
  console.log(JSON.stringify(assertReviewGapRows(c, w, rows, cases), null, 2));
}
