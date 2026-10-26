import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assert, CONTRACT, PROTOCOL, POLICY, H, utc, sha, hash, whash, wrapped, idHash, jcs, fileBytes, clone, good, bad, streamFileOracle, render } from './pilot-oracle.mjs';
import { ACTORS, FAMILIES, vote } from './pilot-contract-fixtures.mjs';
import { makeLedger, buildWorkflow, makeCoverage, approvalUpstreamSnapshot, captureIntegrityCases } from './pilot-workflow-fixtures.mjs';
import { materializePromptChain, materializeReplacementCampaign, materializeReissuePlan, materializeValidWrapper, collectArtifactInventory, materializeOldGraph, REISSUE_CAUSES } from './pilot-d20-builders.mjs';
import { assertReissuePositive, assertValidWrapper, assertOldGraphPositive } from './pilot-positive-selfcheck.mjs';
import { buildReplacementNegativeRows, buildAttemptNegativeRows, buildReissueNegativeRows, registerNegativeRows } from './pilot-d20-negative-builders.mjs';
import { assertReplacementNegatives, assertAttemptNegatives, assertReissueNegatives } from './pilot-negative-selfcheck.mjs';

let duplicateInvalidEvidenceProbe=null;
export const d20DuplicateInvalidEvidenceProbe=()=>clone(duplicateInvalidEvidenceProbe);
const collectInventoryForReissue=value=>collectArtifactInventory([value])[0];
function resignClosure(f){
  const {planClosureId,...body}=f.closure;void planClosureId;
  f.closure.planClosureId=whash('plan-closure-id',{closureWithoutPlanClosureId:body});
  f.closureBytes=fileBytes(f.closure);f.closureFileSha256=sha(f.closureBytes);
  f.closureFilename=`${f.closure.planClosureId}.json`;
}

