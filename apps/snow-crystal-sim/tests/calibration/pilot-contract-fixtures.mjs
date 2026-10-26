import { assert, CONTRACT, PROTOCOL, PDF, CODEC, POLICY, H, utc, sha, hash, whash, idHash, jcs, fileBytes, clone, cmp, good, bad, schemaBundle, SCHEMA_PROPERTIES, templates, placeholders, render, parseUnique, schemaAccepts } from './pilot-oracle.mjs';
import { png, rgbaHash, sourcePixels, maskedPixels } from './pilot-images.mjs';

export const VIS = ['sufficient','limited','not-visible'];
export const OBS = ['clear','absent','uncertain'];
export const BRANCH = [...OBS,'not-applicable'];
export const CONF = ['low','medium','high'];
export const FIELDS = ['growthAxis','basalBranchingLevel','hollowing'];
export const ACTORS = ['annotator-1','annotator-2','annotator-3'];
export const FAMILIES = ['claude','openai','google'];
export const BRANCH_LEGAL = ['NNNN','ACNN','AANN','AUNN','UNNN','CNAN','CNUN','CNCA','CNCU','CNCC'];
export const encodeBranch = states => states.map(v => ({clear:'C',absent:'A',uncertain:'U','not-applicable':'N'})[v]).join('');
export const vote = (confidence='high') => ({growthAxis:'basal-dominant',basalBranchingLevel:1,hollowing:'absent',confidence});
export const observations = () => ({seedCrystal:'clear',seedNewGrowthSeparation:'clear',growthTargetVisibility:'sufficient',branchingTargetVisibility:'sufficient',hollowingTargetVisibility:'sufficient',newBasalPlane:'clear',newAxialGrowth:'absent',facetedOutline:'not-applicable',primaryArmOrSector:'clear',sidebranch:'absent',secondGenerationBranch:'not-applicable',cavityOpening:'absent',cavityRim:'absent',cavityInnerWall:'absent',cavityBelongsToNewGrowth:'not-applicable',visibilityLimitations:[],otherLimitation:null});
export const classification = (confidence='high') => ({...vote(confidence),fieldConfidence:{growthAxis:confidence,basalBranchingLevel:confidence,hollowing:confidence}});
export const evidence = () => ({growthAxis:'可視の新成長を確認。',basalBranchingLevel:'独立した腕を確認。',hollowing:'開口は確認されない。'});
export const payload = (id, confidence='high') => ({anonymousImageId:id,observations:observations(),classification:classification(confidence),evidence:evidence()});
export function mappingCases() {
  const tables = {growth:[],branching:[],hollowing:[],confidence:[]};
  for (const v of VIS) for(const basal of OBS) for(const axial of OBS) for(const seed of ['clear','uncertain','not-visible']) for(const separation of ['clear','uncertain','not-applicable']) {
    const legalSeed = seed==='clear' ? separation!=='not-applicable' : seed==='uncertain' ? separation==='uncertain' : separation==='not-applicable';
    const valid = legalSeed && (v!=='not-visible' || basal==='uncertain' && axial==='uncertain');
    const label = v==='sufficient' && basal==='clear' && axial==='absent' ? 'basal-dominant' : v==='sufficient' && separation==='clear' && axial==='clear' ? basal==='clear'?'mixed':basal==='absent'?'c-axis-dominant':'indeterminate' : 'indeterminate';
    const input={growthTargetVisibility:v,newBasalPlane:basal,newAxialGrowth:axial,seedCrystal:seed,seedNewGrowthSeparation:separation};
    tables.growth.push({input,valid,label:valid?label:null});
    if(valid) good('mapping-growth',input,label); else bad('mapping-growth',input,()=>{},'mapping-violation',legalSeed?'growthTargetVisibility':'seedNewGrowthSeparation');
  }
  for(const v of VIS) for(const basal of OBS) for(const arm of BRANCH) for(const outline of BRANCH) for(const side of BRANCH) for(const second of BRANCH) {
    const tuple=encodeBranch([arm,outline,side,second]);
    const context=v==='not-visible'||basal==='absent' ? tuple==='NNNN' : v==='sufficient'&&basal==='clear'?tuple!=='NNNN':true;
    const valid=BRANCH_LEGAL.includes(tuple)&&context;
    const label=v==='sufficient'&&basal==='clear'?({ACNN:0,CNAN:1,CNCA:2,CNCC:3}[tuple]??null):null;
    const input={branchingTargetVisibility:v,newBasalPlane:basal,primaryArmOrSector:arm,facetedOutline:outline,sidebranch:side,secondGenerationBranch:second};
    tables.branching.push({input,valid,label:valid?label:null});
    if(valid) good('mapping-branching',input,label);else bad('mapping-branching',input,()=>{},'mapping-violation','primaryArmOrSector');
  }
  for(const v of VIS) for(const opening of OBS) for(const rim of OBS) for(const wall of OBS) for(const belongs of ['clear','uncertain','not-applicable']) {
    const values=[opening,rim,wall],allAbsent=values.every(x=>x==='absent'),anyClear=values.includes('clear');
    const valid=v==='not-visible'?values.every(x=>x==='uncertain')&&belongs==='uncertain':allAbsent?belongs==='not-applicable':anyClear?belongs!=='not-applicable':belongs==='uncertain';
    const label=v==='sufficient'&&values.every(x=>x==='clear')&&belongs==='clear'?'present':v==='sufficient'&&allAbsent&&belongs==='not-applicable'?'absent':'indeterminate';
    const input={hollowingTargetVisibility:v,cavityOpening:opening,cavityRim:rim,cavityInnerWall:wall,cavityBelongsToNewGrowth:belongs};
    tables.hollowing.push({input,valid,label:valid?label:null});
    if(valid) good('mapping-hollowing',input,label);else bad('mapping-hollowing',input,()=>{},'mapping-violation','cavityBelongsToNewGrowth');
  }
  for(const a of CONF)for(const b of CONF)for(const c of CONF)for(const final of CONF){
    const label=CONF[Math.min(CONF.indexOf(a),CONF.indexOf(b),CONF.indexOf(c))],valid=label===final,input={fieldConfidence:{growthAxis:a,basalBranchingLevel:b,hollowing:c},confidence:final};
    tables.confidence.push({input,valid,label:valid?label:null});if(valid)good('mapping-confidence',input,label);else bad('mapping-confidence',input,()=>{},'mapping-violation','confidence');
  }
  for(const [key,total,valid] of [['growth',243,76],['branching',2304,44],['hollowing',243,93],['confidence',81,27]]) {assert.equal(tables[key].length,total);assert.equal(tables[key].filter(r=>r.valid).length,valid);assert.equal(tables[key].filter(r=>!r.valid).length,total-valid);}
  const base={payload:payload('img-001')};good('annotation-payload',base,base.payload);
  for(const [label,fn,field,kind,reason] of [
    ['unknown',f=>{f.payload.sourceObservationId='L23-F2-P11-N001';},'sourceObservationId','TypeError','unknown-property'],
    ['seed-shortcut',f=>{f.payload.observations.seedNewGrowthSeparation='uncertain';f.payload.classification.growthAxis='c-axis-dominant';},'growthAxis','RangeError','mapping-violation'],
    ['branch-shortcut',f=>{f.payload.classification.basalBranchingLevel=2;},'basalBranchingLevel','RangeError','mapping-violation'],
    ['hollow-shortcut',f=>{f.payload.classification.hollowing='present';},'hollowing','RangeError','mapping-violation'],
    ['confidence-majority',f=>{f.payload.classification.fieldConfidence.hollowing='low';},'confidence','RangeError','mapping-violation'],
    ['limitations-order',f=>{f.payload.observations.visibilityLimitations=['low-contrast','blur'];},'visibilityLimitations','RangeError','enum-order'],
    ['limitations-duplicate',f=>{f.payload.observations.visibilityLimitations=['blur','blur'];},'visibilityLimitations','RangeError','duplicate-enum'],
    ['other-null',f=>{f.payload.observations.visibilityLimitations=['other'];},'otherLimitation','RangeError','limitation-binding'],
    ['other-orphan',f=>{f.payload.observations.otherLimitation='可視性制約';},'otherLimitation','RangeError','limitation-binding'],
    ['other-long',f=>{f.payload.observations.visibilityLimitations=['other'];f.payload.observations.otherLimitation='a'.repeat(121);},'otherLimitation','RangeError','string-length'],
    ['evidence-empty',f=>{f.payload.evidence.growthAxis='';},'evidence.growthAxis','RangeError','string-length'],
    ['evidence-long',f=>{f.payload.evidence.hollowing='a'.repeat(201);},'evidence.hollowing','RangeError','string-length'],
    ['evidence-NFD',f=>{f.payload.evidence.growthAxis='e\u0301';},'evidence.growthAxis','RangeError','unicode-nfc'],
  ])bad('annotation-payload',base,fn,reason,field,kind,label);
  return tables;
}

