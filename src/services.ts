import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import type { BillCase } from "../backend/schema";

export const auth = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() });
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
    headers: { "Content-Type": "application/json", ...options.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}
export const sealCases = (userId: string) => api<SealedLiveQuery<BillCase>>("/cases/live", { method: "POST" }, userId);
