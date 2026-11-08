import {createHash} from "node:crypto";
import {load} from "cheerio";
import type {ClaimIntake} from "./claim-input";

export type ResearchSource={id:string;url:string;title:string;scope:string;retrieved_at:string;sha256:string;text:string;citation_candidates?:string[]};
export type ResearchBundle={status:"ready"|"partial"|"unavailable"|"not_supported";sources:ResearchSource[];gaps:string[]};
type SourceSpec={id:string;url:string;title:string;scope:string};
export const SOURCE_CATALOG:Readonly<Record<string,SourceSpec>>={
 ca_claim:{id:"ca_dwc_claim",url:"https://www.dir.ca.gov/DWC/FileAClaim.htm",title:"California DWC: How to file a claim",scope:"California workers' compensation filing guidance. Confirm jurisdiction, employment relationship, and applicability before using it for a case."},
 ca_injury:{id:"ca_dwc_injury",url:"https://www.dir.ca.gov/dwc/InjuredWorker.htm",title:"California DWC: I was injured at work",scope:"California workers' compensation overview. General benefit descriptions are not eligibility or a payment decision."},
 health_appeal:{id:"healthcare_gov_appeals",url:"https://www.healthcare.gov/appeal-insurance-company-decision/",title:"HealthCare.gov: Appealing a health plan decision",scope:"US general health-plan appeal guidance. Confirm plan type, actual denial notice, jurisdiction, and applicable process; not workers' compensation guidance."},
};
export function selectResearchSources(caseType:string,intake:Partial<ClaimIntake>):{specs:SourceSpec[];gaps:string[]}{
 if(caseType==="workplace_injury"){
  const jurisdiction=intake.jurisdiction?.trim().toLowerCase();
  if(!jurisdiction)return {specs:[],gaps:["Jurisdiction is missing. Do not assume California from the service location."]};
  if(!["ca","california","us-ca"].includes(jurisdiction))return {specs:[],gaps:["This jurisdiction has no configured official-source research adapter. Do not substitute California rules."]};
  return {specs:[SOURCE_CATALOG.ca_claim,SOURCE_CATALOG.ca_injury],gaps:["Employer carrier and actual policy/claim documents are still needed to determine this person's coverage. Personal health-plan coordination is not established by these general sources."]};
 }
 return {specs:[SOURCE_CATALOG.health_appeal],gaps:["Confirm the plan type and actual insurer notice. This general US guide does not establish this claim's appeal procedure or deadlines."]};
}
export const normalizeEvidenceText=(value:string)=>value.replace(/\s+/g," ").trim();
export function extractOfficialText(html:string){
 const $=load(html);$("script,style,nav,header,footer,form,iframe,noscript,svg").remove();
 const main=$("main").first();const root=main.length?main:$("#main-content").first();
 if(!root.length)throw new Error("SOURCE_CONTENT_MISSING");
 root.find("br,p,li,h1,h2,h3,h4,div,section").append(" ");
 const text=normalizeEvidenceText(root.text());
 if(text.length<100||text.length>50000)throw new Error("SOURCE_CONTENT_SIZE");
 return text;
}
export function citationCandidates(text:string){
 return [...new Intl.Segmenter("en",{granularity:"sentence"}).segment(text)].map(s=>s.segment.trim()).filter(s=>s.split(/\s+/).length>=6&&s.split(/\s+/).length<=25).slice(0,16);
}
export async function fetchOfficialSource(spec:SourceSpec,fetcher:typeof fetch=fetch):Promise<ResearchSource>{
 // URL values are selected from this server-owned catalog, never case fields or model output.
 if(!Object.values(SOURCE_CATALOG).some(s=>s.url===spec.url&&s.id===spec.id))throw new Error("SOURCE_NOT_ALLOWED");
 const response=await fetcher(spec.url,{redirect:"error",headers:{Accept:"text/html"},signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.headers.get("content-type")?.includes("text/html"))throw new Error("SOURCE_UNAVAILABLE");
 const reader=response.body?.getReader();if(!reader)throw new Error("SOURCE_EMPTY");
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2*1024*1024)throw new Error("SOURCE_TOO_LARGE");chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const text=extractOfficialText(Buffer.concat(chunks).toString("utf8"));
 return {...spec,retrieved_at:new Date().toISOString(),sha256:createHash("sha256").update(text).digest("hex"),text,citation_candidates:citationCandidates(text)};
}
export async function researchCase(caseType:string,intake:Partial<ClaimIntake>,fetcher:typeof fetch=fetch):Promise<ResearchBundle>{
 const {specs,gaps}=selectResearchSources(caseType,intake);
 if(!specs.length)return {status:"not_supported",sources:[],gaps};
 const results=await Promise.allSettled(specs.map(s=>fetchOfficialSource(s,fetcher)));
 const sources=results.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);
 const failed=results.flatMap((r,i)=>r.status==="rejected"?[`Could not retrieve ${specs[i].title}. No findings may rely on that source.`]:[]);
 return {status:sources.length===specs.length?"ready":sources.length?"partial":"unavailable",sources,gaps:[...gaps,...failed]};
}
export type ResearchFinding={statement:string;source_id:string;quote:string;applicability:string};
export function researchFindingsValid(findings:ResearchFinding[],bundle:ResearchBundle){
 const wordsBySource=new Map<string,number>();
 for(const finding of findings){
  const source=bundle.sources.find(s=>s.id===finding.source_id);const quote=normalizeEvidenceText(finding.quote);
  if(wordsBySource.has(finding.source_id)||!source||quote.length<12||!source.text.includes(quote))return false;
  const words=(wordsBySource.get(source.id)??0)+quote.split(" ").length;
  if(words>25)return false;wordsBySource.set(source.id,words);
 }
 return !bundle.sources.length||findings.length>0;
}
export function publicResearch(bundle:ResearchBundle){return {...bundle,sources:bundle.sources.map(({text,citation_candidates,...source})=>source)};}
