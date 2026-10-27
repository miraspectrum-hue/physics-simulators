// Independent, read-only regression oracle for the frozen local pilot inputs.
// It deliberately does not import the validator under test.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, ROOT, PDF, CONTRACT, sha, hash, jcs, cmp, clone } from './pilot-oracle.mjs';

const INPUT_ROOT = resolve(ROOT, 'apps/snow-crystal-sim/tests/calibration/fixtures/real-pilot-selection-206');
const LOCATOR_PATH = resolve(INPUT_ROOT, 'candidate-data.js');
const DRAFT_A_PATH = resolve(INPUT_ROOT, 'draft-a-final.json');
const DRAFT_B_PATH = resolve(INPUT_ROOT, 'draft-b-final.json');
const FIELDS = ['growthAxis', 'basalBranchingLevel', 'hollowing'];
const SELECTION_SEED = 'snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/selection';
const BATCH_PREFIX = 'snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/batch-order';

const RAW_HASHES = Object.freeze({
  locator: '0d3bcacabfe8625e3c76f7d48bba3fb99280d48cac15c40cff5551f66d5e2c1e',
  annotatorA: '5a971dbfb0eda56b1f61c456f7ad7ad6f8bde5af38ade153199a6c413f2a1394',
  annotatorB: 'f92e527f738035abc224062d16c3fbf6f0ada9a29701f3afaf29e5eed63fde4f',
});
const OBJECT_HASHES = Object.freeze({
  candidateSet: '2ed0c86bd7484e2fa25117eedfc81116263029f6a76bba7fb137ab72aaf2f716',
  proxyInput: '3ab6789058efcc435ad90ac17e9d4a34510940a0db6c288eb4159d4d82db35b8',
});
const PAGE_COUNTS = Object.freeze([[11, 50], [12, 54], [13, 54], [14, 48]]);
export const REAL_SELECTION_SNAPSHOT = Object.freeze([
  'L23-F2-P12-N021', 'L23-F2-P14-N032', 'L23-F2-P14-N041', 'L23-F2-P13-N037',
  'L23-F2-P14-N038', 'L23-F2-P11-N009', 'L23-F2-P12-N041', 'L23-F2-P14-N003',
  'L23-F2-P14-N013', 'L23-F2-P11-N049', 'L23-F2-P11-N048', 'L23-F2-P13-N039',
  'L23-F2-P13-N005', 'L23-F2-P12-N030', 'L23-F2-P13-N044', 'L23-F2-P13-N020',
  'L23-F2-P12-N050', 'L23-F2-P12-N019', 'L23-F2-P13-N012', 'L23-F2-P12-N006',
  'L23-F2-P14-N030', 'L23-F2-P11-N026', 'L23-F2-P11-N024', 'L23-F2-P11-N012',
]);

const readFrozen = (path, expectedHash) => {
  const bytes = readFileSync(path);
  assert.equal(sha(bytes), expectedHash, `unexpected frozen input hash: ${path}`);
  return bytes.toString('utf8');
};
const readLocatorInventory = () => {
  const source = readFrozen(LOCATOR_PATH, RAW_HASHES.locator);
  const match = source.match(/=\s*(\[[\s\S]*\])\s*;?\s*$/);
  assert(match, 'candidate locator inventory is not a JSON array assignment');
  return JSON.parse(match[1]);
};
const vote = row => Object.fromEntries([...FIELDS, 'confidence'].map(field => [field, row[field]]));
const signature = (a, b) => [...FIELDS, 'confidence'].map(field => Object.is(a[field], b[field]) ? a[field] : 'disagreement');
const selectionKeys = (id, pdfPage, proxySignature) => ({
  sourceObservationId: id,
  pdfPage,
  proxySignature,
  selectionKeySha256: sha(`${SELECTION_SEED}\0${jcs([pdfPage, proxySignature, id])}`),
  batchOrderKeySha256: sha(`${BATCH_PREFIX}\0${id}`),
});

