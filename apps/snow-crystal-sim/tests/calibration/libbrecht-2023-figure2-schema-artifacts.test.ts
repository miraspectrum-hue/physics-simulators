// Independent test-local contract oracle; no production code or source-image data.
// @ts-expect-error Node typings are intentionally outside this browser workspace.
import { createHash } from 'node:crypto';
// @ts-expect-error Node typings are intentionally outside this browser workspace.
import { gunzipSync } from 'node:zlib';
// @ts-expect-error Node typings are intentionally outside this browser workspace.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
// @ts-expect-error Node typings are intentionally outside this browser workspace.
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
type ErrorClass = typeof TypeError | typeof RangeError | typeof SyntaxError | typeof Error;
type Context = { file: string; id?: string };
type Rule = (value: unknown, context: Context, pointer: string) => void;
const PDF = '20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af';
const CORPUS_ID = 'libbrecht-2023-figure2-arxiv-v1';
const ID = 'L23-F2-P11-N001';
const CTX: Context = { file: 'synthetic.json' };
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const ID_PATTERN = /^L23-F2-P(11|12|13|14)-N([0-9]{3})$/;
const STRATA = ['T0-S0','T0-S1','T0-S2','T1-S0','T1-S1','T1-S2','T2-S0','T2-S1','T2-S2'];
const SOURCE_KEYS = ['temperature','supersaturation','growthTime','squareFieldOfView'];
const NORMAL_KEYS = ['temperatureC','supersaturationPct','growthTimeSeconds','squareFieldOfViewUm'];
const ROOT = resolve(decodeURIComponent(new URL('../../../../', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const DATA_REL = 'apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1';
const AUDIT_REL = 'docs/simulators/snow-crystal-sim/tasks/T1-7/SOURCE-AUDIT.json';
const ARTIFACTS = ['corpus.json','split.json','protocol.json','SHA256SUMS'].map(n => `${DATA_REL}/${n}`).concat(AUDIT_REL);
const sha = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex') as string;
const clone = <T>(value: T): T => structuredClone(value);
const esc = (key: string): string => key.replace(/~/g,'~0').replace(/\//g,'~1');
const at = (p: string, key: string | number): string => `${p}/${esc(String(key))}`;
function fail(C: ErrorClass, c: Context, p: string, reason: string, cause?: unknown): never {
  throw new C(`file=${c.file}${c.id ? `, sourceObservationId=${c.id}` : ''}, field=${p || '/'}, reason=${reason}`, { cause });
}
function object(v: unknown, c = CTX, p = ''): Obj {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) fail(TypeError,c,p,'wrong-type');
  return v as Obj;
}
function array(v: unknown, c = CTX, p = ''): Json[] {
  if (!Array.isArray(v)) fail(TypeError,c,p,'wrong-type');
  return v as Json[];
}
function number(v: unknown, c = CTX, p = ''): number {
  if (typeof v !== 'number') fail(TypeError,c,p,'wrong-type');
  if (!Number.isFinite(v)) fail(RangeError,c,p,'non-finite');
  if (Object.is(v,-0)) fail(RangeError,c,p,'negative-zero');
  return v;
}
function integer(v: unknown, c = CTX, p = ''): number {
  const n = number(v,c,p);
  if (!Number.isSafeInteger(n)) fail(RangeError,c,p,'unsafe-integer');
  return n;
}
function string(v: unknown, c = CTX, p = ''): string {
  if (typeof v !== 'string') fail(TypeError,c,p,'wrong-type');
  if (v.length === 0) fail(RangeError,c,p,'empty-string');
  return v;
}
function keys(v: unknown, names: readonly string[], c = CTX, p = ''): Obj {
  const x = object(v,c,p);
  for (const k of Object.keys(x)) if (!names.includes(k)) fail(TypeError,c,at(p,k),'unknown-property');
  for (const k of names) if (!Object.hasOwn(x,k)) fail(TypeError,c,at(p,k),'missing-property');
  return x;
}
const numeric: Rule = (v,c,p) => { number(v,c,p); };
const textual: Rule = (v,c,p) => { string(v,c,p); };
const bool: Rule = (v,c,p) => { if (typeof v !== 'boolean') fail(TypeError,c,p,'wrong-type'); };
const natural: Rule = (v,c,p) => { if (integer(v,c,p)<0) fail(RangeError,c,p,'out-of-range'); };
const positiveInt: Rule = (v,c,p) => { if (integer(v,c,p)<=0) fail(RangeError,c,p,'out-of-range'); };
const uint32: Rule = (v,c,p) => { if (integer(v,c,p)<0 || number(v)>0xffffffff) fail(RangeError,c,p,'uint32'); };
const hash: Rule = (v,c,p) => { if (!SHA_PATTERN.test(string(v,c,p))) fail(RangeError,c,p,'invalid-hash'); };
const identity: Rule = (v,c,p) => { if (!ID_PATTERN.test(string(v,c,p))) fail(RangeError,c,p,'invalid-id'); };
const utc: Rule = (v,c,p) => {
  const s=string(v,c,p);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().replace('.000Z','Z')!==s) fail(RangeError,c,p,'invalid-utc');
};
const nullable = (r: Rule): Rule => (v,c,p) => { if (v!==null) r(v,c,p); };
const enumeration = (...values: Json[]): Rule => (v,c,p) => {
  if (values.some(x=>typeof x===typeof v && Object.is(x,v))) return;
  if (!values.some(x=>x!==null && typeof x===typeof v)) fail(TypeError,c,p,'wrong-type');
  fail(TypeError,c,p,'unknown-enum');
};
const literal = (expected: Json, reason='literal-mismatch'): Rule => (v,c,p) => {
  if (expected===null) { if(v!==null) fail(TypeError,c,p,'wrong-type'); return; }
  if (typeof v!==typeof expected || v===null) fail(TypeError,c,p,'wrong-type');
  if (typeof expected==='number') number(v,c,p);
  if (!Object.is(v,expected)) fail(RangeError,c,p,reason);
};
const record = (fields: Record<string, Rule>): Rule => (v,c,p) => {
  const x=keys(v,Object.keys(fields),c,p);
  for(const [k,r] of Object.entries(fields)) r(x[k],c,at(p,k));
};
const list = (r: Rule, count?: number): Rule => (v,c,p) => {
  const xs=array(v,c,p);
  if(count!==undefined && xs.length!==count) fail(RangeError,c,p,'wrong-count');
  xs.forEach((x,i)=>r(x,c,at(p,i)));
};
const tuple = (...rs: Rule[]): Rule => (v,c,p) => {
  const xs=array(v,c,p);
  if(xs.length!==rs.length) fail(RangeError,c,p,'wrong-count');
  rs.forEach((r,i)=>r(xs[i],c,at(p,i)));
};
const fixed = (v: Json): Rule => Array.isArray(v) ? tuple(...v.map(fixed)) : v!==null && typeof v==='object' ? record(Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fixed(x)]))) : literal(v);
const positive: Rule = (v,c,p) => { if(number(v,c,p)<=0) fail(RangeError,c,p,'out-of-range'); };
const nonnegative: Rule = (v,c,p) => { if(number(v,c,p)<0) fail(RangeError,c,p,'out-of-range'); };
const note = nullable(textual);
function equal(actual: unknown, expected: Json, c: Context, p: string, reason: string): void {
  if(canonicalizeForOracle(actual)!==canonicalizeForOracle(expected)) fail(RangeError,c,p,reason);
}
function sortedUnique(xs: Json[], c: Context, p: string): void {
  if(new Set(xs).size!==xs.length) fail(RangeError,c,p,'duplicate-id');
  equal(xs,[...xs].sort(),c,p,'noncanonical-order');
}
function canonicalizeForOracle(v: unknown): string {
  if(v===null || typeof v==='boolean') return JSON.stringify(v);
  if(typeof v==='string') {
    for(let i=0;i<v.length;i++) {const n=v.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const n2=v.charCodeAt(++i);if(!(n2>=0xdc00&&n2<=0xdfff)) throw new RangeError('lone-surrogate');}else if(n>=0xdc00&&n<=0xdfff) throw new RangeError('lone-surrogate');}
    return JSON.stringify(v);
  }
  if(typeof v==='number') {if(!Number.isFinite(v)) throw new RangeError('non-finite');return JSON.stringify(v);}
  if(Array.isArray(v)) return `[${v.map(canonicalizeForOracle).join(',')}]`;
  const x=object(v);
  return `{${Object.keys(x).sort().map(k=>`${canonicalizeForOracle(k)}:${canonicalizeForOracle(x[k])}`).join(',')}}`;
}
const digest = (v: unknown): string => sha(canonicalizeForOracle(v));
function without(v: Obj, ...names: string[]): Obj { return Object.fromEntries(Object.entries(v).filter(([k])=>!names.includes(k))); }

/** Compare decoded member names before JSON.parse can overwrite duplicates. */
function parseJsonRejectingDuplicateKeys(text: string, file='synthetic.json'): Json {
  const c={file};let i=0;
  const ws=()=>{while(/[\x20\t\r\n]/.test(text[i]??'!')) i++;};
  const syntax=(p:string):never=>fail(SyntaxError,c,p,'json-syntax');
  const quoted=(p:string):string=>{const start=i++;while(i<text.length){const ch=text[i++];if(ch==='"'){try{return JSON.parse(text.slice(start,i)) as string;}catch{return syntax(p);}}if(ch==='\\')i++;}return syntax(p);};
  const value=(p:string):void=>{
    ws();const ch=text[i];
    if(ch==='{'){i++;ws();const seen=new Set<string>();if(text[i]==='}'){i++;return;}for(;;){ws();if(text[i]!=='"')syntax(p);const k=quoted(p);ws();if(text[i++]!==':')syntax(at(p,k));if(seen.has(k))fail(SyntaxError,c,at(p,k),'duplicate-key');seen.add(k);value(at(p,k));ws();if(text[i]==='}'){i++;return;}if(text[i++]!==',')syntax(p);}}
    if(ch==='['){i++;ws();if(text[i]===']'){i++;return;}let n=0;for(;;){value(at(p,n++));ws();if(text[i]===']'){i++;return;}if(text[i++]!==',')syntax(p);}}
    if(ch==='"'){quoted(p);return;}
    const start=i;while(i<text.length && !/[\x20\t\r\n,\]}]/.test(text[i]!))i++;
    if(!/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$/.test(text.slice(start,i)))syntax(p);
  };
  value('');ws();if(i!==text.length)syntax('');
  let parsed:Json;try{parsed=JSON.parse(text) as Json;}catch(e){return fail(SyntaxError,c,'','json-syntax',e);}
  const numbers=(v:Json,p:string):void=>{if(typeof v==='number')number(v,c,p);else if(Array.isArray(v))v.forEach((x,n)=>numbers(x,at(p,n)));else if(v!==null&&typeof v==='object')for(const[k,x]of Object.entries(v))numbers(x,at(p,k));};
  numbers(parsed,'');return parsed;
}
function readJson(relative: string, reader: (p:string)=>string = p=>readFileSync(resolve(ROOT,p),'utf8') as string): Json {
  let text:string;try{text=reader(relative);}catch(cause){const C=cause instanceof Error ? cause.constructor as ErrorClass : Error;return fail(C,{file:relative},'','io',cause);}
  return parseJsonRejectingDuplicateKeys(text,relative);
}

// Literal individual fixture only: never a fabricated 206-observation source oracle.
const VOTE: Obj={growthAxis:'basal-dominant',basalBranchingLevel:2,hollowing:'absent',confidence:'high'};
const APPROVAL_ID='a4cfc6fbb96f578a871a32c528d07930751392b5ce45bd7e3cb1a0f65148133c';
const SYN_APPROVAL:Obj={approvalId:APPROVAL_ID,reviewMode:'batch-summary',targetSourceObservationIds:[ID],targetIdSetSha256:'0446f0d4af4ae33312f7726af9e436750e0886a33540df8783ca837c80015c6b',draftAnnotationSetSha256:'53aafe785f93df225e57b08dbf502c37864e334ebeabfda5b9682dda6c787daf',finalAnnotationSetSha256:'563192cd1f7ec3799a357c843aa269e6dc3e355eecdda500c464cb919e6cd873',sourcePdfSha256:PDF,approverRole:'human-approver',approvedAtUtc:'2026-09-29T12:00:00Z',decision:'approved',note:null};
const SYN_UNUSED:Obj={rasterWidthPx:11,rasterHeightPx:11,maskStatus:'not-usable',maskUsabilityReason:'occlusion',maskSha256:null,foregroundPixelCount:null,fourNeighborPerimeterEdges:null,foregroundCentroidPx:null,populationCovariancePx2:null,eigenvaluesPx2:null,armStatus:'not-usable',armUsabilityReason:'occlusion',centerPx:null,armEndpointsClockwisePx:null,rawInverseCircularity:null,rawNormalizedArmLengthCv:null,rawMinorMajorAxisRatio:null};
const SYN_OBSERVATION:Obj={sourceObservationId:ID,sourceIdKind:'derived-page-panel-id',locator:{pdfPage:11,pagePanelOrdinal:1,panelBoundsPdfPt:[10,20,30,40]},rawLabels:{temperature:'-15.0 °C',supersaturation:'12.5 %',growthTime:'2 min',squareFieldOfView:'0.40 mm'},temperatureC:-15,supersaturationPct:12.5,growthTimeSeconds:120,squareFieldOfViewUm:400,sourceUncertainty:{temperaturePlusMinusC:0.2,supersaturationFactorRange:[0.8,1.2],growthTime:'not-reported',squareFieldOfView:'not-reported'},inProductDomain:true,exclusionReason:null,transcription:{transcriberA:{temperature:{raw:'-15.0 °C',normalized:-15},supersaturation:{raw:'12.5 %',normalized:12.5},growthTime:{raw:'2 min',normalized:120},squareFieldOfView:{raw:'0.40 mm',normalized:400}},transcriberB:{temperature:{raw:'-15.0 °C',normalized:-15},supersaturation:{raw:'12.5 %',normalized:12.5},growthTime:{raw:'2 min',normalized:120},squareFieldOfView:{raw:'0.40 mm',normalized:400}},auditStatus:'agreed',adjudicationNote:null,sourceCheckedAgainstPdfSha256:PDF},morphology:{annotatorA:clone(VOTE),annotatorB:clone(VOTE),draftStatus:'exact-agreement',final:clone(VOTE),approvalId:APPROVAL_ID,adjudicationNote:null},projectedShape:{status:'not-usable',inverseCircularity:null,normalizedArmLengthCv:null,minorMajorAxisRatio:null,reason:'no-common-usable-feature',extractionA:clone(SYN_UNUSED),extractionB:clone(SYN_UNUSED),auditStatus:'agreed',adjudicationNote:null,extractionProtocolId:'figure2-projection-v1'}};
const SYN_AUDIT_ENTRY:Obj={sourceObservationId:'L23-F2-P11-N001',locator:{pdfPage:11,pagePanelOrdinal:1,panelBoundsPdfPt:[10,20,30,40]},rawLabels:{temperature:'-15.0 °C',supersaturation:'12.5 %',growthTime:'2 min',squareFieldOfView:'0.40 mm'},normalizedSourceValues:{temperatureC:-15,supersaturationPct:12.5,growthTimeSeconds:120,squareFieldOfViewUm:400,inProductDomain:true,exclusionReason:null},verification:{sourcePanelInspected:true,fields:{temperature:{candidateComparison:'exact',humanAction:'confirmed-proposal',humanConfirmedRawAndNormalized:true,rationale:null},supersaturation:{candidateComparison:'exact',humanAction:'confirmed-proposal',humanConfirmedRawAndNormalized:true,rationale:null},growthTime:{candidateComparison:'exact',humanAction:'confirmed-proposal',humanConfirmedRawAndNormalized:true,rationale:null},squareFieldOfView:{candidateComparison:'exact',humanAction:'confirmed-proposal',humanConfirmedRawAndNormalized:true,rationale:null}},verifiedByRole:'human-source-auditor',verificationRecordedAtUtc:'2026-10-08T12:00:00Z'}};
const SOURCE:Obj={arxivId:'2306.13087v1',doi:'10.48550/arXiv.2306.13087',permanentUrl:'https://arxiv.org/abs/2306.13087v1',pdfUrl:'https://arxiv.org/pdf/2306.13087v1',pdfSha256:PDF,pageCount:14,figureNumber:2,figurePdfPages:[11,12,13,14]};
const voteRule=record({growthAxis:enumeration('basal-dominant','c-axis-dominant','mixed','indeterminate'),basalBranchingLevel:nullable(enumeration(0,1,2,3)),hollowing:enumeration('present','absent','indeterminate'),confidence:enumeration('high','medium','low')});
const locatorRule=record({pdfPage:enumeration(11,12,13,14),pagePanelOrdinal:positiveInt,panelBoundsPdfPt:tuple(numeric,numeric,positive,positive)});
const rawRule=record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,textual])));
const normalizedRule=record({temperatureC:numeric,supersaturationPct:numeric,growthTimeSeconds:positive,squareFieldOfViewUm:positive,inProductDomain:bool,exclusionReason:nullable(enumeration('outside-product-domain'))});
const morphologyRule=record({annotatorA:voteRule,annotatorB:voteRule,draftStatus:enumeration('exact-agreement','different'),final:voteRule,approvalId:hash,adjudicationNote:note});
const approvalRule=record({approvalId:hash,reviewMode:enumeration('batch-summary','individual-source-pdf'),targetSourceObservationIds:list(identity),targetIdSetSha256:hash,draftAnnotationSetSha256:hash,finalAnnotationSetSha256:hash,sourcePdfSha256:literal(PDF),approverRole:literal('human-approver'),approvedAtUtc:utc,decision:literal('approved'),note});

function decimalUnit(raw: unknown, field: string, c=CTX, p=''): number {
  const m=/^([+-]?)(\d+)(?:\.(\d+))?\s*(°C|C|%|s|sec|min|µm|μm|mm)$/.exec(string(raw,c,p));
  if(!m)fail(RangeError,c,p,'unit-or-domain');
  const units:Record<string,Record<string,bigint>>={temperature:{'°C':1n,C:1n},supersaturation:{'%':1n},growthTime:{s:1n,sec:1n,min:60n},squareFieldOfView:{'µm':1n,'μm':1n,mm:1000n}};
  const factor=units[field]?.[m[4]!];if(factor===undefined)fail(RangeError,c,p,'unit-or-domain');
  const digits=m[3]??'';const numerator=BigInt(`${m[1]==='-'?'-':''}${m[2]}${digits}`)*factor;
  const result=Number(numerator)/Number(10n**BigInt(digits.length));
  if(!Number.isFinite(result)||Object.is(result,-0)||((field==='growthTime'||field==='squareFieldOfView')&&result<=0))fail(RangeError,c,p,'unit-or-domain');
  return result;
}
function sourceValues(o: Obj,c:Context,p:string):void {
  rawRule(o.rawLabels,c,at(p,'rawLabels'));const raw=object(o.rawLabels);
  SOURCE_KEYS.forEach((k,i)=>{const nk=NORMAL_KEYS[i]!;if(!Object.is(number(o[nk],c,at(p,nk)),decimalUnit(raw[k],k,c,at(at(p,'rawLabels'),k))))fail(RangeError,c,at(p,nk),'unit-mismatch');});
}
function domain(o:Obj,c:Context,p:string):void {
  const t=number(o.temperatureC),s=number(o.supersaturationPct),inside=t>=-30&&t<=0&&s>=0&&s<=30;
  bool(o.inProductDomain,c,at(p,'inProductDomain'));
  equal(o.inProductDomain,inside,c,at(p,'inProductDomain'),'derived-mismatch');
  equal(o.exclusionReason,inside?null:'outside-product-domain',c,at(p,'exclusionReason'),'derived-mismatch');
}
function transcript(o:Obj,c:Context,p:string):void {
  const q=at(p,'transcription'),t=keys(o.transcription,['transcriberA','transcriberB','auditStatus','adjudicationNote','sourceCheckedAgainstPdfSha256'],c,q);
  for(const side of ['transcriberA','transcriberB']) {
    record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,record({raw:textual,normalized:numeric})])))(t[side],c,at(q,side));
    const draft=object(t[side]);
    for(const k of SOURCE_KEYS){const vote=object(draft[k]),field=at(at(q,side),k);if(!Object.is(vote.normalized,decimalUnit(vote.raw,k,c,at(field,'raw'))))fail(RangeError,c,at(field,'normalized'),'unit-mismatch');}
  }
  literal(PDF)(t.sourceCheckedAgainstPdfSha256,c,at(q,'sourceCheckedAgainstPdfSha256'));note(t.adjudicationNote,c,at(q,'adjudicationNote'));
  const same=canonicalizeForOracle(t.transcriberA)===canonicalizeForOracle(t.transcriberB);
  if(t.auditStatus!==(same?'agreed':'adjudicated') || (same?t.adjudicationNote!==null:typeof t.adjudicationNote!=='string'||t.adjudicationNote.trim()==='')) fail(RangeError,c,q,'unresolved-audit');
  if(same)SOURCE_KEYS.forEach((k,i)=>{const a=object(object(t.transcriberA)[k]);if(a.raw!==object(o.rawLabels)[k]||!Object.is(a.normalized,o[NORMAL_KEYS[i]!]))fail(RangeError,c,q,'unresolved-audit');});
}

