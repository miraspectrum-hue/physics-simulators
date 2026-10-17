import { assert, clone, good, bad, schemaAccepts, parseUnique, fileBytes, hash } from './pilot-oracle.mjs';

// Independent schema conformance is an input operation of validatePilot; every
// declared property is exercised, rather than replacing schemas by a toy object.
export function schemaCases(c,w){
  const samples={
    protocolObject:c.protocol,selectionCandidateSet:c.candidateSet,selectionProxyInput:c.proxyInput,selectionPlan:c.plan,
    blindedManifest:c.manifest,restrictedMap:c.restricted,batchInputTable:c.inputTables[0],annotationPayload:w.runs[0].modelPayloads[0],
    adjudicationPayload:w.adjudication.modelPayloads[0],consensusRoutingTruthTable:c.truthTable,artifact:w.runs[0].header,
    candidateAlias:w.aliases,candidatePayloadTable:w.candidateTable,annotationConsensusSlotPlan:w.firstPlan,
    activeAnnotationConsensusSnapshot:w.snapshot,supersessionLedger:w.emptyLedger.records[0],renderedPromptEvidence:c.prompts[0].evidence,
    postConsensusRouteSlotPlan:w.freshPlan,activeUpstreamSnapshot:w.upstreamFresh,humanApproval:w.approvals[0].records[0],pilotCoverage:w.coverage.records[0],
  };
  // The invalid-attempt sample is registered separately after its immutable file
  // is created; it still receives the same complete schema mutation walk.
  return samples;
}
export function exerciseSchema(c,key,sample){
  const schema=c.bundle[`${key}SchemaFileSha256`].object;
  assert(schemaAccepts(schema,sample),`${key} does not match the normative type declaration`);
  const base={schemaObject:schema,value:sample,schemaProperty:`${key}SchemaFileSha256`};good('schema-object',base,true,key);
  let visited=0;
  const at=(root,path)=>path.reduce((v,k)=>v[k],root);
  const selected=(s,value)=>s.anyOf?s.anyOf.find(member=>schemaAccepts(member,value)):s;
  const enumOnly=s=>'const'in s||s.anyOf?.every(member=>'const'in member);
  function mutation(path,replacement,label,reason='schema-boundary',errorClass='RangeError'){
    if(path.length===0)return;
    const changed=clone(sample);at(changed,path.slice(0,-1))[path.at(-1)]=replacement;
    if(schemaAccepts(schema,changed))return;
    const field=path.join('.');
    bad('schema-object',base,f=>{at(f.value,path.slice(0,-1))[path.at(-1)]=clone(replacement);},reason,field,errorClass,`${key}/${field}/${label}`);
  }
  function boundaryPositive(path,replacement,label){
    if(!path.length)return;const changed=clone(sample);at(changed,path.slice(0,-1))[path.at(-1)]=replacement;
    if(schemaAccepts(schema,changed))good('schema-object',{...base,value:changed},true,`${key}/${path.join('.')}/${label}`);
  }
  function walk(value,path,node){
    node=selected(node,value);assert(node,`${key}/${path.join('.')}`);
    visited++;
    if(Array.isArray(value)){
      mutation(path,value.slice(0,-1),'min-items');if(value.length)mutation(path,[...value,clone(value[0])],'max-items');
      if(value.length===0&&node.items)mutation(path,['__invalid_same_type__'],'invalid-enum-item','type-or-enum','TypeError');
      const seen=new Set();value.forEach((item,i)=>{const child=node.prefixItems?.[i]??node.items,shape=hash(child)+'/'+shapeKey(item);if(!seen.has(shape)){seen.add(shape);walk(item,[...path,i],child);}});return;
    }
    if(value!==null&&typeof value==='object'){
      const locate=f=>at(f.value,path),extra=mutated(sample,path,'__unknown',true);
      if(!schemaAccepts(schema,extra))bad('schema-object',base,f=>{locate(f).__unknown=true;},'unknown-property',[...path,'__unknown'].join('.'),'TypeError',`${key}/${path.join('.')}/unknown`);
      for(const property of Object.keys(value)){
        const child=node.properties[property]??node.additionalProperties,childPath=[...path,property],field=childPath.join('.');
        if(node.required.includes(property))bad('schema-object',base,f=>{delete locate(f)[property];},'missing-property',field,'TypeError',`${key}/${field}/missing`);
        const wrong=typeof value[property]==='boolean'?'wrong-type':false;
        mutation(childPath,wrong,'wrong-type','type-or-enum','TypeError');
        if(value[property]!==null)mutation(childPath,null,'null','type-or-enum','TypeError');
        walk(value[property],childPath,child);
      }return;
    }
    const rawNode=path.reduce((s,k,i)=>{const parentValue=at(sample,path.slice(0,i));s=selected(s,parentValue);return Array.isArray(parentValue)?s.prefixItems?.[k]??s.items:s.properties[k]??s.additionalProperties;},schema);
    const fixed=enumOnly(rawNode),reason=fixed?'type-or-enum':'schema-format',kind=fixed?'TypeError':'RangeError';
    if(typeof value==='string'){
      const values=['__invalid_same_type__','','e\u0301','\ud800'];
      if(node.minLength!==undefined)values.push('x'.repeat(Math.max(0,node.minLength-1)));
      if(node.maxLength!==undefined)values.push('x'.repeat(node.maxLength+1));
      if(node.format==='sha256-hex')values.push('a'.repeat(63),'a'.repeat(65),'A'.repeat(64),'g'.repeat(64));
      if(node.format==='pilot-id')values.push('x'.repeat(129),' leading','trailing ','slash/id','back\\id','control\u0001','control\u0081','P11','img-P12-test','temperature--15C','account:synthetic','synthetic@example.test');
      if(node.format==='source-id')values.push('L23-F2-P10-N001','L23-F2-P11-N01','L23-F2-P11-N0001','l23-F2-P11-N001');
      if(node.format==='utc-seconds')values.push('2026-01-01T00:00:00.001Z','2026-01-01T00:00:00+00:00','2026-01-01t00:00:00z','2026-02-30T00:00:00Z','2026-01-01T00:00:60Z');
      if(node.format==='relative-path')values.push('../escape','C:/escape','/escape','images/users/synthetic/file.png','images\\file.png');
      for(const replacement of new Set(values))mutation(path,replacement,`same-type-${JSON.stringify(replacement)}`,reason,kind);
      if(!fixed){if(node.minLength!==undefined)boundaryPositive(path,'x'.repeat(node.minLength),'minimum-length');if(node.maxLength!==undefined)boundaryPositive(path,'x'.repeat(node.maxLength),'maximum-length');if(node.format==='sha256-hex')boundaryPositive(path,'a'.repeat(64),'lowercase-64-hex');if(node.format==='pilot-id')boundaryPositive(path,'é'.repeat(128),'NFC-128-scalars');}
    }
    if(typeof value==='boolean')mutation(path,!value,'same-type-const','type-or-enum','TypeError');
    if(typeof value==='number'){
      for(const invalid of [NaN,Infinity,-Infinity,-0])mutation(path,invalid,`non-finite-${String(invalid)}`,'finite-number-no-negative-zero');
      for(const replacement of [value+1,-1,0,1.5,Number.MAX_SAFE_INTEGER+1])mutation(path,replacement,`same-type-${replacement}`,fixed?'type-or-enum':'safe-integer-boundary',fixed?'TypeError':'RangeError');
      if(node.minimum!==undefined)mutation(path,node.minimum-1,'below-minimum');
      if(node.maximum!==undefined)mutation(path,node.maximum+1,'above-maximum');
      if(!fixed){if(node.minimum!==undefined)boundaryPositive(path,node.minimum,'minimum-integer');if(node.maximum!==undefined)boundaryPositive(path,node.maximum,'maximum-safe-integer');}
    }
  }
  walk(sample,[],schema);assert(visited>0);
  const bytes=fileBytes(sample);good('canonical-json',{bytes,schemaObject:schema},hash(sample),key);
  bad('canonical-json',{bytes,schemaObject:schema},f=>{f.bytes='{"duplicate":1,"dupli\\u0063ate":2}\n';},'duplicate-key','duplicate','SyntaxError',`${key}/escaped-duplicate`);
  for(const [label,transform]of[['BOM',s=>'\ufeff'+s],['CRLF',s=>s.replaceAll('\n','\r\n')],['extra-LF',s=>s+'\n'],['pretty',()=>JSON.stringify(sample,null,2)+'\n'],['multiple',s=>s+s]])bad('canonical-json',{bytes,schemaObject:schema},f=>{f.bytes=transform(bytes);},'canonical-json-bytes','bytes','RangeError',`${key}/${label}`);
}
function mutated(base,path,key,replacement){const f=clone(base);path.reduce((v,k)=>v[k],f)[key]=replacement;return f;}
function shapeKey(v){if(Array.isArray(v))return'array';if(v&&typeof v==='object')return Object.keys(v).sort().join(',')+'/'+(v.recordType??'');return typeof v;}

export function parserOracleCases(){
  assert.throws(()=>parseUnique('{"a":1,"\\u0061":2}'),SyntaxError);
  assert.throws(()=>parseUnique('{"a":{"x":1,"x":2}}'),SyntaxError);
  assert.deepEqual(parseUnique('{"a":[1,true,null,"é"]}'),{a:[1,true,null,'é']});
}
