import {Hono} from 'hono';
/** Controlled test portal: never an insurer and never a verified claim outcome. */
export function fictionalClaimPortal(){
 const app=new Hono(),receipts=new Map<string,string>();
 app.get('/',c=>c.html(`<!doctype html><html><head><title>Fictional claim portal</title></head><body><h1>Fictional claim submission</h1><p>This fixture sends nothing to an insurer.</p><form method="post" action="/submit"><label>Reference <input name="reference" id="reference" required></label><label>Incident account <textarea name="account" id="account" required></textarea></label><button id="submit">Submit fictional claim</button></form></body></html>`));
 app.post('/submit',async c=>{const form=await c.req.parseBody();const ref=String(form.reference??'');if(!/^[A-Za-z0-9_-]{1,100}$/.test(ref))return c.text('Invalid reference',400);const receipt=receipts.get(ref)??`FICTIONAL-${crypto.randomUUID()}`;receipts.set(ref,receipt);return c.html(`<h1>Fictional submission recorded</h1><p id="confirmation">${receipt}</p><p>No insurer received this and no payout is represented.</p>`);});return app;
}
