# Hypothetical payments

The user directed on November 7, 2026: create a Stripe test-mode key autonomously, but keep payment hypothetical. This supersedes the earlier requirement to build a working Checkout link now. Do not collect a fee, request real card details, or describe a hypothetical payment as completed. A real Checkout integration is deferred until the user changes this direction.

## Sandbox setup

Created a temporary claimable Stripe sandbox through the official CLI, using pranay.dogra21@gmail.com and an isolated `assurance-hypothetical` profile. It expires November 15, 2026 unless claimed. No existing Stripe profile was overwritten. The claim URL and credentials are private in ignored `test-results/stripe-config.toml`; the creation receipt is also private and ignored. Do not copy these into documentation or logs.

The restricted sandbox test key is stored as `STRIPE_TEST_SECRET_KEY` in ignored, mode-0600 `.env.local`. `ASSURANCE_PAYMENT_MODE=hypothetical` records the intended mode locally; it is not a deployed feature flag or an implementation of checkout. The key is not in neon.ts, not deployed to Neon/Vercel, and not used by the browser. There is no payment-creation path in the application.

Read-only verification succeeded with HTTP 200 on `/v1/products?limit=1` and `/v1/checkout/sessions?limit=1`, both empty lists. The restricted key cannot read the balance endpoint (HTTP 403); this is not evidence that checkout credentials are invalid. No checkout session, payment intent, charge, customer, or product was created by the verification.

The first Python HTTPS check failed because its local certificate store was unavailable; Node's normal TLS-verified fetch was used instead. A first direct TOML regex did not parse the CLI's quoting; structured TOML parsing resolved it without printing the key. No TLS verification was disabled.

## Demo treatment

Show any proposed Assurance fee as hypothetical and separate it from reported claim amounts and refunds. Do not invent a Stripe success screen, transaction receipt, checkout URL, or payment status. Outcome records remain agent-reported, with their supporting evidence and verification limits visible.
