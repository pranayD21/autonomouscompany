import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import {phoneSelected,hasPhoneSession,phoneSession,endPhoneSession,usePhoneSession} from "./phone-session";
import type { BillCase } from "../backend/schema";

const managedAuth = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() });
export const auth = {
 signUp:managedAuth.signUp,
 clearManagedSession:()=>managedAuth.signOut(),
 signIn:managedAuth.signIn,
 getSession:async()=>phoneSelected()?{data:await phoneSession(),error:null}:managedAuth.getSession(),
 signOut:async()=>{if(phoneSelected()){await endPhoneSession();return {error:null};}return managedAuth.signOut();},
 useSession:()=>{const managed=managedAuth.useSession();const phone=usePhoneSession();return phoneSelected()||phone.pending?{data:phone.data,isPending:phone.pending,error:phone.error}:managed;},
};
export const realtime = createRealtimeClient({ url: import.meta.env.VITE_NEON_REALTIME_URL });

export async function api<T>(path: string, options: RequestInit = {}, expectedUser?: string): Promise<T> {
  const session = await auth.getSession();
  if (!session.data?.user || (expectedUser && session.data.user.id !== expectedUser)) {
    window.location.assign("/");
    throw new Error("Your session changed. Please sign in again.");
  }
  const token = session.data.session.token;
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${import.meta.env.VITE_CASES_API_URL}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : {"Content-Type": "application/json"}), ...options.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  const changed = (options.method ?? "GET") !== "GET" ? path.match(/^\/cases\/([\w-]+)/) : null;
  if (changed) window.dispatchEvent(new CustomEvent("assurance:case-changed", {detail: changed[1]}));
  return body as T;
}
export const sealCases = (userId: string) => api<SealedLiveQuery<BillCase>>("/cases/live", { method: "POST" }, userId);
