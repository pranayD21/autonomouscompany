/** Coalesce dashboard authentication reads; never cache a rejected request. */
export function sessionCache<T>(load:(key:string)=>Promise<T>,ttlMs=60000){
 let entry:{key:string;expires:number;value:Promise<T>}|undefined;
 return {clear(){entry=undefined;},get(key:string){
  if(entry?.key===key&&entry.expires>Date.now())return entry.value;
  const value=load(key);const current={key,expires:Date.now()+ttlMs,value};entry=current;
  void value.catch(()=>{if(entry===current)entry=undefined;});return value;
 }};
}
