import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, relative, isAbsolute } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { assert, ROOT, sha, hash, jcs, clone, cmp, good, bad } from './pilot-oracle.mjs';
import { ACTORS, FIELDS } from './pilot-contract-fixtures.mjs';

export const inside=(root,path)=>{const r=relative(resolve(root),resolve(path));return r===''||!r.startsWith('..')&&!isAbsolute(r);};
export function createIsolatedRoot(){
  const root=fs.mkdtempSync(resolve(tmpdir(),'snow-crystal-pilot-tests-'));
  assert(!inside(ROOT,root));fs.mkdirSync(resolve(root,'inputs'));fs.mkdirSync(resolve(root,'validation'));
  const sentinels=['SOURCE-AUDIT.json','human-approval-export.json','LocalStorage-export.json'];
  for(const name of sentinels)fs.writeFileSync(resolve(root,'inputs',name),`synthetic immutable ${name}\n`,{flag:'wx'});
  return root;
}
export function repositorySnapshot(){
  // Includes every tracked file, not just source code; ignores generated temp and
  // dependency trees. Paths are obtained read-only without shell interpolation.
  const files=execFileSync('git',['ls-files','-z','--cached'],{cwd:ROOT,encoding:'utf8'}).split('\0').filter(Boolean).sort(cmp);
  return files.map(path=>[path,sha(fs.readFileSync(resolve(ROOT,path)))]);
}
export function isolatedSnapshot(root){return fs.readdirSync(resolve(root,'inputs'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const file=resolve(e.parentPath,e.name);return[relative(root,file),sha(fs.readFileSync(file))];}).sort((a,b)=>cmp(a[0],b[0]));}
export function isolationCases(root){
  const inputHashes=isolatedSnapshot(root),production=resolve(ROOT,'apps/snow-crystal-sim/calibration/libbrecht-2023-figure2-v1');
  const productionBasenames=fs.existsSync(production)?fs.readdirSync(production).sort(cmp):[];
  const allowedProductionBasenames=['SHA256SUMS','corpus.json','protocol.json','split.json'];
  assert(productionBasenames.every(name=>allowedProductionBasenames.includes(name)));
  const base={repositoryRoot:ROOT,workspaceRoot:ROOT,PILOT_WORK_ROOT:root,outputRoot:resolve(root,'validation'),readOnlyInputHashes:inputHashes,productionBasenames,allowedRepositoryOutputKinds:['contract','protocol','test-source','privacy-reviewed-hash','byte-length','count','aggregate','limitation','stable-stop-reason'],requestedOutputs:[{destination:resolve(root,'validation','aggregate.json'),kind:'aggregate',value:{imageCount:24,coverageScope:'pilot-24'}}],atomicWrite:{temporaryBasename:'aggregate.tmp',finalBasename:'aggregate.json',reparse:true,rehash:true,flush:true,rename:true,simulateFailureBeforeRename:false}};
  good('isolation',base,{outputFileSha256:sha('{"coverageScope":"pilot-24","imageCount":24}\n'),atomic:true});
  for(const badRoot of [ROOT,resolve(ROOT,'tmp/pilot'),resolve(ROOT,'apps/snow-crystal-sim'),resolve(ROOT,'apps/snow-crystal-sim/tests/pilot')])bad('isolation',base,f=>{f.PILOT_WORK_ROOT=badRoot;},'work-root-inside-repository','PILOT_WORK_ROOT');
  for(const kind of ['pdf','page-raster','crop','derivative','mask','restricted-map','source-mapping','raw-response','free-image-description','pii','credential','chat-url','account'])bad('isolation',base,f=>{f.requestedOutputs[0].kind=kind;f.requestedOutputs[0].destination=resolve(ROOT,`forbidden-${kind}.json`);},'output-forbidden','requestedOutputs','RangeError',kind);
  for(const target of [resolve(root,'..','escape.json'),resolve(root,'inputs','SOURCE-AUDIT.json'),resolve(root,'inputs','LocalStorage-export.json'),resolve(production,'corpus.json')])bad('isolation',base,f=>{f.requestedOutputs[0].destination=target;},'output-path-forbidden','destination');
  for(const field of ['reparse','rehash','flush','rename'])bad('isolation',base,f=>{f.atomicWrite[field]=false;},'atomic-write-required',`atomicWrite.${field}`);
  const fail=clone(base);fail.atomicWrite.simulateFailureBeforeRename=true;fail.atomicWrite.temporaryBasename='atomic-failure.tmp';fail.atomicWrite.finalBasename='atomic-failure.json';fail.requestedOutputs[0].destination=resolve(root,'validation','atomic-failure.json');good('isolation-atomic-failure',fail,{finalFileExists:false,partialFinalFileExists:false});
  bad('isolation',base,f=>{f.requestedOutputs[0].destination=resolve(root,'validation','../inputs/SOURCE-AUDIT.json');},'output-path-forbidden','destination');
  bad('isolation',base,f=>{f.atomicWrite.finalBasename='unknown-output.json';},'output-basename-forbidden','finalBasename');
  bad('isolation',base,f=>{f.atomicWrite.temporaryBasename='unknown-output.tmp';},'output-basename-forbidden','temporaryBasename');
  return{base,inputHashes,production,productionBasenames};
}

