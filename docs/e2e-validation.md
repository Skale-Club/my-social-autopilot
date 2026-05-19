# E2E Validation Runbook — Stripe + GA4 + Facebook CAPI

> **When to run:** Before pricing changes, before scaling to paying customers, before ad campaigns, after any billing or tracking code change.

---

## Overview

Three integrations are fully implemented in code but require live credentials to validate end-to-end:

| Integration | Script | Credentials needed |
|---|---|---|
| Stripe billing | `scripts/verify-stripe-e2e.ts` | `STRIPE_SECRET_KEY=sk_test_*` |
| GA4 analytics | `scripts/verify-marketing-e2e.ts` | GA4 configured in admin UI |
| Facebook CAPI | `scripts/verify-marketing-e2e.ts` | Facebook configured in admin UI |

---

## 1. Stripe Validation

### Setup

1. Set your Stripe test-mode key:
   ```bash
   # In .env (local only — never commit)
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
   ```

2. Ensure Supabase env vars are set (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### Run

```bash
npx tsx scripts/verify-stripe-e2e.ts
```

### What it checks

**Mode A — Static (no API calls):**
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set
- All billing DB tables exist (`user_credits`, `user_billing_profiles`, `billing_plans`, etc.)
- `billing_model`, `overage_cadence_days`, `overage_min_invoice_micros` readable from DB
- At least one active billing plan exists with `stripe_price_id`

**Mode B — Live (sk_test_* only):**
- Creates real Stripe checkout sessions (credit top-up, subscription)
- Verifies billing portal session creation
- Runs `runOverageBillingBatch()` — safe, only invoices users with pending overage above threshold
- Reads `stripe_webhook_events` for processed event history

### Expected output (passing)

```
── MODE A — Static checks ────────────────────────────────────────────
  ✅ A-01 env SUPABASE_URL set
  ✅ A-02 STRIPE_SECRET_KEY set (test mode ✓)
  ✅ A-03 createCreditCheckoutSession exported
  ✅ A-04 table user_credits exists
  ✅ A-05 billing_model = "credits_topup"
  ✅ A-06 2 active billing plan(s): starter, pro

── MODE B — Live Stripe test-mode checks ────────────────────────────
  ✅ B-01 credit checkout session created: https://checkout.stripe.com/...
  ✅ B-02 subscription checkout session created
  ✅ B-03 billing portal — no customer yet (expected for new user)
  ✅ B-04 runOverageBillingBatch() completed without throwing

Results: 18 passed, 0 failed
```

### Common failures

| Failure | Fix |
|---|---|
| `A-06 no active billing plans` | Create plans in admin → Pricing and set `stripe_price_id` for each |
| `B-02 subscription checkout — no stripe_price_id` | Go to admin → Pricing → edit each plan → add Stripe Price ID |
| `B-01 createCreditCheckoutSession threw` | Check `APP_URL` env var is set (needed for redirect URLs) |
| `B-04 runOverageBillingBatch threw` | Usually a Stripe API error — check `STRIPE_SECRET_KEY` is valid |

### Webhook validation (manual)

Webhooks can only be validated against a live endpoint. To test locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-tools/stripe

# Forward events to your local server
stripe listen --forward-to http://localhost:5000/api/stripe/webhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

Confirm in the server logs that `handleStripeWebhook` was called and processed the event.

---

## 2. GA4 Validation

### Setup

1. In admin UI → Integrations → GA4:
   - Set **Measurement ID** (format: `G-XXXXXXXXXX`)
   - Set **API Secret** (from GA4 Admin → Data Streams → Measurement Protocol API secrets)
   - Enable the integration

2. Open GA4 → **Admin → DebugView** in another tab (keep it open during the test).

### Run

```bash
npx tsx scripts/verify-marketing-e2e.ts
```

### What it checks

**Mode A — Static:**
- `marketing_events` and `integration_settings` tables accessible
- GA4 integration row exists with measurement_id + api_secret
- Last 24h delivery stats (sent vs failed counts)

**Mode B — Live:**
- Sends a real `PageView` event to Measurement Protocol
- Verifies `marketing_events` row persisted with `ga4_status = "sent"`
- Tests idempotency: same `event_key` sent twice → second is detected as duplicate

### Manual verification step

After the script shows `ga4_status = "sent"`:
1. Open GA4 → Admin → DebugView
2. Look for `PageView` event from `e2e_validation` source
3. Event should appear within ~30 seconds

If it doesn't appear:
- Verify `measurement_id` starts with `G-`
- Verify `api_secret` is the **Measurement Protocol** secret (not a GA4 API key)
- Check `ga4_response` column in `marketing_events` table for error details

---

## 3. Facebook CAPI Validation

### Setup

1. In admin UI → Integrations → Facebook Dataset:
   - Set **Dataset ID** (your Pixel/Dataset ID)
   - Set **Access Token** (System User token from Meta Business Manager)
   - Set **Test Event Code** (from Events Manager → Test Events tab — looks like `TEST12345`)
   - Enable the integration

2. Open **Facebook Events Manager → Test Events** tab in another browser tab.

### Run

```bash
npx tsx scripts/verify-marketing-e2e.ts
```

### Manual verification step

After the script shows `facebook_status = "sent"`:
1. Open Facebook Events Manager → your dataset → **Test Events**
2. Look for the `PageView` event
3. Should appear within ~60 seconds

If it doesn't appear:
- Verify Test Event Code is set (otherwise events go to the live dataset, harder to verify)
- Check `facebook_response` in `marketing_events` table for error details
- Common issue: Access Token expired → regenerate in Meta Business Manager

---

## 4. Full E2E Sign-Up Flow (manual)

The most complete validation — traces a user signup to credit use to tracking:

1. Sign up a new test user
2. Verify: Telegram notification fires (if configured)
3. Verify: GHL contact created with tag `xareable` (if GHL configured)
4. Verify: `CompleteRegistration` GA4 event in DebugView
5. Verify: `CompleteRegistration` Facebook event in Test Events
6. Complete onboarding (brand setup)
7. Verify: `Lead` GA4 event in DebugView
8. Generate a post → verify `generate` usage event recorded in `usage_events`
9. Purchase credits (Stripe test mode) → verify `Purchase` GA4 + Facebook events
10. Verify `credit_transactions` has the purchase row

---

## 5. Repeating after code changes

Re-run both scripts after:
- Any change to `server/stripe.ts`, `server/services/stripe-connect.service.ts`
- Any change to `server/integrations/marketing.ts` or `server/integrations/facebook.ts`
- Any new Stripe plan or price ID configuration
- Any GA4 Measurement ID or Facebook Dataset ID change

**CI note:** These scripts are NOT in CI (they require live credentials). They are manual smoke tests.