export function attemptCases(c,w,workRoot){
  const raw='not-json\n',rawHash='60498ebafa3f473a2a72c1242e8c3202bf50a6d81dfc721958be1550f46faf33';
  assert.equal(Buffer.from(raw).toString('hex'),'6e6f742d6a736f6e0a');assert.equal(Buffer.byteLength(raw),9);assert.equal(sha(raw),rawHash);
  const dir=resolve(workRoot,'inputs','attempts');mkdirSync(dir,{recursive:true});
  const rawPath=resolve(dir,'original.txt');writeFileSync(rawPath,raw,{flag:'wx'});
  const stored=readFileSync(rawPath);assert.equal(sha(stored),rawHash);assert.equal(stored.byteLength,9);
  assert.deepEqual(streamFileOracle(rawPath),{sha256:rawHash,byteLength:9});
  const run=w.runs[0],slot=w.firstPlan.slots[0];
  // TC-PILOT-ATTEMPT-001 / protocol §8.1.  This literal authority table is
  // deliberately test-only: the validator must not import it.  A replacement
  // binds changedInputSha256 to the newly frozen authority for its reason;
  // model-retry is the only input-invariant case and therefore names the
  // active artifact file at campaign start.
  // Build real, self-consistent replacement inputs.  No H(label) value is an
  // authority here: every value below is derived from concrete JCS bytes or a
  // concrete frozen artifact.  This deliberately duplicates (rather than
  // imports) the prompt builder so the validator cannot share its oracle.
  const materializeInputChange=tag=>{
    // An in-plan input-change may alter only attachmentSlot.  Image IDs,
    // derivative hashes, order, protocol, schema and template remain frozen;
    // prompt artifacts are then re-derived from that one table difference.
    const table=clone(run.table);table.orderedItems[0].attachmentSlot=`replacement-${tag}-01`;
    const chain=materializePromptChain({protocol:c.protocol,schemaObject:clone(c.bundle.annotationPayloadSchemaFileSha256.object),table,templateBytes:run.prompt.template,rendererId:c.protocol.prompts.rendererId});
    return{chain,schema:{object:chain.schemaObject,bytes:chain.schemaBytes,fileSha256:chain.schemaFileSha256,objectSha256:chain.modelPayloadSchemaObjectSha256},table,tableObjectSha256:chain.batchInputTableObjectSha256,prompt:{variables:chain.variables,evidence:chain.evidence,rendered:chain.rendered,variablesObjectSha256:hash(chain.variables)}};
  };
  const replacementSources=Object.freeze({
    'input-change':materializeInputChange('input-change'),
    stale:materializeInputChange('stale'),
  });
  const promptRefsOf=source=>({promptRole:'annotator',promptTemplateFileSha256:source.prompt.evidence.promptTemplateFileSha256,promptVariablesObjectSha256:source.prompt.variablesObjectSha256,schemaFileSha256:source.schema.fileSha256,modelPayloadSchemaObjectSha256:source.schema.objectSha256,renderedPromptEvidenceObjectSha256:hash(source.prompt.evidence),renderedPromptSha256:sha(source.prompt.rendered)});
  const inputRefsOf=source=>({protocolObjectSha256:hash(c.protocol),blindedManifestObjectSha256:hash(c.manifest),batchInputTableObjectSha256:source.tableObjectSha256,orderedInputSha256:run.header.orderedInputSha256});
  const replacementAuthorities=Object.freeze([
    {reasonCode:'input-change',source:replacementSources['input-change'],changedInputOf:source=>source.tableObjectSha256},
    {reasonCode:'model-retry',source:null,changedInputOf:()=>run.fileSha256},
  ].map(row=>({
    ...row,changedInputSha256:row.changedInputOf(row.source),
    campaign:row.source?{promptVariablesObjectSha256:row.source.prompt.variablesObjectSha256,batchInputTableObjectSha256:row.source.tableObjectSha256}:{},
    promptRefs:row.source?promptRefsOf(row.source):{},inputRefs:row.source?inputRefsOf(row.source):{},
  })));
  assert.equal(replacementAuthorities.length,2);
  assert.deepEqual(replacementAuthorities.map(row=>row.reasonCode).sort(),['input-change','model-retry']);
  for(const authority of replacementAuthorities.filter(row=>row.source)){
    const source=authority.source;
    assert.equal(source.schema.fileSha256,run.header.generator.schemaFileSha256);
    assert.notEqual(source.prompt.variablesObjectSha256,run.header.generator.promptVariablesObjectSha256);
    assert.notEqual(source.tableObjectSha256,hash(run.table));
    assert.equal(authority.promptRefs.schemaFileSha256,source.schema.fileSha256);
    assert.equal(authority.promptRefs.promptVariablesObjectSha256,source.prompt.variablesObjectSha256);
    assert.equal(authority.promptRefs.renderedPromptEvidenceObjectSha256,hash(source.prompt.evidence));
    assert.equal(authority.inputRefs.batchInputTableObjectSha256,source.tableObjectSha256);
  }
  const replacementByReason=new Map(replacementAuthorities.map(row=>[row.reasonCode,row]));
  function invalid(attemptNumber,replacement=null){
    const authority=replacement===null?null:replacementByReason.get(replacement);
    assert(replacement===null||authority);
    const campaign=authority
      ? {...materializeReplacementCampaign({run,firstPlan:w.firstPlan,promptChain:{table:authority.source?.table??run.table,batchInputTableObjectSha256:authority.source?.tableObjectSha256??hash(run.table),variables:authority.source?.prompt.variables??run.prompt.variables},reasonCode:authority.reasonCode}),...(authority.campaign??{})}
      : {...run.campaign,campaignKind:'root-materialization',activeArtifactIdBeforeCampaign:null,activeArtifactFileSha256BeforeCampaign:null,replacementReasonCode:null,changedInputSha256:null};
    const gen=run.header.generator;
    const body={schemaVersion:'snow-crystal-morphology-pilot-invalid-attempt/1',contractId:CONTRACT,protocolId:PROTOCOL,attemptPolicyId:POLICY,campaignIdSha256:hash(campaign),campaignKind:campaign.campaignKind,attemptNumber,actorId:gen.actorId,batchId:run.header.batchId,logicalSlot:run.header.logicalSlot,slotPlanObjectSha256:hash(w.firstPlan),plannedRootArtifactId:slot.rootArtifactId,activeArtifactBeforeCampaign:authority?{artifactId:run.header.artifactId,artifactFileSha256:run.fileSha256}:null,replacementReasonCode:campaign.replacementReasonCode,changedInputSha256:campaign.changedInputSha256,promptRefs:{promptRole:gen.promptRole,promptTemplateFileSha256:gen.promptTemplateFileSha256,promptVariablesObjectSha256:gen.promptVariablesObjectSha256,schemaFileSha256:gen.schemaFileSha256,modelPayloadSchemaObjectSha256:gen.modelPayloadSchemaObjectSha256,renderedPromptEvidenceObjectSha256:gen.renderedPromptEvidenceObjectSha256,renderedPromptSha256:gen.renderedPromptSha256,...(authority?.promptRefs??{})},inputRefs:{protocolObjectSha256:hash(c.protocol),blindedManifestObjectSha256:hash(c.manifest),batchInputTableObjectSha256:hash(run.table),orderedInputSha256:run.header.orderedInputSha256,...(authority?.inputRefs??{})},run:{provider:gen.provider,product:gen.product,displayedModelId:gen.displayedModelId,modelFamily:gen.modelFamily,modelVersion:gen.modelVersion,modelConfiguration:gen.modelConfiguration,clientTool:gen.clientTool,clientToolVersion:gen.clientToolVersion,attachmentMode:gen.attachmentMode,startedAtUtc:utc(0),completedAtUtc:utc(1),responseCaptureMethod:gen.responseCapture.method,responseCapturedAtUtc:utc(2)},rawResponseSha256:rawHash,rawResponseByteLength:9,validationErrors:[{ordinal:0,code:'json-syntax',jsonPointer:null,anonymousImageId:null}],disposition:attemptNumber===3?'attempt-limit-reached':'retry-allowed',containsRawResponse:false,containsPii:false};
    const evidence={...body,invalidAttemptEvidenceId:whash('invalid-attempt-evidence-id',{evidenceWithoutInvalidAttemptEvidenceId:body})};
    return{evidence,campaign,replacementInputs:authority?.source??null,rawResponseFile:rawPath,evidenceFilename:`${evidence.invalidAttemptEvidenceId}.json`,evidenceBytes:fileBytes(evidence),evidenceFileSha256:sha(fileBytes(evidence))};
  }
  const base={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:run,...invalid(1)};
  good('invalid-attempt',base,{invalidAttemptEvidenceId:base.evidence.invalidAttemptEvidenceId,evidenceFileSha256:base.evidenceFileSha256,disposition:'retry-allowed'});
  // TC-PILOT-ATTEMPT-001 / protocol §8.1: re-sign every semantic mutation.
  // These are not stale evidence-byte/hash failures. The frozen campaign,
  // planned slot and run remain independent authorities for the changed claim.
  const semanticBad=(reference,label,mutate,field)=>bad('invalid-attempt',reference,f=>{
    mutate(f);rehashEvidence(f);
    const{invalidAttemptEvidenceId,...body}=f.evidence;
    assert.equal(invalidAttemptEvidenceId,whash('invalid-attempt-evidence-id',{evidenceWithoutInvalidAttemptEvidenceId:body}));
    assert.equal(f.evidenceBytes,fileBytes(f.evidence));assert.equal(f.evidenceFileSha256,sha(f.evidenceBytes));
    assert.equal(f.evidenceFilename,`${invalidAttemptEvidenceId}.json`);
  },'invalid-attempt-evidence',field,'RangeError',`semantic-binding/${label}`);
  for(const [label,mutate,field]of[
    ['contains-PII',f=>{f.evidence.containsPii=true;},'containsPii'],
    ['contains-raw-response',f=>{f.evidence.containsRawResponse=true;},'containsRawResponse'],
    ...['schemaVersion','contractId','protocolId','attemptPolicyId'].map(key=>[key,f=>{f.evidence[key]+='-other';},key]),
    ['attempt-zero',f=>{f.evidence.attemptNumber=0;},'attemptNumber'],
    ['attempt-four',f=>{f.evidence.attemptNumber=4;},'attemptNumber'],
    ['attempt-one-limit',f=>{f.evidence.disposition='attempt-limit-reached';},'disposition'],
    ['campaign-kind',f=>{f.evidence.campaignKind='replacement-materialization';},'campaignKind'],
    ['campaign-kind-invalid',f=>{f.evidence.campaignKind='other-materialization';},'campaignKind'],
    ['actor',f=>{f.evidence.actorId='annotator-2';},'actorId'],
    ['batch',f=>{f.evidence.batchId='batch-02';},'batchId'],
    ['slot',f=>{f.evidence.logicalSlot='annotator-2-batch-01';},'logicalSlot'],
    ['plan',f=>{f.evidence.slotPlanObjectSha256=H('different-plan');},'slotPlanObjectSha256'],
    ['root',f=>{f.evidence.plannedRootArtifactId='root-annotator-2-batch-01';},'plannedRootArtifactId'],
    ['root-active',f=>{f.evidence.activeArtifactBeforeCampaign={artifactId:run.header.artifactId,artifactFileSha256:run.fileSha256};},'activeArtifactBeforeCampaign'],
    ['root-reason',f=>{f.evidence.replacementReasonCode='model-retry';},'replacementReasonCode'],
    ['root-changed-input',f=>{f.evidence.changedInputSha256=run.fileSha256;},'changedInputSha256'],
  ])semanticBad(base,label,mutate,field);
  for(const [group,fields]of[
    ['promptRefs',Object.keys(base.evidence.promptRefs)],
    ['inputRefs',Object.keys(base.evidence.inputRefs)],
    ['run',['provider','product','displayedModelId','modelFamily','modelVersion','modelConfiguration','clientTool','clientToolVersion','attachmentMode','responseCaptureMethod']],
  ])for(const field of fields)semanticBad(base,`${group}.${field}`,f=>{
    const value=f.evidence[group][field];
    f.evidence[group][field]=field==='promptRole'?'adjudicator':field==='responseCaptureMethod'?'manual-visible-text-copy':field==='modelConfiguration'?{temperature:0}:value===null?'different-version':field.endsWith('Sha256')?H(`different-${group}-${field}`):`${value}-different`;
  },`${group}.${field}`);
  // Protocol §8.1 has a closed thirteen-code vocabulary, while an RFC 6901
  // pointer is either null (when the image ID cannot yet be parsed) or a
  // syntactically valid pointer.  Keep every permitted code and both pointer
  // forms independently executable; the generated complete-schema walk below
  // already covers missing/extra/wrong-type/null/ordinal boundaries.
  const validationCodes=['markdown-fence','non-json-prefix-or-suffix','json-syntax','duplicate-key','missing-property','unknown-property','type-or-enum','unknown-image-id','missing-image-id','duplicate-image-id','record-count-or-order','mapping-violation','response-capture-integrity'];
  const validPointers=[null,'','/records/0/anonymousImageId','/a~0b~1c'];
  assert.equal(validationCodes.length,13);assert.equal(new Set(validationCodes).size,13);
  for(const code of validationCodes)for(const jsonPointer of validPointers){
    const fixture=clone(base);fixture.evidence.validationErrors[0]={ordinal:0,code,jsonPointer,anonymousImageId:null};rehashEvidence(fixture);
    good('invalid-attempt',fixture,{invalidAttemptEvidenceId:fixture.evidence.invalidAttemptEvidenceId,evidenceFileSha256:fixture.evidenceFileSha256,disposition:'retry-allowed'},`validation-error-positive/${code}/${jsonPointer===null?'null':jsonPointer||'empty'}`);
  }
  for(const [label,mutate,field]of[
    ['code-invented',f=>{f.evidence.validationErrors[0].code='invented-code';},'validationErrors.0.code'],
    ['pointer-no-leading-slash',f=>{f.evidence.validationErrors[0].jsonPointer='not/a/pointer';},'validationErrors.0.jsonPointer'],
    ['pointer-bad-escape',f=>{f.evidence.validationErrors[0].jsonPointer='/records/~2';},'validationErrors.0.jsonPointer'],
    ['pointer-dangling-escape',f=>{f.evidence.validationErrors[0].jsonPointer='/records/~';},'validationErrors.0.jsonPointer'],
  ])semanticBad(base,`validation-error-${label}`,mutate,field);
  for(const replacement of [null,'model-retry'])for(const attemptNumber of [1,2,3]){
    const fixture={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:run,...invalid(attemptNumber,replacement)};
    good('invalid-attempt',fixture,{invalidAttemptEvidenceId:fixture.evidence.invalidAttemptEvidenceId,evidenceFileSha256:fixture.evidenceFileSha256,disposition:attemptNumber===3?'attempt-limit-reached':'retry-allowed'},`semantic-positive/${replacement??'root'}/${attemptNumber}`);
    semanticBad(fixture,`${replacement}/${attemptNumber}/disposition`,f=>{f.evidence.disposition=attemptNumber===3?'retry-allowed':'attempt-limit-reached';},'disposition');
    if(replacement)for(const [label,mutate,field]of[
      ['active-ID',f=>{f.evidence.activeArtifactBeforeCampaign.artifactId='other-active';},'activeArtifactBeforeCampaign.artifactId'],
      ['active-file',f=>{f.evidence.activeArtifactBeforeCampaign.artifactFileSha256=H('other-active');},'activeArtifactBeforeCampaign.artifactFileSha256'],
      ['active-null',f=>{f.evidence.activeArtifactBeforeCampaign=null;},'activeArtifactBeforeCampaign'],
      ['reason',f=>{f.evidence.replacementReasonCode='not-a-reason';},'replacementReasonCode'],
      ['changed-input',f=>{f.evidence.changedInputSha256=H('different-replacement-input');},'changedInputSha256'],
    ])semanticBad(fixture,`replacement/${attemptNumber}/${label}`,mutate,field);
  }
  // Every non-model-retry §8.1 replacement reason has an independently signed positive at
  // every legal attempt number.  The negatives deliberately keep the evidence
  // file/ID and campaign ID internally valid: they test authority binding,
  // rather than detecting a stale outer hash.
  for(const authority of replacementAuthorities.filter(row=>row.reasonCode!=='model-retry'))for(const attemptNumber of [1,2,3]){
    const fixture={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:run,...invalid(attemptNumber,authority.reasonCode)};
    good('invalid-attempt',fixture,{invalidAttemptEvidenceId:fixture.evidence.invalidAttemptEvidenceId,evidenceFileSha256:fixture.evidenceFileSha256,disposition:attemptNumber===3?'attempt-limit-reached':'retry-allowed'},`replacement-positive/${authority.reasonCode}/${attemptNumber}`);
  }
  const replacementNegativeMatrix=buildReplacementNegativeRows(c,w,rawPath);
  assertReplacementNegatives(c,replacementNegativeMatrix);
  registerNegativeRows(replacementNegativeMatrix.rows);
  const attemptNegativeRows=buildAttemptNegativeRows(c,w,rawPath);
  assertAttemptNegatives(c,attemptNegativeRows);
  registerNegativeRows(attemptNegativeRows);
  semanticBad(base,'campaign-rehashed-kind',f=>{
    f.campaign.campaignKind='replacement-materialization';f.evidence.campaignKind=f.campaign.campaignKind;
    f.evidence.campaignIdSha256=hash(f.campaign);
  },'campaignKind');
  for(const field of ['slotPlanObjectSha256','logicalSlot','promptVariablesObjectSha256','batchInputTableObjectSha256','orderedInputSha256'])semanticBad(base,`campaign-rehashed-${field}`,f=>{
    f.campaign[field]=field==='logicalSlot'?'annotator-2-batch-01':H(`campaign-${field}`);
    if(field==='slotPlanObjectSha256'||field==='logicalSlot')f.evidence[field]=f.campaign[field];
    else if(field==='promptVariablesObjectSha256')f.evidence.promptRefs[field]=f.campaign[field];
    else f.evidence.inputRefs[field]=f.campaign[field];
    f.evidence.campaignIdSha256=hash(f.campaign);
  },field);
  for(const [attempts,replacement,expected] of [
    [['valid'],false,{state:'active-root',invalidEvidenceCount:0,validAttemptNumber:1,ledgerEntries:0}],
    [['invalid','valid'],false,{state:'active-root',invalidEvidenceCount:1,validAttemptNumber:2,ledgerEntries:0}],
    [['invalid','invalid','valid'],false,{state:'active-root',invalidEvidenceCount:2,validAttemptNumber:3,ledgerEntries:0}],
    [['invalid','invalid','invalid'],false,{state:'failed-closed',invalidEvidenceCount:3,validAttemptNumber:null,ledgerEntries:0}],
    [['invalid','valid'],true,{state:'active-replacement',invalidEvidenceCount:1,validAttemptNumber:2,ledgerEntries:1}],
    [['invalid','invalid','invalid'],true,{state:'failed-closed',invalidEvidenceCount:3,validAttemptNumber:null,ledgerEntries:0}],
  ]){
    const evidence=attempts.flatMap((v,i)=>v==='invalid'?[invalid(i+1,replacement?'model-retry':null)]:[]);
    const validIndex=attempts.indexOf('valid'),validWrapper=validIndex<0?null:clone(run);
    if(validWrapper){validWrapper.header.generator.attemptNumber=validIndex+1;validWrapper.campaign=invalid(1,replacement?'model-retry':null).campaign;validWrapper.header.generator.campaignIdSha256=hash(validWrapper.campaign);if(replacement)validWrapper.header.artifactId='replacement-annotation';validWrapper.bytes=jsonlArtifact(validWrapper);validWrapper.fileSha256=sha(validWrapper.bytes);}
    const fixture={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:clone(run),ledger:clone(w.emptyLedger),campaign:invalid(1,replacement?'model-retry':null).campaign,submissions:attempts.map((state,i)=>({attemptNumber:i+1,state,freshContext:true})),invalidEvidence:evidence,validWrapper,activeBefore:replacement?{artifactId:run.header.artifactId,fileSha256:run.fileSha256}:null,atomicReplacement:replacement,activeDuringInvalid:replacement?run.header.artifactId:null,requiredAnnotationRoot:true,failurePolicy:'stop-pilot',invalidEvidenceInLedger:[],invalidEvidenceInSnapshots:[]};
    // Historical mutation cases below retain their coverage.  The D-20
    // positive contract is deliberately represented only by the unique 18-row
    // matrix, so this overlapping historical positive is not registered.
    assert.equal(fixture.invalidEvidence.length,expected.invalidEvidenceCount);
    for(const [label,fn,field]of[
      ['zero',f=>{f.submissions[0].attemptNumber=0;},'attemptNumber'],['four',f=>{f.submissions.push({attemptNumber:4,state:'valid',freshContext:true});},'attemptNumber'],['duplicate',f=>{f.submissions.push(clone(f.submissions[0]));},'attemptNumber'],['gap',f=>{f.submissions[0].attemptNumber=2;},'attemptNumber'],['stale-context',f=>{f.submissions[0].freshContext=false;},'freshContext'],['changed-input',f=>{f.campaign.orderedInputSha256=H('changed');},'orderedInputSha256'],['ledger-injection',f=>{f.invalidEvidenceInLedger=[H('invalid-attempt')];},'invalidEvidenceInLedger'],['snapshot-injection',f=>{f.invalidEvidenceInSnapshots=[H('invalid-attempt')];},'invalidEvidenceInSnapshots'],
    ])bad('attempt-campaign',fixture,fn,'attempt-campaign-invalid',field,'RangeError',`${replacement}/${attempts.join('-')}/${label}`);
    if(validWrapper&&evidence.length)bad('attempt-campaign',fixture,f=>{f.validWrapper.header.generator.attemptNumber=1;},'attempt-number-double-use','attemptNumber');
    if(replacement)bad('attempt-campaign',fixture,f=>{f.activeDuringInvalid='replacement-annotation';},'replacement-not-atomic','activeDuringInvalid');
  }
  // This is intentionally not in the normal Green registry.  It is the one
  // D-20 Red probe: everything is re-signed after changing only evidence #2
  // from attempt 2 to attempt 1, so a validator must reject duplicate evidence
  // numbering rather than a stale ID, bytes or file hash.
  const firstInvalid=invalid(1,null),secondInvalid=invalid(2,null);secondInvalid.evidence.attemptNumber=1;rehashEvidence(secondInvalid);
  const validWrapper=clone(run);validWrapper.header.generator.attemptNumber=3;validWrapper.campaign=firstInvalid.campaign;validWrapper.header.generator.campaignIdSha256=hash(firstInvalid.campaign);validWrapper.bytes=jsonlArtifact(validWrapper);validWrapper.fileSha256=sha(validWrapper.bytes);
  duplicateInvalidEvidenceProbe={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:clone(run),ledger:clone(w.emptyLedger),campaign:firstInvalid.campaign,submissions:[{attemptNumber:1,state:'invalid',freshContext:true},{attemptNumber:2,state:'invalid',freshContext:true},{attemptNumber:3,state:'valid',freshContext:true}],invalidEvidence:[firstInvalid,secondInvalid],validWrapper,activeBefore:null,atomicReplacement:false,activeDuringInvalid:null,requiredAnnotationRoot:true,failurePolicy:'stop-pilot',invalidEvidenceInLedger:[],invalidEvidenceInSnapshots:[]};
  const transitionShapes=[
    {name:'valid-1',attempts:['valid'],state:'active'},
    {name:'invalid-1-retryable-2',attempts:['invalid'],state:'retryable-2'},
    {name:'invalid-1-valid-2',attempts:['invalid','valid'],state:'active'},
    {name:'invalid-1-invalid-2-retryable-3',attempts:['invalid','invalid'],state:'retryable-3'},
    {name:'invalid-1-invalid-2-valid-3',attempts:['invalid','invalid','valid'],state:'active'},
    {name:'invalid-1-invalid-2-invalid-3-failed-closed',attempts:['invalid','invalid','invalid'],state:'failed-closed'},
  ];
  const transitionFixtureHashes=[],transitionRows=[];
  for(const reason of [null,'model-retry','input-change'])for(const transition of transitionShapes){
    const {attempts}=transition;
    const replacement=reason!==null,invalidEvidence=attempts.flatMap((state,index)=>state==='invalid'?[invalid(index+1,reason)]:[]),validIndex=attempts.indexOf('valid');
    const campaign=invalid(1,reason).campaign;
    const wrapper=validIndex<0?null:materializeValidWrapper({run,firstPlan:w.firstPlan,campaign,promptChain:reason==='input-change'?replacementSources['input-change'].chain:null,attemptNumber:validIndex+1,artifactId:replacement?`replacement-${reason}`:run.header.artifactId});
    if(wrapper)assertValidWrapper({contract:c,firstPlan:w.firstPlan,run,wrapper,campaign,promptChain:reason==='input-change'?replacementSources['input-change'].chain:null,attemptNumber:validIndex+1});
    if(reason==='input-change'&&wrapper){
      const source=replacementSources['input-change'];
      assert.equal(hash(wrapper.table),source.tableObjectSha256);
      assert.equal(wrapper.header.generator.promptVariablesObjectSha256,source.prompt.variablesObjectSha256);
      assert.equal(wrapper.header.generator.renderedPromptEvidenceObjectSha256,hash(source.prompt.evidence));
      assert.equal(wrapper.campaign.batchInputTableObjectSha256,source.tableObjectSha256);
    }
    const failed=transition.state==='failed-closed',fixture={protocol:c.protocol,firstPlan:w.firstPlan,plannedRun:clone(run),ledger:clone(w.emptyLedger),campaign,submissions:attempts.map((state,index)=>({attemptNumber:index+1,state,freshContext:true})),invalidEvidence,validWrapper:wrapper,activeBefore:replacement?{artifactId:run.header.artifactId,fileSha256:run.fileSha256}:null,atomicReplacement:replacement,activeDuringInvalid:replacement?run.header.artifactId:null,requiredAnnotationRoot:true,failurePolicy:'stop-pilot',invalidEvidenceInLedger:[],invalidEvidenceInSnapshots:[]};
    const priorState=attempts.length===1?'planned':attempts.length===2?'retryable-2':'retryable-3',acceptedAttempt=validIndex<0?null:validIndex+1,requiredEvidenceNumbers=invalidEvidence.map(e=>e.evidence.attemptNumber);
    transitionFixtureHashes.push(hash(fixture));transitionRows.push({reason:reason??'root',name:transition.name,priorState,acceptedAttempt,requiredEvidenceNumbers,resultingState:transition.state});
    good('attempt-state-transition',fixture,{state:transition.state==='active'?(replacement?'active-replacement':'active-root'):transition.state,invalidEvidenceCount:invalidEvidence.length,validAttemptNumber:acceptedAttempt,ledgerEntries:replacement&&transition.state==='active'?1:0,activeArtifactId:wrapper?.header.artifactId??(replacement?run.header.artifactId:null)},`${reason??'root'}/${transition.name}/prior=${priorState}/accepted=${acceptedAttempt??'none'}/evidence=${requiredEvidenceNumbers.join(',')||'none'}`);
  }
  assert.equal(transitionRows.length,18);assert.equal(new Set(transitionRows.map(row=>`${row.reason}/${row.name}`)).size,18);assert.equal(new Set(transitionFixtureHashes).size,18);
  for(const reason of ['root','model-retry','input-change'])assert.deepEqual(transitionRows.filter(row=>row.reason===reason).map(row=>[row.name,row.priorState,row.acceptedAttempt,row.requiredEvidenceNumbers,row.resultingState]),[
    ['valid-1','planned',1,[],'active'],['invalid-1-retryable-2','planned',null,[1],'retryable-2'],['invalid-1-valid-2','retryable-2',2,[1],'active'],['invalid-1-invalid-2-retryable-3','retryable-2',null,[1,2],'retryable-3'],['invalid-1-invalid-2-valid-3','retryable-3',3,[1,2],'active'],['invalid-1-invalid-2-invalid-3-failed-closed','retryable-3',null,[1,2,3],'failed-closed'],
  ]);
  for(const [a,b,d]of[[0,0,0],[0,0,1],[0,1,1],[0,1,2]]){
    const fixture=clone(base);fixture.evidence.run.startedAtUtc=utc(a);fixture.evidence.run.completedAtUtc=utc(b);fixture.evidence.run.responseCapturedAtUtc=utc(d);rehashEvidence(fixture);good('invalid-attempt',fixture,{invalidAttemptEvidenceId:fixture.evidence.invalidAttemptEvidenceId,evidenceFileSha256:fixture.evidenceFileSha256,disposition:'retry-allowed'},`utc-${a}${b}${d}`);
  }
  const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  assert.equal(permutations.filter(([a,b,d])=>a<=b&&b<=d).length,1);
  assert(permutations.some(([a,b])=>a>b));assert(permutations.some(([,b,d])=>b>d));assert(permutations.some(([a,,d])=>a>d));
  for(const [a,b,d]of permutations.filter(([a,b,d])=>!(a<=b&&b<=d)))bad('invalid-attempt',base,f=>{f.evidence.run.startedAtUtc=utc(a);f.evidence.run.completedAtUtc=utc(b);f.evidence.run.responseCapturedAtUtc=utc(d);},'utc-order','run','RangeError',`utc-${a}${b}${d}`);
  for(const value of ['2026-01-01T00:00:00.000Z','2026-01-01T00:00:00+00:00','2026-01-01t00:00:00z','2026-02-30T00:00:00Z'])bad('invalid-attempt',base,f=>{f.evidence.run.startedAtUtc=value;},'utc-seconds','startedAtUtc');
  for(const [label,fn,field]of[
    ['ID',f=>{f.evidence.invalidAttemptEvidenceId=H('false-ID');},'invalidAttemptEvidenceId'],['file-hash',f=>{f.evidenceFileSha256=H('false-file');},'evidenceFileSha256'],['filename',f=>{f.evidenceFilename='wrong.json';},'evidenceFilename'],['raw-hash',f=>{f.evidence.rawResponseSha256=H('false-raw');},'rawResponseSha256'],['raw-length',f=>{f.evidence.rawResponseByteLength=8;},'rawResponseByteLength'],['raw-both',f=>{f.evidence.rawResponseByteLength=10;f.evidence.rawResponseSha256=H('false-raw');},'rawResponseSha256'],['campaign',f=>{f.evidence.campaignIdSha256=H('false-campaign');},'campaignIdSha256'],['validation-multiple',f=>{f.evidence.validationErrors.push(clone(f.evidence.validationErrors[0]));},'validationErrors'],['header-injection',f=>{f.evidence.slotArtifactId='root-invalid';},'slotArtifactId'],
  ])bad('invalid-attempt',base,fn,'invalid-attempt-evidence',field,'RangeError',label);
  for(const length of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,8,10])bad('invalid-attempt',base,f=>{f.evidence.rawResponseByteLength=length;},'raw-response-length','rawResponseByteLength');
  for(const field of ['rawResponse','rawFragment','receivedValue','freeTextError','path','account','chatUrl','username','credential','pii'])bad('invalid-attempt',base,f=>{f.evidence[field]='forbidden';},'unknown-property',field,'TypeError');
  for(const mutation of ['overwrite','append','truncate','rename-replacement']){
    const path=resolve(dir,`${mutation}.txt`);writeFileSync(path,raw,{flag:'wx'});
    if(mutation==='overwrite')writeFileSync(path,'different');if(mutation==='append')writeFileSync(path,raw+'x');if(mutation==='truncate')writeFileSync(path,raw.slice(0,-1));if(mutation==='rename-replacement'){const replacement=resolve(dir,'rename-source.txt');writeFileSync(replacement,'different');renameSync(replacement,path);}
    assert.notEqual(sha(readFileSync(path)),rawHash);
    assert.notEqual(streamFileOracle(path).sha256,rawHash);
    bad('invalid-attempt',base,f=>{f.rawResponseFile=path;},'raw-response-integrity','rawResponseFile','RangeError',mutation);
  }
  const annotationFail={...base,role:'annotator',attemptCount:3,state:'failed-closed',continuePilot:false,nextPlan:null};good('attempt-fail-closed',annotationFail,true);
  bad('attempt-fail-closed',annotationFail,f=>{f.continuePilot=true;},'required-root-failed','continuePilot');
  const adjudicationFail={...base,role:'adjudicator',attemptCount:3,state:'failed-closed',continuePilot:true,previousPlan:w.freshPlan,nextPlan:w.skippedPlan};good('attempt-fail-closed',adjudicationFail,true);
  bad('attempt-fail-closed',adjudicationFail,f=>{f.nextPlan=f.previousPlan;},'new-skipped-plan-required','nextPlan');
}
function rehashEvidence(f){const{invalidAttemptEvidenceId,...body}=f.evidence;void invalidAttemptEvidenceId;f.evidence.invalidAttemptEvidenceId=whash('invalid-attempt-evidence-id',{evidenceWithoutInvalidAttemptEvidenceId:body});f.evidenceFilename=`${f.evidence.invalidAttemptEvidenceId}.json`;f.evidenceBytes=fileBytes(f.evidence);f.evidenceFileSha256=sha(f.evidenceBytes);}