// Used only around validator execution, never to perform its work. Both sync and
// promise writes are checked, and network entry points throw before side effects.
export function guardEffects(root,networkOnly=false){
  const restores=[],writes=[],networkCalls=[],events=[],descriptors=new Map();let current=null,callNumber=0;
  const original={mkdirSync:fs.mkdirSync,readFileSync:fs.readFileSync,readdirSync:fs.readdirSync};
  const patch=(object,key,fn)=>{if(typeof object[key]!=='function')return;const old=object[key];object[key]=fn(old);restores.push(()=>{object[key]=old;});};
  const pathValue=p=>typeof p==='number'?descriptors.get(p):p instanceof URL?decodeURIComponent(p.pathname).replace(/^\/([A-Za-z]:)/,'$1'):typeof p==='string'||Buffer.isBuffer(p)?String(p):null;
  function event(operation,p,to=null){
    if(networkOnly)return;
    const path=pathValue(p),target=to===null?null:pathValue(to),entry={operation,path:path===null?null:resolve(path),to:target===null?null:resolve(target)};
    events.push(entry);if(!['read','close'].includes(operation))writes.push(entry);
    if(operation==='read'){
      if(path!==null)assert(!/^pilot-.*\.mjs$|^libbrecht-2023-figure2-morphology-pilot\.test\.ts$/.test(path.split(/[\\/]/).at(-1)),'validator-test-oracle-read-forbidden');return;
    }
    if(operation==='close')return;
    assert(current?.atomic,'validator-validation-only-write-forbidden');
    assert.equal(entry.path,current.temp,'validator-unknown-output-basename');
    if(operation==='rename'){assert(!current.failure,'validator-failure-must-not-rename');assert.equal(entry.to,current.final,'validator-unknown-output-basename');}
    else assert(['open-write','write','flush','remove'].includes(operation),'validator-non-atomic-operation-forbidden');
    if(operation==='remove')assert(current.failure,'validator-unexpected-temp-removal');
  }
  for(const key of ['writeFileSync','appendFileSync','truncateSync','writeFile','appendFile','truncate','createWriteStream'])patch(fs,key,old=>function(path,...args){event('write',path);return old.call(this,path,...args);});
  for(const key of ['unlinkSync','rmSync','rmdirSync','unlink','rm','rmdir'])patch(fs,key,old=>function(path,...args){event('remove',path);return old.call(this,path,...args);});
  for(const key of ['mkdirSync','mkdir'])patch(fs,key,old=>function(path,...args){event('mkdir',path);return old.call(this,path,...args);});
  for(const key of ['chmodSync','chmod','chownSync','chown','utimesSync','utimes','fchmodSync','fchmod','fchownSync','fchown','futimesSync','futimes'])patch(fs,key,old=>function(path,...args){event('metadata-write',path);return old.call(this,path,...args);});
  for(const key of ['renameSync','rename'])patch(fs,key,old=>function(from,to,...args){event('rename',from,to);return old.call(this,from,to,...args);});
  for(const key of ['copyFileSync','copyFile','linkSync','link','symlinkSync','symlink'])patch(fs,key,old=>function(from,to,...args){event('copy-or-link',from,to);return old.call(this,from,to,...args);});
  const writesFlag=flags=>typeof flags==='number'?(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND))!==0:/[wax+]/.test(flags);
  patch(fs,'openSync',old=>function(path,flags,...args){event(writesFlag(flags)?'open-write':'read',path);const fd=old.call(this,path,flags,...args);descriptors.set(fd,pathValue(path));return fd;});
  patch(fs,'open',old=>function(path,flags,...args){event(writesFlag(flags)?'open-write':'read',path);const callback=args.pop();return old.call(this,path,flags,...args,(error,fd)=>{if(!error)descriptors.set(fd,pathValue(path));callback(error,fd);});});
  for(const key of ['writeSync','write'])patch(fs,key,old=>function(fd,...args){event('write',fd);return old.call(this,fd,...args);});
  for(const key of ['fsyncSync','fdatasyncSync','fsync','fdatasync'])patch(fs,key,old=>function(fd,...args){event('flush',fd);return old.call(this,fd,...args);});
  for(const key of ['readFileSync','readFile','createReadStream'])patch(fs,key,old=>function(path,...args){event('read',path);return old.call(this,path,...args);});
  for(const key of ['closeSync','close'])patch(fs,key,old=>function(fd,...args){event('close',fd);const result=old.call(this,fd,...args);descriptors.delete(fd);return result;});
  for(const key of ['writeFile','appendFile','truncate','unlink','rm','rmdir','mkdir'])patch(fs.promises,key,old=>async function(path,...args){event(['unlink','rm','rmdir'].includes(key)?'remove':key==='mkdir'?'mkdir':'write',path);return old.call(this,path,...args);});
  for(const key of ['rename','copyFile','link','symlink'])patch(fs.promises,key,old=>async function(from,to,...args){event(key==='rename'?'rename':'copy-or-link',from,to);return old.call(this,from,to,...args);});
  for(const key of ['chmod','chown','utimes'])patch(fs.promises,key,old=>async function(path,...args){event('metadata-write',path);return old.call(this,path,...args);});
  patch(fs.promises,'readFile',old=>async function(path,...args){event('read',path);return old.call(this,path,...args);});
  patch(fs.promises,'open',old=>async function(path,flags,...args){
    event(writesFlag(flags)?'open-write':'read',path);const handle=await old.call(this,path,flags,...args),fd=handle.fd;descriptors.set(fd,pathValue(path));
    for(const [method,operation]of[['write','write'],['writeFile','write'],['appendFile','write'],['truncate','write'],['sync','flush'],['datasync','flush'],['read','read'],['readFile','read'],['close','close']])if(typeof handle[method]==='function'){const originalMethod=handle[method].bind(handle);handle[method]=async(...values)=>{event(operation,fd);try{return await originalMethod(...values);}finally{if(method==='close')descriptors.delete(fd);}};}
    return handle;
  });
  const deny=label=>()=>{networkCalls.push(label);throw new Error(`pilot-network-forbidden:${label}`);};
  for(const [object,keys]of[[net,['connect','createConnection','createServer']],[http,['request','get','createServer']],[https,['request','get','createServer']],[dns,['lookup','resolve','resolve4','resolve6']],[dns.promises,['lookup','resolve','resolve4','resolve6']]])for(const key of keys)patch(object,key,()=>deny(key));
  const oldFetch=globalThis.fetch,oldWebSocket=globalThis.WebSocket;globalThis.fetch=deny('fetch');globalThis.WebSocket=deny('WebSocket');restores.push(()=>{globalThis.fetch=oldFetch;globalThis.WebSocket=oldWebSocket;});
  syncBuiltinESMExports();
  function snapshot(){
    const base=resolve(root,'validation');return original.readdirSync(base,{recursive:true,withFileTypes:true}).map(e=>{const path=resolve(e.parentPath,e.name);assert(!e.isSymbolicLink(),'validator-output-symlink-forbidden');return[relative(base,path).replaceAll('\\','/')+(e.isDirectory()?'/':''),e.isFile()?sha(original.readFileSync(path)):null];}).sort((a,b)=>cmp(a[0],b[0]));
  }
  return{writes,events,networkCalls,snapshot,
    beginCall(entry,fixture){
      assert(!current);const atomic=!entry.errorClass&&['isolation','isolation-atomic-failure'].includes(entry.caseName);
      let temp=null,final=null,callRoot=null;
      if(atomic){callRoot=resolve(root,'validation',`call-${++callNumber}`);original.mkdirSync(callRoot);fixture.outputRoot=callRoot;fixture.requestedOutputs[0].destination=resolve(callRoot,fixture.atomicWrite.finalBasename);temp=resolve(callRoot,fixture.atomicWrite.temporaryBasename);final=fixture.requestedOutputs[0].destination;}
      current={atomic,failure:entry.caseName==='isolation-atomic-failure',temp,final,callRoot,before:snapshot(),eventStart:events.length,writeStart:writes.length,expected:entry.expected};return current;
    },
    endCall(){
      const call=current;assert(call);current=null;const observed=events.slice(call.eventStart),changed=writes.slice(call.writeStart),after=snapshot();
      if(!call.atomic){assert.equal(changed.length,0,'validator-validation-only-write-forbidden');assert.deepEqual(after,call.before,'validator-validation-only-output-forbidden');return;}
      assert(changed.every(e=>e.path===call.temp&&(e.operation!=='rename'||e.to===call.final)),'validator-unknown-output-basename');
      assert(changed.every(e=>['open-write','write','flush','rename',...(call.failure?['remove']:[])].includes(e.operation)),'validator-non-atomic-operation-forbidden');
      const writePositions=observed.flatMap((e,i)=>e.operation==='write'?[i]:[]),flushPositions=observed.flatMap((e,i)=>e.operation==='flush'?[i]:[]),readPositions=observed.flatMap((e,i)=>e.operation==='read'&&e.path===call.temp?[i]:[]),renames=observed.filter(e=>e.operation==='rename');
      assert(writePositions.length>0,'atomic-temp-write-required');assert(flushPositions.some(i=>i>Math.max(...writePositions)),'atomic-flush-after-write-required');assert(readPositions.some(i=>i>Math.max(...writePositions,...flushPositions)),'atomic-temp-reparse-after-flush-required');
      assert(!fs.existsSync(call.temp),'atomic-temp-must-not-remain');
      if(call.failure){assert.equal(renames.length,0);assert(!fs.existsSync(call.final),'failed-final-must-not-exist');assert(observed.some(e=>e.operation==='remove'),'failed-temp-cleanup-required');assert.deepEqual(after,call.before,'failed-call-output-forbidden');}
      else {assert.equal(renames.length,1,'exactly-one-atomic-rename-required');const renamePosition=observed.findIndex(e=>e.operation==='rename');assert(renamePosition>Math.max(...writePositions,...flushPositions,...readPositions),'atomic-rename-must-be-last');const expected=[...call.before,[relative(resolve(root,'validation'),call.final).replaceAll('\\','/'),call.expected.outputFileSha256]].sort((a,b)=>cmp(a[0],b[0]));assert.deepEqual(after,expected,'unknown-output-or-wrong-final-hash');}
    },restore(){restores.reverse().forEach(f=>f());syncBuiltinESMExports();}};
}
export function effectGuardOracle(root,base){
  const guard=guardEffects(root),roots=[];
  try{
    for(const failure of [false,true]){
      const fixture=clone(base),entry={caseName:failure?'isolation-atomic-failure':'isolation',expected:{outputFileSha256:sha('{"coverageScope":"pilot-24","imageCount":24}\n')}};
      const call=guard.beginCall(entry,fixture);roots.push(call.callRoot);
      const fd=fs.openSync(call.temp,'wx');fs.writeFileSync(fd,'{"coverageScope":"pilot-24","imageCount":24}\n');fs.fsyncSync(fd);fs.closeSync(fd);fs.readFileSync(call.temp);
      if(failure)fs.unlinkSync(call.temp);else fs.renameSync(call.temp,call.final);guard.endCall();
    }
    guard.beginCall({caseName:'validation-only',errorClass:'RangeError'},{});
    assert.throws(()=>fs.writeFileSync(resolve(root,'validation','unknown.json'),'x'),/validation-only-write-forbidden/);
    assert.throws(()=>guard.endCall(),/validation-only-write-forbidden/);
    const fixture=clone(base),call=guard.beginCall({caseName:'isolation',expected:{}},fixture);roots.push(call.callRoot);
    assert.throws(()=>fs.writeFileSync(resolve(call.callRoot,'unknown.json'),'x'),/unknown-output-basename/);
    assert.throws(()=>guard.endCall(),/unknown-output-basename/);
  }finally{guard.restore();for(const path of roots){assert(inside(resolve(root,'validation'),path));fs.rmSync(path,{recursive:true,force:true});}}
}

