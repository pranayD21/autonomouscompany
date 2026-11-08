# Stripe test-only finance

The latest firm plan adds Stripe as a test-mode finance tool. This supersedes the earlier decision to leave payment creation entirely hypothetical. Real fee collection, payment confirmation, settlement, and card collection remain outside the implemented path. An unconfirmed test PaymentIntent is not a payment or revenue.

`backend/firm-finance.ts` exposes `recordFirmTestFee(db, input, request?)` for the company Finance tool. Input names are `operation_id`, `case_id`, `outcome_id`, `fee_rate`, and `reason`. The tool derives the fee from the latest recorded outcome's responsibility reduction; it does not accept an agent-supplied savings amount. It checks current exact supporting quotes, rejects pending/unknown decisions or missing amounts, and verifies original responsibility minus final responsibility matches the reported reduction. This remains an agent-reported outcome, not independent verification of savings or received refunds.

The service reserves one `test_fee` firm record per case/outcome before contacting Stripe. Matching retries, including a new operation ID for the same outcome, reuse that record. Conflicting fee input fails. Uncertain sends remain `unknown` and do not automatically replay. A zero fee records `no_fee` without a provider request.

Only `rk_test_` or `sk_test_` server keys are accepted. The adapter creates an unconfirmed USD PaymentIntent with no payment method, customer information, receipt email, or automatic confirmation. It accepts only a matching test-mode receipt with zero received amount and `requires_payment_method` status. It discards `client_secret`; returned records always retain `paid:false` and zero real revenue. There is no checkout button or card-entry UI. Provider protocol limits, including minimum amounts, can reject creation and must not be bypassed by changing the documented fee.

## Sandbox setup

Created a temporary claimable Stripe sandbox through the official CLI, using pranay.dogra21@gmail.com and an isolated `assurance-hypothetical` profile. It expires November 15, 2026 unless claimed. No existing Stripe profile was overwritten. The claim URL and credentials are private in ignored `test-results/stripe-config.toml`; the creation receipt is also private and ignored. Do not copy these into documentation or logs.

The restricted sandbox test key is stored as `STRIPE_TEST_SECRET_KEY` in ignored, mode-0600 `.env.local`. The key is server-only and must never be exposed to the browser. Deployment must explicitly configure it for the Finance runtime; local presence alone does not establish hosted readiness. `ASSURANCE_PAYMENT_MODE=hypothetical` was an earlier local scope note, not a runtime enforcement flag. The adapter enforces test mode from the key and provider receipt.

Read-only verification succeeded with HTTP 200 on `/v1/products?limit=1` and `/v1/checkout/sessions?limit=1`, both empty lists. The restricted key cannot read the balance endpoint (HTTP 403); this is not evidence that checkout credentials are invalid. No checkout session, payment intent, charge, customer, or product was created by the verification.

The first Python HTTPS check failed because its local certificate store was unavailable; Node's normal TLS-verified fetch was used instead. A first direct TOML regex did not parse the CLI's quoting; structured TOML parsing resolved it without printing the key. No TLS verification was disabled.

## Demo treatment

Show any proposed Assurance fee as hypothetical and separate it from reported claim amounts and refunds. Do not invent a Stripe success screen, transaction receipt, checkout URL, or payment status. Outcome records remain agent-reported, with their supporting evidence and verification limits visible.

## References and verification

The adapter follows Stripe's [PaymentIntent creation](https://docs.stripe.com/api/payment_intents/create), [idempotent requests](https://docs.stripe.com/api/idempotent_requests), and [test key documentation](https://docs.stripe.com/keys). Creating an intent without confirmation does not finish a payment. The durable local reservation also prevents automatic replay after Stripe's idempotency retention window.

Run `npx tsx --test scripts/firm-finance.test.ts` for mocked provider checks. `scripts/firm-finance-db.test.ts` additionally requires a disposable `OUTREACH_TEST_DATABASE_URL` and serial execution. Tests never use real Stripe credentials or process money. Three unit tests and the database integration test passed, covering current evidence, receipt validation, duplicate prevention, and uncertain creation. No live Stripe creation or delivery is implied by mocked results.