// A schema/template semantic change is not an in-plan replacement.  This
// concrete terminal sidecar keeps the old and new plans deliberately separate.
function legacyReissueCases(c,w){
  const buildReissue=(reasonCode,cause,oldSecondPlan)=>{
    const newSchema=clone(c.bundle.annotationPayloadSchemaFileSha256.object);
    const newTemplate=templates.annotator+(reasonCode==='prompt-change'?`\n# reissue-${cause}\n`:'');
    if(reasonCode==='schema-change')newSchema.$id=`${newSchema.$id}/reissue-${cause}`;
    const newSchemaBytes=fileBytes(newSchema),newSchemaFileSha256=sha(newSchemaBytes),newSchemaObjectSha256=hash(newSchema);
    const newProtocol=clone(c.protocol);newProtocol.schemaFiles.annotationPayloadSchemaFileSha256=newSchemaFileSha256;newProtocol.prompts.annotatorTemplateFileSha256=sha(newTemplate);
    if(cause==='decision-rules-mapping')newProtocol.decisionContract.growthTruthTableObjectSha256=hash([...c.tables.growth].reverse());
    const newSelection={...clone(c.plan),protocolObjectSha256:hash(newProtocol)};
    const newManifest={...clone(c.manifest),protocolObjectSha256:hash(newProtocol),selectionPlanObjectSha256:hash(newSelection)};
    const newRestricted={...clone(c.restricted),protocolObjectSha256:hash(newProtocol),selectionPlanObjectSha256:hash(newSelection),blindedManifestObjectSha256:hash(newManifest)};
    const newTable={...clone(c.inputTables[0]),protocolObjectSha256:hash(newProtocol),blindedManifestObjectSha256:hash(newManifest)};
    const newVariables={...clone(c.prompts[0].variables),protocolObjectSha256:hash(newProtocol),protocolCanonicalJson:jcs(newProtocol),schemaFileSha256:newSchemaFileSha256,modelPayloadSchemaObjectSha256:newSchemaObjectSha256,modelPayloadSchemaCanonicalJson:jcs(newSchema),batchInputTableObjectSha256:hash(newTable),batchInputTableCanonicalJson:jcs(newTable)};
    const newRendered=renderExactTemplate(newTemplate,newVariables),newEvidence={...clone(c.prompts[0].evidence),protocolObjectSha256:hash(newProtocol),promptTemplateFileSha256:sha(newTemplate),promptVariablesObjectSha256:hash(newVariables),schemaFileSha256:newSchemaFileSha256,modelPayloadSchemaObjectSha256:newSchemaObjectSha256,renderedPromptSha256:sha(newRendered)};
    const newFirstPlan={...clone(w.firstPlan),protocolObjectSha256:hash(newProtocol),blindedManifestObjectSha256:hash(newManifest),slots:w.firstPlan.slots.map(slot=>({...slot,rootArtifactId:`reissued-${reasonCode}-${slot.rootArtifactId}`}))};
    const withoutId={schemaVersion:'snow-crystal-morphology-pilot-plan-closure/1',contractId:CONTRACT,protocolId:PROTOCOL,oldProtocolObjectSha256:hash(c.protocol),oldSelectionPlanObjectSha256:hash(c.plan),oldAnnotationConsensusSlotPlanObjectSha256:hash(w.firstPlan),oldPostConsensusRouteSlotPlanObjectSha256:oldSecondPlan?hash(oldSecondPlan):null,oldSupersessionLedgerFileSha256:w.emptyLedger.fileSha256,oldCutoffSequence:0,reasonCode,closedAtUtc:utc(20),terminalState:'invalidated-reissue-required',furtherModelSubmissionsAllowed:false,furtherRootMaterializationAllowed:false};
    const closure={...withoutId,planClosureId:whash('plan-closure-id',{closureWithoutPlanClosureId:withoutId})},closureBytes=fileBytes(closure),closureFileSha256=sha(closureBytes),closureFilename=`${closure.planClosureId}.json`;
    const freezeOrder=['old-plan-closed','old-ledger-frozen','closure-frozen','new-schema-template-frozen','new-protocol-frozen','new-selection-manifest-map-frozen','new-input-prompt-frozen','new-first-plan-unexecuted'];
    const duplicateProbe=d20DuplicateInvalidEvidenceProbe();
    const oldObjects=[c.protocol,c.plan,w.firstPlan,oldSecondPlan,w.emptyLedger,w.snapshot,w.upstreamFresh,w.upstreamFreshBatch,w.upstreamSkipped,...w.runs,w.consensus,w.adjudication,...w.approvals,...w.skippedApprovals,w.coverage,w.skippedCoverage,...w.runs.map(run=>run.campaign),...(duplicateProbe?.invalidEvidence??[])].filter(Boolean);
    const newObjects=[newSchema,newProtocol,newSelection,newManifest,newRestricted,newTable,newVariables,newEvidence,newFirstPlan];
    const inventory=objects=>objects.flatMap(object=>[{objectSha256:hash(object),fileSha256:object.fileSha256??null,artifactId:object.header?.artifactId??null,bytesSha256:object.bytes?sha(object.bytes):null}]);
    const oldInventory=inventory(oldObjects),newInventory=inventory(newObjects);
    const oldIds=new Set([...oldInventory.flatMap(item=>[item.objectSha256,item.fileSha256,item.bytesSha256,item.artifactId].filter(Boolean)),...w.firstPlan.slots.map(s=>s.rootArtifactId)]),newIds=new Set([...newInventory.flatMap(item=>[item.objectSha256,item.fileSha256,item.bytesSha256,item.artifactId].filter(Boolean)),newSchemaFileSha256,newSchemaObjectSha256,...newFirstPlan.slots.map(s=>s.rootArtifactId)]);
    assert.equal(closure.planClosureId,whash('plan-closure-id',{closureWithoutPlanClosureId:withoutId}));assert.equal(closureBytes,`${jcs(closure)}\n`);assert.equal(closureFileSha256,sha(closureBytes));assert.equal([...newIds].filter(id=>oldIds.has(id)).length,0);assert.equal(sha(newTemplate),newProtocol.prompts.annotatorTemplateFileSha256);assert.equal(sha(newRendered),newEvidence.renderedPromptSha256);assert.equal(newRendered,renderExactTemplate(newTemplate,newVariables));
    return{protocol:c.protocol,selectionPlan:c.plan,oldFirstPlan:w.firstPlan,oldSecondPlan,oldLedger:w.emptyLedger,closure,closureBytes,closureFileSha256,closureFilename,freezeOrder,newSchema:{object:newSchema,bytes:newSchemaBytes,fileSha256:newSchemaFileSha256,objectSha256:newSchemaObjectSha256},newTemplateBytes:newTemplate,newProtocol,newSelection,newManifest,newRestricted,newTable,newVariables,newEvidence,newRendered,newFirstPlan,oldInventory,newInventory,oldIds:[...oldIds].sort(),newIds:[...newIds].sort(),oldSubmissionCandidate:w.runs[0],oldRootCandidate:w.firstPlan.slots[0],oldLedgerCandidate:w.emptyLedger,oldApprovalCandidate:w.approvals[0],oldCoverageCandidate:w.coverage,newPlanMaterializedRoots:[],newPlanRuns:[],newPlanCampaigns:[],newPlanInvalidEvidence:[],newPlanLedgerEntries:[],newPlanSnapshots:[],newPlanSecondPlans:[],newPlanApprovals:[],newPlanCoverage:[],oldPlanSubmissionsAfterClosure:[],oldPlanRootsAfterClosure:[],oldPlanLedgerEntriesAfterClosure:[],crossPlanReferences:[]};
  };
  const causes=[['schema-change','schema-reference'],['schema-change','decision-rules-mapping'],['prompt-change','placeholder'],['prompt-change','renderer'],['prompt-change','instruction-semantics']];
  for(const [reasonCode,cause]of causes)for(const oldSecondPlan of [null,w.freshPlan]){
    const fixture=buildReissue(reasonCode,cause,oldSecondPlan);good('plan-reissue',fixture,true,`${cause}/${oldSecondPlan?'second-plan':'no-second-plan'}`);good('plan-closure',{closure:fixture.closure},fixture.closure.planClosureId,`${cause}/${oldSecondPlan?'second-plan':'no-second-plan'}`);
    for(const [label,mutate,field]of[
    ['id',f=>{f.closure.planClosureId=H('wrong-closure-id');},'planClosureId'],['bytes',f=>{f.closureBytes=f.closureBytes.replace('{','[');},'closureBytes'],['file-hash',f=>{f.closureFileSha256=H('wrong-closure-file');},'closureFileSha256'],['filename',f=>{f.closureFilename='wrong.json';},'closureFilename'],['terminal',f=>{f.closure.terminalState='open';},'terminalState'],['reason',f=>{f.closure.reasonCode='schema-fix';},'reasonCode'],['model-allowed',f=>{f.closure.furtherModelSubmissionsAllowed=true;},'furtherModelSubmissionsAllowed'],['root-allowed',f=>{f.closure.furtherRootMaterializationAllowed=true;},'furtherRootMaterializationAllowed'],['new-reference',f=>{f.closure.newProtocolObjectSha256=hash(f.newProtocol);},'newProtocolObjectSha256'],['old-submission',f=>{f.oldPlanSubmissionsAfterClosure=[f.oldSubmissionCandidate];},'oldPlanSubmissionsAfterClosure'],['old-root',f=>{f.oldPlanRootsAfterClosure=[f.oldRootCandidate];},'oldPlanRootsAfterClosure'],['old-ledger',f=>{f.oldPlanLedgerEntriesAfterClosure=[f.oldLedgerCandidate];},'oldPlanLedgerEntriesAfterClosure'],['new-root',f=>{f.newPlanMaterializedRoots=[f.oldRootCandidate];},'newPlanMaterializedRoots'],['cross-plan',f=>{f.crossPlanReferences=[{from:f.oldApprovalCandidate,to:f.newFirstPlan}];},'crossPlanReferences'],
      ['old-artifact-reuse',f=>{f.newFirstPlan.slots[0].rootArtifactId=f.oldFirstPlan.slots[0].rootArtifactId;},'rootArtifactId'],['freeze-order',f=>{[f.freezeOrder[0],f.freezeOrder[3]]=[f.freezeOrder[3],f.freezeOrder[0]];},'freezeOrder'],
    ])bad('plan-reissue',fixture,mutate,'protocol-reissue-required',field,'RangeError',`${cause}/${label}`);
  }
}

