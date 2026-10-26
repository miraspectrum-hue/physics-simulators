// Independent D-25 audit. No validator or graph/inventory materializer import.
// Enumerate the frozen graph, decode concrete bytes, and derive identity sets
// here so an omitted row cannot disappear from both the test and its oracle.
import { pathToFileURL } from 'node:url';
import { assert, cases, clone, fileBytes, hash, jcs, sha, whash, schemaAccepts,
  immutableSnapshot, isImmutableSnapshot } from './pilot-oracle.mjs';
import { buildCompletenessRows, registerCompletenessRows } from './pilot-d25-completeness-cases.mjs';

const eq = assert.deepEqual;
const omissions = [
  ['coordinated-campaign-evidence', 'no-second-plan', ['campaign/6', 'invalidEvidence/0']],
  ['fresh/coordinated-campaign-evidence', 'fresh', ['campaign/7', 'invalidEvidence/0']],
  ['skipped/coordinated-campaign-evidence', 'skipped', ['campaign/6', 'invalidEvidence/0']],
  ['root-artifact', 'no-second-plan', ['run/0']], ['consensus-artifact', 'no-second-plan', ['consensus']],
  ['ledger', 'no-second-plan', ['ledger']], ['first-plan', 'no-second-plan', ['firstPlan']],
  ['selection-plan', 'no-second-plan', ['selection']], ['fresh/second-plan', 'fresh', ['secondPlan/0']],
  ['fresh/adjudication-artifact', 'fresh', ['adjudication']], ['fresh/snapshot', 'fresh', ['snapshot/0']],
  ['fresh/approval', 'fresh', ['approval/0']], ['fresh/coverage', 'fresh', ['coverage/0']],
  ['skipped/snapshot', 'skipped', ['snapshot/2']], ['skipped/approval', 'skipped', ['approval/1']],
  ['skipped/coverage', 'skipped', ['coverage/0']], ['invalid-evidence', 'no-second-plan', ['invalidEvidence/0']],
];

function references(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const at = Array.isArray(value) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
    if (!Array.isArray(value) && /Sha256$|ArtifactId$|Id$/.test(key) && typeof child === 'string') return [[at, child]];
    return references(!Array.isArray(value) && /CanonicalJson$/.test(key) && typeof child === 'string' ? JSON.parse(child) : child, at);
  }).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
function inventoryIdentities(rows) {
  const ids = new Set();
  const fields = ['protocolObjectSha256', 'blindedManifestObjectSha256', 'restrictedMappingObjectSha256',
    'supersessionLedgerFileSha256', 'campaignIdSha256', 'invalidAttemptEvidenceId', 'approvalId',
    'promptVariablesObjectSha256', 'renderedPromptEvidenceObjectSha256', 'renderedPromptSha256',
    'batchInputTableObjectSha256', 'candidateAliasManifestObjectSha256', 'candidatePayloadTableObjectSha256',
    'candidateInputSha256', 'consensusInputSha256', 'finalValuesSha256', 'approvalTargetObjectSha256', 'modelPayloadObjectSha256'];
  for (const row of rows) if (row.planOwned) {
    const decoded = row.format === 'text' ? undefined : row.format === 'jsonl'
      ? row.bytes.trimEnd().split('\n').map(line => JSON.parse(line)) : JSON.parse(row.bytes);
    [row.format === 'text' ? null : hash(decoded), sha(row.bytes), row.artifactId].filter(Boolean).forEach(id => ids.add(id));
    for (const [path, id] of references(decoded)) {
      const field = path.split('.').at(-1);
      if (/[aA]rtifact(?:Id|FileSha256)$|[rR]ecordObjectSha256$|[pP]lanObjectSha256$|SnapshotSha256$/.test(field) || fields.includes(field)) ids.add(id);
    }
  }
  return [...ids].sort();
}

