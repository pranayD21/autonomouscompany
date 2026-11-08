// Renames existing cases with long or generic titles. Prints a plan unless run with --apply. Test fixtures are skipped.
import {config} from 'dotenv';
import {Pool} from 'pg';
import {descriptiveCaseTitle} from '../backend/case-title';
config({path:'.env.local',quiet:true});
const apply=process.argv.includes('--apply');
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace('sslmode=require','sslmode=verify-full')});
try{
 const {rows}=await pool.query(`SELECT id,title,coalesce(nullif(intake->>'injury_description',''),notes,'') AS description FROM advocacy_cases
  WHERE (length(title)>40 OR title IN ('Workplace injury','Health insurance claim')) AND title !~ '^(QA TEST|Synthetic|Fictional)'`);
 for(const row of rows){
  const title=await descriptiveCaseTitle(row.description,row.title);
  if(title===row.title){console.log(JSON.stringify({id:row.id.slice(0,8),unchanged:true}));continue;}
  // A rename changes no evidence, so it does not bump the revision or wake the advocate.
  if(apply)await pool.query('UPDATE advocacy_cases SET title=$2 WHERE id=$1 AND title=$3',[row.id,title,row.title]);
  console.log(JSON.stringify({id:row.id.slice(0,8),title,applied:apply}));
 }
}finally{await pool.end();}
