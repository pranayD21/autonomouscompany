import {config} from "dotenv";import {Pool} from "pg";import {randomUUID,randomBytes,createHash} from "node:crypto";import {existsSync,mkdirSync,writeFileSync,readFileSync,unlinkSync} from "node:fs";
config({path:[".env.local",".env"],quiet:true});
const path="test-results/demo-fixture.json",tokenPath="test-results/demo-case-token.txt";
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:1});
try{
 if(process.argv[2]==="cleanup"){
  const fixture=JSON.parse(readFileSync(path,"utf8"));
  const {rows}=await pool.query("SELECT count(*)::int AS count FROM advocacy_outreach_actions WHERE case_id=$1",[fixture.caseId]);
  if(rows[0].count)throw Error("Outreach receipts exist; reconcile rather than deleting this case");
  await pool.query("DELETE FROM advocacy_cases WHERE id=$1 AND owner_id=$2",[fixture.caseId,fixture.owner]);
  if(existsSync(tokenPath))unlinkSync(tokenPath);fixture.cleaned=true;writeFileSync(path,JSON.stringify(fixture,null,2),{mode:0o600});
  console.log("Demo fixture cleaned");
 }else{
  if(existsSync(path))throw Error("A demo fixture record exists. Inspect it before preparing another.");
  const owner=process.env.CREW_ALLOWED_USER_IDS?.split(",").filter(Boolean)[0];if(!owner)throw Error("Approved operator required");
  const caseId=randomUUID(),token=`assurance_case_${randomBytes(32).toString("base64url")}`;
  mkdirSync("test-results",{recursive:true});writeFileSync(path,JSON.stringify({caseId,owner,prepared:false}),{mode:0o600});writeFileSync(tokenPath,token,{mode:0o600});
  await pool.query("BEGIN");
  await pool.query("INSERT INTO advocacy_cases(id,owner_id,title,notes) VALUES($1,$2,'Assurance direct-model demo','Fictional workplace chemical burn at Demo Pharma. No real person, policy, insurer, or medical record. No outreach permission has been granted.')",[caseId,owner]);
  await pool.query("INSERT INTO advocacy_case_tool_credentials(case_id,token_hash,issued_by,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[caseId,createHash("sha256").update(token).digest("hex"),owner]);
  await pool.query("COMMIT");writeFileSync(path,JSON.stringify({caseId,owner,prepared:true}),{mode:0o600});
  console.log(`Prepared synthetic case. Run:\nDEMO_CASE_ID=${caseId} DEMO_CASE_TOKEN_FILE=${tokenPath} npx tsx scripts/demo/run.ts`);
 }
}finally{await pool.end();}
