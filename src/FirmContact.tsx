import {useEffect,useState} from 'react';
export function FirmContact(){
 const [email,setEmail]=useState<string|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch(`${import.meta.env.VITE_CASES_API_URL}/firm/contact`,{signal:controller.signal}).then(async response=>{if(!response.ok)return;const data=await response.json();if(typeof data.email==='string'&&data.email.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email))setEmail(data.email);}).catch(()=>{});return()=>controller.abort();},[]);
 if(!email)return null;
 return <p className="firm-contact">Prefer email? Send your account of what happened and any supporting documents to <a href={`mailto:${email}`}>{email}</a>. Your advocate will follow up by email, and your case will also be available here.</p>;
}
