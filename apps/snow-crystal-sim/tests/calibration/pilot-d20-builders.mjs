// D-20 test-only fixture materializers.  They intentionally derive every
// downstream byte/hash from concrete inputs; the validator never imports them.
import { assert, CONTRACT, PROTOCOL, POLICY, clone, fileBytes, hash, jcs, sha, utc, whash, placeholders } from './pilot-oracle.mjs';

const names = ['protocolCanonicalJson', 'modelPayloadSchemaCanonicalJson', 'batchInputTableCanonicalJson', 'candidatePayloadCanonicalJson'];

export function renderExactTemplate(templateBytes, variables, rendererId, role = 'annotator', allowedPlaceholders = placeholders.slice(0, role === 'annotator' ? 3 : 4)) {
  assert(['ascii-placeholder-exact-replacement/1', 'ascii-placeholder-exact-replacement/2'].includes(rendererId));
  const source = Buffer.from(templateBytes, 'utf8');
  assert.equal(new Set(allowedPlaceholders).size, allowedPlaceholders.length);
  const ranges = allowedPlaceholders.map(token => {
    const index = placeholders.indexOf(token); assert(index >= 0);
    const needle = Buffer.from(token, 'ascii'), start = source.indexOf(needle);
    assert(start >= 0); assert.equal(source.indexOf(needle, start + needle.length), -1);
    return { start, end: start + needle.length, value: Buffer.from(variables[names[index]], 'utf8') };
  }).sort((a, b) => a.start - b.start);
  const chunks = []; let cursor = 0;
  for (const range of ranges) { chunks.push(source.subarray(cursor, range.start), range.value); cursor = range.end; }
  chunks.push(source.subarray(cursor));
  return Buffer.concat(chunks).toString('utf8');
}

export function materializePromptChain({ protocol, schemaObject, table, templateBytes, rendererId, role = 'annotator' }) {
  const schemaBytes = fileBytes(schemaObject);
  const schemaFileSha256 = sha(schemaBytes), modelPayloadSchemaObjectSha256 = hash(schemaObject);
  const batchInputTableObjectSha256 = hash(table);
  const variables = {
    schemaVersion: 'snow-crystal-morphology-pilot-prompt-variables/1', promptRole: role,
    protocolObjectSha256: hash(protocol), protocolCanonicalJson: jcs(protocol),
    schemaFileSha256, modelPayloadSchemaObjectSha256, modelPayloadSchemaCanonicalJson: jcs(schemaObject),
    batchInputTableObjectSha256, batchInputTableCanonicalJson: jcs(table),
    candidateAliasManifestObjectSha256: null, candidatePayloadTableObjectSha256: null, candidatePayloadCanonicalJson: null,
  };
  const rendered = renderExactTemplate(templateBytes, variables, rendererId, role, protocol.prompts[`${role}AllowedPlaceholders`]);
  const evidence = {
    schemaVersion: 'snow-crystal-morphology-pilot-rendered-prompt-evidence/1', promptRole: role, rendererId,
    protocolObjectSha256: hash(protocol), promptTemplateFileSha256: sha(templateBytes),
    promptVariablesObjectSha256: hash(variables), schemaFileSha256, modelPayloadSchemaObjectSha256,
    renderedPromptSha256: sha(rendered),
  };
  assert.equal(schemaBytes, fileBytes(schemaObject)); assert.equal(batchInputTableObjectSha256, hash(table));
  assert.equal(evidence.promptVariablesObjectSha256, hash(variables)); assert.equal(evidence.renderedPromptSha256, sha(rendered));
  return { schemaObject, schemaBytes, schemaFileSha256, modelPayloadSchemaObjectSha256, table, batchInputTableObjectSha256, templateBytes, rendered, variables, evidence };
}