// Literal collection walk, independent of artifactGraphNodes and inventoryOfGraph.
function requiredNodes(graph) {
  const nodes = [];
  const object = (name, value, schemaKey = null, planOwned = true, bytes = fileBytes(value), format = 'json', artifactId = null) =>
    nodes.push({ name, object: value, bytes, schemaKey, planOwned, format, artifactId });
  const artifact = (name, value, schemaKey = 'artifactSchemaFileSha256') =>
    object(name, [value.header, ...value.records], schemaKey, true, value.bytes, 'jsonl', value.header.artifactId);
  const text = (name, bytes, planOwned) => nodes.push({ name, bytes, schemaKey: null, planOwned, format: 'text', artifactId: null });
  for (const [key, value] of Object.entries(graph.bundle)) object('schema/' + key, value.object, null, false, value.bytes);
  for (const [role, bytes] of Object.entries(graph.templates)) text('template/' + role, bytes, false);
  for (const [name, role, owned] of [
    ['protocol', 'protocolObject', true], ['selection', 'selectionPlan', true], ['manifest', 'blindedManifest', true],
    ['restricted', 'restrictedMap', true], ['firstPlan', 'annotationConsensusSlotPlan', true],
    ['candidateSet', 'selectionCandidateSet', false], ['proxyInput', 'selectionProxyInput', false],
    ['truthTable', 'consensusRoutingTruthTable', false], ['aliases', 'candidateAlias', true], ['candidateTable', 'candidatePayloadTable', true],
  ]) if (graph[name]) object(name, graph[name], role + 'SchemaFileSha256', owned);
  for (const [key, value] of Object.entries(graph.tables)) object('decision/' + key, value, null, false);
  graph.inputTables.forEach((value, index) => object('table/' + index, value, 'batchInputTableSchemaFileSha256'));
  graph.prompts.forEach((value, index) => {
    object('variables/' + index, value.variables, 'promptVariables');
    object('evidence/' + index, value.evidence, 'renderedPromptEvidenceSchemaFileSha256');
    text('rendered/' + index, value.rendered, true);
  });
  artifact('ledger', graph.ledger, 'supersessionLedgerSchemaFileSha256');
  graph.runs.forEach((value, index) => artifact('run/' + index, value));
  artifact('consensus', graph.consensus);
  if (graph.adjudication) artifact('adjudication', graph.adjudication);
  graph.secondPlans.forEach((value, index) => object('secondPlan/' + index, value, 'postConsensusRouteSlotPlanSchemaFileSha256'));
  graph.campaigns.forEach((value, index) => object('campaign/' + index, value, 'campaign'));
  graph.invalidEvidence.forEach((value, index) => object('invalidEvidence/' + index, value.evidence,
    'invalidAttemptEvidenceSchemaFileSha256', true, value.evidenceBytes));
  const roles = { 'active-annotation-consensus-snapshot': 'activeAnnotationConsensusSnapshotSchemaFileSha256',
    'active-upstream-snapshot': 'activeUpstreamSnapshotSchemaFileSha256', 'pilot-approval-coverage-snapshot': 'coverageSnapshot' };
  graph.snapshots.forEach((value, index) => { assert(roles[value.purpose]); object('snapshot/' + index, value, roles[value.purpose]); });
  graph.approvals.forEach((value, index) => artifact('approval/' + index, value));
  graph.coverage.forEach((value, index) => artifact('coverage/' + index, value));
  return nodes;
}

function auditInventory(c, inventory) {
  eq(new Set(inventory.map(row => row.name)).size, inventory.length);
  for (const row of inventory) {
    const decoded = row.format === 'text' ? undefined : row.format === 'jsonl'
      ? row.bytes.trimEnd().split('\n').map(line => JSON.parse(line)) : JSON.parse(row.bytes);
    const bytes = row.format === 'text' ? row.bytes : row.format === 'jsonl' ? decoded.map(fileBytes).join('') : fileBytes(decoded);
    eq(row.bytes, bytes); eq(row.fileSha256, sha(bytes)); eq(row.bytesSha256, sha(bytes));
    eq(row.objectSha256, row.format === 'text' ? null : hash(decoded));
    eq(row.embeddedRefs, references(decoded));
    if (row.format === 'text') assert(!Object.hasOwn(row, 'object'));
    else eq(row.object, decoded);
    const artifactId = row.format === 'jsonl' ? decoded[0].artifactId : null;
    eq(row.artifactId, artifactId);
    if (c.bundle[row.schemaKey]) for (const value of row.format === 'jsonl' ? decoded : [decoded]) {
      assert(schemaAccepts(c.bundle[row.schemaKey].object, value), row.name + ': schema');
    }
  }
}
function objects(value, result = new Set()) {
  if (!value || typeof value !== 'object' || result.has(value)) return result;
  result.add(value); Object.values(value).forEach(child => objects(child, result)); return result;
}
function assertDetachedMutable(value, forbidden, owned, label) {
  for (const node of objects(value)) {
    if (isImmutableSnapshot(node)) { assert(Object.isFrozen(node)); continue; }
    assert(!forbidden.has(node), label + ': source/baseline mutable alias');
    assert(!owned.has(node), label + ': cross-fixture mutable alias'); owned.add(node);
  }
}