const reasonRule=enumeration('orientation','occlusion','needle-overlap','segmentation','center-indeterminate','endpoint-indeterminate');
const pointRule=tuple(numeric,numeric);
const extractionRule=record({rasterWidthPx:uint32,rasterHeightPx:uint32,maskStatus:enumeration('usable','not-usable'),maskUsabilityReason:nullable(reasonRule),maskSha256:nullable(hash),foregroundPixelCount:nullable(positiveInt),fourNeighborPerimeterEdges:nullable(positiveInt),foregroundCentroidPx:nullable(pointRule),populationCovariancePx2:nullable(record({xx:nonnegative,xy:nonnegative,yy:nonnegative})),eigenvaluesPx2:nullable(tuple(nonnegative,nonnegative)),armStatus:enumeration('usable','not-usable'),armUsabilityReason:nullable(reasonRule),centerPx:nullable(pointRule),armEndpointsClockwisePx:nullable(list(pointRule,6)),rawInverseCircularity:nullable(nonnegative),rawNormalizedArmLengthCv:nullable(nonnegative),rawMinorMajorAxisRatio:nullable(nonnegative)});
const intervalRule=nullable(record({low:numeric,high:numeric}));
const projectedRule=record({status:enumeration('usable','not-usable'),inverseCircularity:intervalRule,normalizedArmLengthCv:intervalRule,minorMajorAxisRatio:intervalRule,reason:nullable(enumeration('no-common-usable-feature')),extractionA:extractionRule,extractionB:extractionRule,auditStatus:enumeration('agreed','adjudicated'),adjudicationNote:note,extractionProtocolId:literal('figure2-projection-v1')});
const transcriptRule=record({transcriberA:record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,record({raw:textual,normalized:numeric})]))),transcriberB:record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,record({raw:textual,normalized:numeric})]))),auditStatus:enumeration('agreed','adjudicated'),adjudicationNote:note,sourceCheckedAgainstPdfSha256:literal(PDF)});
const uncertaintyRule=record({temperaturePlusMinusC:literal(0.2,'constant-mismatch'),supersaturationFactorRange:tuple(literal(0.8,'constant-mismatch'),literal(1.2,'constant-mismatch')),growthTime:literal('not-reported','constant-mismatch'),squareFieldOfView:literal('not-reported','constant-mismatch')});
const observationRule=record({sourceObservationId:identity,sourceIdKind:literal('derived-page-panel-id'),locator:locatorRule,rawLabels:rawRule,temperatureC:numeric,supersaturationPct:numeric,growthTimeSeconds:positive,squareFieldOfViewUm:positive,sourceUncertainty:uncertaintyRule,inProductDomain:bool,exclusionReason:nullable(enumeration('outside-product-domain')),transcription:transcriptRule,morphology:morphologyRule,projectedShape:projectedRule});
const corpusRule=record({schemaVersion:literal('snow-crystal-observation-corpus/1'),corpusId:literal(CORPUS_ID),source:fixed(SOURCE),observations:list(observationRule),annotationApprovals:list(approvalRule)});
const FEATURES=['inverseCircularity','normalizedArmLengthCv','minorMajorAxisRatio'];
const RAW_FEATURES=['rawInverseCircularity','rawNormalizedArmLengthCv','rawMinorMajorAxisRatio'];
function neumaier(xs:number[]):number {let s=0,c=0;for(const x of xs){const t=s+x;c+=Math.abs(s)>=Math.abs(x)?(s-t)+x:(x-t)+s;s=t;}return s+c;}
function near(actual:Json|undefined,expected:number,c:Context,p:string):void {
  if(Math.abs(number(actual,c,p)-expected)>64*Number.EPSILON*Math.max(1,Math.abs(expected)))fail(RangeError,c,p,'recalculation-mismatch');
}
function maskBytes(width:number,height:number,pixels:number[]):Uint8Array {
  uint32(width,CTX,'/width');uint32(height,CTX,'/height');
  if(width===0||height===0||pixels.length!==width*height||pixels.some(v=>v!==0&&v!==1))fail(RangeError,CTX,'/pixels','mask-encoding');
  const b=new Uint8Array(8+pixels.length),d=new DataView(b.buffer);d.setUint32(0,width,true);d.setUint32(4,height,true);b.set(pixels,8);return b;
}
function extraction(v:unknown,c=CTX,p=''):Array<number|null> {
  extractionRule(v,c,p);const e=object(v),w=number(e.rasterWidthPx),h=number(e.rasterHeightPx);
  if(w===0||h===0)fail(RangeError,c,p,'out-of-range');
  const maskFields=['maskSha256','foregroundPixelCount','fourNeighborPerimeterEdges','foregroundCentroidPx','populationCovariancePx2','eigenvaluesPx2','rawInverseCircularity','rawMinorMajorAxisRatio'];
  const armFields=['centerPx','armEndpointsClockwisePx','rawNormalizedArmLengthCv'];
  for(const [status,reason,fields] of [['maskStatus','maskUsabilityReason',maskFields],['armStatus','armUsabilityReason',armFields]] as const){
    const usable=e[status]==='usable';
    if(usable?e[reason]!==null:e[reason]===null)fail(RangeError,c,at(p,reason),'null-contract');
    for(const k of fields)if(usable?e[k]===null:e[k]!==null)fail(RangeError,c,at(p,k),'null-contract');
  }
  if(e.maskStatus==='not-usable'){
    if(e.armStatus!=='not-usable')fail(RangeError,c,at(p,'armStatus'),'null-contract');
    return [null,null,null];
  }
  const A=number(e.foregroundPixelCount),P=number(e.fourNeighborPerimeterEdges);
  if(A>w*h||P>4*A)fail(RangeError,c,p,'pixel-domain');
  const centroid=array(e.foregroundCentroidPx).map(x=>number(x));
  if(centroid[0]!<0.5||centroid[0]!>w-0.5||centroid[1]!<0.5||centroid[1]!>h-0.5)fail(RangeError,c,at(p,'foregroundCentroidPx'),'raster-bounds');
  const cov=object(e.populationCovariancePx2),xx=number(cov.xx),xy=number(cov.xy),yy=number(cov.yy),trace=xx+yy,delta=Math.hypot(xx-yy,2*xy);
  const eigen=[(trace-delta)/2,(trace+delta)/2],stored=array(e.eigenvaluesPx2).map(x=>number(x));
  if(eigen[0]!<0||eigen[1]!<=0||stored[0]!>stored[1]!||stored[1]!<=0)fail(RangeError,c,at(p,'eigenvaluesPx2'),'eigenvalue-domain');
  stored.forEach((x,i)=>near(x,eigen[i]!,c,at(at(p,'eigenvaluesPx2'),i)));
  const inv=((P/A)*P)/(4*Math.PI),ratio=Math.sqrt(eigen[0]!/eigen[1]!);
  near(e.rawInverseCircularity,inv,c,at(p,'rawInverseCircularity'));near(e.rawMinorMajorAxisRatio,ratio,c,at(p,'rawMinorMajorAxisRatio'));
  let cv:number|null=null;
  if(e.armStatus==='usable'){
    const center=array(e.centerPx).map(x=>number(x)),ends=array(e.armEndpointsClockwisePx).map(x=>array(x).map(z=>number(z)));
    for(const [i,pt] of [center,...ends].entries())for(const [j,x]of pt.entries())if(!Number.isInteger(x-0.5)||x<0.5||x>(j===0?w:h)-0.5)fail(RangeError,c,i===0?at(p,'centerPx'):at(at(p,'armEndpointsClockwisePx'),i-1),'pixel-center');
    const angles=ends.map(pt=>{const theta=Math.atan2(pt[1]!-center[1]!,pt[0]!-center[0]!);return theta<0?theta+2*Math.PI:theta;});
    const lengths=ends.map(pt=>Math.hypot(pt[0]!-center[0]!,pt[1]!-center[1]!));
    if(lengths.some(x=>x===0)||angles.some((x,i)=>i>0&&x<=angles[i-1]!))fail(RangeError,c,at(p,'armEndpointsClockwisePx'),'endpoint-order');
    const mean=neumaier(lengths)/6;cv=Math.sqrt(neumaier(lengths.map(x=>(x-mean)**2))/6)/mean;
    near(e.rawNormalizedArmLengthCv,cv,c,at(p,'rawNormalizedArmLengthCv'));
  }
  return [inv,cv,ratio];
}
function projectedEvidence(o:Obj,c:Context,p:string):Array<number|null>[] {
  // Intervals are a later stage; malformed intervals cannot hide raw-evidence failures.
  const s=keys(o.projectedShape,['status',...FEATURES,'reason','extractionA','extractionB','auditStatus','adjudicationNote','extractionProtocolId'],c,p);
  enumeration('usable','not-usable')(s.status,c,at(p,'status'));nullable(enumeration('no-common-usable-feature'))(s.reason,c,at(p,'reason'));
  enumeration('agreed','adjudicated')(s.auditStatus,c,at(p,'auditStatus'));note(s.adjudicationNote,c,at(p,'adjudicationNote'));literal('figure2-projection-v1')(s.extractionProtocolId,c,at(p,'extractionProtocolId'));
  const values=['extractionA','extractionB'].map(k=>extraction(s[k],c,at(p,k)));
  const a=object(s.extractionA),b=object(s.extractionB),same=['maskStatus','maskUsabilityReason','armStatus','armUsabilityReason'].every(k=>a[k]===b[k]);
  if(s.auditStatus!==(same?'agreed':'adjudicated')||(same?s.adjudicationNote!==null:typeof s.adjudicationNote!=='string'||s.adjudicationNote.trim()===''))fail(RangeError,c,p,'unresolved-audit');
  return values;
}
function projectedIntervals(s:Obj,values:Array<number|null>[],c:Context,p:string):void {
  let common=0;
  FEATURES.forEach((key,i)=>{intervalRule(s[key],c,at(p,key));const a=values[0]![i]!,b=values[1]![i]!;
    if(a===null||b===null){if(s[key]!==null)fail(RangeError,c,at(p,key),'interval-mismatch');return;}
    common++;const interval=object(s[key],c,at(p,key));
    if(!Object.is(interval.low,Math.min(a,b))||!Object.is(interval.high,Math.max(a,b)))fail(RangeError,c,at(p,key),'interval-mismatch');
  });
  if(s.status!==(common?'usable':'not-usable')||s.reason!==(common?null:'no-common-usable-feature'))fail(RangeError,c,p,'null-contract');
}
function validateProjected(v:unknown,c=CTX,p=''):void {const s=object(v,c,p);const values=projectedEvidence({projectedShape:s},c,p);projectedIntervals(s,values,c,p);}

