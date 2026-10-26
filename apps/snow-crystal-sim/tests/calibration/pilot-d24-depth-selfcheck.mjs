// Independent signature/semantic audit. No validator or fixture materializer.
import { pathToFileURL } from 'node:url';
import { assert, cases, clone, fileBytes, hash, jcs, sha, whash, schemaAccepts, PDF } from './pilot-oracle.mjs';
import { buildDepthRows, registerDepthRows } from './pilot-d24-depth-cases.mjs';

const eq = assert.deepEqual;
const keys = ['selection/absent-protocol', 'selection/foreign-protocol-reference',
  ...['unchanged-table', 'ordinal', 'protocol', 'manifest', 'batch', 'all-authorities'].map(k => 'valid-input-change/' + k),
  ...['id', 'file', 'both'].map(k => 'valid-model-retry/forged-active-' + k),
  ...['candidateSet', 'proxyInput', 'truthTable', 'decision/growth'].map(k => 'reissue/substituted-' + k),
  'reissue/inventory-reference-mismatch', 'schema-role/deep-selectionCandidateSet', 'schema-role/deep-batchInputTable'];
const expected = [
  ['selection', 'selection-invalid', 'protocol'], ['selection', 'selection-invalid', 'protocolObjectSha256'],
  ...['batchInputTableObjectSha256', 'orderedInputSha256', 'protocolObjectSha256', 'blindedManifestObjectSha256', 'batchId', 'protocolObjectSha256']
    .map(field => ['attempt-campaign', 'attempt-campaign-invalid', field]),
  ...['activeArtifactIdBeforeCampaign', 'activeArtifactFileSha256BeforeCampaign', 'activeArtifactIdBeforeCampaign']
    .map(field => ['attempt-campaign', 'attempt-campaign-invalid', field]),
  ...Array.from({ length: 5 }, () => ['plan-reissue', 'protocol-reissue-required', 'newInventory']),
  ...['selectionCandidateSet', 'batchInputTable'].map(role => ['schema-bundle', 'schema-file-binding', role + 'SchemaFileSha256']),
];
const shape = (c, role, value) => assert(schemaAccepts(c.bundle[role + 'SchemaFileSha256'].object, value), role);

function references(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => references(v, path + '[' + i + ']')).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const at = path ? path + '.' + k : k;
    if (/Sha256$|ArtifactId$|Id$/.test(k) && typeof v === 'string') return [[at, v]];
    return references(/CanonicalJson$/.test(k) && typeof v === 'string' ? JSON.parse(v) : v, at);
  }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
}