export function selectionFixture(protocolObjectSha256) {
  const pairs = [
    [vote(),vote()], [{...vote(),basalBranchingLevel:0},{...vote(),basalBranchingLevel:0}],
    [{...vote(),basalBranchingLevel:2},{...vote(),basalBranchingLevel:2}], [{...vote(),basalBranchingLevel:3},{...vote(),basalBranchingLevel:3}],
    [vote(),{...vote(),growthAxis:'mixed'}], [vote(),{...vote(),basalBranchingLevel:2}], [vote(),{...vote(),hollowing:'present'}], [vote(),vote('medium')],
  ];
  const rows=[11,12,13,14].flatMap((page,p)=>Array.from({length:[52,52,51,51][p]},(_,i)=>[`L23-F2-P${page}-N${String(i+1).padStart(3,'0')}`,page,i+1]));
  const candidateSet={schemaVersion:'snow-crystal-morphology-pilot-candidate-set/1',sourcePdfSha256:PDF,rows};
  const proxyInput={schemaVersion:'snow-crystal-morphology-pilot-selection-proxy/1',annotatorAArtifactFileSha256:H('proxy-A'),annotatorBArtifactFileSha256:H('proxy-B'),rows:rows.map(([sourceObservationId,page,ordinal])=>{
    const [a,b]=pairs[(ordinal+page)%8];return{sourceObservationId,annotatorA:clone(a),annotatorB:clone(b),proxySignature:[...FIELDS,'confidence'].map(f=>a[f]===b[f]?a[f]:'disagreement')};
  })};
  const candidates=rows.map(([sourceObservationId,pdfPage])=>{
    const proxySignature=proxyInput.rows.find(r=>r.sourceObservationId===sourceObservationId).proxySignature;
    return{sourceObservationId,pdfPage,proxySignature,selectionKeySha256:sha(`snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/selection\0${jcs([pdfPage,proxySignature,sourceObservationId])}`),batchOrderKeySha256:sha(`snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/batch-order\0${sourceObservationId}`)};
  });
  const slots=[11,12,13,14].flatMap(page=>{
    const groups=new Map();for(const c of candidates.filter(c=>c.pdfPage===page)){const k=jcs(c.proxySignature);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
    const ranked=[...groups.values()].flatMap(group=>group.sort((a,b)=>cmp(a.selectionKeySha256,b.selectionKeySha256)||cmp(a.sourceObservationId,b.sourceObservationId)).map((c,rank)=>({...c,rank})));
    return ranked.sort((a,b)=>a.rank-b.rank||cmp(a.selectionKeySha256,b.selectionKeySha256)||cmp(a.sourceObservationId,b.sourceObservationId)).slice(0,6).map(({rank,...c},i)=>({...c,pageSlot:i+1}));
  }).sort((a,b)=>cmp(a.batchOrderKeySha256,b.batchOrderKeySha256)||cmp(a.sourceObservationId,b.sourceObservationId)).map((c,ordinal)=>({ordinal,...c}));
  const plan={schemaVersion:'snow-crystal-morphology-pilot-selection/1',contractId:CONTRACT,protocolObjectSha256,sourcePdfSha256:PDF,candidateSetObjectSha256:hash(candidateSet),proxyInputObjectSha256:hash(proxyInput),algorithmId:'page-proxy-round-robin-hash-v1',selectionSeed:'snow-crystal-sim/T1-7/morphology-ensemble-pilot-v1/selection',slots};
  // Frozen independently calculated SYN-PILOT-24 snapshot, in batch order.
  assert.deepEqual(slots.map(s=>[s.sourceObservationId,s.pageSlot]),[
    ['L23-F2-P12-N048',4],['L23-F2-P14-N032',2],['L23-F2-P11-N044',3],['L23-F2-P11-N005',5],['L23-F2-P13-N002',2],['L23-F2-P13-N046',5],
    ['L23-F2-P12-N036',1],['L23-F2-P13-N025',6],['L23-F2-P12-N041',3],['L23-F2-P14-N003',1],['L23-F2-P12-N022',6],['L23-F2-P13-N024',1],
    ['L23-F2-P14-N013',4],['L23-F2-P14-N010',5],['L23-F2-P11-N035',1],['L23-F2-P13-N043',4],['L23-F2-P12-N045',5],['L23-F2-P11-N046',2],
    ['L23-F2-P11-N018',4],['L23-F2-P14-N025',3],['L23-F2-P12-N018',2],['L23-F2-P13-N047',3],['L23-F2-P11-N041',6],['L23-F2-P14-N004',6],
  ]);
  assert.equal(rows.length,206);assert.equal(new Set(rows.map(r=>r[0])).size,206);for(const p of [11,12,13,14]){assert.equal(slots.filter(s=>s.pdfPage===p).length,6);assert.equal(new Set(proxyInput.rows.filter(r=>r.sourceObservationId.includes(`P${p}`)).map(r=>jcs(r.proxySignature))).size,8);}
  return {candidateSet,proxyInput,plan};
}

export const imageTransport = entry => ({uploadMimeType:'image/png',attachmentMode:'synthetic-file-attachment',uploadedFileSha256:entry.derivativeFileSha256,uploadedRgbaSha256:entry.derivativeRgbaSha256,uploadedWidthPx:entry.widthPx,uploadedHeightPx:entry.heightPx,clientSideTransform:'none',attachmentPreview:'full-frame-visible-no-obvious-corruption',providerReceipt:'not-exposed',providerReceivedFileSha256:null,providerReceivedRgbaSha256:null,transportAssurance:'local-input-only',internalPreprocessing:'unobservable',providerImagePolicyVersion:null,providerImagePolicyEvidenceSha256:null});
export function transportCases(entry) {
  const run={provider:'synthetic-provider',displayedModelId:'synthetic-model',clientTool:'synthetic-client',clientToolVersion:'1',attachmentMode:'synthetic-file-attachment'};
  const policyBytes='Synthetic immutable policy: no transform.\n';
  const policy={schemaVersion:'snow-crystal-provider-image-policy-evidence/1',...run,policyVersion:'synthetic-policy-v1',retrievedAtUtc:utc(0),publicSourceLocator:'urn:synthetic:policy',policyContentFileSha256:sha(policyBytes),assertion:'no-transform-from-provider-receipt-to-model-input'};
  const policyHash=hash(policy),expectedFile=entry.derivativeFileSha256,expectedRgba=entry.derivativeRgbaSha256;
  const exact=new Set([
    jcs(['byte-identical',expectedFile,null,'verified-bytes','unobservable',null,null]),
    jcs(['byte-identical',expectedFile,null,'verified-bytes','documented-no-transform',policy.policyVersion,policyHash]),
    jcs(['decoded-rgba-identical',null,expectedRgba,'verified-pixels','unobservable',null,null]),
    jcs(['decoded-rgba-identical',null,expectedRgba,'verified-pixels','documented-no-transform',policy.policyVersion,policyHash]),
    jcs(['not-exposed',null,null,'local-input-only','unobservable',null,null]),
  ]);
  let n=0,valid=0;const positives=[];
  for(const receipt of ['byte-identical','decoded-rgba-identical','not-exposed'])for(const file of [null,expectedFile,H('wrong-received-file')])for(const rgba of [null,expectedRgba,H('wrong-received-rgba')])for(const assurance of ['verified-bytes','verified-pixels','local-input-only'])for(const prep of ['unobservable','documented-no-transform'])for(const version of [null,policy.policyVersion])for(const evidenceHash of [null,policyHash,H('wrong-policy')]){
    const tuple=[receipt,file,rgba,assurance,prep,version,evidenceHash],transport={...imageTransport(entry),providerReceipt:receipt,providerReceivedFileSha256:file,providerReceivedRgbaSha256:rgba,transportAssurance:assurance,internalPreprocessing:prep,providerImagePolicyVersion:version,providerImagePolicyEvidenceSha256:evidenceHash};
    const fixture={entry,run,transport,policyEvidence:policy,policyBytes,receivedFileBytes:receipt==='byte-identical'?[...png(3,2,maskedPixels)]:null,receivedRgba:receipt==='decoded-rgba-identical'?{widthPx:entry.widthPx,heightPx:entry.heightPx,layout:'uint32le-width-height-top-left-row-major-rgba8',rgba:maskedPixels,rgbaSha256:expectedRgba}:null,reportedProviderPixelsIdentical:assurance!=='local-input-only'};n++;
    if(exact.has(jcs(tuple))){valid++;positives.push(fixture);good('transport',fixture,assurance);}else bad('transport',fixture,()=>{},'invalid-transport-state','imageTransport');
  }
  assert.equal(n,972);assert.equal(valid,5);assert.equal(exact.size,5);
  const base=positives.find(f=>f.transport.internalPreprocessing==='documented-no-transform'&&f.transport.providerReceipt==='decoded-rgba-identical');
  for(const field of ['provider','displayedModelId','clientTool','clientToolVersion','attachmentMode','policyVersion','policyContentFileSha256'])bad('transport',base,f=>{f.policyEvidence[field]=field==='policyContentFileSha256'?H('wrong-policy-content'):'different';},'policy-binding',`policyEvidence.${field}`);
  bad('transport',base,f=>{f.policyBytes+='x';},'policy-binding','policyContentFileSha256');
  for(const field of ['widthPx','heightPx','layout','rgbaSha256'])bad('transport',base,f=>{f.receivedRgba[field]=typeof f.receivedRgba[field]==='number'?f.receivedRgba[field]+1:'different';},'received-rgba-binding',`receivedRgba.${field}`);
  for(const [field,value] of [['clientSideTransform','resize'],['attachmentPreview','cropped'],['uploadMimeType','image/jpeg'],['uploadedWidthPx',4],['uploadedHeightPx',3],['uploadedFileSha256',H('upload-file')],['uploadedRgbaSha256',H('upload-rgba')],['attachmentMode','mixed-mode']]) {
    const enumViolation=['clientSideTransform','attachmentPreview','uploadMimeType'].includes(field);
    bad('transport',base,f=>{f.transport[field]=value;},enumViolation?'type-or-enum':'upload-binding',field,enumViolation?'TypeError':'RangeError');
  }
  bad('transport',positives.at(-1),f=>{f.reportedProviderPixelsIdentical=true;},'local-input-only-claim','reportedProviderPixelsIdentical');
  return {policy,policyBytes,positives};
}

export function buildContract() {
  const tables=mappingCases(),bundle=schemaBundle();
  assert.equal(Object.keys(bundle).length,23);assert.equal(new Set(Object.values(bundle).map(s=>s.fileSha256)).size,23);
  const truthRows=[];for(const D of [0,1,2,3])for(const U of [false,true])for(const L of [false,true])for(const O of [false,true])for(const Hh of [false,true]){
    const index=U||L||O||D>=2?3:D===1?2:Hh?0:1;
    truthRows.push({D,U,L,O,H:Hh,category:['label-exact-all-high','label-exact-nonhigh-or-confidence-differs','single-field-disagreement','multi-field-or-uncertain'][index],route:['human-batch','human-individual','adjudication','adjudication'][index]});
  }
  const truthTable={schemaVersion:'snow-crystal-consensus-routing-truth-table/1',rows:truthRows};
  assert.equal(hash(truthTable),'7794c28359dc2fa7d918a49b2ba4f0cad335d6b54c5d589ca8da95940b7686d7');
  const protocol={schemaVersion:'snow-crystal-morphology-pilot-protocol/1',contractId:CONTRACT,protocolId:PROTOCOL,sourcePdfSha256:PDF,decisionContract:{observationSchemaObjectSha256:hash(bundle.annotationPayloadSchemaFileSha256.object.properties.observations),classificationSchemaObjectSha256:hash(bundle.annotationPayloadSchemaFileSha256.object.properties.classification),growthTruthTableObjectSha256:hash(tables.growth),branchingTruthTableObjectSha256:hash(tables.branching),hollowingTruthTableObjectSha256:hash(tables.hollowing),confidenceRule:'minimum-of-three-field-confidences',consensusRoutingTruthTableObjectSha256:hash(truthTable)},schemaFiles:Object.fromEntries(Object.entries(bundle).map(([k,s])=>[k,s.fileSha256])),prompts:{rendererId:'ascii-placeholder-exact-replacement/1',annotatorTemplateFileSha256:sha(templates.annotator),adjudicatorTemplateFileSha256:sha(templates.adjudicator),annotatorAllowedPlaceholders:placeholders.slice(0,3),adjudicatorAllowedPlaceholders:placeholders},execution:{annotators:ACTORS.map((actorId,i)=>({actorId,requiredModelFamily:FAMILIES[i]})),imageCount:24,pageCounts:[[11,6],[12,6],[13,6],[14,6]],batchIds:['batch-01','batch-02'],batchSizes:[12,12],option:'A-all-24-human-final',modelAttemptPolicy:{policyId:POLICY,maximumAttemptsPerCampaign:3,retryContext:'fresh',invalidAttemptConsumesSlotArtifactId:false,invalidAttemptEntersSupersessionLedger:false}},rasterization:{inheritedProtocolId:'figure2-projection-v1',inheritedProtocolObjectSha256:H('inherited-projection-protocol'),codecId:CODEC,maskRgba:[127,127,127,255],paddingAllowed:false,imageTextOverlayAllowed:false},serialization:{json:'rfc8785-jcs-object-plus-lf-file',jsonl:'jcs-object-per-line-utf8-no-bom-lf-final-lf',unicodeNormalization:'NFC-before-JCS-or-prompt-render',hashAlgorithm:'sha256'},consensusPolicyId:'exclusive-DULOH/1',approvalPolicyId:'pilot-24-all-human/1'};
  assert(schemaAccepts(bundle.protocolObjectSchemaFileSha256.object,protocol));
  const selection=selectionFixture(hash(protocol)),ids=Array.from({length:24},(_,i)=>`img-${String(i+1).padStart(3,'0')}`);
  const images=ids.map((id,i)=>{const source=clone(sourcePixels),pixels=clone(maskedPixels);source[0]=pixels[0]=i+1;const bytes=png(3,2,pixels);return{anonymousImageId:id,sourceRgba:source,rgba:pixels,pngBytes:[...bytes],fileSha256:sha(bytes),rgbaSha256:rgbaHash(3,2,pixels)};});
  const manifest={schemaVersion:'snow-crystal-morphology-pilot-blinded-manifest/1',protocolObjectSha256:hash(protocol),selectionPlanObjectSha256:hash(selection.plan),sourcePdfSha256:PDF,entries:images.map(image=>({anonymousImageId:image.anonymousImageId,anonymousFilename:`${image.anonymousImageId}.png`,anonymousRelativePath:`images/${image.anonymousImageId}.png`,widthPx:3,heightPx:2,derivativeFileSha256:image.fileSha256,derivativeRgbaSha256:image.rgbaSha256,maskRectanglesPx:[[1,0,1,1]],codecId:CODEC,transformTool:'synthetic-test-mask',transformToolVersion:'1'})),batches:[{batchId:'batch-01',orderedAnonymousImageIds:ids.slice(0,12)},{batchId:'batch-02',orderedAnonymousImageIds:ids.slice(12)}]};
  const restricted={schemaVersion:'snow-crystal-morphology-pilot-restricted-map/1',protocolObjectSha256:hash(protocol),selectionPlanObjectSha256:hash(selection.plan),blindedManifestObjectSha256:hash(manifest),sourcePdfSha256:PDF,storageRootId:'synthetic-restricted-root',entries:ids.map((id,i)=>{const slot=selection.plan.slots[i],image=images[i];return{anonymousImageId:id,anonymousFilename:`${id}.png`,anonymousRelativePath:`images/${id}.png`,sourceObservationId:slot.sourceObservationId,sourceRelativePath:`restricted/${id}.png`,locator:{pdfPage:slot.pdfPage,pagePanelOrdinal:Number(slot.sourceObservationId.slice(-3)),panelBoundsPdfPt:[0,0,3,2]},sourceCropWidthPx:3,sourceCropHeightPx:2,sourceCropFileSha256:sha(png(3,2,image.sourceRgba)),sourceCropRgbaSha256:rgbaHash(3,2,image.sourceRgba),pageRasterWidthPx:3,pageRasterHeightPx:2,pageRasterRgbaSha256:rgbaHash(3,2,image.sourceRgba),viewportTransform:[1,0,0,1,0,0],cropPixelBounds:[0,0,3,2]};})};
  const inputTables=manifest.batches.map(batch=>({schemaVersion:'snow-crystal-morphology-pilot-batch-input/1',protocolObjectSha256:hash(protocol),blindedManifestObjectSha256:hash(manifest),batchId:batch.batchId,orderedItems:batch.orderedAnonymousImageIds.map((id,ordinal)=>{const entry=manifest.entries.find(e=>e.anonymousImageId===id);return{ordinal,anonymousImageId:id,derivativeFileSha256:entry.derivativeFileSha256,derivativeRgbaSha256:entry.derivativeRgbaSha256,attachmentSlot:`attachment-${String(ordinal+1).padStart(2,'0')}`};})}));
  const makePrompt=(role,table,candidateAlias=null,candidateTable=null)=>{
    const schema=bundle[role==='annotator'?'annotationPayloadSchemaFileSha256':'adjudicationPayloadSchemaFileSha256'];
    const variables={schemaVersion:'snow-crystal-morphology-pilot-prompt-variables/1',promptRole:role,protocolObjectSha256:hash(protocol),protocolCanonicalJson:jcs(protocol),schemaFileSha256:schema.fileSha256,modelPayloadSchemaObjectSha256:schema.objectSha256,modelPayloadSchemaCanonicalJson:jcs(schema.object),batchInputTableObjectSha256:hash(table),batchInputTableCanonicalJson:jcs(table),candidateAliasManifestObjectSha256:candidateAlias?hash(candidateAlias):null,candidatePayloadTableObjectSha256:candidateTable?hash(candidateTable):null,candidatePayloadCanonicalJson:candidateTable?jcs(candidateTable):null};
    const rendered=render(role,variables),evidence={schemaVersion:'snow-crystal-morphology-pilot-rendered-prompt-evidence/1',promptRole:role,rendererId:'ascii-placeholder-exact-replacement/1',protocolObjectSha256:hash(protocol),promptTemplateFileSha256:sha(templates[role]),promptVariablesObjectSha256:hash(variables),schemaFileSha256:schema.fileSha256,modelPayloadSchemaObjectSha256:schema.objectSha256,renderedPromptSha256:sha(rendered)};
    return{variables,evidence,rendered,template:templates[role],schemaBytes:schema.bytes};
  };
  const prompts=inputTables.map(t=>makePrompt('annotator',t));
  return{tables,bundle,truthTable,protocol,...selection,ids,images,manifest,restricted,inputTables,prompts,makePrompt};
}

export function contractCases(c) {
  const selection={protocol:c.protocol,candidateSet:c.candidateSet,proxyInput:c.proxyInput,selectionPlan:c.plan};good('selection',selection,c.plan);
  for(const [label,fn,field] of [
    ['candidate-205',f=>f.candidateSet.rows.pop(),'candidateSet.rows'],['candidate-207',f=>f.candidateSet.rows.push(clone(f.candidateSet.rows[0])),'candidateSet.rows'],['proxy-205',f=>f.proxyInput.rows.pop(),'proxyInput.rows'],['proxy-207',f=>f.proxyInput.rows.push(clone(f.proxyInput.rows[0])),'proxyInput.rows'],
    ['missing-A',f=>{delete f.proxyInput.rows[0].annotatorA;},'annotatorA'],['missing-B',f=>{delete f.proxyInput.rows[0].annotatorB;},'annotatorB'],['missing-field',f=>{delete f.proxyInput.rows[0].annotatorA.confidence;},'confidence'],
    ['human-proxy',f=>{f.proxyInput.rows[0].proxySignature[0]='indeterminate';},'proxySignature'],['unknown-ID',f=>{f.candidateSet.rows[0][0]='L23-F2-P11-N999';},'sourceObservationId'],['duplicate-ID',f=>{f.candidateSet.rows[1][0]=f.candidateSet.rows[0][0];},'sourceObservationId'],
    ['five-page-candidates',f=>{f.candidateSet.rows=f.candidateSet.rows.filter(r=>r[1]!==11||r[2]<=5);},'candidateSet.rows'],['quota-7-5',f=>{f.selectionPlan.slots.find(s=>s.pdfPage===12).pdfPage=11;},'pdfPage'],
    ['pageSlot',f=>{f.selectionPlan.slots[0].pageSlot=6-f.selectionPlan.slots[0].pageSlot+1;},'pageSlot'],['ordinal',f=>{f.selectionPlan.slots[0].ordinal=1;},'ordinal'],['selection-key',f=>{f.selectionPlan.slots[0].selectionKeySha256=H('wrong-selection');},'selectionKeySha256'],['batch-key',f=>{f.selectionPlan.slots[0].batchOrderKeySha256=H('wrong-batch');},'batchOrderKeySha256'],['slot-order',f=>f.selectionPlan.slots.reverse(),'slots'],['post-freeze-source',f=>{f.selectionPlan.slots[0].sourceObservationId='L23-F2-P11-N001';},'sourceObservationId'],
    ['plan-pdf-missing',f=>{delete f.selectionPlan.sourcePdfSha256;},'sourcePdfSha256'],['plan-pdf-byte',f=>{f.selectionPlan.sourcePdfSha256=(f.selectionPlan.sourcePdfSha256[0]==='0'?'1':'0')+f.selectionPlan.sourcePdfSha256.slice(1);},'sourcePdfSha256'],['plan-pdf-candidate-mismatch',f=>{f.selectionPlan.sourcePdfSha256=H('selection-candidate-pdf-mismatch');},'sourcePdfSha256'],['candidate-pdf-protocol-mismatch',f=>{f.candidateSet.sourcePdfSha256=H('candidate-protocol-pdf-mismatch');},'sourcePdfSha256'],
  ])bad('selection',selection,fn,['missing-A','missing-B','missing-field'].includes(label)?'missing-property':'selection-invalid',field,['missing-A','missing-B','missing-field'].includes(label)?'TypeError':'RangeError',label);
  const inventory=c.ids.slice(0,12).map(id=>({kind:'image',relativePath:`images/${id}.png`,fileSha256:c.manifest.entries.find(e=>e.anonymousImageId===id).derivativeFileSha256}));
  inventory.push({kind:'protocol-object',relativePath:'input/protocol.json',fileSha256:sha(fileBytes(c.protocol))},{kind:'role-schema',relativePath:'input/annotator.schema.json',fileSha256:c.bundle.annotationPayloadSchemaFileSha256.fileSha256},{kind:'prompt',relativePath:'input/annotator.txt',fileSha256:sha(c.prompts[0].rendered)},{kind:'batch-input',relativePath:'input/batch.json',fileSha256:sha(fileBytes(c.inputTables[0]))});
  const blinded={manifest:c.manifest,restrictedMap:c.restricted,selectionPlan:c.plan,inventory,batchId:'batch-01'};good('blinded-inputs',blinded,true);
  for(const key of ['sourceObservationId','pdfPage','locator','sourceFilename','sourceRelativePath','temperatureC','supersaturationPct','growthTimeSeconds','squareFieldOfViewUm','proxySignature','annotatorA','annotatorB','humanFinal'])bad('blinded-inputs',blinded,f=>{f.manifest.entries[0][key]='forbidden';},'restricted-mapping-leakage',key,'TypeError',key);
  for(const path of ['/absolute/image.png','C:/image.png','../image.png','images/../image.png','images/users/synthetic-user/image.png','images\\image.png'])bad('blinded-inputs',blinded,f=>{f.manifest.entries[0].anonymousRelativePath=path;},'path-invalid','anonymousRelativePath');
  for(const key of ['anonymousImageId','anonymousFilename'])for(const label of ['P11','L23-F2-P11-N001','temperature--15'])bad('blinded-inputs',blinded,f=>{f.manifest.entries[0][key]=label;},'anonymous-id-leakage',key);
  for(const key of ['anonymousFilename','anonymousRelativePath'])bad('blinded-inputs',blinded,f=>{f.restrictedMap.entries[0][key]='different.png';},'mapping-pair-mismatch',key);
  for(const label of ['missing','duplicate','unknown','order','batch-overlap','batch-11'])bad('blinded-inputs',blinded,f=>{
    if(label==='missing')f.restrictedMap.entries.pop();if(label==='duplicate')f.restrictedMap.entries[1]=clone(f.restrictedMap.entries[0]);if(label==='unknown')f.restrictedMap.entries[0].anonymousImageId='img-999';if(label==='order')f.manifest.entries.reverse();if(label==='batch-overlap')f.manifest.batches[1].orderedAnonymousImageIds[0]=c.ids[0];if(label==='batch-11')f.manifest.batches[0].orderedAnonymousImageIds.pop();
  },'blinded-input-invalid','entries','RangeError',label);
  for(const kind of ['repository','restricted-map','other-actor-output','existing-A-B','human-final'])bad('blinded-inputs',blinded,f=>{f.inventory.push({kind,relativePath:`forbidden/${kind}`,fileSha256:H(kind)});},'workspace-inventory','inventory','RangeError',kind);
  const uploads={manifest:c.manifest,attachments:c.manifest.entries.map((e,i)=>({anonymousImageId:e.anonymousImageId,attachmentSlot:`attachment-${i+1}`,pngBytes:c.images[i].pngBytes,decodedRgba:c.images[i].rgba,imageTransport:imageTransport(e)}))};good('uploads',uploads,true);
  for(const [label,fn,field]of[
    ['file-replacement',f=>{f.attachments[0].pngBytes=c.images[1].pngBytes;},'uploadedFileSha256'],['decode-failure',f=>{f.attachments[0].pngBytes=[0];},'pngBytes'],['dimension',f=>{f.attachments[0].imageTransport.uploadedWidthPx=4;},'uploadedWidthPx'],['MIME',f=>{f.attachments[0].imageTransport.uploadMimeType='image/jpeg';},'uploadMimeType'],['slot-duplicate',f=>{f.attachments[1].attachmentSlot=f.attachments[0].attachmentSlot;},'attachmentSlot'],['ID-missing',f=>{f.attachments[0].anonymousImageId='img-999';},'anonymousImageId'],['23-uploads',f=>f.attachments.pop(),'attachments'],
  ])bad('uploads',uploads,fn,label==='MIME'?'type-or-enum':'upload-binding',field,label==='MIME'?'TypeError':'RangeError',label);
  for(const preview of ['cropped','corrupted','rotated','excessively-reduced','mask-missing','id-unbound'])bad('uploads',uploads,f=>{f.attachments[0].imageTransport.attachmentPreview=preview;},'type-or-enum','attachmentPreview','TypeError');
  transportCases(c.manifest.entries[0]);

  const schemaFixture={protocol:c.protocol,schemaBundle:c.bundle};good('schema-bundle',schemaFixture,true);
  assert.deepEqual(Object.keys(c.protocol.schemaFiles),SCHEMA_PROPERTIES);
  for(const key of SCHEMA_PROPERTIES){
    const schema=c.bundle[key];assert.deepEqual(parseUnique(schema.bytes),schema.object);assert.equal(schema.bytes,fileBytes(schema.object));assert.notEqual(schema.objectSha256,schema.fileSha256);
    for(const [label,fn,field] of [
      ['missing-reference',f=>{delete f.protocol.schemaFiles[key];},`schemaFiles.${key}`],['missing-file',f=>{delete f.schemaBundle[key];},key],['swapped-reference',f=>{const other=SCHEMA_PROPERTIES[(SCHEMA_PROPERTIES.indexOf(key)+1)%SCHEMA_PROPERTIES.length];[f.protocol.schemaFiles[key],f.protocol.schemaFiles[other]]=[f.protocol.schemaFiles[other],f.protocol.schemaFiles[key]];},key],['object-as-file',f=>{f.protocol.schemaFiles[key]=schema.objectSha256;},key],['reference-byte',f=>{f.protocol.schemaFiles[key]=(schema.fileSha256[0]==='0'?'1':'0')+schema.fileSha256.slice(1);},key],
      ['file-as-object',f=>{f.schemaBundle[key].objectSha256=schema.fileSha256;},key],
    ])bad('schema-bundle',schemaFixture,fn,'schema-file-binding',field,'RangeError',`${key}/${label}`);
    for(const position of [0,Math.floor(schema.bytes.length/2),schema.bytes.length-2])bad('schema-bundle',schemaFixture,f=>{const b=f.schemaBundle[key].bytes;f.schemaBundle[key].bytes=b.slice(0,position)+String.fromCharCode(b.charCodeAt(position)^1)+b.slice(position+1);},'schema-file-binding',key,'RangeError',`${key}/byte-${position}`);
    for(const [label,transform]of[['CRLF',s=>s.replaceAll('\n','\r\n')],['BOM',s=>'\ufeff'+s],['extra-LF',s=>s+'\n'],['pretty',()=>JSON.stringify(schema.object,null,2)+'\n'],['multiple',s=>s+s],['self-hash',()=>fileBytes({...schema.object,selfSha256:schema.fileSha256})]])bad('schema-bundle',schemaFixture,f=>{f.schemaBundle[key].bytes=transform(schema.bytes);},'schema-file-binding',key,'RangeError',`${key}/${label}`);
  }
  bad('schema-bundle',schemaFixture,f=>{f.schemaBundle.extra=clone(f.schemaBundle.annotationPayloadSchemaFileSha256);},'unknown-property','schemaBundle.extra','TypeError');
  for(const role of ['annotator','adjudicator']){
    const expected=role==='annotator'?[4531,'d5d5f557b701e76cb1c71b86c378e59cb44a8ddb81dba33577a248767bb5ed8c']:[3133,'21c13a7dc4a782181dc0df55ac24a17f1840bf457b4196a09894160fc4174a03'];
    assert.equal(Buffer.byteLength(templates[role]),expected[0]);assert.equal(sha(templates[role]),expected[1]);assert.equal(templates[role].normalize('NFC'),templates[role]);
    for(const p of placeholders.slice(0,role==='annotator'?3:4))assert.equal(templates[role].split(p).length-1,1);
    const fixture={role,template:templates[role],protocol:c.protocol};good('prompt-template',fixture,{byteLength:expected[0],fileSha256:expected[1]});
    for(const [label,transform] of [['duplicate',s=>s+placeholders[0]],['missing',s=>s.replace(placeholders[0],'')],['unknown',s=>s+'{{UNKNOWN}}'],['trim',s=>s.trim()],['CRLF',s=>s.replaceAll('\n','\r\n')],['fence',s=>'```text\n'+s+'```\n'],['byte',s=>'!'+s.slice(1)]])bad('prompt-template',fixture,f=>{f.template=transform(f.template);},'prompt-template-binding','template','RangeError',`${role}/${label}`);
  }
  for(let i=0;i<2;i++){
    const prompt={protocol:c.protocol,bundle:c.bundle,inputTable:c.inputTables[i],...c.prompts[i]};good('rendered-prompt',prompt,{renderedPromptSha256:sha(prompt.rendered),promptVariablesObjectSha256:hash(prompt.variables),renderedPromptEvidenceObjectSha256:hash(prompt.evidence)});
    for(const [label,fn,field] of [
      ['role-schema-swap',f=>{f.schemaBytes=c.bundle.adjudicationPayloadSchemaFileSha256.bytes;},'schemaFileSha256'],['file-as-object',f=>{f.variables.modelPayloadSchemaObjectSha256=f.variables.schemaFileSha256;},'modelPayloadSchemaObjectSha256'],['object-as-file',f=>{f.variables.schemaFileSha256=f.variables.modelPayloadSchemaObjectSha256;},'schemaFileSha256'],['candidate-nonnull',f=>{f.variables.candidatePayloadCanonicalJson='{}';},'candidatePayloadCanonicalJson'],['quote',f=>{f.rendered=JSON.stringify(f.rendered);},'renderedPromptSha256'],['trim',f=>{f.rendered=f.rendered.trim();},'renderedPromptSha256'],['indent',f=>{f.rendered=' '+f.rendered;},'renderedPromptSha256'],['escaped',f=>{f.rendered=f.rendered.replaceAll('\n','\\n');},'renderedPromptSha256'],['variable-byte',f=>{f.variables.protocolCanonicalJson+=' ';},'protocolCanonicalJson'],['order',f=>{f.rendered=f.rendered.replace(f.variables.protocolCanonicalJson,f.variables.batchInputTableCanonicalJson);},'renderedPromptSha256'],
    ])bad('rendered-prompt',prompt,fn,'prompt-binding',field,'RangeError',`${i}/${label}`);
    const table={protocol:c.protocol,manifest:c.manifest,table:c.inputTables[i],actualAttachmentOrder:c.inputTables[i].orderedItems.map(x=>x.anonymousImageId)};good('batch-input',table,hash(c.inputTables[i]));
    for(const [label,fn,field]of[['swap',f=>{[f.table.orderedItems[0],f.table.orderedItems[1]]=[f.table.orderedItems[1],f.table.orderedItems[0]];},'orderedItems'],['hash',f=>{f.table.orderedItems[0].derivativeFileSha256=H('bad-table');},'derivativeFileSha256'],['slot',f=>{f.table.orderedItems[1].attachmentSlot=f.table.orderedItems[0].attachmentSlot;},'attachmentSlot'],['ID',f=>{f.table.orderedItems[0].anonymousImageId='img-999';},'anonymousImageId'],['batch',f=>{f.table.batchId='batch-99';},'batchId'],['partial',f=>f.table.orderedItems.pop(),'orderedItems'],['extra',f=>f.table.orderedItems.push(clone(f.table.orderedItems[0])),'orderedItems'],['actual-order',f=>f.actualAttachmentOrder.reverse(),'actualAttachmentOrder']])bad('batch-input',table,fn,'batch-input-binding',field,'RangeError',`${i}/${label}`);
  }
}