function morphology(v:unknown,c=CTX,p=''):void {
  morphologyRule(v,c,p);const m=object(v),same=canonicalizeForOracle(m.annotatorA)===canonicalizeForOracle(m.annotatorB);
  if(m.draftStatus!==(same?'exact-agreement':'different'))fail(RangeError,c,at(p,'draftStatus'),'annotation-approval');
}
function approvals(observations:Obj[],input:unknown,c=CTX):void {
  const entries=array(input,c,'/annotationApprovals'),targets=new Set<string>(),byId=new Map(observations.map(o=>[string(o.sourceObservationId),o]));
  for(const [i,v]of entries.entries()){
    const p=`/annotationApprovals/${i}`;approvalRule(v,c,p);const a=object(v),ids=array(a.targetSourceObservationIds);
    if(ids.length===0)fail(RangeError,c,'/annotationApprovals','annotation-approval');sortedUnique(ids,c,at(p,'targetSourceObservationIds'));
    const os=ids.map(x=>{const id=string(x);if(targets.has(id)||!byId.has(id))fail(RangeError,c,'/annotationApprovals','annotation-approval');targets.add(id);return byId.get(id)!;});
    const checks:Obj={targetIdSetSha256:digest(ids),draftAnnotationSetSha256:digest(os.map(o=>[o.sourceObservationId,object(o.morphology).annotatorA,object(o.morphology).annotatorB])),finalAnnotationSetSha256:digest(os.map(o=>[o.sourceObservationId,object(o.morphology).final])),approvalId:digest(without(a,'approvalId'))};
    for(const[k,h]of Object.entries(checks))if(a[k]!==h)fail(RangeError,c,'/annotationApprovals','annotation-approval');
    for(const o of os){const m=object(o.morphology);if(m.approvalId!==a.approvalId)fail(RangeError,c,'/annotationApprovals','annotation-approval');
      if(a.reviewMode==='batch-summary'){
        if(m.draftStatus!=='exact-agreement'||object(m.annotatorA).confidence!=='high'||object(m.annotatorB).confidence!=='high'||canonicalizeForOracle(m.final)!==canonicalizeForOracle(m.annotatorA)||m.adjudicationNote!==null)fail(RangeError,c,'/annotationApprovals','annotation-approval');
      }else if(typeof m.adjudicationNote!=='string'||m.adjudicationNote.trim()==='')fail(RangeError,c,'/annotationApprovals','annotation-approval');
    }
  }
  if(targets.size!==observations.length)fail(RangeError,c,'/annotationApprovals','annotation-approval');
}
function locator(o:Obj,c:Context,p:string):void {
  identity(o.sourceObservationId,c,at(p,'sourceObservationId'));locatorRule(o.locator,c,at(p,'locator'));
  const id=string(o.sourceObservationId),m=ID_PATTERN.exec(id)!,loc=object(o.locator),bounds=array(loc.panelBoundsPdfPt).map(x=>number(x));
  if(Number(m[1])!==loc.pdfPage||Number(m[2])!==loc.pagePanelOrdinal)fail(RangeError,c,at(p,'locator'),'id-locator-mismatch');
  // Fixed-hash PDF independently inspected with pdfjs-dist 6.3.289 / Node 24.14.1:
  // pages 11..14 all have crop box [0,0,612,792], rotation 0, userUnit 1.
  if(bounds[0]!<0||bounds[1]!<0||bounds[0]!+bounds[2]!>612||bounds[1]!+bounds[3]!>792)fail(RangeError,c,at(at(p,'locator'),'panelBoundsPdfPt'),'crop-box');
}
function identities(os:Obj[],c:Context,p='/observations'):void {
  const ids=new Set<Json>(),locs=new Set<string>(),bounds=new Set<string>();
  for(const [i,o]of os.entries()){
    const q=at(p,i),cx:Context={...c,...(typeof o.sourceObservationId==='string'?{id:o.sourceObservationId}:{})};
    identity(o.sourceObservationId,cx,at(q,'sourceObservationId'));
    if(ids.has(o.sourceObservationId!))fail(RangeError,cx,at(q,'sourceObservationId'),'duplicate-id');ids.add(o.sourceObservationId!);
    locatorRule(o.locator,cx,at(q,'locator'));const l=object(o.locator),lk=canonicalizeForOracle([l.pdfPage,l.pagePanelOrdinal]),bk=canonicalizeForOracle(l.panelBoundsPdfPt);
    if(locs.has(lk))fail(RangeError,cx,at(q,'locator'),'duplicate-locator');locs.add(lk);
    if(bounds.has(bk))fail(RangeError,cx,at(at(q,'locator'),'panelBoundsPdfPt'),'duplicate-bounds');bounds.add(bk);locator(o,cx,q);
  }
  for(const page of [11,12,13,14]){const ords=os.filter(o=>object(o.locator).pdfPage===page).map(o=>number(object(o.locator).pagePanelOrdinal)).sort((a,b)=>a-b);if(ords.some((n,i)=>n!==i+1))fail(RangeError,c,p,'ordinal-gap');}
}
function sourceUncertainty(o:Obj,c:Context,p:string):void {
  uncertaintyRule(o.sourceUncertainty,c,at(p,'sourceUncertainty'));
  // Distinct stable code for constants, independent of unit and transcription stages.
  domain(o,c,p);
}
function corpusStages(os:Obj[],as:unknown,c:Context):void {
  identities(os,c);
  const each=(fn:(o:Obj,c:Context,p:string)=>void)=>os.forEach((o,i)=>fn(o,{...c,id:string(o.sourceObservationId)},`/observations/${i}`));
  each(sourceValues);each(sourceUncertainty);each(transcript);each((o,c,p)=>morphology(o.morphology,c,at(p,'morphology')));
  approvals(os,as,c);
  const features=os.map((o,i)=>projectedEvidence(o,{...c,id:string(o.sourceObservationId)},`/observations/${i}/projectedShape`));
  os.forEach((o,i)=>projectedIntervals(object(o.projectedShape),features[i]!,{...c,id:string(o.sourceObservationId)},`/observations/${i}/projectedShape`));
  equal(os.map(o=>o.sourceObservationId!),os.map(o=>o.sourceObservationId!).sort(),c,'/observations','noncanonical-order');
  sortedUnique(array(as).map(a=>object(a).approvalId!),c,'/annotationApprovals');
}
function validateCorpusV1(v:unknown,file='corpus.json'):Obj {
  const c={file},x=keys(v,['schemaVersion','corpusId','source','observations','annotationApprovals'],c);
  literal('snow-crystal-observation-corpus/1')(x.schemaVersion,c,'/schemaVersion');literal(CORPUS_ID)(x.corpusId,c,'/corpusId');fixed(SOURCE)(x.source,c,'/source');
  const os=array(x.observations,c,'/observations');if(os.length!==206)fail(RangeError,c,'/observations','wrong-count');
  const obs=os.map((o,i)=>{const z=keys(o,Object.keys(SYN_OBSERVATION),c,`/observations/${i}`);literal('derived-page-panel-id')(z.sourceIdKind,c,`/observations/${i}/sourceIdKind`);return z;});
  corpusStages(obs,x.annotationApprovals,c);return x;
}
const fieldVerificationRule=record({candidateComparison:enumeration('exact','canonical-unit-equivalent','different'),humanAction:enumeration('confirmed-proposal','resolved-disagreement','corrected-proposal','preserved-prior-human-confirmation'),humanConfirmedRawAndNormalized:literal(true),rationale:note});
const auditEntryRule=record({sourceObservationId:identity,locator:locatorRule,rawLabels:rawRule,normalizedSourceValues:normalizedRule,verification:record({sourcePanelInspected:literal(true),fields:record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,fieldVerificationRule]))),verifiedByRole:literal('human-source-auditor'),verificationRecordedAtUtc:utc})});
type ActionBindings={comparison:Map<string,Json[]>;prior:Map<string,Obj>};
function auditEntry(v:unknown,c=CTX,p='',bindings?:ActionBindings):void {
  auditEntryRule(v,c,p);
  const o=object(v),n=object(o.normalizedSourceValues),fields=object(object(o.verification).fields);
  locator(o,c,p);sourceValues({...n,rawLabels:o.rawLabels!},c,p);domain(n,c,at(p,'normalizedSourceValues'));
  for(const [i,key]of SOURCE_KEYS.entries()){
    const field=object(fields[key]),q=at(at(at(p,'verification'),'fields'),key),rationale=field.rationale,action=field.humanAction;
    if((action==='confirmed-proposal'||action==='preserved-prior-human-confirmation')&&rationale!==null)fail(RangeError,c,at(q,'rationale'),'rationale-mismatch');
    if((action==='resolved-disagreement'||action==='corrected-proposal')&&(typeof rationale!=='string'||rationale.trim()===''))fail(RangeError,c,at(q,'rationale'),'rationale-required');
    if(typeof rationale==='string'&&(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(rationale)||/\b(?:accountId|account_id|userId|user_id|uid|deviceName|device_name|hostname|computerName|machine_id)\s*[=:]/i.test(rationale)))fail(RangeError,c,at(q,'rationale'),'personal-information');
    if(!bindings)continue; // Schema/unit-only fixtures have no candidate provenance.
    const comparison=bindings.comparison.get(string(o.sourceObservationId));
    if(!comparison)fail(RangeError,c,at(p,'sourceObservationId'),'missing-candidate');
    const tuple=array(comparison[i]),kind=tuple[3],proposal=tuple[4],prior=bindings.prior.get(string(o.sourceObservationId));
    equal(field.candidateComparison,kind!,c,at(q,'candidateComparison'),'comparison-mismatch');
    const raw=string(object(o.rawLabels)[key]),value=number(n[NORMAL_KEYS[i]!]);
    if(prior){
      if(action!=='preserved-prior-human-confirmation')fail(RangeError,c,at(q,'humanAction'),'prior-action-mismatch');
      if(!samePair(raw,value,string(object(prior.rawLabels)[key]),number(object(prior.normalizedSourceValues)[NORMAL_KEYS[i]!])) )fail(RangeError,c,q,'prior-pair-mismatch');
      continue;
    }
    if(action==='preserved-prior-human-confirmation')fail(RangeError,c,at(q,'humanAction'),'missing-prior-confirmation');
    if(key==='squareFieldOfView'&&/μm$/u.test(raw))fail(RangeError,c,at(at(p,'rawLabels'),key),'noncanonical-final-unit');
    if(kind==='different'){
      if(proposal!==null)fail(RangeError,c,q,'different-with-default');
      if(action!=='resolved-disagreement')fail(RangeError,c,at(q,'humanAction'),'disagreement-action-mismatch');
    }else{
      const proposed=array(proposal),same=samePair(raw,value,string(proposed[0]),number(proposed[1]));
      if(action!==(same?'confirmed-proposal':'corrected-proposal'))fail(RangeError,c,at(q,'humanAction'),'proposal-action-mismatch');
    }
  }
}
const auditMethod:Obj={kind:'independent-ai-candidates-human-source-pdf-verification',candidatePrefillEnabledOnlyAfterBothDraftsFrozen:true,productionCorpusReadDuringHumanVerification:false,productionGeneratorUsed:false,imageArtifactsCommitted:false};
const auditApprovalRule=record({decision:literal('approved'),approverRole:literal('human-source-auditor'),sourcePdfSha256:literal(PDF),sourceEntrySetSha256:hash,canonicalCorpusSha256:hash,auditPayloadSha256:hash,approvedAtUtc:utc,note});
const candidateDraftRule=record({transcriberASetSha256:hash,transcriberBSetSha256:hash,comparisonSetSha256:hash,eachDraftObservationCount:literal(206)});
const migrationRule=record({sourceKind:literal('local-storage-human-source-audit-draft/1'),sourceFileSha256:literal('9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c'),entryObjectCount:literal(33),migratedConfirmedCompleteCount:literal(32),incompleteSourceObservationIds:fixed(['P11-N033']),migratedConfirmedIdSetSha256:literal('92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5'),confirmedValuesOverwrittenDuringMigration:literal(false),originalVerificationTimeKnown:literal(false)});
const auditRule=record({schemaVersion:literal('snow-crystal-source-audit/1'),corpusId:literal(CORPUS_ID),sourcePdfSha256:literal(PDF),auditMethod:fixed(auditMethod),candidateDrafts:candidateDraftRule,priorHumanCaptureMigration:migrationRule,pages:list(record({pdfPage:enumeration(11,12,13,14),panelCount:natural,sourceObservationIds:list(identity)}),4),observations:list(auditEntryRule),sourceEntrySetSha256:hash,preAnnotationSplitAssignmentSha256:hash,canonicalCorpusSha256:hash,auditPayloadSha256:hash,approval:auditApprovalRule});
function sourceProjection(o:Obj):Obj {return {sourceObservationId:o.sourceObservationId!,locator:o.locator!,rawLabels:o.rawLabels!,normalizedSourceValues:Object.fromEntries([...NORMAL_KEYS,'inProductDomain','exclusionReason'].map(k=>[k,o[k]!]))};}
function auditProjection(o:Obj):Obj {return {sourceObservationId:o.sourceObservationId!,locator:o.locator!,rawLabels:o.rawLabels!,normalizedSourceValues:o.normalizedSourceValues!};}
function sourceJoin(observations:Obj[],independent:Obj[],c=CTX):void {
  const byId=new Map(independent.map(o=>[string(o.sourceObservationId),o]));
  if(byId.size!==independent.length||byId.size!==observations.length)fail(RangeError,c,'/observations','wrong-count');
  for(const o of observations){const id=string(o.sourceObservationId),a=byId.get(id);if(!a)fail(RangeError,{...c,id},'/observations','dangling-id');equal(sourceProjection(o),auditProjection(a),{...c,id},'/observations','source-audit-mismatch');}
}
function validateSourceAuditV1(v:unknown,corpus:Obj,assignment:Obj,file='SOURCE-AUDIT.json'):Obj {
  const c={file};auditRule(v,c,'');const a=object(v);auditBindings(a,corpus,assignment,206,c);return a;
}
function auditBindings(a:Obj,corpus:Obj,assignment:Obj,requiredCount:number,c=CTX):void {
  const os=array(a.observations).map(x=>object(x));
  if(os.length!==requiredCount)fail(RangeError,c,'/observations','wrong-count');identities(os,c);os.forEach((o,i)=>auditEntry(o,c,`/observations/${i}`));
  sortedUnique(os.map(o=>o.sourceObservationId!),c,'/observations');
  const pages=array(a.pages).map(x=>object(x));equal(pages.map(p=>p.pdfPage!),[11,12,13,14],c,'/pages','noncanonical-order');
  for(const [i,page]of pages.entries()){const expected=os.filter(o=>object(o.locator).pdfPage===page.pdfPage).map(o=>o.sourceObservationId!);equal(page.sourceObservationIds,expected,c,`/pages/${i}/sourceObservationIds`,'reference-mismatch');equal(page.panelCount,expected.length,c,`/pages/${i}/panelCount`,'wrong-count');}
  sourceJoin(array(corpus.observations).map(x=>object(x)),os,c);
  if(requiredCount===206){
    verifyFrozenCandidates(a,corpus,c);
    const comparison=comparisonPreimage(candidateRowsFromCorpus(corpus,'transcriberA',c),candidateRowsFromCorpus(corpus,'transcriberB',c));
    const comparisons=new Map(array(comparison.observations).map(row=>[string(array(row)[0]),array(array(row)[1])])),prior=new Map<string,Obj>();
    // The backup itself is deliberately not committed. REAL206 checks the fixed
    // migration manifest, ID set and A/B membership; original bytes/bits are
    // checked at the one-time raw-backup gate and by SYN-MIGRATION below.
    for(const id of migrationIds()){
      const entry=os.find(o=>o.sourceObservationId===id);if(!entry)fail(RangeError,c,'/observations','missing-prior-confirmation');
      for(const [i,key]of SOURCE_KEYS.entries()){
        const tuple=array(comparisons.get(id)![i]),av=array(tuple[1]),bv=array(tuple[2]),raw=string(object(entry.rawLabels)[key]),n=number(object(entry.normalizedSourceValues)[NORMAL_KEYS[i]!]);
        if(!Object.is(n,av[1])||!Object.is(n,bv[1])||(raw!==av[0]&&raw!==bv[0]))fail(RangeError,c,'/observations','prior-candidate-membership-mismatch');
      }
      prior.set(id,entry);
    }
    os.forEach((o,i)=>auditEntry(o,c,`/observations/${i}`,{comparison:comparisons,prior}));
  }
  const hashes:Obj={sourceEntrySetSha256:digest(a.observations),preAnnotationSplitAssignmentSha256:digest(assignment),canonicalCorpusSha256:digest(corpus),auditPayloadSha256:digest(without(a,'auditPayloadSha256','approval'))};
  for(const [k,h]of Object.entries(hashes))equal(a[k],h,c,at('',k),'hash-mismatch');
  const approval=object(a.approval);for(const k of ['sourcePdfSha256','sourceEntrySetSha256','canonicalCorpusSha256','auditPayloadSha256'])equal(approval[k],a[k]!,c,`/approval/${k}`,'hash-mismatch');
}
type CandidateRow=[string,[number,number,[number,number,number,number]],[[string,string,number],[string,string,number],[string,string,number],[string,string,number]]];
const CANDIDATE_A='de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732';
// Frozen test-local A evidence: no runtime tmp, PDF, production artifact, or generator dependency.
const FROZEN_A_GZIP='H4sIAAAAAAAACrWdzY7lthGF36WB7O4Yqh9S0jqAV0GSRZBNYxZGMkkMxLEztuGXyzPkmQKJRxygVafI60Z2Fxg3fCDysMhTn6jX15ffqX34Wj/8UeTD75dFXh6vIg95vNpSH9W3x6qPVT9+fLy+vvz06bsfPn3+5qefP396ebx8sN++PD7Yx8fry48///Dp84/HP3zz07ff/+vl8SJl+c3LQ8py/PPfP3//y0//+NO33x1/tumPn/7y8tj0/MN///zN509ff/vpn3/9w9/+/O2nX44/ler//c93L4/jx8fj//xGozaN+ni1dRto9EOjP6uxbKfGsjGNeymnxL2USKE1hfZ49bKMFH5VTo1fladVelPpTOW67afKddsjld5U+uNVqj7KWhOVcmgUonA5FS53hbq0B6kLfZJi+9ZG2/YtUlmayvJ4VfOBSj1U6rMqhzNy83pK3LxGCmtTWJtncoWpZ6hCWeopUZZKx1rWNtayRhrXpnFtnsk1pp7hGmsba6l0rAfzcWsat+aagcaRa6jOtY32Ske7lKaylFDl3lTuj9d9eZTFE5FLE7kwkeuhcQ1s47CNc9uowzbHf3SXKQsW8gXuToVm7mYiZVkxJ1c63i5tvF0iiVetEVg7lZhZm0q0NtZidLCr2SmxmkUSUWpE4e1UYuZtOtTSJKpQiau1kV4tHGjUGjFYO5WYWZtJNFRD4+VwXbRJXDSSiEIjDmfnEgfO5vPRMR9pPSyQWWKZqDRSTmu76Tus7eU3Lw8v9/GuTaVWqnKrS6s2dYlUotpIbcbOZWbGZhJlw0K+0fGuCtdo6BoUG1mbsXOJmbHpUzQ8RaNP0a1tIt2iPaSg1sjWjJ1LzIzNJNreSrbttGT71p6ib+FTRKGRvRk7l5gZ+x1z0XdI3COJiiKjSzP2QOLA2Ezmvpwq94WJtL0ZxvbIMIoyo3La2uryDlvbsfhYsIyvbbR1paNdtcAz0ZFBr0ONNlvnMjNbU4l1wWjTB5mvj4pKo9ZsnUvMbM0kmrZiaEqLoRWMdQnHGpVGvdk6l5jZmkn0vXnGd+oZKxskRvVaUWW0NFvnEjNbM4llaU/xGEU20Gubi2UN5yJKjNZm64HEga3pfMSZRvmZxreCBTKUiTKj62ls3bJT9sjYeqjUYErumJI7fZiO06GHp0NFpdGtGTuXmRmbSsSJxviRxrARt3Ajrqg0ujdj5xIzYzOJrm1L4Uq3FCrt1KUSnboMlcaWZuxcYmZsJrFubXmsG68za1sejwcdSESdMWnGziVmxqZPEcZ2buy8FBqKjGkz9kDiwNhMpmzYiG98W+EKy4RP8orPrBlbsiBgZGwpZ3p2dw3iCuNxhWrbQqpGW0hDrTHkZ7nMND8jEitcU7lrDGuPhWuPodYYwrNcYhqesacozTUm1DUDY6PWGNKzXGKeOMcSC/Y9he97vGKXW6NdrqHOGMKzXGIeOMcSXbGpUOoYxUBrPNAoMobsbCBxmDjHMgVLpGRL5I4lMhxsFBpr4Zn4e8IzaQHffbwV4618Si6tHOoSlUNHrXFEZ7nMPBj/9RLTtcdRaxzRWS4xT8Vjieo4LTiX6JDooUTUGkd0lkvMY/FYouFgaMnJ0FEOPSqHjjrjiM5yiXkqHkuc2vcolseoFPrVo0F0NpA4DMXJYEOmJoUGMi2WiULjLTpb35OcrUe8d3+S2OQ63+QOXI1C48jNUo1pHh7qKzi6Fn50lb0t4bJHS7ijyjhCs1RfGoaH+gwlxpISU1sHSWvUQXKUGEdilupLk/BQnxqmoHGnpCXQUVsccVmqL43B4/mHxNF54ig4VEt4qC6oKgVZWa5vlIGTZ4gTtdETteqGsvI2m9De/ddHS8rytvUp8OmWtRi2EEbXbFmsLTXHj0ikNpEIynKV9VBZn1WJAww/v8iyCzTubxcb7QCAPpCU5RrXQ+P6rMZhKrohut1u0a325r8+fAb02A6F29MK24rIg5MdWd5+y/K0N/71UWYwj/1QuP8/ZqMitj1+RCprU1lnUA9ZzrqyPK1z3FrfSlu8t/J28dbe/tdHS8ryznpqbN79B0QhCdezbCiAy/Z2Bdfe/9fHNsOjpMbmKlcM+MoH/Ep55B7zaO//62Of4VFSaycq8Sz5Xic3d2v+69n8HyMpqbuTAR+mPLJYuVbyyDtylRuZoVJSi3MCCc1rTZrX2Fest32FdgRATwRgjKUMHM5loluovFu4rpC5hjJRccQmuJTM4rS9Xg1rkNH1XFpR3CWqiYKKIz5DpGT+phLHa9C27/DN23xCOwGgJwEwJlIyc1PcA9tw5dvwWpvEWkOJqDdSZ4iUzNpU4grHrNQxxdvqUzxcfVBsZJ0hUjJbM4lFwGcKl7i1jW7Zoo2uoNTINkOk5Kam2Aw2F8Y3F460zG9pmXYAQE8AYMijZJam/f/xsX9HeLvfwlvt/X89+/9jFiWzNJeIdVH5ugh+dL3ho9q7/3p2/8csSmZpCnrgKRp/iqW2pbvUaOnW60CjMyxKZmkmsdb2FGvldEJpu55aok2PorqozbAomaWZxIK8sfC80dcFbomOC4ryoj7DouSWpiKxDy98H16khaJF3oai2pv/ejb/hyxKZmnaVEeyrDxZXqUAFI72ZIr6onWGQ8ksTSWii6C8i1CtAsoM/YL6ousMh5JZmnIoOCYYPyZ4FbSMor2Oor7oNsOhZJZmEje9oHXOJewg4PZwKqK66D7DoWSWphwKIrOSQHqYix7ORUN5sWWGQ8ktTZ9jxXOsHJZJLW0oMCYTFEpmadpOHx/+i6K+aOQXQ30xnSFQMktTAgUoj3GUpyCcL7dwXnvHX8+O/5hAySxN2Ykxt1VwfCnh8cVQX8xnCJTM0pRAQaRXeabn6Gf5rZ+lvd2vZ7t/TKBklqZzUQpeRJHCqS1kzB5mzIYCY3WGQclNTQcbBLNzglkVzQ6N8jJDibF1gkDJk3DCTSyoMEtCtaLjtkc7MkOFsW2GPsljcAIleBvqA2t7mj7R3u3Xs9s/pk/yFDyWqBhn5ePsG+r0FpnaUWF8maFP8hicDPQYaR1IRH1xmaFP8hycPEW8OKH8xYl8LjoKjOsMfTIKwQnFIxVH/qS3lVnaUWLcJtiTPAMnTfQdk3Hniw66Rho2jfxqyfgMd5IH4ISYQIPQkgYhXtHT2yt62vv8evb5x9xJnn4TNOZ6qZW/1WoFq06JVh1HffE6w53k2TcZaGwZlW8ZdcdU3MOpiOri6wx3kufehDtBhuc8wzMARnYDjLR3+/Xs9o+5k1Hq/esNg66Whl0tR4HxfUydpJE3ITowEzNiAn4OD4EFxaUsE8RJmnfHRMLEmwg4R1t4ji6oLEUmiJM07I5pBEFZEf789gKbRMe/grJSdII4SZPuWN+47A30oaIUmyBO0pg71jeOPgf6UE+KTxAng4w7VoiYRJNuKhZCuS2E1nkTm+JNpDFZFKGmvXMQysIJZZFiuHCivG1oWCdObI44kZPNEspRU53jV/zFLsLIboiRderE5qgTORktefr6DkGqIwkIlbybbp09sTn2RE5WS56+wmNMn2Aztt82Y9bpE5ujT+SsLvI8DYWdhPCdhBTHmBcPx7w2nXP8yVll5GkeCi838ncbN7SJtlubyDp9YlP0ycDmvIE+0ShaHQ30tzse6/SJzdEnA5MnNAJWzJLwJ5d5LDbP3nRO8ScDk3O4A2d/4Wd/EbxTdvwIdDYGxSYZlIHLEwoFQjcu1C/syG/YkXUKxSYplIHVuVDs1oTv1uQ6e8n98GWdRLFZEiX3Op+i4/a/Lsibjx+RUNShKRYlNzy/NmO4ufRtRawSbT0ENWiORsn9znmU4UUKKzCF9YYpWOdRbJJHyc1OnyReKlT+UqHYgolpSzgxUYPmmJTc6lzm8G1hua58kPudD9a5FJvkUnKj0yFHqRReK2UBu3f8iGSiEE2yKanN+cwcL5sGkx8/IpmoQ1N0Sm5yCn8g81Oe+V074nhDrKhBc3xKbnIqcnxXUxGwSBKZXFF/5giV3OSUUZm4wgezcg0npV5HoClGJbf4O56kLNvlndudKdY5FZvkVHKLv4OaEkFf+/gRyUTxmWRVUotTmeN1vRYH8xMtl4riM8Wq5AannAXOksbPkrzFZJ1WsUlaJTc4vfEDl4g5v0TMgYz7jRi3zqvYJK+SG5w+SVwjZvwaMce1JH67lsQ6sWKTxEpu8HcM94oe/HrrwVtnVmySWcntza8lwRGNd2Yd95P67XpS69SKzVIrqbnpnET9dl6/3YAK2FtUwDq1YnPUSm5u1oSfwH8MbxDb7Q1i69yKTXIrubmpyO266ZU3SoCM2w0Zt06u2CS5kpub4jVIDYynBg5GyW+MknV2xSbZldzc72CAHAyQ3xgg6/SKTdIrubmZSMWbNZpclUMvmLJOr9gsvZKam3JAYDgrZzgH5kbBmaJXRrk6uZoEAVHlAZHiQWr8IFFv5viVUagei9wQEmw8JLCKu7pqVBQN9WaOYBkl6rHIHebeubmvRDAOBB31Zo5hGcXphL7Ay16Fv+xVcCVkuV0JaZ1isUmKZZSnxyJXgJIrByUNF73Y7aIX6xyLzXIsgzCd3KGyYF9+/KD2xtHbw5O3o+RMkSyjPJ2AIuMrxTjiYJ1lsUmWZRSnxyLFeisq2WKgMFpYGB01Z45nGaXpscz3Gxw1Z45oGSXpsciKS5IqvyTJBIVRovXcUXPmmJZRik5EIpquCdWyYLiXcLhRdCaplkGCzkQ6RHKsQBCfS2hvFJ0ZqmUQnsdde6zlytdyxSlMw1NYQcGZ4loGyXmocENatfG0SgsUllAhqs0U2TKIzUOFsuCUePygGh0rpEcrZEGxmaJbBpl5/BTBt2wJ30JhP+t8i83xLYO4PFS4oke/8ia94UZau91Ia51wsUnCJU/KYwZsfIZVwyjb21H2Trj4HOFyMlby9E0gAmRSsg+BsDaTd77FD75l3J/PRSZfhxijDmJoM4m9nY/e8RY/8JaJDv0JhMnT1xpM3EMky3ZdULO9nZXe8RY/8JaJDv0Jhsnz9xqAK1fOlde1zcy6hjOzNJVlpj2vJx2mT19rII5Rd+5wfLfEbt8t8Y63+PltlWFvXtu1WE9TGROXWDpUeqxybSrXmX53aiDasJPrvZvkAzC4H+K2q/COt3jHW3KNqXn4DRHjF9Vw/iq385d3tMU72pJrTI1DX8pHf9Z4f5a/7ucda/EvWEv+0ZLUN/RBjlkRW+CaJZqPclUdmel057ahdzC8B4/2jrP4F5wlF3nugPRZagDrj/L1R9FR1FtD0TvK4hfKMmjUpdamn9sYIwP8VmfvKIt3lGUgMvU2bSCP3xwxXApit0tBvKMs3lGWgcjU3PSaAzCAlTOADpLFbyCLd5DFO8gy+HBJam4m0tGpc96p0w0Xq27hCoRic2EsA5GpuZnIFcO9Ji8KAf/TG/3nHWLxDrEMRKbmpk8SdyY5vzPJFhhnCY2DegOEZdCoS839ni9aLEBYlreogHeExTvCMhCZmpu2PFFvlNcbBcKiN4TFO8LiHWEZiEzNTVueOM56cpxFh1tvHW7vCIt3hGXw+ZLU3FwkpiRvgvHkwjvA4h1gGYhMzU3vZRhftcLfu/KOr3jHVwYiU3PzyyNwny6nLgwpld1SKu/4il/4yqBRl5qbv2Y+7MIr+kt66y95x1e84ysDkam5qUjkkZ7kkWjd6K114x1f8Y6vDESm5qZt+Im3e1G5Nazcinpz4SuDT5ik5qZ9WYRBNQmDcnOj3lz4ykBkam463LjqyflVT/mTNBScC18ZiEzNTUUW7IHKrwj+vOMr3vGVvFE3yNVI83giPk2jP0O96fhKLjLPq1jLE4ewNTmEpea2K1OzqQ53HlbRWxpwCOPXMirIbb2B297xFf+Cr+SfMcmzKtbhHr93zu/O9o6v+Bd8JReZR1XsScLcys3dv519Y9O84yv+BV/JRabmpiInbiFPl0lDwQG+MmjSDfJo9ukI8NDJq+e0B+YdX/GOrwxEDsLoWOSKnuya9GTpd7284yve8ZWByEESTW4aQDfRk24ivuKmt6+4ecdXvOMrg0+ZDIJo0pPFAacmB5zU3I56c+ErA5GDHJpchzDhG0QsGkYsjoJz4SsDkbm56Z0NoGP5HVWKM7eGZ25HwQG8knfs8qg8/s7F2NmyNYHHZ4wCgVf3xme623lQ/uvfmsfrA7f3+r1DK96hlVxhHpMThcgDkiNDPsgoMxexkiocZORx/33cTVRsIDXcQDpqzIWr5ArzgDx+hjOlGqNcw1FGhblYlVxhno7H94cgG3eejQtOr3KeXj/+D9OgGmgthAAA';
function frozenCandidateRows():CandidateRow[]{const bytes=Uint8Array.from(atob(FROZEN_A_GZIP),ch=>ch.charCodeAt(0));return JSON.parse(new TextDecoder().decode(gunzipSync(bytes))) as CandidateRow[];}
const CANDIDATE_B='b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3';
const COMPARISON='33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9';
function candidatePreimage(role:'A'|'B',rows:CandidateRow[]):Obj {return {schemaVersion:'snow-crystal-source-candidate-set-hash-preimage/1',sourcePdfSha256:PDF,transcriberRole:role,observations:rows};}
function canonicalFovRaw(raw:string):string {return raw.replace(/\u03bcm$/u,'µm');}
function comparedField(name:string,a:[string,number],b:[string,number]):Json {if(a[0]===b[0]&&Object.is(a[1],b[1]))return [name,a,b,'exact',[name==='squareFieldOfView'?canonicalFovRaw(a[0]):a[0],a[1]]];const narrow=name==='squareFieldOfView'&&/^[0-9]+(?:\.[0-9]+)?[μµ]m$/u.test(a[0])&&/^[0-9]+(?:\.[0-9]+)?[μµ]m$/u.test(b[0])&&canonicalFovRaw(a[0])===canonicalFovRaw(b[0])&&Object.is(a[1],b[1])&&a[0]!==b[0];return narrow?[name,a,b,'canonical-unit-equivalent',[canonicalFovRaw(a[0]),a[1]]]:[name,a,b,'different',null];}
function comparisonPreimage(aRows:CandidateRow[],bRows:CandidateRow[]):Obj {for(const rows of [aRows,bRows]){if(rows.map(row=>row[0]).join('\0')!==rows.map(row=>row[0]).sort().join('\0'))fail(RangeError,CTX,'/candidateDrafts','noncanonical-order');for(const row of rows){if(!ID_PATTERN.test(row[0])||row.length!==3||row[1].length!==3||row[1][2].length!==4||row[2].length!==4||row[2].map(x=>x[0]).join(',')!==SOURCE_KEYS.join(','))fail(RangeError,CTX,'/candidateDrafts','tuple-mismatch');for(const field of row[2]){if(typeof field[1]!=='string'||!Number.isFinite(field[2])||Object.is(field[2],-0))fail(RangeError,CTX,'/candidateDrafts','candidate-value-mismatch');}}}const a=new Map(aRows.map(row=>[row[0],row])),b=new Map(bRows.map(row=>[row[0],row]));if(a.size!==206||b.size!==206||[...a.keys()].join('\0')!==[...b.keys()].join('\0'))fail(RangeError,CTX,'/candidateDrafts','candidate-set-mismatch');const observations=[...a.keys()].sort().map(id=>{const ar=a.get(id)!,br=b.get(id)!;if(canonicalizeForOracle(ar[1])!==canonicalizeForOracle(br[1]))fail(RangeError,CTX,'/candidateDrafts','locator-mismatch');return [id,ar[2].map((field,i)=>comparedField(field[0], [field[1],field[2]], [br[2][i]![1],br[2][i]![2]]))];});return {schemaVersion:'snow-crystal-source-comparison-set-hash-preimage/1',sourcePdfSha256:PDF,transcriberASetSha256:digest(candidatePreimage('A',aRows)),transcriberBSetSha256:digest(candidatePreimage('B',bRows)),observations};}
function candidateRowsFromCorpus(corpus:Obj, side:'transcriberA'|'transcriberB', c=CTX):CandidateRow[]{
  const rows=array(corpus.observations).map((value,index)=>{const observation=object(value),id=string(observation.sourceObservationId,c,`/observations/${index}/sourceObservationId`),l=object(observation.locator),t=object(observation.transcription),draft=object(t[side]);const locator:[number,number,[number,number,number,number]]=[number(l.pdfPage,c,`/observations/${index}/locator/pdfPage`),number(l.pagePanelOrdinal,c,`/observations/${index}/locator/pagePanelOrdinal`),array(l.panelBoundsPdfPt).map((n,i)=>number(n,c,`/observations/${index}/locator/panelBoundsPdfPt/${i}`)) as [number,number,number,number]];const fields=SOURCE_KEYS.map(key=>{const vote=object(draft[key],c,`/observations/${index}/transcription/${side}/${key}`);return [key,string(vote.raw,c,''),number(vote.normalized,c,'')] as [string,string,number];}) as CandidateRow[2];return [id,locator,fields] as CandidateRow;});
  if(rows.length!==206)fail(RangeError,c,'/observations','wrong-count');if(rows.map(row=>row[0]).join('\0')!==rows.map(row=>row[0]).sort().join('\0'))fail(RangeError,c,'/observations','noncanonical-order');for(const row of rows){if(row[2].length!==4||row[2].map(x=>x[0]).join(',')!==SOURCE_KEYS.join(','))fail(RangeError,c,'/transcription','tuple-mismatch');}return rows;
}
function verifyFrozenCandidates(audit:Obj, corpus:Obj, c=CTX):void {
  const drafts=object(audit.candidateDrafts),aRows=candidateRowsFromCorpus(corpus,'transcriberA',c),bRows=candidateRowsFromCorpus(corpus,'transcriberB',c),comparison=comparisonPreimage(aRows,bRows),rows=array(comparison.observations);equal(drafts.eachDraftObservationCount,206,c,'/candidateDrafts/eachDraftObservationCount','wrong-count');equal(drafts.transcriberASetSha256,digest(candidatePreimage('A',aRows)),c,'/candidateDrafts/transcriberASetSha256','hash-mismatch');equal(drafts.transcriberBSetSha256,digest(candidatePreimage('B',bRows)),c,'/candidateDrafts/transcriberBSetSha256','hash-mismatch');equal(drafts.comparisonSetSha256,digest(comparison),c,'/candidateDrafts/comparisonSetSha256','hash-mismatch');equal(drafts.transcriberASetSha256,CANDIDATE_A,c,'/candidateDrafts/transcriberASetSha256','fixed-hash-mismatch');equal(drafts.transcriberBSetSha256,CANDIDATE_B,c,'/candidateDrafts/transcriberBSetSha256','fixed-hash-mismatch');equal(drafts.comparisonSetSha256,COMPARISON,c,'/candidateDrafts/comparisonSetSha256','fixed-hash-mismatch');
  const totals={exact:0,canonical:0,different:0};for(const row of rows){const fields=array(array(row)[1]);if(fields.length!==4)fail(RangeError,c,'/candidateDrafts','tuple-mismatch');for(const field of fields){const kind=array(field)[3];if(kind==='exact')totals.exact++;else if(kind==='canonical-unit-equivalent')totals.canonical++;else if(kind==='different')totals.different++;else fail(RangeError,c,'/candidateDrafts','unknown-comparison');}}
  if(totals.exact!==618||totals.canonical!==206||totals.different!==0)fail(RangeError,c,'/candidateDrafts','comparison-count-mismatch');
}
function binary64Bits(n:number):string {const bytes=new Uint8Array(8),view=new DataView(bytes.buffer);view.setFloat64(0,n,false);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
const BACKUP_HASH='9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c';
const MIGRATED_HASH='92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5';
const BACKUP_RAW_KEYS=['rawTemperature','rawSupersaturation','rawGrowthTime','rawSquareFieldOfView'];
const migrationIds=():string[]=>Array.from({length:32},(_,i)=>`L23-F2-P11-N${String(i+1).padStart(3,'0')}`);
const codeUnits=(s:string):number[]=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i));
const utf8=(s:string):number[]=>[...new TextEncoder().encode(s)];
function samePair(raw:string,n:number,expectedRaw:string,expectedN:number):boolean {
  return raw===expectedRaw&&JSON.stringify(codeUnits(raw))===JSON.stringify(codeUnits(expectedRaw))&&JSON.stringify(utf8(raw))===JSON.stringify(utf8(expectedRaw))&&Object.is(n,expectedN)&&binary64Bits(n)===binary64Bits(expectedN);
}
function sourceTupleFingerprint(o:Obj):Json[] {
  return SOURCE_KEYS.map((key,i)=>{const raw=string(object(o.rawLabels)[key]),n=number(object(o.normalizedSourceValues)[NORMAL_KEYS[i]!]);return [codeUnits(raw),utf8(raw),binary64Bits(n)];});
}
function readPriorCaptureForOracle(bytes:Uint8Array,expectedHash=BACKUP_HASH,c=CTX):Obj {
  if(sha(bytes)!==expectedHash)fail(RangeError,c,'/sourceFileSha256','backup-hash-mismatch');
  return object(parseJsonRejectingDuplicateKeys(new TextDecoder('utf-8',{fatal:true}).decode(bytes),c.file));
}
function migratePriorCaptureForOracle(backup:Obj,aRows:CandidateRow[],bRows:CandidateRow[],locators:Map<string,CandidateRow[1]>,state:Map<string,Obj>,manifest:Obj,recordedAtUtc:string,c=CTX):void {
  // The caller first authenticates raw file bytes. This content stage is separately
  // exercised with SYN-MIGRATION, including non-JSON numbers and late failures.
  migrationRule(manifest,c,'/priorHumanCaptureMigration');utc(recordedAtUtc,c,'/verificationRecordedAtUtc');
  keys(backup,['version','role','entries'],c);literal(1,'backup-version-mismatch')(backup.version,c,'/version');literal('human-source-auditor','backup-role-mismatch')(backup.role,c,'/role');
  const entries=object(backup.entries,c,'/entries'),expectedKeys=Array.from({length:33},(_,i)=>`P11-N${String(i+1).padStart(3,'0')}`);
  if(Object.keys(entries).length!==33)fail(RangeError,c,'/entries','wrong-count');
  for(const key of Object.keys(entries))if(!expectedKeys.includes(key))fail(RangeError,c,at('/entries',key),'unknown-backup-id');
  const a=new Map(aRows.map(row=>[row[0],row])),b=new Map(bRows.map(row=>[row[0],row]));
  if(a.size!==aRows.length||b.size!==bRows.length)fail(RangeError,c,'/candidateDrafts','duplicate-id');
  const next:Obj[]=[];
  for(const [index,key]of expectedKeys.entries()){
    const q=at('/entries',key),entry=keys(entries[key],[...BACKUP_RAW_KEYS,...NORMAL_KEYS,'confirmed'],c,q),id=`L23-F2-${key}`;
    bool(entry.confirmed,c,at(q,'confirmed'));
    if(index===32){
      if(entry.confirmed!==false)fail(RangeError,c,q,'incomplete-migrated');
      if(BACKUP_RAW_KEYS.some(k=>entry[k]!=='')||NORMAL_KEYS.some(k=>entry[k]!==null))fail(RangeError,c,q,'incomplete-entry-filled');
      continue;
    }
    if(entry.confirmed!==true)fail(RangeError,c,at(q,'confirmed'),'not-confirmed');
    if(state.has(id))fail(RangeError,c,q,'migration-conflict');
    const ar=a.get(id),br=b.get(id),l=locators.get(id);
    if(!ar||!br||!l)fail(RangeError,c,q,'unknown-candidate-id');
    equal(ar[1],l,c,q,'locator-mismatch');equal(br[1],l,c,q,'locator-mismatch');
    const raw:Obj={},n:Obj={};
    for(const [i,name]of SOURCE_KEYS.entries()){
      const r=string(entry[BACKUP_RAW_KEYS[i]!],c,at(q,BACKUP_RAW_KEYS[i]!)),value=number(entry[NORMAL_KEYS[i]!],c,at(q,NORMAL_KEYS[i]!));
      if(!Object.is(decimalUnit(r,name,c,at(q,BACKUP_RAW_KEYS[i]!)),value))fail(RangeError,c,q,'unit-mismatch');
      if(!Object.is(value,ar[2][i]![2])||!Object.is(value,br[2][i]![2])||binary64Bits(value)!==binary64Bits(ar[2][i]![2])||binary64Bits(value)!==binary64Bits(br[2][i]![2]))fail(RangeError,c,q,'candidate-normalized-mismatch');
      if(r!==ar[2][i]![1]&&r!==br[2][i]![1])fail(RangeError,c,q,'candidate-raw-mismatch');
      raw[name]=r;n[NORMAL_KEYS[i]!]=value;
    }
    const inside=number(n.temperatureC)>=-30&&number(n.temperatureC)<=0&&number(n.supersaturationPct)>=0&&number(n.supersaturationPct)<=30;
    n.inProductDomain=inside;n.exclusionReason=inside?null:'outside-product-domain';
    next.push({sourceObservationId:id,locator:{pdfPage:l[0],pagePanelOrdinal:l[1],panelBoundsPdfPt:clone(l[2])},rawLabels:raw,normalizedSourceValues:n,verification:{sourcePanelInspected:true,fields:Object.fromEntries(SOURCE_KEYS.map((name,i)=>[name,{candidateComparison:array(comparedField(name,[ar[2][i]![1],ar[2][i]![2]],[br[2][i]![1],br[2][i]![2]]))[3]!,humanAction:'preserved-prior-human-confirmation',humanConfirmedRawAndNormalized:true,rationale:null}])),verifiedByRole:'human-source-auditor',verificationRecordedAtUtc:recordedAtUtc}});
  }
  equal(next.map(x=>x.sourceObservationId!),migrationIds(),c,'/entries','migration-id-set-mismatch');
  equal(digest(next.map(x=>x.sourceObservationId!)),manifest.migratedConfirmedIdSetSha256!,c,'/entries','migration-id-set-mismatch');
  // Commit only after every entry, including the final incomplete one, passes.
  next.forEach(item=>auditEntry(item,c));
  for(const item of next)state.set(string(item.sourceObservationId),clone(item));
}
function migrateAuthenticatedPriorCaptureForOracle(bytes:Uint8Array,aRows:CandidateRow[],bRows:CandidateRow[],locators:Map<string,CandidateRow[1]>,state:Map<string,Obj>,manifest:Obj,recordedAtUtc:string,expectedRawHash=BACKUP_HASH):void {
  migratePriorCaptureForOracle(readPriorCaptureForOracle(bytes,expectedRawHash),aRows,bRows,locators,state,manifest,recordedAtUtc);
}
type VerificationEvent={sourcePanelVisibleAt:number;candidateVisibleAt:number;sourcePdfSha256:string;sourceLocator:CandidateRow[1];explicitRawAction:boolean;explicitNormalizedAction:boolean;persisted:boolean;origin:'prior'|'new'};
type WorkflowState={aRows:CandidateRow[];bRows:CandidateRow[];aFrozen:boolean;bFrozen:boolean;comparisonFrozen:boolean;drafts:Obj;migrationManifest:Obj;priorCaptureBytes:Uint8Array;priorCaptureHash:string;sourceLocators:Map<string,CandidateRow[1]>;migrationRecordedAtUtc:string;migrated:Map<string,Obj>;events:Array<[string,VerificationEvent]>;entries:Map<string,Obj>;exported:boolean};
function workflowBindings(state:WorkflowState):ActionBindings {
  if(!state.aFrozen||!state.bFrozen||!state.comparisonFrozen)fail(RangeError,CTX,'/candidateDrafts','candidates-not-frozen');
  if(state.aRows.length!==206||state.bRows.length!==206)fail(RangeError,CTX,'/candidateDrafts','wrong-count');
  const comparison=comparisonPreimage(state.aRows,state.bRows);
  for(const [name,actual,expected]of [['transcriberASetSha256',digest(candidatePreimage('A',state.aRows)),CANDIDATE_A],['transcriberBSetSha256',digest(candidatePreimage('B',state.bRows)),CANDIDATE_B],['comparisonSetSha256',digest(comparison),COMPARISON]] as const){
    equal(state.drafts[name],actual,CTX,`/candidateDrafts/${name}`,'hash-mismatch');equal(actual,expected,CTX,`/candidateDrafts/${name}`,'fixed-hash-mismatch');
  }
  equal(state.drafts.eachDraftObservationCount,206,CTX,'/candidateDrafts/eachDraftObservationCount','wrong-count');migrationRule(state.migrationManifest,CTX,'/priorHumanCaptureMigration');
  equal([...state.migrated.keys()].sort(),migrationIds(),CTX,'/migration','migration-id-set-mismatch');
  const original=new Map<string,Obj>();migrateAuthenticatedPriorCaptureForOracle(state.priorCaptureBytes,state.aRows,state.bRows,state.sourceLocators,original,state.migrationManifest,state.migrationRecordedAtUtc,state.priorCaptureHash);
  equal([...state.migrated], [...original],CTX,'/migration','migration-copy-mismatch');
  return {comparison:new Map(array(comparison.observations).map(row=>[string(array(row)[0]),array(array(row)[1])])),prior:state.migrated};
}
function verifyHumanWorkflow(state:WorkflowState,readDuringVerification:()=>unknown):void {
  const bindings=workflowBindings(state),ids=[...bindings.comparison.keys()],expected=new Set(ids.flatMap(id=>SOURCE_KEYS.map(field=>`${id}/${field}`)));
  const counts=new Map<string,number>();
  for(const [key]of state.events){
    if(!expected.has(key))fail(RangeError,CTX,'/verification','unknown-panel-or-field');
    counts.set(key,(counts.get(key)??0)+1);
  }
  for(const count of counts.values())if(count!==1)fail(RangeError,CTX,'/verification','duplicate-human-verification');
  for(const key of expected)if(counts.get(key)!==1)fail(RangeError,CTX,'/verification','incomplete-human-verification');
  equal([...state.entries.keys()].sort(),ids,CTX,'/verification','incomplete-human-verification');
  for(const [key,event]of state.events){
    const id=key.slice(0,key.lastIndexOf('/')),prior=bindings.prior.has(id);
    if(event.origin!==(prior?'prior':'new'))fail(RangeError,CTX,'/verification','confirmation-origin-mismatch');
    equal(event.sourcePdfSha256,PDF,CTX,'/verification','source-pdf-mismatch');
    const row=state.aRows.find(row=>row[0]===id)!;
    equal(event.sourceLocator,row[1],CTX,'/verification','source-locator-mismatch');
    equal(object(state.entries.get(id)!.locator),{pdfPage:row[1][0],pagePanelOrdinal:row[1][1],panelBoundsPdfPt:row[1][2]},CTX,'/verification','source-locator-mismatch');
    if(!Number.isFinite(event.sourcePanelVisibleAt)||!Number.isFinite(event.candidateVisibleAt)||event.sourcePanelVisibleAt>event.candidateVisibleAt)fail(RangeError,CTX,'/verification','pdf-not-visible-with-candidate');
    if(event.explicitRawAction!==true||event.explicitNormalizedAction!==true)fail(RangeError,CTX,'/verification','incomplete-human-verification');
    if(event.persisted!==true)fail(RangeError,CTX,'/verification','unsaved-human-verification');
  }
  for(const id of ids)auditEntry(state.entries.get(id),CTX,'',bindings);
  expect(readDuringVerification).not.toHaveBeenCalled();
}
function exportVerifiedAudit(state:WorkflowState,reader:()=>unknown):Obj {
  verifyHumanWorkflow(state,reader);const exported:Obj={observations:[...state.entries.values()].map(clone)};state.exported=true;expect(reader).not.toHaveBeenCalled();return exported;
}
function verifyExportedAuditAgainstCorpus(exported:Obj,readAfterExport:()=>Obj):void {
  const corpus=readAfterExport();sourceJoin(array(corpus.observations).map(objectValue=>object(objectValue)),array(exported.observations).map(objectValue=>object(objectValue)));
}

