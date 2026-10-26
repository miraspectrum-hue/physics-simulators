// Independent positive-fixture oracle. No validator, case registry, negative-case
// module, filesystem writes, or production logic is imported here.
import { pathToFileURL } from 'node:url';
import { assert, clone, fileBytes, hash, jcs, sha, whash, idHash, schemaAccepts, parseUnique, placeholders, HASH_SCHEMA } from './pilot-oracle.mjs';
import { REISSUE_CAUSES, REISSUE_FREEZE_ORDER, EXECUTION_COLLECTIONS, artifactGraphNodes,
  collectArtifactInventory, flattenArtifactReferences, materializeOldGraph, materializeReissuePlan,
  materializePromptChain, materializeReplacementCampaign, materializeValidWrapper } from './pilot-d20-builders.mjs';

const string = { type: 'string' }, digest = { type: 'string', pattern: '^[0-9a-f]{64}$' };
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const literal = value => ({ const: value });
const localSchemas = {
  promptVariables: object({
    schemaVersion: literal('snow-crystal-morphology-pilot-prompt-variables/1'), promptRole: { anyOf: ['annotator', 'adjudicator'].map(literal) },
    protocolObjectSha256: digest, protocolCanonicalJson: string, schemaFileSha256: digest,
    modelPayloadSchemaObjectSha256: digest, modelPayloadSchemaCanonicalJson: string,
    batchInputTableObjectSha256: digest, batchInputTableCanonicalJson: string,
    candidateAliasManifestObjectSha256: nullable(digest), candidatePayloadTableObjectSha256: nullable(digest), candidatePayloadCanonicalJson: nullable(string),
  }),
  campaign: object({
    hashSchema: literal(HASH_SCHEMA), purpose: literal('model-attempt-campaign'), slotPlanObjectSha256: digest, logicalSlot: string,
    campaignKind: { anyOf: ['root-materialization', 'replacement-materialization'].map(literal) },
    activeArtifactIdBeforeCampaign: nullable(string), activeArtifactFileSha256BeforeCampaign: nullable(digest),
    replacementReasonCode: { anyOf: ['model-retry', 'input-change', null].map(literal) }, changedInputSha256: nullable(digest),
    promptVariablesObjectSha256: digest, batchInputTableObjectSha256: digest, orderedInputSha256: digest,
  }),
  coverageSnapshot: object({
    hashSchema: literal(HASH_SCHEMA), purpose: literal('pilot-approval-coverage-snapshot'),
    blindedManifestObjectSha256: digest, restrictedMappingObjectSha256: digest, postConsensusRouteSlotPlanObjectSha256: digest,
    supersessionLedgerFileSha256: digest, cutoffSequence: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
    orderedItems: { type: 'array', items: object({
      logicalSlot: string, rootArtifactId: string, activeApprovalArtifactId: string,
      approvalArtifactFileSha256: digest, approvalRecordObjectSha256: digest,
    }) },
  }),
};
const schemaCheck = (bundle, key, value, label = key) => assert(schemaAccepts(localSchemas[key] ?? bundle[key].object, value), label + ' schema');
const imageInput = table => whash('ordered-image-input', { orderedItems: table.orderedItems.map(({ attachmentSlot, ...row }) => row) });
const equal = (actual, expected, label) => assert.deepEqual(actual, expected, label);

function inventoryReferences(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const next = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
    if (!Array.isArray(value) && /Sha256$|ArtifactId$|Id$/.test(key) && typeof item === 'string') return [[next, item]];
    return inventoryReferences(!Array.isArray(value) && /CanonicalJson$/.test(key) && typeof item === 'string' ? parseUnique(item) : item, next);
  }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

// Enumerate from the graph's concrete collections, independently of both the
// builder's node walk and inventory helper. Missing families or nested evidence
// must fail even if the builder and its reported inventory omit them together.
function expectedInventory(graph) {
  const result = [];
  const add = (name, value, schemaKey = null, planOwned = true, format = 'json', bytes, artifactId = null) => {
    const serialized = bytes ?? (format === 'jsonl' ? value.map(fileBytes).join('') : fileBytes(value));
    result.push({ name, format, schemaKey, planOwned, ...(value === undefined ? {} : { object: clone(value) }), bytes: serialized,
      objectSha256: value === undefined ? null : hash(value),
      fileSha256: sha(serialized), bytesSha256: sha(serialized), artifactId, embeddedRefs: inventoryReferences(value) });
  };
  const artifact = (name, a, schema = 'artifactSchemaFileSha256') => add(name, [a.header, ...a.records], schema, true, 'jsonl', a.bytes, a.header.artifactId);
  for (const [key, value] of Object.entries(graph.bundle)) add('schema/' + key, value.object, null, false, 'json', value.bytes);
  for (const [key, value] of Object.entries(graph.templates)) add('template/' + key, undefined, null, false, 'text', value);
  for (const [name, schema, owned] of [
    ['protocol', 'protocolObject', true], ['selection', 'selectionPlan', true], ['manifest', 'blindedManifest', true],
    ['restricted', 'restrictedMap', true], ['firstPlan', 'annotationConsensusSlotPlan', true],
    ['candidateSet', 'selectionCandidateSet', false], ['proxyInput', 'selectionProxyInput', false],
    ['truthTable', 'consensusRoutingTruthTable', false], ['aliases', 'candidateAlias', true], ['candidateTable', 'candidatePayloadTable', true],
  ]) if (graph[name]) add(name, graph[name], schema + 'SchemaFileSha256', owned);
  for (const [key, value] of Object.entries(graph.tables)) add('decision/' + key, value, null, false);
  graph.inputTables.forEach((value, i) => add('table/' + i, value, 'batchInputTableSchemaFileSha256'));
  graph.prompts.forEach((p, i) => {
    add('variables/' + i, p.variables, 'promptVariables'); add('evidence/' + i, p.evidence, 'renderedPromptEvidenceSchemaFileSha256');
    add('rendered/' + i, undefined, null, true, 'text', p.rendered);
  });
  if (graph.ledger) artifact('ledger', graph.ledger, 'supersessionLedgerSchemaFileSha256');
  graph.runs.forEach((value, i) => artifact('run/' + i, value));
  if (graph.consensus) artifact('consensus', graph.consensus);
  if (graph.adjudication) artifact('adjudication', graph.adjudication);
  graph.secondPlans.forEach((value, i) => add('secondPlan/' + i, value, 'postConsensusRouteSlotPlanSchemaFileSha256'));
  graph.campaigns.forEach((value, i) => add('campaign/' + i, value, 'campaign'));
  graph.invalidEvidence.forEach((value, i) => add('invalidEvidence/' + i, value.evidence, 'invalidAttemptEvidenceSchemaFileSha256', true, 'json', value.evidenceBytes));
  const snapshotSchemas = { 'active-annotation-consensus-snapshot': 'activeAnnotationConsensusSnapshotSchemaFileSha256',
    'active-upstream-snapshot': 'activeUpstreamSnapshotSchemaFileSha256', 'pilot-approval-coverage-snapshot': 'coverageSnapshot' };
  graph.snapshots.forEach((value, i) => { assert(snapshotSchemas[value.purpose]); add('snapshot/' + i, value, snapshotSchemas[value.purpose]); });
  graph.approvals.forEach((value, i) => artifact('approval/' + i, value));
  graph.coverage.forEach((value, i) => artifact('coverage/' + i, value));
  return result;
}