// D-21 replaces the formerly monolithic reissue fixture.  Keep the legacy
// helper unreachable until the next cleanup commit, so this patch does not
// discard pre-existing negative coverage while every registered D-20 fixture
// is derived by the pure builders above.
export function reissueCases(c,w){
  const causes=REISSUE_CAUSES;
  const skippedGraph=materializeOldGraph(c,w,w.skippedPlan);
  assertOldGraphPositive(skippedGraph,collectArtifactInventory({oldGraph:skippedGraph,newGraph:skippedGraph}).oldInventory);
  const oldGraphs=new Map([null,w.freshPlan].map(plan=>[plan,materializeOldGraph(c,w,plan)]));
  for(const cause of causes)for(const oldSecondPlan of [null,w.freshPlan]){
    // The old graph is deliberately passed as data, not read through module
    // state.  It includes every family that could otherwise be silently
    // carried across a plan boundary.
    const oldGraph=oldGraphs.get(oldSecondPlan);
    const oldInvalidEvidence=oldGraph.invalidEvidence;
    const built=materializeReissuePlan({contract:c,workflow:w,cause,oldSecondPlan,oldGraph});
    assertReissuePositive(built);
    const fixture={
      protocol:c.protocol,selectionPlan:c.plan,oldFirstPlan:w.firstPlan,oldSecondPlan,oldLedger:w.emptyLedger,oldGraph,
      closure:built.closure,closureBytes:built.closureBytes,closureFileSha256:built.closureFileSha256,closureFilename:built.closureFilename,
      freezeOrder:['old-plan-closed','old-ledger-frozen','closure-frozen','new-authority-frozen','new-protocol-frozen','new-selection-manifest-map-frozen','new-input-prompt-frozen','new-first-plan-unexecuted'],
      newSchema:{object:built.schema,bytes:fileBytes(built.schema),fileSha256:sha(fileBytes(built.schema)),objectSha256:hash(built.schema)},newTemplateBytes:built.template,
      newProtocol:built.protocol,newSelection:built.selection,newManifest:built.manifest,newRestricted:built.restricted,newTable:built.table,
      newVariables:built.prompt.variables,newEvidence:built.prompt.evidence,newRendered:built.prompt.rendered,newFirstPlan:built.firstPlan,
      oldInventory:built.oldInventory,newInventory:built.newInventory,oldIds:built.oldIds,newIds:built.newIds,
      oldPlanSubmissionsAfterClosure:[],oldPlanRootsAfterClosure:[],oldPlanLedgerEntriesAfterClosure:[],crossPlanReferences:[],
      newPlanMaterializedRoots:[],newPlanRuns:[],newPlanCampaigns:[],newPlanInvalidEvidence:[],newPlanLedgerEntries:[],newPlanSnapshots:[],newPlanSecondPlans:[],newPlanApprovals:[],newPlanCoverage:[],
      oldSubmissionCandidate:w.runs[0],oldRootCandidate:w.firstPlan.slots[0],oldLedgerCandidate:w.emptyLedger,oldCampaignCandidate:w.runs[0].campaign,oldInvalidEvidenceCandidate:oldInvalidEvidence[0],oldSnapshotCandidate:w.snapshot,oldApprovalCandidate:w.approvals[0],oldCoverageCandidate:w.coverage,
    };
    // Source/template bytes can be immutable shared inputs; executable roots
    // are the no-reuse boundary for the newly issued plan.
    assert.equal(fixture.newFirstPlan.slots.filter(slot=>fixture.oldIds.includes(slot.rootArtifactId)).length,0);
    assert.equal(fixture.newFirstPlan.slots.length,7);
    good('plan-reissue',fixture,true,`${cause.key}/${oldSecondPlan?'second-plan':'no-second-plan'}`);
    good('plan-closure',{closure:fixture.closure},fixture.closure.planClosureId,`${cause.key}/${oldSecondPlan?'second-plan':'no-second-plan'}`);
    // Boundary negatives are independent of the six source-change positives.
    // Exercise both old second-plan shapes once, avoiding duplicate matrices.
    if(cause.key===REISSUE_CAUSES[0].key){
      const negativeRows=buildReissueNegativeRows(c,w,built);
      assertReissueNegatives(c,negativeRows,oldSecondPlan!==null);
      registerNegativeRows(negativeRows);
    }
  }
}