const PREFIX='snow-crystal-sim/T1-7/split-v1\0';
const groupRule=record({groupKey:tuple(numeric,numeric),groupSha256:hash,splitOrderSha256:hash,stratumId:nullable(enumeration(...STRATA)),partition:enumeration('train','holdout','report-only'),sourceObservationIds:list(identity),sourceObservationIdSetSha256:hash});
const stratumRule=record({stratumId:enumeration(...STRATA),temperatureBin:enumeration('T0','T1','T2'),supersaturationBin:enumeration('S0','S1','S2'),groupCount:natural,holdoutGroupCount:natural,trainGroupSha256s:list(hash),holdoutGroupSha256s:list(hash),trainSourceObservationIds:list(identity),holdoutSourceObservationIds:list(identity)});
const assignmentRule=record({algorithmId:literal('condition-group-hash-stratified-v1'),hashPreimagePrefix:literal(PREFIX),stratumOrder:fixed(STRATA),strata:list(stratumRule,9),groups:list(groupRule),reportOnly:record({groupSha256s:list(hash),sourceObservationIds:list(identity)})});
const splitRule=record({schemaVersion:literal('snow-crystal-observation-split/1'),corpusId:literal(CORPUS_ID),corpusSha256:hash,sourceEntrySetSha256:hash,sourceAuditSha256:hash,splitAssignmentSha256:hash,assignment:assignmentRule});
function stratumFor(key:Json):string|null {const [t,s]=array(key).map(x=>number(x));if(t!<-30||t!>0||s!<0||s!>30)return null;return `T${t!<-10?0:t!<-3?1:2}-S${s!<10?0:s!<20?1:2}`;}
type References={corpus:Obj;sourceEntries:Obj[];audit:Obj;real:boolean};
function validateSplitV1(v:unknown,refs:References,file='split.json'):Obj {
  const c={file};splitRule(v,c,'');const s=object(v),a=object(s.assignment),gs=array(a.groups).map(x=>object(x));
  equal(s.splitAssignmentSha256,digest(a),c,'/splitAssignmentSha256','hash-mismatch');
  for(const [k,w] of Object.entries({corpusSha256:digest(refs.corpus),sourceEntrySetSha256:digest(refs.sourceEntries),sourceAuditSha256:digest(refs.audit)}))equal(s[k],w,c,at('',k),'hash-mismatch');
  const seenGroups=new Set<string>(),seenIds=new Set<string>(),sourceById=new Map(refs.sourceEntries.map(o=>[string(o.sourceObservationId),object(o.normalizedSourceValues)]));
  for(const [i,g]of gs.entries()){
    const p=`/assignment/groups/${i}`,key=array(g.groupKey),groupHash=digest(key),ids=array(g.sourceObservationIds);
    equal(g.groupSha256,groupHash,c,at(p,'groupSha256'),'hash-mismatch');equal(g.splitOrderSha256,sha(PREFIX+canonicalizeForOracle(key)),c,at(p,'splitOrderSha256'),'hash-mismatch');
    if(seenGroups.has(groupHash))fail(RangeError,c,p,'duplicate-group');seenGroups.add(groupHash);
    sortedUnique(ids,c,at(p,'sourceObservationIds'));if(ids.length===0)fail(RangeError,c,at(p,'sourceObservationIds'),'wrong-count');
    equal(g.sourceObservationIdSetSha256,digest(ids),c,at(p,'sourceObservationIdSetSha256'),'hash-mismatch');
    const stratum=stratumFor(key);equal(g.stratumId,stratum,c,at(p,'stratumId'),'stratum-mismatch');
    if((stratum===null)!==(g.partition==='report-only'))fail(RangeError,c,at(p,'partition'),'partition-mismatch');
    for(const rawId of ids){const id=string(rawId);if(seenIds.has(id))fail(RangeError,c,at(p,'sourceObservationIds'),'duplicate-id');seenIds.add(id);const source=sourceById.get(id);if(!source)fail(RangeError,c,at(p,'sourceObservationIds'),'dangling-id');equal(key,[source.temperatureC!,source.supersaturationPct!],c,at(p,'groupKey'),'condition-mismatch');}
  }
  if(seenIds.size!==sourceById.size||(refs.real&&seenIds.size!==206))fail(RangeError,c,'/assignment/groups','wrong-count');
  const expectedOrder:Json[]=[];
  for(const [i,id]of STRATA.entries()){
    const local=gs.filter(g=>g.stratumId===id).sort((x,y)=>string(x.splitOrderSha256)<string(y.splitOrderSha256)?-1:1),n=local.length,nh=n<2?0:Math.min(n-1,Math.max(1,Math.floor(n/5)));
    const hold=local.slice(0,nh),train=local.slice(nh);expectedOrder.push(...local);
    for(const g of train)equal(g.partition,'train',c,'/assignment/groups','partition-mismatch');for(const g of hold)equal(g.partition,'holdout',c,'/assignment/groups','partition-mismatch');
    const t=object(array(a.strata)[i]);const expected:Obj={stratumId:id,temperatureBin:id.slice(0,2),supersaturationBin:id.slice(3),groupCount:n,holdoutGroupCount:nh,trainGroupSha256s:train.map(g=>g.groupSha256!),holdoutGroupSha256s:hold.map(g=>g.groupSha256!),trainSourceObservationIds:train.flatMap(g=>array(g.sourceObservationIds)),holdoutSourceObservationIds:hold.flatMap(g=>array(g.sourceObservationIds))};
    for(const[k,w]of Object.entries(expected))equal(t[k],w,c,`/assignment/strata/${i}/${k}`,'reference-mismatch');
  }
  const reports=gs.filter(g=>g.partition==='report-only').sort((x,y)=>string(x.groupSha256)<string(y.groupSha256)?-1:1);expectedOrder.push(...reports);
  equal(gs,expectedOrder,c,'/assignment/groups','noncanonical-order');
  equal(a.reportOnly,{groupSha256s:reports.map(g=>g.groupSha256!),sourceObservationIds:reports.flatMap(g=>array(g.sourceObservationIds))},c,'/assignment/reportOnly','reference-mismatch');
  return s;
}

// TC-SPLIT-003's ten explicit synthetic conditions, not a source-PDF corpus.
const SYN_CONDITIONS:Json[]=[[-20,5],[-20,15],[-20,25],[-5,5],[-5,15],[-5,25],[-1,5],[-1,15],[-1,25],[-31,5]];
const SYN_SPLIT_IDS=['L23-F2-P11-N001','L23-F2-P11-N002','L23-F2-P11-N003','L23-F2-P11-N004','L23-F2-P11-N005','L23-F2-P11-N006','L23-F2-P11-N007','L23-F2-P11-N008','L23-F2-P11-N009','L23-F2-P11-N010'];
const SYN_SPLIT_ENTRIES:Obj[]=SYN_CONDITIONS.map((key,i)=>({sourceObservationId:SYN_SPLIT_IDS[i]!,normalizedSourceValues:{temperatureC:array(key)[0]!,supersaturationPct:array(key)[1]!}}));
const SYN_CORPUS_REFERENCE:Obj={fixtureKind:'synthetic-split-conditions-only',conditions:SYN_CONDITIONS,ids:SYN_SPLIT_IDS};
const SYN_AUDIT_REFERENCE:Obj={fixtureKind:'synthetic-split-audit-reference-only',sourceEntries:SYN_SPLIT_ENTRIES};
const SYN_REFS:References={corpus:SYN_CORPUS_REFERENCE,sourceEntries:SYN_SPLIT_ENTRIES,audit:SYN_AUDIT_REFERENCE,real:false};
const SYN_GROUPS:Obj[]=SYN_CONDITIONS.map((key,i)=>({groupKey:key,groupSha256:digest(key),splitOrderSha256:sha(PREFIX+canonicalizeForOracle(key)),stratumId:i===9?null:STRATA[i]!,partition:i===9?'report-only':'train',sourceObservationIds:[SYN_SPLIT_IDS[i]!],sourceObservationIdSetSha256:digest([SYN_SPLIT_IDS[i]!])}));
const SYN_ASSIGNMENT:Obj={algorithmId:'condition-group-hash-stratified-v1',hashPreimagePrefix:PREFIX,stratumOrder:STRATA,strata:STRATA.map((id,i)=>({stratumId:id,temperatureBin:id.slice(0,2),supersaturationBin:id.slice(3),groupCount:1,holdoutGroupCount:0,trainGroupSha256s:[SYN_GROUPS[i]!.groupSha256!],holdoutGroupSha256s:[],trainSourceObservationIds:[SYN_SPLIT_IDS[i]!],holdoutSourceObservationIds:[]})),groups:SYN_GROUPS,reportOnly:{groupSha256s:[SYN_GROUPS[9]!.groupSha256!],sourceObservationIds:['L23-F2-P11-N010']}};
const SYN_SPLIT:Obj={schemaVersion:'snow-crystal-observation-split/1',corpusId:CORPUS_ID,corpusSha256:digest(SYN_CORPUS_REFERENCE),sourceEntrySetSha256:digest(SYN_SPLIT_ENTRIES),sourceAuditSha256:digest(SYN_AUDIT_REFERENCE),splitAssignmentSha256:digest(SYN_ASSIGNMENT),assignment:SYN_ASSIGNMENT};
const RASTER:Obj={protocolId:'figure2-projection-v1',rendererName:'pdfjs-dist',rendererVersion:'6.3.289',canvasBackendName:'@napi-rs/canvas',canvasBackendVersion:'1.0.6',nodeRuntimeVersion:'24.14.1',sourcePdfSha256:PDF,dpi:600,pointsPerInch:72,viewportScale:600/72,pageBox:'crop-box',pageRotation:'respect-pdf-page-rotate',intent:'display',annotationMode:'disable',workerMode:'disabled',useSystemFonts:false,isEvalSupported:false,backgroundRgba:[255,255,255,255],outputColorSpace:'srgb',pixelFormat:'rgba8-straight-alpha',origin:'top-left',rowOrder:'top-to-bottom'};
const SEEDS:Obj[]=[
  {index:0,derivationSha256:'067267644959298fcccf5751a438cb6eedcefe325f085997025e29a6fd7fd6af',stateU32Le:[1684500998,2401851721,1364709324,1858812068]},
  {index:1,derivationSha256:'7061bcfbe7242c394ac03d46ed5d1496e87e17821f5e2a1f4abb637423493aff',stateU32Le:[4223426928,959194343,1178452042,2517917165]},
  {index:2,derivationSha256:'7df501fec43bd4feaf6bca052062d0cb36203c27de50e1cb65e495b0db001996',stateU32Le:[4261541245,4275321796,97151919,3419431456]},
  {index:3,derivationSha256:'5d41398e0d5790438b7f804de7f351fc2a9acaf7399ed30c1f08a35b13c6070b',stateU32Le:[2386116957,1133532941,1300266891,4233229287]},
  {index:4,derivationSha256:'82e8a7e0b0be4953a50179247e748c2077006dec0d51b4586aad68c57e7efdeb',stateU32Le:[3769100418,1397341872,611910053,546075774]},
  {index:5,derivationSha256:'d21f3ac2b8df5e280d04f0b42b12f54ee705e31fae215c94faa7e584f4df7e62',stateU32Le:[3258589138,677306296,3035628557,1324683819]},
  {index:6,derivationSha256:'926c9755bb09b0b5b9b686f9f129be4d258a49d9cba8cc26270e4587a2af8966',stateU32Le:[1435987090,3048212923,4186355385,1304308209]},
  {index:7,derivationSha256:'5d4b43b7013caec4be9bc34702737ff707b244c60771f4e9486bb7e7682c544c',stateU32Le:[3074640733,3299752961,1204001726,4152324866]},
];
const LOSSES:Obj={rank:{primarySetId:'basal-rank-v1',primaryComponentIds:['branching-compactness-v1','branching-tip-density-v1'],integratedSetId:'integrated-rank-v1',integratedComponentIds:['branching-compactness-v1','branching-tip-density-v1','axis-aspect-ratio-v1'],components:[{id:'branching-compactness-v1',observationField:'morphology.final.basalBranchingLevel',predictionMetric:'compactness',direction:'larger-is-higher-rank'},{id:'branching-tip-density-v1',observationField:'morphology.final.basalBranchingLevel',predictionMetric:'tipDensity',direction:'larger-is-higher-rank'},{id:'axis-aspect-ratio-v1',observationField:'morphology.final.growthAxis',predictionMetric:'aspectRatio',direction:'larger-is-higher-rank'}],pairPenalty:{matchingSign:0,exactlyOneTie:0.5,reversedNonzeroSign:1},aggregationOrder:['observation-pair','group-pair','component','stratum','nonempty-strata','seed','checkpoint']},shape:{scoredFeatureIds:['inverseCircularity','normalizedArmLengthCv'],predictionMetrics:['compactness','armLengthCv'],reportOnlyFeatureIds:['minorMajorAxisRatio'],scaleId:'train-empirical-mid-cdf-v1',intervalDistanceId:'closed-cdf-interval-distance-v1',aggregationOrder:['feature','observation','condition-group','stratum','nonempty-strata','seed','checkpoint']},categoricalTagLossDefinition:null};
const SIMULATION:Obj={latticeRadiusCells:115,checkpointBasalRadiusCells:[10,20,40],checkpointCriterion:'first-state-basalRadiusCells-greater-than-or-equal',executionOrder:'checkpoint-outer-seed-inner',maxStepCount:40021,seedDerivationPrefix:'snow-crystal-sim/T1-7/seed-v1/',seeds:SEEDS,failureCodes:['checkpoint-not-reached','reservoir-boundary-reached','non-finite-metric','max-step-exceeded']};
const CANDIDATE:Obj={schemaVersion:'snow-crystal-candidate-manifest/1',relativePathPattern:'calibration/runs/{calibrationId}/candidate-manifest.json',hashAlgorithm:'rfc8785-jcs-sha256',candidateIdRule:'jcs-sha256-of-candidate-without-candidateId',allowedFamilies:['condition-blind-baseline','nearest-train-condition-baseline','piecewise-bilinear-map-v1'],requiredBeforeAnyScore:true};
const HOLDOUT:Obj={schemaVersion:'snow-crystal-holdout-run/1',runRecordBasename:'holdout-run.json',openIntentBasename:'holdout-open-intent.json',reportBasename:'holdout-report.json',stateOrder:['sealed','opening','opened'],secondOpenError:'holdout-already-opened-or-in-progress',requiredInputHashFields:['corpusSha256','splitSha256','protocolSha256','candidateManifestSha256','selectedCandidateId','selectedCandidateSha256','trainReportSha256']};
const SYN_PROTOCOL:Obj={schemaVersion:'snow-crystal-calibration-protocol/1',protocolId:'libbrecht-2023-figure2-scale-marginalized-v1',corpusId:CORPUS_ID,corpusSha256:digest(SYN_CORPUS_REFERENCE),splitSha256:digest(SYN_SPLIT),sourceAuditSha256:digest(SYN_AUDIT_REFERENCE),rasterization:RASTER,losses:LOSSES,simulation:SIMULATION,candidateManifestContract:CANDIDATE,holdoutRecordContract:HOLDOUT};
const seedRule=record({index:natural,derivationSha256:hash,stateU32Le:tuple(uint32,uint32,uint32,uint32)});
const simulationRule=record({...Object.fromEntries(Object.entries(without(SIMULATION,'seeds')).map(([k,v])=>[k,fixed(v)])),seeds:list(seedRule,8)});
const protocolRule=record({schemaVersion:literal('snow-crystal-calibration-protocol/1'),protocolId:literal('libbrecht-2023-figure2-scale-marginalized-v1'),corpusId:literal(CORPUS_ID),corpusSha256:hash,splitSha256:hash,sourceAuditSha256:hash,rasterization:fixed(RASTER),losses:fixed(LOSSES),simulation:simulationRule,candidateManifestContract:fixed(CANDIDATE),holdoutRecordContract:fixed(HOLDOUT)});
function validateProtocolV1(v:unknown,corpus:Obj,split:Obj,audit:Obj,file='protocol.json'):Obj {
  const c={file};protocolRule(v,c,'');const p=object(v),sim=object(p.simulation),seeds=array(sim.seeds);
  for(const [i,x]of seeds.entries()){
    const s=object(x),h=sha(`snow-crystal-sim/T1-7/seed-v1/${i}`),bytes=Uint8Array.from(h.match(/../g)!,x=>parseInt(x,16)),view=new DataView(bytes.buffer),state=[0,4,8,12].map(offset=>view.getUint32(offset,true));
    equal(s.index,i,c,`/simulation/seeds/${i}/index`,'seed-mismatch');equal(s.derivationSha256,h,c,`/simulation/seeds/${i}/derivationSha256`,'seed-mismatch');
    if(array(s.stateU32Le).every(x=>x===0))fail(RangeError,c,`/simulation/seeds/${i}/stateU32Le`,'all-zero-seed');
    equal(s.stateU32Le,state,c,`/simulation/seeds/${i}/stateU32Le`,'seed-mismatch');
  }
  for(const[k,h]of Object.entries({corpusSha256:digest(corpus),splitSha256:digest(split),sourceAuditSha256:digest(audit)}))equal(p[k],h,c,at('',k),'hash-mismatch');
  return p;
}
function preparationBoundary(ephemeral:unknown,reuseEvidence:unknown,start:()=>void):void {
  // These ephemeral process records are not additions to the persisted JSON schemas.
  try{fixed(RASTER)(ephemeral,CTX,'/preparation');fixed(RASTER)(reuseEvidence,CTX,'/existingEvidence');}catch(cause){fail(RangeError,CTX,'/preparation','raster-protocol-mismatch',cause);}
  start();
}