export function assertImmutableFixtureComputations() {
  const original = { rows: [{ note: 'é'.repeat(1024), value: 1 }] }, frozen = immutableSnapshot(original);
  for (const node of objects(frozen)) { assert(Object.isFrozen(node)); assert(isImmutableSnapshot(node)); assert(!objects(original).has(node)); }
  const signature = jcs(frozen); eq(signature, jcs(original)); eq(jcs(frozen), signature);
  original.rows[0].value = 2; assert.notEqual(jcs(original), signature); eq(jcs(frozen), signature);
  assert.throws(() => { frozen.rows[0].value = 3; }, TypeError);
  const source = immutableSnapshot({ authority: { count: 7 } });
  const left = clone({ oldGraph: frozen, sources: source, response: { count: 1 } }), right = clone(left);
  assert.equal(left.oldGraph, right.oldGraph); assert.notEqual(left.response, right.response);
  assert.equal(left.sources, source); assert.equal(right.sources, source);
  left.response.count = 2; eq(right.response.count, 1);
  const thawed = clone(frozen); thawed.rows[0].value = 3; assert.notEqual(jcs(thawed), signature);
  const inventory = immutableSnapshot([{ name: 'probe', object: { value: 1 }, embeddedRefs: [['field', 'value']], objectSha256: 'before' }]);
  const attack = clone({ sources: source, oldInventory: inventory, newInventory: inventory });
  const other = clone(attack);
  assert.notEqual(attack.oldInventory, other.oldInventory); assert.notEqual(attack.oldInventory[0], other.oldInventory[0]);
  assert.notEqual(attack.oldInventory[0], attack.newInventory[0]);
  assert.equal(attack.oldInventory[0].object, other.oldInventory[0].object);
  assert(Object.isFrozen(attack.oldInventory[0].object)); assert(Object.isFrozen(attack.oldInventory[0].embeddedRefs));
  attack.oldInventory[0].objectSha256 = 'changed'; attack.newInventory.push({ name: 'extra' });
  eq(other.oldInventory[0].objectSha256, 'before'); eq(other.newInventory.length, 1);
  assert.throws(() => { attack.oldInventory[0].object.value = 2; }, TypeError);
  const shallow = Object.freeze({ nested: { value: 1 } }), before = jcs(shallow);
  shallow.nested.value = 2; assert.notEqual(jcs(shallow), before);
  for (const value of [-0, NaN, Infinity, 'e\u0301'.repeat(1024)]) assert.throws(() => jcs(value));
  return { status: 'green', mutableAliasCount: 0, canonicalMutationProbes: 8 };
}

