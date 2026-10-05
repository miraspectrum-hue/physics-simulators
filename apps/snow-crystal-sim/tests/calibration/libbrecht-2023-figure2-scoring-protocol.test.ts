// Independent synthetic oracle. No production or shared helper imports.
// @ts-expect-error The browser workspace deliberately has no Node type package.
import { createHash } from 'node:crypto';
// @ts-expect-error The browser workspace deliberately has no Node type package.
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

const STRATA = ['T0-S0','T0-S1','T0-S2','T1-S0','T1-S1','T1-S2','T2-S0','T2-S1','T2-S2'] as const;
const COMPONENTS = ['branching-compactness-v1','branching-tip-density-v1','axis-aspect-ratio-v1'] as const;
const SCORED_FEATURES = ['inverseCircularity','normalizedArmLengthCv'] as const;
const REPORT_FEATURES = ['minorMajorAxisRatio'] as const;
const CHECKPOINTS = [10,20,40] as const;
const PREFIX = 'snow-crystal-sim/T1-7/split-v1\0';
type Component = typeof COMPONENTS[number];
type Feature = typeof SCORED_FEATURES[number];
type Metric = number | null | 'unreached';
type Key = readonly [number,number];
type Group = { key:Key; ids:readonly string[]; annotation:{final:string; confidence:string; interval:readonly [number,number]|null} };
const hash = (s:string) => createHash('sha256').update(s).digest('hex') as string;
const bytes = (s:string) => createHash('sha256').update(s).digest() as Uint8Array;
const keyJson = (key:Key) => '[' + JSON.stringify(key[0]) + ',' + JSON.stringify(key[1]) + ']';
const keyHash = (key:Key) => hash(keyJson(key));
const splitHash = (key:Key) => hash(PREFIX + keyJson(key));
function unsigned(a:Uint8Array,b:Uint8Array) {
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]! - b[i]!;
  return 0;
}
function mean(values:readonly (number|null)[]):number|null {
  const xs=values.filter((x):x is number=>x!==null);
  if(!xs.length) return null;
  let sum=0, compensation=0;
  for(const x of xs) {
    const next=sum+x;
    compensation+=Math.abs(sum)>=Math.abs(x) ? (sum-next)+x : (x-next)+sum;
    sum=next;
  }
  return (sum+compensation)/xs.length;
}
function nonnull(value:number|null):number {
  if(value===null) throw new Error('empty synthetic fixture');
  return value;
}
function bits(value:number):string {
  if(!Number.isFinite(value)||Object.is(value,-0)) throw new RangeError('invalid-binary64');
  const buffer=new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0,value);
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function exactTrace(actual:unknown,expected:unknown,path='$'):void {
  if(typeof actual==='number'||typeof expected==='number') {
    expect(typeof actual,path).toBe('number');
    expect(typeof expected,path).toBe('number');
    expect(bits(actual as number),path).toBe(bits(expected as number));
    return;
  }
  if(Array.isArray(actual)||Array.isArray(expected)) {
    expect(Array.isArray(actual),path).toBe(true);
    expect(Array.isArray(expected),path).toBe(true);
    expect(actual as unknown[],path).toHaveLength((expected as unknown[]).length);
    (expected as unknown[]).forEach((item,i)=>exactTrace((actual as unknown[])[i],item,path+'['+i+']'));
    return;
  }
  if(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object') {
    const actualKeys=Object.keys(actual),expectedKeys=Object.keys(expected);
    expect(actualKeys,path).toEqual(expectedKeys);
    expectedKeys.forEach(key=>exactTrace((actual as Record<string,unknown>)[key],
      (expected as Record<string,unknown>)[key],path+'.'+key));
    return;
  }
  expect(actual,path).toBe(expected);
}
function packTrace(value:unknown):unknown {
  if(typeof value==='number') return {$binary64:bits(value)};
  if(Array.isArray(value)) return value.map(packTrace);
  if(value!==null&&typeof value==='object')
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,packTrace(item)]));
  return value;
}
function stratum([t,s]:Key):string|null {
  if(t < -30 || t > 0 || s < 0 || s > 30) return null;
  return 'T' + (t < -10 ? 0 : t < -3 ? 1 : 2) + '-S' + (s < 10 ? 0 : s < 20 ? 1 : 2);
}
function split(groups:readonly Group[]) {
  const seen=new Set<string>();
  for(const g of groups) {
    const k=keyJson(g.key);
    if(seen.has(k)) throw new RangeError('duplicate-group-key');
    seen.add(k);
  }
  const records=STRATA.map(id=>{
    const ordered=groups.filter(g=>stratum(g.key)===id)
      .sort((a,b)=>unsigned(bytes(PREFIX+keyJson(a.key)),bytes(PREFIX+keyJson(b.key))));
    const n=ordered.length;
    const count=n===1 ? 0 : Math.min(n-1,Math.max(1,Math.floor(n/5)));
    return {id, holdout:ordered.slice(0,count), train:ordered.slice(count), ordered};
  });
  const reportOnly=groups.filter(g=>stratum(g.key)===null);
  const evidence=records.map(r=>({
    stratumId:r.id,
    holdoutGroupSha256s:r.holdout.map(g=>keyHash(g.key)),
    trainGroupSha256s:r.train.map(g=>keyHash(g.key))
  }));
  return {records,reportOnly,evidence,sha256:hash(JSON.stringify(evidence))};
}
type RawCondition={id:string;key:Key;growthTimeSeconds:number;photoId:string};
function groupConditions(raw:readonly RawCondition[]):Group[] {
  const grouped=new Map<string,{key:Key;ids:string[]}>();
  for(const observation of raw) {
    const k=keyJson(observation.key);
    const existing=grouped.get(k);
    if(existing) existing.ids.push(observation.id);
    else grouped.set(k,{key:observation.key,ids:[observation.id]});
  }
  return [...grouped.values()].map(g=>({key:g.key,ids:g.ids.sort(),
    annotation:{final:'basal-dominant',confidence:'high',interval:[1,2] as const}}));
}
const group=(t:number,s:number,id:string):Group=>({
  key:[t,s],ids:[id],annotation:{final:'basal-dominant',confidence:'high',interval:[1,2]}
});

type RankGroup={key:Key; ranks:readonly (number|null)[]; metrics:Record<Component,Metric>};
type Morphology={basalBranchingLevel:0|1|2|3|null;
  growthAxis:'basal-dominant'|'mixed'|'c-axis-dominant'|'indeterminate';
  hollowing:'present'|'absent'|'indeterminate'};
function observedRank(m:Morphology,c:Component):number|null {
  if(c==='axis-aspect-ratio-v1') {
    const order=['basal-dominant','mixed','c-axis-dominant'];
    const index=order.indexOf(m.growthAxis);
    return index<0?null:index;
  }
  return m.basalBranchingLevel;
}
const direction=(x:number)=>x>0?1:x<0?-1:0;
function rankPairEvidence(a:RankGroup,b:RankGroup,c:Component):
  {N:number;M:number;numerator:number;denominator:number;value:number}|null|'failed' {
  let N=0,M=0;
  for(const ra of a.ranks) for(const rb of b.ranks) if(ra!==null && rb!==null) {
    const ma=a.metrics[c],mb=b.metrics[c];
    if(typeof ma!=='number'||!Number.isFinite(ma)||typeof mb!=='number'||!Number.isFinite(mb)) return 'failed';
    const actual=direction(rb-ra),predicted=direction(mb-ma);
    N+=actual===predicted?0:actual===0||predicted===0?1:2;
    M++;
  }
  if(!M) return null;
  const gcd=(x:number,y:number):number=>y===0?x:gcd(y,x%y);
  const divisor=gcd(N,2*M);
  return {N,M,numerator:N/divisor,denominator:2*M/divisor,value:N/(2*M)};
}
function rankPair(a:RankGroup,b:RankGroup,c:Component):number|null|'failed' {
  const evidence=rankPairEvidence(a,b,c);
  return evidence===null||evidence==='failed'?evidence:evidence.value;
}
function rankComponent(groups:readonly RankGroup[],c:Component):number|null|'failed' {
  const sorted=groups;
  for(let i=1;i<sorted.length;i++) if(keyJson(sorted[i-1]!.key)>=keyJson(sorted[i]!.key)) return 'failed';
  const pairs:number[]=[];
  for(let i=0;i<sorted.length;i++) for(let j=i+1;j<sorted.length;j++) {
    const p=rankPair(sorted[i]!,sorted[j]!,c);
    if(p==='failed') return p;
    if(p!==null) pairs.push(p);
  }
  return mean(pairs);
}
function rankAtStratum(groups:readonly RankGroup[],components:readonly Component[]):number|null|'failed' {
  const values:number[]=[];
  for(const c of components) {
    const score=rankComponent(groups,c);
    if(score==='failed') return score;
    if(score!==null) values.push(score);
  }
  return mean(values);
}
type RankStratum={id:string;groups:readonly RankGroup[]};
type RankRecord={checkpoint:number;seed:number;strata:readonly RankStratum[]};
function ordered24<T extends {checkpoint:number;seed:number}>(records:readonly T[]) {
  return records.length===24 && records.every((r,i)=>r.checkpoint===CHECKPOINTS[Math.floor(i/8)]&&r.seed===i%8);
}
function orderedStrata(records:readonly {id:string}[]) {
  return records.length===9 && records.every((r,i)=>r.id===STRATA[i]);
}
function rankHierarchy(records:readonly RankRecord[],components:readonly Component[]):number|null|'failed' {
  if(!ordered24(records)||records.some(r=>!orderedStrata(r.strata))) return 'failed';
  const checkpoints:number[]=[];
  for(const checkpoint of CHECKPOINTS) {
    const seeds:number[]=[];
    for(let seed=0;seed<8;seed++) {
      const record=records.find(r=>r.checkpoint===checkpoint&&r.seed===seed)!;
      const strata:number[]=[];
      for(const entry of record.strata) {
        if(entry.groups.some(g=>stratum(g.key)!==entry.id)) return 'failed';
        const value=rankAtStratum(entry.groups,components);
        if(value==='failed') return 'failed';
        if(value!==null) strata.push(value);
      }
      const value=mean(strata);
      if(value!==null) seeds.push(value);
    }
    const value=mean(seeds);
    if(value!==null) checkpoints.push(value);
  }
  return mean(checkpoints);
}
function midCdf(train:readonly number[],z:number):number|null {
  if(!train.length) return null;
  if(!Number.isFinite(z)||train.some(x=>!Number.isFinite(x))) throw new TypeError('non-finite');
  const sorted=[...train].sort((a,b)=>a-b);
  let below=0,equal=0;
  for(const x of sorted) { if(x<z) below++; else if(x===z) equal++; }
  return (below+equal/2)/sorted.length;
}
function trainCdf(train:readonly {partition:'train'|'holdout'; interval:readonly [number,number]|null}[],z:number) {
  const samples=train.filter(o=>o.partition==='train'&&o.interval!==null)
    .map(o=>o.interval![0]/2+o.interval![1]/2);
  return midCdf(samples,z);
}
function shapePrimitive(train:readonly number[],interval:readonly[number,number]|null,prediction:Metric):number|null|'failed' {
  if(interval===null||!train.length) return null;
  if(typeof prediction!=='number'||!Number.isFinite(prediction)) return 'failed';
  const lo=nonnull(midCdf(train,interval[0]));
  const hi=nonnull(midCdf(train,interval[1]));
  const at=nonnull(midCdf(train,prediction));
  return at<lo?lo-at:at>hi?at-hi:0;
}
type ShapeObservation={id:string;groupKey:Key; intervals:Record<Feature,readonly[number,number]|null>;
  reportOnly:{minorMajorAxisRatio:readonly[number,number]|null}};