export function slotCases(c,w){
  const roots={protocol:c.protocol,manifest:c.manifest,restrictedMap:c.restricted,firstPlan:w.firstPlan,runs:w.runs,consensus:w.consensus,snapshot:w.snapshot,ledger:w.emptyLedger,secondPlan:w.freshPlan};good('slot-plans',roots,true);
  good('slot-plans',{...roots,secondPlan:w.skippedPlan},true,'direct-human');
  const allQWorkflow=buildWorkflow(c,{allQ:true,planningOnly:true}),allQ=allQWorkflow.consensus,partitionPlan=allQWorkflow.freshPlan;
  assert.equal(allQWorkflow.Q.length,24);
  good('route-partitions',{consensus:allQ,secondPlan:partitionPlan,manifest:c.manifest,restrictedMap:c.restricted},{adjudicationPartitions:[c.ids.slice(0,20),c.ids.slice(20)],humanIndividualAllowedCount:24});
  for(const [label,fn,field]of[
    ['early',f=>{f.snapshot=null;},'snapshot'],['required-null',f=>{f.secondPlan.slots[0].rootArtifactId=null;},'rootArtifactId'],['unused-root',f=>{f.secondPlan.slots[1].rootArtifactId='unused-root';},'rootArtifactId'],['individual-optional',f=>{f.secondPlan.slots[3].required=false;},'required'],['individual-23',f=>{f.secondPlan.slots[3].expectedOrAllowedIdsSha256=idHash(w.sourceIds.slice(0,23),true);},'expectedOrAllowedIdsSha256'],['first-missing',f=>f.firstPlan.slots.pop(),'firstPlan.slots'],['first-swap',f=>f.firstPlan.slots.reverse(),'firstPlan.slots'],['in-place',f=>{f.frozenSecondPlanSha256=hash(f.secondPlan);f.secondPlan.slots[0].logicalSlot='changed';},'secondPlan'],
  ])bad('slot-plans',roots,fn,'slot-plan-invalid',field,'RangeError',label);
  for(const label of ['missing-21st','overlap','order'])bad('route-partitions',{consensus:allQ,secondPlan:partitionPlan,manifest:c.manifest,restrictedMap:c.restricted},f=>{f.secondPlan.slots[1].expectedOrAllowedIdsSha256=idHash(label==='missing-21st'?c.ids.slice(21):label==='overlap'?[c.ids[0],...c.ids.slice(21)]:c.ids.slice(20).reverse());if(label==='order'){[f.secondPlan.slots[0],f.secondPlan.slots[1]]=[f.secondPlan.slots[1],f.secondPlan.slots[0]];}},'route-partition-invalid','expectedOrAllowedIdsSha256','RangeError',label);
  const root=w.runs[0],r1=clone(root),r2=clone(root);r1.header.artifactId='replacement-one';r1.bytes=jsonlArtifact(r1);r1.fileSha256=sha(r1.bytes);r2.header.artifactId='replacement-two';r2.bytes=jsonlArtifact(r2);r2.fileSha256=sha(r2.bytes);
  const edge=(old,next,sequence)=>({recordType:'artifact-supersession',sequence,artifactKind:'annotation-run',logicalSlot:root.header.logicalSlot,supersededArtifactId:old.header.artifactId,supersededArtifactFileSha256:old.fileSha256,replacementArtifactId:next.header.artifactId,replacementArtifactFileSha256:next.fileSha256,reasonCode:'model-retry',changedInputSha256:old.fileSha256});
  const e1=edge(root,r1,1),e2=edge(r1,r2,2),ledger1=makeLedger(c,w.firstPlan,[e1],w.emptyLedger),ledger2=makeLedger(c,w.firstPlan,[e1,e2],ledger1);
  for(const [ledger,cutoff,expected]of[[w.emptyLedger,0,root],[ledger1,0,root],[ledger1,1,r1],[ledger2,1,r1],[ledger2,2,r2]])good('active-ledger',{firstPlan:w.firstPlan,artifacts:[...w.runs,w.consensus,r1,r2],ledger,previousLedgers:[w.emptyLedger,ledger1],artifactKind:'annotation-run',logicalSlot:root.header.logicalSlot,cutoffSequence:cutoff},{artifactId:expected.header.artifactId,artifactFileSha256:expected.fileSha256});
  const ledgerBase={firstPlan:w.firstPlan,artifacts:[...w.runs,w.consensus,r1,r2],ledger:ledger2,previousLedgers:[w.emptyLedger,ledger1],artifactKind:'annotation-run',logicalSlot:root.header.logicalSlot,cutoffSequence:2};
  for(const [label,fn,field]of[
    ['cycle',f=>{f.ledger.records[2].replacementArtifactId=root.header.artifactId;},'replacementArtifactId'],['branch',f=>{f.ledger.records[2].supersededArtifactId=root.header.artifactId;},'supersededArtifactId'],['sequence-gap',f=>{f.ledger.records[2].sequence=3;},'sequence'],['sequence-swap',f=>{[f.ledger.records[1],f.ledger.records[2]]=[f.ledger.records[2],f.ledger.records[1]];},'sequence'],['kind',f=>{f.ledger.records[2].artifactKind='consensus';},'artifactKind'],['slot',f=>{f.ledger.records[2].logicalSlot='other-slot';},'logicalSlot'],['unknown-ID',f=>{f.ledger.records[2].replacementArtifactId='unknown';},'replacementArtifactId'],['unknown-file',f=>{f.ledger.records[2].replacementArtifactFileSha256=H('unknown');},'replacementArtifactFileSha256'],['ledger-supersede',f=>{f.ledger.records[2].supersededArtifactId=f.ledger.header.artifactId;},'supersededArtifactId'],['prefix-mutation',f=>{f.ledger.records[1].reasonCode='schema-fix';},'previousLedgerFileSha256'],['prefix-bytes',f=>{f.previousLedgers[1].bytes+=' ';},'previousLedgerFileSha256'],['previous-hash',f=>{f.ledger.records[0].previousLedgerFileSha256=H('bad-previous');},'previousLedgerFileSha256'],['multiple-root',f=>{f.firstPlan.slots.push(clone(f.firstPlan.slots[0]));},'rootArtifactId'],['unknown-slot',f=>{f.artifacts[0].header.logicalSlot='unplanned';},'logicalSlot'],
  ])bad('active-ledger',ledgerBase,fn,'ledger-invalid',field,'RangeError',label);
  const snapshotBase={firstPlan:w.firstPlan,secondPlan:w.freshPlan,ledger:w.emptyLedger,artifacts:[...w.runs,w.consensus,w.adjudication],annotationConsensusSnapshot:w.snapshot,upstreamSnapshot:w.upstreamFresh};good('active-snapshots',snapshotBase,{annotationConsensusSnapshotSha256:hash(w.snapshot),activeUpstreamSnapshotSha256:hash(w.upstreamFresh)});
  for(const [label,fn,field]of[
    ['missing',f=>f.annotationConsensusSnapshot.orderedItems.pop(),'orderedItems'],['extra',f=>f.annotationConsensusSnapshot.orderedItems.push(clone(f.annotationConsensusSnapshot.orderedItems[0])),'orderedItems'],['order',f=>f.annotationConsensusSnapshot.orderedItems.reverse(),'orderedItems'],['cutoff',f=>{f.annotationConsensusSnapshot.cutoffSequence=1;},'cutoffSequence'],['self',f=>{f.annotationConsensusSnapshot.orderedItems[0].activeArtifactFileSha256=hash(f.annotationConsensusSnapshot);},'activeArtifactFileSha256'],['future',f=>{f.upstreamSnapshot.orderedItems.push({artifactKind:'human-approval',logicalSlot:'human-batch',artifactId:'root-human-batch',artifactFileSha256:w.approvals[0].fileSha256});},'artifactKind'],['object-as-file',f=>{f.annotationConsensusSnapshot.orderedItems[0].activeArtifactFileSha256=hash(w.runs[0].header);},'activeArtifactFileSha256'],['stale-after-replacement',f=>{f.ledger=ledger1;},'supersessionLedgerFileSha256'],['upstream-missing',f=>f.upstreamSnapshot.orderedItems.pop(),'orderedItems'],['ledger-item',f=>{f.upstreamSnapshot.orderedItems.push({artifactKind:'supersession-ledger',logicalSlot:'ledger-all',artifactId:w.emptyLedger.header.artifactId,artifactFileSha256:w.emptyLedger.fileSha256});},'artifactKind'],
  ])bad('active-snapshots',snapshotBase,fn,'snapshot-invalid',field,'RangeError',label);
  const nodes=[
    ['protocol',[]],['schemas',[]],['selection',['protocol']],['manifest',['protocol','selection']],['restricted',['manifest','selection']],['batch',['protocol','manifest']],['variables',['protocol','schemas','batch']],['rendered',['variables']],['first-plan',['protocol','manifest']],['runs',['first-plan','rendered','batch']],['consensus',['runs','first-plan']],['annotation-snapshot',['runs','consensus','first-plan']],['second-plan',['annotation-snapshot','consensus']],['aliases',['second-plan','consensus','runs']],['candidate-table',['aliases']],['adjudicator-rendered',['variables','candidate-table','batch']],['adjudication',['second-plan','adjudicator-rendered','candidate-table']],['upstream',['annotation-snapshot','second-plan','adjudication','runs','consensus']],['approval',['upstream','restricted']],['coverage-snapshot',['approval','second-plan']],['coverage',['coverage-snapshot','approval','restricted']],
  ].map(([id,dependencies])=>({id,dependencies}));
  const visiting=new Set(),visited=new Set();function visit(id){assert(!visiting.has(id));if(visited.has(id))return;visiting.add(id);for(const d of nodes.find(n=>n.id===id).dependencies)visit(d);visiting.delete(id);visited.add(id);}nodes.forEach(n=>visit(n.id));assert.equal(visited.size,nodes.length);
  good('artifact-dag',{nodes},true);for(const [from,to]of[['protocol','runs'],['approval','coverage'],['first-plan','runs'],['second-plan','adjudication'],['annotation-snapshot','coverage'],['coverage','coverage']])bad('artifact-dag',{nodes},f=>{f.nodes.find(n=>n.id===from).dependencies.push(to);},'artifact-dag-cycle','dependencies');
  // Protocol §13 fixes both the required nodes and each dependency, not merely
  // acyclicity. Keep the literal graph above independent of the validator.
  const requiredEdges=nodes.flatMap(node=>node.dependencies.map(dependency=>[node.id,dependency]));
  assert.equal(nodes.length,21);assert.equal(new Set(nodes.map(node=>node.id)).size,21);
  assert.equal(new Set(requiredEdges.map(edge=>edge.join('/'))).size,requiredEdges.length);
  bad('artifact-dag',{nodes},f=>{for(const node of f.nodes)node.dependencies=[];},'artifact-dag-invalid','dependencies','RangeError','closure/all-edges-deleted');
  for(const [from,to]of requiredEdges){
    bad('artifact-dag',{nodes},f=>{f.nodes.find(node=>node.id===from).dependencies=f.nodes.find(node=>node.id===from).dependencies.filter(id=>id!==to);},'artifact-dag-invalid','dependencies','RangeError',`closure/missing-edge/${from}/${to}`);
    bad('artifact-dag',{nodes},f=>{f.nodes.find(node=>node.id===to).dependencies.push(from);},'artifact-dag-cycle','dependencies','RangeError',`closure/reversed-edge/${from}/${to}`);
    bad('artifact-dag',{nodes},f=>{f.nodes.find(node=>node.id===from).dependencies.push(to);},'artifact-dag-invalid','dependencies','RangeError',`closure/duplicate-edge/${from}/${to}`);
  }
  for(const node of nodes){
    bad('artifact-dag',{nodes},f=>{f.nodes=f.nodes.filter(n=>n.id!==node.id);},'artifact-dag-invalid','nodes','RangeError',`closure/missing-node/${node.id}`);
    bad('artifact-dag',{nodes},f=>{f.nodes.push(clone(node));},'artifact-dag-invalid','nodes','RangeError',`closure/duplicate-node/${node.id}`);
    bad('artifact-dag',{nodes},f=>{f.nodes.find(n=>n.id===node.id).dependencies.push(node.id);},'artifact-dag-cycle','dependencies','RangeError',`closure/self/${node.id}`);
  }
  bad('artifact-dag',{nodes},f=>{f.nodes.push({id:'invalid-attempt-evidence',dependencies:['runs']});},'artifact-dag-invalid','nodes','RangeError','closure/forbidden-invalid-evidence-node');
  // Earlier nodes are already materialized, so these extra edges are acyclic;
  // a DFS-only implementation cannot reject them. Enumerate every such pair.
  for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)if(!nodes[i].dependencies.includes(nodes[j].id))bad('artifact-dag',{nodes},f=>{
    f.nodes[i].dependencies.push(f.nodes[j].id);
  },'artifact-dag-invalid','dependencies','RangeError',`closure/extra-forward-edge/${nodes[i].id}/${nodes[j].id}`);
}
const jsonlArtifact=a=>[a.header,...a.records].map(fileBytes).join('');