export function materializeReplacementCampaign({ run, firstPlan, promptChain, reasonCode }) {
  const inputChange = reasonCode === 'input-change';
  const campaign = {
    ...run.campaign, slotPlanObjectSha256: hash(firstPlan), campaignKind: 'replacement-materialization',
    activeArtifactIdBeforeCampaign: run.header.artifactId, activeArtifactFileSha256BeforeCampaign: run.fileSha256,
    replacementReasonCode: reasonCode, changedInputSha256: inputChange ? promptChain.batchInputTableObjectSha256 : run.fileSha256,
    promptVariablesObjectSha256: inputChange ? hash(promptChain.variables) : run.campaign.promptVariablesObjectSha256,
    batchInputTableObjectSha256: inputChange ? promptChain.batchInputTableObjectSha256 : run.campaign.batchInputTableObjectSha256,
  };
  assert(['model-retry', 'input-change'].includes(reasonCode));
  assert.equal(campaign.changedInputSha256, inputChange ? hash(promptChain.table) : run.fileSha256);
  return campaign;
}

// A replacement is a new execution artifact, not a patched copy of the root
// artifact.  Keep the derivation here so a caller can change exactly one
// authority (the attachment slot for input-change) and cannot accidentally
// retain a root table or prompt reference in the accepting wrapper.
export function materializeValidWrapper({ run, firstPlan, campaign, promptChain, attemptNumber, artifactId }) {
  const wrapper = clone(run);
  const chain = promptChain;
  // Root/model-retry callers intentionally use the frozen root authorities;
  // input-change callers supply a newly materialized chain.
  if (chain) {
    wrapper.table = clone(chain.table);
    wrapper.prompt = { ...wrapper.prompt, template: chain.templateBytes, variables: chain.variables, evidence: chain.evidence, rendered: chain.rendered };
    wrapper.prompt.schemaBytes = chain.schemaBytes;
    wrapper.inventory = wrapper.inventory.map(item => ({ ...item, fileSha256: item.kind === 'prompt' ? sha(chain.rendered) : item.kind === 'batch-input' ? sha(fileBytes(chain.table)) : item.fileSha256 }));
  }
  wrapper.campaign = clone(campaign);
  wrapper.header.artifactId = artifactId ?? wrapper.header.artifactId;
  // `artifact-header` is an authority independent of the campaign and prompt
  // evidence.  In particular an input-change must never retain the root
  // table hash here while its generator points at the replacement prompt.
  wrapper.header.batchInputTableObjectSha256 = hash(wrapper.table);
  wrapper.header.annotationConsensusSlotPlanObjectSha256 = hash(firstPlan);
  wrapper.header.generator.attemptNumber = attemptNumber;
  wrapper.header.generator.campaignIdSha256 = hash(wrapper.campaign);
  const generator = wrapper.header.generator;
  if (promptChain) {
    generator.promptVariablesObjectSha256 = hash(chain.variables);
    generator.schemaFileSha256 = chain.schemaFileSha256;
    generator.modelPayloadSchemaObjectSha256 = chain.modelPayloadSchemaObjectSha256;
    generator.renderedPromptEvidenceObjectSha256 = hash(chain.evidence);
    generator.renderedPromptSha256 = sha(chain.rendered);
    generator.promptTemplateFileSha256 = sha(chain.templateBytes);
    assert.equal(wrapper.campaign.batchInputTableObjectSha256, hash(wrapper.table));
    assert.equal(wrapper.campaign.promptVariablesObjectSha256, hash(chain.variables));
    assert.equal(generator.promptVariablesObjectSha256, hash(chain.variables));
    assert.equal(generator.renderedPromptEvidenceObjectSha256, hash(chain.evidence));
    assert.equal(wrapper.header.batchInputTableObjectSha256, chain.batchInputTableObjectSha256);
    assert.equal(wrapper.header.batchInputTableObjectSha256, wrapper.campaign.batchInputTableObjectSha256);
    assert.equal(wrapper.header.batchInputTableObjectSha256, chain.variables.batchInputTableObjectSha256);
    assert.equal(generator.promptVariablesObjectSha256, chain.variables && hash(chain.variables));
    assert.equal(generator.schemaFileSha256, chain.schemaFileSha256);
    assert.equal(generator.modelPayloadSchemaObjectSha256, chain.modelPayloadSchemaObjectSha256);
    assert.equal(generator.renderedPromptSha256, sha(chain.rendered));
  }
  wrapper.bytes = [wrapper.header, ...wrapper.records].map(fileBytes).join('');
  wrapper.fileSha256 = sha(wrapper.bytes);
  assert.equal(wrapper.bytes, [wrapper.header, ...wrapper.records].map(fileBytes).join(''));
  assert.equal(wrapper.fileSha256, sha(wrapper.bytes));
  return wrapper;
}

