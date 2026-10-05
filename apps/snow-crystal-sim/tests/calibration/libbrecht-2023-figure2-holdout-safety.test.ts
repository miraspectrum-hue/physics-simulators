// Synthetic, test-local protocol. No production scorer, validator, or shared test helper is imported.
// @ts-expect-error Browser workspace does not install Node type declarations.
import { createHash } from 'node:crypto';
// @ts-expect-error Browser workspace does not install Node type declarations.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// @ts-expect-error Browser workspace does not install Node type declarations.
import { join } from 'node:path';
// @ts-expect-error Browser workspace does not install Node type declarations.
import { tmpdir } from 'node:os';
// @ts-expect-error Browser workspace does not install Node type declarations.
import { spawn } from 'node:child_process';
// @ts-expect-error Browser workspace does not install Node type declarations.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type J = null | boolean | number | string | J[] | { [key: string]: J };
type Obj = Record<string, any>;
const requireNode = createRequire(import.meta.url);
const runtime = globalThis as unknown as { process: { execPath: string }; Buffer: { from: (s: string) => { toString: (encoding: string) => string } } };
const ERROR = 'holdout-already-opened-or-in-progress';
const AT = '2026-10-01T00:00:00Z';
const OPENED_AT = '2026-10-01T00:05:00Z';
const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
// This fixture oracle is separate from the source compiled into both parent and child processes.
function canonical(value: J): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
}
const digest = (value: J) => hash(canonical(value));
const parse = (file: string): Obj => JSON.parse(readFileSync(file, 'utf8')) as Obj;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const paths = (d: string) => ({ run: join(d, 'holdout-run.json'), marker: join(d, 'holdout-open-intent.json'), report: join(d, 'holdout-report.json') });

// Fixed external evidence and artifact identities are not taken from the run being validated.
const INPUTS = {
  corpusSha256: hash('approved-corpus'), splitSha256: hash('approved-split'),
  protocolSha256: hash('approved-protocol'), candidateManifestSha256: hash('approved-manifest'),
  selectedCandidateId: hash('approved-candidate-id'), selectedCandidateSha256: hash('approved-candidate'),
  trainReportSha256: hash('approved-train-report'),
};
const COMPARATOR = hash('approved-comparator-id');
const EVIDENCE = hash('human-reviewed-train-evidence');
const CALIBRATION = 'calibration-synthetic-0001';
function expectedSealed(): Obj {
  const humanGate = {
    decision: 'approved-for-one-time-open',
    inputBundleSha256: digest({ inputs: INPUTS, selectedComparatorId: COMPARATOR }),
    evidenceSha256: EVIDENCE, approverRole: 'human-approver', approvedAtUtc: AT, note: null,
  };
  const bare = {
    schemaVersion: 'snow-crystal-holdout-run/1', calibrationId: CALIBRATION,
    state: 'sealed', inputs: INPUTS, selectedComparatorId: COMPARATOR,
    humanGate, holdoutReportSha256: null,
  };
  return { ...bare, sealedRecordSha256: digest(bare) };
}
const reference = { inputs: INPUTS, comparatorId: COMPARATOR, evidenceSha256: EVIDENCE,
  gateSha256: digest(expectedSealed().humanGate), calibrationId: CALIBRATION,
  approvedAtUtc: AT, openedAtUtc: OPENED_AT };
function expectedMarker(sealed: Obj): Obj {
  return {
    schemaVersion: 'snow-crystal-holdout-open-intent/1', calibrationId: CALIBRATION,
    sealedRecordSha256: sealed.sealedRecordSha256,
    inputBundleSha256: sealed.humanGate.inputBundleSha256, openedAtUtc: OPENED_AT,
  };
}
function expectedOpening(sealed: Obj, marker: Obj): Obj {
  return { ...sealed, state: 'opening', openIntentSha256: digest(marker), openedAtUtc: OPENED_AT, holdoutReportSha256: null };
}

