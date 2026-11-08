import {Hono} from "hono";
import {bodyLimit} from "hono/body-limit";
import {Pool} from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {attachDatabasePool} from "@neon/functions";
import {parseTriggerDelivery} from "@neon/functions/triggers";
import {pollCrewReviews} from "./crew-monitor";

const pool=new Pool({connectionString:process.env.DATABASE_URL?.replace("sslmode=require","sslmode=verify-full"),max:3,connectionTimeoutMillis:15000,query_timeout:30000});
attachDatabasePool(pool);
const app=new Hono();
app.use("*",bodyLimit({maxSize:16384}));
app.post("/poll",async c=>{
 const parsed=await parseTriggerDelivery(c.req.raw);
 if(!parsed.ok)return c.json({error:"A verified scheduler delivery is required."},401);
 const invocation=parsed.invocation;
 if(invocation.type!=="schedule"||invocation.trigger.name!=="crew-monitor")return c.json({error:"Unexpected trigger."},403);
 const result=await pollCrewReviews(drizzle(pool),invocation.invocationId);
 console.log("Crew monitor",JSON.stringify({invocationId:invocation.invocationId,...result}));
 return c.json(result);
});
app.onError(()=>Response.json({error:"Review monitoring temporarily unavailable."},{status:503}));
export default app;
