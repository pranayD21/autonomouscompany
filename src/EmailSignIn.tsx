import {useState,type FormEvent} from 'react';
import {auth} from './services';
import {selectEmailSession} from './phone-session';
import {FirmContact} from './FirmContact';
export function EmailSignIn(){
 const [signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);
  const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};
  try{const result=signup?await auth.signUp.email({...credentials,name:String(form.get('name')).trim()}):await auth.signIn.email(credentials);
   if(result.error)throw Error(result.error.message??'Unable to sign in.');selectEmailSession();window.location.replace(`/${window.location.search}#workspace`);
  }catch(error){setError(error instanceof Error?error.message:'Unable to sign in. Please try again.');}finally{setBusy(false);}
 }
 return <section className="auth-card"><h1>{signup?'Create your account.':'Sign in to your cases.'}</h1>
  <p>Use your email to follow your case, message your advocate, and add documents.</p>
  <form onSubmit={submit}>
   {signup&&<label>Name<input name="name" required autoComplete="name" maxLength={100}/></label>}
   <label>Email<input name="email" type="email" required autoComplete="email"/></label>
   <label>Password<input name="password" type="password" required minLength={8} autoComplete={signup?'new-password':'current-password'}/></label>
   <button disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}</button>
  </form>
  {error&&<p role="alert" className="error">{error}</p>}
  <button className="text-button" onClick={()=>{setSignup(!signup);setError('');}}>{signup?'Already have an account? Sign in':'New here? Create an account'}</button>
  <FirmContact/>
 </section>;
}
