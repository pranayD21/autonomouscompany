import {test} from "node:test";
import assert from "node:assert/strict";
import {NaiveDeferred} from "../backend/providers/naive-capacity";
import {capacityRetryTime,isNaiveCapacityError,isNaiveAdmissionRejected} from "../backend/naive-retry";
test("only explicit capacity rejection or local deferral is retryable as capacity",()=>{
 for(const error of [new NaiveDeferred(5000),{status:429},{status:503}])assert.equal(isNaiveCapacityError(error),true);
 for(const error of [Error("timeout"),{status:401},{status:409},null,"429"])assert.equal(isNaiveCapacityError(error),false);
});
test("retry never precedes the shared cooldown or the deferred request time",()=>{
 const now=100000;
 assert.equal(capacityRetryTime({status:429},new Date(now+3600000),now).getTime(),now+3600000);
 assert.equal(capacityRetryTime(new NaiveDeferred(60000),new Date(now+30000),now).getTime(),now+60000);
 assert.equal(capacityRetryTime({status:429},null,now).getTime(),now+1000);
});

test("503 and network loss never qualify as definitely rejected approval writes",()=>{
 assert.equal(isNaiveAdmissionRejected({status:429}),true);assert.equal(isNaiveAdmissionRejected(new NaiveDeferred(1000)),true);
 assert.equal(isNaiveAdmissionRejected({status:503}),false);assert.equal(isNaiveAdmissionRejected(Error("timeout")),false);
});