// Inspect the actual inventory, not just its summaries. Every mutable inventory
// descendant must belong to that row alone and must be detached from both source
// graphs and the other inventory. Strings keep exact immutable file bytes.
function checkConcreteInventories(graphs, inventories) {
  const graphObjects = new WeakSet(), inventoryObjects = new WeakSet();
  const visit = (value, seen, label, rejectShared = false) => {
    if (!value || typeof value !== 'object') return;
    if (rejectShared) {
      assert(!graphObjects.has(value), label + ' must not alias a source graph');
      assert(!seen.has(value), label + ' must not alias another inventory value');
    } else if (seen.has(value)) return;
    seen.add(value);
    for (const child of Object.values(value)) visit(child, seen, label, rejectShared);
  };
  graphs.forEach(graph => visit(graph, graphObjects));
  for (const inventory of inventories) {
    visit(inventory, inventoryObjects, 'concrete inventory', true);
    for (const row of inventory) {
      assert.equal(typeof row.bytes, 'string', row.name + ' exact bytes');
      equal(sha(row.bytes), row.fileSha256, row.name + ' file hash');
      equal(sha(row.bytes), row.bytesSha256, row.name + ' bytes hash');
      if (row.format === 'text') {
        assert(!Object.hasOwn(row, 'object'), row.name + ' text has no object');
        equal(row.objectSha256, null); equal(row.embeddedRefs, []);
      } else {
        assert(Object.hasOwn(row, 'object'), row.name + ' concrete object');
        const decoded = row.format === 'jsonl' ? row.bytes.trimEnd().split('\n').map(parseUnique) : parseUnique(row.bytes);
        equal(decoded, row.object, row.name + ' bytes decode to concrete object');
        equal(row.bytes, row.format === 'jsonl' ? row.object.map(fileBytes).join('') : fileBytes(row.object), row.name + ' canonical bytes');
        equal(hash(row.object), row.objectSha256, row.name + ' object hash');
        equal(inventoryReferences(decoded), row.embeddedRefs, row.name + ' embedded references');
      }
    }
  }
}

function checkSchemaDefinition(schema) {
  assert(schema && typeof schema === 'object');
  if ('const' in schema) return;
  if (schema.anyOf) { schema.anyOf.forEach(checkSchemaDefinition); return; }
  assert(['object', 'array', 'string', 'number', 'integer', 'null', 'boolean'].includes(schema.type));
  if (schema.type === 'object') {
    equal(schema.required.slice().sort(), Object.keys(schema.properties).sort(), 'closed required schema');
    assert(schema.additionalProperties === false || typeof schema.additionalProperties === 'object');
    Object.values(schema.properties).forEach(checkSchemaDefinition);
    if (schema.additionalProperties) checkSchemaDefinition(schema.additionalProperties);
  }
  if (schema.type === 'array') {
    if (schema.prefixItems) schema.prefixItems.forEach(checkSchemaDefinition);
    if (schema.items !== false) checkSchemaDefinition(schema.items);
  }
}

function checkText(bytes, label) {
  assert.equal(bytes.normalize('NFC'), bytes, label);
  assert(!bytes.startsWith('\uFEFF') && !bytes.includes('\r'), label);
  assert(bytes.endsWith('\n') && !bytes.endsWith('\n\n'), label + ' one final LF');
}

// Separate rendering oracle: split template into alternating literal/token pieces.
// This deliberately does not call the byte-range renderer used by the builder.
function expectedRender(template, variables, allowed) {
  const mapping = Object.fromEntries(placeholders.map((token, i) => [token,
    variables[['protocolCanonicalJson', 'modelPayloadSchemaCanonicalJson', 'batchInputTableCanonicalJson', 'candidatePayloadCanonicalJson'][i]]]));
  const chunks = template.split(/(\{\{[A-Z_]+\}\})/);
  const tokens = chunks.filter((_, i) => i % 2 === 1);
  equal(tokens.slice().sort(), allowed.slice().sort(), 'placeholder exact multiset');
  assert.equal(new Set(tokens).size, tokens.length);
  for (let i = 0; i < chunks.length; i += 2) assert(!chunks[i].includes('{{') && !chunks[i].includes('}}'));
  return chunks.map((chunk, i) => i % 2 ? mapping[chunk] : chunk).join('');
}