function checkChain(c, f) {
  const p = f.chain, w = f.validWrapper, t = p.table, g = w.header.generator;
  shape(c, 'batchInputTable', t); shape(c, 'renderedPromptEvidence', p.evidence);
  eq(p.schemaObject, c.bundle.annotationPayloadSchemaFileSha256.object);
  eq(p.schemaBytes, fileBytes(p.schemaObject)); eq(p.schemaFileSha256, sha(p.schemaBytes));
  eq(p.modelPayloadSchemaObjectSha256, hash(p.schemaObject));
  eq(p.batchInputTableObjectSha256, hash(t)); eq(p.table, w.table);
  shape(c, 'protocolObject', f.inputProtocol); shape(c, 'blindedManifest', f.inputManifest);
  eq(p.variables.protocolCanonicalJson, jcs(f.inputProtocol)); eq(p.variables.protocolObjectSha256, hash(f.inputProtocol));
  eq(p.variables.batchInputTableCanonicalJson, jcs(t)); eq(p.variables.batchInputTableObjectSha256, hash(t));
  eq(p.variables.modelPayloadSchemaCanonicalJson, jcs(p.schemaObject));
  eq(p.variables.schemaFileSha256, sha(p.schemaBytes)); eq(p.variables.modelPayloadSchemaObjectSha256, hash(p.schemaObject));
  const substitutions = { PROTOCOL_CANONICAL_JSON: jcs(f.inputProtocol),
    MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON: jcs(p.schemaObject), BATCH_INPUT_TABLE_CANONICAL_JSON: jcs(t) };
  const rendered = p.templateBytes.replace(/\{\{(PROTOCOL_CANONICAL_JSON|MODEL_PAYLOAD_SCHEMA_CANONICAL_JSON|BATCH_INPUT_TABLE_CANONICAL_JSON)\}\}/g, (_, key) => substitutions[key]);
  eq(p.rendered, rendered); eq(sha(p.templateBytes), f.protocol.prompts.annotatorTemplateFileSha256);
  for (const [key, value] of Object.entries({ protocolObjectSha256: hash(f.inputProtocol),
    promptTemplateFileSha256: sha(p.templateBytes), promptVariablesObjectSha256: hash(p.variables),
    schemaFileSha256: sha(p.schemaBytes), modelPayloadSchemaObjectSha256: hash(p.schemaObject), renderedPromptSha256: sha(rendered) })) {
    eq(p.evidence[key], value); if (key !== 'protocolObjectSha256') eq(g[key], value);
  }
  eq(g.renderedPromptEvidenceObjectSha256, hash(p.evidence)); eq(g.campaignIdSha256, hash(f.campaign)); eq(g.attemptNumber, 1);
  eq(w.prompt.variables, p.variables); eq(w.prompt.evidence, p.evidence); eq(w.prompt.rendered, rendered);
  eq(w.prompt, { ...f.plannedRun.prompt, template: p.templateBytes, variables: p.variables,
    evidence: p.evidence, rendered, schemaBytes: p.schemaBytes });
  eq(w.campaign, f.campaign); eq(w.header.batchInputTableObjectSha256, hash(t));
  eq(w.header.protocolObjectSha256, t.protocolObjectSha256);
  eq(w.header.blindedManifestObjectSha256, t.blindedManifestObjectSha256); eq(w.header.batchId, t.batchId);
  eq(t.protocolObjectSha256, hash(f.inputProtocol)); eq(t.blindedManifestObjectSha256, hash(f.inputManifest));
  const ordered = whash('ordered-image-input', { orderedItems: t.orderedItems.map(({ attachmentSlot, ...item }) => item) });
  eq(w.header.orderedInputSha256, ordered); eq(f.campaign.orderedInputSha256, ordered);
  eq(f.campaign.batchInputTableObjectSha256, hash(t)); eq(f.campaign.promptVariablesObjectSha256, hash(p.variables));
  eq(w.bytes, [w.header, ...w.records].map(fileBytes).join('')); eq(w.fileSha256, sha(w.bytes));
  for (const record of [w.header, ...w.records]) shape(c, 'artifact', record);
  eq(w.rawResponseBytes, fileBytes(w.modelPayloads));
  eq(g.responseCapture.capturedResponseFileSha256, sha(w.rawResponseBytes));
  eq(w.modelPayloads, f.plannedRun.modelPayloads); eq(w.records, f.plannedRun.records);
  const header = clone(f.plannedRun.header);
  Object.assign(header, { artifactId: 'd24-valid-replacement', protocolObjectSha256: t.protocolObjectSha256,
    blindedManifestObjectSha256: t.blindedManifestObjectSha256, batchId: t.batchId,
    batchInputTableObjectSha256: hash(t), orderedInputSha256: ordered });
  Object.assign(header.generator, { campaignIdSha256: hash(f.campaign), attemptNumber: 1,
    promptVariablesObjectSha256: hash(p.variables), renderedPromptEvidenceObjectSha256: hash(p.evidence), renderedPromptSha256: sha(rendered) });
  eq(w.header, header);
  eq(w.inventory, f.plannedRun.inventory.map(item => ({ ...item, fileSha256: item.kind === 'prompt' ? sha(rendered)
    : item.kind === 'batch-input' ? sha(fileBytes(t)) : item.fileSha256 })));
  const wrapper = clone(w);
  for (const key of ['header', 'table', 'prompt', 'campaign', 'inventory', 'bytes', 'fileSha256']) wrapper[key] = f.plannedRun[key];
  eq(wrapper, f.plannedRun);
  eq(f.submissions, [{ attemptNumber: 1, state: 'valid', freshContext: true }]); eq(f.invalidEvidence, []);
  eq(f.firstPlan.protocolObjectSha256, hash(f.protocol)); eq(f.campaign.slotPlanObjectSha256, hash(f.firstPlan));
  eq(f.activeBefore, { artifactId: f.campaign.activeArtifactIdBeforeCampaign, fileSha256: f.campaign.activeArtifactFileSha256BeforeCampaign });
  eq(f.campaign.changedInputSha256, f.campaign.replacementReasonCode === 'input-change' ? hash(t) : f.activeBefore.fileSha256);
}