type ShapeGroup={key:Key;observations:readonly ShapeObservation[];predictions:Record<Feature,Metric>};
type ShapeStratum={id:string;groups:readonly ShapeGroup[]};
type ShapeRecord={checkpoint:number;seed:number;strata:readonly ShapeStratum[]};
function shapeHierarchy(records:readonly ShapeRecord[],train:Record<Feature,readonly number[]>):number|null|'failed' {
  if(!ordered24(records)||records.some(r=>!orderedStrata(r.strata))) return 'failed';
  const checkpointMeans:number[]=[];
  for(const checkpoint of CHECKPOINTS) {
    const seedMeans:number[]=[];
    for(let seed=0;seed<8;seed++) {
      const record=records.find(r=>r.checkpoint===checkpoint&&r.seed===seed)!;
      const stratumMeans:number[]=[];
      for(const entry of record.strata) {
        if(entry.groups.some(g=>stratum(g.key)!==entry.id)) return 'failed';
        const groupMeans:number[]=[];
        for(let i=1;i<entry.groups.length;i++)
          if(keyJson(entry.groups[i-1]!.key)>=keyJson(entry.groups[i]!.key)) return 'failed';
        for(const group of entry.groups) {
          const observationMeans:number[]=[];
          for(let i=1;i<group.observations.length;i++)
            if(group.observations[i-1]!.id>=group.observations[i]!.id) return 'failed';
          for(const observation of group.observations) {
            if(keyJson(observation.groupKey)!==keyJson(group.key)) return 'failed';
            const features:number[]=[];
            for(const feature of SCORED_FEATURES) {
              const value=shapePrimitive(train[feature],observation.intervals[feature],group.predictions[feature]);
              if(value==='failed') return 'failed';
              if(value!==null) features.push(value);
            }
            const value=mean(features);
            if(value!==null) observationMeans.push(value);
          }
          const value=mean(observationMeans);
          if(value!==null) groupMeans.push(value);
        }
        const value=mean(groupMeans);
        if(value!==null) stratumMeans.push(value);
      }
      const value=mean(stratumMeans);
      if(value!==null) seedMeans.push(value);
    }
    const value=mean(seedMeans);
    if(value!==null) checkpointMeans.push(value);
  }
  return mean(checkpointMeans);
}
type Family='condition-blind-baseline'|'nearest-train-condition-baseline'|'piecewise-bilinear-map-v1';
type Candidate={family:Family;knots:number;id:string;tag:number|null;shape:number|null};
const familyOrder:readonly Family[]=['condition-blind-baseline','nearest-train-condition-baseline','piecewise-bilinear-map-v1'];
type Availability={tag:boolean;shape:boolean};
function candidates(items:readonly Candidate[],availability:Availability) {
  if(items.some(c=>!familyOrder.includes(c.family))) throw new RangeError('unknown-family');
  const globalTagNull=!availability.tag,globalShapeNull=!availability.shape;
  if(globalTagNull&&globalShapeNull) throw new RangeError('no-calibration-evidence');
  const failed=(c:Candidate)=>(!globalTagNull&&c.tag===null)||(!globalShapeNull&&c.shape===null);
  const execution=[...items].sort((a,b)=>familyOrder.indexOf(a.family)-familyOrder.indexOf(b.family)||a.knots-b.knots||
    (a.id<b.id?-1:a.id>b.id?1:0));
  const selection=[...items].sort((a,b)=>Number(failed(a))-Number(failed(b))||
    (globalTagNull?0:a.tag!-b.tag!)||(globalShapeNull?0:a.shape!-b.shape!)||
    a.knots-b.knots||(a.id<b.id?-1:a.id>b.id?1:0));
  return {execution,selection,globalTagNull,globalShapeNull,failed};
}
function observationAvailability(observations:readonly PipelineBundle['observations'][number][]):Availability {
  const train=observations.filter(o=>o.partition==='train');
  const strata=STRATA.map(id=>train.filter(o=>stratum(o.key)===id));
  const tag=strata.some(rows=>rows.some((a,i)=>rows.slice(i+1).some(b=>
    keyJson(a.key)!==keyJson(b.key) &&
    a.morphology.basalBranchingLevel!==null&&b.morphology.basalBranchingLevel!==null)));
  const shape=SCORED_FEATURES.some(f=>train.some(o=>o.intervals[f]!==null));
  return {tag,shape};
}
function mode<T>(values:readonly T[],order:readonly T[]):T {
  return [...order].sort((a,b)=>values.filter(x=>x===b).length-values.filter(x=>x===a).length)[0]!;
}
function median(values:readonly number[]):number {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return n%2 ? sorted[(n-1)/2]! : sorted[n/2-1]!/2+sorted[n/2]!/2;
}
function nearest(query:Key,train:readonly Group[]):Group {
  return [...train].sort((a,b)=>{
    const d=(g:Group)=>((g.key[0]-query[0])/30)**2+((g.key[1]-query[1])/30)**2;
    const ha=keyHash(a.key),hb=keyHash(b.key);
    return d(a)-d(b)||(ha<hb?-1:ha>hb?1:0);
  })[0]!;
}
function baselinePredictions<T>(prediction:T) {
  return CHECKPOINTS.flatMap(checkpoint=>Array.from({length:8},(_,seed)=>({checkpoint,seed,prediction})));
}
type ExecutionRecord={checkpoint:number;seed:number;step:number;
  state:'ok'|'checkpoint-not-reached'|'reservoir-boundary-reached'|'non-finite-metric'|'max-step-exceeded';
  tag:Metric;shape:Metric};
function executionResult(records:readonly ExecutionRecord[],
  observations:PipelineBundle['observations']) {
  const availability=observationAvailability(observations);
  if(!availability.tag&&!availability.shape) throw new RangeError('no-calibration-evidence');
  const globalTagNull=!availability.tag,globalShapeNull=!availability.shape;
  if(!ordered24(records)) return {status:'failed' as const,reason:'record-order'};
  for(const r of records) {
    if(r.state!=='ok'||r.step>40021||r.step<0) return {status:'failed' as const,reason:'unusable-record'};
    if(!globalTagNull&&(typeof r.tag!=='number'||!Number.isFinite(r.tag)))
      return {status:'failed' as const,reason:'candidate-tag-null'};
    if(!globalShapeNull&&(typeof r.shape!=='number'||!Number.isFinite(r.shape)))
      return {status:'failed' as const,reason:'candidate-shape-null'};
  }
  const byCheckpoint=CHECKPOINTS.map(checkpoint=>({
    checkpoint,
    tag:globalTagNull?null:mean(records.filter(r=>r.checkpoint===checkpoint).map(r=>r.tag as number)),
    shape:globalShapeNull?null:mean(records.filter(r=>r.checkpoint===checkpoint).map(r=>r.shape as number))
  }));
  return {status:'ok' as const,
    tag:globalTagNull?null:mean(byCheckpoint.map(r=>r.tag)),
    shape:globalShapeNull?null:mean(byCheckpoint.map(r=>r.shape)),byCheckpoint};
}
function pareto(candidate:readonly[number|null,number|null],comparator:readonly[number|null,number|null]) {
  let better=false;
  for(let i=0;i<2;i++) {
    if(candidate[i]===null&&comparator[i]!==null) return 'failed';
    if(candidate[i]!==null&&comparator[i]!==null) {
      if(candidate[i]!>comparator[i]!) return 'rejected';
      if(candidate[i]!<comparator[i]!) better=true;
    }
  }
  return better?'accepted':'rejected';
}
type State={basalRadiusCells:number;step:number;physicalTime?:number;alternate?:boolean;best?:boolean};
function firstCrossing(states:readonly State[],checkpoint:number) {
  if(!CHECKPOINTS.includes(checkpoint as 10|20|40)) throw new RangeError('checkpoint');
  if(states.some(s=>s.alternate||s.best||s.physicalTime!==undefined)) throw new RangeError('non-radius-selection');
  const first=states.find(s=>s.basalRadiusCells>=checkpoint);
  if(!first||first.step>40021) throw new RangeError('checkpoint-failure');
  return first;
}
function seed(index:number) {
  const digest=bytes('snow-crystal-sim/T1-7/seed-v1/'+index);
  const view=new DataView(digest.buffer,digest.byteOffset,digest.byteLength);
  return {sha256:hash('snow-crystal-sim/T1-7/seed-v1/'+index),
    words:[0,4,8,12].map(offset=>view.getUint32(offset,true))};
}

