# Phone session recovery

The earlier phone sign-in frontend requested a new JWT for each dashboard API call. Concurrent panels could exhaust the authentication endpoint's rate limit. Its session hook then deleted a valid login token after any error, including a transient 429. A second attempt with the already-consumed SMS code returned invalid OTP.

`src/session-cache.ts` coalesces concurrent requests and caches successful session reads for one minute, within the five-minute JWT lifetime. It keys entries by login token and clears them on session changes. Failed requests are retryable. `src/phone-session.ts` retains the login credential on transient failures and shows an authentication error instead of silently returning the user to code entry. A missing server session still clears local credentials.

Two focused tests in `scripts/session-cache.test.ts` passed: concurrent reads/account changes and recovery after a rejected request. TypeScript passed. Production inspection confirmed the reported phone account was verified and had an active session; a separate hosted request reproduced HTTP 429 at `/auth/token`. No new SMS was sent.

Phone login is the primary entry. The phone-first UI preserves these cache and recovery fixes; dashboard reloads do not request another onboarding call. Session storage retains the login within the current browser tab. Older email accounts remain accessible through an explicit fallback.
