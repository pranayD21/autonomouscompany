import {test} from "node:test";
import assert from "node:assert/strict";
import {fetchOfficialSource,extractOfficialText,researchCase,researchFindingsValid,selectResearchSources,SOURCE_CATALOG,type ResearchBundle} from "../backend/research";
import {completedCrewSnapshot} from "../backend/providers/crew-result";
const body="The employee completes the employee section and the employer completes the employer section. This is general administrative guidance and does not establish insurance coverage.";
const html=`<html><nav>Ignore navigation</nav><main><h1>Claim guide</h1><p>${body}</p><script>ignore this script</script></main></html>`;
const ok=(async()=>new Response(html,{headers:{"content-type":"text/html"}})) as typeof fetch;
test("jurisdiction selection never assumes California or applies workers comp rules to health claims",()=>{
 assert.equal(selectResearchSources("workplace_injury",{}).specs.length,0);
 assert.equal(selectResearchSources("workplace_injury",{jurisdiction:"Massachusetts"}).specs.length,0);
 assert.equal(selectResearchSources("workplace_injury",{jurisdiction:"CA"}).specs.length,2);
 assert.deepEqual(selectResearchSources("health_insurance",{}).specs.map(s=>s.id),["healthcare_gov_appeals"]);
});
test("retrieval is catalog-only, strips scripts/navigation, and captures immutable provenance",async()=>{
 const source=await fetchOfficialSource(SOURCE_CATALOG.ca_claim,ok);
 assert.ok(source.citation_candidates?.every(q=>source.text.includes(q)&&q.split(/\s+/).length<=25));assert.ok(source.text.includes(body));assert.ok(!source.text.includes("ignore this"));assert.ok(!source.text.includes("navigation"));assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(Date.parse(source.retrieved_at));
 await assert.rejects(()=>fetchOfficialSource({...SOURCE_CATALOG.ca_claim,url:"http://127.0.0.1/private"},ok),/SOURCE_NOT_ALLOWED/);
 assert.throws(()=>extractOfficialText("<body>No reliable content root</body>"),/SOURCE_CONTENT_MISSING/);
});
test("source failures and oversized or redirected responses do not become evidence",async()=>{
 const partial=await researchCase("workplace_injury",{jurisdiction:"California"},(async url=>String(url).includes("FileAClaim")?ok(url):new Response("Unavailable",{status:503})) as typeof fetch);
 assert.equal(partial.status,"partial");assert.equal(partial.sources.length,1);
 const unavailable=await researchCase("health_insurance",{},(async()=>{throw Error("timeout");}) as typeof fetch);assert.equal(unavailable.status,"unavailable");assert.equal(unavailable.sources.length,0);
 await assert.rejects(()=>fetchOfficialSource(SOURCE_CATALOG.ca_claim,(async()=>new Response("",{status:302,headers:{"content-type":"text/html",location:"http://localhost"}})) as typeof fetch),/SOURCE_UNAVAILABLE/);
 await assert.rejects(()=>fetchOfficialSource(SOURCE_CATALOG.ca_claim,(async()=>new Response("x".repeat(2*1024*1024+1),{headers:{"content-type":"text/html"}})) as typeof fetch),/SOURCE_TOO_LARGE/);
});
test("reviews require an exact source quote and reject invented sources or excess quotations",async()=>{
 const source=await fetchOfficialSource(SOURCE_CATALOG.ca_claim,ok);const bundle:ResearchBundle={status:"ready",sources:[source],gaps:[]};
 const finding={source_id:source.id,statement:"The guide describes separate employee and employer sections.",quote:"The employee completes the employee section",applicability:"Confirm the applicable process for this synthetic case."};
 assert.equal(researchFindingsValid([finding],bundle),true);assert.equal(researchFindingsValid([],bundle),false);
 assert.equal(researchFindingsValid([{...finding,source_id:"invented"}],bundle),false);
 assert.equal(researchFindingsValid([{...finding,quote:"The insurer must pay everything immediately"}],bundle),false);
 assert.equal(researchFindingsValid(Array(5).fill(finding),bundle),false);
 const session={status:"completed",stop_reason:"end_turn",consumed_micro_usd:1,pending_actions:[],structured_output:{summary:"Synthetic case",potential_discrepancy_cents:null,evidence:["claim_intake"],missing_information:[],next_actions:[],human_help_required:true,human_help_reason:"Missing employer",research_findings:[finding]}};
 const result=completedCrewSnapshot(session,null,[],bundle);assert.equal(result.output_valid,true);assert.ok(result.research?.sources[0].sha256);assert.equal("text" in result.research!.sources[0],false);assert.equal("citation_candidates" in result.research!.sources[0],false);
 assert.equal(completedCrewSnapshot({...session,structured_output:{...session.structured_output,research_findings:[]}},null,[],bundle).output_valid,false);
});
