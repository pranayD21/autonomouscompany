import {useState} from 'react';
import {EmailSignIn} from './EmailSignIn';
import {PhoneSignIn,usePhoneStatus} from './PhoneSignIn';

/** Phone is the default; older email accounts remain accessible without linking. */
export function PhoneEntry(){
 const status=usePhoneStatus();
 const [email,setEmail]=useState(false);
 return <div className="phone-entry">
  {email?<EmailSignIn/>:status?<PhoneSignIn status={status}/>:<p role="status">Checking phone sign-in…</p>}
  <button type="button" className="text-button" onClick={()=>setEmail(value=>!value)}>{email?'Use phone sign-in':'Have an older email account? Sign in with email'}</button>
 </div>;
}
