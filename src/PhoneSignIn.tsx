import {useEffect,useState,type FormEvent} from 'react';
import {auth} from './services';
import {requestOnboardingCall} from './phone-onboarding';
import {sendPhoneCode,verifyPhoneCode,phoneSession,endPhoneSession,phoneBase} from './phone-session';
export type PhoneStatus={enabled:boolean;smsReady:boolean;onboardingEnabled:boolean;testNumbers:string[];testCode:string|null};
export function usePhoneStatus(){
 const [status,setStatus]=useState<PhoneStatus|null>(null);
 useEffect(()=>{let active=true;fetch(`${phoneBase()}/status`).then(async response=>{
  if(!response.ok)throw Error('Phone status unavailable');const data=await response.json();
  if(active)setStatus({enabled:data.enabled===true,smsReady:data.smsReady===true,onboardingEnabled:data.onboardingEnabled===true,testNumbers:Array.isArray(data.testNumbers)?data.testNumbers.filter((n:unknown)=>typeof n==='string'&&/^\+1[2-9]\d{2}55501\d{2}$/.test(n)):[],testCode:typeof data.testCode==='string'&&/^\d{6}$/.test(data.testCode)?data.testCode:null});
 }).catch(()=>{if(active)setStatus({enabled:false,smsReady:false,onboardingEnabled:false,testNumbers:[],testCode:null});});return()=>{active=false;};},[]);
 return status;
}
export function toE164(input:string){
 const trimmed=input.trim();if(!/^[+\d\s().-]+$/.test(trimmed))throw Error('Enter a valid phone number, including its country code outside the US.');
 const digits=trimmed.replace(/\D/g,'');
 const normalized=trimmed.startsWith('+')?`+${digits}`:digits.length===10?`+1${digits}`:digits.length===11&&digits.startsWith('1')?`+${digits}`:'';
 if(!/^\+[1-9]\d{7,14}$/.test(normalized))throw Error('Enter a valid phone number, including its country code outside the US.');return normalized;
}
export function PhoneSignIn({linkExisting=false,status}:{linkExisting?:boolean;status:PhoneStatus}){
 const [phone,setPhone]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const tests=status.enabled&&status.testCode?status.testNumbers:[];
 const fictional=(number:string)=>/^\+1[2-9]\d{2}55501\d{2}$/.test(number);
 const fictionalInput=/^1?[2-9]\d{2}55501\d{2}$/.test(phone.replace(/\D/g,''));
 const callReady=!linkExisting&&status.enabled&&status.smsReady&&status.onboardingEnabled===true&&!fictionalInput;
 const submitLabel=sent?(linkExisting?'Verify and link phone':callReady?'Verify and call me':'Verify and open dashboard'):callReady?'Verify and call me':status.smsReady?'Text me a sign-in code':'Get a test sign-in code';
 async function finish(number:string,verification:string,allowCall=true){
  const prior=linkExisting?await auth.getSession():null;await verifyPhoneCode(number,verification);
  if(linkExisting){try{const proof=await phoneSession();const r=await fetch(`${import.meta.env.VITE_CASES_API_URL}/phone/link`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${prior?.data?.session.token}`},body:JSON.stringify({phone_token:proof?.session.token})});if(!r.ok)throw Error((await r.json()).error??'Unable to link phone.');}catch(e){await endPhoneSession();throw e;}}
  if(allowCall&&!linkExisting&&status.onboardingEnabled===true&&status.smsReady&&!fictional(number)&&!tests.includes(number)){await requestOnboardingCall();}
  window.location.assign('/#workspace');
 }
 async function submit(e:FormEvent){e.preventDefault();if(!status.enabled)return;setBusy(true);setError('');try{
  const number=toE164(phone);if(!status.smsReady&&!tests.includes(number))throw Error('Live SMS is not available yet. Choose a fictional test number below.');
  if(!sent){await sendPhoneCode(number);setPhone(number);setSent(true);}else await finish(number,code);
 }catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');}finally{setBusy(false);}}
 async function useTestNumber(number:string){setBusy(true);setError('');try{await sendPhoneCode(number);await finish(number,status.testCode!,false);}catch(e){setError(e instanceof Error?e.message:'Unable to open the test account.');}finally{setBusy(false);}}
 return <section aria-label="Phone sign-in"><h2>{linkExisting?'Link your phone':'Start with your phone'}</h2>
 <p role="status">{!status.enabled?'Phone sign-in is not available yet. Use email sign-in to continue.':status.smsReady?(callReady?'Verify your number and Assurance will call to hear what happened.':linkExisting?'Verify this number to link it to your account.':fictionalInput?'This is a fictional number. No onboarding call will be requested.':'Onboarding calls are unavailable right now. You can still sign in with your phone and use your dashboard.'):tests.length?'Live SMS is not available yet. Only the fictional test numbers below work right now.':'Phone sign-in is waiting for SMS service. Use email sign-in to continue.'}</p>
 <form onSubmit={submit}><label>Phone number<input type="tel" autoComplete="tel" placeholder="(415) 555-0100" value={phone} onChange={e=>setPhone(e.target.value)} required disabled={sent||busy}/></label>{sent&&<label>Verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required/></label>}<button disabled={busy||!status.enabled||(!status.smsReady&&!tests.length)}>{busy?'Please wait…':submitLabel}</button></form>
 {status.smsReady&&<p className="demo-note">We’ll send a sign-in code by text. {callReady&&<>After you verify, you’re asking Assurance’s AI advocate to call this number for onboarding. </>}Message and data rates may apply.</p>}
 {callReady&&<p className="demo-note">Verifying also asks Assurance to research your case, contact relevant organizations, submit claim forms and evidence, and follow up on your behalf. You can stop agent work anytime.</p>}

 {sent&&<><p>{tests.includes(phone)?`Fictional test code: ${status.testCode}`:'Enter the code sent to your phone.'}</p><button className="text-button" disabled={busy} onClick={()=>{setSent(false);setCode('');}}>Use a different number or request a new code</button></>}
 {!!tests.length&&<div className="test-numbers"><h3>Shared test accounts</h3><p>Shared accounts for fictional records. No text or onboarding call is sent.</p><div>{tests.map(number=><button type="button" className="secondary" key={number} disabled={busy} onClick={()=>void useTestNumber(number)}>{number}</button>)}</div></div>}
 {error&&<p role="alert">{error}</p>}</section>;
}