export function assertPromptChain(graph, table, prompt) {
  const { protocol, bundle } = graph, vars = prompt.variables, evidence = prompt.evidence;
  const role = vars.promptRole, schema = bundle[role === 'annotator' ? 'annotationPayloadSchemaFileSha256' : 'adjudicationPayloadSchemaFileSha256'];
  const template = graph.templates[role];
  checkText(template, 'template/' + role); checkText(prompt.rendered, 'rendered/' + role);
  schemaCheck(bundle, 'batchInputTableSchemaFileSha256', table);
  schemaCheck(bundle, 'promptVariables', vars);
  schemaCheck(bundle, 'renderedPromptEvidenceSchemaFileSha256', evidence);
  equal(vars.protocolObjectSha256, hash(protocol)); equal(vars.protocolCanonicalJson, jcs(protocol));
  equal(vars.schemaFileSha256, schema.fileSha256); equal(vars.modelPayloadSchemaObjectSha256, hash(schema.object));
  equal(vars.modelPayloadSchemaCanonicalJson, jcs(schema.object));
  equal(vars.batchInputTableObjectSha256, hash(table)); equal(vars.batchInputTableCanonicalJson, jcs(table));
  if (role === 'annotator') {
    equal([vars.candidateAliasManifestObjectSha256, vars.candidatePayloadTableObjectSha256, vars.candidatePayloadCanonicalJson], [null, null, null]);
  } else {
    equal(vars.candidateAliasManifestObjectSha256, hash(graph.aliases));
    equal(vars.candidatePayloadTableObjectSha256, hash(graph.candidateTable));
    equal(vars.candidatePayloadCanonicalJson, jcs(graph.candidateTable));
  }
  equal(evidence, {
    schemaVersion: 'snow-crystal-morphology-pilot-rendered-prompt-evidence/1', promptRole: role,
    rendererId: protocol.prompts.rendererId, protocolObjectSha256: hash(protocol),
    promptTemplateFileSha256: sha(template), promptVariablesObjectSha256: hash(vars),
    schemaFileSha256: schema.fileSha256, modelPayloadSchemaObjectSha256: hash(schema.object), renderedPromptSha256: sha(prompt.rendered),
  });
  equal(prompt.rendered, expectedRender(template, vars, protocol.prompts[role + 'AllowedPlaceholders']));
  equal(protocol.prompts[role + 'TemplateFileSha256'], sha(template));
}

function checkCommonGraph(graph) {
  const { protocol, selection, manifest, restricted, firstPlan, bundle } = graph;
  let schemaValidations = 0;
  assert.equal(Object.keys(bundle).length, 23);
  equal(Object.keys(protocol.schemaFiles).sort(), Object.keys(bundle).sort());
  for (const [key, schema] of Object.entries(bundle)) {
    checkSchemaDefinition(schema.object);
    equal(schema.bytes, fileBytes(schema.object)); equal(parseUnique(schema.bytes), schema.object);
    equal(schema.fileSha256, sha(schema.bytes)); equal(schema.objectSha256, hash(schema.object));
    equal(protocol.schemaFiles[key], schema.fileSha256);
  }
  for (const node of artifactGraphNodes(graph)) {
    if (node.format === 'text') { checkText(node.bytes, node.name); continue; }
    const expectedBytes = node.format === 'jsonl' ? node.object.map(fileBytes).join('') : fileBytes(node.object);
    equal(node.bytes, expectedBytes, node.name + ' canonical bytes');
    if (node.declaredFileSha256) equal(node.declaredFileSha256, sha(node.bytes), node.name + ' file hash');
    if (node.declaredObjectSha256) equal(node.declaredObjectSha256, hash(node.object));
    const values = node.format === 'jsonl' ? node.object : [node.object];
    if (node.schemaKey) for (const value of values) { schemaCheck(bundle, node.schemaKey, value, node.name); schemaValidations++; }
  }
  equal(selection.protocolObjectSha256, hash(protocol));
  equal(selection.sourcePdfSha256, protocol.sourcePdfSha256); equal(selection.sourcePdfSha256, graph.candidateSet.sourcePdfSha256);
  equal(selection.candidateSetObjectSha256, hash(graph.candidateSet)); equal(selection.proxyInputObjectSha256, hash(graph.proxyInput));
  equal(manifest.protocolObjectSha256, hash(protocol)); equal(manifest.selectionPlanObjectSha256, hash(selection));
  equal(restricted.protocolObjectSha256, hash(protocol)); equal(restricted.selectionPlanObjectSha256, hash(selection));
  equal(restricted.blindedManifestObjectSha256, hash(manifest)); equal(manifest.sourcePdfSha256, protocol.sourcePdfSha256);
  equal(restricted.sourcePdfSha256, protocol.sourcePdfSha256);
  equal(firstPlan.protocolObjectSha256, hash(protocol)); equal(firstPlan.blindedManifestObjectSha256, hash(manifest));
  equal(protocol.decisionContract.observationSchemaObjectSha256, hash(bundle.annotationPayloadSchemaFileSha256.object.properties.observations));
  equal(protocol.decisionContract.classificationSchemaObjectSha256, hash(bundle.annotationPayloadSchemaFileSha256.object.properties.classification));
  for (const key of ['growth', 'branching', 'hollowing']) equal(protocol.decisionContract[key + 'TruthTableObjectSha256'], hash(graph.tables[key]));
  equal(protocol.decisionContract.consensusRoutingTruthTableObjectSha256, hash(graph.truthTable));
  assert.equal(firstPlan.slots.length, 7); assert.equal(new Set(firstPlan.slots.map(s => s.rootArtifactId)).size, 7);
  for (const slot of firstPlan.slots) {
    const ids = slot.artifactKind === 'consensus' ? manifest.entries.map(e => e.anonymousImageId)
      : manifest.batches.find(b => b.batchId === slot.batchId).orderedAnonymousImageIds;
    equal(slot.expectedAnonymousImageIdsSha256, idHash(ids));
  }
  assert.equal(graph.inputTables.length, graph.prompts.length);
  graph.inputTables.forEach((table, i) => {
    equal(table.protocolObjectSha256, hash(protocol)); equal(table.blindedManifestObjectSha256, hash(manifest));
    table.orderedItems.forEach((row, ordinal) => {
      equal(row.ordinal, ordinal); const image = manifest.entries.find(e => e.anonymousImageId === row.anonymousImageId);
      assert(image); equal(row.derivativeFileSha256, image.derivativeFileSha256); equal(row.derivativeRgbaSha256, image.derivativeRgbaSha256);
    });
    const batch = manifest.batches.find(b => b.batchId === table.batchId);
    if (batch) equal(table.orderedItems.map(row => row.anonymousImageId), batch.orderedAnonymousImageIds);
    assertPromptChain(graph, table, graph.prompts[i]);
  });
  for (const [ordinal, entry] of restricted.entries.entries()) {
    equal(entry.sourceObservationId, selection.slots[ordinal].sourceObservationId);
    equal(entry.anonymousImageId, manifest.entries[ordinal].anonymousImageId);
  }
  return { schemaAuthorities: Object.keys(bundle).length, schemaValidations };
}