describe('synthetic TC-SPLIT-001..002',()=>{
  it('synthetic grouped keys, unsigned SHA order, FIRST holdout, all count and bin boundaries',()=>{
    for(const [key,want] of [
      [[-30,0],'T0-S0'],[[-10,10],'T1-S1'],[[-3,20],'T2-S2'],[[0,30],'T2-S2'],
      [[-30,10],'T0-S1'],[[-10,20],'T1-S2'],[[-3,30],'T2-S2']
    ] as const) expect(stratum(key)).toBe(want);
    const literalOrder:Record<number,string[]>= {
      1:['G0'],2:['G0','G1'],
      9:['G2','G7','G5','G4','G0','G8','G6','G1','G3'],
      10:['G2','G7','G9','G5','G4','G0','G8','G6','G1','G3'],
      11:['G2','G7','G9','G5','G4','G0','G8','G6','G1','G10','G3']
    };
    for(const n of [1,2,9,10,11]) {
      const input=Array.from({length:n},(_,i)=>group(-29+i/2,5,'G'+i));
      const record=split(input).records[0]!;
      const sorted=[...input].sort((a,b)=>unsigned(bytes(PREFIX+keyJson(a.key)),bytes(PREFIX+keyJson(b.key))));
      const held=n===1?0:Math.min(n-1,Math.max(1,Math.floor(n/5)));
      expect(record.ordered.map(g=>splitHash(g.key))).toEqual(sorted.map(g=>splitHash(g.key)));
      expect(record.ordered.map(g=>g.ids[0])).toEqual(literalOrder[n]);
      expect(record.ordered[0]&&splitHash(record.ordered[0].key)).toBe(n<9?
        '4fd05405318cef80cb882a39a83dc3b3324224c1bf432c8a7beda576b94d0211':
        '20370caa324b02a8bd91d8bac868a7ddf4469f1dc64e2c119058f08f8f47654b');
      expect(record.holdout.map(g=>g.ids[0])).toEqual(sorted.slice(0,held).map(g=>g.ids[0]));
      expect(record.train.map(g=>g.ids[0])).toEqual(sorted.slice(held).map(g=>g.ids[0]));
    }
    const raw:RawCondition[]=[
      {id:'B',key:[-20,5],growthTimeSeconds:240,photoId:'frame-2'},
      {id:'A',key:[-20,5],growthTimeSeconds:120,photoId:'frame-1'},
      {id:'C',key:[-20,5],growthTimeSeconds:360,photoId:'frame-3'},
      {id:'D',key:[-19,5],growthTimeSeconds:120,photoId:'other'}
    ];
    const grouped=groupConditions(raw);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.ids).toEqual(['A','B','C']);
    const result=split([...grouped,group(-31,5,'report'),group(1,5,'report2')]);
    expect(result.records[0]!.holdout.concat(result.records[0]!.train).find(g=>g.ids.includes('A'))!.ids).toEqual(['A','B','C']);
    expect(()=>split([group(-20,5,'A'),group(-20,5,'B')])).toThrow('duplicate-group-key');
    expect(result.reportOnly.flatMap(g=>g.ids)).toEqual(['report','report2']);
  });
  it('synthetic four separate 2D contributions and 7/16 in nine canonical slots; annotations do not affect bytes',()=>{
    const groups=[group(-20,5,'G00'),group(-20,15,'G01'),group(-5,5,'G10'),group(-5,15,'G11')];
    const a=split(groups);
    const changed=split(groups.map(g=>({...g,annotation:{final:'c-axis-dominant',confidence:'low',interval:null}})));
    expect(a.evidence).toEqual(changed.evidence);
    expect(a.sha256).toBe(changed.sha256);
    expect(split([group(-19,5,'G00'),...groups.slice(1)]).sha256).not.toBe(a.sha256);
    expect(a.records.map(r=>r.id)).toEqual(STRATA);
    const contributionById=new Map([['G00',0],['G01',1/2],['G10',1/4],['G11',1]]);
    const derived=a.records.map(r=>mean(r.train.map(g=>contributionById.get(g.ids[0]!)!)));
    expect(derived).toEqual([0,1/2,null,1/4,1,null,null,null,null]);
    expect(mean(derived)).toBe(7/16);
  });
});

describe('synthetic TC-RANK-001..003',()=>{
  const make=(a:Metric,b:Metric,c:Metric):RankGroup[]=>[
    {key:[-20,5],ranks:[0,1],metrics:{'branching-compactness-v1':0,'branching-tip-density-v1':0,'axis-aspect-ratio-v1':0}},
    {key:[-21,5],ranks:[2,1],metrics:{'branching-compactness-v1':a,'branching-tip-density-v1':b,'axis-aspect-ratio-v1':c}}
  ];
  it('synthetic exact pair fractions, distinct component metrics, basal and integrated means',()=>{
    const groups=make(1,0,-1);
    expect(COMPONENTS.map(c=>rankComponent(groups,c))).toEqual([1/8,3/8,7/8]);
    expect(COMPONENTS.map(c=>rankPairEvidence(groups[0]!,groups[1]!,c))).toEqual([
      {N:1,M:4,numerator:1,denominator:8,value:1/8},
      {N:3,M:4,numerator:3,denominator:8,value:3/8},
      {N:7,M:4,numerator:7,denominator:8,value:7/8}
    ]);
    const morphology=(basalBranchingLevel:Morphology['basalBranchingLevel'],
      growthAxis:Morphology['growthAxis'],hollowing:Morphology['hollowing']='absent'):Morphology=>
      ({basalBranchingLevel,growthAxis,hollowing});
    expect([0,1,2,3].map(x=>observedRank(morphology(x as 0|1|2|3,'mixed'),COMPONENTS[0])))
      .toEqual([0,1,2,3]);
    expect([0,1,2,3].map(x=>observedRank(morphology(x as 0|1|2|3,'mixed'),COMPONENTS[1])))
      .toEqual([0,1,2,3]);
    expect(['basal-dominant','mixed','c-axis-dominant','indeterminate'].map(x=>
      observedRank(morphology(2,x as Morphology['growthAxis']),COMPONENTS[2])))
      .toEqual([0,1,2,null]);
    expect(observedRank(morphology(null,'mixed'),COMPONENTS[0])).toBeNull();
    expect(observedRank(morphology(2,'mixed','present'),COMPONENTS[0])).toBe(2);
    expect(rankComponent([...groups].reverse(),COMPONENTS[0])).toBe('failed');
    expect(rankAtStratum(groups,COMPONENTS.slice(0,2))).toBe(1/4);
    expect(rankAtStratum(groups,COMPONENTS)).toBe(11/24);
    const alternative=make(0,0,0);
    expect(rankAtStratum(alternative,COMPONENTS.slice(0,2))).toBe(3/8);
    expect(rankAtStratum(alternative,COMPONENTS)).toBe(3/8);
    const basalChoice=candidates([
      {family:'piecewise-bilinear-map-v1',knots:3,id:'basal-winner',tag:1/4,shape:1/4},
      {family:'piecewise-bilinear-map-v1',knots:4,id:'integrated-winner',tag:3/8,shape:1/4}
    ],{tag:true,shape:true}).selection[0]!;
    expect(basalChoice.id).toBe('basal-winner');
    expect(pareto([1/4,1/4],[3/8,1/4])).toBe('accepted');
    expect(pareto([11/24,1/4],[3/8,1/4])).toBe('rejected');
    const sparse=make(0,0,0).map((g,i)=>({...g,ranks:i===0?[null,1]:[2,null]}));
    expect(rankComponent(sparse,'branching-compactness-v1')).toBe(1/2);
    expect(rankComponent(make(1,1,1).map(g=>({...g,ranks:[null]})),'branching-compactness-v1')).toBeNull();
    expect(rankAtStratum([],COMPONENTS)).toBeNull();
    for(const bad of [null,NaN,Infinity,'unreached'] as const)
      expect(rankComponent(make(bad,0,0),'branching-compactness-v1')).toBe('failed');
    expect(rankPair({...groups[0]!,ranks:[0],metrics:{...groups[0]!.metrics,'branching-compactness-v1':0}},
      {...groups[1]!,ranks:[1],'metrics':{...groups[1]!.metrics,'branching-compactness-v1':-0}},
      'branching-compactness-v1')).toBe(1/2);
  });
  it('synthetic group pair -> component -> stratum -> seed -> checkpoint for all 24 ordered records',()=>{
    const records=CHECKPOINTS.flatMap(checkpoint=>Array.from({length:8},(_,seed):RankRecord=>({
      checkpoint,seed,strata:STRATA.map((id,index)=>({
        id,groups:index<4?make(checkpoint===10||checkpoint===20&&seed<4?1:-1,0,-1)
          .map((g,i)=>({...g,key:[[-20,-20,-20,-5][index]!-i,[5,15,25,5][index]!] as Key,
            ranks:index===0&&i===0?[0,0,1]:g.ranks})):[]})
      )
    })));
    expect(records).toHaveLength(24);
    const actual=rankHierarchy(records,COMPONENTS);
    expect(actual).not.toBe('failed');
    expect(actual).toBe(85/144);
    expect(rankAtStratum(records[0]!.strata[0]!.groups,[COMPONENTS[0]])).toBe(1/12);
    expect(rankAtStratum(records[16]!.strata[0]!.groups,[COMPONENTS[0]])).toBe(11/12);
    expect(rankHierarchy(records.slice(1),[COMPONENTS[0]])).toBe('failed');
    expect(rankHierarchy([...records].reverse(),[COMPONENTS[0]])).toBe('failed');
    const swappedGroups=records.map((r,i)=>i?r:{...r,strata:r.strata.map((s,j)=>j?s:{...s,groups:[...s.groups].reverse()})});
    expect(rankHierarchy(swappedGroups,COMPONENTS)).toBe('failed');
    const swapped=records.map((r,i)=>i? r:{...r,strata:[r.strata[1]!,r.strata[0]!,...r.strata.slice(2)]});
    expect(rankHierarchy(swapped,[COMPONENTS[0]])).toBe('failed');
    const wrongMembership=records.map((r,i)=>i?r:{...r,strata:r.strata.map((s,j)=>j!==2?s:{...s,
      groups:s.groups.map(g=>({...g,key:[-5,5] as Key}))})});
    expect(rankHierarchy(wrongMembership,COMPONENTS)).toBe('failed');
    const simple=records.map(r=>({...r,strata:r.strata.map(e=>({...e,groups:e.groups.map((g,i)=>({...g,ranks:i?[1]:[0]}))}))}));
    expect(rankHierarchy(simple,[COMPONENTS[0]])).toBe(1/2);
    expect(mean([1,2**-54,2**-54,2**-54])).toBe(.25000000000000006);
    expect(bits(nonnull(mean([1,2**-54,2**-54,2**-54])))).toBe(bits(.25000000000000006));
  });
});

