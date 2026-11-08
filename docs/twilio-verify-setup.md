# Twilio Verify service setup

`scripts/configure-twilio-verify.ts` configures the Verify service for phone login. New advocacy voice calls continue using AgentPhone. This script does not send verification codes, buy a number, or configure voice routing.

Private `.env.local` supplies `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`; the script saves `TWILIO_VERIFY_SERVICE_SID` there after verification. It preserves other entries and the file's permissions, writes through an atomic replacement, and prints only a status summary without credentials or account/service IDs.

Run `npx tsx scripts/configure-twilio-verify.ts` for a read-only plan. It reads the active account and all Verify service pages, looks for the exact name `Assurance`, and verifies an existing service's account, name, and six-digit code setting. Multiple matches, a configured SID that disagrees with the match, malformed responses, and unexpected pagination stop setup.

Run `npx tsx scripts/configure-twilio-verify.ts --apply` to save the verified existing service or create one when none exists. Creation sets `FriendlyName=Assurance` and `CodeLength=6`; setup never changes an existing service's settings. A private `.env.local.verify-creation-pending` marker precedes creation. If a request fails ambiguously, inspect the account before another attempt. A subsequent matching-service readback allows `--apply` to save the service and clear the marker; an absent service with an unresolved marker blocks another create.

The example configuration adds `PHONE_LOGIN_ENABLED`, `PHONE_SMS_PROVIDER`, `PHONE_TEST_NUMBERS`, and `PHONE_TEST_CODE` without private values. These runtime settings belong to the phone-login implementation. A configured service alone does not prove SMS delivery or enable phone login.

Implementation follows Twilio's [Verify Services API](https://www.twilio.com/docs/verify/api/service). TypeScript passed after adding the script. No live setup request or verification text was sent during implementation.