export function assertValidWrapper({ contract, firstPlan, run, wrapper, campaign, promptChain = null, attemptNumber }) {
  const table = wrapper.table, prompt = wrapper.prompt, gen = wrapper.header.generator;
  const graph = { protocol: contract.protocol, bundle: contract.bundle, templates: { annotator: run.prompt.template } };
  assertPromptChain(graph, table, prompt);
  schemaCheck(contract.bundle, 'campaign', campaign);
  for (const line of [wrapper.header, ...wrapper.records]) schemaCheck(contract.bundle, 'artifactSchemaFileSha256', line);
  equal(wrapper.campaign, campaign); equal(gen.campaignIdSha256, hash(campaign)); equal(gen.attemptNumber, attemptNumber);
  equal(wrapper.header.protocolObjectSha256, hash(contract.protocol)); equal(wrapper.header.blindedManifestObjectSha256, hash(contract.manifest));
  equal(wrapper.header.annotationConsensusSlotPlanObjectSha256, hash(firstPlan));
  equal(wrapper.header.batchInputTableObjectSha256, hash(table));
  equal(campaign.slotPlanObjectSha256, hash(firstPlan)); equal(campaign.logicalSlot, wrapper.header.logicalSlot);
  equal(campaign.batchInputTableObjectSha256, hash(table)); equal(campaign.promptVariablesObjectSha256, hash(prompt.variables));
  equal(campaign.orderedInputSha256, imageInput(table)); equal(wrapper.header.orderedInputSha256, imageInput(table));
  for (const [key, expected] of Object.entries({
    promptRole: 'annotator', promptTemplateFileSha256: sha(run.prompt.template), promptVariablesObjectSha256: hash(prompt.variables),
    schemaFileSha256: prompt.variables.schemaFileSha256, modelPayloadSchemaObjectSha256: prompt.variables.modelPayloadSchemaObjectSha256,
    renderedPromptEvidenceObjectSha256: hash(prompt.evidence), renderedPromptSha256: sha(prompt.rendered),
  })) equal(gen[key], expected, 'generator.' + key);
  equal(wrapper.header.expectedRecordCount, table.orderedItems.length);
  equal(wrapper.header.batchId, table.batchId); equal(wrapper.header.postConsensusRouteSlotPlanObjectSha256, null);
  equal(wrapper.records, run.records); equal(wrapper.rawResponseBytes, fileBytes(wrapper.modelPayloads));
  equal(gen.responseCapture.capturedResponseFileSha256, sha(wrapper.rawResponseBytes));
  wrapper.records.forEach((record, i) => {
    equal(record.modelPayloadObjectSha256, hash(wrapper.modelPayloads[i])); equal(record.anonymousImageId, table.orderedItems[i].anonymousImageId);
    equal(record.derivativeFileSha256, table.orderedItems[i].derivativeFileSha256); equal(record.derivativeRgbaSha256, table.orderedItems[i].derivativeRgbaSha256);
  });
  for (const item of wrapper.inventory) {
    if (item.kind === 'prompt') equal(item.fileSha256, sha(prompt.rendered));
    if (item.kind === 'batch-input') equal(item.fileSha256, sha(fileBytes(table)));
    if (item.kind === 'role-schema') equal(item.fileSha256, prompt.variables.schemaFileSha256);
    if (item.kind === 'protocol-object') equal(item.fileSha256, sha(fileBytes(contract.protocol)));
  }
  const reason = campaign.replacementReasonCode;
  if (reason === 'input-change') {
    assert(promptChain); equal(table, promptChain.table);
    const stripped = value => value.orderedItems.map(({ attachmentSlot, ...row }) => row);
    equal(stripped(table), stripped(run.table)); assert.notEqual(hash(table), hash(run.table));
    equal(campaign.changedInputSha256, hash(table));
    const { batchInputTableCanonicalJson: a, batchInputTableObjectSha256: b, ...stable } = prompt.variables;
    const { batchInputTableCanonicalJson: x, batchInputTableObjectSha256: y, ...oldStable } = run.prompt.variables;
    void a; void b; void x; void y; equal(stable, oldStable);
  } else {
    equal(table, run.table); equal(prompt.variables, run.prompt.variables); equal(prompt.rendered, run.prompt.rendered);
    equal(campaign.changedInputSha256, reason === 'model-retry' ? run.fileSha256 : null);
  }
  equal(campaign.activeArtifactIdBeforeCampaign, reason ? run.header.artifactId : null);
  equal(campaign.activeArtifactFileSha256BeforeCampaign, reason ? run.fileSha256 : null);
  equal(campaign.campaignKind, reason ? 'replacement-materialization' : 'root-materialization');
  equal(wrapper.bytes, [wrapper.header, ...wrapper.records].map(fileBytes).join(''));
  equal(wrapper.fileSha256, sha(wrapper.bytes));
  return true;
}