// Source changes and closure meanings are literal test authorities.
export const REISSUE_CAUSES = Object.freeze([
  { key: 'schema-bytes-object-reference', reasonCode: 'schema-change' },
  { key: 'template-bytes', reasonCode: 'prompt-change' },
  { key: 'placeholder-tuple', reasonCode: 'prompt-change' },
  { key: 'renderer', reasonCode: 'prompt-change' },
  { key: 'instruction-semantics', reasonCode: 'prompt-change' },
  { key: 'decision-rules-mapping', reasonCode: 'schema-change' },
]);
export const REISSUE_FREEZE_ORDER = Object.freeze([
  'old-plan-closed', 'old-ledger-frozen', 'closure-frozen', 'new-authority-frozen',
  'new-protocol-frozen', 'new-selection-manifest-map-frozen', 'new-input-prompt-frozen', 'new-first-plan-unexecuted',
]);
export const EXECUTION_COLLECTIONS = Object.freeze([
  'materializedRoots', 'runs', 'campaigns', 'invalidEvidence', 'ledgerEntries',
  'snapshots', 'secondPlans', 'approvals', 'coverage',
]);

export function flattenArtifactReferences(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => flattenArtifactReferences(v, path + '[' + i + ']'))
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => {
    const next = path ? path + '.' + key : key;
    if (/Sha256$|ArtifactId$|Id$/.test(key) && typeof v === 'string') return [[next, v]];
    // Canonical JSON fields are embedded objects, not opaque strings.
    if (/CanonicalJson$/.test(key) && typeof v === 'string') return flattenArtifactReferences(JSON.parse(v), next);
    return flattenArtifactReferences(v, next);
  }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

const schemaFile = (object, filename) => ({
  object, filename, bytes: fileBytes(object), objectSha256: hash(object), fileSha256: sha(fileBytes(object)),
});
const objectNode = (name, object, schemaKey = null, planOwned = true) =>
  ({ name, object, bytes: fileBytes(object), schemaKey, planOwned, format: 'json' });
const textNode = (name, bytes, planOwned = false) => ({ name, bytes, schemaKey: null, planOwned, format: 'text' });
const artifactNode = (name, artifact, schemaKey = 'artifactSchemaFileSha256') => ({
  name, object: [artifact.header, ...artifact.records], bytes: artifact.bytes,
  declaredFileSha256: artifact.fileSha256, schemaKey, planOwned: true, format: 'jsonl',
  artifactId: artifact.header.artifactId,
});