describe('synthetic TC-CDF-001..003',()=>{
  it('synthetic unsorted duplicate train only and exact mid-CDF distances',()=>{
    const input=[4,2,1,2];
    expect([.5,1,1.5,2,3,4,5].map(z=>midCdf(input,z))).toEqual([0,1/8,1/4,1/2,3/4,7/8,1]);
    expect([1,3,5].map(z=>shapePrimitive(input,[2,4],z))).toEqual([3/8,0,1/8]);
    expect(shapePrimitive(input,[2,2],4)).toBe(3/8);
    const train=[1,2,2,4].map(v=>({partition:'train' as const,interval:[v,v] as const}));
    expect(trainCdf([...train,{partition:'holdout',interval:[100,100]}],3)).toBe(3/4);
    expect(trainCdf([...train,{partition:'holdout',interval:[-100,-100]}],3)).toBe(3/4);
    expect(shapePrimitive([], [2,4],null)).toBeNull();
    expect(shapePrimitive(input,null,NaN)).toBeNull();
    for(const bad of [null,NaN,Infinity,'unreached'] as const)
      expect(shapePrimitive(input,[2,4],bad)).toBe('failed');
  });
  it('synthetic scored features separate and nonflattenable 24 record hierarchy',()=>{
    expect(SCORED_FEATURES).toEqual(['inverseCircularity','normalizedArmLengthCv']);
    expect(REPORT_FEATURES).toEqual(['minorMajorAxisRatio']);
    expect(mean([nonnull(mean([0,1])),nonnull(mean([0,null]))])).toBe(1/4);
    expect(mean([0,1,0])).toBe(1/3);
    const train={inverseCircularity:[4,2,1,2],normalizedArmLengthCv:[4,2,1,2]};
    const fixtureKeys:readonly Key[]=[[-20,5],[-20,15],[-20,25],[-5,5]];
    const records=CHECKPOINTS.flatMap(checkpoint=>Array.from({length:8},(_,seed):ShapeRecord=>({
      checkpoint,seed,strata:STRATA.map((id,index)=>({id,groups:index<4?
        [group(fixtureKeys[index]![0],fixtureKeys[index]![1],'a'),
        group(fixtureKeys[index]![0]-1,fixtureKeys[index]![1],'b')].map((g,gi)=>({
          key:g.key,predictions:{
            inverseCircularity:checkpoint===10?1:checkpoint===20&&seed<4?3:5,
            normalizedArmLengthCv:gi?(index%2?5:3):1
          },
          observations:Array.from({length:gi?1:2},(_,oi):ShapeObservation=>({
            id:'O'+oi,groupKey:g.key,
            intervals:{inverseCircularity:[2,4],normalizedArmLengthCv:oi?[2,2]:[2,4]},
            reportOnly:{minorMajorAxisRatio:[100+seed,200+checkpoint]}
          }))
        })):[]}))
    })));
    const value=shapeHierarchy(records,train);
    expect(value).toBe(13/64);
    expect(value).not.toBe(shapePrimitive(train.inverseCircularity,[2,4],1));
    expect(shapeHierarchy(records.map((r,i)=>i? r:{...r,strata:[r.strata[1]!,r.strata[0]!,...r.strata.slice(2)]}),train)).toBe('failed');
    const reversedGroups=records.map((r,i)=>i?r:{...r,strata:r.strata.map((s,j)=>j?s:{...s,groups:[...s.groups].reverse()})});
    expect(shapeHierarchy(reversedGroups,train)).toBe('failed');
    const wrongMembership=records.map((r,i)=>i?r:{...r,strata:r.strata.map((s,j)=>j!==2?s:{...s,
      groups:s.groups.map(g=>({...g,key:[-5,5] as Key,
        observations:g.observations.map(o=>({...o,groupKey:[-5,5] as Key}))}))})});
    expect(shapeHierarchy(wrongMembership,train)).toBe('failed');
    const reversedObservations=records.map((r,i)=>i?r:{...r,strata:r.strata.map((s,j)=>j?s:{...s,
      groups:s.groups.map((g,gi)=>gi?g:{...g,observations:[...g.observations].reverse()})})});
    expect(shapeHierarchy(reversedObservations,train)).toBe('failed');
    expect(shapeHierarchy(records.map(r=>({...r,strata:r.strata.map(e=>({...e,groups:e.groups.map(g=>({...g,
      observations:g.observations.map(o=>({...o,reportOnly:{minorMajorAxisRatio:null}}))
    }))}))})),train)).toBe(value);
  });
});

describe('synthetic TC-CANDIDATE-001, TC-BASELINE-001, TC-ACCEPT-001',()=>{
  it('synthetic execution order, train selection and global vs candidate null',()=>{
    const xs:Candidate[]=[
      {family:'piecewise-bilinear-map-v1',knots:4,id:'20',tag:1/4,shape:1/3},
      {family:'piecewise-bilinear-map-v1',knots:3,id:'f0',tag:1/4,shape:1/3},
      {family:'piecewise-bilinear-map-v1',knots:3,id:'0a',tag:1/4,shape:1/3},
      {family:'piecewise-bilinear-map-v1',knots:1,id:'null',tag:null,shape:1/3},
      {family:'nearest-train-condition-baseline',knots:0,id:'near',tag:1/2,shape:1/4},
      {family:'condition-blind-baseline',knots:0,id:'blind',tag:1/2,shape:1/3}
    ];
    const available={tag:true,shape:true};
    expect(candidates(xs,available).execution.map(x=>x.id)).toEqual(['blind','near','null','0a','f0','20']);
    expect(candidates(xs,available).selection[0]!.id).toBe('0a');
    expect(candidates(xs,available).failed(xs[3]!)).toBe(true);
    const commonTagNull=xs.map(x=>({...x,tag:null}));
    expect(candidates(commonTagNull,available).failed(commonTagNull[0]!)).toBe(true);
    expect(commonTagNull.every(x=>candidates(commonTagNull,available).failed(x))).toBe(true);
    expect(candidates(commonTagNull,available).globalTagNull).toBe(false);
    expect(candidates(commonTagNull,{tag:false,shape:true}).selection[0]!.id).toBe('near');
    expect(candidates(commonTagNull,{tag:false,shape:true}).globalTagNull).toBe(true);
    expect(()=>candidates(xs.map(x=>({...x,tag:null,shape:null})),{tag:false,shape:false})).toThrow('no-calibration-evidence');
    expect(()=>candidates([{...xs[0]!,family:'unknown' as Family}],available)).toThrow('unknown-family');
    const full=completeBundle(1).observations;
    expect(observationAvailability(full)).toEqual({tag:true,shape:true});
    const noTag=full.map(o=>({...o,morphology:{...o.morphology,basalBranchingLevel:null,
      growthAxis:'indeterminate' as const}}));
    expect(observationAvailability(noTag)).toEqual({tag:false,shape:true});
    const axisOnly=full.map(o=>({...o,morphology:{...o.morphology,basalBranchingLevel:null}}));
    expect(observationAvailability(axisOnly)).toEqual({tag:false,shape:true});
    const noShape=noTag.map(o=>({...o,intervals:{inverseCircularity:null,normalizedArmLengthCv:null}}));
    expect(observationAvailability(noShape)).toEqual({tag:false,shape:false});
    const heldLabelsOnly=full.map(o=>o.partition==='train'?{...o,morphology:{...o.morphology,
      basalBranchingLevel:null,growthAxis:'indeterminate' as const}}:o);
    expect(observationAvailability(heldLabelsOnly)).toEqual({tag:false,shape:true});
    const heldShapeOnly=full.map(o=>o.partition==='train'?{...o,intervals:{
      inverseCircularity:null,normalizedArmLengthCv:null}}:o);
    expect(observationAvailability(heldShapeOnly)).toEqual({tag:true,shape:false});
    expect(()=>candidates(xs.map(x=>({...x,tag:null,shape:null})),observationAvailability(noShape)))
      .toThrow('no-calibration-evidence');
  });
  it('synthetic train mode, even median, group-hash nearest tie, and ordered 24 replication',()=>{
    expect(mode([0,1,1,2],[0,1,2,3])).toBe(1);
    expect(mode([0,1],[0,1,2,3])).toBe(0);
    expect(median([9,1,7,3])).toBe(5);
    const train=[group(-20,5,'a'),group(-10,5,'b')];
    const expected=[...train].sort((a,b)=>keyHash(a.key)<keyHash(b.key)?-1:1)[0]!;
    expect(nearest([-15,5],train).key).toEqual(expected.key);
    const holdout={...group(-15,5,'held'),annotation:{final:'MUTATED HOLDOUT',confidence:'low',interval:null}};
    expect(nearest(holdout.key,train).key).toEqual(expected.key);
    const replicated=baselinePredictions({rank:mode([0,1,1,2],[0,1,2,3]),shape:median([9,1,7,3])});
    expect(replicated.map(r=>[r.checkpoint,r.seed])).toEqual(CHECKPOINTS.flatMap(k=>Array.from({length:8},(_,s)=>[k,s])));
    expect(replicated.every(r=>r.prediction.rank===1&&r.prediction.shape===5)).toBe(true);
  });
  it('synthetic comparator and full Pareto matrix with canonical nine-stratum evidence',()=>{
    const baselines:Candidate[]=[
      {family:'condition-blind-baseline',knots:0,id:'blind',tag:1/2,shape:1/3},
      {family:'nearest-train-condition-baseline',knots:0,id:'near',tag:1/2,shape:1/4}
    ];
    const comparator=candidates(baselines,{tag:true,shape:true}).selection[0]!;
    expect(comparator.id).toBe('near');
    const cases=[[[1/2,1/4],'rejected'],[[1/3,1/4],'accepted'],[[1/2,1/5],'accepted'],
      [[1/3,1/3],'rejected'],[[null,1/5],'failed']] as const;
    for(const [tuple,want] of cases) expect(pareto(tuple,[comparator.tag,comparator.shape])).toBe(want);
    expect(pareto([1/3,null],[1/2,null])).toBe('accepted');
    const evidence=STRATA.map((id,i)=>({stratumId:id,comparator:i%2?1/4:1/2,candidate:i%2?1/5:1/3}));
    expect(evidence.map(e=>e.stratumId)).toEqual(STRATA);
    expect(evidence.map(e=>pareto([e.candidate,null],[e.comparator,null]))).toEqual(Array(9).fill('accepted'));
  });
});