function checkExecutionGraph(graph) {
  const artifacts = [...graph.runs, graph.consensus, graph.adjudication, ...graph.approvals, ...graph.coverage].filter(Boolean);
  const byFile = new Map(artifacts.map(a => [a.fileSha256, a]));
  const byId = new Map(artifacts.map(a => [a.header.artifactId, a]));
  const snapshots = new Map(graph.snapshots.map(s => [hash(s), s]));
  const plans = new Set([hash(graph.firstPlan), ...graph.secondPlans.map(hash)]);
  const consensusInput = records => whash('consensus-input', { orderedItems: records.flatMap(record =>
    record.annotationArtifactRefs.map(ref => ({ anonymousImageId: record.anonymousImageId, actorId: ref.actorId,
      annotationArtifactFileSha256: ref.artifactFileSha256, annotationRecordObjectSha256: ref.recordObjectSha256 }))) });
  equal(graph.materializedRoots, artifacts, 'all and only materialized artifacts');
  equal(graph.ledgerEntries, graph.ledger.records.slice(1));
  equal(graph.ledger.header.protocolObjectSha256, hash(graph.protocol));
  equal(graph.ledger.header.annotationConsensusSlotPlanObjectSha256, hash(graph.firstPlan));
  for (const artifact of artifacts) {
    const header = artifact.header;
    equal(header.protocolObjectSha256, hash(graph.protocol)); equal(header.blindedManifestObjectSha256, hash(graph.manifest));
    equal(header.annotationConsensusSlotPlanObjectSha256, hash(graph.firstPlan));
    equal(header.expectedRecordCount, artifact.records.length);
    if (header.postConsensusRouteSlotPlanObjectSha256) assert(plans.has(header.postConsensusRouteSlotPlanObjectSha256));
    if (header.restrictedMappingObjectSha256) equal(header.restrictedMappingObjectSha256, hash(graph.restricted));
    if (artifact.campaign) {
      equal(header.generator.campaignIdSha256, hash(artifact.campaign)); assert(plans.has(artifact.campaign.slotPlanObjectSha256));
      equal(artifact.campaign.promptVariablesObjectSha256, hash(artifact.prompt.variables));
      equal(artifact.campaign.batchInputTableObjectSha256, hash(artifact.table));
      equal(header.batchInputTableObjectSha256, hash(artifact.table));
      equal(header.generator.renderedPromptEvidenceObjectSha256, hash(artifact.prompt.evidence));
      equal(header.generator.renderedPromptSha256, sha(artifact.prompt.rendered));
      equal(header.generator.promptVariablesObjectSha256, hash(artifact.prompt.variables));
      equal(header.generator.schemaFileSha256, artifact.prompt.variables.schemaFileSha256);
      equal(header.generator.modelPayloadSchemaObjectSha256, artifact.prompt.variables.modelPayloadSchemaObjectSha256);
      equal(header.generator.promptTemplateFileSha256, artifact.prompt.evidence.promptTemplateFileSha256);
      equal(artifact.rawResponseBytes, fileBytes(artifact.modelPayloads));
      equal(header.generator.responseCapture.capturedResponseFileSha256, sha(artifact.rawResponseBytes));
      artifact.modelPayloads.forEach((payload, i) => {
        schemaCheck(graph.bundle, header.artifactKind === 'annotation-run' ? 'annotationPayloadSchemaFileSha256' : 'adjudicationPayloadSchemaFileSha256', payload);
        equal(artifact.records[i].modelPayloadObjectSha256, hash(payload));
        equal(artifact.records[i].anonymousImageId, payload.anonymousImageId);
      });
      equal(header.orderedInputSha256, artifact.campaign.orderedInputSha256);
      if (header.artifactKind === 'annotation-run') equal(header.orderedInputSha256, imageInput(artifact.table));
    }
    if (header.artifactKind === 'consensus') equal(header.orderedInputSha256, consensusInput(artifact.records));
    for (const record of artifact.records) {
      if (record.annotationArtifactRefs) equal(record.consensusInputSha256, consensusInput([record]));
      for (const ref of record.annotationArtifactRefs ?? []) {
        const source = byFile.get(ref.artifactFileSha256); assert(source); equal(source.header.artifactId, ref.artifactId);
        assert(source.records.some(r => hash(r) === ref.recordObjectSha256 && r.anonymousImageId === record.anonymousImageId));
      }
      if (record.recordType === 'image-adjudication') {
        equal(record.consensusArtifactFileSha256, graph.consensus.fileSha256);
        equal(record.consensusRecordObjectSha256, hash(graph.consensus.records.find(r => r.anonymousImageId === record.anonymousImageId)));
        equal(record.candidateAliasManifestObjectSha256, hash(graph.aliases));
        equal(record.candidatePayloadTableObjectSha256, hash(graph.candidateTable));
        equal(record.candidateInputSha256, graph.candidateTable.candidateInputSha256);
      }
      if (record.approvalId) {
        const { approvalId, ...body } = record;
        equal(approvalId, whash('approval-record-id', { approvalRecordWithoutApprovalId: body }));
        equal(record.finalValuesSha256, whash('approval-final-values', { activeUpstreamSnapshotSha256: record.activeUpstreamSnapshotSha256,
          orderedItems: record.targets.filter(t => t.final).map(t => ({ sourceObservationId: t.sourceObservationId, final: t.final })) }));
        equal(header.orderedInputSha256, record.finalValuesSha256);
        assert(snapshots.has(record.activeUpstreamSnapshotSha256));
        for (const target of record.targets) {
          equal(target.activeUpstreamSnapshotSha256, record.activeUpstreamSnapshotSha256);
          const source = byFile.get(target.proposal.artifactFileSha256); assert(source);
          equal(target.proposal.artifactId, source.header.artifactId);
          assert(source.records.some(r => hash(r) === target.proposal.recordObjectSha256 && r.anonymousImageId === target.anonymousImageId));
          equal(target.proposal.proposalVoteObjectSha256, target.proposal.proposalVote === null ? null : hash(target.proposal.proposalVote));
        }
      }
      if (record.coveredFinals) {
        equal(record.approvalCoverageSnapshotSha256, hash(artifact.snapshot));
        equal(header.orderedInputSha256, hash(artifact.snapshot));
        equal(record.activeApprovalRefs, artifact.snapshot.orderedItems);
        equal(record.supersessionLedgerFileSha256, graph.ledger.fileSha256);
        equal(record.postConsensusRouteSlotPlanObjectSha256, header.postConsensusRouteSlotPlanObjectSha256);
        for (const final of record.coveredFinals) {
          const approval = byFile.get(final.approvalArtifactFileSha256); assert(approval);
          equal(final.approvalRecordObjectSha256, hash(approval.records[0])); equal(final.approvalId, approval.records[0].approvalId);
          const target = approval.records[0].targets.find(t => t.sourceObservationId === final.sourceObservationId); assert(target);
          equal(final.approvalTargetObjectSha256, hash(target)); equal(final.final, target.final);
        }
      }
    }
  }
  if (graph.aliases) {
    equal(graph.aliases.protocolObjectSha256, hash(graph.protocol));
    assert(plans.has(graph.aliases.postConsensusRouteSlotPlanObjectSha256));
    equal(graph.aliases.consensusArtifactFileSha256, graph.consensus.fileSha256);
    equal(graph.candidateTable.candidateAliasManifestObjectSha256, hash(graph.aliases));
    equal(graph.candidateTable.candidateInputSha256, whash('candidate-input', { candidateAliasManifestObjectSha256: hash(graph.aliases),
      orderedItems: graph.aliases.entries.flatMap(entry => entry.candidates.map(candidate => ({ anonymousImageId: entry.anonymousImageId, ...candidate }))) }));
    equal(graph.adjudication.header.orderedInputSha256, graph.candidateTable.candidateInputSha256);
    for (const entry of graph.aliases.entries) {
      equal(entry.permutationSeedSha256, whash('candidate-alias-seed', { protocolObjectSha256: hash(graph.protocol),
        consensusArtifactFileSha256: graph.consensus.fileSha256, anonymousImageId: entry.anonymousImageId }));
      for (const candidate of entry.candidates) {
        const source = byFile.get(candidate.annotationArtifactFileSha256); assert(source);
        const record = source.records.find(r => r.anonymousImageId === entry.anonymousImageId); assert(record);
        equal(candidate.annotationRecordObjectSha256, hash(record));
        const sanitized = { alias: candidate.alias, observations: record.observations, classification: record.classification, evidence: record.evidence };
        equal(candidate.sanitizedCandidateObjectSha256, hash(sanitized));
        equal(graph.candidateTable.orderedItems.find(row => row.anonymousImageId === entry.anonymousImageId).candidates.find(row => row.alias === candidate.alias), sanitized);
      }
    }
  }
  for (const snapshot of graph.snapshots) {
    equal(snapshot.supersessionLedgerFileSha256, graph.ledger.fileSha256); equal(snapshot.cutoffSequence, graph.ledger.records[0].lastSequence);
    for (const item of snapshot.orderedItems) {
      const file = item.activeArtifactFileSha256 ?? item.artifactFileSha256 ?? item.approvalArtifactFileSha256;
      const id = item.activeArtifactId ?? item.artifactId ?? item.activeApprovalArtifactId;
      assert(byFile.has(file), 'snapshot file exists'); equal(byFile.get(file), byId.get(id));
      if (item.approvalRecordObjectSha256) equal(item.approvalRecordObjectSha256, hash(byFile.get(file).records[0]));
    }
  }
  for (const plan of graph.secondPlans) {
    equal(plan.protocolObjectSha256, hash(graph.protocol)); equal(plan.annotationConsensusSlotPlanObjectSha256, hash(graph.firstPlan));
    assert(snapshots.has(plan.activeAnnotationConsensusSnapshotSha256)); equal(plan.activeConsensusArtifactFileSha256, graph.consensus.fileSha256);
  }
  for (const item of graph.invalidEvidence) {
    const { invalidAttemptEvidenceId, ...body } = item.evidence;
    equal(invalidAttemptEvidenceId, whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body }));
    equal(item.evidenceBytes, fileBytes(item.evidence)); equal(item.evidenceFileSha256, sha(item.evidenceBytes));
    equal(item.evidenceFilename, invalidAttemptEvidenceId + '.json'); equal(item.evidence.campaignIdSha256, hash(item.campaign));
    equal(item.evidence.rawResponseSha256, sha(item.rawResponseBytes)); equal(item.evidence.rawResponseByteLength, Buffer.byteLength(item.rawResponseBytes));
    assert(plans.has(item.evidence.slotPlanObjectSha256)); assert(byId.has(item.evidence.activeArtifactBeforeCampaign.artifactId));
    equal(item.evidence.activeArtifactBeforeCampaign.artifactFileSha256, byId.get(item.evidence.activeArtifactBeforeCampaign.artifactId).fileSha256);
  }
}