// The exact same JavaScript source is evaluated by this Vitest process and both racing children.
// Only Node built-ins are injected; onRead is the observable holdout reader boundary.
const protocolSource = String.raw`(function(require) {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const HEX = /^[0-9a-f]{64}$/, UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
  const ERROR = 'holdout-already-opened-or-in-progress';
  const fail = m => { throw new RangeError(m); };
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  function jcs(x) {
    if (x === null || typeof x !== 'object') {
      if (typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0))) fail('invalid-jcs-number');
      return JSON.stringify(x);
    }
    if (Array.isArray(x)) return '[' + x.map(jcs).join(',') + ']';
    return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + jcs(x[k])).join(',') + '}';
  }
  const digest = x => sha(jcs(x));
  const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
  const validUtc = s => typeof s === 'string' && UTC.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s.replace('Z', '.000Z');
  function exact(x, keys, label) {
    if (!x || typeof x !== 'object' || Array.isArray(x) ||
      Object.keys(x).sort().join('|') !== keys.slice().sort().join('|')) fail('holdout-schema-' + label);
  }
  function fraction(n, d) {
    const gcd = (a,b) => b ? gcd(b,a%b) : a;
    const divisor = gcd(n,d);
    return {numerator:n/divisor,denominator:d/divisor,value:n/d};
  }
  function mean(values) {
    let sum=0, compensation=0;
    for(const value of values) {
      const next=sum+value;
      compensation+=Math.abs(sum)>=Math.abs(value)?(sum-next)+value:(value-next)+sum;
      sum=next;
    }
    return (sum+compensation)/values.length;
  }
  function lossDetail(rankDigits, shapeDigits) {
    const rank = [...rankDigits].map(Number), shape = [...shapeDigits].map(Number);
    const observationMeans=[mean(shape.slice(0,2).map(x=>x/4)),
      mean(shape.slice(2,4).map(x=>x/4))];
    return {rankPrimitiveTwicePenalties:rank,shapePrimitiveQuarters:shape,
      basalTagRankLoss:fraction(rank[0]+rank[1],4),
      integratedTagRankLoss:fraction(rank[0]+rank[1]+rank[2],6),
      shapeLoss:mean(observationMeans),
      evidence:{basalRankPrimitiveCount:2,integratedRankPrimitiveCount:3,shapePrimitiveCount:4,
        rankGroupPairsPerComponent:1,basalComponentsPerStratum:2,integratedComponentsPerStratum:3,
        rankStrataPerSeed:1,shapeFeaturesPerObservation:2,shapeObservationsPerGroup:1,
        shapeGroupsPerStratum:2,shapeStrataPerSeed:1}};
  }
  function aggregate(details, party) {
    const entries = details.map(detail=>detail[party]);
    const basal = entries.reduce((sum,entry)=>sum+entry.rankPrimitiveTwicePenalties[0]+entry.rankPrimitiveTwicePenalties[1],0);
    const integrated = entries.reduce((sum,entry)=>sum+entry.rankPrimitiveTwicePenalties.reduce((a,b)=>a+b,0),0);
    // Each detail is one nonempty stratum. Four shape primitives make two features
    // in each of two one-observation groups; seeds then checkpoints are equally weighted.
    const checkpointShape = [0,1,2].map(k=>{
      const seedValues = entries.slice(k*8,k*8+8).map(entry=>entry.shapeLoss);
      return mean(seedValues);
    });
    return {basalTagRankLoss:fraction(basal,4*24),
      integratedTagRankLoss:fraction(integrated,6*24),
      shapeLoss:mean(checkpointShape)};
  }
  function aggregateEvidence(details) {
    const counts = party => details.reduce((result,detail)=>({
      basalRankPrimitiveCount:result.basalRankPrimitiveCount+detail[party].evidence.basalRankPrimitiveCount,
      integratedRankPrimitiveCount:result.integratedRankPrimitiveCount+detail[party].evidence.integratedRankPrimitiveCount,
      shapePrimitiveCount:result.shapePrimitiveCount+detail[party].evidence.shapePrimitiveCount,
    }),{basalRankPrimitiveCount:0,integratedRankPrimitiveCount:0,shapePrimitiveCount:0});
    return {candidate:counts('candidate'),comparator:counts('comparator'),
      nonemptyDenominators:{rankGroupPairsPerComponent:1,basalComponentsPerStratum:2,
        integratedComponentsPerStratum:3,rankStrataPerSeed:1,shapeFeaturesPerObservation:2,
        shapeObservationsPerGroup:1,shapeGroupsPerStratum:2,shapeStrataPerSeed:1,
        seedsPerCheckpoint:8,checkpoints:3}};
  }
  function pareto(candidate, comparator) {
    const c = [candidate.integratedTagRankLoss.value,candidate.shapeLoss];
    const b = [comparator.integratedTagRankLoss.value,comparator.shapeLoss];
    return {candidateNotWorse:c.every((value,i)=>value<=b[i]),
      strictlyBetter:c.some((value,i)=>value<b[i])};
  }
  const inputKeys = ['corpusSha256','splitSha256','protocolSha256','candidateManifestSha256',
    'selectedCandidateId','selectedCandidateSha256','trainReportSha256'];
  const baseKeys = ['schemaVersion','calibrationId','state','inputs','selectedComparatorId',
    'humanGate','sealedRecordSha256','holdoutReportSha256'];
  function validate(record, expected, marker, report) {
    const state = record && record.state;
    if (!['sealed','opening','opened'].includes(state)) fail('holdout-invalid-state');
    const transition = ['openIntentSha256','openedAtUtc'];
    exact(record, baseKeys.concat(state === 'sealed' ? [] : state === 'opening' ? transition : transition.concat('acceptance')), state);
    if (record.schemaVersion !== 'snow-crystal-holdout-run/1' ||
      record.calibrationId !== expected.calibrationId || !HEX.test(record.sealedRecordSha256) ||
      !HEX.test(record.selectedComparatorId)) fail('holdout-invalid-record');
    exact(record.inputs, inputKeys, 'inputs');
    for (const key of inputKeys) {
      if (!HEX.test(record.inputs[key]) || record.inputs[key] !== expected.inputs[key]) fail('holdout-input-mismatch:' + key);
    }
    if (record.selectedComparatorId !== expected.comparatorId) fail('holdout-comparator-mismatch');
    exact(record.humanGate, ['decision','inputBundleSha256','evidenceSha256','approverRole','approvedAtUtc','note'], 'human-gate');
    const gate = record.humanGate;
    if (gate.decision !== 'approved-for-one-time-open' || gate.approverRole !== 'human-approver' ||
      !validUtc(gate.approvedAtUtc) || gate.approvedAtUtc !== expected.approvedAtUtc ||
      (gate.note !== null && typeof gate.note !== 'string') || digest(gate) !== expected.gateSha256 ||
      !HEX.test(gate.evidenceSha256) || gate.evidenceSha256 !== expected.evidenceSha256 ||
      gate.inputBundleSha256 !== digest({inputs:record.inputs, selectedComparatorId:record.selectedComparatorId}))
      fail('holdout-human-gate-mismatch');
    const bare = {schemaVersion:record.schemaVersion,calibrationId:record.calibrationId,state:'sealed',
      inputs:record.inputs,selectedComparatorId:record.selectedComparatorId,humanGate:gate,holdoutReportSha256:null};
    if (record.sealedRecordSha256 !== digest(bare)) fail('holdout-sealed-hash-mismatch');
    if (state === 'sealed') {
      if (record.holdoutReportSha256 !== null) fail('holdout-invalid-sealed-report');
      return record;
    }
    if (!marker) fail('holdout-missing-marker');
    exact(marker, ['schemaVersion','calibrationId','sealedRecordSha256','inputBundleSha256','openedAtUtc'], 'intent');
    if (marker.schemaVersion !== 'snow-crystal-holdout-open-intent/1' || marker.calibrationId !== record.calibrationId ||
      marker.sealedRecordSha256 !== record.sealedRecordSha256 ||
      marker.inputBundleSha256 !== gate.inputBundleSha256 ||
      marker.openedAtUtc !== record.openedAtUtc || !validUtc(marker.openedAtUtc) ||
      !validUtc(record.openedAtUtc) || record.openedAtUtc !== expected.openedAtUtc ||
      record.openedAtUtc <= gate.approvedAtUtc || record.openIntentSha256 !== digest(marker))
      fail('holdout-intent-mismatch');
    if (state === 'opening') {
      if (record.holdoutReportSha256 !== null || report !== undefined) fail('holdout-invalid-opening-report');
    } else {
      if (!HEX.test(record.holdoutReportSha256) || !['accepted','rejected'].includes(record.acceptance) ||
        report === undefined) fail('holdout-report-mismatch');
      validateReport(report, record);
      if (record.holdoutReportSha256 !== digest(report)) fail('holdout-report-mismatch');
    }
    return record;
  }
  function durable(file, value, tag, events) {
    const temp = file + '.tmp-' + tag;
    const fd = fs.openSync(temp, 'wx'); events.push('wx:' + path.basename(temp));
    try { fs.writeFileSync(fd, jcs(value)); events.push('write:' + path.basename(temp));
      fs.fsyncSync(fd); events.push('flush:' + path.basename(temp)); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, file); events.push('rename:' + tag);
  }
  function makeReport(sealed, outcome) {
    const details = [];
    for (const checkpoint of [10,20,40]) for (let seed = 0; seed < 8; seed++) {
      const late = seed >= 4, phase = checkpoint === 10 ? 0 : checkpoint === 20 ? 1 : 2;
      const acceptedRanks = [['000','001'],['001','011'],['011','111']];
      const rejectedRanks = [['111','211'],['211','221'],['221','222']];
      const acceptedShapes = [['0000','1111'],['1111','2222'],['2222','3333']];
      const rank = outcome === 'accepted' ? acceptedRanks[phase][Number(late)] : rejectedRanks[phase][Number(late)];
      const shape = outcome === 'accepted' ? acceptedShapes[phase][Number(late)] : '3333';
      details.push({checkpointBasalRadiusCells:checkpoint,seedIndex:seed,
        candidate:lossDetail(rank,shape),comparator:lossDetail('111','2222')});
    }
    const candidate = aggregate(details,'candidate'), comparator = aggregate(details,'comparator');
    const decision = pareto(candidate,comparator);
    return {schemaVersion:'snow-crystal-holdout-report/1',inputs:sealed.inputs,
      selectedCandidateId:sealed.inputs.selectedCandidateId,
      selectedCandidateSha256:sealed.inputs.selectedCandidateSha256,
      selectedComparatorId:sealed.selectedComparatorId,trainReportSha256:sealed.inputs.trainReportSha256,
      rankComponentSet:'integrated-rank-v1',checkpointSeedDetails:details,
      loss:{candidate,comparator},
      evidence:aggregateEvidence(details),
      pareto:decision,acceptance:decision.candidateNotWorse&&decision.strictlyBetter?'accepted':'rejected'};
  }
  function validateReport(report, record) {
    exact(report, ['schemaVersion','inputs','selectedCandidateId','selectedCandidateSha256',
      'selectedComparatorId','trainReportSha256','rankComponentSet','checkpointSeedDetails','loss','evidence','pareto','acceptance'], 'report');
    exact(report.inputs, inputKeys, 'report-inputs');
    for (const key of inputKeys) if (report.inputs[key] !== record.inputs[key]) fail('holdout-report-input:' + key);
    if (report.schemaVersion !== 'snow-crystal-holdout-report/1' ||
      report.selectedCandidateId !== record.inputs.selectedCandidateId ||
      report.selectedCandidateSha256 !== record.inputs.selectedCandidateSha256 ||
      report.selectedComparatorId !== record.selectedComparatorId ||
      report.trainReportSha256 !== record.inputs.trainReportSha256 ||
       report.acceptance !== record.acceptance || report.rankComponentSet !== 'integrated-rank-v1' ||
      !Array.isArray(report.checkpointSeedDetails) || report.checkpointSeedDetails.length !== 24)
      fail('holdout-report-reference');
    const expectedReport = makeReport(record, record.acceptance);
    for (let index = 0; index < 24; index++) {
      const actual = report.checkpointSeedDetails[index];
      const expected = expectedReport.checkpointSeedDetails[index];
      exact(actual, ['checkpointBasalRadiusCells','seedIndex','candidate','comparator'], 'report-detail');
      for (const party of ['candidate','comparator']) {
        const entry=actual[party];
        exact(entry,['rankPrimitiveTwicePenalties','shapePrimitiveQuarters','basalTagRankLoss',
          'integratedTagRankLoss','shapeLoss','evidence'],'report-detail-loss');
        if (!Array.isArray(entry.rankPrimitiveTwicePenalties) || entry.rankPrimitiveTwicePenalties.length!==3 ||
          entry.rankPrimitiveTwicePenalties.some(n=>![0,1,2].includes(n)) ||
          !Array.isArray(entry.shapePrimitiveQuarters) || entry.shapePrimitiveQuarters.length!==4 ||
          entry.shapePrimitiveQuarters.some(n=>![0,1,2,3,4].includes(n)) ||
          jcs(entry)!==jcs(lossDetail(entry.rankPrimitiveTwicePenalties.join(''),entry.shapePrimitiveQuarters.join(''))))
          fail('holdout-report-detail-loss:'+index);
      }
      if (jcs(actual) !== jcs(expected)) fail('holdout-report-detail:' + index);
    }
    exact(report.loss, ['candidate','comparator'], 'report-loss');
    const recomputed={candidate:aggregate(report.checkpointSeedDetails,'candidate'),
      comparator:aggregate(report.checkpointSeedDetails,'comparator')};
    if(jcs(report.loss)!==jcs(recomputed)) fail('holdout-report-aggregate');
    const decision=pareto(recomputed.candidate,recomputed.comparator);
    if(jcs(report.pareto)!==jcs(decision) ||
      report.acceptance!==(decision.candidateNotWorse&&decision.strictlyBetter?'accepted':'rejected'))
      fail('holdout-report-pareto');
    exact(report.evidence,['candidate','comparator','nonemptyDenominators'],'report-evidence');
    if(jcs(report.evidence)!==jcs(aggregateEvidence(report.checkpointSeedDetails)))
      fail('holdout-report-evidence');
    exact(report.pareto, ['candidateNotWorse','strictlyBetter'], 'report-pareto');
    if (jcs(report.loss) !== jcs(expectedReport.loss) ||
      jcs(report.evidence) !== jcs(expectedReport.evidence) ||
      jcs(report.pareto) !== jcs(expectedReport.pareto) ||
      report.acceptance !== expectedReport.acceptance) fail('holdout-report-aggregate');
  }
  function open(dir, expected, onRead, crash) {
    const run = path.join(dir,'holdout-run.json'), intent = path.join(dir,'holdout-open-intent.json');
    const reportFile = path.join(dir,'holdout-report.json'), events = [];
    if (fs.existsSync(intent)) fail(ERROR);
    const sealed = read(run); events.push('read:sealed');
    if (fs.existsSync(intent)) fail(ERROR);
    validate(sealed, expected); events.push('validate:sealed');
    const marker = {schemaVersion:'snow-crystal-holdout-open-intent/1',calibrationId:sealed.calibrationId,
      sealedRecordSha256:sealed.sealedRecordSha256,inputBundleSha256:sealed.humanGate.inputBundleSha256,
      openedAtUtc:expected.openedAtUtc};
    let fd;
    try { fd = fs.openSync(intent,'wx'); }
    catch (error) { if (error && error.code === 'EEXIST') fail(ERROR); throw error; }
    events.push('wx:holdout-open-intent.json');
    try { fs.writeFileSync(fd,jcs(marker)); events.push('write:holdout-open-intent.json');
      fs.fsyncSync(fd); events.push('flush:holdout-open-intent.json'); }
    finally { fs.closeSync(fd); }
    const opening = {...sealed,state:'opening',openIntentSha256:digest(marker),
      openedAtUtc:expected.openedAtUtc,holdoutReportSha256:null};
    validate(opening,expected,marker);
    durable(run,opening,'opening',events);
    const persistedOpening = read(run); events.push('observe:opening');
    validate(persistedOpening,expected,read(intent));
    if (crash === 'opening') throw Object.assign(new Error('injected-crash-after-opening'),{events});
    const outcome = onRead(); events.push('reader');
    if (!['accepted','rejected'].includes(outcome)) fail('invalid-reader-outcome');
    const report = makeReport(sealed,outcome);
    durable(reportFile,report,'report',events);
    const persistedReport = read(reportFile); events.push('observe:report');
    if (jcs(persistedReport) !== jcs(report)) fail('report-not-durable');
    if (crash === 'report') throw Object.assign(new Error('injected-crash-after-report'),{events});
    const opened = {...opening,state:'opened',holdoutReportSha256:digest(persistedReport),acceptance:outcome};
    validate(opened,expected,read(intent),persistedReport);
    durable(run,opened,'opened',events);
    const persistedOpened = read(run); events.push('observe:opened');
    validate(persistedOpened,expected,read(intent),persistedReport);
    return {record:persistedOpened,events};
  }
  function train(rows, holdoutIds, onStage) {
    const seen = new Set(holdoutIds);
    for (const row of rows) {
      if (row.partition !== 'train' || [row.sourceId,row.annotation && row.annotation.sourceId,
        row.shape && row.shape.sourceId].some(id => seen.has(id))) fail('holdout-data-in-training');
    }
    for (const stage of ['cdf','baseline','candidate','threshold','tiebreak']) onStage(stage);
    return rows.map(row => row.sourceId);
  }
  return {open,validate,train};
})`;
type Protocol = { open: (d: string, r: Obj, reader: () => 'accepted' | 'rejected', crash?: string) => { record: Obj; events: string[] }; validate: (r: Obj, e: Obj, m?: Obj, p?: Obj) => Obj; train: (rows: Obj[], ids: string[], stage: (s: string) => void) => string[] };
const protocol = (new Function('return ' + protocolSource)() as (r: unknown) => Protocol)(requireNode);
function directory<T>(fn: (d: string) => T): T {
  const d = mkdtempSync(join(tmpdir(), 'snow-holdout-synthetic-'));
  try { return fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}
async function directoryAsync<T>(fn: (d: string) => Promise<T>): Promise<T> {
  const d = mkdtempSync(join(tmpdir(), 'snow-holdout-synthetic-'));
  try { return await fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}
function writeSealed(d: string, value = expectedSealed()) { writeFileSync(paths(d).run, canonical(value)); }
function reseal(x: Obj) {
  x.humanGate.inputBundleSha256 = digest({ inputs: x.inputs, selectedComparatorId: x.selectedComparatorId });
  const { sealedRecordSha256: _old, ...bare } = x;
  x.sealedRecordSha256 = digest(bare);
}
function captureFailure(fn: () => unknown): { name: string; message: string } {
  try { fn(); throw new Error('expected rejection'); }
  catch (e) { const error = e as Error; if (error.message === 'expected rejection') throw error; return { name: error.name, message: error.message }; }
}
function freshProcessReopen(d: string): Promise<Obj> {
  const childCode = String.raw`const source=Buffer.from(process.argv[1],'base64').toString('utf8');
    const protocol=(new Function('return '+source)())(require);
    const directory=process.argv[2], expected=JSON.parse(process.argv[3]); let reader=0;
    try { const result=protocol.open(directory,expected,()=>{reader++;return 'accepted'});
      console.log(JSON.stringify({ok:true,reader,record:result.record})); }
    catch(error) { console.log(JSON.stringify({ok:false,reader,name:error.name,message:error.message})); }`;
  return new Promise<Obj>((resolve,reject) => {
    const child = spawn(runtime.process.execPath,['-e',childCode,runtime.Buffer.from(protocolSource).toString('base64'),d,JSON.stringify(reference)]);
    let stdout = '', stderr = '';
    child.stdout.on('data',(bytes: Uint8Array) => { stdout += String(bytes); });
    child.stderr.on('data',(bytes: Uint8Array) => { stderr += String(bytes); });
    child.on('error',reject);
    child.on('close',(code: number) => {
      if (code !== 0 || stderr || !stdout.trim()) reject(new Error(`restart child ${code}: ${stderr || stdout}`));
      else resolve(JSON.parse(stdout.trim()) as Obj);
    });
  });
}

// Independent 24-row oracle. Columns are checkpoint, seed, candidate's three
// rank twice-penalties, comparator's three, candidate's four shape quarters,
// comparator's four. Rank components have one eligible group pair each;
// shape has two groups, one observation and two features per group.
const ACCEPTED_DETAIL_ROWS = `
10 0 000 111 0000 2222
10 1 000 111 0000 2222
10 2 000 111 0000 2222
10 3 000 111 0000 2222
10 4 001 111 1111 2222
10 5 001 111 1111 2222
10 6 001 111 1111 2222
10 7 001 111 1111 2222
20 0 001 111 1111 2222
20 1 001 111 1111 2222
20 2 001 111 1111 2222
20 3 001 111 1111 2222
20 4 011 111 2222 2222
20 5 011 111 2222 2222
20 6 011 111 2222 2222
20 7 011 111 2222 2222
40 0 011 111 2222 2222
40 1 011 111 2222 2222
40 2 011 111 2222 2222
40 3 011 111 2222 2222
40 4 111 111 3333 2222
40 5 111 111 3333 2222
40 6 111 111 3333 2222
40 7 111 111 3333 2222
`;
const REJECTED_DETAIL_ROWS = `
10 0 111 111 3333 2222
10 1 111 111 3333 2222
10 2 111 111 3333 2222
10 3 111 111 3333 2222
10 4 211 111 3333 2222
10 5 211 111 3333 2222
10 6 211 111 3333 2222
10 7 211 111 3333 2222
20 0 211 111 3333 2222
20 1 211 111 3333 2222
20 2 211 111 3333 2222
20 3 211 111 3333 2222
20 4 221 111 3333 2222
20 5 221 111 3333 2222
20 6 221 111 3333 2222
20 7 221 111 3333 2222
40 0 221 111 3333 2222
40 1 221 111 3333 2222
40 2 221 111 3333 2222
40 3 221 111 3333 2222
40 4 222 111 3333 2222
40 5 222 111 3333 2222
40 6 222 111 3333 2222
40 7 222 111 3333 2222
`;
function expectedReport(outcome: 'accepted' | 'rejected'): Obj {
  const table = outcome === 'accepted' ? ACCEPTED_DETAIL_ROWS : REJECTED_DETAIL_ROWS;
  const detail = table.trim().split('\n').map(line => {
    const [checkpointText,seedText,candidateRank,comparatorRank,candidateShape,comparatorShape] = line.trim().split(/\s+/);
    const checkpointBasalRadiusCells = Number(checkpointText), seedIndex = Number(seedText);
    const fixtureLoss = (rank: string, shape: string) => {
      const r = [...rank].map(Number), s = [...shape].map(Number);
      const reduced = (n: number,d: number) => {
        const divisor = (a: number,b: number): number => b === 0 ? a : divisor(b,a%b);
        const g = divisor(n,d);
        return {numerator:n/g,denominator:d/g,value:n/d};
      };
      return {rankPrimitiveTwicePenalties:r,shapePrimitiveQuarters:s,
        basalTagRankLoss:reduced(r[0]!+r[1]!,4),
        integratedTagRankLoss:reduced(r[0]!+r[1]!+r[2]!,6),
        shapeLoss:(s[0]!+s[1]!+s[2]!+s[3]!)/16,
        evidence:{basalRankPrimitiveCount:2,integratedRankPrimitiveCount:3,shapePrimitiveCount:4,
          rankGroupPairsPerComponent:1,basalComponentsPerStratum:2,integratedComponentsPerStratum:3,
          rankStrataPerSeed:1,shapeFeaturesPerObservation:2,shapeObservationsPerGroup:1,
          shapeGroupsPerStratum:2,shapeStrataPerSeed:1}};
    };
    return { checkpointBasalRadiusCells,seedIndex,
      candidate:fixtureLoss(candidateRank!,candidateShape!),
      comparator:fixtureLoss(comparatorRank!,comparatorShape!),
    };
  });
  // Hand-reduced from the six equal-size four-seed blocks in the literal table.
  const candidate = outcome === 'accepted'
    ? {basalTagRankLoss:{numerator:1,denominator:6,value:1/6},
      integratedTagRankLoss:{numerator:1,denominator:4,value:1/4},shapeLoss:3/8}
    : {basalTagRankLoss:{numerator:5,denominator:6,value:5/6},
      integratedTagRankLoss:{numerator:3,denominator:4,value:3/4},shapeLoss:3/4};
  const comparator = {basalTagRankLoss:{numerator:1,denominator:2,value:1/2},
    integratedTagRankLoss:{numerator:1,denominator:2,value:1/2},shapeLoss:1/2};
  return {
    schemaVersion: 'snow-crystal-holdout-report/1', inputs: INPUTS,
    selectedCandidateId: INPUTS.selectedCandidateId, selectedCandidateSha256: INPUTS.selectedCandidateSha256,
    selectedComparatorId: COMPARATOR, trainReportSha256: INPUTS.trainReportSha256,
    rankComponentSet:'integrated-rank-v1', checkpointSeedDetails: detail,
    loss: {candidate,comparator},
    evidence:{candidate:{basalRankPrimitiveCount:48,integratedRankPrimitiveCount:72,shapePrimitiveCount:96},
      comparator:{basalRankPrimitiveCount:48,integratedRankPrimitiveCount:72,shapePrimitiveCount:96},
      nonemptyDenominators:{rankGroupPairsPerComponent:1,basalComponentsPerStratum:2,
        integratedComponentsPerStratum:3,rankStrataPerSeed:1,shapeFeaturesPerObservation:2,
        shapeObservationsPerGroup:1,shapeGroupsPerStratum:2,shapeStrataPerSeed:1,
        seedsPerCheckpoint:8,checkpoints:3}},
    pareto: { candidateNotWorse: outcome === 'accepted', strictlyBetter: outcome === 'accepted' }, acceptance: outcome,
  };
}
function expectedOpened(opening: Obj, report: Obj, outcome: 'accepted' | 'rejected'): Obj {
  return { ...opening, state: 'opened', holdoutReportSha256: digest(report), acceptance: outcome };
}
function expectedEvents(): string[] { return [
  'read:sealed','validate:sealed',
  'wx:holdout-open-intent.json','write:holdout-open-intent.json','flush:holdout-open-intent.json',
  'wx:holdout-run.json.tmp-opening','write:holdout-run.json.tmp-opening','flush:holdout-run.json.tmp-opening','rename:opening',
  'observe:opening','reader',
  'wx:holdout-report.json.tmp-report','write:holdout-report.json.tmp-report','flush:holdout-report.json.tmp-report','rename:report',
  'observe:report',
  'wx:holdout-run.json.tmp-opened','write:holdout-run.json.tmp-opened','flush:holdout-run.json.tmp-opened','rename:opened',
  'observe:opened',
]; }

describe('TC-HOLDOUT-001 synthetic training isolation and sealed verification', () => {
  it('calls all training stages for legitimate train annotations and shapes, and none on contamination', () => {
    const good = [{ partition:'train', sourceId:'T1', annotation:{sourceId:'T1'}, shape:{sourceId:'T1'} }];
    const calls: string[] = [];
    expect(protocol.train(good,['H1'],s => calls.push(s))).toEqual(['T1']);
    expect(calls).toEqual(['cdf','baseline','candidate','threshold','tiebreak']);
    const contaminated = [
      [{ partition:'holdout', sourceId:'H1' }],
      [{ partition:'train', sourceId:'H1' }],
      [{ partition:'train', sourceId:'T1', annotation:{sourceId:'H1'} }],
      [{ partition:'train', sourceId:'T1', shape:{sourceId:'H1'} }],
      [...good,{ partition:'holdout', sourceId:'H1' }],
    ];
    for (const rows of contaminated) {
      const invoked: string[] = [];
      expect(captureFailure(() => protocol.train(rows,['H1'],s => invoked.push(s)))).toEqual({name:'RangeError',message:'holdout-data-in-training'});
      expect(invoked).toEqual([]);
    }
  });

  it('rejects every externally self-consistent input, candidate, comparator, and gate mismatch before the reader', () => directory(d => {
    const mutations: Array<(x: Obj) => void> = Object.keys(INPUTS).map(key => x => { x.inputs[key] = hash('different-' + key); });
    mutations.push(
      x => { x.selectedComparatorId = hash('different-comparator'); },
      x => { x.humanGate.evidenceSha256 = hash('different-review-evidence'); },
      x => { x.humanGate.decision = 'unapproved'; },
      x => { x.humanGate.approverRole = 'machine'; },
      x => { x.humanGate.approvedAtUtc = '2026-10-02T00:00:00Z'; },
      x => { x.humanGate.note = 'new note'; },
    );
    for (const [index,change] of mutations.entries()) {
      const record = clone(expectedSealed()); change(record); reseal(record); writeSealed(d,record);
      let reads = 0;
      let rejection: string | undefined;
      try { protocol.open(d,reference,() => { reads++; return 'accepted'; }); }
      catch (error) { rejection = (error as Error).name; }
      expect(rejection, `mutation ${index}`).toBe('RangeError');
      expect(reads).toBe(0);
      expect(existsSync(paths(d).marker)).toBe(false);
    }
    for (const change of [
      (x: Obj) => { x.humanGate.inputBundleSha256 = hash('wrong-bundle'); },
      (x: Obj) => { x.sealedRecordSha256 = hash('wrong-sealed'); },
      (x: Obj) => { x.extra = true; },
      (x: Obj) => { delete x.inputs.trainReportSha256; },
      (x: Obj) => { x.holdoutReportSha256 = hash('wrong-report'); },
      (x: Obj) => { x.schemaVersion = 'wrong/1'; },
    ]) {
      const record = clone(expectedSealed()); change(record); writeSealed(d,record);
      let reads = 0;
      expect(captureFailure(() => protocol.open(d,reference,() => { reads++; return 'accepted'; })).name).toBe('RangeError');
      expect(reads).toBe(0);
    }
    protocol.validate(expectedSealed(),reference);
  }));

  it('validates exact sealed, opening, and opened union members and durable relationships', () => {
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const report = expectedReport('accepted'), opened = expectedOpened(opening,report,'accepted');
    expect(Date.parse(OPENED_AT)).toBeGreaterThan(Date.parse(AT));
    expect(opening.humanGate.approvedAtUtc).toBe(AT);
    expect(marker.openedAtUtc).toBe(OPENED_AT);
    expect(opening.openedAtUtc).toBe(OPENED_AT);
    for (const [record, m, r] of [[sealed,undefined,undefined],[opening,marker,undefined],[opened,marker,report]] as const)
      expect(protocol.validate(record,reference,m,r)).toEqual(record);
    const cases: Array<[Obj, Obj | undefined, Obj | undefined]> = [
      [{...opening,inputs:{...opening.inputs,splitSha256:hash('wrong')}},marker,undefined],
      [{...opening,humanGate:{...opening.humanGate,decision:'pending'}},marker,undefined],
      [{...opening,openIntentSha256:hash('wrong')},marker,undefined],
      [{...opening,holdoutReportSha256:hash('wrong')},marker,undefined],
      [{...opening,openedAtUtc:'bad'},marker,undefined],
      [{...opening,openedAtUtc:AT},{...marker,openedAtUtc:AT},undefined],
      [{...opening,openedAtUtc:'2026-10-01T00:05:00+00:00'},marker,undefined],
      [{...opening,openedAtUtc:'2026-02-30T00:05:00Z'},{...marker,openedAtUtc:'2026-02-30T00:05:00Z'},undefined],
      [opening,{...marker,openedAtUtc:AT},undefined],
      [{...opening,schemaVersion:'wrong/1'},marker,undefined],
      [{...opening,state:'sealed'},marker,undefined],
      [{...opening,selectedComparatorId:hash('other-comparator')},marker,undefined],
      [{...opening,sealedRecordSha256:hash('other-seal')},marker,undefined],
      [{...opening,humanGate:{...opening.humanGate,note:42}},marker,undefined],
      [{...opening,openIntentSha256:null},marker,undefined],
      [{...opening,unknown:true},marker,undefined],
      [(()=>{ const x=clone(opening); delete x.selectedComparatorId; return x; })(),marker,undefined],
      [{...opening,calibrationId:42},marker,undefined],
      [opening,{...marker,inputBundleSha256:hash('wrong')},undefined],
      [{...opened,acceptance:'unknown'},marker,report],
      [{...opened,holdoutReportSha256:null},marker,report],
      [{...opened,schemaVersion:'wrong/1'},marker,report],
      [{...opened,state:'opening'},marker,report],
      [{...opened,openedAtUtc:null},marker,report],
      [{...opened,openIntentSha256:hash('wrong-intent')},marker,report],
      [{...opened,selectedComparatorId:hash('wrong-comparator')},marker,report],
      [{...opened,sealedRecordSha256:hash('wrong-seal')},marker,report],
      [{...opened,inputs:{...opened.inputs,corpusSha256:hash('wrong')}},marker,report],
      [{...opened,humanGate:{...opened.humanGate,evidenceSha256:hash('wrong')}},marker,report],
      [{...opened,extra:true},marker,report],
      [(()=>{ const x=clone(opened); delete x.acceptance; return x; })(),marker,report],
      [opened,marker,{...report,acceptance:'rejected'}],
    ];
    for (const [record,m,r] of cases) expect(captureFailure(() => protocol.validate(record,reference,m,r)).name).toBe('RangeError');
  });

  it('rejects self-consistent persisted report replacements even after the record hash and acceptance are updated', () => {
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const changes: Array<(r: Obj) => void> = [
      r => { r.schemaVersion = 'other-report/1'; },
      r => { r.inputs.splitSha256 = hash('unrelated-split'); },
      r => { r.selectedCandidateId = hash('unrelated-candidate'); },
      r => { r.selectedCandidateSha256 = hash('unrelated-candidate-body'); },
      r => { r.selectedComparatorId = hash('unrelated-comparator'); },
      r => { r.trainReportSha256 = hash('unrelated-training'); },
      r => { r.checkpointSeedDetails = r.checkpointSeedDetails.slice(1); },
      r => { r.checkpointSeedDetails[0].seedIndex = 7; },
      r => { r.checkpointSeedDetails[0].candidate.integratedTagRankLoss.value = 0.5; },
      r => { r.checkpointSeedDetails[0].candidate.shapePrimitiveQuarters[0] = 4; },
      r => { r.loss.candidate.integratedTagRankLoss.value = 0; },
      r => { r.loss.candidate.shapeLoss = 0; },
      r => { r.evidence.candidate.shapePrimitiveCount = 95; },
      r => { r.pareto.strictlyBetter = false; },
      r => { r.acceptance = 'rejected'; },
      r => { r.unrelated = true; },
    ];
    for (const [index,change] of changes.entries()) {
      const report = clone(expectedReport('accepted'));
      change(report);
      const opened = { ...expectedOpened(opening,report,'accepted'), acceptance:report.acceptance };
      expect(captureFailure(() => protocol.validate(opened,reference,marker,report)).name,
        `report replacement ${index}`).toBe('RangeError');
    }
  });

  it('accepts an externally approved string note and rejects a wrong note type even with matching hashes', () => {
    const withNote = clone(expectedSealed());
    withNote.humanGate.note = 'Reviewed train evidence for this synthetic run.';
    reseal(withNote);
    const noteReference = { ...reference, gateSha256:digest(withNote.humanGate) };
    expect(protocol.validate(withNote,noteReference)).toEqual(withNote);
    const wrongType = clone(withNote);
    wrongType.humanGate.note = 42;
    reseal(wrongType);
    const wrongTypeReference = { ...reference, gateSha256:digest(wrongType.humanGate) };
    expect(captureFailure(() => protocol.validate(wrongType,wrongTypeReference)).name).toBe('RangeError');
  });
});

describe('TC-HOLDOUT-002 synthetic durable opening and complete reports', () => {
  it.each(['accepted','rejected'] as const)('pins %s marker, opening, all 24 candidate/comparator details, report and opened bytes', outcome => directory(d => {
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const report = expectedReport(outcome), opened = expectedOpened(opening,report,outcome);
    writeSealed(d,sealed);
    let reads = 0;
    const result = protocol.open(d,reference,() => { reads++; expect(parse(paths(d).run)).toEqual(opening); return outcome; });
    expect(reads).toBe(1);
    expect(result.events).toEqual(expectedEvents());
    expect(parse(paths(d).marker)).toEqual(marker);
    expect(readFileSync(paths(d).marker,'utf8')).toBe(canonical(marker));
    expect(parse(paths(d).report)).toEqual(report);
    expect(readFileSync(paths(d).report,'utf8')).toBe(canonical(report));
    expect(report.checkpointSeedDetails).toHaveLength(24);
    expect(parse(paths(d).run)).toEqual(opened);
    expect(readFileSync(paths(d).run,'utf8')).toBe(canonical(opened));
    expect(result.record).toEqual(opened);
    expect(opening.openIntentSha256).toBe(digest(marker));
    expect(opened.holdoutReportSha256).toBe(digest(report));
    protocol.validate(parse(paths(d).run),reference,parse(paths(d).marker),parse(paths(d).report));
    let secondReads = 0;
    expect(captureFailure(() => protocol.open(d,reference,() => { secondReads++; return outcome; }))).toEqual({name:'RangeError',message:ERROR});
    expect(secondReads).toBe(0);
  }));
});

describe('TC-HOLDOUT-003 synthetic exclusivity, crash, restart, and copied directory', () => {
  it.each(['sealed','opening','opened'] as const)('rejects valid marker + %s state without reading or changing bytes', state => directory(d => {
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const report = expectedReport('accepted');
    const record = state === 'sealed' ? sealed : state === 'opening' ? opening : expectedOpened(opening,report,'accepted');
    writeFileSync(paths(d).run,canonical(record)); writeFileSync(paths(d).marker,canonical(marker));
    if (state === 'opened') writeFileSync(paths(d).report,canonical(report));
    protocol.validate(record,reference,state === 'sealed' ? undefined : marker,state === 'opened' ? report : undefined);
    const before = readFileSync(paths(d).run,'utf8');
    let reads = 0;
    expect(captureFailure(() => protocol.open(d,reference,() => { reads++; return 'accepted'; }))).toEqual({name:'RangeError',message:ERROR});
    expect(reads).toBe(0); expect(readFileSync(paths(d).run,'utf8')).toBe(before);
    expect(readFileSync(paths(d).marker,'utf8')).toBe(canonical(marker));
  }));

  it.each(['opening','report'] as const)('pins exact %s crash residue; fresh-process restart cannot resume, rollback, or reuse calibration', async point => directoryAsync(async d => {
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const report = expectedReport('accepted');
    writeSealed(d,sealed);
    let reads = 0;
    expect(captureFailure(() => protocol.open(d,reference,() => { reads++; return 'accepted'; },point))).toEqual({name:'Error',message:`injected-crash-after-${point}`});
    expect(reads).toBe(point === 'opening' ? 0 : 1);
    expect(readFileSync(paths(d).marker,'utf8')).toBe(canonical(marker));
    expect(readFileSync(paths(d).run,'utf8')).toBe(canonical(opening));
    expect(existsSync(paths(d).report)).toBe(point === 'report');
    if (point === 'report') {
      expect(readFileSync(paths(d).report,'utf8')).toBe(canonical(report));
      expect(digest(parse(paths(d).report))).toBe(digest(report));
    }
    const before = [readFileSync(paths(d).marker,'utf8'),readFileSync(paths(d).run,'utf8'),
      existsSync(paths(d).report) ? readFileSync(paths(d).report,'utf8') : null];
    expect(await freshProcessReopen(d)).toEqual({ok:false,reader:0,name:'RangeError',message:ERROR});
    expect([readFileSync(paths(d).marker,'utf8'),readFileSync(paths(d).run,'utf8'),
      existsSync(paths(d).report) ? readFileSync(paths(d).report,'utf8') : null]).toEqual(before);
    expect(Object.keys(protocol).sort()).toEqual(['open','train','validate']); // no resume/delete/rollback/reuse API
  }));

  it('runs the same complete opening source in two barrier-synchronized child processes', async () => directoryAsync(async d => {
    writeSealed(d);
    const barrier = join(d,'barrier');
    const childCode = String.raw`const fs=require('node:fs'); const path=require('node:path'); const source=Buffer.from(process.argv[1],'base64').toString('utf8');
      const d=process.argv[2],barrier=process.argv[3],expected=JSON.parse(process.argv[4]);
      const protocol=(new Function('return '+source)())(require); let reader=0;
      fs.writeFileSync(path.join(d,'ready-'+process.pid),'ready');
      function start(){ if(!fs.existsSync(barrier)) return setTimeout(start,1);
        try { const result=protocol.open(d,expected,()=>{reader++;return 'accepted'});
          console.log(JSON.stringify({ok:true,reader,record:result.record,events:result.events})); }
        catch(e) { console.log(JSON.stringify({ok:false,reader,name:e.name,message:e.message})); } }
      start();`;
    const launch = () => {
      let pid = 0;
      const result = new Promise<Obj>((resolve,reject) => {
      const child = spawn(runtime.process.execPath,['-e',childCode,runtime.Buffer.from(protocolSource).toString('base64'),d,barrier,JSON.stringify(reference)]);
      pid = child.pid as number;
      let stdout = '', stderr = '';
      child.stdout.on('data',(bytes: Uint8Array) => { stdout += String(bytes); });
      child.stderr.on('data',(bytes: Uint8Array) => { stderr += String(bytes); });
      child.on('error',reject);
      child.on('close',(code: number) => {
        if (code !== 0 || stderr || !stdout.trim()) reject(new Error(`child ${code}: ${stderr || stdout}`));
        else resolve(JSON.parse(stdout.trim()) as Obj);
      });
      });
      return {pid,result};
    };
    const first = launch(), second = launch();
    while (!existsSync(join(d,'ready-'+first.pid)) || !existsSync(join(d,'ready-'+second.pid)))
      await new Promise(resolve => setTimeout(resolve,2));
    writeFileSync(barrier,'go');
    const results = await Promise.all([first.result,second.result]);
    const winners = results.filter(x => x.ok), losers = results.filter(x => !x.ok);
    expect(winners).toHaveLength(1); expect(losers).toHaveLength(1);
    expect(winners[0]!.reader).toBe(1);
    expect(winners[0]!.events).toEqual(expectedEvents());
    expect(losers[0]).toEqual({ok:false,reader:0,name:'RangeError',message:ERROR});
    const sealed = expectedSealed(), marker = expectedMarker(sealed), opening = expectedOpening(sealed,marker);
    const report = expectedReport('accepted'), opened = expectedOpened(opening,report,'accepted');
    expect(winners[0]!.record).toEqual(opened);
    expect(parse(paths(d).marker)).toEqual(marker);
    expect(parse(paths(d).report)).toEqual(report);
    expect(parse(paths(d).run)).toEqual(opened);
  }));

  it('checks copied record and hashes against repository evidence at the human gate boundary', () => directory(original => directory(copy => {
    const sealed = expectedSealed(); writeSealed(original,sealed);
    const repoEvidence = {
      calibrationId: CALIBRATION, authorizedDirectory: original,
      sealedRecordSha256: sealed.sealedRecordSha256, inputBundleSha256: sealed.humanGate.inputBundleSha256,
      evidenceSha256: EVIDENCE, approvedAtUtc: AT, status: 'open-authorized',
      markerSha256: null, reportSha256: null,
    };
    const humanRepositoryGate = (directoryPath: string, record: Obj, evidence: Obj) =>
      evidence.status === 'open-authorized' && evidence.markerSha256 === null && evidence.reportSha256 === null &&
      evidence.authorizedDirectory === directoryPath &&
      evidence.calibrationId === record.calibrationId &&
      evidence.sealedRecordSha256 === record.sealedRecordSha256 &&
      evidence.inputBundleSha256 === record.humanGate.inputBundleSha256 &&
      evidence.evidenceSha256 === record.humanGate.evidenceSha256 &&
      evidence.approvedAtUtc === record.humanGate.approvedAtUtc;
    writeFileSync(paths(copy).run,readFileSync(paths(original).run));
    const copied = parse(paths(copy).run);
    protocol.validate(copied,reference);
    expect(readFileSync(paths(copy).run,'utf8')).toBe(readFileSync(paths(original).run,'utf8'));
    const { sealedRecordSha256: _discard, ...copiedBare } = copied;
    expect(copied.sealedRecordSha256).toBe(digest(copiedBare));
    expect(humanRepositoryGate(original,sealed,repoEvidence)).toBe(true);
    expect(humanRepositoryGate(copy,copied,repoEvidence)).toBe(false);
    expect(existsSync(paths(copy).marker)).toBe(false);
    const opened = protocol.open(original,reference,() => 'accepted').record;
    const openedEvidence = { ...repoEvidence, status:'opened', markerSha256:digest(parse(paths(original).marker)),
      reportSha256:digest(parse(paths(original).report)) };
    expect(openedEvidence.markerSha256).toBe(opened.openIntentSha256);
    expect(openedEvidence.reportSha256).toBe(opened.holdoutReportSha256);
    expect(humanRepositoryGate(original,opened,openedEvidence)).toBe(false);
    expect(humanRepositoryGate(copy,copied,openedEvidence)).toBe(false);
    // A person with copy/delete/history access can defeat directory-local exclusivity.
    // Repository history, review evidence, and marker inventory must be checked by the human approver.
  })));
});
