# Mac Messages delivery bridge

The optional bridge connects the existing phone-notification outbox to a selected Messages account on a Mac. AgentPhone remains the voice provider, and Twilio Verify continues to send login codes. Apple Messages acceptance is recorded as `submitted`, never as verified recipient delivery. `PHONE_FLOW_ENABLED=false` keeps this path off; it is outside the customer journey.

## Hosted interface

`backend/mac-messages-bridge.ts` is mounted by `backend/phone-worker.ts` at `/mac-bridge`. All routes require an exact Bearer token matching server-only `MAC_MESSAGES_BRIDGE_TOKEN` (at least 32 characters) and `MAC_MESSAGES_BRIDGE_ENABLED=true` with `PHONE_NOTIFICATION_PROVIDER=mac_messages`.

- `POST /heartbeat`: `{ready,transport,sender_label}`. Transport (`sms` or `imessage`) and label must match configured values. Readiness expires after 90 seconds.
- `POST /claim`: reserves one eligible existing notification and returns `{job:{id,attempt_id,to,body,transport}}`, or `{job:null}`. It also requires `PHONE_FLOW_ENABLED=true` and a fresh ready heartbeat.
- `POST /receipt`: `{id,attempt_id,state,provider_id?,reason?}`. States are `submitted`, `unknown`, or a definite pre-send `failed`. The exact attempt binding is required; conflicting terminal receipts are rejected.
- `POST /inbound`: `{event_id,from,text,received_at,thread?}`. A known previously contacted recipient is required. Duplicate IDs are checked against a payload hash.

Migration 0025 adds `advocacy_mac_bridge_status`, `advocacy_mac_bridge_deliveries`, and `advocacy_mac_bridge_inbound`. The existing notification rows remain the source of queued work. Delivery records hold the attempted destination and transport, not bridge credentials.

## Authorization and failure behavior

Claim checks current text consent, the optional rollout list, fictional-number exclusions, intake expiry, and active case authority where a case exists. Stopped cases cannot generate new sends. A claim is an in-flight reservation: a later stop may race with a command already passed to Messages. The Mac provider selection prevents the AgentPhone dispatcher from also sending those rows.

Every notification has at most one bridge attempt. A missing receipt after two minutes becomes `unknown` and is never requeued. Unknown work blocks that recipient, while unrelated recipients can still progress. The same attempt's durable local receipt can reconcile an overdue unknown. A successful AppleScript command is not a carrier delivery receipt.

Replies are accepted only after a submitted bridge notification to that phone and after its claim timestamp, within a 30-day association window. Multiple eligible cases for the same recipient are held as ambiguous; the service does not guess which case a text refers to. Untracked senders are ignored without storing their contents. STOP and equivalent keywords revoke case-text consent and cancel queued notifications. A later ordinary reply does not re-enable consent.

An accepted reply advances case revision and queues a `phone_reply` event. `case_get` supplies retained messages marked `unverified_message_from_linked_phone`; `/phone/messages` exposes them only to the case owner. They are observations, not new authority, proof of identity, or verified medical facts. Owner-help/uncertain states are not automatically cleared by a text. The existing signed-in answer path still handles those interventions.

## Configuration and readiness

`neon.ts` declares bridge credentials only on the phone Function. The cases Function receives only the notification-provider selector so it cannot accidentally dispatch an AgentPhone fallback. The public phone `/status` reports the notification provider and readiness without exposing the sender label, token, or account ID. Its existing `smsReady` field still describes login-code readiness.

`configure-inbound-phone.ts` uses hosted notification readiness for the Mac provider before applying AgentPhone webhook routing. It does not bypass readiness or alter the voice provider. Merely deploying bridge code does not enable inbound calls or any texts.

The Mac process and its private configuration are described in [mac-messages-local.md](mac-messages-local.md); test coverage is in [mac-messages-tests.md](mac-messages-tests.md). Keep the Mac online and signed into Messages. Real SMS requires working iPhone forwarding; account detection alone is not delivery proof.

The user selected the Mac's existing sender for this bridge. Terminal and T3 Code have user-approved Full Disk Access, and the bridge check passes automation, selected account, database, and configuration readiness. The bridge API remains enabled, but `PHONE_FLOW_ENABLED=false` keeps the hosted notification queue and inbound routing disabled.

One explicitly authorized local transport test used the bridge's durable send-once handler and selected SMS account. AppleScript returned `submitted`, but the user reported no delivery. The narrowly scoped Messages database status showed `is_sent=0`, `is_delivered=0`, and `error=4`. The meaning of that error has not been established. No automatic retry occurred. This test did not claim a hosted queue item or prove hosted reply ingestion. The private receipt and journal remain ignored under `test-results/mac-messages/`.

Hosted readback previously verified the bridge selector, existing login readiness, anonymous401, and authenticated no-job result while delivery was disabled.
