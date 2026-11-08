import {useEffect,useState} from 'react';
const key='assurance-phone-session';
const modeKey='assurance-auth-mode';
export const phoneSelected=()=>sessionStorage.getItem(modeKey)==='phone';
export const phoneBase=()=>new URL(import.meta.env.VITE_CASES_API_URL).origin.replace('-cases.compute.','-phone.compute.');
export const hasPhoneSession=()=>!!sessionStorage.getItem(key);
const signal=()=>window.dispatchEvent(new Event('assurance-phone-session'));
async function phoneRequest(path:string,body?:unknown){
 const token=sessionStorage.getItem(key);const r=await fetch(`${phoneBase()}/auth${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),credentials:'omit'});
 const data=await r.json();if(!r.ok)throw Error(data.message??data.error??'Phone sign-in is unavailable.');return data;
}
export async function sendPhoneCode(phoneNumber:string){await phoneRequest('/phone-number/send-otp',{phoneNumber});}
export async function verifyPhoneCode(phoneNumber:string,code:string){const data=await phoneRequest('/phone-number/verify',{phoneNumber,code});if(typeof data.token!=='string')throw Error('Phone sign-in did not create a session.');sessionStorage.setItem(key,data.token);sessionStorage.setItem(modeKey,'phone');signal();}
export async function phoneSession(){
 if(!hasPhoneSession())return null;
 const data=await phoneRequest('/get-session');if(!data?.user){sessionStorage.removeItem(key);return null;}
 const jwt=await phoneRequest('/token');if(!jwt.token)throw Error('Phone session could not be verified.');
 return {...data,user:{...data.user,id:data.user.linkedOwnerId??`phone:${data.user.id}`},session:{...data.session,token:jwt.token}};
}
export async function endPhoneSession(){try{await phoneRequest('/sign-out',{});}finally{sessionStorage.removeItem(key);sessionStorage.removeItem(modeKey);signal();}}
export function usePhoneSession(){
 const [state,setState]=useState<{data:Awaited<ReturnType<typeof phoneSession>>;pending:boolean;error:Error|null}>({data:null,pending:hasPhoneSession(),error:null});
 useEffect(()=>{let active=true;const load=()=>{if(!hasPhoneSession()){setState({data:null,pending:false,error:null});return;}phoneSession().then(data=>{if(active)setState({data,pending:false,error:null});}).catch(()=>{sessionStorage.removeItem(key);if(active)setState({data:null,pending:false,error:null});});};load();window.addEventListener('assurance-phone-session',load);return()=>{active=false;window.removeEventListener('assurance-phone-session',load);};},[]);return state;
}