// A graph owns concrete nodes; no lookup into the case registry or ambient state.
export function artifactGraphNodes(graph) {
  const nodes = Object.entries(graph.bundle).map(([key, s]) => ({
    ...objectNode('schema/' + key, s.object, null, false), bytes: s.bytes,
    declaredObjectSha256: s.objectSha256, declaredFileSha256: s.fileSha256,
  }));
  for (const [role, bytes] of Object.entries(graph.templates)) nodes.push(textNode('template/' + role, bytes));
  for (const [name, key] of [
    ['protocol', 'protocolObject'], ['selection', 'selectionPlan'], ['manifest', 'blindedManifest'],
    ['restricted', 'restrictedMap'], ['firstPlan', 'annotationConsensusSlotPlan'],
    ['candidateSet', 'selectionCandidateSet'], ['proxyInput', 'selectionProxyInput'],
    ['truthTable', 'consensusRoutingTruthTable'], ['aliases', 'candidateAlias'], ['candidateTable', 'candidatePayloadTable'],
  ]) if (graph[name]) nodes.push(objectNode(name, graph[name], key + 'SchemaFileSha256', !['candidateSet', 'proxyInput', 'truthTable'].includes(name)));
  for (const [key, table] of Object.entries(graph.tables)) nodes.push(objectNode('decision/' + key, table, null, false));
  graph.inputTables.forEach((table, i) => nodes.push(objectNode('table/' + i, table, 'batchInputTableSchemaFileSha256')));
  graph.prompts.forEach((prompt, i) => {
    nodes.push(objectNode('variables/' + i, prompt.variables, 'promptVariables'));
    nodes.push(objectNode('evidence/' + i, prompt.evidence, 'renderedPromptEvidenceSchemaFileSha256'));
    nodes.push(textNode('rendered/' + i, prompt.rendered, true));
  });
  if (graph.ledger) nodes.push(artifactNode('ledger', graph.ledger, 'supersessionLedgerSchemaFileSha256'));
  graph.runs.forEach((run, i) => nodes.push(artifactNode('run/' + i, run)));
  if (graph.consensus) nodes.push(artifactNode('consensus', graph.consensus));
  if (graph.adjudication) nodes.push(artifactNode('adjudication', graph.adjudication));
  graph.secondPlans.forEach((plan, i) => nodes.push(objectNode('secondPlan/' + i, plan, 'postConsensusRouteSlotPlanSchemaFileSha256')));
  graph.campaigns.forEach((campaign, i) => nodes.push(objectNode('campaign/' + i, campaign, 'campaign')));
  graph.invalidEvidence.forEach((item, i) => nodes.push({
    ...objectNode('invalidEvidence/' + i, item.evidence, 'invalidAttemptEvidenceSchemaFileSha256'),
    bytes: item.evidenceBytes, declaredFileSha256: item.evidenceFileSha256,
  }));
  graph.snapshots.forEach((snapshot, i) => nodes.push(objectNode('snapshot/' + i, snapshot,
    snapshot.purpose === 'active-annotation-consensus-snapshot' ? 'activeAnnotationConsensusSnapshotSchemaFileSha256'
      : snapshot.purpose === 'active-upstream-snapshot' ? 'activeUpstreamSnapshotSchemaFileSha256' : 'coverageSnapshot')));
  graph.approvals.forEach((a, i) => nodes.push(artifactNode('approval/' + i, a)));
  graph.coverage.forEach((a, i) => nodes.push(artifactNode('coverage/' + i, a)));
  return nodes;
}

function inventoryOfGraph(graph) {
  return artifactGraphNodes(graph).map(node => ({
    name: node.name, format: node.format, schemaKey: node.schemaKey, planOwned: node.planOwned,
    ...(node.object === undefined ? {} : { object: clone(node.object) }), bytes: node.bytes,
    objectSha256: node.object === undefined ? null : hash(node.object),
    fileSha256: sha(node.bytes), bytesSha256: sha(node.bytes), artifactId: node.artifactId ?? null,
    embeddedRefs: flattenArtifactReferences(node.object),
  }));
}

// These are plan/execution references, not reusable source image IDs, schema
// authorities, vocabularies or expected-ID-set hashes. Record/payload hashes
// embedded inside JSONL must participate even though they are not file nodes.
const planReference = /(?:^|\.)(?:[^.]*[aA]rtifact(?:Id|FileSha256)|[^.]*[rR]ecordObjectSha256|[^.]*[pP]lanObjectSha256|protocolObjectSha256|blindedManifestObjectSha256|restrictedMappingObjectSha256|[^.]*SnapshotSha256|supersessionLedgerFileSha256|campaignIdSha256|invalidAttemptEvidenceId|approvalId|promptVariablesObjectSha256|renderedPromptEvidenceObjectSha256|renderedPromptSha256|batchInputTableObjectSha256|candidateAliasManifestObjectSha256|candidatePayloadTableObjectSha256|candidateInputSha256|consensusInputSha256|finalValuesSha256|approvalTargetObjectSha256|modelPayloadObjectSha256)$/;