function sumsCheck(text:string,objects:Record<string,Obj>,validate:(name:string,value:Obj)=>void=()=>{}):void {
  const names=['corpus.json','protocol.json','split.json'];
  const rows=text.split('\n');if(rows.length!==4||rows[3]!=='')fail(RangeError,{file:'SHA256SUMS'},'','sums-grammar');
  names.forEach((name,i)=>{const m=/^([0-9a-f]{64})  ([A-Za-z0-9._-]+\.json)$/.exec(rows[i]!);if(!m||m[2]!==name)fail(RangeError,{file:'SHA256SUMS'},`/${i}`,'sums-grammar');validate(name,objects[name]!);equal(m[1],digest(objects[name]),{file:'SHA256SUMS'},`/${name}`,'hash-mismatch');});
}
function realArtifacts():{corpus:Obj;audit:Obj;split:Obj;protocol:Obj} {
  const corpus=validateCorpusV1(readJson(`${DATA_REL}/corpus.json`),`${DATA_REL}/corpus.json`);
  const auditRaw=readJson(AUDIT_REL),splitRaw=readJson(`${DATA_REL}/split.json`),protocolRaw=readJson(`${DATA_REL}/protocol.json`);
  // Audit approval contains the final corpus hash; assignment was frozen before annotation.
  const audit=object(auditRaw,{file:AUDIT_REL});
  const splitShape=object(splitRaw,{file:`${DATA_REL}/split.json`});
  const assignment=object(splitShape.assignment,{file:`${DATA_REL}/split.json`},'/assignment');
  const checkedAudit=validateSourceAuditV1(audit,corpus,assignment,AUDIT_REL);
  const split=validateSplitV1(splitRaw,{corpus,sourceEntries:array(audit.observations).map(x=>object(x)),audit:checkedAudit,real:true},`${DATA_REL}/split.json`);
  const protocol=validateProtocolV1(protocolRaw,corpus,split,checkedAudit,`${DATA_REL}/protocol.json`);
  const objects={'corpus.json':corpus,'protocol.json':protocol,'split.json':split};
  const sums=readFileSync(resolve(ROOT,`${DATA_REL}/SHA256SUMS`),'utf8') as string;
  sumsCheck(sums,objects,(name,value)=>{
    if(name==='corpus.json')validateCorpusV1(value);
    else if(name==='split.json')validateSplitV1(value,{corpus,sourceEntries:array(audit.observations).map(x=>object(x)),audit:checkedAudit,real:true});
    else validateProtocolV1(value,corpus,split,checkedAudit);
  });
  return {corpus,audit:checkedAudit,split,protocol};
}
function artifactBoundary(names:string[],contents:string[],directories:string[]=[]):void {
  equal([...names].sort(),['SHA256SUMS','corpus.json','protocol.json','split.json'],CTX,'/artifacts','artifact-boundary');
  if(directories.length||contents.some(s=>/data:[^\s]*;base64,|JVBERi0|iVBORw0KGgo|\/9j\/|\"(?:pixels|maskBytes|imageData|base64)\"\s*:/.test(s)))fail(RangeError,CTX,'/artifacts','artifact-boundary');
}

const SOURCE_AUDIT_SEQUENCE=['candidate-a-frozen','candidate-b-frozen','comparison-frozen','backup-hash-verified','migrated-id-set-frozen','human-source-confirmed','source-and-assignment-frozen','annotations-approved','corpus-frozen','audit-approved','references-frozen'];
function sourceAuditSequence(stages:string[],before:Obj,after:Obj):void {equal(stages,SOURCE_AUDIT_SEQUENCE,CTX,'/freeze','freeze-order');equal(canonicalizeForOracle(after),canonicalizeForOracle(before),CTX,'/assignment','stale');}
function acyclic(graph:Record<string,string[]>):void {
  const active=new Set<string>(),done=new Set<string>();const visit=(v:string):void=>{if(active.has(v))fail(RangeError,CTX,'/hashDependencies','cyclic-hash');if(done.has(v))return;active.add(v);for(const next of graph[v]??[])visit(next);active.delete(v);done.add(v);};Object.keys(graph).forEach(visit);
}
const SOURCE_AUDIT_DEPENDENCIES:Record<string,string[]>={candidateA:['comparison'],candidateB:['comparison'],comparison:['humanConfirmedSource'],backup:['migratedIdSet','humanConfirmedSource'],migratedIdSet:['humanConfirmedSource'],humanConfirmedSource:['sourceEntryHash','assignment'],sourceEntryHash:['auditPayload'],assignment:['assignmentHash'],assignmentHash:['auditPayload'],corpus:['corpusHash'],corpusHash:['auditPayload'],auditPayload:['auditApproval'],auditApproval:['auditObject'],auditObject:['split','protocol'],split:['protocol'],protocol:['review','red','green','calibration']};
function staleFromSourceAudit(node:string):Set<string>{const out=new Set<string>();const visit=(n:string)=>{for(const x of SOURCE_AUDIT_DEPENDENCIES[n]??[])if(!out.has(x)){out.add(x);visit(x);}};visit(node);return out;}

function assertError(run:()=>unknown,C:ErrorClass,p:string,reason:string,id?:string):Error {
  let error:unknown;try{run();}catch(e){error=e;}
  expect(error).toBeInstanceOf(C);const e=error as Error;
  expect(e.message).toContain('file=');expect(e.message).toContain(`field=${p||'/'}, reason=${reason}`);
  if(id)expect(e.message).toContain(`sourceObservationId=${id}`);return e;
}
function edit<T extends Json>(value:T,path:(string|number)[],replacement:Json,remove=false):T {
  const copy=clone(value);let node:Json=copy;
  for(const key of path.slice(0,-1))node=Array.isArray(node)?node[Number(key)]!:object(node)[String(key)]!;
  const key=path.at(-1)!;
  if(Array.isArray(node)){if(remove)node.splice(Number(key),1);else node[Number(key)]=replacement;}else if(remove)delete object(node)[String(key)];else object(node)[String(key)]=replacement;
  return copy;
}
function walk(v:Json,path:(string|number)[]=[]):Array<{path:(string|number)[];value:Json}> {
  const out=[{path,value:v}];if(Array.isArray(v))v.forEach((x,i)=>out.push(...walk(x,[...path,i])));else if(v!==null&&typeof v==='object')for(const[k,x]of Object.entries(v))out.push(...walk(x,[...path,k]));return out;
}
const pointer=(path:(string|number)[]):string=>path.reduce<string>((p,k)=>at(p,k),'');
function schemaMutations(label:string,fixture:Obj,rule:Rule,nullablePaths:string[]=[]):void {
  for(const {path,value}of walk(fixture)){
    const p=pointer(path);
    if(value!==null&&typeof value==='object'&&!Array.isArray(value)){
      it(`${label} synthetic unknown property ${p||'root'}`,()=>assertError(()=>rule(path.length?edit(fixture,[...path,'extra'],true):{...fixture,extra:true},CTX,''),TypeError,at(p,'extra'),'unknown-property'));
      for(const k of Object.keys(value))it(`${label} synthetic required ${at(p,k)}`,()=>assertError(()=>rule(edit(fixture,[...path,k],null,true),CTX,''),TypeError,at(p,k),'missing-property'));
    }
    if(path.length){
      const wrong:Json=value===null?true:typeof value==='string'?7:typeof value==='number'?'bad':typeof value==='boolean'?1:Array.isArray(value)?{}:[];
      it(`${label} synthetic wrong type ${p}`,()=>assertError(()=>rule(edit(fixture,path,wrong),CTX,''),TypeError,p,'wrong-type'));
      if(value!==null&&!nullablePaths.includes(p))it(`${label} synthetic null rejected ${p}`,()=>assertError(()=>rule(edit(fixture,path,null),CTX,''),TypeError,p,'wrong-type'));
    }
  }
}
function reapprove(o:Obj,mode='individual-source-pdf'):Obj {
  const m=object(o.morphology),a:Obj={...clone(SYN_APPROVAL),reviewMode:mode,targetSourceObservationIds:[o.sourceObservationId!],targetIdSetSha256:digest([o.sourceObservationId!]),draftAnnotationSetSha256:digest([[o.sourceObservationId,m.annotatorA,m.annotatorB]]),finalAnnotationSetSha256:digest([[o.sourceObservationId,m.final]])};
  a.approvalId=digest(without(a,'approvalId'));m.approvalId=a.approvalId;return a;
}
const SYN_EA:Obj={rasterWidthPx:11,rasterHeightPx:11,maskStatus:'usable',maskUsabilityReason:null,maskSha256:'66ad96f0cffebe842cc5d3b24a8c8aac3bc21b781aa3d3e749c3b2d62e884030',foregroundPixelCount:4,fourNeighborPerimeterEdges:8,foregroundCentroidPx:[1,1],populationCovariancePx2:{xx:0.25,xy:0,yy:0.25},eigenvaluesPx2:[0.25,0.25],armStatus:'usable',armUsabilityReason:null,centerPx:[5.5,5.5],armEndpointsClockwisePx:[[7.5,5.5],[6.5,7.5],[4.5,7.5],[3.5,5.5],[4.5,3.5],[6.5,3.5]],rawInverseCircularity:1.2732395447351628,rawNormalizedArmLengthCv:0.051582744513315945,rawMinorMajorAxisRatio:1};
const SYN_EB:Obj={...clone(SYN_EA),maskSha256:'a0a7f65a1e81907621d6dc7c9acd606e445022041cd91ac82af733f3f73e37a1',foregroundPixelCount:9,fourNeighborPerimeterEdges:12,populationCovariancePx2:{xx:1,xy:0,yy:4},eigenvaluesPx2:[1,4],armEndpointsClockwisePx:[[10.5,5.5],[8.5,9.5],[2.5,9.5],[0.5,5.5],[2.5,1.5],[8.5,1.5]],rawNormalizedArmLengthCv:0,rawMinorMajorAxisRatio:0.5};
const SYN_PROJECTED:Obj={status:'usable',inverseCircularity:{low:1.2732395447351628,high:1.2732395447351628},normalizedArmLengthCv:{low:0,high:0.051582744513315945},minorMajorAxisRatio:{low:0.5,high:1},reason:null,extractionA:SYN_EA,extractionB:SYN_EB,auditStatus:'agreed',adjudicationNote:null,extractionProtocolId:'figure2-projection-v1'};
function schemaOnlyCorpus():Obj {return {schemaVersion:'snow-crystal-observation-corpus/1',corpusId:CORPUS_ID,source:clone(SOURCE),observations:[clone(SYN_OBSERVATION)],annotationApprovals:[clone(SYN_APPROVAL)]};}
function comparisonMap(aRows:CandidateRow[],bRows:CandidateRow[]):Map<string,Json[]> {
  const b=new Map(bRows.map(row=>[row[0],row]));
  return new Map(aRows.map(row=>[row[0],row[2].map((field,i)=>{const other=b.get(row[0])![2][i]!;return comparedField(field[0],[field[1],field[2]],[other[1],other[2]]);})]));
}
function syntheticBackup(aRows:CandidateRow[]):Obj {
  const entries:Obj={};
  for(const id of migrationIds()){
    const row=aRows.find(row=>row[0]===id)!;
    entries[id.slice('L23-F2-'.length)]={...Object.fromEntries(BACKUP_RAW_KEYS.map((key,i)=>[key,row[2][i]![1]])),...Object.fromEntries(NORMAL_KEYS.map((key,i)=>[key,row[2][i]![2]])),confirmed:true};
  }
  entries['P11-N033']={...Object.fromEntries(BACKUP_RAW_KEYS.map(key=>[key,''])),...Object.fromEntries(NORMAL_KEYS.map(key=>[key,null])),confirmed:false};
  return {version:1,role:'human-source-auditor',entries};
}
function syntheticMigrationFixture(){
  const aRows:CandidateRow[]=Array.from({length:33},(_,i)=>[`L23-F2-P11-N${String(i+1).padStart(3,'0')}`,[11,i+1,[10+(i%8)*40,20+Math.floor(i/8)*50,30,40]],[['temperature','-3C',-3],['supersaturation','150%',150],['growthTime','82sec',82],['squareFieldOfView','1164μm',1164]]]);
  const bRows=clone(aRows);for(const row of bRows)row[2][3][1]='1164µm';
  const backup=syntheticBackup(aRows),locators=new Map(aRows.map(row=>[row[0],clone(row[1])])),manifest=clone(object(SYN_AUDIT_STRUCTURE.priorHumanCaptureMigration)),recordedAtUtc='2026-10-09T00:00:00Z';
  return {aRows,bRows,backup,locators,manifest,recordedAtUtc};
}
function entryFromCandidate(row:CandidateRow[],id:string,comparisons:Map<string,Json[]>):Obj {
  const candidate=row.find(row=>row[0]===id)!,l=candidate[1],fields=comparisons.get(id)!,raw:Obj={},n:Obj={};
  SOURCE_KEYS.forEach((key,i)=>{const pair=array(array(fields[i])[4]);raw[key]=pair[0]!;n[NORMAL_KEYS[i]!]=pair[1]!;});
  const inside=number(n.temperatureC)>=-30&&number(n.temperatureC)<=0&&number(n.supersaturationPct)>=0&&number(n.supersaturationPct)<=30;n.inProductDomain=inside;n.exclusionReason=inside?null:'outside-product-domain';
  return {sourceObservationId:id,locator:{pdfPage:l[0],pagePanelOrdinal:l[1],panelBoundsPdfPt:clone(l[2])},rawLabels:raw,normalizedSourceValues:n,verification:{sourcePanelInspected:true,fields:Object.fromEntries(SOURCE_KEYS.map((key,i)=>[key,{candidateComparison:array(fields[i])[3]!,humanAction:'confirmed-proposal',humanConfirmedRawAndNormalized:true,rationale:null}])),verifiedByRole:'human-source-auditor',verificationRecordedAtUtc:'2026-10-09T00:00:01Z'}};
}
function humanWorkflowFixture():WorkflowState {
  const aRows=frozenCandidateRows(),bRows=clone(aRows);for(const row of bRows)row[2][3][1]=canonicalFovRaw(row[2][3][1]);
  // Synthetic capture with the real candidate layout, NOT the original backup.
  // Only the one-time human-backup gate can authenticate BACKUP_HASH.
  const backup=syntheticBackup(aRows),priorCaptureBytes=new TextEncoder().encode(JSON.stringify(backup)),priorCaptureHash=sha(priorCaptureBytes),sourceLocators=new Map(aRows.map(row=>[row[0],clone(row[1])])),migrationManifest=clone(object(SYN_AUDIT_STRUCTURE.priorHumanCaptureMigration)),migrationRecordedAtUtc='2026-10-09T00:00:00Z',migrated=new Map<string,Obj>();
  migrateAuthenticatedPriorCaptureForOracle(priorCaptureBytes,aRows,bRows,sourceLocators,migrated,migrationManifest,migrationRecordedAtUtc,priorCaptureHash);
  const comparisons=comparisonMap(aRows,bRows),events:Array<[string,VerificationEvent]>=[],entries=new Map<string,Obj>();
  for(const row of aRows){const prior=migrated.get(row[0]);entries.set(row[0],prior?clone(prior):entryFromCandidate(aRows,row[0],comparisons));for(const field of SOURCE_KEYS)events.push([`${row[0]}/${field}`,{sourcePanelVisibleAt:1,candidateVisibleAt:2,sourcePdfSha256:PDF,sourceLocator:clone(row[1]),explicitRawAction:true,explicitNormalizedAction:true,persisted:true,origin:prior?'prior':'new'}]);}
  return {aRows,bRows,aFrozen:true,bFrozen:true,comparisonFrozen:true,drafts:clone(object(SYN_AUDIT_STRUCTURE.candidateDrafts)),migrationManifest,priorCaptureBytes,priorCaptureHash,sourceLocators,migrationRecordedAtUtc,migrated,events,entries,exported:false};
}
function workflowEvent(state:WorkflowState,key:string):VerificationEvent {return state.events.find(([eventKey])=>eventKey===key)![1];}

beforeAll(()=>{vi.stubGlobal('fetch',()=>{throw new Error('network forbidden in T1-7');});});
afterAll(()=>{vi.unstubAllGlobals();});

describe('TC-CORPUS synthetic parser, schemas and precedence',()=>{
  it('TC-CORPUS-001 synthetic pinned metadata and exact artifact/content boundary',()=>{
    expect(SOURCE.pdfSha256).toBe('20f579e01777d51b81b527751b32c3e44b1d8ebe9f1d09a7f15554c2445381af');
    expect(SOURCE.figurePdfPages).toEqual([11,12,13,14]);
    const names=['corpus.json','protocol.json','split.json','SHA256SUMS'];artifactBoundary(names,['{}']);
    for(const extra of ['extra.json','image.pdf','image.png','image.jpg','image.jpeg','image.tif','image.tiff','image.webp','image.bmp','mask.bin','SOURCE-AUDIT.json'])expect(()=>artifactBoundary([...names,extra],[])).toThrow(RangeError);
    expect(()=>artifactBoundary(names,[],['subdirectory'])).toThrow(RangeError);
    for(const content of ['data:image/png;base64,AA==','JVBERi0x','iVBORw0KGgo','/9j/','{"maskBytes":[1,0]}','{"pixels":[1]}','{"base64":"AAAA"}'])expect(()=>artifactBoundary(names,[content])).toThrow(RangeError);
    expect(()=>fetch('https://arxiv.org/')).toThrow('network forbidden');
    const own=readFileSync(resolve(ROOT,'apps/snow-crystal-sim/tests/calibration/libbrecht-2023-figure2-schema-artifacts.test.ts'),'utf8') as string;
    expect(own).not.toMatch(/(?:from|import\s*\()\s*['"](?:node:)?(?:https?|dns|net|tls|playwright|puppeteer)['"]/);
  });
  for(const [text,p,reason,C]of [
    ['{"schemaVersion":1,"schemaVersion":2}','/schemaVersion','duplicate-key',SyntaxError],
    ['{"a":1,"\\u0061":2}','/a','duplicate-key',SyntaxError],
    ['{"outer":[{"x":1,"x":2}]}','/outer/0/x','duplicate-key',SyntaxError],
    ['{"a/b":{"~":1,"~":2}}','/a~1b/~0','duplicate-key',SyntaxError],
    ...['NaN','Infinity','-Infinity'].map(x=>[`{"a":[{"value":${x}}]}`,'/a/0/value','json-syntax',SyntaxError]),
    ['{"a":{"n":1e400}}','/a/n','non-finite',RangeError],['{"a":-0}','/a','negative-zero',RangeError],
  ] as Array<[string,string,string,ErrorClass]>)it(`TC-CORPUS-002 synthetic ${reason} ${text}`,()=>assertError(()=>parseJsonRejectingDuplicateKeys(text),C,p,reason));
  it('TC-CORPUS-002 synthetic legal strings escapes and I/O cause',()=>{
    expect(parseJsonRejectingDuplicateKeys('{"value":"Infinity NaN -Infinity","nested":{"a":"x\\\\y\\\"z"}}')).toEqual({value:'Infinity NaN -Infinity',nested:{a:'x\\y"z'}});
    for(const raw of ['{"x":1,}','[1,]','{"x":01}','{"x":.1}','{"x":"unterminated}','{} false'])expect(()=>parseJsonRejectingDuplicateKeys(raw)).toThrow(SyntaxError);
    const cause=new Error('ENOENT');const e=assertError(()=>readJson('missing.json',()=>{throw cause;}),Error,'/','io');expect(e.cause).toBe(cause);
  });
  it('TC-CORPUS-002 synthetic complete single-observation stages and source ID error context',()=>{
    corpusStages([clone(SYN_OBSERVATION)],[clone(SYN_APPROVAL)],CTX);
    const o=edit(SYN_OBSERVATION,['temperatureC'],'bad');assertError(()=>corpusStages([o],[SYN_APPROVAL],CTX),TypeError,'/observations/0/temperatureC','wrong-type',ID);
    for(const v of ['bad',null])assertError(()=>sourceValues(edit(SYN_OBSERVATION,['growthTimeSeconds'],v),CTX,''),TypeError,'/growthTimeSeconds','wrong-type');
    assertError(()=>locator(edit(SYN_OBSERVATION,['locator','pagePanelOrdinal'],Number.MAX_SAFE_INTEGER+1),CTX,''),RangeError,'/locator/pagePanelOrdinal','unsafe-integer');
    assertError(()=>sourceValues(edit(SYN_OBSERVATION,['rawLabels','temperature'],''),CTX,''),RangeError,'/rawLabels/temperature','empty-string');
  });
  it('TC-CORPUS-003 synthetic duplicate token precedes count; root unknown precedes count; count precedes identity',()=>{
    assertError(()=>validateCorpusV1(parseJsonRejectingDuplicateKeys('{"schemaVersion":1,"schemaVersion":2,"observations":[]}')),SyntaxError,'/schemaVersion','duplicate-key');
    assertError(()=>validateCorpusV1({...schemaOnlyCorpus(),extra:true,observations:Array(205).fill(SYN_OBSERVATION)}),TypeError,'/extra','unknown-property');
    for(const n of [205,207])assertError(()=>validateCorpusV1({...schemaOnlyCorpus(),observations:Array(n).fill(SYN_OBSERVATION)}),RangeError,'/observations','wrong-count');
    const o=edit(SYN_OBSERVATION,['rawLabels','temperature'],'');assertError(()=>corpusStages([SYN_OBSERVATION,o],[],CTX),RangeError,'/observations/1/sourceObservationId','duplicate-id');
  });
  it('TC-CORPUS-003 synthetic unit, uncertainty, transcription, approval, raw and interval stage precedence',()=>{
    let o=edit(SYN_OBSERVATION,['temperatureC'],-14);object(o.sourceUncertainty).temperaturePlusMinusC=0.3;
    assertError(()=>corpusStages([o],[SYN_APPROVAL],CTX),RangeError,'/observations/0/temperatureC','unit-mismatch');
    o=edit(SYN_OBSERVATION,['sourceUncertainty','temperaturePlusMinusC'],0.3);object(o.transcription).auditStatus='pending';
    assertError(()=>corpusStages([o],[SYN_APPROVAL],CTX),RangeError,'/observations/0/sourceUncertainty/temperaturePlusMinusC','constant-mismatch');
    o=edit(SYN_OBSERVATION,['transcription','auditStatus'],'pending');object(object(o.morphology).final).growthAxis='bad';
    assertError(()=>corpusStages([o],[SYN_APPROVAL],CTX),RangeError,'/observations/0/transcription','unresolved-audit');
    o=clone(SYN_OBSERVATION);o.projectedShape=edit(SYN_PROJECTED,['inverseCircularity','low'],99);
    assertError(()=>corpusStages([o],[],CTX),RangeError,'/annotationApprovals','annotation-approval');
    object(object(o.projectedShape).extractionA).rawInverseCircularity=99;
    assertError(()=>corpusStages([o],[SYN_APPROVAL],CTX),RangeError,'/observations/0/projectedShape/extractionA/rawInverseCircularity','recalculation-mismatch');
  });
  it('TC-CORPUS-002 synthetic complete recursive structural literal',()=>corpusRule(schemaOnlyCorpus(),CTX,''));
  const corpusNullable=walk(schemaOnlyCorpus()).filter(({path,value})=>value===null||['reason','maskUsabilityReason','armUsabilityReason'].includes(String(path.at(-1)))).map(({path})=>pointer(path)).concat(['/observations/0/morphology/annotatorA/basalBranchingLevel','/observations/0/morphology/annotatorB/basalBranchingLevel','/observations/0/morphology/final/basalBranchingLevel']);
  schemaMutations('TC-CORPUS-002',schemaOnlyCorpus(),corpusRule,corpusNullable);
});

describe('TC-SOURCE synthetic source contracts',()=>{
  it('TC-SOURCE-001 synthetic page-local IDs, uniqueness, gaps and crop-box boundary',()=>{
    locator(SYN_OBSERVATION,CTX,'');
    const other=edit(SYN_OBSERVATION,['sourceObservationId'],'L23-F2-P11-N002');object(other.locator).pagePanelOrdinal=2;object(other.locator).panelBoundsPdfPt=[50,20,30,40];identities([SYN_OBSERVATION,other],CTX);
    for(const page of [12,13,14]){const x=edit(SYN_OBSERVATION,['sourceObservationId'],`L23-F2-P${page}-N001`);object(x.locator).pdfPage=page;object(x.locator).panelBoundsPdfPt=[50,page*2,30,40];identities([SYN_OBSERVATION,x],CTX);}
    const duplicateLocator=edit(other,['locator','pagePanelOrdinal'],1);assertError(()=>identities([SYN_OBSERVATION,duplicateLocator],CTX),RangeError,'/observations/1/locator','duplicate-locator');
    const duplicateBounds=edit(other,['locator','panelBoundsPdfPt'],[10,20,30,40]);assertError(()=>identities([SYN_OBSERVATION,duplicateBounds],CTX),RangeError,'/observations/1/locator/panelBoundsPdfPt','duplicate-bounds');
    for(const n of [3,4]){const gap=edit(other,['sourceObservationId'],`L23-F2-P11-N00${n}`);object(gap.locator).pagePanelOrdinal=n;assertError(()=>identities([SYN_OBSERVATION,gap],CTX),RangeError,'/observations','ordinal-gap');}
    for(const bounds of [[-1,20,30,40],[10,-1,30,40],[600,20,30,40],[10,780,30,40]])assertError(()=>locator(edit(SYN_OBSERVATION,['locator','panelBoundsPdfPt'],bounds),CTX,''),RangeError,'/locator/panelBoundsPdfPt','crop-box');
    for(const n of [0,Number.MAX_SAFE_INTEGER+1])expect(()=>locator(edit(SYN_OBSERVATION,['locator','pagePanelOrdinal'],n),CTX,'')).toThrow(RangeError);
    expect(()=>locator(edit(SYN_OBSERVATION,['sourceObservationId'],'L23-F2-P12-N001'),CTX,'')).toThrow(RangeError);
  });
  for(const [key,raw,w]of [['temperature','-15.0 °C',-15],['supersaturation','12.5 %',12.5],['growthTime','2 min',120],['growthTime','120 s',120],['squareFieldOfView','0.40 mm',400],['squareFieldOfView','400 µm',400]] as const)it(`TC-SOURCE-002 synthetic rational ${raw}`,()=>expect(decimalUnit(raw,key)).toBe(w));
  it('TC-SOURCE-002 synthetic zero negative implicit and unknown time/FOV units',()=>{
    for(const key of ['growthTime','squareFieldOfView'])for(const raw of ['0','-1','1','2 hours','2 nm',key==='growthTime'?'0 s':'0 µm',key==='growthTime'?'-1 min':'-1 mm'])assertError(()=>decimalUnit(raw,key),RangeError,'/','unit-or-domain');
  });
  it('TC-SOURCE-003 synthetic inclusive product-domain boundary and no clamping',()=>{
    for(const [t,s,inside]of [[-30,0,true],[0,30,true],[-30.000000000000004,0,false],[0,30.000000000000004,false]] as const){const o=clone(SYN_OBSERVATION);o.temperatureC=t;o.supersaturationPct=s;o.inProductDomain=inside;o.exclusionReason=inside?null:'outside-product-domain';object(o.rawLabels).temperature=`${t} °C`;object(o.rawLabels).supersaturation=`${s} %`;sourceValues(o,CTX,'');domain(o,CTX,'');if(!inside){o.temperatureC=Math.max(-30,t);o.supersaturationPct=Math.min(30,s);expect(()=>sourceValues(o,CTX,'')).toThrow(RangeError);}}
    for(const key of ['growthTime','squareFieldOfView'])for(const wrong of [0.2,'±0.2 °C'])expect(()=>sourceUncertainty(edit(SYN_OBSERVATION,['sourceUncertainty',key],wrong),CTX,'')).toThrow();
    for(const [key,w]of [['temperaturePlusMinusC',0.3],['supersaturationFactorRange',[0.8,1.3]]] as Array<[string,Json]>)expect(()=>sourceUncertainty(edit(SYN_OBSERVATION,['sourceUncertainty',key],w),CTX,'')).toThrow(RangeError);
  });
  it('TC-SOURCE-004 synthetic agreed, raw-only and normalized-only adjudication with final conversion',()=>{
    transcript(SYN_OBSERVATION,CTX,'');
    for(const [field,value]of [['raw','120 s'],['normalized',121]] as Array<[string,Json]>){const o=edit(SYN_OBSERVATION,['transcription','transcriberB','growthTime',field],value);if(field==='normalized')object(object(object(o.transcription).transcriberB).growthTime).raw='121 s';assertError(()=>transcript(o,CTX,''),RangeError,'/transcription','unresolved-audit');object(o.transcription).auditStatus='adjudicated';object(o.transcription).adjudicationNote='Synthetic adjudicator checked source label.';transcript(o,CTX,'');assertError(()=>transcript(edit(o,['transcription','adjudicationNote'],''),CTX,''),RangeError,'/transcription/adjudicationNote','empty-string');assertError(()=>transcript(edit(o,['transcription','adjudicationNote'],null),CTX,''),RangeError,'/transcription','unresolved-audit');}
    for(const state of ['pending','adjudicated'])assertError(()=>transcript(edit(SYN_OBSERVATION,['transcription','auditStatus'],state),CTX,''),RangeError,'/transcription','unresolved-audit');
    assertError(()=>transcript(edit(SYN_OBSERVATION,['transcription','sourceCheckedAgainstPdfSha256'],'0'.repeat(64)),CTX,''),RangeError,'/transcription/sourceCheckedAgainstPdfSha256','literal-mismatch');
    assertError(()=>sourceValues(edit(SYN_OBSERVATION,['growthTimeSeconds'],121),CTX,''),RangeError,'/growthTimeSeconds','unit-mismatch');
  });
});

describe('TC-ANNOTATION synthetic approval contract',()=>{
  it('TC-ANNOTATION-001 synthetic exact high batch and individual medium/low/disagreement',()=>{
    morphology(SYN_OBSERVATION.morphology);approvals([SYN_OBSERVATION],[SYN_APPROVAL]);
    for(const [a,b]of [['medium','medium'],['high','medium'],['low','low'],['high','low']]){const o=clone(SYN_OBSERVATION),m=object(o.morphology);object(m.annotatorA).confidence=a!;object(m.annotatorB).confidence=b!;m.draftStatus=a===b?'exact-agreement':'different';m.adjudicationNote='Synthetic individual inspection';const approval=reapprove(o);morphology(m);approvals([o],[approval]);const wrong=reapprove(o,'batch-summary');assertError(()=>approvals([o],[wrong]),RangeError,'/annotationApprovals','annotation-approval');}
    for(const [field,v]of [['growthAxis','mixed'],['basalBranchingLevel',3],['hollowing','present']] as Array<[string,Json]>){const o=clone(SYN_OBSERVATION),m=object(o.morphology);object(m.annotatorB)[field]=v;m.draftStatus='different';m.final={growthAxis:'indeterminate',basalBranchingLevel:null,hollowing:'indeterminate',confidence:'low'};m.adjudicationNote='Cannot determine from synthetic projection';const a=reapprove(o);morphology(m);approvals([o],[a]);}
    for(const [path,v]of [[['draftStatus'],'different'],[['annotatorB','growthAxis'],'mixed']] as Array<[string[],Json]>)assertError(()=>morphology(edit(object(SYN_OBSERVATION.morphology),path,v)),RangeError,'/draftStatus','annotation-approval');
    for(const [key,v]of [['growthAxis','unknown'],['confidence','unknown'],['hollowing','unknown'],['basalBranchingLevel',4]] as Array<[string,Json]>)assertError(()=>voteRule(edit(VOTE,[key],v),CTX,''),TypeError,`/${key}`,'unknown-enum');
    const o=clone(SYN_OBSERVATION);object(object(o.morphology).final).growthAxis='mixed';const a=reapprove(o,'batch-summary');assertError(()=>approvals([o],[a]),RangeError,'/annotationApprovals','annotation-approval');
    for(const value of ['',null]){const o=clone(SYN_OBSERVATION);object(o.morphology).adjudicationNote=value;const a=reapprove(o);assertError(()=>approvals([o],[a]),RangeError,'/annotationApprovals','annotation-approval');}
  });
  it('TC-ANNOTATION-002 synthetic exact independent JCS hash literals and PII/UTC rejection',()=>{
    expect(digest([ID])).toBe('0446f0d4af4ae33312f7726af9e436750e0886a33540df8783ca837c80015c6b');expect(digest([[ID,VOTE,VOTE]])).toBe('53aafe785f93df225e57b08dbf502c37864e334ebeabfda5b9682dda6c787daf');expect(digest([[ID,VOTE]])).toBe('563192cd1f7ec3799a357c843aa269e6dc3e355eecdda500c464cb919e6cd873');expect(digest(without(SYN_APPROVAL,'approvalId'))).toBe(APPROVAL_ID);
    for(const time of ['2026-09-29T12:00:00.1Z','2026-09-29T12:00:00+00:00','2026-02-30T12:00:00Z'])assertError(()=>approvalRule({...SYN_APPROVAL,approvedAtUtc:time},CTX,''),RangeError,'/approvedAtUtc','invalid-utc');
    for(const pii of ['name','email','account','device'])assertError(()=>approvalRule({...SYN_APPROVAL,[pii]:'synthetic'},CTX,''),TypeError,`/${pii}`,'unknown-property');
  });
  it('TC-ANNOTATION-003 synthetic missing, duplicate, unknown and stale approval rejected before all consumers',()=>{
    for(const key of ['approvalId','targetIdSetSha256','draftAnnotationSetSha256','finalAnnotationSetSha256'])assertError(()=>approvals([SYN_OBSERVATION],[{...SYN_APPROVAL,[key]:'0'.repeat(64)}]),RangeError,'/annotationApprovals','annotation-approval');
    assertError(()=>approvals([SYN_OBSERVATION],[]),RangeError,'/annotationApprovals','annotation-approval');
    assertError(()=>approvals([SYN_OBSERVATION],[SYN_APPROVAL,SYN_APPROVAL]),RangeError,'/annotationApprovals','annotation-approval');
    assertError(()=>approvals([SYN_OBSERVATION],[{...SYN_APPROVAL,targetSourceObservationIds:['L23-F2-P11-N999']}]),RangeError,'/annotationApprovals','annotation-approval');
    assertError(()=>approvals([edit(SYN_OBSERVATION,['morphology','approvalId'],'0'.repeat(64))],[SYN_APPROVAL]),RangeError,'/annotationApprovals','annotation-approval');
    for(const consumer of ['scoreTraining','baseline','candidate-ranking','split-loss','holdout']){const compute=vi.fn();const guarded=()=>{approvals([SYN_OBSERVATION],[]);compute(consumer,[]);};assertError(guarded,RangeError,'/annotationApprovals','annotation-approval');expect(compute).not.toHaveBeenCalled();}
  });
  schemaMutations('TC-ANNOTATION-002',SYN_APPROVAL,approvalRule);
  schemaMutations('TC-ANNOTATION-001',object(SYN_OBSERVATION.morphology),morphologyRule,['/annotatorA/basalBranchingLevel','/annotatorB/basalBranchingLevel','/final/basalBranchingLevel']);
});

describe('TC-SHAPE synthetic extraction contract',()=>{
  it('TC-SHAPE-001 synthetic uint32 LE row-major mask byte contract',()=>{
    expect([...maskBytes(2,2,[1,1,1,1])]).toEqual([2,0,0,0,2,0,0,0,1,1,1,1]);
    expect(sha(maskBytes(2,2,[1,1,1,1]))).toBe('66ad96f0cffebe842cc5d3b24a8c8aac3bc21b781aa3d3e749c3b2d62e884030');
    expect(sha(maskBytes(3,3,[1,1,1,1,1,1,1,1,1]))).toBe('a0a7f65a1e81907621d6dc7c9acd606e445022041cd91ac82af733f3f73e37a1');
    const good=maskBytes(2,2,[1,0,1,1]),be=good.slice();new DataView(be.buffer).setUint32(0,2,false);new DataView(be.buffer).setUint32(4,2,false);
    for(const wrong of [be,maskBytes(2,2,[1,1,1,0]),new Uint8Array([...good.slice(0,8),0b1011]),new Uint8Array([...good.slice(0,8),255,255,255,255,0,0,0,255,255,255,255,255,255,255,255,255])])expect(sha(wrong)).not.toBe(sha(good));
    for(const width of [0,-1,2**32,1.5])expect(()=>maskBytes(width,2,[1,1,1,1])).toThrow(RangeError);
    expect(()=>maskBytes(2,2,[1,2,1,1])).toThrow(RangeError);
  });
  it('TC-SHAPE-002 synthetic approved SYN-EA/SYN-EB raw literals and exact A/B intervals',()=>{
    expect(extraction(SYN_EA)).toEqual([1.2732395447351628,0.051582744513315945,1]);
    expect(extraction(SYN_EB)).toEqual([1.2732395447351628,0,0.5]);validateProjected(SYN_PROJECTED);
    for(const key of RAW_FEATURES){const x=clone(SYN_EA);x[key]=number(x[key])+1e-10;assertError(()=>extraction(x),RangeError,`/${key}`,'recalculation-mismatch');}
    const small=clone(SYN_EA);small.rawInverseCircularity=number(small.rawInverseCircularity)+32*Number.EPSILON;extraction(small);
    const large=clone(SYN_EA);large.rawInverseCircularity=number(large.rawInverseCircularity)+256*Number.EPSILON;expect(()=>extraction(large)).toThrow(RangeError);
    const shifted=edit(SYN_PROJECTED,['inverseCircularity','low'],1.2732395447351628+Number.EPSILON);assertError(()=>validateProjected(shifted),RangeError,'/inverseCircularity','interval-mismatch');
  });
  for(const [path,value]of [
    [['rasterWidthPx'],2**32],[['rasterHeightPx'],0],[['foregroundPixelCount'],Number.MAX_SAFE_INTEGER+1],[['fourNeighborPerimeterEdges'],Number.MAX_SAFE_INTEGER+1],
    [['foregroundCentroidPx'],[-1,1]],[['populationCovariancePx2','xx'],-1],[['populationCovariancePx2','xy'],-1],[['populationCovariancePx2','yy'],Infinity],
    [['eigenvaluesPx2'],[1,0]],[['eigenvaluesPx2'],[0,0]],[['eigenvaluesPx2'],[0.2,0.3]],
    [['centerPx'],[5,5.5]],[['armEndpointsClockwisePx',0],[11.5,5.5]],[['armEndpointsClockwisePx',0],[7,5.5]],
    [['armEndpointsClockwisePx',1],[7.5,5.5]],[['armEndpointsClockwisePx',1],[8.5,5.5]],
    [['armEndpointsClockwisePx'],[[6.5,7.5],[7.5,5.5],[4.5,7.5],[3.5,5.5],[4.5,3.5],[6.5,3.5]]],
  ] as Array<[(string|number)[],Json]>)it(`TC-SHAPE-002 synthetic rejects ${pointer(path)}=${JSON.stringify(value)}`,()=>expect(()=>extraction(edit(SYN_EA,path,value))).toThrow(RangeError));
  it('TC-SHAPE-003 synthetic usable/null/reason and status-only audit agreement',()=>{
    validateProjected(SYN_PROJECTED);validateProjected(SYN_OBSERVATION.projectedShape);
    const b={...clone(SYN_EB),armStatus:'not-usable',armUsabilityReason:'endpoint-indeterminate',centerPx:null,armEndpointsClockwisePx:null,rawNormalizedArmLengthCv:null};
    const one:Obj={...clone(SYN_PROJECTED),extractionB:b,normalizedArmLengthCv:null,auditStatus:'adjudicated',adjudicationNote:'One synthetic endpoint is ambiguous.'};validateProjected(one);
    const both:Obj={...clone(one),extractionA:{...clone(SYN_EA),armStatus:'not-usable',armUsabilityReason:'endpoint-indeterminate',centerPx:null,armEndpointsClockwisePx:null,rawNormalizedArmLengthCv:null},auditStatus:'agreed',adjudicationNote:null};validateProjected(both);
    assertError(()=>validateProjected({...one,normalizedArmLengthCv:{low:0,high:0.051582744513315945}}),RangeError,'/normalizedArmLengthCv','interval-mismatch');
    for(const wrong of [{...one,auditStatus:'agreed',adjudicationNote:null},{...SYN_PROJECTED,auditStatus:'adjudicated',adjudicationNote:null}])assertError(()=>validateProjected(wrong),RangeError,'/','unresolved-audit');
    expect(()=>validateProjected({...object(SYN_OBSERVATION.projectedShape),status:'usable'})).toThrow(RangeError);
    for(const key of ['maskSha256','foregroundPixelCount','fourNeighborPerimeterEdges','foregroundCentroidPx','populationCovariancePx2','eigenvaluesPx2','rawInverseCircularity','rawMinorMajorAxisRatio','centerPx','armEndpointsClockwisePx','rawNormalizedArmLengthCv'])expect(()=>extraction({...SYN_EA,[key]:null})).toThrow(RangeError);
    for(const key of ['maskUsabilityReason','armUsabilityReason'])expect(()=>extraction({...SYN_EA,[key]:'occlusion'})).toThrow(RangeError);
    for(const [key,value]of [['maskSha256','a'.repeat(64)],['foregroundPixelCount',1],['rawNormalizedArmLengthCv',0]] as Array<[string,Json]>)expect(()=>extraction({...SYN_UNUSED,[key]:value})).toThrow(RangeError);
    expect(()=>extraction({...SYN_UNUSED,maskUsabilityReason:null})).toThrow(RangeError);
    expect(()=>extraction({...SYN_UNUSED,armStatus:'usable'})).toThrow(RangeError);
  });
  schemaMutations('TC-SHAPE-003',SYN_PROJECTED,projectedRule,walk(SYN_PROJECTED).filter(({path})=>['inverseCircularity','normalizedArmLengthCv','minorMajorAxisRatio','maskSha256','foregroundPixelCount','fourNeighborPerimeterEdges','foregroundCentroidPx','populationCovariancePx2','eigenvaluesPx2','centerPx','armEndpointsClockwisePx',...RAW_FEATURES].includes(String(path.at(-1)))).map(({path})=>pointer(path)));
});

// Structural audit fixture only. It deliberately has one entry and is NEVER passed as
// a positive SourceAuditV1/REAL206 oracle. Capture independence is a human process gate.
const SYN_AUDIT_STRUCTURE:Obj={schemaVersion:'snow-crystal-source-audit/1',corpusId:CORPUS_ID,sourcePdfSha256:PDF,auditMethod,candidateDrafts:{transcriberASetSha256:CANDIDATE_A,transcriberBSetSha256:CANDIDATE_B,comparisonSetSha256:COMPARISON,eachDraftObservationCount:206},priorHumanCaptureMigration:{sourceKind:'local-storage-human-source-audit-draft/1',sourceFileSha256:'9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c',entryObjectCount:33,migratedConfirmedCompleteCount:32,incompleteSourceObservationIds:['P11-N033'],migratedConfirmedIdSetSha256:'92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5',confirmedValuesOverwrittenDuringMigration:false,originalVerificationTimeKnown:false},pages:[{pdfPage:11,panelCount:1,sourceObservationIds:[ID]},{pdfPage:12,panelCount:0,sourceObservationIds:[]},{pdfPage:13,panelCount:0,sourceObservationIds:[]},{pdfPage:14,panelCount:0,sourceObservationIds:[]}],observations:[SYN_AUDIT_ENTRY],sourceEntrySetSha256:digest([SYN_AUDIT_ENTRY]),preAnnotationSplitAssignmentSha256:digest(SYN_ASSIGNMENT),canonicalCorpusSha256:digest(schemaOnlyCorpus()),auditPayloadSha256:'0'.repeat(64),approval:{decision:'approved',approverRole:'human-source-auditor',sourcePdfSha256:PDF,sourceEntrySetSha256:digest([SYN_AUDIT_ENTRY]),canonicalCorpusSha256:digest(schemaOnlyCorpus()),auditPayloadSha256:'0'.repeat(64),approvedAtUtc:'2026-10-08T12:00:00Z',note:null}};
SYN_AUDIT_STRUCTURE.auditPayloadSha256=digest(without(SYN_AUDIT_STRUCTURE,'auditPayloadSha256','approval'));object(SYN_AUDIT_STRUCTURE.approval).auditPayloadSha256=SYN_AUDIT_STRUCTURE.auditPayloadSha256;

describe('TC-SOURCE-AUDIT synthetic components; REAL206 alone is the source oracle',()=>{
  it('TC-SOURCE-AUDIT-001 synthetic entry literal and complete structural schema, not a complete corpus',()=>{
    auditEntry(SYN_AUDIT_ENTRY);auditRule(SYN_AUDIT_STRUCTURE,CTX,'');
    assertError(()=>validateSourceAuditV1(SYN_AUDIT_STRUCTURE,schemaOnlyCorpus(),SYN_ASSIGNMENT),RangeError,'/observations','wrong-count');
    for(const n of [205,207])assertError(()=>validateSourceAuditV1({...SYN_AUDIT_STRUCTURE,observations:Array(n).fill(SYN_AUDIT_ENTRY)},schemaOnlyCorpus(),SYN_ASSIGNMENT),RangeError,'/observations','wrong-count');
  });
  it('TC-SOURCE-AUDIT-002 preserves A/B JCS tuples and limits mu canonicalization',()=>{
    expect(CANDIDATE_A).toBe('de2d1e32eed414f020c1be76fc82b2209848da2b399aa1f00c96ecb55638f732');expect(CANDIDATE_B).toBe('b641538a2344cb348e62532cb6e48aaf3b9b5cf236fd703a51a7f1b3d9cdcfd3');expect(COMPARISON).toBe('33c545adebfae122fea0d84985445f60eeb7f17ed1e0e9ba2cb99d7a34b6bad9');
    const a:['123μm',number]=['123μm',123],b:['123µm',number]=['123µm',123];
    expect(comparedField('squareFieldOfView',a,b)).toEqual(['squareFieldOfView',a,b,'canonical-unit-equivalent',['123µm',123]]);
    expect(comparedField('squareFieldOfView',['123μm',123],['123μm',123])).toEqual(['squareFieldOfView',['123μm',123],['123μm',123],'exact',['123µm',123]]);
    for(const pair of [[['-3μC',-3],['-3µC',-3]],[['123μm ',123],['123µm ',123]],[['μ123m',123],['µ123m',123]]] as Array<[[string,number],[string,number]]>)expect(array(comparedField('squareFieldOfView',pair[0],pair[1]))[3]).toBe('different');
    expect(array(comparedField('temperature',['-3μC',-3],['-3µC',-3]))[4]).toBeNull();
    const row:CandidateRow=[ID,[11,1,[10,20,30,40]],[['temperature','-15.0 °C',-15],['supersaturation','12.5 %',12.5],['growthTime','2 min',120],['squareFieldOfView','0.40 mm',400]]];
    expect(candidatePreimage('A',[row])).toEqual({schemaVersion:'snow-crystal-source-candidate-set-hash-preimage/1',sourcePdfSha256:PDF,transcriberRole:'A',observations:[row]});
    expect(digest(candidatePreimage('A',[row]))).not.toBe(digest(candidatePreimage('B',[row])));
    expect(()=>comparisonPreimage([row],[row])).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-002 executes the frozen 206 A/B/comparison evidence and reaches each tuple guard',()=>{
    const aRows=frozenCandidateRows(),bRows=clone(aRows);for(const row of bRows)row[2][3]![1]=String(row[2][3]![1]).replace(/μm$/u,'µm');
    expect(aRows).toHaveLength(206);expect(digest(candidatePreimage('A',aRows))).toBe(CANDIDATE_A);expect(digest(candidatePreimage('B',bRows))).toBe(CANDIDATE_B);const comparison=comparisonPreimage(aRows,bRows);expect(digest(comparison)).toBe(COMPARISON);const kinds=array(comparison.observations).flatMap(row=>array(array(row)[1]).map(field=>array(field)[3]));expect(kinds.filter(x=>x==='exact')).toHaveLength(618);expect(kinds.filter(x=>x==='canonical-unit-equivalent')).toHaveLength(206);expect(kinds.filter(x=>x==='different')).toHaveLength(0);
    for(const bad of [edit(aRows,[0,0],'L23-F2-P11-N999'),edit(aRows,[0,1,0],12),edit(aRows,[0,2,0,0],'wrong'),edit(aRows,[0,2,0],['growthTime','-3C',-3]),edit(aRows,[0,2,0,1],-4)])expect(()=>comparisonPreimage(bad as CandidateRow[],bRows)).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-003 preserves the 32 human entries and rejects accidental overwrite',()=>{
    expect(SYN_AUDIT_STRUCTURE.priorHumanCaptureMigration).toMatchObject({entryObjectCount:33,migratedConfirmedCompleteCount:32,incompleteSourceObservationIds:['P11-N033'],confirmedValuesOverwrittenDuringMigration:false,originalVerificationTimeKnown:false});
    expect(digest(Array.from({length:32},(_,i)=>`L23-F2-P11-N${String(i+1).padStart(3,'0')}`))).toBe('92e23ab4ae1ea2b1406296a11e94ab519a1c020fb2a54559acf4b4bf0fbc6ea5');
    const prior=clone(SYN_AUDIT_ENTRY);object(prior.verification).fields=Object.fromEntries(SOURCE_KEYS.map(k=>[k,{candidateComparison:'exact',humanAction:'preserved-prior-human-confirmation',humanConfirmedRawAndNormalized:true,rationale:null}]));auditEntry(prior);
    expect(()=>auditEntry(edit(prior,['rawLabels','squareFieldOfView'],'0.41 mm'))).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-003 migrates only the byte-identical 32 confirmed backup entries atomically',()=>{
    const f=syntheticMigrationFixture(),state=new Map<string,Obj>(),before=clone(f.backup);
    const bytes=new TextEncoder().encode(JSON.stringify(f.backup)),syntheticHash=sha(bytes);
    expect(BACKUP_HASH).toBe('9fd9708029f553e386dfd2dece8df5f8237d5c8b586502d90bfbe93b8bb47f0c');
    assertError(()=>readPriorCaptureForOracle(bytes),RangeError,'/sourceFileSha256','backup-hash-mismatch');
    const parsed=readPriorCaptureForOracle(bytes,syntheticHash);
    assertError(()=>readPriorCaptureForOracle(new TextEncoder().encode(JSON.stringify(edit(f.backup,['entries','P11-N001','rawSquareFieldOfView'],'1164µm'))),syntheticHash),RangeError,'/sourceFileSha256','backup-hash-mismatch');
    const hashFailureState=new Map<string,Obj>();assertError(()=>migrateAuthenticatedPriorCaptureForOracle(bytes,f.aRows,f.bRows,f.locators,hashFailureState,f.manifest,f.recordedAtUtc),RangeError,'/sourceFileSha256','backup-hash-mismatch');expect(hashFailureState.size).toBe(0);
    migrateAuthenticatedPriorCaptureForOracle(bytes,f.aRows,f.bRows,f.locators,state,f.manifest,f.recordedAtUtc,syntheticHash);
    expect([...state.keys()]).toEqual(migrationIds());expect(state.has('L23-F2-P11-N033')).toBe(false);expect(digest([...state.keys()])).toBe(MIGRATED_HASH);
    const bindings={comparison:comparisonMap(f.aRows,f.bRows),prior:state};
    for(const [id,after]of state){
      const original=object(object(before.entries)[id.slice('L23-F2-'.length)]),copy:Obj={rawLabels:Object.fromEntries(SOURCE_KEYS.map((key,i)=>[key,original[BACKUP_RAW_KEYS[i]!]!])),normalizedSourceValues:Object.fromEntries(NORMAL_KEYS.map(key=>[key,original[key]!]))};
      expect(sourceTupleFingerprint(after)).toEqual(sourceTupleFingerprint(copy));
      for(const [i,key]of SOURCE_KEYS.entries()){
        const raw=string(object(after.rawLabels)[key]),n=number(object(after.normalizedSourceValues)[NORMAL_KEYS[i]!]);
        expect(utf8(raw)).toEqual(utf8(string(original[BACKUP_RAW_KEYS[i]!]))) ;expect(codeUnits(raw)).toEqual(codeUnits(string(original[BACKUP_RAW_KEYS[i]!]))) ;
        expect(Object.is(n,original[NORMAL_KEYS[i]!])).toBe(true);expect(binary64Bits(n)).toBe(binary64Bits(number(original[NORMAL_KEYS[i]!])));
        expect(object(object(object(after.verification).fields)[key])).toMatchObject({humanAction:'preserved-prior-human-confirmation',humanConfirmedRawAndNormalized:true,rationale:null});
      }
      expect(after.locator).toEqual({pdfPage:11,pagePanelOrdinal:Number(id.slice(-3)),panelBoundsPdfPt:f.locators.get(id)![2]});
      expect(object(after.verification).verificationRecordedAtUtc).toBe('2026-10-09T00:00:00Z');auditEntry(after,CTX,'',bindings);
      assertError(()=>auditEntry(edit(after,['rawLabels','squareFieldOfView'],'1164µm'),CTX,'',bindings),RangeError,'/verification/fields/squareFieldOfView','prior-pair-mismatch');
      const overwritten=edit(after,['rawLabels','growthTime'],'83sec');object(overwritten.normalizedSourceValues).growthTimeSeconds=83;
      assertError(()=>auditEntry(overwritten,CTX,'',bindings),RangeError,'/verification/fields/growthTime','prior-pair-mismatch');
      assertError(()=>auditEntry(edit(after,['verification','fields','growthTime','humanAction'],'confirmed-proposal'),CTX,'',bindings),RangeError,'/verification/fields/growthTime/humanAction','prior-action-mismatch');
    }
    expect(f.backup).toEqual(before);expect(f.aRows[0]![2][3][1]).toBe('1164μm');expect(f.bRows[0]![2][3][1]).toBe('1164µm');
    const unchanged=canonicalizeForOracle([...state]);assertError(()=>migratePriorCaptureForOracle(parsed,f.aRows,f.bRows,f.locators,state,f.manifest,f.recordedAtUtc),RangeError,'/entries/P11-N001','migration-conflict');expect(canonicalizeForOracle([...state])).toBe(unchanged);
  });
  it('TC-SOURCE-AUDIT-003 each rejection reaches its own condition from an empty state',()=>{
    const variants:Array<{change:(f:ReturnType<typeof syntheticMigrationFixture>)=>void;C:ErrorClass;p:string;reason:string}>=[
      {change:f=>{f.backup.version=2;},C:RangeError,p:'/version',reason:'backup-version-mismatch'},
      {change:f=>{f.backup.role='A';},C:RangeError,p:'/role',reason:'backup-role-mismatch'},
      {change:f=>{delete object(f.backup.entries)['P11-N001'];},C:RangeError,p:'/entries',reason:'wrong-count'},
      {change:f=>{object(f.backup.entries)['P11-N034']=clone(object(f.backup.entries)['P11-N033']!);},C:RangeError,p:'/entries',reason:'wrong-count'},
      {change:f=>{object(object(f.backup.entries)['P11-N001']).confirmed=false;},C:RangeError,p:'/entries/P11-N001/confirmed',reason:'not-confirmed'},
      {change:f=>{object(object(f.backup.entries)['P11-N032']).confirmed=false;},C:RangeError,p:'/entries/P11-N032/confirmed',reason:'not-confirmed'},
      {change:f=>{object(object(f.backup.entries)['P11-N001']).rawGrowthTime='';},C:RangeError,p:'/entries/P11-N001/rawGrowthTime',reason:'empty-string'},
      ...[NaN,Infinity,-Infinity,-0].map(n=>({change:(f:ReturnType<typeof syntheticMigrationFixture>)=>{object(object(f.backup.entries)['P11-N001']).growthTimeSeconds=n;},C:RangeError,p:'/entries/P11-N001/growthTimeSeconds',reason:Object.is(n,-0)?'negative-zero':'non-finite'})),
      {change:f=>{object(object(f.backup.entries)['P11-N001']).growthTimeSeconds=83;},C:RangeError,p:'/entries/P11-N001',reason:'unit-mismatch'},
      {change:f=>{const e=object(object(f.backup.entries)['P11-N001']);e.growthTimeSeconds=83;e.rawGrowthTime='83sec';},C:RangeError,p:'/entries/P11-N001',reason:'candidate-normalized-mismatch'},
      {change:f=>{object(object(f.backup.entries)['P11-N001']).rawGrowthTime='82 sec';},C:RangeError,p:'/entries/P11-N001',reason:'candidate-raw-mismatch'},
      {change:f=>{object(object(f.backup.entries)['P11-N002']).extra='pii';},C:TypeError,p:'/entries/P11-N002/extra',reason:'unknown-property'},
      {change:f=>{delete object(object(f.backup.entries)['P11-N002']).temperatureC;},C:TypeError,p:'/entries/P11-N002/temperatureC',reason:'missing-property'},
      {change:f=>{const e=object(f.backup.entries);e['L23-F2-P11-N001']=e['P11-N001']!;delete e['P11-N001'];},C:RangeError,p:'/entries/L23-F2-P11-N001',reason:'unknown-backup-id'},
      {change:f=>{const e=object(f.backup.entries);e['P11-N999']=e['P11-N001']!;delete e['P11-N001'];},C:RangeError,p:'/entries/P11-N999',reason:'unknown-backup-id'},
      {change:f=>{const e=object(f.backup.entries);e['P11-N01']=e['P11-N001']!;delete e['P11-N001'];},C:RangeError,p:'/entries/P11-N01',reason:'unknown-backup-id'},
      {change:f=>{f.aRows.push(clone(f.aRows[0]!));},C:RangeError,p:'/candidateDrafts',reason:'duplicate-id'},
      {change:f=>{f.aRows.shift();},C:RangeError,p:'/entries/P11-N001',reason:'unknown-candidate-id'},
      {change:f=>{f.locators.delete(ID);},C:RangeError,p:'/entries/P11-N001',reason:'unknown-candidate-id'},
      {change:f=>{f.bRows[31]![1][2][0]+=1;},C:RangeError,p:'/entries/P11-N032',reason:'locator-mismatch'},
      {change:f=>{object(object(f.backup.entries)['P11-N033']).confirmed=true;},C:RangeError,p:'/entries/P11-N033',reason:'incomplete-migrated'},
      {change:f=>{object(object(f.backup.entries)['P11-N033']).rawGrowthTime='82sec';},C:RangeError,p:'/entries/P11-N033',reason:'incomplete-entry-filled'},
    ];
    for(const mutation of variants){const f=syntheticMigrationFixture(),state=new Map<string,Obj>(),snapshot=canonicalizeForOracle([...state]);mutation.change(f);assertError(()=>migratePriorCaptureForOracle(f.backup,f.aRows,f.bRows,f.locators,state,f.manifest,f.recordedAtUtc),mutation.C,mutation.p,mutation.reason);expect(canonicalizeForOracle([...state])).toBe(snapshot);}
    const f=syntheticMigrationFixture(),duplicate=JSON.stringify(f.backup).replace('"version":1','"version":1,"version":1'),bytes=new TextEncoder().encode(duplicate);assertError(()=>readPriorCaptureForOracle(bytes,sha(bytes)),SyntaxError,'/version','duplicate-key');
    const duplicateEntry=JSON.stringify(f.backup).replace('"entries":{','"entries":{"P11-N001":null,'),entryBytes=new TextEncoder().encode(duplicateEntry);assertError(()=>readPriorCaptureForOracle(entryBytes,sha(entryBytes)),SyntaxError,'/entries/P11-N001','duplicate-key');
    for(const [key,value]of [['sourceFileSha256','f'.repeat(64)],['entryObjectCount',32],['migratedConfirmedCompleteCount',31],['migratedConfirmedIdSetSha256','f'.repeat(64)],['confirmedValuesOverwrittenDuringMigration',true],['originalVerificationTimeKnown',true]] as Array<[string,Json]>){const state=new Map<string,Obj>();assertError(()=>migratePriorCaptureForOracle(f.backup,f.aRows,f.bRows,f.locators,state,{...f.manifest,[key]:value},f.recordedAtUtc),RangeError,`/priorHumanCaptureMigration/${key}`,'literal-mismatch');expect(state.size).toBe(0);}
  });
  it('TC-SOURCE-AUDIT-004 frozen candidates, prior 128 fields and remaining 696 fields export with reader zero',()=>{
    const state=humanWorkflowFixture(),reader=vi.fn(()=>{throw new Error('production corpus forbidden during human confirmation');});
    expect(state.migrated.size).toBe(32);expect(state.events.filter(([,e])=>e.origin==='prior')).toHaveLength(128);expect(state.events.filter(([,e])=>e.origin==='new')).toHaveLength(696);
    verifyHumanWorkflow(state,reader);const exported=exportVerifiedAudit(state,reader);expect(state.exported).toBe(true);expect(array(exported.observations)).toHaveLength(206);expect(reader).toHaveBeenCalledTimes(0);
    // Post-export uses a new fixture, a new spy and no object/cache references
    // from the confirmation fixture. The expected audit is immutable here.
    const afterExport=clone(exported),postState:Obj={observations:array(afterExport.observations).map(v=>{const o=object(v);return {...object(o.normalizedSourceValues),sourceObservationId:o.sourceObservationId!,locator:clone(o.locator!),rawLabels:clone(o.rawLabels!)};})},postReader=vi.fn(()=>clone(postState));
    expect(afterExport).not.toBe(exported);expect(postReader).not.toBe(reader);verifyExportedAuditAgainstCorpus(afterExport,postReader);expect(postReader).toHaveBeenCalledTimes(1);expect(reader).toHaveBeenCalledTimes(0);
    const wrongPostState=edit(postState,['observations',0,'rawLabels','growthTime'],'999sec'),wrongPostReader=vi.fn(()=>clone(wrongPostState));assertError(()=>verifyExportedAuditAgainstCorpus(clone(exported),wrongPostReader),RangeError,'/observations','source-audit-mismatch');expect(wrongPostReader).toHaveBeenCalledTimes(1);expect(reader).toHaveBeenCalledTimes(0);
  });
  it('TC-SOURCE-AUDIT-004 individual freeze, completeness, timing, active-action and persistence mutations are reachable',()=>{
    const variants:Array<{change:(s:WorkflowState)=>void;p:string;reason:string}>=[
      ...(['aFrozen','bFrozen','comparisonFrozen'] as const).map(key=>({change:(s:WorkflowState)=>{s[key]=false;},p:'/candidateDrafts',reason:'candidates-not-frozen'})),
      ...(['aRows','bRows'] as const).map(key=>({change:(s:WorkflowState)=>{s[key].pop();},p:'/candidateDrafts',reason:'wrong-count'})),
      ...(['transcriberASetSha256','transcriberBSetSha256','comparisonSetSha256'] as const).map(key=>({change:(s:WorkflowState)=>{s.drafts[key]='f'.repeat(64);},p:`/candidateDrafts/${key}`,reason:'hash-mismatch'})),
      {change:s=>{s.drafts.eachDraftObservationCount=207;},p:'/candidateDrafts/eachDraftObservationCount',reason:'wrong-count'},
      {change:s=>{s.migrated.delete(ID);},p:'/migration',reason:'migration-id-set-mismatch'},
      {change:s=>{object(s.migrated.get(ID)!.rawLabels).squareFieldOfView=canonicalFovRaw(string(object(s.migrated.get(ID)!.rawLabels).squareFieldOfView));},p:'/migration',reason:'migration-copy-mismatch'},
      {change:s=>{s.events=s.events.filter(([key])=>key!==`${ID}/temperature`);},p:'/verification',reason:'incomplete-human-verification'},
      {change:s=>{s.events.find(([key])=>key===`${ID}/temperature`)![0]='L23-F2-P11-N999/temperature';},p:'/verification',reason:'unknown-panel-or-field'},
      {change:s=>{s.events.find(([key])=>key===`${ID}/temperature`)![0]=`${ID}/unknown`;},p:'/verification',reason:'unknown-panel-or-field'},
      {change:s=>{s.entries.delete(ID);},p:'/verification',reason:'incomplete-human-verification'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').sourcePanelVisibleAt=3;},p:'/verification',reason:'pdf-not-visible-with-candidate'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').sourcePanelVisibleAt=NaN;},p:'/verification',reason:'pdf-not-visible-with-candidate'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').sourcePdfSha256='f'.repeat(64);},p:'/verification',reason:'source-pdf-mismatch'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').sourceLocator[2][0]+=1;},p:'/verification',reason:'source-locator-mismatch'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').explicitRawAction=false;},p:'/verification',reason:'incomplete-human-verification'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').explicitNormalizedAction=false;},p:'/verification',reason:'incomplete-human-verification'},
      {change:s=>{workflowEvent(s,'L23-F2-P11-N033/temperature').persisted=false;},p:'/verification',reason:'unsaved-human-verification'},
      {change:s=>{workflowEvent(s,`${ID}/temperature`).origin='new';},p:'/verification',reason:'confirmation-origin-mismatch'},
    ];
    for(const mutation of variants){const s=humanWorkflowFixture(),reader=vi.fn(()=>{throw new Error('forbidden reader');});mutation.change(s);assertError(()=>verifyHumanWorkflow(s,reader),RangeError,mutation.p,mutation.reason);assertError(()=>exportVerifiedAudit(s,reader),RangeError,mutation.p,mutation.reason);expect(s.exported).toBe(false);expect(reader).toHaveBeenCalledTimes(0);}
  });
  it('TC-SOURCE-AUDIT-004 rejects duplicate panel/field history before export without reading production corpus',()=>{
    for(const key of [`${ID}/temperature`,'L23-F2-P11-N033/growthTime']){
      const state=humanWorkflowFixture(),reader=vi.fn(()=>{throw new Error('forbidden reader');});
      state.events.push([key,clone(workflowEvent(state,key))]);
      expect(state.events).toHaveLength(825);expect(state.events.filter(([eventKey])=>eventKey===key)).toHaveLength(2);
      assertError(()=>verifyHumanWorkflow(state,reader),RangeError,'/verification','duplicate-human-verification');
      assertError(()=>exportVerifiedAudit(state,reader),RangeError,'/verification','duplicate-human-verification');
      expect(state.exported).toBe(false);expect(reader).toHaveBeenCalledTimes(0);
    }
  });
  it('TC-SOURCE-AUDIT-004 action table joins each final field to comparison, proposal or original backup',()=>{
    const row:CandidateRow=[ID,[11,1,[10,20,30,40]],[['temperature','-15.0 °C',-15],['supersaturation','12.5 %',12.5],['growthTime','2 min',120],['squareFieldOfView','0.40 mm',400]]];
    const frozenBefore=digest(candidatePreimage('A',[row]));
    const exact:ActionBindings={comparison:comparisonMap([row],[clone(row)]),prior:new Map()};auditEntry(SYN_AUDIT_ENTRY,CTX,'',exact);
    const corrections:[string,number,string][]=[['-3C',-3,'A/Bのtemperature rawが異なり、原PDFでは-3Cと読める'],['13%',13,'原PDFではsupersaturationは13%と読める'],['82sec',82,'原PDFではgrowthTimeは82secと読める'],['401µm',401,'原PDFではsquareFieldOfViewは401µmと読める']];
    for(const [i,key]of SOURCE_KEYS.entries()){
      const p=`/verification/fields/${key}`,corrected=clone(SYN_AUDIT_ENTRY),[raw,n,rationale]=corrections[i]!;
      object(corrected.rawLabels)[key]=raw;object(corrected.normalizedSourceValues)[NORMAL_KEYS[i]!]=n;domain(object(corrected.normalizedSourceValues),CTX,'');
      object(object(object(corrected.verification).fields)[key]).humanAction='corrected-proposal';object(object(object(corrected.verification).fields)[key]).rationale=rationale;auditEntry(corrected,CTX,'',exact);
      assertError(()=>auditEntry(edit(corrected,['verification','fields',key,'humanAction'],'confirmed-proposal'),CTX,'',exact),RangeError,p+'/rationale','rationale-mismatch');
      const wrongConfirm=edit(corrected,['verification','fields',key,'rationale'],null);object(object(object(wrongConfirm.verification).fields)[key]).humanAction='confirmed-proposal';assertError(()=>auditEntry(wrongConfirm,CTX,'',exact),RangeError,p+'/humanAction','proposal-action-mismatch');
      const unchangedCorrection=edit(SYN_AUDIT_ENTRY,['verification','fields',key,'humanAction'],'corrected-proposal');object(object(object(unchangedCorrection.verification).fields)[key]).rationale=rationale;assertError(()=>auditEntry(unchangedCorrection,CTX,'',exact),RangeError,p+'/humanAction','proposal-action-mismatch');
      const resolvedExact=edit(SYN_AUDIT_ENTRY,['verification','fields',key,'humanAction'],'resolved-disagreement');object(object(object(resolvedExact.verification).fields)[key]).rationale=rationale;assertError(()=>auditEntry(resolvedExact,CTX,'',exact),RangeError,p+'/humanAction','proposal-action-mismatch');
      assertError(()=>auditEntry(edit(corrected,['verification','fields',key,'rationale'],'  \t\n'),CTX,'',exact),RangeError,p+'/rationale','rationale-required');
      assertError(()=>auditEntry(edit(SYN_AUDIT_ENTRY,['verification','fields',key,'humanAction'],'preserved-prior-human-confirmation'),CTX,'',exact),RangeError,p+'/humanAction','missing-prior-confirmation');
      assertError(()=>auditEntry(edit(SYN_AUDIT_ENTRY,['verification','fields',key,'candidateComparison'],'different'),CTX,'',exact),RangeError,p+'/candidateComparison','comparison-mismatch');
      const other=clone(row);other[2][i]=[key,raw,n];const disagreement:ActionBindings={comparison:comparisonMap([row],[other]),prior:new Map()},resolved=clone(corrected),vf=object(object(object(resolved.verification).fields)[key]);vf.candidateComparison='different';vf.humanAction='resolved-disagreement';auditEntry(resolved,CTX,'',disagreement);
      // A/B default, one-side correction and third value all retain the explicit
      // resolved-disagreement action; none may silently choose a proposal.
      for(const action of ['confirmed-proposal','corrected-proposal']){
        const bad=edit(resolved,['verification','fields',key,'humanAction'],action);if(action==='confirmed-proposal')object(object(object(bad.verification).fields)[key]).rationale=null;
        assertError(()=>auditEntry(bad,CTX,'',disagreement),RangeError,p+'/humanAction','disagreement-action-mismatch');
      }
      for(const side of [row,other]){const choice=clone(resolved);object(choice.rawLabels)[key]=side[2][i]![1];object(choice.normalizedSourceValues)[NORMAL_KEYS[i]!]=side[2][i]![2];auditEntry(choice,CTX,'',disagreement);}
      const defaulted:ActionBindings={comparison:clone(disagreement.comparison),prior:new Map()};array(defaulted.comparison.get(ID)![i])[4]=[raw,n];assertError(()=>auditEntry(resolved,CTX,'',defaulted),RangeError,p,'different-with-default');
    }
    // Different A/B temperature values can also resolve to a third PDF value.
    const thirdB=clone(row);thirdB[2][0]=['temperature','-14C',-14];const third=clone(SYN_AUDIT_ENTRY);object(third.rawLabels).temperature='-3C';object(third.normalizedSourceValues).temperatureC=-3;object(object(third.verification).fields).temperature={candidateComparison:'different',humanAction:'resolved-disagreement',humanConfirmedRawAndNormalized:true,rationale:'A/Bのtemperature rawが異なり、原PDFでは-3Cと読める'};auditEntry(third,CTX,'',{comparison:comparisonMap([row],[thirdB]),prior:new Map()});
    for(const pair of [['123μm','123μm','exact'],['123µm','123µm','exact'],['123μm','123µm','canonical-unit-equivalent']]){
      const a=clone(row),b=clone(row);a[2][3]=['squareFieldOfView',pair[0]!,123];b[2][3]=['squareFieldOfView',pair[1]!,123];const binding:ActionBindings={comparison:comparisonMap([a],[b]),prior:new Map()},final=clone(SYN_AUDIT_ENTRY);object(final.rawLabels).squareFieldOfView='123µm';object(final.normalizedSourceValues).squareFieldOfViewUm=123;object(object(object(final.verification).fields).squareFieldOfView).candidateComparison=pair[2]!;
      auditEntry(final,CTX,'',binding);expect(a[2][3][1]).toBe(pair[0]);expect(b[2][3][1]).toBe(pair[1]);expect(array(binding.comparison.get(ID)![3])[4]).toEqual(['123µm',123]);
      assertError(()=>auditEntry(edit(final,['rawLabels','squareFieldOfView'],'123μm'),CTX,'',binding),RangeError,'/rawLabels/squareFieldOfView','noncanonical-final-unit');
      const correction=edit(final,['rawLabels','squareFieldOfView'],'124µm');object(correction.normalizedSourceValues).squareFieldOfViewUm=124;object(object(correction.verification).fields).squareFieldOfView={candidateComparison:pair[2]!,humanAction:'corrected-proposal',humanConfirmedRawAndNormalized:true,rationale:'原PDFではsquareFieldOfViewは124µmと読める'};auditEntry(correction,CTX,'',binding);
    }
    const f=syntheticMigrationFixture(),prior=new Map<string,Obj>();migratePriorCaptureForOracle(f.backup,f.aRows,f.bRows,f.locators,prior,f.manifest,f.recordedAtUtc);const original=clone(prior.get(ID)!);auditEntry(original,CTX,'',{comparison:comparisonMap(f.aRows,f.bRows),prior});
    for(const key of SOURCE_KEYS){const p=`/verification/fields/${key}`;assertError(()=>auditEntry(edit(original,['verification','fields',key,'rationale'],'note'),CTX,'',{comparison:comparisonMap(f.aRows,f.bRows),prior}),RangeError,p+'/rationale','rationale-mismatch');}
    const corrected=edit(SYN_AUDIT_ENTRY,['rawLabels','growthTime'],'82sec');object(corrected.normalizedSourceValues).growthTimeSeconds=82;object(object(corrected.verification).fields).growthTime={candidateComparison:'exact',humanAction:'corrected-proposal',humanConfirmedRawAndNormalized:true,rationale:'原PDFではgrowthTimeは82secと読める'};
    for(const rationale of ['a@example.com','accountId=123','account_id : 123','userId=123','user_id:123','uid = 123','deviceName=pc','device_name : pc','hostname=pc','computerName=pc','machine_id:123','ACCOUNTID = 123','HOSTNAME = pc'])assertError(()=>auditEntry(edit(corrected,['verification','fields','growthTime','rationale'],rationale),CTX,'',exact),RangeError,'/verification/fields/growthTime/rationale','personal-information');
    for(const name of ['name','email','accountId','deviceName','hostname'])for(const parent of [[],['verification'],['verification','fields','growthTime']] as string[][])assertError(()=>auditEntry(edit(corrected,[...parent,name],'private'),CTX,'',exact),TypeError,pointer([...parent,name]),'unknown-property');
    assertError(()=>auditEntry(edit(corrected,['normalizedSourceValues','growthTimeSeconds'],83),CTX,'',exact),RangeError,'/growthTimeSeconds','unit-mismatch');
    assertError(()=>auditEntry(edit(corrected,['verification','sourcePanelInspected'],false),CTX,'',exact),RangeError,'/verification/sourcePanelInspected','literal-mismatch');
    assertError(()=>auditEntry(edit(corrected,['verification','fields','growthTime','humanConfirmedRawAndNormalized'],false),CTX,'',exact),RangeError,'/verification/fields/growthTime/humanConfirmedRawAndNormalized','literal-mismatch');
    expect(digest(candidatePreimage('A',[row]))).toBe(frozenBefore);
  });
  it('TC-SOURCE-AUDIT-005 synthetic page identity, hash bindings, freeze and stale propagation',()=>{
    auditBindings(SYN_AUDIT_STRUCTURE,schemaOnlyCorpus(),SYN_ASSIGNMENT,1);
    for(const key of ['sourceEntrySetSha256','preAnnotationSplitAssignmentSha256','canonicalCorpusSha256','auditPayloadSha256'])assertError(()=>auditBindings({...SYN_AUDIT_STRUCTURE,[key]:'f'.repeat(64)},schemaOnlyCorpus(),SYN_ASSIGNMENT,1),RangeError,`/${key}`,'hash-mismatch');
    for(const key of ['sourcePdfSha256','sourceEntrySetSha256','canonicalCorpusSha256','auditPayloadSha256'])assertError(()=>auditBindings(edit(SYN_AUDIT_STRUCTURE,['approval',key],'f'.repeat(64)),schemaOnlyCorpus(),SYN_ASSIGNMENT,1),RangeError,`/approval/${key}`,'hash-mismatch');
    const pages=array(SYN_AUDIT_STRUCTURE.pages);expect(()=>auditBindings({...SYN_AUDIT_STRUCTURE,pages:[pages[1]!,pages[0]!,pages[2]!,pages[3]!]},schemaOnlyCorpus(),SYN_ASSIGNMENT,1)).toThrow(RangeError);
    for(const [path,v]of [[['pages',0,'panelCount'],2],[['pages',0,'sourceObservationIds'],['L23-F2-P12-N001']],[['observations',0,'locator','pdfPage'],12]] as Array<[(string|number)[],Json]>)expect(()=>auditBindings(edit(SYN_AUDIT_STRUCTURE,path,v),schemaOnlyCorpus(),SYN_ASSIGNMENT,1)).toThrow(RangeError);
    for(const key of ['candidatePrefillEnabledOnlyAfterBothDraftsFrozen','productionCorpusReadDuringHumanVerification','productionGeneratorUsed','imageArtifactsCommitted'])expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['auditMethod',key],key==='candidatePrefillEnabledOnlyAfterBothDraftsFrozen'?false:true),CTX,'')).toThrow(RangeError);
    expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['approval','decision'],'pending'),CTX,'')).toThrow(RangeError);
    expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['approval','approvedAtUtc'],'2026-09-29T12:00:00.1Z'),CTX,'')).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-005 fixed freeze order and non-cyclic stale propagation',()=>{
    sourceAuditSequence(SOURCE_AUDIT_SEQUENCE,SYN_ASSIGNMENT,clone(SYN_ASSIGNMENT));
    const swapped=[...SOURCE_AUDIT_SEQUENCE];[swapped[2],swapped[4]]=[swapped[4]!,swapped[2]!];expect(()=>sourceAuditSequence(swapped,SYN_ASSIGNMENT,SYN_ASSIGNMENT)).toThrow(RangeError);
    const annotated=clone(SYN_OBSERVATION);object(annotated.morphology).final={growthAxis:'mixed',basalBranchingLevel:0,hollowing:'present',confidence:'low'};annotated.projectedShape=clone(SYN_PROJECTED);
    expect(digest(sourceProjection(annotated))).toBe(digest(sourceProjection(SYN_OBSERVATION)));expect(digest(SYN_ASSIGNMENT)).toBe(SYN_AUDIT_STRUCTURE.preAnnotationSplitAssignmentSha256);
    expect(()=>sourceAuditSequence(SOURCE_AUDIT_SEQUENCE,SYN_ASSIGNMENT,edit(SYN_ASSIGNMENT,['groups',0,'groupKey',0],-21))).toThrow(RangeError);
    for(const node of ['candidateA','candidateB','comparison','backup','migratedIdSet','humanConfirmedSource','assignment','corpus','auditObject']){const stale=staleFromSourceAudit(node);for(const required of ['protocol','review','red','green','calibration'])expect(stale.has(required)).toBe(true);}
    acyclic(SOURCE_AUDIT_DEPENDENCIES);for(const graph of [{...SOURCE_AUDIT_DEPENDENCIES,auditObject:['auditPayload','split']},{...SOURCE_AUDIT_DEPENDENCIES,corpus:['auditObject'],auditObject:['corpus','split']}])assertError(()=>acyclic(graph),RangeError,'/hashDependencies','cyclic-hash');
    expect(()=>auditBindings(SYN_AUDIT_STRUCTURE,{...schemaOnlyCorpus(),annotationApprovals:[]},SYN_ASSIGNMENT,1)).toThrow(RangeError);
  });
  schemaMutations('TC-SOURCE-AUDIT-001',SYN_AUDIT_STRUCTURE,auditRule);
});