// The complete trace is serialized to a fresh Node process; a separate literal
// CDF and outcome table below anchors correctness independently of this function.
type PipelineBundle={
  observations:readonly {id:string; key:Key; partition:'train'|'holdout';
    morphology:Morphology;
    intervals:{inverseCircularity:readonly[number,number]|null;normalizedArmLengthCv:readonly[number,number]|null};
    growthTimeSeconds:number;squareFieldOfViewUm:number;rawLabel:string;
    raster:readonly[number,number];reportedDimension:readonly[number,number]}[];
  candidates:readonly {family:Family;knots:number;id:string}[];
};
function scoreProtocolStage(bundle:PipelineBundle,hashFactory:typeof createHash,
  holdoutGate:{decision:'approved';selected:string;comparator:string}|null,
  onHoldoutScore?:(candidateId:string)=>void) {
  const order=['T0-S0','T0-S1','T0-S2','T1-S0','T1-S1','T1-S2','T2-S0','T2-S1','T2-S2'];
  const family=['condition-blind-baseline','nearest-train-condition-baseline','piecewise-bilinear-map-v1'];
  const checkpoints=[10,20,40];
  const features=['inverseCircularity','normalizedArmLengthCv'] as const;
  const comps=['compactness','tipDensity','aspectRatio'] as const;
  const componentIds=['branching-compactness-v1','branching-tip-density-v1','axis-aspect-ratio-v1'] as const;
  const average=(xs:number[])=>{
    if(!xs.length)return null;
    let sum=0,c=0;
    for(const x of xs){const next=sum+x;c+=Math.abs(sum)>=Math.abs(x)?sum-next+x:x-next+sum;sum=next;}
    return (sum+c)/xs.length;
  };
  const compareId=(a:string,b:string)=>a<b?-1:a>b?1:0;
  const key=(k:Key)=>'['+k[0]+','+k[1]+']';
  const sha=(s:string)=>hashFactory('sha256').update(s).digest('hex');
  const sign=(x:number)=>x<0?-1:x>0?1:0;
  const bin=(k:Key)=>'T'+(k[0]<-10?0:k[0]<-3?1:2)+'-S'+(k[1]<10?0:k[1]<20?1:2);
  const train=bundle.observations.filter(o=>o.partition==='train');
  const availability=observationAvailability(train);
  if(!availability.tag&&!availability.shape) throw new RangeError('no-calibration-evidence');
  const samples={
    inverseCircularity:train.flatMap(o=>o.intervals.inverseCircularity===null?[]:
      [o.intervals.inverseCircularity[0]/2+o.intervals.inverseCircularity[1]/2]),
    normalizedArmLengthCv:train.flatMap(o=>o.intervals.normalizedArmLengthCv===null?[]:
      [o.intervals.normalizedArmLengthCv[0]/2+o.intervals.normalizedArmLengthCv[1]/2])
  };
  const cdf=(xs:readonly number[],z:number)=>(xs.filter(x=>x<z).length+xs.filter(x=>x===z).length/2)/xs.length;
  const groups=[...new Set(train.map(o=>key(o.key)))];
  for(let i=1;i<groups.length;i++) {
    const a=train.find(o=>key(o.key)===groups[i-1])!,b=train.find(o=>key(o.key)===groups[i])!;
    const ba=bin(a.key),bb=bin(b.key);
    if(order.indexOf(ba)>order.indexOf(bb)||ba===bb&&compareId(groups[i-1]!,groups[i]!)>=0)
      throw new RangeError('noncanonical-group-order');
  }
  const groupRecords=groups.map(k=>({key:k,observations:train.filter(o=>key(o.key)===k).sort((a,b)=>compareId(a.id,b.id))}));
  const mode=(xs:number[])=>[0,1,2].sort((a,b)=>xs.filter(x=>x===b).length-xs.filter(x=>x===a).length||a-b)[0]!;
  const median=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]!:
    a[a.length/2-1]!/2+a[a.length/2]!/2;};
  const rank=(o:typeof train[number],component:typeof comps[number])=>component==='aspectRatio'?
    observedRank(o.morphology,'axis-aspect-ratio-v1'):
    observedRank(o.morphology,'branching-compactness-v1');
  const blind={compactness:mode(train.map(o=>rank(o,'compactness')).filter((n):n is number=>n!==null)),
    tipDensity:mode(train.map(o=>rank(o,'tipDensity')).filter((n):n is number=>n!==null)),
    aspectRatio:mode(train.map(o=>rank(o,'aspectRatio')).filter((n):n is number=>n!==null)),
    inverseCircularity:median(samples.inverseCircularity),
    armLengthCv:median(samples.normalizedArmLengthCv)};
  const nearestTo=(k:Key)=>{
    const options=groupRecords.map(g=>{
      const o=g.observations[0]!;
      const d=((o.key[0]-k[0])/30)**2+((o.key[1]-k[1])/30)**2;
      return {g,d,hash:sha(g.key)};
    }).sort((a,b)=>a.d-b.d||compareId(a.hash,b.hash));
    return options[0]!.g.observations;
  };
  const predict=(candidate:PipelineBundle['candidates'][number],k:Key,seedIndex:number,checkpoint:number)=>{
    if(candidate.family==='condition-blind-baseline') return blind;
    if(candidate.family==='nearest-train-condition-baseline'){
      const nearest=nearestTo(k);
      return {compactness:mode(nearest.map(o=>rank(o,'compactness')).filter((n):n is number=>n!==null)),
        tipDensity:mode(nearest.map(o=>rank(o,'tipDensity')).filter((n):n is number=>n!==null)),
        aspectRatio:mode(nearest.map(o=>rank(o,'aspectRatio')).filter((n):n is number=>n!==null)),
        inverseCircularity:median(nearest.flatMap(o=>o.intervals.inverseCircularity===null?[]:
          [o.intervals.inverseCircularity[0]/2+o.intervals.inverseCircularity[1]/2])),
        armLengthCv:median(nearest.flatMap(o=>o.intervals.normalizedArmLengthCv===null?[]:
          [o.intervals.normalizedArmLengthCv[0]/2+o.intervals.normalizedArmLengthCv[1]/2]))};
    }
    const seedHex=sha('snow-crystal-sim/T1-7/seed-v1/'+seedIndex);
    const noise=parseInt(seedHex.slice(0,4),16)%5;
    const base=(k[0]+30)/30+(k[1]/30)+candidate.knots/10+seedIndex/40+checkpoint/80+noise/100;
    return {compactness:base,tipDensity:base/2,
      aspectRatio:candidate.id==='0a'?-base/3:base/3,
      inverseCircularity:base,armLengthCv:base*2};
  };
  const run=(candidate:PipelineBundle['candidates'][number],observations:typeof train)=>{
    const inputGroups=[...new Set(observations.map(o=>key(o.key)))];
    for(let i=1;i<inputGroups.length;i++) {
      const a=observations.find(o=>key(o.key)===inputGroups[i-1])!;
      const b=observations.find(o=>key(o.key)===inputGroups[i])!;
      if(order.indexOf(bin(a.key))>order.indexOf(bin(b.key))||
        bin(a.key)===bin(b.key)&&compareId(inputGroups[i-1]!,inputGroups[i]!)>=0)
        throw new RangeError('noncanonical-group-order');
    }
    const scored=checkpoints.flatMap(checkpoint=>Array.from({length:8},(_,seedIndex)=>{
      const strata=order.map(stratumId=>{
        const current=observations.filter(o=>bin(o.key)===stratumId);
        const gKeys=[...new Set(current.map(o=>key(o.key)))];
        const perGroup=gKeys.map(gk=>({
          key:gk, observations:current.filter(o=>key(o.key)===gk),
          prediction:predict(candidate,current.find(o=>key(o.key)===gk)!.key,seedIndex,checkpoint)
        }));
        if(perGroup.some(g=>g.observations.some((o,i)=>i>0&&g.observations[i-1]!.id>=o.id)))
          throw new RangeError('noncanonical-observation-order');
        const components=comps.map((component,componentIndex)=>{
          const pairs:number[]=[];
          const fractions:{left:string;right:string;N:number;M:number;
            numerator:number;denominator:number;value:number}[]=[];
          for(let i=0;i<perGroup.length;i++)for(let j=i+1;j<perGroup.length;j++){
            const left=perGroup[i]!,right=perGroup[j]!;
            const p:number[]=[];
            for(const a of left.observations)for(const b of right.observations){
              const ra=rank(a,component),rb=rank(b,component);
              if(ra===null||rb===null) continue;
              const actual=sign(rb-ra);
              const prediction=sign(right.prediction[component]-left.prediction[component]);
              p.push(actual===prediction?0:actual===0||prediction===0?1/2:1);
            }
            if(p.length) {
              const N=p.reduce((n,x)=>n+2*x,0),M=p.length;
              pairs.push(N/(2*M));
              const gcd=(x:number,y:number):number=>y===0?x:gcd(y,x%y);
              const divisor=gcd(N,2*M);
              fractions.push({left:left.key,right:right.key,N,M,
                numerator:N/divisor,denominator:2*M/divisor,value:N/(2*M)});
            }
          }
          return {component:componentIds[componentIndex]!,value:average(pairs),denominator:pairs.length,fractions};
        });
        const tag=average(components.slice(0,2).flatMap(c=>c.value===null?[]:[c.value]));
        const integratedTag=average(components.flatMap(c=>c.value===null?[]:[c.value]));
        const shapeGroups=perGroup.map(g=>{
          const observations=g.observations.map(o=>{
            const values=features.map(feature=>{
              const sample=samples[feature],interval=o.intervals[feature];
              const predicted=feature==='inverseCircularity'?g.prediction.inverseCircularity:g.prediction.armLengthCv;
              if(interval===null||!sample.length) return {feature,value:null};
              const lo=cdf(sample,interval[0]),hi=cdf(sample,interval[1]),u=cdf(sample,predicted);
              return {feature,value:u<lo?lo-u:u>hi?u-hi:0};
            });
            return {id:o.id,values,featureDenominator:values.filter(v=>v.value!==null).length,
              mean:average(values.flatMap(v=>v.value===null?[]:[v.value]))};
          });
          return {key:g.key,prediction:g.prediction,observations,
            denominator:observations.filter(o=>o.mean!==null).length,
            mean:average(observations.flatMap(o=>o.mean===null?[]:[o.mean]))};
        });
        return {stratumId,components,tag,integratedTag,
          tagDenominator:components.slice(0,2).filter(c=>c.value!==null).length,
          integratedTagDenominator:components.filter(c=>c.value!==null).length,
          rankPrimitiveCount:components.reduce((n,c)=>n+c.fractions.reduce((m,p)=>m+p.M,0),0),
          shapeGroups,shapeDenominator:shapeGroups.filter(g=>g.mean!==null).length,
          shapePrimitiveCount:shapeGroups.reduce((n,g)=>n+g.observations.reduce((m,o)=>m+o.featureDenominator,0),0),
          shape:average(shapeGroups.flatMap(g=>g.mean===null?[]:[g.mean]))};
      });
      const seedDigest=hashFactory('sha256').update('snow-crystal-sim/T1-7/seed-v1/'+seedIndex).digest();
      const seedView=new DataView(seedDigest.buffer,seedDigest.byteOffset,seedDigest.byteLength);
      return {checkpoint,seedIndex,step:checkpoint+seedIndex,
        seedSha256:sha('snow-crystal-sim/T1-7/seed-v1/'+seedIndex),
        seedWords:[0,4,8,12].map(offset=>seedView.getUint32(offset,true)),
        strata,tagDenominator:strata.filter(s=>s.tag!==null).length,
        integratedTagDenominator:strata.filter(s=>s.integratedTag!==null).length,
        shapeDenominator:strata.filter(s=>s.shape!==null).length,
        tag:average(strata.flatMap(s=>s.tag===null?[]:[s.tag])),
        integratedTag:average(strata.flatMap(s=>s.integratedTag===null?[]:[s.integratedTag])),
        shape:average(strata.flatMap(s=>s.shape===null?[]:[s.shape]))};
    }));
    const byCheckpoint=checkpoints.map(checkpoint=>{
      const rows=scored.filter(r=>r.checkpoint===checkpoint);
      return {checkpoint,tagDenominator:rows.filter(r=>r.tag!==null).length,
        integratedTagDenominator:rows.filter(r=>r.integratedTag!==null).length,
        shapeDenominator:rows.filter(r=>r.shape!==null).length,
        tag:average(rows.flatMap(r=>r.tag===null?[]:[r.tag])),
        integratedTag:average(rows.flatMap(r=>r.integratedTag===null?[]:[r.integratedTag])),
        shape:average(rows.flatMap(r=>r.shape===null?[]:[r.shape]))};
    });
    return {tag:average(byCheckpoint.flatMap(r=>r.tag===null?[]:[r.tag])),
      integratedTag:average(byCheckpoint.flatMap(r=>r.integratedTag===null?[]:[r.integratedTag])),
      shape:average(byCheckpoint.flatMap(r=>r.shape===null?[]:[r.shape])),
      tagDenominator:byCheckpoint.filter(r=>r.tag!==null).length,
      integratedTagDenominator:byCheckpoint.filter(r=>r.integratedTag!==null).length,
      shapeDenominator:byCheckpoint.filter(r=>r.shape!==null).length,
      byCheckpoint,records:scored};
  };
  const evaluated=bundle.candidates.map(candidate=>({...candidate,train:run(candidate,train)}));
  const execution=[...evaluated].sort((a,b)=>family.indexOf(a.family)-family.indexOf(b.family)||
    a.knots-b.knots||compareId(a.id,b.id));
  const selected=[...evaluated].filter(c=>c.family==='piecewise-bilinear-map-v1')
    .sort((a,b)=>(availability.tag?a.train.tag??Infinity:0)-(availability.tag?b.train.tag??Infinity:0)||
      (a.train.shape??Infinity)-(b.train.shape??Infinity)||a.knots-b.knots||compareId(a.id,b.id))[0]!;
  const comparator=evaluated.filter(c=>c.family!=='piecewise-bilinear-map-v1')
    .sort((a,b)=>(availability.tag?a.train.tag??Infinity:0)-(availability.tag?b.train.tag??Infinity:0)||
      (a.train.shape??Infinity)-(b.train.shape??Infinity)||
      family.indexOf(a.family)-family.indexOf(b.family))[0]!;
  const training={execution:execution.map(c=>c.id),selected:selected.id,comparator:comparator.id,
    availability,blind,trainSamples:samples,evaluated};
  if(holdoutGate===null) return training;
  if(holdoutGate.decision!=='approved'||holdoutGate.selected!==selected.id||
    holdoutGate.comparator!==comparator.id) throw new RangeError('holdout-gate-mismatch');
  const holdout=bundle.observations.filter(o=>o.partition==='holdout');
  const holdoutResults=[selected,comparator].map(candidate=>{
    onHoldoutScore?.(candidate.id);
    return {id:candidate.id,result:run(candidate,holdout)};
  });
  const selectedHoldout=holdoutResults[0]!.result;
  const comparatorHoldout=holdoutResults[1]!.result;
  const a=[selectedHoldout.tag,selectedHoldout.shape],b=[comparatorHoldout.tag,comparatorHoldout.shape];
  const outcome=a.some((x,i)=>x===null&&b[i]!==null)?'failed':
    a.some((x,i)=>x!==null&&b[i]!==null&&x>b[i]!)?'rejected':
      a.some((x,i)=>x!==null&&b[i]!==null&&x<b[i]!)?'accepted':'rejected';
  return {...training,outcome,holdoutResults};
}
function completeScore(bundle:PipelineBundle,hashFactory:typeof createHash) {
  return scoreProtocolStage(bundle,hashFactory,null);
}
function evaluateHoldout(bundle:PipelineBundle,training:ReturnType<typeof completeScore>,
  hashFactory:typeof createHash,decision:'approved'|'pending',
  onHoldoutScore?:(candidateId:string)=>void) {
  if(decision!=='approved') throw new RangeError('holdout-gate-mismatch');
  const result=scoreProtocolStage(bundle,hashFactory,
    {decision,selected:training.selected,comparator:training.comparator},onHoldoutScore);
  if(!('outcome' in result)) throw new Error('holdout-not-evaluated');
  return result;
}
function completeBundle(scale:number):PipelineBundle {
  const locations:[number,number][]= [[-20,5],[-20,15],[-5,5],[-5,15]];
  const observations=locations.flatMap(([t,s],stratumIndex)=>Array.from({length:4},(_,g)=>({
    id:'S'+stratumIndex+'G'+g,key:[t-g/4,s] as Key,
    partition:(g>=2?'holdout':'train') as 'train'|'holdout',
    morphology:{basalBranchingLevel:(g===0?0:g===1?2:g===2?1:2) as 0|1|2|3,
      growthAxis:(g===0||g===3?'basal-dominant':g===1?'mixed':'c-axis-dominant') as Morphology['growthAxis'],
      hollowing:(g%2?'present':'absent') as Morphology['hollowing']},
    intervals:{inverseCircularity:[1+g,2+g] as const,normalizedArmLengthCv:[2+g,3+g] as const},
    growthTimeSeconds:120*scale,squareFieldOfViewUm:400*scale,
    rawLabel:'raw-'+scale,raster:[800*scale,600*scale] as const,
    reportedDimension:[2*scale,3*scale] as const
  })));
  return {observations,candidates:[
    {family:'condition-blind-baseline',knots:0,id:'blind'},
    {family:'nearest-train-condition-baseline',knots:0,id:'nearest'},
    {family:'piecewise-bilinear-map-v1',knots:3,id:'0a'},
    {family:'piecewise-bilinear-map-v1',knots:4,id:'20'}
  ]};
}
// Hand-derived from the fixture's two tied train midpoints per stratum:
// inverseCircularity [1.5 x 4, 2.5 x 4], arm CV [2.5 x 4, 3.5 x 4].
// This oracle does not call completeScore, its CDF, or its averaging routine.
const LITERAL_NOISE=[0,4,0,3,2,1,4,3] as const;
const LITERAL_STRATUM_KEYS=[[-20,5],[-20,15],[-5,5],[-5,15]] as const;
const LITERAL_NONEMPTY_INDEX=[0,1,3,4] as const;
const LITERAL_FINAL={
  blind:{train:[1/2,0],holdout:[1/2,1/2],integratedTrain:1/2,integratedHoldout:1/2,
    trainShapeCheckpoints:[0,0,0],holdoutShapeCheckpoints:[1/2,1/2,1/2]},
  nearest:{train:[0,0],holdout:[1/2,1/4],integratedTrain:0,integratedHoldout:1/2,
    trainShapeCheckpoints:[0,0,0],holdoutShapeCheckpoints:[1/4,1/4,1/4]},
  '0a':{train:[1,187/1536],holdout:[1,9/16],integratedTrain:2/3,integratedHoldout:1,
    trainShapeCheckpoints:[71/512,60/512,56/512],
    holdoutShapeCheckpoints:[340/512,310/512,214/512]},
  '20':{train:[1,166/1536],holdout:[1,253/512],integratedTrain:1,integratedHoldout:2/3,
    trainShapeCheckpoints:[60/512,52/512,54/512],
    holdoutShapeCheckpoints:[313/512,264/512,182/512]}
} as const;
function literalMidCdf(twoSamplesStart:number,z:number):number {
  if(z<twoSamplesStart) return 0;
  if(z===twoSamplesStart) return 1/4;
  if(z<twoSamplesStart+1) return 1/2;
  if(z===twoSamplesStart+1) return 3/4;
  return 1;
}
function literalPrimitive(id:keyof typeof LITERAL_FINAL,partition:'train'|'holdout',
  stratumIndex:number,localGroup:number,checkpoint:number,seedIndex:number) {
  const [t,s]=LITERAL_STRATUM_KEYS[stratumIndex]!;
  const g=partition==='train'?localGroup:localGroup+2;
  let predictedInverse:number,predictedArm:number;
  if(id==='blind') {predictedInverse=2;predictedArm=3;}
  else if(id==='nearest') {
    predictedInverse=g===0?1.5:2.5;
    predictedArm=g===0?2.5:3.5;
  } else {
    const knot=id==='0a'?3:4;
    const b=(t-g/4+30)/30+s/30+knot/10+seedIndex/40+checkpoint/80+LITERAL_NOISE[seedIndex]!/100;
    predictedInverse=b;predictedArm=2*b;
  }
  const inv=literalMidCdf(1.5,predictedInverse);
  const arm=literalMidCdf(2.5,predictedArm);
  const distance=(u:number)=>g===0?Math.max(0,u-1/2):g===1?Math.max(0,1/2-u):1-u;
  return {prediction:[predictedInverse,predictedArm] as const,
    values:[distance(inv),distance(arm)] as const};
}
describe('synthetic TC-SCALE-001..002 and full process determinism',()=>{
  it('synthetic paired bundles through 24 primitive records, baselines and Pareto evidence',()=>{
    const trainA=completeScore(completeBundle(1),createHash);
    const trainB=completeScore(completeBundle(2),createHash);
    exactTrace(trainA,trainB);
    const scoreSpy=vi.fn();
    const a=evaluateHoldout(completeBundle(1),trainA,createHash,'approved',scoreSpy);
    const b=evaluateHoldout(completeBundle(2),trainB,createHash,'approved');
    exactTrace(a,b);
    expect(a.availability).toEqual({tag:true,shape:true});
    expect(a.trainSamples).toEqual({inverseCircularity:[1.5,2.5,1.5,2.5,1.5,2.5,1.5,2.5],
      normalizedArmLengthCv:[2.5,3.5,2.5,3.5,2.5,3.5,2.5,3.5]});
    expect(a.blind).toEqual({compactness:0,tipDensity:0,aspectRatio:0,inverseCircularity:2,armLengthCv:3});
    expect(a.execution).toEqual(['blind','nearest','0a','20']);
    expect(a.selected).toBe('20');
    expect(a.comparator).toBe('nearest');
    expect(a.outcome).toBe('rejected');
    expect(scoreSpy.mock.calls).toEqual([['20'],['nearest']]);
    expect(scoreSpy).toHaveBeenCalledTimes(2);
    expect(scoreSpy).toHaveBeenNthCalledWith(1,'20');
    expect(scoreSpy).toHaveBeenNthCalledWith(2,'nearest');
    expect(scoreSpy.mock.calls.filter(([id])=>id==='blind'||id==='0a')).toHaveLength(0);
    expect(a.holdoutResults.filter(({id})=>id==='20')).toHaveLength(1);
    expect(a.holdoutResults.filter(({id})=>id==='nearest')).toHaveLength(1);
    expect(a.holdoutResults.map(({id,result})=>[id,result.tag,result.shape]))
      .toEqual([['20',1,253/512],['nearest',1/2,1/4]]);
    expect(a.holdoutResults.filter(({id})=>id==='blind'||id==='0a')).toEqual([]);
    expect(a.evaluated.map(c=>Object.hasOwn(c,'holdout'))).toEqual([false,false,false,false]);
    const map0a=a.evaluated.find(c=>c.id==='0a')!;
    const map20=a.evaluated.find(c=>c.id==='20')!;
    expect(map0a.train.tag).toBe(map20.train.tag);
    expect(map20.train.shape!<map0a.train.shape!).toBe(true);
    expect(map0a.train.integratedTag!<map20.train.integratedTag!).toBe(true);
    const reordered=completeBundle(1);
    const observations=[...reordered.observations];
    [observations[0],observations[1]]=[observations[1]!,observations[0]!];
    expect(()=>completeScore({...reordered,observations},createHash)).toThrow('noncanonical-group-order');
    const duplicate=[...reordered.observations];
    duplicate.splice(1,0,{...duplicate[0]!,id:'A-before-S0G0'});
    expect(()=>completeScore({...reordered,observations:duplicate},createHash))
      .toThrow('noncanonical-observation-order');
    const checkedRuns=[
      ...a.evaluated.map(c=>({id:c.id,partition:'train' as const,result:c.train})),
      ...a.holdoutResults.map(c=>({id:c.id,partition:'holdout' as const,result:c.result}))
    ];
    for(const {id:rawId,partition,result} of checkedRuns) {
      const id=rawId as keyof typeof LITERAL_FINAL;
      const literal=LITERAL_FINAL[id];
      expect([result.tag,result.shape]).toEqual(literal[partition]);
      expect(result.integratedTag).toBe(partition==='train'?literal.integratedTrain:literal.integratedHoldout);
      expect(result.byCheckpoint.map(r=>r.shape)).toEqual(
        partition==='train'?literal.trainShapeCheckpoints:literal.holdoutShapeCheckpoints);
      {
        expect([result.tagDenominator,result.shapeDenominator]).toEqual([3,3]);
        for(const [ri,record] of result.records.entries()) {
          const checkpoint=CHECKPOINTS[Math.floor(ri/8)]!,seedIndex=ri%8;
          expect([record.checkpoint,record.seedIndex,record.step]).toEqual([checkpoint,seedIndex,checkpoint+seedIndex]);
          expect(record.seedSha256).toBe(seed(seedIndex).sha256);
          expect(record.seedWords).toEqual(seed(seedIndex).words);
          expect([record.tagDenominator,record.shapeDenominator]).toEqual([4,4]);
          expect(record.strata.map(s=>s.stratumId)).toEqual(STRATA);
          const rowShapes:number[]=[];
          for(const [si,stratumRecord] of record.strata.entries()) {
            const active=LITERAL_NONEMPTY_INDEX.indexOf(si as 0|1|3|4);
            if(active<0) {
              expect([stratumRecord.tag,stratumRecord.shape,stratumRecord.tagDenominator,
                stratumRecord.shapeDenominator,stratumRecord.rankPrimitiveCount,stratumRecord.shapePrimitiveCount])
                .toEqual([null,null,0,0,0,0]);
              expect(stratumRecord.components.map(c=>[c.value,c.denominator,c.fractions])).toEqual([
                [null,0,[]],[null,0,[]],[null,0,[]]]);
              continue;
            }
            const [t,s]=LITERAL_STRATUM_KEYS[active]!;
            const left=partition==='train'?0:2,right=left+1;
            const leftKey='['+(t-left/4)+','+s+']',rightKey='['+(t-right/4)+','+s+']';
            const pairNs=id==='blind'? [1,1,1]:id==='nearest'?[partition==='train'?0:1,partition==='train'?0:1,partition==='train'?0:1]:
              id==='0a'?[2,2,partition==='train'?0:2]:partition==='train'?[2,2,2]:[2,2,0];
            const expectedTag=(pairNs[0]!+pairNs[1]!)/4;
            const expectedIntegratedTag=pairNs.reduce((n,x)=>n+x,0)/6;
            expect(stratumRecord.components.map(c=>[c.component,c.value,c.denominator,
              c.fractions.map(p=>[p.left,p.right,p.N,p.M,p.numerator,p.denominator,p.value])])).toEqual(
              COMPONENTS.map((component,i)=>[component,pairNs[i]!/2,1,
                [[leftKey,rightKey,pairNs[i]!,1,
                  pairNs[i]===1?1:pairNs[i]===2?1:0,pairNs[i]===1?2:1,pairNs[i]!/2]]]));
            expect([stratumRecord.tag,stratumRecord.integratedTag,stratumRecord.tagDenominator,
              stratumRecord.integratedTagDenominator,stratumRecord.rankPrimitiveCount])
              .toEqual([expectedTag,expectedIntegratedTag,2,3,3]);
            expect(stratumRecord.shapeGroups.map(g=>g.key)).toEqual([leftKey,rightKey]);
            const groupMeans:number[]=[];
            for(const [gi,g] of stratumRecord.shapeGroups.entries()) {
              const expected=literalPrimitive(id,partition,active,gi,checkpoint,seedIndex);
              const observed=g.observations[0]!;
              expect(g.prediction.inverseCircularity).toBe(expected.prediction[0]);
              expect(g.prediction.armLengthCv).toBe(expected.prediction[1]);
              expect([observed.id,observed.values.map(v=>v.value),observed.featureDenominator,observed.mean,
                g.denominator,g.mean]).toEqual([
                'S'+active+'G'+(left+gi),[...expected.values],2,
                (expected.values[0]+expected.values[1])/2,1,
                (expected.values[0]+expected.values[1])/2]);
              groupMeans.push((expected.values[0]+expected.values[1])/2);
            }
            const expectedShape=(groupMeans[0]!+groupMeans[1]!)/2;
            expect([stratumRecord.shape,stratumRecord.shapeDenominator,stratumRecord.shapePrimitiveCount])
              .toEqual([expectedShape,2,4]);
            rowShapes.push(expectedShape);
          }
          const expectedRecordShape=rowShapes.reduce((x,y)=>x+y,0)/4;
          const expectedRecordTag=partition==='train'?id==='blind'?1/2:id==='nearest'?0:1:
            id==='blind'||id==='nearest'?1/2:1;
          const expectedRecordIntegratedTag=id==='0a'?partition==='train'?2/3:1:
            partition==='train'?expectedRecordTag:id==='blind'||id==='nearest'?1/2:2/3;
          expect([record.tag,record.integratedTag,record.shape])
            .toEqual([expectedRecordTag,expectedRecordIntegratedTag,expectedRecordShape]);
        }
        expect(result.byCheckpoint.map(r=>[r.checkpoint,r.tagDenominator,r.shapeDenominator]))
          .toEqual([[10,8,8],[20,8,8],[40,8,8]]);
      }
      expect(result.records).toHaveLength(24);
      expect(result.records.map(r=>[r.checkpoint,r.seedIndex]))
        .toEqual(CHECKPOINTS.flatMap(k=>Array.from({length:8},(_,s)=>[k,s])));
      expect(result.records[0]!.strata.map(s=>s.stratumId)).toEqual(STRATA);
      expect(result.records.every(r=>r.strata.some(s=>s.components.some(c=>c.value!==null)))).toBe(true);
      expect(result.records.every(r=>r.strata.some(s=>s.shapeGroups.length>0))).toBe(true);
      expect(result.records.every(r=>r.step<=40021)).toBe(true);
    }
    expect(a.holdoutResults.every(c=>c.result.tag!==null&&c.result.shape!==null)).toBe(true);
    const pendingSpy=vi.fn();
    expect(()=>evaluateHoldout(completeBundle(1),trainA,createHash,'pending',pendingSpy))
      .toThrow('holdout-gate-mismatch');
    expect(pendingSpy).not.toHaveBeenCalled();
    const changed=completeBundle(1);
    const heldAnnotation={...changed,observations:changed.observations.map(o=>o.partition==='train'?o:
      {...o,morphology:{basalBranchingLevel:null,growthAxis:'indeterminate' as const,
        hollowing:'indeterminate' as const}})};
    const heldShape={...changed,observations:changed.observations.map(o=>o.partition==='train'?o:
      {...o,intervals:{inverseCircularity:null,normalizedArmLengthCv:null}})};
    for(const mutated of [heldAnnotation,heldShape]) {
      const mutatedTrain=completeScore(mutated,createHash);
      exactTrace(mutatedTrain,trainA);
      expect([mutatedTrain.selected,mutatedTrain.comparator]).toEqual(['20','nearest']);
    }
    const mutationSpy=vi.fn();
    const changedAnnotationEvaluation=evaluateHoldout(heldAnnotation,trainA,createHash,'approved',mutationSpy);
    const changedShapeEvaluation=evaluateHoldout(heldShape,trainA,createHash,'approved',mutationSpy);
    expect(mutationSpy.mock.calls).toEqual([['20'],['nearest'],['20'],['nearest']]);
    for(const changedEvaluation of [changedAnnotationEvaluation,changedShapeEvaluation]) {
      expect([changedEvaluation.selected,changedEvaluation.comparator]).toEqual(['20','nearest']);
      expect(changedEvaluation.holdoutResults.map(c=>c.id)).toEqual(['20','nearest']);
      expect(changedEvaluation.holdoutResults.some(c=>c.id==='blind'||c.id==='0a')).toBe(false);
      expect(changedEvaluation.evaluated.every(c=>!Object.hasOwn(c,'holdout'))).toBe(true);
    }
    expect(changedAnnotationEvaluation.holdoutResults.some((c,i)=>
      c.result.tag!==a.holdoutResults[i]!.result.tag)).toBe(true);
    expect(changedShapeEvaluation.holdoutResults.some((c,i)=>
      c.result.shape!==a.holdoutResults[i]!.result.shape)).toBe(true);
  });
  it('synthetic incomplete, reordered, unreachable, nonfinite and over-limit candidate runs',()=>{
    const good:ExecutionRecord[]=CHECKPOINTS.flatMap(checkpoint=>Array.from({length:8},(_,seed)=>({
      checkpoint,seed,step:checkpoint+seed,state:'ok' as const,
      tag:checkpoint===10?0:checkpoint===20&&seed<4?0:1,
      shape:checkpoint===10?1/4:checkpoint===20?1/2:3/4
    })));
    const full=completeBundle(1).observations;
    const noTag=full.map(o=>({...o,morphology:{...o.morphology,basalBranchingLevel:null,
      growthAxis:'indeterminate' as const}}));
    const noShape=full.map(o=>({...o,intervals:{inverseCircularity:null,normalizedArmLengthCv:null}}));
    expect(executionResult(good,full)).toMatchObject({status:'ok',tag:1/2,shape:1/2});
    expect(executionResult(good.map(r=>({...r,tag:null})),noTag)).toMatchObject({status:'ok',tag:null,shape:1/2});
    expect(executionResult(good.map(r=>({...r,shape:null})),noShape)).toMatchObject({status:'ok',tag:1/2,shape:null});
    expect(executionResult(good.map(r=>({...r,tag:null})),full)).toMatchObject({status:'failed',reason:'candidate-tag-null'});
    expect(executionResult(good.map(r=>({...r,shape:null})),full)).toMatchObject({status:'failed',reason:'candidate-shape-null'});
    expect(()=>executionResult(good,noTag.map(o=>({...o,intervals:{inverseCircularity:null,
      normalizedArmLengthCv:null}})))).toThrow('no-calibration-evidence');
    for(const changed of [good.slice(1),[...good].reverse(),[...good.slice(0,23),good[0]!]])
      expect(executionResult(changed,full)).toMatchObject({status:'failed',reason:'record-order'});
    for(const state of ['checkpoint-not-reached','reservoir-boundary-reached','non-finite-metric','max-step-exceeded'] as const)
      expect(executionResult(good.map((r,i)=>i? r:{...r,state}),full))
        .toMatchObject({status:'failed',reason:'unusable-record'});
    expect(executionResult(good.map((r,i)=>i?r:{...r,step:40022}),full)).toMatchObject({status:'failed'});
    expect(executionResult(good.map((r,i)=>i?r:{...r,tag:NaN}),full)).toMatchObject({status:'failed'});
    expect(executionResult(good.map((r,i)=>i?r:{...r,shape:Infinity}),full)).toMatchObject({status:'failed'});
  });
  it('synthetic entire calculation twice here and once in a fresh process',()=>{
    for(const invalid of [-0,NaN,Infinity,-Infinity]) expect(()=>packTrace({loss:invalid})).toThrow('invalid-binary64');
    expect(()=>exactTrace({ordered:[1,2]},{ordered:[2,1]})).toThrow();
    const bundle=completeBundle(1);
    const firstTrain=completeScore(bundle,createHash);
    const secondTrain=completeScore(bundle,createHash);
    exactTrace(secondTrain,firstTrain);
    const first={train:firstTrain,holdout:evaluateHoldout(bundle,firstTrain,createHash,'approved')};
    const second={train:secondTrain,holdout:evaluateHoldout(bundle,secondTrain,createHash,'approved')};
    exactTrace(second,first);
    const script='const STRATA='+JSON.stringify(STRATA)+'; const SCORED_FEATURES='+JSON.stringify(SCORED_FEATURES)+
      '; const keyJson='+keyJson.toString()+'; const stratum='+stratum.toString()+
      '; const observedRank='+observedRank.toString()+'; const observationAvailability='+observationAvailability.toString()+
      '; const bits='+bits.toString()+'; const packTrace='+packTrace.toString()+
      '; const scoreProtocolStage='+scoreProtocolStage.toString()+'; const input='+JSON.stringify(bundle)+
      '; const crypto=require("node:crypto"); const train=scoreProtocolStage(input,crypto.createHash,null)'+
      '; const holdout=scoreProtocolStage(input,crypto.createHash,{decision:"approved",selected:train.selected,comparator:train.comparator})'+
      '; process.stdout.write(JSON.stringify(packTrace({train,holdout})))';
    const child=spawnSync((globalThis as unknown as {process:{execPath:string}}).process.execPath,['-e',script],
      {encoding:'utf8',maxBuffer:20_000_000});
    expect(child.status,child.stderr).toBe(0);
    exactTrace(JSON.parse(child.stdout),packTrace(first));
  });
});