export function collectArtifactInventory(input) {
  if (!Array.isArray(input)) {
    assert(input.oldGraph && input.newGraph, 'both artifact graphs are explicit');
    return { oldInventory: inventoryOfGraph(input.oldGraph), newInventory: inventoryOfGraph(input.newGraph) };
  }
  // Preserve the single-object API used by existing negative mutations.
  return input.flat(Infinity).filter(Boolean).map(value => ({
    objectSha256: hash(value), fileSha256: sha(fileBytes(value)), bytesSha256: sha(fileBytes(value)),
    artifactId: value.header?.artifactId ?? null, embeddedRefs: flattenArtifactReferences(value),
  }));
}

// Pure old-graph evidence: an invalid replacement after a valid root.
export function materializeOldInvalidEvidence(contract, workflow) {
  const run = workflow.runs[0], gen = run.header.generator;
  const campaign = materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, reasonCode: 'model-retry' });
  const body = {
    schemaVersion: 'snow-crystal-morphology-pilot-invalid-attempt/1', contractId: CONTRACT, protocolId: PROTOCOL,
    attemptPolicyId: POLICY, campaignIdSha256: hash(campaign), campaignKind: campaign.campaignKind, attemptNumber: 1,
    actorId: gen.actorId, batchId: run.header.batchId, logicalSlot: run.header.logicalSlot,
    slotPlanObjectSha256: hash(workflow.firstPlan), plannedRootArtifactId: run.header.artifactId,
    activeArtifactBeforeCampaign: { artifactId: run.header.artifactId, artifactFileSha256: run.fileSha256 },
    replacementReasonCode: 'model-retry', changedInputSha256: run.fileSha256,
    promptRefs: Object.fromEntries(['promptRole', 'promptTemplateFileSha256', 'promptVariablesObjectSha256', 'schemaFileSha256',
      'modelPayloadSchemaObjectSha256', 'renderedPromptEvidenceObjectSha256', 'renderedPromptSha256'].map(k => [k, gen[k]])),
    inputRefs: { protocolObjectSha256: hash(contract.protocol), blindedManifestObjectSha256: hash(contract.manifest),
      batchInputTableObjectSha256: hash(run.table), orderedInputSha256: run.header.orderedInputSha256 },
    run: { ...Object.fromEntries(['provider', 'product', 'displayedModelId', 'modelFamily', 'modelVersion', 'modelConfiguration',
      'clientTool', 'clientToolVersion', 'attachmentMode'].map(k => [k, gen[k]])),
      startedAtUtc: utc(15), completedAtUtc: utc(16), responseCaptureMethod: gen.responseCapture.method, responseCapturedAtUtc: utc(17) },
    rawResponseSha256: sha('not-json\n'), rawResponseByteLength: 9,
    validationErrors: [{ ordinal: 0, code: 'json-syntax', jsonPointer: null, anonymousImageId: null }],
    disposition: 'retry-allowed', containsRawResponse: false, containsPii: false,
  };
  const evidence = { ...body, invalidAttemptEvidenceId: whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body }) };
  return { campaign, evidence, rawResponseBytes: 'not-json\n', evidenceBytes: fileBytes(evidence),
    evidenceFileSha256: sha(fileBytes(evidence)), evidenceFilename: evidence.invalidAttemptEvidenceId + '.json' };
}