export function adjudicationCases(c,w){
  const base={protocol:c.protocol,manifest:c.manifest,firstPlan:w.firstPlan,consensus:w.consensus,runs:w.runs,secondPlan:w.freshPlan,aliases:w.aliases,candidateTable:w.candidateTable,adjudication:w.adjudication};good('adjudication',base,{fileSha256:w.adjudication.fileSha256,candidateInputSha256:w.candidateInput,advisory:true});
  captureIntegrityCases('adjudication',base,'adjudication');
  assert(!FAMILIES.includes(w.freshPlan.adjudicatorEligibility.displayedModelFamily));assert.equal(w.freshPlan.adjudicatorEligibility.product,'GitHub Copilot');
  for(const name of ['claude','openai','google'])bad('adjudication',base,f=>{f.secondPlan.adjudicatorEligibility.displayedModelFamily=name;},'adjudicator-family-overlap','displayedModelFamily');
  for(const [label,fn,field]of[
    ['unknown-family',f=>{f.secondPlan.adjudicatorEligibility.displayedModelFamily='unknown';},'displayedModelFamily'],['missing-display',f=>{f.secondPlan.adjudicatorEligibility.displayedModelId='';},'displayedModelId'],['missing-client',f=>{f.secondPlan.adjudicatorEligibility.clientToolVersion=null;},'clientToolVersion'],['alias-order',f=>f.aliases.entries[0].candidates.reverse(),'candidates'],['alias-fixed',f=>{f.aliases.entries[0].permutationSeedSha256=H('fixed');},'permutationSeedSha256'],['candidate-majority',f=>{f.adjudication.records[0].selectedCandidate='candidate-majority';},'selectedCandidate'],['partition-missing',f=>f.adjudication.records.pop(),'records'],['partition-extra',f=>f.adjudication.records.push(clone(f.adjudication.records[0])),'records'],['prompt-hash',f=>{f.adjudication.header.generator.renderedPromptSha256=H('wrong');},'renderedPromptSha256'],['candidate-input',f=>{f.adjudication.header.orderedInputSha256=H('image-only');},'orderedInputSha256'],['image-input-order',f=>f.adjudication.table.orderedItems.reverse(),'orderedItems'],['automatic-final',f=>{f.adjudication.autoPromoteHumanFinal=true;},'autoPromoteHumanFinal'],
  ])bad('adjudication',base,fn,'adjudication-invalid',field,'RangeError',label);
  for(const field of ['provider','displayedModelId','actorId','startedAtUtc','originalOrder'])bad('adjudication',base,f=>{f.candidateTable.orderedItems[0].candidates[0][field]='leak';},'candidate-redaction',field,'TypeError');
  for(const [label,fn,field]of[
    ['one-no-selection',f=>{f.adjudication.records[0].selectedCandidate=null;},'selectedCandidate'],['one-different',f=>{f.adjudication.records[0].observations.visibilityLimitations=['overlap'];},'observations'],['new-with-selection',f=>{f.adjudication.records[1].selectedCandidate='candidate-X';},'selectedCandidate'],['evidence-only-new',f=>{const candidate=f.candidateTable.orderedItems[1].candidates[0];f.adjudication.records[1].observations=candidate.observations;f.adjudication.records[1].classification=candidate.classification;},'disposition'],['retain-clear-high',f=>{f.adjudication.records[2].classification=clone(w.runs[0].records[0].classification);},'disposition'],['disputed-fields',f=>{f.adjudication.records[0].disputedFields=[];},'disputedFields'],
  ])bad('adjudication',base,fn,'adjudication-disposition','disposition','RangeError',`${label}/${field}`);
  for(const reason of ['model-family-overlap','model-family-not-displayed','adjudicator-unavailable','adjudicator-run-failed']){
    const plan=clone(w.skippedPlan);plan.adjudicationSkipReason=reason;const fixture={firstPlan:w.firstPlan,consensus:w.consensus,previousPlan:w.freshPlan,secondPlan:plan,adjudicationArtifacts:[],humanIndividualQ:w.Q};good('adjudication-fallback',fixture,true,reason);
    bad('adjudication-fallback',fixture,f=>{f.adjudicationArtifacts=[w.adjudication];},'skipped-adjudication-forbidden','adjudicationArtifacts');bad('adjudication-fallback',fixture,f=>{f.secondPlan.adjudicatorEligibility=clone(w.freshPlan.adjudicatorEligibility);},'skipped-eligibility-null','adjudicatorEligibility');
  }
}