export function assertReissuePositive(built) {
  const { oldGraph, newGraph, closure, cause } = built;
  const oldChecks = checkCommonGraph(oldGraph), newChecks = checkCommonGraph(newGraph);
  checkExecutionGraph(oldGraph);
  const expectedReasons = {
    'schema-bytes-object-reference': 'schema-change', 'template-bytes': 'prompt-change', 'placeholder-tuple': 'prompt-change',
    renderer: 'prompt-change', 'instruction-semantics': 'prompt-change', 'decision-rules-mapping': 'schema-change',
  };
  equal(closure.reasonCode, expectedReasons[cause.key]);
  schemaCheck(oldGraph.bundle, 'planClosureSchemaFileSha256', closure);
  const { planClosureId, ...body } = closure;
  equal(planClosureId, whash('plan-closure-id', { closureWithoutPlanClosureId: body }));
  equal(built.closureBytes, fileBytes(closure)); equal(built.closureFileSha256, sha(built.closureBytes));
  equal(built.closureFilename, planClosureId + '.json');
  equal(closure.oldProtocolObjectSha256, hash(oldGraph.protocol)); equal(closure.oldSelectionPlanObjectSha256, hash(oldGraph.selection));
  equal(closure.oldAnnotationConsensusSlotPlanObjectSha256, hash(oldGraph.firstPlan));
  equal(closure.oldPostConsensusRouteSlotPlanObjectSha256, oldGraph.secondPlans.length ? hash(oldGraph.secondPlans[0]) : null);
  equal(closure.oldSupersessionLedgerFileSha256, oldGraph.ledger.fileSha256);
  equal(closure.oldCutoffSequence, oldGraph.ledger.records[0].lastSequence);
  equal(built.freezeOrder, REISSUE_FREEZE_ORDER);
  // Distinguish independent source authorities from their derived protocol hashes.
  const sources = graph => ({
    payload: graph.bundle.annotationPayloadSchemaFileSha256.object, template: graph.templates.annotator,
    placeholders: graph.protocol.prompts.annotatorAllowedPlaceholders, renderer: graph.protocol.prompts.rendererId,
    mapping: graph.tables.growth,
  });
  const before = sources(oldGraph), after = sources(newGraph);
  const expectedKey = { 'schema-bytes-object-reference': 'payload', 'template-bytes': 'template', 'placeholder-tuple': 'placeholders',
    renderer: 'renderer', 'instruction-semantics': 'template', 'decision-rules-mapping': 'mapping' }[cause.key];
  equal(Object.keys(before).filter(key => jcs(before[key]) !== jcs(after[key])), [expectedKey], 'exactly one source authority');
  for (const key of ['candidateSet', 'proxyInput', 'truthTable']) equal(newGraph[key], oldGraph[key], 'stable authority ' + key);
  for (const key of ['branching', 'hollowing', 'confidence']) equal(newGraph.tables[key], oldGraph.tables[key], 'stable mapping ' + key);
  equal(newGraph.templates.adjudicator, oldGraph.templates.adjudicator);
  const stableProtocol = graph => {
    const value = clone(graph.protocol);
    delete value.schemaFiles;
    delete value.prompts.annotatorTemplateFileSha256;
    delete value.prompts.annotatorAllowedPlaceholders;
    delete value.prompts.rendererId;
    delete value.decisionContract.growthTruthTableObjectSha256;
    return value;
  };
  equal(stableProtocol(newGraph), stableProtocol(oldGraph), 'all unrelated protocol authorities stable');
  if (cause.key === 'template-bytes') equal(after.template.replace(/ +/g, ' '), before.template.replace(/ +/g, ' '), 'neutral spacing only');
  const expectedSchemaChanges = {
    'schema-bytes-object-reference': ['annotationPayloadSchemaFileSha256'], 'template-bytes': [],
    'placeholder-tuple': ['protocolObjectSchemaFileSha256'],
    renderer: ['protocolObjectSchemaFileSha256', 'renderedPromptEvidenceSchemaFileSha256'],
    'instruction-semantics': [], 'decision-rules-mapping': [],
  };
  equal(Object.keys(oldGraph.bundle).filter(key => oldGraph.bundle[key].fileSha256 !== newGraph.bundle[key].fileSha256).sort(),
    expectedSchemaChanges[cause.key].slice().sort(), 'only source/derived schema authorities changed');
  equal(newGraph.selection.slots, oldGraph.selection.slots); equal(newGraph.manifest.entries, oldGraph.manifest.entries);
  equal(newGraph.restricted.entries, oldGraph.restricted.entries);
  newGraph.inputTables.forEach((table, i) => equal(table.orderedItems, oldGraph.inputTables[i].orderedItems));
  for (const key of EXECUTION_COLLECTIONS) equal(newGraph[key], [], 'new unexecuted ' + key);
  const oldInventory = expectedInventory(oldGraph), newInventory = expectedInventory(newGraph);
  equal(oldInventory, built.oldInventory, 'independent old inventory');
  equal(newInventory, built.newInventory, 'independent new inventory');
  checkConcreteInventories([oldGraph, newGraph], [built.oldInventory, built.newInventory]);
  const identities = (rows, graph) => [...new Set([
    ...rows.filter(row => row.planOwned).flatMap(row => [row.objectSha256, row.fileSha256, row.artifactId].filter(Boolean)),
    ...rows.filter(row => row.planOwned).flatMap(row => row.embeddedRefs.filter(([path]) => {
      const field = path.split('.').at(-1);
      return /[aA]rtifact(?:Id|FileSha256)$|[rR]ecordObjectSha256$|[pP]lanObjectSha256$|SnapshotSha256$/.test(field)
        || ['protocolObjectSha256', 'blindedManifestObjectSha256', 'restrictedMappingObjectSha256', 'supersessionLedgerFileSha256',
          'campaignIdSha256', 'invalidAttemptEvidenceId', 'approvalId', 'promptVariablesObjectSha256', 'renderedPromptEvidenceObjectSha256',
          'renderedPromptSha256', 'batchInputTableObjectSha256', 'candidateAliasManifestObjectSha256', 'candidatePayloadTableObjectSha256',
          'candidateInputSha256', 'consensusInputSha256', 'finalValuesSha256', 'approvalTargetObjectSha256', 'modelPayloadObjectSha256'].includes(field);
    }).map(([, value]) => value)),
    ...graph.firstPlan.slots.map(slot => slot.rootArtifactId),
    ...graph.secondPlans.flatMap(plan => plan.slots.map(slot => slot.rootArtifactId).filter(Boolean)),
    ...graph.invalidEvidence.map(item => item.evidence.invalidAttemptEvidenceId),
  ])].sort();
  equal(built.oldIds, identities(oldInventory, oldGraph));
  equal(built.newIds, identities(newInventory, newGraph));
  const oldIds = new Set(built.oldIds);
  equal(built.newIds.filter(id => oldIds.has(id)), [], 'plan identity intersection');
  for (const row of built.newInventory) {
    for (const [path, value] of row.embeddedRefs) assert(!oldIds.has(value), row.name + '.' + path + ' must not reference old execution');
    assert(!row.embeddedRefs.some(([, value]) => value === planClosureId || value === built.closureFileSha256));
  }
  // Concrete node stages certify the freeze DAG; references into a later stage
  // cannot be hidden by an otherwise plausible eight-element label array.
  const stage = name => name.startsWith('schema/') || name.startsWith('template/') || name.startsWith('decision/') || ['candidateSet', 'proxyInput', 'truthTable'].includes(name) ? 3
    : name === 'protocol' ? 4 : ['selection', 'manifest', 'restricted'].includes(name) ? 5 : name === 'firstPlan' ? 7 : 6;
  const nodes = artifactGraphNodes(newGraph), identityStages = new Map();
  for (const node of nodes) {
    if (node.object) identityStages.set(hash(node.object), stage(node.name));
    identityStages.set(sha(node.bytes), stage(node.name));
  }
  for (const node of nodes) for (const [, ref] of flattenArtifactReferences(node.object))
    if (identityStages.has(ref)) assert(identityStages.get(ref) <= stage(node.name), 'freeze dependency ' + node.name);
  return { cause: cause.key, oldSecondPlan: oldGraph.secondPlans.length > 0,
    oldArtifactCount: built.oldInventory.length, newArtifactCount: built.newInventory.length,
    oldChecks, newChecks, closureSchemaValidations: 1 };
}

