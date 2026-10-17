import { assert, CONTRACT, PROTOCOL, POLICY, HASH_SCHEMA, H, utc, sha, hash, whash, wrapped, idHash, jcs, jsonl, fileBytes, clone, cmp, good, bad, schemaAccepts, templates } from './pilot-oracle.mjs';
import { ACTORS, FAMILIES, FIELDS, payload, vote, imageTransport } from './pilot-contract-fixtures.mjs';

const kindOrder=['annotation-run','consensus','adjudication-run','human-approval'];
const artifactOrder=(a,b)=>kindOrder.indexOf(a.artifactKind)-kindOrder.indexOf(b.artifactKind)||cmp(a.logicalSlot,b.logicalSlot);
const imageInput=table=>whash('ordered-image-input',{orderedItems:table.orderedItems.map(({attachmentSlot,...rest})=>rest)});
const artifact=(header,records,extra={})=>({header,records,bytes:jsonl([header,...records]),fileSha256:sha(jsonl([header,...records])),...extra});
function header(c,plan,kind,slot,id,batch,count,input,generator,post=null){
  return{recordType:'artifact-header',schemaVersion:'snow-crystal-morphology-pilot-artifact/1',contractId:CONTRACT,protocolId:PROTOCOL,artifactKind:kind,artifactId:id,logicalSlot:slot,createdAtUtc:utc(kind==='adjudication-run'?9:kind==='human-approval'?11:kind==='pilot-approval-coverage'?12:4),coordinatorTool:'synthetic-pilot-coordinator',coordinatorToolVersion:'1',protocolObjectSha256:hash(c.protocol),batchInputTableObjectSha256:null,blindedManifestObjectSha256:hash(c.manifest),restrictedMappingObjectSha256:['human-approval','pilot-approval-coverage'].includes(kind)?hash(c.restricted):null,annotationConsensusSlotPlanObjectSha256:hash(plan),postConsensusRouteSlotPlanObjectSha256:post?hash(post):null,batchId:batch,expectedRecordCount:count,orderedInputSha256:input,generator};
}
function vision(c,role,actor,prompt,campaign,family){return{kind:'vision-model',actorId:actor,modelAttemptPolicyId:POLICY,campaignIdSha256:hash(campaign),attemptNumber:1,provider:`synthetic-${family}`,product:actor==='annotator-3'?'Gemini Chat':role==='adjudicator'?'GitHub Copilot':'synthetic-client',displayedModelId:`synthetic-${family}-displayed`,modelFamily:family,modelVersion:null,modelConfiguration:{},clientTool:'synthetic-client',clientToolVersion:'1',attachmentMode:'synthetic-file-attachment',promptRole:role,promptTemplateFileSha256:sha(templates[role]),promptVariablesObjectSha256:hash(prompt.variables),schemaFileSha256:prompt.variables.schemaFileSha256,modelPayloadSchemaObjectSha256:prompt.variables.modelPayloadSchemaObjectSha256,renderedPromptEvidenceObjectSha256:hash(prompt.evidence),renderedPromptSha256:sha(prompt.rendered),startedAtUtc:utc(0),completedAtUtc:utc(1),responseCapture:{method:actor==='annotator-3'?'manual-visible-text-copy':'client-written-file',capturedAtUtc:utc(2),capturedResponseFileSha256:H('pending-raw'),encoding:'utf-8',lineEndings:'lf',contentEditedAfterCapture:false}};}
function campaign(plan,slot,prompt,table,input,active=null){return wrapped('model-attempt-campaign',{slotPlanObjectSha256:hash(plan),logicalSlot:slot.logicalSlot,campaignKind:active?'replacement-materialization':'root-materialization',activeArtifactIdBeforeCampaign:active?.header.artifactId??null,activeArtifactFileSha256BeforeCampaign:active?.fileSha256??null,replacementReasonCode:active?'model-retry':null,changedInputSha256:active?.fileSha256??null,promptVariablesObjectSha256:hash(prompt.variables),batchInputTableObjectSha256:hash(table),orderedInputSha256:input});}
function modelPayload(c,id,actorIndex){
  const i=c.ids.indexOf(id),p=payload(id,i>=8&&i<16?'medium':'high');
  p.evidence.growthAxis=`可視の新成長を確認。記録${actorIndex+1}`;
  if(i>=16&&actorIndex===2){
    if(i%4===0){p.classification.fieldConfidence.growthAxis='low';p.classification.confidence='low';}
    if(i%4===1)p.observations.visibilityLimitations=['blur'];
    if(i%4===2){p.observations.sidebranch='clear';p.observations.secondGenerationBranch='clear';p.classification.basalBranchingLevel=3;}
    if(i%4===3){p.observations.newAxialGrowth='clear';p.classification.growthAxis='mixed';}
  }return p;
}
const morphology=p=>Object.fromEntries(FIELDS.map(f=>[f,p.classification[f]]));
const confidence=p=>({fieldConfidence:p.classification.fieldConfidence,confidence:p.classification.confidence});
const toVote=classification=>Object.fromEntries([...FIELDS,'confidence'].map(f=>[f,classification[f]]));
export function recordPredicates(records){
  const disagreement=FIELDS.filter(f=>new Set(records.map(p=>jcs(p.classification[f]))).size>1);
  const U=records.some(p=>p.classification.growthAxis==='indeterminate'||p.classification.basalBranchingLevel===null||p.classification.hollowing==='indeterminate');
  const levels=records.flatMap(p=>[...Object.values(p.classification.fieldConfidence),p.classification.confidence]);
  const paths=Object.keys(records[0].observations).filter(k=>new Set(records.map(p=>jcs(p.observations[k]))).size>1).map(k=>`observations.${k}`).sort(cmp);
  return{D:disagreement.length,U,L:levels.includes('low'),O:paths.length>0,H:levels.every(c=>c==='high'),disagreement,paths};
}
function consensusRecord(c,id,runs){
  const annotations=ACTORS.map(actor=>{const run=runs.find(r=>r.header.generator.actorId===actor&&r.records.some(p=>p.anonymousImageId===id));return{run,record:run.records.find(p=>p.anonymousImageId===id)};});
  const p=recordPredicates(annotations.map(a=>a.record));
  const row=c.truthTable.rows.find(r=>r.D===p.D&&r.U===p.U&&r.L===p.L&&r.O===p.O&&r.H===p.H);
  const refs=annotations.map(({run,record},i)=>({actorId:ACTORS[i],artifactId:run.header.artifactId,artifactFileSha256:run.fileSha256,recordObjectSha256:hash(record)}));
  const entry=c.manifest.entries.find(e=>e.anonymousImageId===id),confidenceDiffers=new Set(annotations.map(a=>jcs(confidence(a.record)))).size>1;
  return{recordType:'image-consensus',anonymousImageId:id,derivativeFileSha256:entry.derivativeFileSha256,derivativeRgbaSha256:entry.derivativeRgbaSha256,annotationArtifactRefs:refs,consensusInputSha256:whash('consensus-input',{orderedItems:refs.map(ref=>({anonymousImageId:id,actorId:ref.actorId,annotationArtifactFileSha256:ref.artifactFileSha256,annotationRecordObjectSha256:ref.recordObjectSha256}))}),morphologyDisagreementFields:p.disagreement,confidenceDiffers,observationDiffers:p.O,observationDisagreementFields:p.paths,category:row.category,proposedMorphology:p.D===0?morphology(annotations[0].record):null,proposedConfidence:confidenceDiffers?null:confidence(annotations[0].record),route:row.route};
}
export function buildWorkflow(c,options={}){
  const firstPlan={schemaVersion:'snow-crystal-annotation-consensus-slot-plan/1',protocolObjectSha256:hash(c.protocol),blindedManifestObjectSha256:hash(c.manifest),slots:[...ACTORS.flatMap(actor=>c.manifest.batches.map(batch=>({artifactKind:'annotation-run',actorId:actor,logicalSlot:`${actor}-${batch.batchId}`,batchId:batch.batchId,required:true,rootArtifactId:`root-${actor}-${batch.batchId}`,expectedAnonymousImageIdsSha256:idHash(batch.orderedAnonymousImageIds),unusedReason:null}))),{artifactKind:'consensus',actorId:null,logicalSlot:'consensus-all',batchId:'all-24',required:true,rootArtifactId:'root-consensus',expectedAnonymousImageIdsSha256:idHash(c.ids),unusedReason:null}]};
  const runs=firstPlan.slots.slice(0,6).map(slot=>{
    const b=c.inputTables.findIndex(t=>t.batchId===slot.batchId),table=c.inputTables[b],prompt=c.prompts[b],input=imageInput(table),camp=campaign(firstPlan,slot,prompt,table,input);
    const modelPayloads=table.orderedItems.map(i=>{const p=modelPayload(c,i.anonymousImageId,ACTORS.indexOf(slot.actorId));if(options.allQ&&slot.actorId==='annotator-3')p.observations.visibilityLimitations=['overlap'];return p;}),rawResponseBytes=fileBytes(modelPayloads),generator=vision(c,'annotator',slot.actorId,prompt,camp,FAMILIES[ACTORS.indexOf(slot.actorId)]);
    generator.responseCapture.capturedResponseFileSha256=sha(rawResponseBytes);
    const h={...header(c,firstPlan,'annotation-run',slot.logicalSlot,slot.rootArtifactId,slot.batchId,12,input,generator),batchInputTableObjectSha256:hash(table)};
    const records=modelPayloads.map(p=>{const entry=c.manifest.entries.find(e=>e.anonymousImageId===p.anonymousImageId);return{recordType:'image-annotation',anonymousImageId:p.anonymousImageId,derivativeFileSha256:entry.derivativeFileSha256,derivativeRgbaSha256:entry.derivativeRgbaSha256,modelPayloadObjectSha256:hash(p),imageTransport:imageTransport(entry),observations:p.observations,classification:p.classification,evidence:p.evidence};});
    return artifact(h,records,{campaign:camp,modelPayloads,rawResponseBytes,table,prompt,inventory:[...table.orderedItems.map(i=>({kind:'image',anonymousImageId:i.anonymousImageId,relativePath:`images/${i.anonymousImageId}.png`,fileSha256:i.derivativeFileSha256})),{kind:'protocol-object',relativePath:'input/protocol.json',fileSha256:sha(fileBytes(c.protocol))},{kind:'role-schema',relativePath:'input/annotator.schema.json',fileSha256:prompt.variables.schemaFileSha256},{kind:'prompt',relativePath:'input/annotator.txt',fileSha256:sha(prompt.rendered)},{kind:'batch-input',relativePath:'input/batch.json',fileSha256:sha(fileBytes(table))}],workspaceId:`workspace-${slot.logicalSlot}`,freshContextChecklist:{newSessionConfirmed:true,providerInternalContextProvable:false}});
  });
  const consensusRecords=c.ids.map(id=>consensusRecord(c,id,runs));
  const input=whash('consensus-input',{orderedItems:consensusRecords.flatMap(r=>r.annotationArtifactRefs.map(ref=>({anonymousImageId:r.anonymousImageId,actorId:ref.actorId,annotationArtifactFileSha256:ref.artifactFileSha256,annotationRecordObjectSha256:ref.recordObjectSha256})))});
  const consensus=artifact(header(c,firstPlan,'consensus','consensus-all','root-consensus','all-24',24,input,{kind:'deterministic-coordinator',operation:'consensus'}),consensusRecords);
  const emptyLedger=makeLedger(c,firstPlan,[],null);
  const snapshot=wrapped('active-annotation-consensus-snapshot',{annotationConsensusSlotPlanObjectSha256:hash(firstPlan),supersessionLedgerFileSha256:emptyLedger.fileSha256,cutoffSequence:0,orderedItems:[...runs,consensus].map(a=>({artifactKind:a.header.artifactKind,logicalSlot:a.header.logicalSlot,rootArtifactId:a.header.artifactId,activeArtifactId:a.header.artifactId,activeArtifactFileSha256:a.fileSha256})).sort(artifactOrder)});
  const Q=consensusRecords.filter(r=>r.route==='adjudication').map(r=>r.anonymousImageId);
  const sourceIds=c.restricted.entries.map(e=>e.sourceObservationId).sort(cmp),batchSources=c.restricted.entries.filter(e=>consensusRecords.find(r=>r.anonymousImageId===e.anonymousImageId).category==='label-exact-all-high').map(e=>e.sourceObservationId).sort(cmp);
  const makeRoutePlan=(fresh=true,targets=Q)=>{
    const partitions=fresh?[targets.slice(0,20),targets.slice(20)]:[[],[]];
    return{schemaVersion:'snow-crystal-post-consensus-route-slot-plan/1',protocolObjectSha256:hash(c.protocol),annotationConsensusSlotPlanObjectSha256:hash(firstPlan),activeAnnotationConsensusSnapshotSha256:hash(snapshot),activeConsensusArtifactFileSha256:consensus.fileSha256,adjudicationMode:fresh?'fresh-nonoverlap-model':'skipped-direct-human',adjudicatorEligibility:fresh?{product:'GitHub Copilot',displayedModelId:'synthetic-displayed-family',displayedModelFamily:'synthetic-independent-family',clientTool:'synthetic-copilot-client',clientToolVersion:'1',familyNonOverlapWith:['claude','openai','google'],checkedAtUtc:utc(5)}:null,adjudicationSkipReason:fresh?null:'model-family-not-displayed',slots:[...partitions.map((ids,i)=>({artifactKind:'adjudication-run',logicalSlot:`adjudication-${String(i+1).padStart(2,'0')}`,batchId:`adjudication-${String(i+1).padStart(2,'0')}`,required:ids.length>0,rootArtifactId:ids.length?`root-adjudication-${i+1}`:null,idKind:'anonymous-image',idSetSemantics:'exact',expectedOrAllowedIdsSha256:idHash(ids),unusedReason:ids.length?null:fresh?(targets.length?'adjudication-partition-not-needed':'no-adjudication-targets'):'adjudication-skipped-direct-human'})),{artifactKind:'human-approval',logicalSlot:'human-batch',batchId:'human-batch',required:batchSources.length>0,rootArtifactId:batchSources.length?'root-human-batch':null,idKind:'source-observation',idSetSemantics:'allowed',expectedOrAllowedIdsSha256:idHash(batchSources,true),unusedReason:batchSources.length?null:'no-human-batch-targets'},{artifactKind:'human-approval',logicalSlot:'human-individual',batchId:'human-individual',required:true,rootArtifactId:'root-human-individual',idKind:'source-observation',idSetSemantics:'allowed',expectedOrAllowedIdsSha256:idHash(sourceIds,true),unusedReason:null}]};
  };
  const freshPlan=makeRoutePlan(),skippedPlan=makeRoutePlan(false);
  if(options.planningOnly)return{firstPlan,runs,consensus,emptyLedger,snapshot,Q,sourceIds,batchSources,makeRoutePlan,freshPlan,skippedPlan};
  const aliases={schemaVersion:'snow-crystal-candidate-alias-manifest/1',protocolObjectSha256:hash(c.protocol),postConsensusRouteSlotPlanObjectSha256:hash(freshPlan),consensusArtifactFileSha256:consensus.fileSha256,entries:Q.map(id=>{
    const permutationSeedSha256=whash('candidate-alias-seed',{protocolObjectSha256:hash(c.protocol),consensusArtifactFileSha256:consensus.fileSha256,anonymousImageId:id});
    const candidates=consensusRecords.find(r=>r.anonymousImageId===id).annotationArtifactRefs.map(ref=>{const run=runs.find(a=>a.header.artifactId===ref.artifactId),record=run.records.find(r=>r.anonymousImageId===id);return{ref,record,key:whash('candidate-alias-sort-key',{permutationSeedSha256,annotationArtifactFileSha256:ref.artifactFileSha256,annotationRecordObjectSha256:ref.recordObjectSha256})};}).sort((a,b)=>cmp(a.key,b.key)||cmp(a.ref.artifactFileSha256,b.ref.artifactFileSha256)||cmp(a.ref.recordObjectSha256,b.ref.recordObjectSha256));
    return{anonymousImageId:id,permutationSeedSha256,candidates:candidates.map(({ref,record},i)=>{const sanitized={alias:['candidate-X','candidate-Y','candidate-Z'][i],observations:record.observations,classification:record.classification,evidence:record.evidence};return{alias:sanitized.alias,annotationArtifactFileSha256:ref.artifactFileSha256,annotationRecordObjectSha256:ref.recordObjectSha256,sanitizedCandidateObjectSha256:hash(sanitized)};})};
  })};
  const candidateInput=whash('candidate-input',{candidateAliasManifestObjectSha256:hash(aliases),orderedItems:aliases.entries.flatMap(e=>e.candidates.map(a=>({anonymousImageId:e.anonymousImageId,...a})))});
  const candidateTable={schemaVersion:'snow-crystal-adjudication-candidate-table/1',candidateAliasManifestObjectSha256:hash(aliases),candidateInputSha256:candidateInput,orderedItems:aliases.entries.map(entry=>({anonymousImageId:entry.anonymousImageId,candidates:entry.candidates.map(a=>{const run=runs.find(r=>r.fileSha256===a.annotationArtifactFileSha256),record=run.records.find(r=>r.anonymousImageId===entry.anonymousImageId);return{alias:a.alias,observations:record.observations,classification:record.classification,evidence:record.evidence};})}))};
  const adjudicationTable={schemaVersion:'snow-crystal-morphology-pilot-batch-input/1',protocolObjectSha256:hash(c.protocol),blindedManifestObjectSha256:hash(c.manifest),batchId:'adjudication-01',orderedItems:Q.map((id,ordinal)=>{const entry=c.manifest.entries.find(e=>e.anonymousImageId===id);return{ordinal,anonymousImageId:id,derivativeFileSha256:entry.derivativeFileSha256,derivativeRgbaSha256:entry.derivativeRgbaSha256,attachmentSlot:`attachment-${ordinal+1}`};})};
  const adjudicationPrompt=c.makePrompt('adjudicator',adjudicationTable,aliases,candidateTable),slot=freshPlan.slots[0],camp=campaign(freshPlan,slot,adjudicationPrompt,adjudicationTable,candidateInput);
  const adjudicationPayloads=candidateTable.orderedItems.map((entry,i)=>{
    const selected=entry.candidates[0];
    if(i%3===0)return{anonymousImageId:entry.anonymousImageId,selectedCandidate:selected.alias,observations:selected.observations,classification:selected.classification,evidence:evidenceCopy(selected.evidence),disposition:'propose-one-candidate'};
    const p=payload(entry.anonymousImageId,'medium');
    if(i%3===1){p.observations.visibilityLimitations=['low-contrast'];return{...p,selectedCandidate:null,disposition:'propose-new-value'};}
    p.classification.fieldConfidence.hollowing='low';p.classification.confidence='low';return{...p,selectedCandidate:null,disposition:'retain-human-review'};
  });
  const rawResponseBytes=fileBytes(adjudicationPayloads),generator=vision(c,'adjudicator','adjudicator-1',adjudicationPrompt,camp,freshPlan.adjudicatorEligibility.displayedModelFamily);generator.responseCapture.capturedResponseFileSha256=sha(rawResponseBytes);
  generator.displayedModelId=freshPlan.adjudicatorEligibility.displayedModelId;
  generator.clientTool=freshPlan.adjudicatorEligibility.clientTool;
  generator.startedAtUtc=utc(6);generator.completedAtUtc=utc(7);generator.responseCapture.capturedAtUtc=utc(8);
  const adjudication=artifact({...header(c,firstPlan,'adjudication-run',slot.logicalSlot,slot.rootArtifactId,slot.batchId,Q.length,candidateInput,generator,freshPlan),batchInputTableObjectSha256:hash(adjudicationTable)},adjudicationPayloads.map(p=>{
    const entry=c.manifest.entries.find(e=>e.anonymousImageId===p.anonymousImageId),cons=consensusRecords.find(r=>r.anonymousImageId===p.anonymousImageId);
    return{recordType:'image-adjudication',anonymousImageId:p.anonymousImageId,derivativeFileSha256:entry.derivativeFileSha256,derivativeRgbaSha256:entry.derivativeRgbaSha256,modelPayloadObjectSha256:hash(p),imageTransport:imageTransport(entry),consensusArtifactFileSha256:consensus.fileSha256,consensusRecordObjectSha256:hash(cons),disputedFields:[...(cons.observationDiffers?['observations']:[]),...cons.morphologyDisagreementFields,...(cons.confidenceDiffers?['confidence']:[])],candidateAliasManifestObjectSha256:hash(aliases),candidatePayloadTableObjectSha256:hash(candidateTable),candidateInputSha256:candidateInput,selectedCandidate:p.selectedCandidate,observations:p.observations,classification:p.classification,evidence:p.evidence,disposition:p.disposition};
  }),{campaign:camp,modelPayloads:adjudicationPayloads,rawResponseBytes,table:adjudicationTable,prompt:adjudicationPrompt});
  const w={firstPlan,runs,consensus,emptyLedger,snapshot,Q,sourceIds,batchSources,makeRoutePlan,freshPlan,skippedPlan,aliases,candidateTable,candidateInput,adjudication};
  w.upstreamFreshBatch=approvalUpstreamSnapshot(w,true,[consensus.header.artifactId]);
  w.upstreamFresh=approvalUpstreamSnapshot(w,true,[consensus.header.artifactId,adjudication.header.artifactId]);
  w.upstreamSkipped=approvalUpstreamSnapshot(w,false,[consensus.header.artifactId]);
  w.approvals=makeApprovals(c,w,true);w.skippedApprovals=makeApprovals(c,w,false);w.coverage=makeCoverage(c,w,w.approvals,true);w.skippedCoverage=makeCoverage(c,w,w.skippedApprovals,false);
  return w;
}
const evidenceCopy=e=>({...e});
export function approvalUpstreamSnapshot(w,fresh,proposalArtifactIds){
  const inventory=[...w.runs,w.consensus,...(fresh?[w.adjudication]:[])],closure=new Map();
  function visit(id){
    if(closure.has(id))return;const a=inventory.find(x=>x.header.artifactId===id);assert(a,`unknown proposal artifact ${id}`);closure.set(id,a);
    if(a.header.artifactKind==='consensus')for(const record of a.records)for(const ref of record.annotationArtifactRefs)visit(ref.artifactId);
    if(a.header.artifactKind==='adjudication-run')for(const record of a.records){const consensus=inventory.find(x=>x.fileSha256===record.consensusArtifactFileSha256);assert(consensus);visit(consensus.header.artifactId);}
  }
  for(const id of new Set(proposalArtifactIds))visit(id);
  return wrapped('active-upstream-snapshot',{annotationConsensusSlotPlanObjectSha256:hash(w.firstPlan),activeAnnotationConsensusSnapshotSha256:hash(w.snapshot),postConsensusRouteSlotPlanObjectSha256:hash(fresh?w.freshPlan:w.skippedPlan),supersessionLedgerFileSha256:w.emptyLedger.fileSha256,cutoffSequence:0,orderedItems:[...closure.values()].map(a=>({artifactKind:a.header.artifactKind,logicalSlot:a.header.logicalSlot,artifactId:a.header.artifactId,artifactFileSha256:a.fileSha256})).sort(artifactOrder)});
}
export function makeLedger(c,plan,entries,previous,post=null){
  const metadata={recordType:'supersession-ledger-metadata',previousLedgerFileSha256:previous?.fileSha256??null,entryCount:entries.length,lastSequence:entries.length};
  const input=whash('supersession-ledger-input',{previousLedgerFileSha256:metadata.previousLedgerFileSha256,orderedItems:entries.map(({recordType,...r})=>r)});
  return artifact(header(c,plan,'supersession-ledger','ledger-all',`ledger-version-${entries.length}`,'all',1+entries.length,input,{kind:'deterministic-coordinator',operation:'supersession-ledger'},post),[metadata,...entries]);
}
function makeApprovals(c,w,fresh){
  const plan=fresh?w.freshPlan:w.skippedPlan;
  return ['batch-summary','individual-source-pdf'].map((mode,m)=>{
    const upstream=fresh?(m===0?w.upstreamFreshBatch:w.upstreamFresh):w.upstreamSkipped;
    const targets=c.restricted.entries.filter(e=>m===0?c.ids.indexOf(e.anonymousImageId)<8:c.ids.indexOf(e.anonymousImageId)>=8).map(entry=>{
      const cons=w.consensus.records.find(r=>r.anonymousImageId===entry.anonymousImageId),adj=fresh&&w.Q.includes(entry.anonymousImageId)?w.adjudication.records.find(r=>r.anonymousImageId===entry.anonymousImageId):null;
      const sourceArtifact=adj?w.adjudication:w.consensus,record=adj??cons;
      const proposalVote=adj?(adj.disposition==='retain-human-review'?null:toVote(adj.classification)):cons.proposedMorphology&&cons.proposedConfidence?{...cons.proposedMorphology,confidence:cons.proposedConfidence.confidence}:null;
      const correction=m===1&&(c.ids.indexOf(entry.anonymousImageId)%2===0||proposalVote===null),final=correction?{...vote('medium'),basalBranchingLevel:0}:clone(proposalVote);
      return{targetKind:mode,anonymousImageId:entry.anonymousImageId,sourceObservationId:entry.sourceObservationId,category:cons.category,activeUpstreamSnapshotSha256:hash(upstream),proposal:{sourceKind:adj?'adjudication':'consensus',artifactId:sourceArtifact.header.artifactId,artifactFileSha256:sourceArtifact.fileSha256,recordObjectSha256:hash(record),proposalVote,proposalVoteObjectSha256:proposalVote?hash(proposalVote):null},final,outcome:correction?'corrected':'approved',rationale:m===0?null:correction?'原資料の可視範囲に基づき修正。':'原資料で提案との一致を確認。'};
    }).sort((a,b)=>cmp(a.sourceObservationId,b.sourceObservationId));
    const values=whash('approval-final-values',{activeUpstreamSnapshotSha256:hash(upstream),orderedItems:targets.filter(t=>t.final).map(t=>({sourceObservationId:t.sourceObservationId,final:t.final}))});
    const withoutId={recordType:'human-approval',approvalMode:mode,approvalRole:'human-morphology-auditor',approvedAtUtc:utc(10),restrictedMappingObjectSha256:hash(c.restricted),activeUpstreamSnapshotSha256:hash(upstream),targets,finalValuesSha256:values};
    const record={...withoutId,approvalId:whash('approval-record-id',{approvalRecordWithoutApprovalId:withoutId})};
    const slot=plan.slots[m+2];return artifact(header(c,w.firstPlan,'human-approval',slot.logicalSlot,slot.rootArtifactId,slot.batchId,1,values,{kind:'deterministic-coordinator',operation:'human-approval'},plan),[record]);
  });
}
export function makeCoverage(c,w,approvals,fresh,cutoffSequence=0){
  const plan=fresh?w.freshPlan:w.skippedPlan;
  const refs=approvals.map(a=>({logicalSlot:a.header.logicalSlot,rootArtifactId:plan.slots.find(s=>s.logicalSlot===a.header.logicalSlot).rootArtifactId,activeApprovalArtifactId:a.header.artifactId,approvalArtifactFileSha256:a.fileSha256,approvalRecordObjectSha256:hash(a.records[0])})).sort((a,b)=>cmp(a.logicalSlot,b.logicalSlot));
  const snapshot=wrapped('pilot-approval-coverage-snapshot',{blindedManifestObjectSha256:hash(c.manifest),restrictedMappingObjectSha256:hash(c.restricted),postConsensusRouteSlotPlanObjectSha256:hash(plan),supersessionLedgerFileSha256:w.emptyLedger.fileSha256,cutoffSequence,orderedItems:refs});
  const finals=approvals.flatMap(a=>a.records[0].targets.map(t=>({anonymousImageId:t.anonymousImageId,sourceObservationId:t.sourceObservationId,final:t.final,approvalId:a.records[0].approvalId,approvalArtifactFileSha256:a.fileSha256,approvalRecordObjectSha256:hash(a.records[0]),approvalTargetObjectSha256:hash(t)}))).sort((a,b)=>cmp(a.sourceObservationId,b.sourceObservationId));
  const record={recordType:'pilot-approval-coverage',coverageScope:'pilot-24',expectedCount:24,blindedManifestObjectSha256:hash(c.manifest),restrictedMappingObjectSha256:hash(c.restricted),expectedAnonymousImageIdsSha256:idHash(c.ids),expectedSourceObservationIdsSha256:idHash(w.sourceIds,true),annotationConsensusSlotPlanObjectSha256:hash(w.firstPlan),postConsensusRouteSlotPlanObjectSha256:hash(plan),supersessionLedgerFileSha256:w.emptyLedger.fileSha256,cutoffSequence,approvalCoverageSnapshotSha256:hash(snapshot),activeApprovalRefs:refs,coveredFinals:finals};
  return{snapshot,...artifact(header(c,w.firstPlan,'pilot-approval-coverage','coverage-all','coverage-final','all-24',1,hash(snapshot),{kind:'deterministic-coordinator',operation:'pilot-approval-coverage'},plan),[record])};
}

