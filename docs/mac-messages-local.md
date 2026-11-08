# Local Mac Messages bridge

`scripts/mac-messages/bridge.ts` connects the hosted phone-notification queue to the Mac's Messages app. It sends through an explicitly selected SMS or iMessage account; it does not send from the AgentPhone number unless that number is actually registered to the selected Apple account. Twilio Verify login remains separate.

The bridge is a foreground process. The Mac must stay awake, signed into Messages, and online. For carrier SMS, the linked iPhone and its text-message forwarding must work. A successful AppleScript return means Messages accepted the send command, not that the recipient received it.

## Files and configuration

- `bridge.ts`: authenticated polling, private journal, crash recovery, receipts, and reply forwarding.
- `messages.applescript`: static account checks and send command. Recipient and message are arguments, never AppleScript source or shell commands.
- `read-replies.py`: read-only SQLite access limited to tracked direct-message recipients and service after their pre-send watermark.
- `bridge.test.ts` and `replies.test.ts`: fake-transport send/recovery checks and a disposable SQLite reply fixture.

The runner reads ignored `.env.bridge.local`. Keep it mode 0600; never add its values to Git. Required entries for running are:

```dotenv
MAC_MESSAGES_BRIDGE_URL=https://YOUR-PHONE-FUNCTION/mac-bridge
MAC_MESSAGES_BRIDGE_TOKEN=SERVER-ISSUED-PRIVATE-BRIDGE-TOKEN
MAC_MESSAGES_SERVICE_ID=EXPLICIT-MESSAGES-ACCOUNT-ID
MAC_MESSAGES_TRANSPORT=sms
MAC_MESSAGES_SENDER_LABEL=THE-ACTUAL-CONFIGURED-SENDER
MAC_MESSAGES_SENDER_CONFIRMED=true
```

`MAC_MESSAGES_TRANSPORT` is `sms` or `imessage`. The label and transport must match the hosted bridge configuration. The sender label is an operator confirmation, not an automatic proof of which phone number Apple uses. Check Messages settings and the linked iPhone before confirming it. The scripting dictionary exposes account IDs but not a reliable sending-phone-number field. Account IDs can be inspected locally with Messages' AppleScript account properties; do not post those identities in logs or chat.

Optional `MAC_MESSAGES_JOURNAL` changes the default ignored `test-results/mac-messages/journal.json`. Any alternate directory must be private and excluded from version control. `MAC_MESSAGES_DB_PATH` selects an alternate database for controlled testing; normal operation uses `~/Library/Messages/chat.db`.

## Commands

From the repository root:

```sh
npx tsx scripts/mac-messages/bridge.ts --check
npx tsx --test scripts/mac-messages/*.test.ts
npx tsx scripts/mac-messages/bridge.ts --run --once
npx tsx scripts/mac-messages/bridge.ts --run
```

Default invocation is the same as `--check`. It reports only readiness booleans and account-type counts, performs no sends, and makes no backend requests. AppleScript checks have a 15-second timeout. SQLite checks have a 10-second timeout. A readiness failure must be resolved locally; the code never changes system permissions or logs into an Apple account.

`--run --once` processes existing recovery receipts, checks readiness, forwards eligible replies, and claims at most one queued notification. It **can send**. Continuous mode repeats every five seconds. Ctrl-C stops the loop and marks the bridge unavailable. Configure the backend and sender identity before running either command.

macOS may require the app/terminal launching the runner to have **Privacy & Security → Automation → Messages** permission and **Full Disk Access** for reading replies. Grant those through System Settings yourself; no code edits the privacy database. Database access is required before the bridge reports ready or claims a send, because replies and STOP must be observable.

## Retry and delivery behavior

Each hosted notification ID and attempt ID has one private journal entry. The runner saves the recipient watermark and send reservation atomically, fsyncs it, and only then calls Messages. It never automatically sends that notification ID twice, even if the backend presents a different attempt ID.

A surviving reservation without a receipt becomes `unknown` on restart. An AppleScript exception or timeout also becomes `unknown`; Messages might have accepted the command before the failure. Neither condition is retried automatically. A successful command produces `submitted`, without inventing a carrier delivery receipt or provider message ID. If the receipt POST fails, restart sends the same receipt again but does not send the text again.

An exclusive `.lock` file prevents two local runners. After a crash, verify that the recorded process is no longer running before removing a stale lock. Preserve the journal and reconcile unknown entries; deleting the journal to force a resend defeats duplicate protection.

## Replies and privacy boundary

The reader does not enumerate conversations or copy the Messages database. Before a recipient's first notification attempt, it records the global message ROWID watermark without reading message bodies. Later queries select only incoming messages from that exact E.164 recipient, the configured SMS/iMessage service, after that watermark, and in a one-recipient chat. Group messages, outgoing messages, reactions, earlier history, and other recipients are excluded.

Successful inbound ingestion advances that recipient's cursor after the server acknowledges the event. Event IDs hash the service and Apple message GUID, so a lost acknowledgement can be retried without duplicate ingestion. Replies are untrusted observations; they do not themselves become new permission. The hosted service controls case association and STOP handling.

This initial reader supports plain-text values in the Messages database. It does not decode Apple's attributed-only text archives or attachments. Encountering such a message stops the bridge for manual review without advancing the cursor or pretending the message was received. Sharing a personal Messages account with a business bridge still means new direct messages from a tracked recipient may belong to the same conversation; a dedicated sender account/device is preferable.

## Verification and live limitations

Nine local tests passed: send-once reservation, repeated claims, lost receipt retry, crash recovery, uncertain AppleScript outcome, conflicting notification attempts, malformed recipient rejection, private atomic journal writes, HTTPS/no-redirect API transport, and the scoped SQLite reader (several assertions share a test). TypeScript passed.

Read-only inspection of this Mac found the installed Messages scripting dictionary includes SMS, iMessage, and RCS account types and a send command. The first AppleEvent query returned error -10000; a later `--check` succeeded and reported one SMS and one iMessage account. No account ID, sender address, recipient, or message contents were printed. The Messages database exists, but read-only open was denied. The final check reported `automation=true`, `database=false`, `selectedReady=false`, `configured=false`, and zero sends.

The user subsequently selected the existing Mac sender. The single enabled SMS service was saved privately in `.env.bridge.local`; selectedReady and configured are now true. The user reported enabling Full Disk Access, but the running helper still reports database=false. Its process ancestry is CodexCLI (inside ChatGPT) under T3 Code (Beta); a permission grant to the responsible app and process restart may be required. No bridge service was installed and no live message was sent. These tests do not prove carrier forwarding, recipient delivery, or live reply ingestion. The operating-system access and explicit sender configuration must be completed before this machine can become a working delivery bridge.