describe('TC-JCS canonical bytes and artifact hashes',()=>{
  it('TC-JCS-001 RFC 8785 object and ECMAScript number vectors',()=>{
    const a=parseJsonRejectingDuplicateKeys('{"b":2,"a":1}');
    expect(canonicalizeForOracle(a)).toBe('{"a":1,"b":2}');
    expect(digest(a)).toBe('43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    for(const [input,bytes]of [['333333333.33333329','333333333.3333333'],['1E30','1e+30'],['4.50','4.5'],['2e-3','0.002'],['1e-27','1e-27']])expect(canonicalizeForOracle(parseJsonRejectingDuplicateKeys(input!))).toBe(bytes);
    expect(canonicalizeForOracle({z:[2,{b:1,a:0}],a:'日本語'})).toBe('{"a":"日本語","z":[2,{"a":0,"b":1}]}');
    expect(canonicalizeForOracle({'\uffff':1,'\ue000':2})).toBe('{"\ue000":2,"\uffff":1}');
    assertError(()=>parseJsonRejectingDuplicateKeys('{"n":-0}'),RangeError,'/n','negative-zero');
    expect(()=>canonicalizeForOracle('\ud800')).toThrow(RangeError);
  });
  it('TC-JCS-002 logical changes alter hashes; source formatting does not',()=>{
    const variants=['{"a":1,"b":2}','{\n  "b": 2,\n  "a": 1\n}','{\r\n  "b": 2,\r\n  "a": 1\r\n}'];
    for(const raw of variants)expect(digest(parseJsonRejectingDuplicateKeys(raw))).toBe('43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    expect(digest({a:1,b:3})).toBe('f9c6777fb86597920de313c707c2c0aa7b059e208a66e1f56f7a2b548e11453d');
    for(const [a,b]of [[[1,2],[2,1]],['雪','氷'],[2,3]] as Array<[Json,Json]>)expect(digest(a)).not.toBe(digest(b));
    const objects:Record<string,Obj>={'corpus.json':{a:1,b:2},'protocol.json':{x:['雪',2]},'split.json':{n:3}};
    const sums=['corpus.json','protocol.json','split.json'].map(name=>`${digest(objects[name])}  ${name}\n`).join('');
    const checked:string[]=[];sumsCheck(sums,objects,(name)=>checked.push(name));expect(checked).toEqual(['corpus.json','protocol.json','split.json']);
    for(const wrong of [sums.slice(0,-1),sums.replace('  corpus.json',' corpus.json'),sums.replace('  corpus.json','  split.json'),sums.replace(/[0-9a-f]/,'A'),sums+'extra\n',sums.replace(/\n/g,'\r\n')])expect(()=>sumsCheck(wrong,objects)).toThrow(RangeError);
    const changed={...objects,'corpus.json':{a:1,b:3}};assertError(()=>sumsCheck(sums,changed),RangeError,'/corpus.json','hash-mismatch');
    expect(sha('{\n "a": 1, "b": 2\n}')).not.toBe(digest(objects['corpus.json']));
  });
});

describe('TC-SPLIT complete synthetic schema and references',()=>{
  it('TC-SPLIT-003 full ten-condition literal, nine strata, source and sibling hashes',()=>{
    expect(SYN_SPLIT_IDS).toHaveLength(10);expect(SYN_GROUPS).toHaveLength(10);
    expect(array(SYN_ASSIGNMENT.strata).map(x=>object(x).stratumId)).toEqual(STRATA);
    expect(array(SYN_ASSIGNMENT.groups).map(x=>object(x).groupKey)).toEqual(SYN_CONDITIONS);
    validateSplitV1(SYN_SPLIT,SYN_REFS);
    expect(SYN_SPLIT.splitAssignmentSha256).toBe(digest(SYN_ASSIGNMENT));
    expect(SYN_SPLIT.sourceEntrySetSha256).toBe(digest(SYN_SPLIT_ENTRIES));
    for(const [i,key]of SYN_CONDITIONS.entries()){
      expect(SYN_GROUPS[i]!.groupSha256).toBe(digest(key));
      expect(SYN_GROUPS[i]!.splitOrderSha256).toBe(sha(PREFIX+canonicalizeForOracle(key)));
    }
  });
  it('TC-SPLIT-004 exact order, allocations, references, hash and stale mutations',()=>{
    const run=(x:Obj)=>validateSplitV1(x,SYN_REFS);
    for(const path of [['schemaVersion'],['assignment','algorithmId'],['assignment','hashPreimagePrefix'],['assignment','stratumOrder',0],['assignment','strata',0,'stratumId'],['assignment','groups',0,'partition']] as Array<(string|number)[]>){const old=path.reduce<Json>((v,k)=>Array.isArray(v)?v[Number(k)]!:object(v)[String(k)]!,SYN_SPLIT);expect(()=>run(edit(SYN_SPLIT,path,`${old}x`))).toThrow();}
    for(const path of [['corpusSha256'],['sourceEntrySetSha256'],['sourceAuditSha256'],['splitAssignmentSha256'],['assignment','groups',0,'groupSha256'],['assignment','groups',0,'splitOrderSha256'],['assignment','groups',0,'sourceObservationIdSetSha256']] as Array<(string|number)[]>){const x=edit(SYN_SPLIT,path,'f'.repeat(64));expect(()=>run(x)).toThrow(RangeError);}
    for(const path of [['assignment','stratumOrder',0],['assignment','strata',0],['assignment','groups',0]] as Array<(string|number)[]>){const x=clone(SYN_SPLIT),a=object(x.assignment),arr=array(a[String(path[1])]);const index=Number(path[2]);[arr[index],arr[index+1]]=[arr[index+1]!,arr[index]!];x.splitAssignmentSha256=digest(a);expect(()=>run(x)).toThrow(RangeError);}
    for(const size of [8,10]){const x=clone(SYN_SPLIT),a=object(x.assignment),strata=array(a.strata);if(size===8)strata.pop();else strata.push(clone(strata[8]!));x.splitAssignmentSha256=digest(a);expect(()=>run(x)).toThrow(RangeError);}
    for(const [path,value]of [[['assignment','strata',0,'groupCount'],2],[['assignment','strata',0,'trainSourceObservationIds'],[SYN_SPLIT_IDS[1]!]], [['assignment','groups',0,'groupKey'],[-20,15]],[['assignment','groups',0,'stratumId'],'T1-S0'],[['assignment','groups',9,'stratumId'],'T0-S0'],[['assignment','reportOnly','sourceObservationIds'],[]]] as Array<[(string|number)[],Json]>){const x=edit(SYN_SPLIT,path,value);object(x.assignment).groups; x.splitAssignmentSha256=digest(x.assignment);expect(()=>run(x)).toThrow(RangeError);}
    const changed=edit(SYN_SPLIT,['assignment','groups',0,'groupKey',0],-21);assertError(()=>run(changed),RangeError,'/splitAssignmentSha256','hash-mismatch');
    changed.splitAssignmentSha256=digest(changed.assignment);expect(()=>run(changed)).toThrow(RangeError);
    expect(digest(SYN_ASSIGNMENT)).toBe(digest(clone(SYN_ASSIGNMENT)));
    expect(digest(edit(SYN_ASSIGNMENT,['groups',0,'sourceObservationIds'],[SYN_SPLIT_IDS[1]!]))).not.toBe(digest(SYN_ASSIGNMENT));
    const annotated=clone(SYN_CORPUS_REFERENCE);annotated.annotationOnly='changed';expect(digest(SYN_ASSIGNMENT)).toBe(digest(clone(SYN_ASSIGNMENT)));
  });
  schemaMutations('TC-SPLIT-004',SYN_SPLIT,splitRule,SYN_GROUPS.map((_,i)=>`/assignment/groups/${i}/stratumId`));
  for(let i=0;i<9;i++)it(`TC-SPLIT-004 semantic non-report null stratum ${i}`,()=>{const x=edit(SYN_SPLIT,['assignment','groups',i,'stratumId'],null);x.splitAssignmentSha256=digest(x.assignment);assertError(()=>validateSplitV1(x,SYN_REFS),RangeError,`/assignment/groups/${i}/stratumId`,'stratum-mismatch');});
});

describe('TC-PROTOCOL complete synthetic contract',()=>{
  it('TC-PROTOCOL-003 full versioned literal, fixed renderer, loss, simulation and holdout',()=>{
    validateProtocolV1(SYN_PROTOCOL,SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE);
    expect(RASTER.viewportScale).toBe(25/3);
    expect(RASTER.backgroundRgba).toEqual([255,255,255,255]);
    expect(array(SIMULATION.seeds)).toHaveLength(8);
    expect(LOSSES.categoricalTagLossDefinition).toBeNull();
    expect(object(LOSSES.shape).reportOnlyFeatureIds).toEqual(['minorMajorAxisRatio']);
    expect(object(HOLDOUT).stateOrder).toEqual(['sealed','opening','opened']);
    expect(object(CANDIDATE).requiredBeforeAnyScore).toBe(true);
  });
  it('TC-PROTOCOL-004 strict versions, all renderer fields and numeric neighbors',()=>{
    const run=(x:Obj)=>validateProtocolV1(x,SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE);
    const variants:Array<[(string|number)[],Json]>=[
      [['schemaVersion'],'snow-crystal-calibration-protocol/2'],[['protocolId'],'libbrecht-2023-figure2-scale-marginalized-v2'],[['corpusId'],'wrong'],
      ...['rendererVersion','canvasBackendVersion','nodeRuntimeVersion'].flatMap((key,i)=>[i===0?'6.3.288':i===1?'1.0':'24.14',i===0?'6.3':i===1?'^1.0.6':'>=24'].map(v=>[["rasterization",key],v] as [(string|number)[],Json])),
      ...[599,601].map(v=>[['rasterization','dpi'],v] as [(string|number)[],Json]),
      ...[71,73].map(v=>[['rasterization','pointsPerInch'],v] as [(string|number)[],Json]),
      [['rasterization','viewportScale'],(25/3)+Number.EPSILON*8],
      ...Object.entries(RASTER).filter(([k])=>!['rendererVersion','canvasBackendVersion','nodeRuntimeVersion','dpi','pointsPerInch','viewportScale'].includes(k)).map(([k,v])=>[['rasterization',k],typeof v==='string'?`${v}x`:typeof v==='boolean'?!v:Array.isArray(v)?[0,...v.slice(1)]:0] as [(string|number)[],Json]),
      [['losses','rank','primarySetId'],'wrong'],[['losses','rank','integratedSetId'],'wrong'],
      [['losses','rank','components',0,'observationField'],'wrong'],[['losses','rank','components',1,'predictionMetric'],'wrong'],[['losses','rank','components',2,'direction'],'wrong'],
      [['losses','rank','pairPenalty','exactlyOneTie'],0.4],
      [['losses','shape','scaleId'],'wrong'],[['losses','shape','intervalDistanceId'],'wrong'],
      ...[114,116].map(v=>[['simulation','latticeRadiusCells'],v] as [(string|number)[],Json]),
      ...[40020,40022].map(v=>[['simulation','maxStepCount'],v] as [(string|number)[],Json]),
      [['simulation','checkpointCriterion'],'wrong'],[['simulation','executionOrder'],'wrong'],[['simulation','seedDerivationPrefix'],'wrong'],
      [['candidateManifestContract','schemaVersion'],'wrong'],[['candidateManifestContract','relativePathPattern'],'wrong'],[['candidateManifestContract','hashAlgorithm'],'wrong'],[['candidateManifestContract','candidateIdRule'],'wrong'],[['candidateManifestContract','requiredBeforeAnyScore'],false],
      [['holdoutRecordContract','schemaVersion'],'wrong'],[['holdoutRecordContract','runRecordBasename'],'wrong'],[['holdoutRecordContract','openIntentBasename'],'wrong'],[['holdoutRecordContract','reportBasename'],'wrong'],[['holdoutRecordContract','secondOpenError'],'wrong'],
    ];
    for(const [path,value]of variants)expect(()=>run(edit(SYN_PROTOCOL,path,value)),pointer(path)).toThrow();
    for(const path of [['losses','rank','primaryComponentIds'],['losses','rank','integratedComponentIds'],['losses','rank','aggregationOrder'],['losses','shape','scoredFeatureIds'],['losses','shape','predictionMetrics'],['losses','shape','reportOnlyFeatureIds'],['losses','shape','aggregationOrder'],['simulation','checkpointBasalRadiusCells'],['simulation','failureCodes'],['candidateManifestContract','allowedFamilies'],['holdoutRecordContract','stateOrder'],['holdoutRecordContract','requiredInputHashFields']] as Array<(string|number)[]>){const v=path.reduce<Json>((o,k)=>object(o)[String(k)]!,SYN_PROTOCOL);const xs=array(v);if(xs.length>1){const swapped=[...xs];[swapped[0],swapped[1]]=[swapped[1]!,swapped[0]!];expect(()=>run(edit(SYN_PROTOCOL,path,swapped)),pointer(path)).toThrow();}expect(()=>run(edit(SYN_PROTOCOL,path,xs.slice(1))),pointer(path)).toThrow();}
    for(const key of ['corpusSha256','splitSha256','sourceAuditSha256'])assertError(()=>run({...SYN_PROTOCOL,[key]:'f'.repeat(64)}),RangeError,`/${key}`,'hash-mismatch');
    const changed={...SYN_PROTOCOL,sourceAuditSha256:digest({...SYN_AUDIT_REFERENCE,changed:true})};assertError(()=>run(changed),RangeError,'/sourceAuditSha256','hash-mismatch');
  });
  it('TC-PROTOCOL-004 independently rederived eight SHA-256 seed states and mutation',()=>{
    validateProtocolV1(SYN_PROTOCOL,SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE);
    for(let i=0;i<8;i++){
      const expected=sha(`snow-crystal-sim/T1-7/seed-v1/${i}`),bytes=Uint8Array.from(expected.match(/../g)!,x=>parseInt(x,16)),view=new DataView(bytes.buffer);
      expect(object(SEEDS[i]!).derivationSha256).toBe(expected);
      expect(object(SEEDS[i]!).stateU32Le).toEqual([0,4,8,12].map(x=>view.getUint32(x,true)));
      for(const [key,value]of [['index',(i+1)%8],['derivationSha256','f'.repeat(64)],['stateU32Le',[...array(SEEDS[i]!.stateU32Le).slice(0,3),number(array(SEEDS[i]!.stateU32Le)[3])+1]]] as Array<[string,Json]>){const x=edit(SYN_PROTOCOL,['simulation','seeds',i,key],value);expect(()=>validateProtocolV1(x,SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE)).toThrow(RangeError);}
      assertError(()=>validateProtocolV1(edit(SYN_PROTOCOL,['simulation','seeds',i,'stateU32Le'],[0,0,0,0]),SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE),RangeError,`/simulation/seeds/${i}/stateU32Le`,'all-zero-seed');
      expect(()=>validateProtocolV1(edit(SYN_PROTOCOL,['simulation','seeds',i,'stateU32Le',0],2**32),SYN_CORPUS_REFERENCE,SYN_SPLIT,SYN_AUDIT_REFERENCE)).toThrow(RangeError);
    }
  });
  it('TC-PROTOCOL-005 rejects wrong ephemeral preparation/evidence before renderer start',()=>{
    const start=vi.fn();preparationBoundary(clone(RASTER),clone(RASTER),start);expect(start).toHaveBeenCalledTimes(1);
    for(const field of ['rendererVersion','canvasBackendVersion','nodeRuntimeVersion','sourcePdfSha256','dpi','viewportScale','outputColorSpace','pixelFormat','origin','rowOrder']){
      const wrong=edit(RASTER,[field],typeof RASTER[field]==='string'?`${RASTER[field]}-old`:0);
      const first=vi.fn();assertError(()=>preparationBoundary(wrong,RASTER,first),RangeError,'/preparation','raster-protocol-mismatch');expect(first).not.toHaveBeenCalled();
      const reuse=vi.fn();assertError(()=>preparationBoundary(RASTER,wrong,reuse),RangeError,'/preparation','raster-protocol-mismatch');expect(reuse).not.toHaveBeenCalled();
    }
  });
  schemaMutations('TC-PROTOCOL-004',SYN_PROTOCOL,protocolRule);
});

describe('TC-RED-001 independent missing artifacts and TC-REAL-001 acceptance',()=>{
  for(const relative of ARTIFACTS)it(`TC-RED-001 missing artifact ${relative}`,()=>expect(existsSync(resolve(ROOT,relative))).toBe(true));
  it.skipIf(!ARTIFACTS.every(relative=>existsSync(resolve(ROOT,relative))))('TC-REAL-001 validates the committed independent 206-observation bundle',()=>{
    const contents: Array<{name:string;isFile:()=>boolean;isDirectory:()=>boolean}>=readdirSync(resolve(ROOT,DATA_REL),{withFileTypes:true});
    artifactBoundary(contents.map(x=>x.name),contents.filter(x=>x.isFile()).map(x=>readFileSync(resolve(ROOT,DATA_REL,x.name),'utf8') as string),contents.filter(x=>x.isDirectory()).map(x=>x.name));
    const {corpus,audit,split,protocol}=realArtifacts();
    expect(array(corpus.observations)).toHaveLength(206);
    expect(array(audit.observations)).toHaveLength(206);
    expect(array(split.assignment&&object(split.assignment).groups).flatMap(x=>array(object(x).sourceObservationIds))).toHaveLength(206);
    expect(protocol.sourceAuditSha256).toBe(digest(audit));
  });
});
