// Independent test-local contract oracle; no production code or source-image data.
// @ts-expect-error Node typings are intentionally outside this browser workspace.
import { createHash } from 'node:crypto';
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
const SYN_AUDIT_ENTRY:Obj={sourceObservationId:'L23-F2-P11-N001',locator:{pdfPage:11,pagePanelOrdinal:1,panelBoundsPdfPt:[10,20,30,40]},rawLabels:{temperature:'-15.0 °C',supersaturation:'12.5 %',growthTime:'2 min',squareFieldOfView:'0.40 mm'},normalizedSourceValues:{temperatureC:-15,supersaturationPct:12.5,growthTimeSeconds:120,squareFieldOfViewUm:400,inProductDomain:true,exclusionReason:null}};
const SOURCE:Obj={arxivId:'2306.13087v1',doi:'10.48550/arXiv.2306.13087',permanentUrl:'https://arxiv.org/abs/2306.13087v1',pdfUrl:'https://arxiv.org/pdf/2306.13087v1',pdfSha256:PDF,pageCount:14,figureNumber:2,figurePdfPages:[11,12,13,14]};
const voteRule=record({growthAxis:enumeration('basal-dominant','c-axis-dominant','mixed','indeterminate'),basalBranchingLevel:nullable(enumeration(0,1,2,3)),hollowing:enumeration('present','absent','indeterminate'),confidence:enumeration('high','medium','low')});
const locatorRule=record({pdfPage:enumeration(11,12,13,14),pagePanelOrdinal:positiveInt,panelBoundsPdfPt:tuple(numeric,numeric,positive,positive)});
const rawRule=record(Object.fromEntries(SOURCE_KEYS.map(k=>[k,textual])));
const normalizedRule=record({temperatureC:numeric,supersaturationPct:numeric,growthTimeSeconds:positive,squareFieldOfViewUm:positive,inProductDomain:bool,exclusionReason:nullable(enumeration('outside-product-domain'))});
const morphologyRule=record({annotatorA:voteRule,annotatorB:voteRule,draftStatus:enumeration('exact-agreement','different'),final:voteRule,approvalId:hash,adjudicationNote:note});
const approvalRule=record({approvalId:hash,reviewMode:enumeration('batch-summary','individual-source-pdf'),targetSourceObservationIds:list(identity),targetIdSetSha256:hash,draftAnnotationSetSha256:hash,finalAnnotationSetSha256:hash,sourcePdfSha256:literal(PDF),approverRole:literal('human-approver'),approvedAtUtc:utc,decision:literal('approved'),note});

