// D-24: concrete, re-signed attacks on the five deeper authority boundaries.
// Test-only materializers; this module never imports a validator.
import { assert, bad, clone, fileBytes, hash, sha, whash } from './pilot-oracle.mjs';
import { materializePromptChain, materializeReplacementCampaign, materializeValidWrapper,
  materializeOldGraph, materializeReissuePlan, REISSUE_CAUSES, artifactGraphNodes,
  flattenArtifactReferences } from './pilot-d20-builders.mjs';

const orderedHash = table => whash('ordered-image-input', {
  orderedItems: table.orderedItems.map(({ attachmentSlot, ...item }) => item),
});
const signWrapper = w => {
  w.bytes = [w.header, ...w.records].map(fileBytes).join(''); w.fileSha256 = sha(w.bytes);
};

function validAttempt(c, w, reason, table = w.runs[0].table, inputProtocol = c.protocol, inputManifest = c.manifest) {
  const run = w.runs[0];
  const chain = materializePromptChain({ protocol: inputProtocol,
    schemaObject: c.bundle.annotationPayloadSchemaFileSha256.object, table: clone(table),
    templateBytes: run.prompt.template, rendererId: c.protocol.prompts.rendererId });
  const campaign = materializeReplacementCampaign({ run, firstPlan: w.firstPlan, promptChain: chain, reasonCode: reason });
  campaign.orderedInputSha256 = orderedHash(table);
  const wrapper = materializeValidWrapper({ run, firstPlan: w.firstPlan, campaign,
    promptChain: chain, attemptNumber: 1, artifactId: 'd24-valid-replacement' });
  wrapper.header.orderedInputSha256 = campaign.orderedInputSha256;
  wrapper.header.protocolObjectSha256 = table.protocolObjectSha256;
  wrapper.header.blindedManifestObjectSha256 = table.blindedManifestObjectSha256;
  wrapper.header.batchId = table.batchId; signWrapper(wrapper);
  return { protocol: c.protocol, inputProtocol, inputManifest, firstPlan: w.firstPlan, plannedRun: run, ledger: w.emptyLedger,
    campaign, chain, submissions: [{ attemptNumber: 1, state: 'valid', freshContext: true }],
    invalidEvidence: [], validWrapper: wrapper,
    activeBefore: { artifactId: run.header.artifactId, fileSha256: run.fileSha256 },
    atomicReplacement: true, activeDuringInvalid: run.header.artifactId,
    requiredAnnotationRoot: true, failurePolicy: 'stop-pilot', invalidEvidenceInLedger: [], invalidEvidenceInSnapshots: [] };
}

function reissue(c, w) {
  const oldGraph = materializeOldGraph(c, w, null);
  const b = materializeReissuePlan({ contract: c, workflow: w, cause: REISSUE_CAUSES[0], oldSecondPlan: null, oldGraph });
  const concrete = (inventory, graph) => {
    const nodes = artifactGraphNodes(graph);
    return inventory.map(row => { const node = nodes.find(n => n.name === row.name);
      return { ...row, bytes: node.bytes, ...(node.object === undefined ? {} : { object: clone(node.object) }) }; });
  };
  return { protocol: c.protocol, selectionPlan: c.plan, oldFirstPlan: w.firstPlan,
    oldSecondPlan: null, oldLedger: w.emptyLedger,
    closure: b.closure, closureBytes: b.closureBytes, closureFileSha256: b.closureFileSha256,
    closureFilename: b.closureFilename, freezeOrder: b.freezeOrder,
    newProtocol: b.protocol, newSelection: b.selection, newManifest: b.manifest, newRestricted: b.restricted,
    newTable: b.table, newVariables: b.prompt.variables, newEvidence: b.prompt.evidence, newRendered: b.prompt.rendered,
    newFirstPlan: b.firstPlan, newSchema: { object: b.schema, bytes: fileBytes(b.schema),
      fileSha256: sha(fileBytes(b.schema)), objectSha256: hash(b.schema) }, newTemplateBytes: b.template,
    oldInventory: concrete(b.oldInventory, oldGraph), newInventory: concrete(b.newInventory, b.newGraph),
    oldIds: b.oldIds, newIds: b.newIds,
    oldPlanSubmissionsAfterClosure: [], oldPlanRootsAfterClosure: [], oldPlanLedgerEntriesAfterClosure: [],
    oldPlanApprovalsAfterClosure: [], oldPlanCoverageAfterClosure: [], crossPlanReferences: [],
    ...Object.fromEntries(['MaterializedRoots', 'Runs', 'Campaigns', 'InvalidEvidence', 'LedgerEntries',
      'Snapshots', 'SecondPlans', 'Approvals', 'Coverage'].map(key => ['newPlan' + key, []])) };
}