export function assertImmutableRegistrySharing(c, w, registry) {
  const sourceNodes = objects([c, w]), certifiedFrozen = new WeakSet(), mutableOwners = new WeakMap();
  const auditFrozen = node => {
    if (!node || typeof node !== 'object' || certifiedFrozen.has(node)) return;
    assert(isImmutableSnapshot(node)); assert(Object.isFrozen(node)); assert(!sourceNodes.has(node), 'frozen source alias');
    certifiedFrozen.add(node); Object.values(node).forEach(auditFrozen);
  };
  let auditedFixtures = 0;
  for (const row of registry.filter(item => item.caseName === 'plan-reissue')) {
    const own = new WeakSet();
    const visit = node => {
      if (!node || typeof node !== 'object' || own.has(node)) return;
      own.add(node);
      if (isImmutableSnapshot(node)) { auditFrozen(node); return; }
      assert(!sourceNodes.has(node), row.label + ': mutable source alias');
      assert(!mutableOwners.has(node), row.label + ': mutable alias with ' + mutableOwners.get(node));
      mutableOwners.set(node, row.label); Object.values(node).forEach(visit);
    };
    assert(row.fixture.oldGraph, row.label + ': oldGraph authority');
    visit(row.fixture); auditedFixtures++;
  }
  return { status: 'green', auditedFixtures, mutableAliasCount: 0 };
}

