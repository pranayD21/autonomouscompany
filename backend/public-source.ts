import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import {request} from "node:https";
import {createHash} from "node:crypto";
import ipaddr from "ipaddr.js";
import {load} from "cheerio";
import {readPdfText} from "./providers/document-reader";
import {normalizeEvidenceText} from "./research";
export function publicAddress(address:string){
 try{return ipaddr.process(address).range()==="unicast";}catch{return false;}
}
export function sourceUrl(raw:string){
 const url=new URL(raw);const host=url.hostname.replace(/^\[|\]$/g,"").replace(/\.$/,"").toLowerCase();
 if(url.protocol!=="https:"||url.username||url.password||url.hash||(url.port&&url.port!=="443")||!host.includes(".")&&!isIP(host)||/^(localhost)$|\.(localhost|local|internal|test|invalid)$/.test(host))throw Error("SOURCE_URL_REJECTED");
 if(isIP(host)&&!publicAddress(host))throw Error("SOURCE_ADDRESS_REJECTED");
 return url;
}
type Hop={status:number;location?:string;mime:string;bytes:Buffer};
export type SourceTransport={resolve:(host:string)=>Promise<{address:string;family:number}[]>;read:(url:URL,address:{address:string;family:number},signal:AbortSignal)=>Promise<Hop>};
const transport:SourceTransport={resolve:host=>lookup(host,{all:true}),read:(url,address,signal)=>new Promise((resolve,reject)=>{
 const host=url.hostname.replace(/^\[|\]$/g,"");
 // Connect to the validated IP, while retaining the original host for TLS and HTTP.
 const req=request({hostname:address.address,port:443,servername:isIP(host)?undefined:host,path:url.pathname+url.search,method:"GET",agent:false,signal,
  headers:{Host:url.host,Accept:"text/html, application/pdf, text/plain","Accept-Encoding":"identity","User-Agent":"AssuranceResearch/1.0"}},res=>{
  if(res.headers["content-encoding"]&&res.headers["content-encoding"]!=="identity"){res.destroy();reject(Error("SOURCE_ENCODING_UNSUPPORTED"));return;}
  const chunks:Buffer[]=[];let length=0;
  res.on("data",chunk=>{length+=chunk.length;if(length>2*1024*1024){res.destroy(Error("SOURCE_TOO_LARGE"));return;}chunks.push(chunk);});
  res.on("error",reject);res.on("end",()=>resolve({status:res.statusCode??0,location:res.headers.location,mime:String(res.headers["content-type"]??"").split(";")[0].toLowerCase(),bytes:Buffer.concat(chunks)}));
 });req.on("error",reject);req.end();
})};
async function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 signal.throwIfAborted();let listener:()=>void=()=>{};
 try{return await Promise.race([promise,new Promise<never>((_resolve,reject)=>{listener=()=>reject(Error("SOURCE_TIMEOUT"));signal.addEventListener("abort",listener,{once:true});})]);}finally{signal.removeEventListener("abort",listener);}
}
async function retrievePublicSource(raw:string,quote:string|undefined,io:SourceTransport=transport){
 let url=sourceUrl(raw);const signal=AbortSignal.timeout(15000);const visited=new Set<string>();
 const normalizedQuote=quote===undefined?undefined:normalizeEvidenceText(quote);if(normalizedQuote!==undefined&&(normalizedQuote.length<12||normalizedQuote.split(" ").length>25))throw Error("SOURCE_QUOTE_SIZE");
 for(let redirects=0;redirects<=4;redirects++){
  signal.throwIfAborted();if(visited.has(url.href))throw Error("SOURCE_REDIRECT_LOOP");visited.add(url.href);
  const host=url.hostname.replace(/^\[|\]$/g,"");const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await abortable(io.resolve(host),signal);
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error("SOURCE_ADDRESS_REJECTED");
  const response=await abortable(io.read(url,addresses[0],signal),signal);
  if([301,302,303,307,308].includes(response.status)){
   if(!response.location||redirects===4)throw Error("SOURCE_REDIRECT_LIMIT");url=sourceUrl(new URL(response.location,url).href);continue;
  }
  if(response.status!==200)throw Error("SOURCE_HTTP_FAILURE");if(response.bytes.length>2*1024*1024)throw Error("SOURCE_TOO_LARGE");
  let text:string,title:string=url.hostname;const links:{title:string;url:string}[]=[];
  if(response.mime==="application/pdf")text=normalizeEvidenceText(await readPdfText(new Uint8Array(response.bytes)));
  else if(response.mime==="text/plain")text=normalizeEvidenceText(response.bytes.toString("utf8"));
  else if(response.mime==="text/html"){
   const $=load(response.bytes.toString("utf8"));
   $("a[href]").each((_index,element)=>{if(links.length>=50)return;try{const target=new URL($(element).attr("href")!,url);target.hash="";const valid=sourceUrl(target.href);if(!links.some(link=>link.url===valid.href))links.push({title:normalizeEvidenceText($(element).text()).slice(0,200),url:valid.href});}catch{}});
   title=$("title").text().trim().slice(0,300)||title;$("script,style,nav,header,footer,form,iframe,noscript,svg").remove();
   const main=$("main,article,#main-content").first();const root=main.length?main:$("body");root.find("br,p,li,h1,h2,h3,h4,div,section").append(" ");text=normalizeEvidenceText(root.text());
  }else throw Error("SOURCE_TYPE_UNSUPPORTED");
  if(text.length<12||text.length>100000)throw Error("SOURCE_TEXT_SIZE");
  if(normalizedQuote!==undefined&&!text.includes(normalizedQuote))throw Error("SOURCE_QUOTE_NOT_FOUND");
  return {requested_url:raw,url:url.href,title,text,links,quote:normalizedQuote,sha256:createHash("sha256").update(text).digest("hex"),retrieved_at:new Date().toISOString()};
 }
 throw Error("SOURCE_UNAVAILABLE");
}

export async function fetchPublicSource(raw:string,quote:string,io:SourceTransport=transport){
 const {links,...source}=await retrievePublicSource(raw,quote,io);return {...source,quote:source.quote!};
}
// Read before citing: this is untrusted public information, not saved case evidence.
export async function readPublicSource(raw:string,offset=0,io:SourceTransport=transport){
 const source=await retrievePublicSource(raw,undefined,io);
 return {url:source.url,title:source.title,sha256:source.sha256,retrieved_at:source.retrieved_at,
  text:source.text.slice(offset,offset+16000),links:source.links,offset,next_offset:offset+16000<source.text.length?offset+16000:null,
  trust:"untrusted_public_source",instruction:"Use cite_source with a short exact quote to save evidence. Public guidance does not establish applicability or coverage."};
}
