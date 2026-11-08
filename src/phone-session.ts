import {sessionCache} from './session-cache';
import {useEffect,useState} from 'react';
const key='assurance-phone-session';
const modeKey='assurance-auth-mode';
// Every tab shares the phone login, so a new tab cannot fall back to an older saved account.
for(const name of [key,modeKey]){const saved=sessionStorage.getItem(name);if(saved&&!localStorage.getItem(name))localStorage.setItem(name,saved);sessionStorage.removeItem(name);}
export const phoneSelected=()=>localStorage.getItem(modeKey)==='phone';
export const phoneBase=()=>new URL(import.meta.env.VITE_CASES_API_URL).origin.replace('-cases.compute.','-phone.compute.');
export const hasPhoneSession=()=>!!localStorage.getItem(key);
const signal=()=>{cachedSession.clear();window.dispatchEvent(new Event('assurance-phone-session'));};
export function selectEmailSession(){localStorage.removeItem(modeKey);signal();}
async function phoneRequest(path:string,body?:unknown){
 const token=localStorage.getItem(key);const r=await fetch(`${phoneBase()}/auth${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:'omit'});
 const data=await r.json();if(!r.ok)throw Error(data.message??data.error??'Phone sign-in is unavailable.');return data;
}
export async function sendPhoneCode(phoneNumber:string){await phoneRequest('/phone-number/send-otp',{phoneNumber});}
export async function verifyPhoneCode(phoneNumber:string,code:string){const data=await phoneRequest('/phone-number/verify',{phoneNumber,code});if(typeof data.token!=='string')throw Error('Phone sign-in did not create a session.');localStorage.setItem(key,data.token);localStorage.setItem(modeKey,'phone');signal();}
const cachedSession=sessionCache(async(token:string)=>{
 const data=await phoneRequest('/get-session');
 if(localStorage.getItem(key)!==token)return null;
 if(!data?.user){localStorage.removeItem(key);localStorage.removeItem(modeKey);return null;}
 const jwt=await phoneRequest('/token');if(!jwt.token)throw Error('Phone session could not be verified.');
 if(localStorage.getItem(key)!==token)return null;
 return {...data,user:{...data.user,id:data.user.linkedOwnerId??`phone:${data.user.id}`},session:{...data.session,token:jwt.token}};
});
export async function phoneSession(){
 const token=localStorage.getItem(key);return token?cachedSession.get(token):null;
}
export async function endPhoneSession(){try{await phoneRequest('/sign-out',{});}finally{localStorage.removeItem(key);localStorage.removeItem(modeKey);signal();}}
export function usePhoneSession(){
 const [state,setState]=useState<{data:Awaited<ReturnType<typeof phoneSession>>;pending:boolean;error:Error|null}>({data:null,pending:phoneSelected()&&hasPhoneSession(),error:null});
 useEffect(()=>{let active=true;const load=()=>{if(!phoneSelected()||!hasPhoneSession()){setState({data:null,pending:false,error:null});return;}phoneSession().then(data=>{if(active)setState({data,pending:false,error:null});}).catch(error=>{if(active)setState({data:null,pending:false,error:error instanceof Error?error:new Error('Could not load your session. Please reload.')});});};load();window.addEventListener('assurance-phone-session',load);return()=>{active=false;window.removeEventListener('assurance-phone-session',load);};},[]);return state;
}