describe('synthetic TC-PROTOCOL-001..002',()=>{
  it('synthetic radius-115 lattice and ring and all first crossings',()=>{
    const lattice:Key[]=[],ring:Key[]=[];
    for(let q=-115;q<=115;q++) for(let r=-115;r<=115;r++) {
      const radius=Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));
      if(radius<=115) lattice.push([q,r]);
      if(radius===115) ring.push([q,r]);
    }
    expect(lattice).toHaveLength(40021);
    expect(ring).toHaveLength(690);
    expect(Math.min(...ring.map(([q,r])=>q*q+q*r+r*r))).toBe(9919);
    expect(ring).toContainEqual([115,-57]);
    expect(ring).toContainEqual([115,-58]);
    expect(Math.sqrt(9919)/2).toBe(49.79708826829135);
    expect(40<Math.sqrt(9919)/2).toBe(true);
    const states=[{basalRadiusCells:9,step:1},{basalRadiusCells:10,step:2},
      {basalRadiusCells:19,step:3},{basalRadiusCells:20,step:4},
      {basalRadiusCells:39,step:5},{basalRadiusCells:40,step:6},{basalRadiusCells:80,step:7}];
    expect(CHECKPOINTS.map(k=>firstCrossing(states,k).step)).toEqual([2,4,6]);
    for(const bad of [11,30,50]) expect(()=>firstCrossing(states,bad)).toThrow();
    for(const mutation of [
      [{basalRadiusCells:10,step:40022}],
      [{basalRadiusCells:10,step:1,physicalTime:120}],
      [{basalRadiusCells:10,step:1,alternate:true}],
      [{basalRadiusCells:10,step:1,best:true}]
    ]) expect(()=>firstCrossing(mutation,10)).toThrow();
  });
  it('synthetic eight literal seed hashes and four LE words',()=>{
    const expected=[
      ['067267644959298fcccf5751a438cb6eedcefe325f085997025e29a6fd7fd6af',[1684500998,2401851721,1364709324,1858812068]],
      ['7061bcfbe7242c394ac03d46ed5d1496e87e17821f5e2a1f4abb637423493aff',[4223426928,959194343,1178452042,2517917165]],
      ['7df501fec43bd4feaf6bca052062d0cb36203c27de50e1cb65e495b0db001996',[4261541245,4275321796,97151919,3419431456]],
      ['5d41398e0d5790438b7f804de7f351fc2a9acaf7399ed30c1f08a35b13c6070b',[2386116957,1133532941,1300266891,4233229287]],
      ['82e8a7e0b0be4953a50179247e748c2077006dec0d51b4586aad68c57e7efdeb',[3769100418,1397341872,611910053,546075774]],
      ['d21f3ac2b8df5e280d04f0b42b12f54ee705e31fae215c94faa7e584f4df7e62',[3258589138,677306296,3035628557,1324683819]],
      ['926c9755bb09b0b5b9b686f9f129be4d258a49d9cba8cc26270e4587a2af8966',[1435987090,3048212923,4186355385,1304308209]],
      ['5d4b43b7013caec4be9bc34702737ff707b244c60771f4e9486bb7e7682c544c',[3074640733,3299752961,1204001726,4152324866]]
    ] as const;
    expected.forEach(([sha256,words],i)=>{
      expect(seed(i).sha256).toBe(sha256);
      expect(seed(i).words).toEqual(words);
      expect(seed(i).words.some(word=>word!==0)).toBe(true);
    });
  });
});