function checkInventory(c, f, defectiveReference = false, includeOld = true) {
  for (const [side, inventory] of (includeOld ? [['old', f.oldInventory], ['new', f.newInventory]] : [['new', f.newInventory]])) {
    eq(new Set(inventory.map(r => r.name)).size, inventory.length);
    for (const row of inventory) {
      const bytes = row.format === 'text' ? row.bytes : row.format === 'jsonl'
        ? row.object.map(fileBytes).join('') : fileBytes(row.object);
      eq(row.bytes, bytes); eq(row.fileSha256, sha(bytes)); eq(row.bytesSha256, sha(bytes));
      eq(row.objectSha256, row.format === 'text' ? null : hash(row.object));
      const actual = references(row.object);
      if (side === 'new' && row.name === 'candidateSet' && defectiveReference) assert.notDeepEqual(row.embeddedRefs, actual);
      else eq(row.embeddedRefs, actual);
      if (row.schemaKey && c.bundle[row.schemaKey] && !row.name.startsWith('schema/')) {
        const values = row.format === 'jsonl' ? row.object : [row.object];
        for (const value of values) assert(schemaAccepts(c.bundle[row.schemaKey].object, value), row.name);
      }
    }
  }
  for (const [name, object] of [['protocol', f.newProtocol], ['selection', f.newSelection], ['manifest', f.newManifest],
    ['restricted', f.newRestricted], ['firstPlan', f.newFirstPlan], ['table/0', f.newTable], ['variables/0', f.newVariables], ['evidence/0', f.newEvidence]]) {
    eq(f.newInventory.find(r => r.name === name).object, object);
  }
  const { planClosureId, ...body } = f.closure;
  eq(planClosureId, whash('plan-closure-id', { closureWithoutPlanClosureId: body }));
  eq(f.closureBytes, fileBytes(f.closure)); eq(f.closureFileSha256, sha(f.closureBytes)); eq(f.closureFilename, planClosureId + '.json');
}