function decimalUnit(raw: unknown, field: string, c=CTX, p=''): number {
  const m=/^([+-]?)(\d+)(?:\.(\d+))?\s*(°C|%|s|min|µm|μm|mm)$/.exec(string(raw,c,p));
  if(!m)fail(RangeError,c,p,'unit-or-domain');
  const units:Record<string,Record<string,bigint>>={temperature:{'°C':1n},supersaturation:{'%':1n},growthTime:{s:1n,min:60n},squareFieldOfView:{'µm':1n,'μm':1n,mm:1000n}};
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
const auditEntryRule=record({sourceObservationId:identity,locator:locatorRule,rawLabels:rawRule,normalizedSourceValues:normalizedRule});
function auditEntry(v:unknown,c=CTX,p=''):void {auditEntryRule(v,c,p);const o=object(v),n=object(o.normalizedSourceValues);locator(o,c,p);sourceValues({...n,rawLabels:o.rawLabels!},c,p);domain(n,c,at(p,'normalizedSourceValues'));}
const auditMethod:Obj={kind:'independent-human-source-pdf-audit',productionCorpusReadDuringCapture:false,productionGeneratorUsed:false,imageArtifactsCommitted:false};
const auditApprovalRule=record({decision:literal('approved'),approverRole:literal('human-source-auditor'),sourcePdfSha256:literal(PDF),sourceEntrySetSha256:hash,canonicalCorpusSha256:hash,auditPayloadSha256:hash,approvedAtUtc:utc,note});
const auditRule=record({schemaVersion:literal('snow-crystal-source-audit/1'),corpusId:literal(CORPUS_ID),sourcePdfSha256:literal(PDF),auditMethod:fixed(auditMethod),pages:list(record({pdfPage:enumeration(11,12,13,14),panelCount:natural,sourceObservationIds:list(identity)}),4),observations:list(auditEntryRule),sourceEntrySetSha256:hash,preAnnotationSplitAssignmentSha256:hash,canonicalCorpusSha256:hash,auditPayloadSha256:hash,approval:auditApprovalRule});
function sourceProjection(o:Obj):Obj {return {sourceObservationId:o.sourceObservationId!,locator:o.locator!,rawLabels:o.rawLabels!,normalizedSourceValues:Object.fromEntries([...NORMAL_KEYS,'inProductDomain','exclusionReason'].map(k=>[k,o[k]!]))};}
function sourceJoin(observations:Obj[],independent:Obj[],c=CTX):void {
  const byId=new Map(independent.map(o=>[string(o.sourceObservationId),o]));
  if(byId.size!==independent.length||byId.size!==observations.length)fail(RangeError,c,'/observations','wrong-count');
  for(const o of observations){const id=string(o.sourceObservationId),a=byId.get(id);if(!a)fail(RangeError,{...c,id},'/observations','dangling-id');equal(sourceProjection(o),a,{...c,id},'/observations','source-audit-mismatch');}
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
  const hashes:Obj={sourceEntrySetSha256:digest(a.observations),preAnnotationSplitAssignmentSha256:digest(assignment),canonicalCorpusSha256:digest(corpus),auditPayloadSha256:digest(without(a,'auditPayloadSha256','approval'))};
  for(const [k,h]of Object.entries(hashes))equal(a[k],h,c,at('',k),'hash-mismatch');
  const approval=object(a.approval);for(const k of ['sourcePdfSha256','sourceEntrySetSha256','canonicalCorpusSha256','auditPayloadSha256'])equal(approval[k],a[k]!,c,`/approval/${k}`,'hash-mismatch');
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

const FREEZE_ORDER=['source-ab-sealed','independent-audit-sealed','source-compared','source-and-assignment-frozen','annotations-approved','corpus-frozen','audit-approved','references-frozen'];
function freezeOrder(stages:string[],before:Obj,after:Obj):void {equal(stages,FREEZE_ORDER,CTX,'/freeze','freeze-order');equal(canonicalizeForOracle(after),canonicalizeForOracle(before),CTX,'/assignment','stale');}
function acyclic(graph:Record<string,string[]>):void {
  const active=new Set<string>(),done=new Set<string>();const visit=(v:string):void=>{if(active.has(v))fail(RangeError,CTX,'/hashDependencies','cyclic-hash');if(done.has(v))return;active.add(v);for(const next of graph[v]??[])visit(next);active.delete(v);done.add(v);};Object.keys(graph).forEach(visit);
}
const HASH_GRAPH:Record<string,string[]>={source:['assignment','sourceEntryHash'],assignment:['assignmentHash'],sourceEntryHash:['auditPayload'],assignmentHash:['auditPayload'],corpus:['corpusHash'],corpusHash:['auditPayload'],auditPayload:['auditApproval'],auditApproval:['auditObject'],auditObject:['split','protocol'],split:['protocol'],protocol:['review','red','green','calibration']};
function staleFrom(node:string):Set<string>{const out=new Set<string>();const visit=(n:string)=>{for(const x of HASH_GRAPH[n]??[])if(!out.has(x)){out.add(x);visit(x);}};visit(node);return out;}

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
const SYN_AUDIT_STRUCTURE:Obj={schemaVersion:'snow-crystal-source-audit/1',corpusId:CORPUS_ID,sourcePdfSha256:PDF,auditMethod,pages:[{pdfPage:11,panelCount:1,sourceObservationIds:[ID]},{pdfPage:12,panelCount:0,sourceObservationIds:[]},{pdfPage:13,panelCount:0,sourceObservationIds:[]},{pdfPage:14,panelCount:0,sourceObservationIds:[]}],observations:[SYN_AUDIT_ENTRY],sourceEntrySetSha256:digest([SYN_AUDIT_ENTRY]),preAnnotationSplitAssignmentSha256:digest(SYN_ASSIGNMENT),canonicalCorpusSha256:digest(schemaOnlyCorpus()),auditPayloadSha256:'0'.repeat(64),approval:{decision:'approved',approverRole:'human-source-auditor',sourcePdfSha256:PDF,sourceEntrySetSha256:digest([SYN_AUDIT_ENTRY]),canonicalCorpusSha256:digest(schemaOnlyCorpus()),auditPayloadSha256:'0'.repeat(64),approvedAtUtc:'2026-09-29T12:00:00Z',note:null}};
SYN_AUDIT_STRUCTURE.auditPayloadSha256=digest(without(SYN_AUDIT_STRUCTURE,'auditPayloadSha256','approval'));object(SYN_AUDIT_STRUCTURE.approval).auditPayloadSha256=SYN_AUDIT_STRUCTURE.auditPayloadSha256;

describe('TC-SOURCE-AUDIT synthetic components; REAL206 alone is the source oracle',()=>{
  it('TC-SOURCE-AUDIT-001 synthetic entry literal and complete structural schema, not a complete corpus',()=>{
    auditEntry(SYN_AUDIT_ENTRY);auditRule(SYN_AUDIT_STRUCTURE,CTX,'');
    assertError(()=>validateSourceAuditV1(SYN_AUDIT_STRUCTURE,schemaOnlyCorpus(),SYN_ASSIGNMENT),RangeError,'/observations','wrong-count');
    for(const n of [205,207])assertError(()=>validateSourceAuditV1({...SYN_AUDIT_STRUCTURE,observations:Array(n).fill(SYN_AUDIT_ENTRY)},schemaOnlyCorpus(),SYN_ASSIGNMENT),RangeError,'/observations','wrong-count');
  });
  it('TC-SOURCE-AUDIT-002 synthetic source-only independent literals join all fields and reject one-sided edits',()=>{
    sourceJoin([SYN_OBSERVATION],[SYN_AUDIT_ENTRY]);
    for(const {path,value}of walk(SYN_AUDIT_ENTRY).filter(x=>x.path.length&&x.value!==null&&typeof x.value!=='object')){
      const replacement:Json=typeof value==='string'?`${value}x`:typeof value==='number'?value+1:!value;
      expect(()=>sourceJoin([SYN_OBSERVATION],[edit(SYN_AUDIT_ENTRY,path,replacement)])).toThrow(RangeError);
    }
    expect(()=>sourceJoin([SYN_OBSERVATION],[])).toThrow(RangeError);
    expect(()=>sourceJoin([SYN_OBSERVATION],[SYN_AUDIT_ENTRY,SYN_AUDIT_ENTRY])).toThrow(RangeError);
    const changed=edit(SYN_OBSERVATION,['rawLabels','temperature'],'-15.00 °C');expect(()=>sourceJoin([changed],[SYN_AUDIT_ENTRY])).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-002 synthetic page identity, four independent hash bindings and approval references',()=>{
    auditBindings(SYN_AUDIT_STRUCTURE,schemaOnlyCorpus(),SYN_ASSIGNMENT,1);
    for(const key of ['sourceEntrySetSha256','preAnnotationSplitAssignmentSha256','canonicalCorpusSha256','auditPayloadSha256'])assertError(()=>auditBindings({...SYN_AUDIT_STRUCTURE,[key]:'f'.repeat(64)},schemaOnlyCorpus(),SYN_ASSIGNMENT,1),RangeError,`/${key}`,'hash-mismatch');
    for(const key of ['sourcePdfSha256','sourceEntrySetSha256','canonicalCorpusSha256','auditPayloadSha256'])assertError(()=>auditBindings(edit(SYN_AUDIT_STRUCTURE,['approval',key],'f'.repeat(64)),schemaOnlyCorpus(),SYN_ASSIGNMENT,1),RangeError,`/approval/${key}`,'hash-mismatch');
    const pages=array(SYN_AUDIT_STRUCTURE.pages);expect(()=>auditBindings({...SYN_AUDIT_STRUCTURE,pages:[pages[1]!,pages[0]!,pages[2]!,pages[3]!]},schemaOnlyCorpus(),SYN_ASSIGNMENT,1)).toThrow(RangeError);
    for(const [path,v]of [[['pages',0,'panelCount'],2],[['pages',0,'sourceObservationIds'],['L23-F2-P12-N001']],[['observations',0,'locator','pdfPage'],12]] as Array<[(string|number)[],Json]>)expect(()=>auditBindings(edit(SYN_AUDIT_STRUCTURE,path,v),schemaOnlyCorpus(),SYN_ASSIGNMENT,1)).toThrow(RangeError);
    for(const key of ['productionCorpusReadDuringCapture','productionGeneratorUsed','imageArtifactsCommitted'])expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['auditMethod',key],true),CTX,'')).toThrow(RangeError);
    expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['approval','decision'],'pending'),CTX,'')).toThrow(RangeError);
    expect(()=>auditRule(edit(SYN_AUDIT_STRUCTURE,['approval','approvedAtUtc'],'2026-09-29T12:00:00.1Z'),CTX,'')).toThrow(RangeError);
  });
  it('TC-SOURCE-AUDIT-003 synthetic freeze order, annotation invariance, stale propagation and DFS cycle rejection',()=>{
    freezeOrder(FREEZE_ORDER,SYN_ASSIGNMENT,clone(SYN_ASSIGNMENT));
    const swapped=[...FREEZE_ORDER];[swapped[2],swapped[4]]=[swapped[4]!,swapped[2]!];expect(()=>freezeOrder(swapped,SYN_ASSIGNMENT,SYN_ASSIGNMENT)).toThrow(RangeError);
    const annotated=clone(SYN_OBSERVATION);object(annotated.morphology).final={growthAxis:'mixed',basalBranchingLevel:0,hollowing:'present',confidence:'low'};annotated.projectedShape=clone(SYN_PROJECTED);
    expect(digest(sourceProjection(annotated))).toBe(digest(sourceProjection(SYN_OBSERVATION)));expect(digest(SYN_ASSIGNMENT)).toBe(SYN_AUDIT_STRUCTURE.preAnnotationSplitAssignmentSha256);
    expect(()=>freezeOrder(FREEZE_ORDER,SYN_ASSIGNMENT,edit(SYN_ASSIGNMENT,['groups',0,'groupKey',0],-21))).toThrow(RangeError);
    for(const node of ['source','assignment','corpus','auditObject']){const stale=staleFrom(node);for(const required of ['protocol','review','red','green','calibration'])expect(stale.has(required)).toBe(true);}
    acyclic(HASH_GRAPH);for(const graph of [{...HASH_GRAPH,auditObject:['auditPayload','split']},{...HASH_GRAPH,corpus:['auditObject'],auditObject:['corpus','split']}])assertError(()=>acyclic(graph),RangeError,'/hashDependencies','cyclic-hash');
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