export function wilson(k,n){
  if(n===0)return{value:null,reason:'zero-denominator',numerator:k,denominator:n};
  const z=1.959963984540054,p=k/n,d=1+z*z/n,centre=(p+z*z/(2*n))/d,delta=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/d;
  return{value:[centre-delta,centre+delta],reason:null,numerator:k,denominator:n};
}
export function bindBinomialIntervals(value){
  const result=clone(value);
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(Number.isInteger(node.numerator)&&Number.isInteger(node.denominator)){
      const interval=wilson(node.numerator,node.denominator);node.interval95=interval.value;node.undefinedReason=interval.reason;
    }
    for(const child of Object.values(node))if(child&&typeof child==='object')visit(child);
  }visit(result);return result;
}
export function binomialPaths(value,path=[]){
  if(!value||typeof value!=='object')return[];
  const here=Number.isInteger(value.numerator)&&Number.isInteger(value.denominator)?[path]:[];
  return [...here,...Object.entries(value).flatMap(([k,v])=>binomialPaths(v,[...path,Array.isArray(value)?Number(k):k]))];
}
export function kappa(left,right){
  const matrix=Array.from({length:4},()=>[0,0,0,0]);let included=0,excluded=0;
  left.forEach((x,i)=>{const y=right[i];if(x===null||y===null){excluded++;return;}assert(Number.isInteger(x)&&x>=0&&x<=3&&Number.isInteger(y)&&y>=0&&y<=3);matrix[x][y]++;included++;});
  if(included===0)return{value:null,reason:'no-non-null-pairs',included,excluded,confusion:matrix};
  const rows=matrix.map(row=>row.reduce((a,b)=>a+b,0)),cols=matrix[0].map((_,j)=>matrix.reduce((s,row)=>s+row[j],0));let observed=0,expected=0;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const weight=(i-j)**2/9;observed+=weight*matrix[i][j]/included;expected+=weight*rows[i]*cols[j]/included**2;}
  return{value:expected===0?null:1-observed/expected,reason:expected===0?'zero-expected-disagreement':null,included,excluded,confusion:matrix};
}
function aggregate(c,w,meta){
  const records=ACTORS.map(actor=>w.runs.filter(run=>run.header.generator.actorId===actor).flatMap(run=>run.records).sort((a,b)=>cmp(a.anonymousImageId,b.anonymousImageId)));
  const pairs=[[0,1],[0,2],[1,2]],assurances=['verified-bytes','verified-pixels','local-input-only'];
  const finals=new Map(w.coverage.records[0].coveredFinals.map(t=>[t.anonymousImageId,t.final]));
  return{imageCount:24,coverageScope:'pilot-24',reference:'human final operational reference',actorCoverage:ACTORS.map((actor,i)=>({actor,numerator:records[i].length,denominator:24})),fieldCoverage:ACTORS.flatMap((actor,i)=>FIELDS.map(field=>({actor,field,numerator:records[i].filter(r=>r.classification[field]!==null&&r.classification[field]!=='indeterminate').length,denominator:24}))),transportCoverage:ACTORS.flatMap((actor,i)=>assurances.map(assurance=>({actor,assurance,numerator:records[i].filter(r=>r.imageTransport.transportAssurance===assurance).length,denominator:24}))),invalidAttempts:meta.invalidAttempts.length,rejectedValidRuns:meta.rejectedValidRuns.length,supersededValidRuns:meta.supersededValidRuns.length,threeActorMorphologyExact:{numerator:c.ids.filter((_,i)=>new Set(records.map(rs=>jcs(Object.fromEntries(FIELDS.map(f=>[f,rs[i].classification[f]]))))).size===1).length,denominator:24},threeActorVoteExact:{numerator:c.ids.filter((_,i)=>new Set(records.map(rs=>jcs({...Object.fromEntries(FIELDS.map(f=>[f,rs[i].classification[f]])),confidence:rs[i].classification.confidence}))).size===1).length,denominator:24},pairwiseBranch:pairs.map(([a,b])=>({actors:[ACTORS[a],ACTORS[b]],...kappa(records[a].map(r=>r.classification.basalBranchingLevel),records[b].map(r=>r.classification.basalBranchingLevel))})),indeterminate:ACTORS.flatMap((actor,i)=>FIELDS.map(field=>({actor,field,count:records[i].filter(r=>r.classification[field]===null||r.classification[field]==='indeterminate').length}))),limitations:ACTORS.map((actor,i)=>({actor,counts:records[i].flatMap(r=>r.observations.visibilityLimitations).reduce((out,key)=>(out[key]=(out[key]??0)+1,out),{})})),humanDisagreement:ACTORS.flatMap((actor,i)=>FIELDS.map(field=>({actor,field,numerator:records[i].filter(r=>r.classification[field]!==finals.get(r.anonymousImageId)[field]).length,denominator:24}))),adjudicationResolution:['propose-one-candidate','propose-new-value','retain-human-review'].map(disposition=>({disposition,numerator:w.adjudication.records.filter(r=>r.disposition===disposition).length,denominator:w.Q.length})),operatorTimeSeconds:meta.operatorIntervals.reduce((sum,[a,b])=>sum+b-a,0),humanTimeSeconds:meta.humanIntervals.reduce((sum,[a,b])=>sum+b-a,0),remainingUnpromoted:182,descriptiveOnly:true,adoptionThreshold:null,productionMigrationAllowed:false,optionBAllowed:false};
}
export function metricsCases(c,w){
  const metadata={invalidAttempts:[{actor:'annotator-1',attempt:1},{actor:'annotator-1',attempt:2},{actor:'annotator-3',attempt:1}],rejectedValidRuns:[{artifactId:'rejected-valid-run'}],supersededValidRuns:[{artifactId:'superseded-valid-run'}],operatorIntervals:[[0,30],[40,70]],humanIntervals:[[0,80],[100,140]]};
  const complete=(workflow)=>{
    const result=aggregate(c,workflow,metadata);
    result.assuranceFieldCoverage=ACTORS.flatMap(actor=>['verified-bytes','verified-pixels','local-input-only'].flatMap(assurance=>FIELDS.map(field=>{const records=workflow.runs.filter(r=>r.header.generator.actorId===actor).flatMap(r=>r.records).filter(r=>r.imageTransport.transportAssurance===assurance);return{actor,assurance,field,numerator:records.filter(r=>r.classification[field]!==null&&r.classification[field]!=='indeterminate').length,denominator:records.length};})));
    return bindBinomialIntervals(result);
  };
  const expected=complete(w);assert.deepEqual(wilson(12,24).value,[0.3142742581957335,0.6857257418042665]);
  for(const path of binomialPaths(expected)){const rate=path.reduce((v,k)=>v[k],expected),interval=wilson(rate.numerator,rate.denominator);assert.deepEqual(rate.interval95,interval.value);assert.equal(rate.undefinedReason,interval.reason);}
  assert(expected.assuranceFieldCoverage.some(r=>r.denominator===0&&r.interval95===null&&r.undefinedReason==='zero-denominator'));
  assert.deepEqual(kappa([0,1,2,3,null],[0,1,2,3,null]),{value:1,reason:null,included:4,excluded:1,confusion:[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]});
  assert.equal(expected.threeActorMorphologyExact.numerator,20);assert.equal(expected.threeActorVoteExact.numerator,18);assert.deepEqual(expected.adjudicationResolution.map(r=>r.numerator),[3,3,2]);assert.equal(expected.operatorTimeSeconds,60);assert.equal(expected.humanTimeSeconds,120);
  assert.equal(expected.invalidAttempts,3);assert.equal(expected.rejectedValidRuns,1);assert.equal(expected.supersededValidRuns,1);assert.deepEqual(expected.limitations,[{actor:'annotator-1',counts:{}},{actor:'annotator-2',counts:{}},{actor:'annotator-3',counts:{blur:2}}]);
  const fixture={manifest:c.manifest,runs:w.runs,consensus:w.consensus,adjudication:w.adjudication,coverage:w.coverage,metadata};good('metrics',fixture,expected);
  const reverse={...w,runs:clone(w.runs)};reverse.runs.reverse();for(const r of reverse.runs)r.records.reverse();assert.deepEqual(complete(reverse),expected);good('metrics',{...fixture,runs:reverse.runs},expected,'order-invariance');
  const claimed={...fixture,claimedMetrics:expected};good('metrics-report',claimed,true);
  for(const path of binomialPaths(expected)){
    const rate=path.reduce((v,k)=>v[k],expected),field=['claimedMetrics',...path,'interval95'].join('.'),locate=f=>path.reduce((v,k)=>v[k],f.claimedMetrics);
    bad('metrics-report',claimed,f=>{delete locate(f).interval95;},'missing-property',field,'TypeError');
    bad('metrics-report',claimed,f=>{locate(f).undefinedReason=rate.denominator===0?null:'zero-denominator';},'wilson-rate-binding',['claimedMetrics',...path,'undefinedReason'].join('.'));
    bad('metrics-report',claimed,f=>{locate(f).interval95=rate.denominator===0?[0,1]:[rate.interval95[0]+0.01,rate.interval95[1]];},'wilson-rate-binding',field);
    bad('metrics-report',claimed,f=>{locate(f).denominator+=1;},'wilson-rate-binding',['claimedMetrics',...path,'denominator'].join('.'));
  }
  good('wilson',{numerator:12,denominator:24},wilson(12,24));good('wilson',{numerator:0,denominator:0},{value:null,reason:'zero-denominator',numerator:0,denominator:0});good('quadratic-kappa',{left:[0,1,2,3,null],right:[0,1,2,3,null]},{value:1,reason:null,included:4,excluded:1,confusion:[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]});good('quadratic-kappa',{left:[null],right:[null]},kappa([null],[null]));good('quadratic-kappa',{left:[1,1],right:[1,1]},kappa([1,1],[1,1]));
  for(const pair of [[0,1],[0,2],[1,2]])for(const field of FIELDS){const left=w.runs.filter(r=>r.header.generator.actorId===ACTORS[pair[0]]).flatMap(r=>r.records),right=w.runs.filter(r=>r.header.generator.actorId===ACTORS[pair[1]]).flatMap(r=>r.records);const rows={};for(let i=0;i<24;i++){const key=jcs([left[i].classification[field],right[i].classification[field]]);rows[key]=(rows[key]??0)+1;}good('pairwise-confusion',{field,left:left.map(r=>r.classification[field]),right:right.map(r=>r.classification[field])},rows);}
  const report={metrics:expected,sampleSize:24,remainingExecutedCount:0,reference:'human final operational reference',scope:'descriptive-exploratory-pilot-24',adoptionPassFail:null,remaining182Allowed:false,optionBAllowed:false,productionMigrationAllowed:false,changedContractAdoptionClaimAllowed:false,intervalMethod:{z:1.959963984540054,confidenceLevel:0.95,syntheticMethodExamples:bindBinomialIntervals([{numerator:12,denominator:24},{numerator:0,denominator:0}])}};good('pilot-report',report,true);
  assert.deepEqual(report.intervalMethod.syntheticMethodExamples[0].interval95,[0.3142742581957335,0.6857257418042665]);
  for(const path of binomialPaths(report))bad('pilot-report',report,f=>{const rate=path.reduce((v,k)=>v[k],f);rate.interval95=rate.denominator===0?[0,1]:null;},'wilson-rate-binding',[...path,'interval95'].join('.'));
  for(const [field,value]of[['sampleSize',206],['remainingExecutedCount',182],['reference','author ground truth'],['reference','physical ground truth'],['scope','206-performance-guarantee'],['adoptionPassFail','pass'],['remaining182Allowed',true],['optionBAllowed',true],['productionMigrationAllowed',true],['changedContractAdoptionClaimAllowed',true]])bad('pilot-report',report,f=>{f[field]=value;},'pilot-non-promotion',field);
  bad('pilot-report',report,f=>{f.metrics.transportCoverage[0].assurance='provider-pixels-proven-from-local-input-only';},'local-input-only-claim','transportCoverage');
  return expected;
}
