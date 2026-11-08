import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {attachDatabasePool} from "@neon/functions";
import {caseTools} from "./case-tools";
import {caseToolServices} from "./case-tool-service";
const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:3,connectionTimeoutMillis:15000,query_timeout:30000});attachDatabasePool(pool);
export default caseTools(caseToolServices(drizzle(pool)));