export function assertDepthRows(c, w, rows, registry) {
  const signatures = new WeakMap(), signed = value => {
    if (!signatures.has(value)) signatures.set(value, hash(value)); return signatures.get(value);
  };
  const checkedInventories = new WeakSet();
  eq(rows.map(r => r.key), keys); eq(rows.length, 18); eq(new Set(rows.map(r => signed(r.fixture))).size, 18);
  const registered = registry.filter(r => r.label.startsWith('d24/'));
  eq(registered.length, 18); eq(new Set(registered.map(r => r.label)).size, 18);
  for (const [i, row] of rows.entries()) {
    const f = row.fixture, b = row.baseline;
    eq([row.caseName, row.reason, row.field], expected[i]); eq(signed(b), row.baselineHash);
    assert.notEqual(signed(f), row.baselineHash);
    eq(registered.filter(r => r.label === 'd24/' + row.key).map(r => [r.caseName, signed(r.fixture), r.errorClass, r.reason, r.field]),
      [[row.caseName, signed(f), 'RangeError', row.reason, row.field]]);
    if (row.key.startsWith('selection/')) {
      const restored = clone(f);
      if (row.key.endsWith('absent-protocol')) { assert(!Object.hasOwn(f, 'protocol')); restored.protocol = b.protocol; }
      else {
        shape(c, 'protocolObject', f.foreignProtocol); eq(f.selectionPlan.protocolObjectSha256, hash(f.foreignProtocol));
        assert.notEqual(f.selectionPlan.protocolObjectSha256, hash(f.protocol));
        delete restored.foreignProtocol; restored.selectionPlan.protocolObjectSha256 = b.selectionPlan.protocolObjectSha256;
      }
      eq(restored, b); eq(b.protocol.sourcePdfSha256, PDF); eq(f.candidateSet.sourcePdfSha256, PDF); eq(f.selectionPlan.sourcePdfSha256, PDF);
      shape(c, 'selectionCandidateSet', f.candidateSet); shape(c, 'selectionProxyInput', f.proxyInput); shape(c, 'selectionPlan', f.selectionPlan);
    } else if (row.key.startsWith('valid-input-change/')) {
      checkChain(c, b); checkChain(c, f); eq(f.plannedRun, b.plannedRun); eq(f.ledger, b.ledger);
      eq(f.protocol, b.protocol); eq(f.firstPlan, b.firstPlan); eq(f.activeBefore, b.activeBefore);
      const target = row.key.split('/')[1], table = clone(b.chain.table);
      if (target === 'unchanged-table') { eq(f.chain.table, w.runs[0].table); eq(f.chain.table.orderedItems.map(r => r.attachmentSlot), w.runs[0].table.orderedItems.map(r => r.attachmentSlot)); }
      else {
        if (['ordinal', 'all-authorities'].includes(target)) table.orderedItems[0].ordinal = 99;
        if (['protocol', 'all-authorities'].includes(target)) table.protocolObjectSha256 = hash(f.inputProtocol);
        if (['manifest', 'all-authorities'].includes(target)) table.blindedManifestObjectSha256 = hash(f.inputManifest);
        if (['batch', 'all-authorities'].includes(target)) table.batchId = 'batch-02';
        eq(f.chain.table, table);
      }
      // All changes outside the new table are confined to its deterministic
      // prompt/campaign/wrapper closure; the frozen source and state persist.
      const restored = clone(f);
      for (const key of ['chain', 'campaign', 'validWrapper', 'inputProtocol', 'inputManifest']) restored[key] = b[key]; eq(restored, b);
      const protocol = clone(b.inputProtocol), manifest = clone(b.inputManifest);
      if (['protocol', 'all-authorities'].includes(target)) protocol.rasterization.inheritedProtocolObjectSha256 = hash(w.firstPlan);
      if (['manifest', 'all-authorities'].includes(target)) { manifest.entries.reverse(); manifest.protocolObjectSha256 = hash(protocol); }
      eq(f.inputProtocol, protocol); eq(f.inputManifest, manifest);
    } else if (row.key.startsWith('valid-model-retry/')) {
      checkChain(c, b); checkChain(c, f); eq(f.chain, b.chain); eq(f.plannedRun, b.plannedRun); eq(f.ledger, b.ledger);
      eq(f.foreignActive.bytes, [f.foreignActive.header, ...f.foreignActive.records].map(fileBytes).join(''));
      eq(f.foreignActive.fileSha256, sha(f.foreignActive.bytes));
      for (const record of [f.foreignActive.header, ...f.foreignActive.records]) shape(c, 'artifact', record);
      const target = row.key.split('-').at(-1);
      eq(f.activeBefore.artifactId === b.activeBefore.artifactId, target === 'file');
      eq(f.activeBefore.fileSha256 === b.activeBefore.fileSha256, target === 'id');
      eq(f.firstPlan.slots.find(s => s.logicalSlot === f.campaign.logicalSlot).rootArtifactId, b.plannedRun.header.artifactId);
      eq(f.activeDuringInvalid, f.activeBefore.artifactId);
      const restored = clone(f); delete restored.foreignActive;
      for (const key of ['campaign', 'validWrapper', 'activeBefore', 'activeDuringInvalid']) restored[key] = b[key]; eq(restored, b);
      const campaign = clone(f.campaign);
      for (const key of ['activeArtifactIdBeforeCampaign', 'activeArtifactFileSha256BeforeCampaign', 'changedInputSha256']) campaign[key] = b.campaign[key];
      eq(campaign, b.campaign);
    } else if (row.key.startsWith('reissue/')) {
      if (!checkedInventories.has(b)) { checkInventory(c, b); checkedInventories.add(b); }
      checkInventory(c, f, row.key.endsWith('reference-mismatch'), false);
      eq(f.newSelection, b.newSelection); eq(f.newProtocol, b.newProtocol); eq(f.oldInventory, b.oldInventory);
      eq(f.oldIds, b.oldIds); eq(f.newIds, b.newIds);
      if (row.key.includes('substituted-')) {
        const target = row.key.split('substituted-')[1], node = f.newInventory.find(r => r.name === target);
        eq(node.planOwned, false); assert.notEqual(node.objectSha256, b.newInventory.find(r => r.name === target).objectSha256);
        const object = node.object, original = b.newInventory.find(r => r.name === target).object;
        const restoredObject = clone(object), list = Array.isArray(restoredObject) ? restoredObject : restoredObject.rows;
        [list[0], list[1]] = [list[1], list[0]]; eq(restoredObject, original);
        const refs = { candidateSet: f.newSelection.candidateSetObjectSha256, proxyInput: f.newSelection.proxyInputObjectSha256,
          truthTable: f.newProtocol.decisionContract.consensusRoutingTruthTableObjectSha256,
          'decision/growth': f.newProtocol.decisionContract.growthTruthTableObjectSha256 };
        eq(refs[target], hash(original)); assert.notEqual(refs[target], hash(object));
      }
      const target = row.key.includes('substituted-') ? row.key.split('substituted-')[1] : 'candidateSet';
      eq(f.newInventory.filter(r => r.name !== target), b.newInventory.filter(r => r.name !== target));
      if (row.key.endsWith('reference-mismatch')) {
        const restoredRow = clone(f.newInventory.find(r => r.name === target));
        restoredRow.embeddedRefs = b.newInventory.find(r => r.name === target).embeddedRefs;
        eq(restoredRow, b.newInventory.find(r => r.name === target));
        eq(f.newInventory.find(r => r.name === target).embeddedRefs, [['sourcePdfSha256', sha(f.newSchema.bytes)]]);
      }
      const restored = clone(f); restored.newInventory = b.newInventory; eq(restored, b);
    } else {
      const role = row.key.split('deep-')[1], key = role + 'SchemaFileSha256';
      for (const [k, s] of Object.entries(f.schemaBundle)) {
        eq(s.bytes, fileBytes(s.object)); eq(s.objectSha256, hash(s.object)); eq(s.fileSha256, sha(s.bytes)); eq(f.protocol.schemaFiles[k], s.fileSha256);
      }
      eq(new Set(Object.values(f.schemaBundle).map(s => s.fileSha256)).size, 23);
      const actual = f.schemaBundle[key].object, original = b.schemaBundle[key].object, restoredSchema = clone(actual);
      if (role === 'selectionCandidateSet') {
        assert(schemaAccepts(original, c.candidateSet)); assert(!schemaAccepts(actual, c.candidateSet));
        const witness = clone(c.candidateSet); witness.rows = Array.from({ length: 206 }, () => 'wrong-row-type');
        assert(schemaAccepts(actual, witness)); assert(!schemaAccepts(original, witness));
        restoredSchema.properties.rows = original.properties.rows;
      } else {
        const witness = clone(c.inputTables[0]); witness.orderedItems[0].ordinal = -1;
        assert(schemaAccepts(actual, witness)); assert(!schemaAccepts(original, witness));
        restoredSchema.properties.orderedItems.items.properties.ordinal.minimum = original.properties.orderedItems.items.properties.ordinal.minimum;
      }
      eq(restoredSchema, original);
      const restored = clone(f); restored.schemaBundle[key] = b.schemaBundle[key]; restored.protocol.schemaFiles[key] = b.protocol.schemaFiles[key]; eq(restored, b);
    }
  }
  return { status: 'green', totalRows: 18, registeredRows: registered.length, keys,
    fixtureHashes: Object.fromEntries(rows.map(r => [r.key, signed(r.fixture)])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const c = buildContract(), w = buildWorkflow(c), rows = buildDepthRows(c, w); registerDepthRows(rows);
  console.log(JSON.stringify(assertDepthRows(c, w, rows, cases), null, 2));
}