export function buildDepthRows(c, w) {
  const rows = [];
  const baselineHashes = new WeakMap();
  const add = (key, caseName, baseline, mutate, reason, field) => {
    if (!baselineHashes.has(baseline)) baselineHashes.set(baseline, hash(baseline));
    const baselineHash = baselineHashes.get(baseline), fixture = clone(baseline); mutate(fixture);
    assert.equal(hash(baseline), baselineHash);
    rows.push({ key, caseName, baseline, baselineHash, fixture, errorClass: 'RangeError', reason, field });
  };
  const selection = { protocol: c.protocol, candidateSet: c.candidateSet, proxyInput: c.proxyInput, selectionPlan: c.plan };
  add('selection/absent-protocol', 'selection', selection, f => { delete f.protocol; }, 'selection-invalid', 'protocol');
  add('selection/foreign-protocol-reference', 'selection', selection, f => {
    f.foreignProtocol = clone(c.protocol); f.foreignProtocol.rasterization.inheritedProtocolObjectSha256 = hash(w.firstPlan);
    f.selectionPlan.protocolObjectSha256 = hash(f.foreignProtocol);
  }, 'selection-invalid', 'protocolObjectSha256');

  const table = clone(w.runs[0].table); table.orderedItems[0].attachmentSlot += '-changed';
  const input = validAttempt(c, w, 'input-change', table);
  for (const target of ['unchanged-table', 'ordinal', 'protocol', 'manifest', 'batch', 'all-authorities']) {
    const field = { 'unchanged-table': 'batchInputTableObjectSha256', ordinal: 'orderedInputSha256',
      protocol: 'protocolObjectSha256', manifest: 'blindedManifestObjectSha256', batch: 'batchId',
      'all-authorities': 'protocolObjectSha256' }[target];
    add('valid-input-change/' + target, 'attempt-campaign', input, f => {
      const changed = target === 'unchanged-table' ? clone(w.runs[0].table) : clone(table);
      const inputProtocol = clone(c.protocol), inputManifest = clone(c.manifest);
      if (['ordinal', 'all-authorities'].includes(target)) changed.orderedItems[0].ordinal = 99;
      if (['protocol', 'all-authorities'].includes(target)) {
        inputProtocol.rasterization.inheritedProtocolObjectSha256 = hash(w.firstPlan);
        changed.protocolObjectSha256 = hash(inputProtocol);
      }
      if (['manifest', 'all-authorities'].includes(target)) {
        inputManifest.entries.reverse();
        inputManifest.protocolObjectSha256 = hash(inputProtocol);
        changed.blindedManifestObjectSha256 = hash(inputManifest);
      }
      if (['batch', 'all-authorities'].includes(target)) changed.batchId = 'batch-02';
      Object.assign(f, validAttempt(c, w, 'input-change', changed, inputProtocol, inputManifest));
    }, 'attempt-campaign-invalid', field);
  }

  const retry = validAttempt(c, w, 'model-retry');
  for (const target of ['id', 'file', 'both']) add('valid-model-retry/forged-active-' + target, 'attempt-campaign', retry, f => {
    // Both parts come from a real, type-valid concrete artifact. Its bytes are
    // distinct even when the attacker retains the frozen artifact's ID.
    f.foreignActive = clone(w.runs[0]);
    if (target !== 'file') f.foreignActive.header.artifactId = 'd24-foreign-active';
    f.foreignActive.header.generator.modelConfiguration.d24ForeignSubmission = true;
    signWrapper(f.foreignActive);
    const id = target === 'file' ? f.plannedRun.header.artifactId : f.foreignActive.header.artifactId;
    const file = target === 'id' ? f.plannedRun.fileSha256 : f.foreignActive.fileSha256;
    f.activeBefore = { artifactId: id, fileSha256: file }; f.activeDuringInvalid = id;
    f.campaign.activeArtifactIdBeforeCampaign = id; f.campaign.activeArtifactFileSha256BeforeCampaign = file;
    f.campaign.changedInputSha256 = file; f.validWrapper.campaign = clone(f.campaign);
    f.validWrapper.header.generator.campaignIdSha256 = hash(f.campaign); signWrapper(f.validWrapper);
  }, 'attempt-campaign-invalid', target === 'file' ? 'activeArtifactFileSha256BeforeCampaign' : 'activeArtifactIdBeforeCampaign');

  const reissued = reissue(c, w);
  for (const target of ['candidateSet', 'proxyInput', 'truthTable', 'decision/growth']) {
    add('reissue/substituted-' + target, 'plan-reissue', reissued, f => {
      // Reorder actual rows: all row types and counts remain legal, while the
      // original immutable selection/protocol references intentionally remain.
      const row = f.newInventory.find(row => row.name === target), object = row.object;
      if (Array.isArray(object)) [object[0], object[1]] = [object[1], object[0]];
      else [object.rows[0], object.rows[1]] = [object.rows[1], object.rows[0]];
      const bytes = fileBytes(object);
      Object.assign(row, { objectSha256: hash(object), fileSha256: sha(bytes), bytesSha256: sha(bytes),
        embeddedRefs: flattenArtifactReferences(object), object: clone(object), bytes });
    }, 'protocol-reissue-required', 'newInventory');
  }
  add('reissue/inventory-reference-mismatch', 'plan-reissue', reissued, f => {
    // Concrete bytes/hashes stay unchanged; the summary invents one embedded
    // source reference that is absent from those bytes.
    f.newInventory.find(row => row.name === 'candidateSet').embeddedRefs = [['sourcePdfSha256', sha(f.newSchema.bytes)]];
  }, 'protocol-reissue-required', 'newInventory');

  const schemas = { protocol: c.protocol, schemaBundle: c.bundle };
  for (const [target, mutate] of [
    ['selectionCandidateSet', s => { s.properties.rows = { type: 'array', items: { type: 'string' }, minItems: 206, maxItems: 206 }; }],
    ['batchInputTable', s => { s.properties.orderedItems.items.properties.ordinal.minimum = -1; }],
  ]) add('schema-role/deep-' + target, 'schema-bundle', schemas, f => {
    const key = target + 'SchemaFileSha256', schema = f.schemaBundle[key]; mutate(schema.object);
    schema.bytes = fileBytes(schema.object); schema.objectSha256 = hash(schema.object); schema.fileSha256 = sha(schema.bytes);
    f.protocol.schemaFiles[key] = schema.fileSha256;
  }, 'schema-file-binding', target + 'SchemaFileSha256');
  return rows;
}

export function registerDepthRows(rows) {
  for (const row of rows) bad(row.caseName, row.fixture, () => {}, row.reason, row.field, row.errorClass, 'd24/' + row.key);
}