export function assertOldGraphPositive(graph, inventory) {
  const checks = checkCommonGraph(graph);
  checkExecutionGraph(graph);
  equal(expectedInventory(graph), inventory, 'independent alternative inventory');
  checkConcreteInventories([graph], [inventory]);
  return { artifactCount: inventory.length, ...checks };
}

export function runPositiveSelfcheck(contract, workflow) {
  const reissues = [];
  for (const cause of REISSUE_CAUSES) for (const oldSecondPlan of [null, workflow.freshPlan]) {
    const oldGraph = materializeOldGraph(contract, workflow, oldSecondPlan);
    reissues.push(assertReissuePositive(materializeReissuePlan({ contract, workflow, cause, oldSecondPlan, oldGraph })));
  }
  const run = workflow.runs[0], table = clone(run.table);
  table.orderedItems[0].attachmentSlot = 'replacement-input-change-01';
  const chain = materializePromptChain({ protocol: contract.protocol, schemaObject: contract.bundle.annotationPayloadSchemaFileSha256.object,
    table, templateBytes: run.prompt.template, rendererId: contract.protocol.prompts.rendererId });
  let wrappers = 0;
  for (const reasonCode of [null, 'model-retry', 'input-change']) for (const attemptNumber of [1, 2, 3]) {
    const campaign = reasonCode ? materializeReplacementCampaign({ run, firstPlan: workflow.firstPlan, promptChain: chain, reasonCode }) : run.campaign;
    const promptChain = reasonCode === 'input-change' ? chain : null;
    const wrapper = materializeValidWrapper({ run, firstPlan: workflow.firstPlan, campaign, promptChain, attemptNumber,
      artifactId: reasonCode ? 'replacement-' + reasonCode : run.header.artifactId });
    assertValidWrapper({ contract, firstPlan: workflow.firstPlan, run, wrapper, campaign, promptChain, attemptNumber }); wrappers++;
  }
  // A skipped route is a separate old-plan audit graph, never an additional
  // active route inside the fresh graph or another reissue matrix row.
  const skippedGraph = materializeOldGraph(contract, workflow, workflow.skippedPlan);
  const skippedInventory = collectArtifactInventory({ oldGraph: skippedGraph, newGraph: skippedGraph }).oldInventory;
  const alternativeOldGraph = assertOldGraphPositive(skippedGraph, skippedInventory);
  return { reissueChains: reissues.length, validWrappers: wrappers, alternativeOldGraph, reissues };
}

// `node pilot-positive-selfcheck.mjs` runs the positive oracle alone. Imports
// from the main suite have no side effects and never load the validator.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const contract = buildContract();
  const report = runPositiveSelfcheck(contract, buildWorkflow(contract));
  console.log(JSON.stringify({ status: 'green', ...report }, null, 2));
}