export function workflowCases(c,w){
  const context={protocol:c.protocol,manifest:c.manifest,firstPlan:w.firstPlan};
  assert.equal(w.firstPlan.slots.length,7);assert.equal(w.runs.length,6);assert.equal(w.runs.flatMap(r=>r.records).length,72);
  for(const run of w.runs){
    const fixture={...context,run};assert.equal(run.records.length,12);assert.equal(sha(run.bytes),run.fileSha256);assert.equal(hash(run.campaign),run.header.generator.campaignIdSha256);
    for(const record of run.records){assert(schemaAccepts(c.bundle.annotationPayloadSchemaFileSha256.object,{anonymousImageId:record.anonymousImageId,observations:record.observations,classification:record.classification,evidence:record.evidence}));}
    good('annotation-run',fixture,{artifactId:run.header.artifactId,fileSha256:run.fileSha256,recordObjectSha256s:run.records.map(hash)});
    for(const field of ['provider','displayedModelId','clientTool','attachmentMode','startedAtUtc','completedAtUtc','promptVariablesObjectSha256','schemaFileSha256','modelPayloadSchemaObjectSha256','renderedPromptEvidenceObjectSha256','renderedPromptSha256'])bad('annotation-run',fixture,f=>{delete f.run.header.generator[field];},'missing-property',field,'TypeError',`${run.header.artifactId}/${field}`);
    for(const [label,fn,field]of[
      ['actor-swap',f=>{f.run.header.generator.actorId=ACTORS[(ACTORS.indexOf(run.header.generator.actorId)+1)%3];},'actorId'],['family-swap',f=>{f.run.header.generator.modelFamily='other';},'modelFamily'],['adjudicator',f=>{f.run.header.generator.actorId='adjudicator-1';},'actorId'],['batch-sharing',f=>{f.run.header.batchId=run.header.batchId==='batch-01'?'batch-02':'batch-01';},'batchId'],
      ['missing-record',f=>f.run.records.pop(),'records'],['duplicate-record',f=>{f.run.records[1]=clone(f.run.records[0]);},'anonymousImageId'],['unknown-record',f=>{f.run.records[0].anonymousImageId='img-999';},'anonymousImageId'],['order',f=>f.run.records.reverse(),'records'],['schema',f=>{f.run.records[0].classification.extra=true;},'classification'],['mapping',f=>{f.run.records[0].classification.basalBranchingLevel=0;},'basalBranchingLevel'],['transport',f=>{f.run.records[0].imageTransport.uploadedWidthPx=4;},'uploadedWidthPx'],['raw-hash',f=>{f.run.header.generator.responseCapture.capturedResponseFileSha256=H('bad-raw');},'capturedResponseFileSha256'],['raw-edit',f=>{f.run.rawResponseBytes+=' ';},'rawResponseBytes'],['campaign',f=>{f.run.header.generator.campaignIdSha256=H('bad-campaign');},'campaignIdSha256'],['attempt-gap',f=>{f.run.header.generator.attemptNumber=2;},'attemptNumber'],['restricted-map',f=>{f.run.header.restrictedMappingObjectSha256=hash(c.restricted);},'restrictedMappingObjectSha256'],['route-plan-early',f=>{f.run.header.postConsensusRouteSlotPlanObjectSha256=hash(w.freshPlan);},'postConsensusRouteSlotPlanObjectSha256'],
    ])bad('annotation-run',fixture,fn,label==='schema'?'unknown-property':'run-invalid',field,label==='schema'?'TypeError':'RangeError',`${run.header.artifactId}/${label}`);
    for(const kind of ['other-actor-output','existing-A-B','human-final','restricted-map','repository'])bad('annotation-run',fixture,f=>{f.run.inventory.push({kind,fileSha256:H(kind)});},'workspace-inventory','inventory');
    for(const [label,raw]of[['fence','```json\n'+run.rawResponseBytes+'```\n'],['prefix','Answer:\n'+run.rawResponseBytes],['suffix',run.rawResponseBytes+'Done'],['invalid-json','{'],['duplicate-key','{"anonymousImageId":"img-001","anonymousImageId":"img-001"}']])bad('annotation-run',fixture,f=>{f.run.rawResponseBytes=raw;},label==='duplicate-key'?'duplicate-key':'json-syntax','rawResponseBytes','SyntaxError',label);
    for(const key of ['account','chatUrl','clipboardMetadata','screenExport'])bad('annotation-run',fixture,f=>{f.run[key]='forbidden';},'unknown-property',key,'TypeError');
  }
  const six={...context,runs:w.runs};good('annotation-campaigns',six,true);
  bad('annotation-campaigns',six,f=>{f.runs[1].campaign=f.runs[0].campaign;},'campaign-not-independent','campaignIdSha256');
  bad('annotation-campaigns',six,f=>{f.runs[1].workspaceId=f.runs[0].workspaceId;},'workspace-not-independent','workspaceId');
  bad('annotation-campaigns',six,f=>{f.independenceClaim='complete-provider-internal-context-proof';},'independence-claim','independenceClaim');
  const truth={truthTable:c.truthTable,protocol:c.protocol};good('consensus-truth-table',truth,c.protocol.decisionContract.consensusRoutingTruthTableObjectSha256);
  for(const row of c.truthTable.rows)good('consensus-route',{D:row.D,U:row.U,L:row.L,O:row.O,H:row.H},{category:row.category,route:row.route});
  for(const label of ['row-swap','hash','category','missing','duplicate'])bad('consensus-truth-table',truth,f=>{if(label==='row-swap')f.truthTable.rows.reverse();if(label==='hash')f.protocol.decisionContract.consensusRoutingTruthTableObjectSha256=H('truth');if(label==='category')f.truthTable.rows[0].category='single-field-disagreement';if(label==='missing')f.truthTable.rows.pop();if(label==='duplicate')f.truthTable.rows[1]=f.truthTable.rows[0];},'consensus-truth-table','rows','RangeError',label);
  const cons={...context,runs:w.runs,consensus:w.consensus};good('consensus',cons,{fileSha256:w.consensus.fileSha256,records:w.consensus.records});
  assert.equal(w.consensus.records.filter(r=>r.category==='label-exact-all-high').length,8);assert.equal(w.consensus.records.filter(r=>r.category==='label-exact-nonhigh-or-confidence-differs').length,8);assert.equal(w.Q.length,8);
  for(const [label,fn,field]of[
    ['trust-category',f=>{f.consensus.records[0].category='single-field-disagreement';},'category'],['confidence-is-not-O',f=>{f.consensus.records[16].observationDiffers=true;},'observationDiffers'],['priority',f=>{f.consensus.records[18].category='single-field-disagreement';},'category'],['evidence-is-not-O',f=>{f.consensus.records[0].observationDiffers=true;},'observationDiffers'],['morphology-fields',f=>{f.consensus.records[18].morphologyDisagreementFields=[];},'morphologyDisagreementFields'],['observation-paths',f=>{f.consensus.records[17].observationDisagreementFields=['observations.seedCrystal'];},'observationDisagreementFields'],['proposal-on-D1',f=>{f.consensus.records[18].proposedMorphology=morphology(w.runs[0].records[0]);},'proposedMorphology'],['confidence-proposal',f=>{f.consensus.records[16].proposedConfidence=confidence(w.runs[0].records[0]);},'proposedConfidence'],['inactive-ref',f=>{f.consensus.records[0].annotationArtifactRefs[0].artifactFileSha256=H('inactive');},'annotationArtifactRefs'],
  ])bad('consensus',cons,fn,'consensus-invalid',field,'RangeError',label);
}