function deriveSlots(candidateSet, proxyInput) {
  const byId = new Map(proxyInput.rows.map(row => [row.sourceObservationId, row.proxySignature]));
  const selected = [11, 12, 13, 14].flatMap(page => {
    const groups = new Map();
    for (const [id, pdfPage] of candidateSet.rows) if (pdfPage === page) {
      const item = selectionKeys(id, pdfPage, byId.get(id));
      const key = jcs(item.proxySignature);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const ranked = [...groups.values()].flatMap(group => group
      .sort((a, b) => cmp(a.selectionKeySha256, b.selectionKeySha256) || cmp(a.sourceObservationId, b.sourceObservationId))
      .map((item, rank) => ({ item, rank })));
    return ranked
      .sort((a, b) => a.rank - b.rank || cmp(a.item.selectionKeySha256, b.item.selectionKeySha256) || cmp(a.item.sourceObservationId, b.item.sourceObservationId))
      .slice(0, 6)
      .map(({ item }, pageSlot) => ({ ...item, pageSlot: pageSlot + 1 }));
  });
  return selected
    .sort((a, b) => cmp(a.batchOrderKeySha256, b.batchOrderKeySha256) || cmp(a.sourceObservationId, b.sourceObservationId))
    .map((item, ordinal) => ({ ordinal, ...item }));
}

function planFor(protocol, candidateSet, proxyInput) {
  return {
    schemaVersion: 'snow-crystal-morphology-pilot-selection/1',
    contractId: CONTRACT,
    protocolObjectSha256: hash(protocol),
    sourcePdfSha256: PDF,
    candidateSetObjectSha256: hash(candidateSet),
    proxyInputObjectSha256: hash(proxyInput),
    algorithmId: 'page-proxy-round-robin-hash-v1',
    selectionSeed: SELECTION_SEED,
    slots: deriveSlots(candidateSet, proxyInput),
  };
}

function assertDomain(candidateSet, proxyInput) {
  assert.equal(candidateSet.rows.length, 206);
  assert.equal(proxyInput.rows.length, 206);
  assert.deepEqual(Object.fromEntries(PAGE_COUNTS.map(([page, count]) => [page, candidateSet.rows.filter(row => row[1] === page).length])), Object.fromEntries(PAGE_COUNTS));
  const ids = new Set();
  for (const [page, count] of PAGE_COUNTS) {
    const rows = candidateSet.rows.filter(row => row[1] === page);
    assert.deepEqual(rows.map(row => row[2]), Array.from({ length: count }, (_, index) => index + 1));
    for (const [id, actualPage, ordinal] of rows) {
      assert.equal(actualPage, page);
      assert.equal(id, `L23-F2-P${page}-N${String(ordinal).padStart(3, '0')}`);
      assert(!ids.has(id)); ids.add(id);
    }
  }
  assert.deepEqual(proxyInput.rows.map(row => row.sourceObservationId), candidateSet.rows.map(row => row[0]));
}

export function buildRealSelectionFixture(protocol) {
  const locators = readLocatorInventory();
  const a = JSON.parse(readFrozen(DRAFT_A_PATH, RAW_HASHES.annotatorA));
  const b = JSON.parse(readFrozen(DRAFT_B_PATH, RAW_HASHES.annotatorB));
  const aById = new Map(a.entries.map(row => [row.sourceObservationId, row]));
  const bById = new Map(b.entries.map(row => [row.sourceObservationId, row]));
  const rows = locators.map(row => [row.id, row.locator.pdfPage, row.locator.pagePanelOrdinal]).sort((left, right) => cmp(left[0], right[0]));
  const candidateSet = { schemaVersion: 'snow-crystal-morphology-pilot-candidate-set/1', sourcePdfSha256: PDF, rows };
  const proxyInput = {
    schemaVersion: 'snow-crystal-morphology-pilot-selection-proxy/1',
    annotatorAArtifactFileSha256: RAW_HASHES.annotatorA,
    annotatorBArtifactFileSha256: RAW_HASHES.annotatorB,
    rows: rows.map(([sourceObservationId]) => {
      const annotatorA = vote(aById.get(sourceObservationId));
      const annotatorB = vote(bById.get(sourceObservationId));
      return { sourceObservationId, annotatorA, annotatorB, proxySignature: signature(annotatorA, annotatorB) };
    }),
  };
  assertDomain(candidateSet, proxyInput);
  assert.equal(hash(candidateSet), OBJECT_HASHES.candidateSet);
  assert.equal(hash(proxyInput), OBJECT_HASHES.proxyInput);
  const selectionPlan = planFor(protocol, candidateSet, proxyInput);
  assert.deepEqual(selectionPlan.slots.map(slot => slot.sourceObservationId), REAL_SELECTION_SNAPSHOT);
  assert.deepEqual(selectionPlan.slots.map(slot => slot.ordinal), Array.from({ length: 24 }, (_, index) => index));
  assert.deepEqual(selectionPlan.slots.slice(0, 12).map(slot => slot.sourceObservationId), REAL_SELECTION_SNAPSHOT.slice(0, 12));
  assert.deepEqual(selectionPlan.slots.slice(12).map(slot => slot.sourceObservationId), REAL_SELECTION_SNAPSHOT.slice(12));
  for (const page of [11, 12, 13, 14]) assert.equal(selectionPlan.slots.filter(slot => slot.pdfPage === page).length, 6);
  return { protocol, candidateSet, proxyInput, selectionPlan };
}

export function realSelectionBoundaryMutations(fixture) {
  return PAGE_COUNTS.map(([page, maximum]) => {
    const next = clone(fixture);
    const oldId = `L23-F2-P${page}-N${String(maximum).padStart(3, '0')}`;
    const nextOrdinal = maximum + 1;
    const newId = `L23-F2-P${page}-N${String(nextOrdinal).padStart(3, '0')}`;
    const candidateIndex = next.candidateSet.rows.findIndex(row => row[0] === oldId);
    const proxyIndex = next.proxyInput.rows.findIndex(row => row.sourceObservationId === oldId);
    assert(candidateIndex >= 0 && proxyIndex >= 0);
    next.candidateSet.rows[candidateIndex] = [newId, page, nextOrdinal];
    next.proxyInput.rows[proxyIndex] = { ...next.proxyInput.rows[proxyIndex], sourceObservationId: newId };
    next.selectionPlan = planFor(next.protocol, next.candidateSet, next.proxyInput);
    assert.deepEqual(next.selectionPlan.slots.map(slot => slot.sourceObservationId), REAL_SELECTION_SNAPSHOT);
    return { page, sourceObservationId: newId, fixture: next };
  });
}