export function assertCompletenessRows(c, w, rows, registry) {
  assertImmutableFixtureComputations();
  assertImmutableRegistrySharing(c, w, registry);
  eq(rows.map(row => [row.key, row.route, row.omittedNames]), omissions); eq(rows.length, 17);
  const registered = registry.filter(row => row.label.startsWith('d25/'));
  eq(registered.length, 17); eq(new Set(registered.map(row => row.label)).size, 17);
  const sources = objects([c, w]), mutableOwned = new Set(), baselineAudits = new Map();
  const signatures = new WeakMap(), signed = value => {
    if (!signatures.has(value)) signatures.set(value, hash(value)); return signatures.get(value);
  };
  for (const row of rows) {
    const b = row.baseline, f = row.fixture, graph = b.oldGraph;
    eq([row.caseName, row.errorClass, row.reason, row.field], ['plan-reissue', 'RangeError', 'protocol-reissue-required', 'newInventory']);
    eq(signed(b), row.baselineHash); assert.notEqual(signed(f), row.baselineHash);
    if (!baselineAudits.has(b)) {
      for (const node of objects(graph)) { assert(Object.isFrozen(node)); assert(isImmutableSnapshot(node)); assert(!sources.has(node)); }
      eq(graph.protocol, c.protocol); eq(graph.selection, c.plan); eq(graph.firstPlan, w.firstPlan); eq(graph.ledger, w.emptyLedger);
      const fresh = row.route === 'fresh', second = row.route !== 'no-second-plan';
      eq(graph.secondPlans, second ? [fresh ? w.freshPlan : w.skippedPlan] : []);
      eq(graph.runs, w.runs); eq(graph.consensus, w.consensus); eq(graph.adjudication, fresh ? w.adjudication : null);
      eq(graph.approvals, second ? fresh ? w.approvals : w.skippedApprovals : []);
      eq(graph.coverage, second ? [fresh ? w.coverage : w.skippedCoverage] : []);
      eq(graph.materializedRoots, [...graph.runs, graph.consensus, ...(fresh ? [graph.adjudication] : []), ...graph.approvals, ...graph.coverage]);
      eq(graph.ledgerEntries, graph.ledger.records.slice(1));
      eq(graph.campaigns, [...graph.runs.map(run => run.campaign), ...(fresh ? [graph.adjudication.campaign] : []), ...graph.invalidEvidence.map(item => item.campaign)]);
      eq(graph.snapshots, [w.snapshot, ...(fresh ? [w.upstreamFreshBatch, w.upstreamFresh, w.coverage.snapshot]
        : second ? [w.upstreamSkipped, w.skippedCoverage.snapshot] : [])]);
      const required = requiredNodes(graph);
      eq(b.oldInventory.map(node => node.name), required.map(node => node.name));
      for (const expected of required) {
        const actual = b.oldInventory.find(node => node.name === expected.name);
        for (const key of ['name', 'format', 'schemaKey', 'planOwned', 'artifactId', 'bytes']) eq(actual[key], expected[key]);
        if (expected.format !== 'text') eq(actual.object, expected.object);
      }
      auditInventory(c, b.oldInventory); auditInventory(c, b.newInventory);
      eq(b.oldIds, inventoryIdentities(b.oldInventory)); eq(b.newIds, inventoryIdentities(b.newInventory));
      eq(b.newIds.filter(id => b.oldIds.includes(id)), []);
      const { planClosureId, ...body } = b.closure;
      eq(planClosureId, whash('plan-closure-id', { closureWithoutPlanClosureId: body }));
      eq(b.closureBytes, fileBytes(b.closure)); eq(b.closureFileSha256, sha(b.closureBytes)); eq(b.closureFilename, planClosureId + '.json');
      eq(body.oldProtocolObjectSha256, hash(graph.protocol)); eq(body.oldSelectionPlanObjectSha256, hash(graph.selection));
      eq(body.oldAnnotationConsensusSlotPlanObjectSha256, hash(graph.firstPlan));
      eq(body.oldPostConsensusRouteSlotPlanObjectSha256, second ? hash(graph.secondPlans[0]) : null);
      eq(body.oldSupersessionLedgerFileSha256, graph.ledger.fileSha256); eq(body.oldCutoffSequence, graph.ledger.records[0].lastSequence);
      baselineAudits.set(b, { required, objects: objects(b) });
    }
    assert.equal(f.oldGraph, graph, 'only recursively frozen graph data may be shared');
    eq(f.oldInventory, b.oldInventory.filter(node => !row.omittedNames.includes(node.name)));
    eq(b.oldInventory.filter(node => !f.oldInventory.some(remaining => remaining.name === node.name)).map(node => node.name).sort(), row.omittedNames.slice().sort());
    // Exact subset equality above carries every independently verified byte,
    // schema, hash and reference assertion to the remaining mutable rows.
    eq(f.oldIds, inventoryIdentities(f.oldInventory));
    eq(f.newIds, inventoryIdentities(f.newInventory)); eq(f.newIds, b.newIds);
    // Restoring only the omitted rows and their identity summary recovers the
    // exact complete baseline: no authority, byte, reference or closure attack.
    eq({ ...f, oldInventory: b.oldInventory, oldIds: b.oldIds }, b);
    const registeredRow = registered.find(item => item.label === 'd25/' + row.key);
    eq([registeredRow.caseName, registeredRow.errorClass, registeredRow.reason, registeredRow.field],
      ['plan-reissue', 'RangeError', 'protocol-reissue-required', 'newInventory']);
    eq(signed(registeredRow.fixture), signed(f));
    assertDetachedMutable(f, new Set([...sources, ...baselineAudits.get(b).objects]), mutableOwned, row.key);
    assertDetachedMutable(registeredRow.fixture, new Set([...sources, ...baselineAudits.get(b).objects]), mutableOwned, 'registered/' + row.key);
    if (row.key.includes('coordinated-campaign-evidence')) {
      const evidence = graph.invalidEvidence[0], campaignRow = b.oldInventory.find(node => node.name === row.omittedNames[0]);
      eq(evidence.evidence.campaignIdSha256, campaignRow.objectSha256);
      const { invalidAttemptEvidenceId, ...body } = evidence.evidence;
      eq(invalidAttemptEvidenceId, whash('invalid-attempt-evidence-id', { evidenceWithoutInvalidAttemptEvidenceId: body }));
      eq(evidence.evidenceBytes, fileBytes(evidence.evidence)); eq(evidence.evidenceFileSha256, sha(evidence.evidenceBytes));
      assert(b.oldIds.includes(invalidAttemptEvidenceId)); assert(!f.oldIds.includes(invalidAttemptEvidenceId));
      assert(!f.oldIds.includes(campaignRow.objectSha256));
    }
  }
  eq(new Set(rows.map(row => signed(row.fixture))).size, 17);
  return { status: 'green', totalRows: 17, registeredRows: 17, frozenOldGraphs: baselineAudits.size,
    mutableAliasCount: 0, fixtureHashes: Object.fromEntries(rows.map(row => [row.key, signed(row.fixture)])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { buildContract } = await import('./pilot-contract-fixtures.mjs');
  const { buildWorkflow } = await import('./pilot-workflow-fixtures.mjs');
  const c = buildContract(), w = buildWorkflow(c), rows = buildCompletenessRows(c, w); registerCompletenessRows(rows);
  console.log(JSON.stringify(assertCompletenessRows(c, w, rows, cases), null, 2));
}