export function approvalCases(c,w){
  for(const fresh of [true,false]){
    const approvals=fresh?w.approvals:w.skippedApprovals,coverage=fresh?w.coverage:w.skippedCoverage,secondPlan=fresh?w.freshPlan:w.skippedPlan;
    const upstreamSnapshots=fresh?[w.upstreamFreshBatch,w.upstreamFresh]:[w.upstreamSkipped];
    const base={protocol:c.protocol,manifest:c.manifest,restrictedMap:c.restricted,firstPlan:w.firstPlan,secondPlan,ledger:w.emptyLedger,annotationConsensusSnapshot:w.snapshot,upstreamSnapshots,runs:w.runs,consensus:w.consensus,adjudications:fresh?[w.adjudication]:[],approvals,coverage};
    for(const approval of approvals){
      const record=approval.records[0],expected=approvalUpstreamSnapshot(w,fresh,[w.consensus.header.artifactId,...record.targets.map(t=>t.proposal.artifactId)]),actual=upstreamSnapshots.find(s=>hash(s)===record.activeUpstreamSnapshotSha256);
      assert.deepEqual(actual,expected);
      const closure={firstPlan:w.firstPlan,secondPlan,ledger:w.emptyLedger,annotationConsensusSnapshot:w.snapshot,artifacts:[...w.runs,w.consensus,...(fresh?[w.adjudication]:[])],approvalRecord:record,upstreamSnapshot:actual};
      good('approval-upstream-closure',closure,hash(expected),`${fresh}/${record.approvalMode}`);
      bad('approval-upstream-closure',closure,f=>f.upstreamSnapshot.orderedItems.pop(),'upstream-closure-missing','orderedItems');
      bad('approval-upstream-closure',closure,f=>f.upstreamSnapshot.orderedItems.push(clone(f.upstreamSnapshot.orderedItems[0])),'upstream-closure-extra','orderedItems');
      if(fresh&&record.approvalMode==='batch-summary')bad('approval-upstream-closure',closure,f=>{f.upstreamSnapshot.orderedItems.push(clone(w.upstreamFresh.orderedItems.find(i=>i.artifactKind==='adjudication-run')));},'upstream-closure-extra','orderedItems');
      if(fresh&&record.approvalMode==='individual-source-pdf')bad('approval-upstream-closure',closure,f=>{f.upstreamSnapshot.orderedItems=f.upstreamSnapshot.orderedItems.filter(i=>i.artifactKind!=='adjudication-run');},'upstream-closure-missing','orderedItems');
    }
    assert.equal(approvals[0].records[0].targets.length,8);assert.equal(approvals[1].records[0].targets.length,16);assert.equal(coverage.records[0].coveredFinals.length,24);
    good('human-approval',base,approvals.map(a=>({artifactFileSha256:a.fileSha256,approvalId:a.records[0].approvalId,approvalRecordObjectSha256:hash(a.records[0]),finalValuesSha256:a.records[0].finalValuesSha256})),fresh?'fresh':'skipped');
    good('pilot-coverage',base,{approvalCoverageSnapshotSha256:hash(coverage.snapshot),coveredFinals:coverage.records[0].coveredFinals,fileSha256:coverage.fileSha256},fresh?'fresh':'skipped');
    for(const [label,fn,field]of[
      ['batch-correction',f=>{f.approvals[0].records[0].targets[0].outcome='corrected';},'outcome'],['batch-final',f=>{f.approvals[0].records[0].targets[0].final.confidence='medium';},'final'],['batch-rationale',f=>{f.approvals[0].records[0].targets[0].rationale='not-null';},'rationale'],['individual-empty',f=>{f.approvals[1].records[0].targets[0].rationale='';},'rationale'],['individual-long',f=>{f.approvals[1].records[0].targets[0].rationale='a'.repeat(501);},'rationale'],['individual-NFD',f=>{f.approvals[1].records[0].targets[0].rationale='e\u0301';},'rationale'],['approved-no-proposal',f=>{f.approvals[1].records[0].targets[0].outcome='approved';f.approvals[1].records[0].targets[0].proposal.proposalVote=null;},'proposalVote'],['corrected-identical',f=>{const t=f.approvals[1].records[0].targets.find(t=>t.proposal.proposalVote);t.outcome='corrected';t.final=clone(t.proposal.proposalVote);},'outcome'],['rejected-final',f=>{f.approvals[1].records[0].targets[0].outcome='rejected';},'final'],['inactive',f=>{f.approvals[0].records[0].targets[0].proposal.artifactFileSha256=H('inactive-proposal');},'artifactFileSha256'],['fabricated-adjudication',f=>{f.approvals[0].records[0].targets[0].proposal.sourceKind='adjudication';},'sourceKind'],['source-order',f=>f.approvals[1].records[0].targets.reverse(),'targets'],['mode',f=>{f.approvals[1].records[0].approvalMode='batch-summary';},'approvalMode'],['snapshot',f=>{f.approvals[0].records[0].targets[0].activeUpstreamSnapshotSha256=H('bad-snapshot');},'activeUpstreamSnapshotSha256'],['proposal-hash',f=>{f.approvals[0].records[0].targets[0].proposal.proposalVoteObjectSha256=H('bad-proposal');},'proposalVoteObjectSha256'],['final-hash',f=>{f.approvals[0].records[0].finalValuesSha256=H('bad-final');},'finalValuesSha256'],['approval-ID',f=>{f.approvals[0].records[0].approvalId=hash(f.approvals[0].records[0]);},'approvalId'],['completed-record-hash',f=>{f.coverage.records[0].activeApprovalRefs[0].approvalRecordObjectSha256=f.approvals[0].records[0].approvalId;},'approvalRecordObjectSha256'],
    ])bad('human-approval',base,fn,'human-approval-invalid',field,'RangeError',`${fresh}/${label}`);
    for(const field of ['name','email','account','device','chatUrl'])bad('human-approval',base,f=>{f.approvals[1].records[0].targets[0][field]='forbidden';},'unknown-property',field,'TypeError');
    for(const pii of ['operator@example.test','account: synthetic-user-123','device: synthetic-workstation','https://chat.example.test/session/1','氏名: テスト担当者'])bad('human-approval',base,f=>{f.approvals[1].records[0].targets[0].rationale=pii;},'rationale-pii','rationale');
    for(const [label,fn,field]of[
      ['mapping-unknown',f=>{f.restrictedMap.entries[0].sourceObservationId='L23-F2-P11-N999';},'sourceObservationId'],['mapping-missing',f=>f.restrictedMap.entries.pop(),'entries'],['mapping-duplicate',f=>{f.restrictedMap.entries[1].sourceObservationId=f.restrictedMap.entries[0].sourceObservationId;},'sourceObservationId'],['23',f=>f.coverage.records[0].coveredFinals.pop(),'coveredFinals'],['25',f=>f.coverage.records[0].coveredFinals.push(clone(f.coverage.records[0].coveredFinals[0])),'coveredFinals'],['rejected',f=>{const t=f.approvals[0].records[0].targets[0];t.outcome='rejected';t.final=null;},'outcome'],['spot-check',f=>{f.approvals[0].records[0].approvalMode='spot-check';},'approvalMode'],['proposal-only',f=>{f.coverage.records[0].coveredFinals[0].final=null;},'final'],['source-pair',f=>{f.coverage.records[0].coveredFinals[0].anonymousImageId='img-999';},'anonymousImageId'],['target-hash',f=>{f.coverage.records[0].coveredFinals[0].approvalTargetObjectSha256=H('bad-target');},'approvalTargetObjectSha256'],['approval-file',f=>{f.coverage.records[0].coveredFinals[0].approvalArtifactFileSha256=H('bad-file');},'approvalArtifactFileSha256'],['snapshot-hash',f=>{f.coverage.records[0].approvalCoverageSnapshotSha256=H('bad-coverage-snapshot');},'approvalCoverageSnapshotSha256'],['nonterminal',f=>{f.coverage.records[0].activeApprovalRefs[0].activeApprovalArtifactId='superseded-human';},'activeApprovalArtifactId'],['scope',f=>{f.coverage.records[0].coverageScope='production-206';},'coverageScope'],['hand-input',f=>{f.coveredFinalsInput=clone(f.coverage.records[0].coveredFinals);},'coveredFinalsInput'],
    ])bad('pilot-coverage',base,fn,['scope','spot-check'].includes(label)?'type-or-enum':'pilot-coverage-invalid',field,['scope','spot-check'].includes(label)?'TypeError':'RangeError',`${fresh}/${label}`);
    for(const consumer of ['annotationApprovals','corpus-complete','split','loss','holdout','T1-8'])bad('production-boundary',{consumer,pilotCoverage:coverage.records[0]},()=>{},'annotation-approval','pilotCoverage','RangeError',consumer);
  }
  // A rejected individual record is legal as an approval but cannot complete coverage.
  const rejected=clone(w.skippedApprovals[1].records[0]);rejected.targets=rejected.targets.slice(0,1);rejected.targets[0].outcome='rejected';rejected.targets[0].final=null;rejected.finalValuesSha256=null;const{approvalId,...body}=rejected;void approvalId;rejected.approvalId=whash('approval-record-id',{approvalRecordWithoutApprovalId:body});good('human-approval-record',{record:rejected,upstreamSnapshot:w.upstreamSkipped,restrictedMap:c.restricted,consensus:w.consensus},rejected.approvalId);
  const original=w.approvals[1],replacement=clone(original),record=replacement.records[0];
  record.approvedAtUtc=utc(11);record.targets[0].rationale='原資料を再確認し、同じ最終分類を維持。';const{approvalId:oldId,...withoutId}=record;void oldId;record.approvalId=whash('approval-record-id',{approvalRecordWithoutApprovalId:withoutId});
  replacement.header.artifactId='replacement-human-individual';replacement.header.createdAtUtc=utc(12);replacement.bytes=jsonlArtifact(replacement);replacement.fileSha256=sha(replacement.bytes);
  const edge={recordType:'artifact-supersession',sequence:1,artifactKind:'human-approval',logicalSlot:original.header.logicalSlot,supersededArtifactId:original.header.artifactId,supersededArtifactFileSha256:original.fileSha256,replacementArtifactId:replacement.header.artifactId,replacementArtifactFileSha256:replacement.fileSha256,reasonCode:'human-correction',changedInputSha256:hash(record)};
  const ledger=makeLedger(c,w.firstPlan,[edge],w.emptyLedger,w.freshPlan);ledger.header.createdAtUtc=utc(13);ledger.bytes=jsonlArtifact(ledger);ledger.fileSha256=sha(ledger.bytes);
  const approvals=[w.approvals[0],replacement],coverage=makeCoverage(c,{...w,emptyLedger:ledger},approvals,true,1);coverage.header.createdAtUtc=utc(14);coverage.bytes=jsonlArtifact(coverage);coverage.fileSha256=sha(coverage.bytes);
  const active={protocol:c.protocol,manifest:c.manifest,restrictedMap:c.restricted,firstPlan:w.firstPlan,secondPlan:w.freshPlan,ledger,previousLedgers:[w.emptyLedger],annotationConsensusSnapshot:w.snapshot,upstreamSnapshots:[w.upstreamFreshBatch,w.upstreamFresh],runs:w.runs,consensus:w.consensus,adjudications:[w.adjudication],approvals,artifactInventory:[...w.approvals,replacement],coverage};
  good('pilot-coverage',active,{approvalCoverageSnapshotSha256:hash(coverage.snapshot),coveredFinals:coverage.records[0].coveredFinals,fileSha256:coverage.fileSha256},'human-approval-replacement-terminal');
  bad('pilot-coverage',active,f=>{f.approvals[1]=clone(original);},'superseded-approval','activeApprovalArtifactId');
  bad('pilot-coverage',active,f=>{f.coverage=clone(w.coverage);},'stale-approval-coverage','approvalCoverageSnapshotSha256');
}