export function materializeOldGraph(contract, workflow, oldSecondPlan) {
  const hasSecond = oldSecondPlan !== null;
  const fresh = hasSecond && hash(oldSecondPlan) === hash(workflow.freshPlan);
  assert(!hasSecond || fresh || hash(oldSecondPlan) === hash(workflow.skippedPlan), 'known old route graph');
  const invalidEvidence = [materializeOldInvalidEvidence(contract, workflow)];
  const approvals = hasSecond ? fresh ? workflow.approvals : workflow.skippedApprovals : [];
  const coverage = hasSecond ? [fresh ? workflow.coverage : workflow.skippedCoverage] : [];
  const execution = [...workflow.runs, workflow.consensus, ...(fresh ? [workflow.adjudication] : []), ...approvals, ...coverage];
  return {
    bundle: clone(contract.bundle), templates: { annotator: contract.prompts[0].template,
      adjudicator: workflow.adjudication.prompt.template },
    protocol: contract.protocol, selection: contract.plan, manifest: contract.manifest, restricted: contract.restricted,
    candidateSet: contract.candidateSet, proxyInput: contract.proxyInput, tables: contract.tables, truthTable: contract.truthTable,
    inputTables: [...contract.inputTables, ...(fresh ? [workflow.adjudication.table] : [])],
    prompts: [...contract.prompts, ...(fresh ? [workflow.adjudication.prompt] : [])], firstPlan: workflow.firstPlan,
    secondPlans: hasSecond ? [oldSecondPlan] : [], ledger: workflow.emptyLedger, ledgerEntries: workflow.emptyLedger.records.slice(1),
    materializedRoots: execution, runs: workflow.runs, consensus: workflow.consensus,
    adjudication: fresh ? workflow.adjudication : null, aliases: fresh ? workflow.aliases : null,
    candidateTable: fresh ? workflow.candidateTable : null,
    campaigns: [...workflow.runs.map(r => r.campaign), ...(fresh ? [workflow.adjudication.campaign] : []), ...invalidEvidence.map(e => e.campaign)],
    invalidEvidence, snapshots: [workflow.snapshot, ...(fresh ? [workflow.upstreamFreshBatch, workflow.upstreamFresh, workflow.coverage.snapshot]
      : hasSecond ? [workflow.upstreamSkipped, workflow.skippedCoverage.snapshot] : [])],
    approvals, coverage,
  };
}

export function materializeReissuePlan({ contract, workflow, cause, oldSecondPlan, oldGraph }) {
  assert(oldGraph, 'oldGraph must be supplied explicitly');
  assert(REISSUE_CAUSES.some(row => row.key === cause.key && row.reasonCode === cause.reasonCode));
  const old = { protocol: oldGraph.protocol, selection: oldGraph.selection, firstPlan: oldGraph.firstPlan,
    secondPlan: oldSecondPlan, ledger: oldGraph.ledger };
  const closureBody = {
    schemaVersion: 'snow-crystal-morphology-pilot-plan-closure/1', contractId: CONTRACT, protocolId: PROTOCOL,
    oldProtocolObjectSha256: hash(old.protocol), oldSelectionPlanObjectSha256: hash(old.selection),
    oldAnnotationConsensusSlotPlanObjectSha256: hash(old.firstPlan),
    oldPostConsensusRouteSlotPlanObjectSha256: oldSecondPlan ? hash(oldSecondPlan) : null,
    oldSupersessionLedgerFileSha256: old.ledger.fileSha256, oldCutoffSequence: old.ledger.records[0].lastSequence,
    reasonCode: cause.reasonCode, closedAtUtc: utc(20), terminalState: 'invalidated-reissue-required',
    furtherModelSubmissionsAllowed: false, furtherRootMaterializationAllowed: false,
  };
  const closure = { ...closureBody, planClosureId: whash('plan-closure-id', { closureWithoutPlanClosureId: closureBody }) };
  const closureBytes = fileBytes(closure);
  const bundle = clone(contract.bundle), protocol = clone(contract.protocol), tables = clone(contract.tables);
  let template = contract.prompts[0].template;
  if (cause.key === 'schema-bytes-object-reference') bundle.annotationPayloadSchemaFileSha256.object.$comment = 'synthetic reissued payload authority';
  if (cause.key === 'template-bytes') template = template.replace(' ', '  ');
  if (cause.key === 'instruction-semantics') template = template.slice(0, -1) + '\nWhen uncertain, always request individual human review.\n';
  if (cause.key === 'placeholder-tuple') {
    protocol.prompts.annotatorAllowedPlaceholders.reverse();
    bundle.protocolObjectSchemaFileSha256.object.properties.prompts.properties.annotatorAllowedPlaceholders.prefixItems.reverse();
  }
  if (cause.key === 'renderer') {
    protocol.prompts.rendererId = 'ascii-placeholder-exact-replacement/2';
    bundle.protocolObjectSchemaFileSha256.object.properties.prompts.properties.rendererId.const = protocol.prompts.rendererId;
    bundle.renderedPromptEvidenceSchemaFileSha256.object.properties.rendererId.const = protocol.prompts.rendererId;
  }
  if (cause.key === 'decision-rules-mapping') {
    const row = tables.growth.find(r => r.valid && r.label === 'basal-dominant');
    row.label = 'indeterminate'; // hypothetical next-contract mapping, never an executed classification
  }
  // Only schemas whose source or dependent literal changed receive new bytes.
  for (const [key, value] of Object.entries(bundle)) bundle[key] = schemaFile(value.object, value.filename);
  protocol.schemaFiles = Object.fromEntries(Object.entries(bundle).map(([key, value]) => [key, value.fileSha256]));
  protocol.prompts.annotatorTemplateFileSha256 = sha(template);
  protocol.decisionContract.growthTruthTableObjectSha256 = hash(tables.growth);
  const schema = bundle.annotationPayloadSchemaFileSha256.object;
  const selection = { ...clone(contract.plan), protocolObjectSha256: hash(protocol) };
  const manifest = { ...clone(contract.manifest), protocolObjectSha256: hash(protocol), selectionPlanObjectSha256: hash(selection) };
  const restricted = { ...clone(contract.restricted), protocolObjectSha256: hash(protocol), selectionPlanObjectSha256: hash(selection), blindedManifestObjectSha256: hash(manifest) };
  const inputTables = contract.inputTables.map(t => ({ ...clone(t), protocolObjectSha256: hash(protocol), blindedManifestObjectSha256: hash(manifest) }));
  const prompts = inputTables.map(table => materializePromptChain({ protocol, schemaObject: schema, table, templateBytes: template, rendererId: protocol.prompts.rendererId }));
  const firstPlan = { ...clone(workflow.firstPlan), protocolObjectSha256: hash(protocol), blindedManifestObjectSha256: hash(manifest),
    slots: workflow.firstPlan.slots.map(slot => ({ ...slot, rootArtifactId: 'reissue-' + cause.key + '-' + slot.rootArtifactId })) };
  const newGraph = {
    bundle, templates: { ...oldGraph.templates, annotator: template }, protocol, selection, manifest, restricted,
    candidateSet: contract.candidateSet, proxyInput: contract.proxyInput, truthTable: contract.truthTable,
    tables, inputTables, prompts, firstPlan, ledger: null, consensus: null, adjudication: null, aliases: null, candidateTable: null,
    ...Object.fromEntries(EXECUTION_COLLECTIONS.map(name => [name, []])),
  };
  const { oldInventory, newInventory } = collectArtifactInventory({ oldGraph, newGraph });
  // Immutable authorities are inventoried, but are not executable identities.
  const identities = (inventory, graph) => [...new Set([
    ...inventory.filter(row => row.planOwned).flatMap(row => [row.objectSha256, row.fileSha256, row.artifactId].filter(Boolean)),
    ...inventory.filter(row => row.planOwned).flatMap(row => row.embeddedRefs.filter(([path]) => planReference.test(path)).map(([, value]) => value)),
    ...graph.firstPlan.slots.map(slot => slot.rootArtifactId),
    ...graph.secondPlans.flatMap(plan => plan.slots.map(slot => slot.rootArtifactId).filter(Boolean)),
    ...graph.invalidEvidence.map(e => e.evidence.invalidAttemptEvidenceId),
  ])].sort();
  const oldIds = identities(oldInventory, oldGraph), newIds = identities(newInventory, newGraph);
  return {
    cause, closure, closureBytes, closureFileSha256: sha(closureBytes), closureFilename: closure.planClosureId + '.json',
    old, oldGraph, newGraph, protocol, schema, bundle, template, selection, manifest, restricted,
    table: inputTables[0], prompt: prompts[0], firstPlan, oldInventory, newInventory, oldIds, newIds,
    freezeOrder: [...REISSUE_FREEZE_ORDER],
  };
}
