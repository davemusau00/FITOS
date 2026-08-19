# FITOS Environment, Configuration and Integrations

## 1. Configuration Philosophy

Configuration is:
- environment-specific
- validated at startup
- typed
- documented
- never silently defaulted for security-sensitive values

The API should fail fast at boot when required production configuration is missing.

---

## 2. Environment Separation

### Local
developer-owned services and sandbox credentials.

### Test/CI
ephemeral database/Redis where possible.

### Staging
production-like infrastructure with sandbox integrations.

### Production
real providers, real secrets, real data.

Never reuse production database credentials in staging.

---

## 3. Suggested Variables

```text
# Runtime
NODE_ENV
APP_ENV
APP_URL
API_PUBLIC_URL
WEB_PUBLIC_URL
PORT
LOG_LEVEL

# Database
DATABASE_URL

# Redis
REDIS_URL

# Auth
SESSION_SECRET
SESSION_TTL
CSRF_SECRET

# Object storage
STORAGE_DRIVER
STORAGE_ENDPOINT
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ACCESS_KEY
STORAGE_SECRET_KEY
STORAGE_PUBLIC_BASE_URL

# Email
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
MAIL_FROM

# M-Pesa
MPESA_ENVIRONMENT
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_SHORTCODE
MPESA_PASSKEY
MPESA_CALLBACK_BASE_URL

# WhatsApp
WHATSAPP_PROVIDER
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_SECRET

# Monitoring
ERROR_REPORTING_DSN
```

Names are illustrative. The integration code owns the exact contract.

---

## 4. Client Environment

Only explicitly public values may enter Vite client build.

Examples:
- public API base
- analytics public key
- environment label

Never:
- payment secret
- DB URL
- SMTP password
- session secret

Assume all client-bundled values can be read by the public.

---

## 5. Integration Architecture

Core code depends on interfaces.

```ts
interface PaymentProvider {
  initiate(...): Promise<PaymentInitiation>;
  query(...): Promise<ProviderPaymentState>;
  refund?(...): Promise<RefundResult>;
  verifyWebhook(...): Promise<VerifiedProviderEvent>;
}

interface MessagingProvider {
  sendTransactional(...): Promise<MessageResult>;
}

interface FileStorage {
  put(...): Promise<StoredFile>;
  getSignedUrl(...): Promise<string>;
  delete(...): Promise<void>;
}
```

Provider implementations live in infrastructure/integrations modules.

---

## 6. M-Pesa Adapter

Responsibilities:
- authenticate with provider
- initiate supported payment flow
- verify/parse callbacks
- query transaction when supported
- normalize provider states
- retain provider reference
- handle timeout
- retry safely

Core payment module receives normalized events.

Never make MembershipService understand Safaricom-specific payload shapes.

---

## 7. Payment Webhook Flow

```text
provider HTTP request
  ↓
webhook controller
  ↓
verify authenticity
  ↓
deduplicate provider event
  ↓
persist event
  ↓
enqueue processing
  ↓
normalize transaction
  ↓
update payment state transactionally
  ↓
allocate if matching rules succeed
  ↓
audit
  ↓
notify
```

Return provider-required acknowledgement promptly.

---

## 8. WhatsApp

Treat WhatsApp as an integration, not the system of record.

FITOS owns:
- customer
- booking
- membership
- consent
- message event

Provider owns transport.

Messages:
- transactional
- marketing

Keep templates/version IDs configurable.

Store delivery metadata, not unnecessary message content forever.

---

## 9. Email

Email provider through SMTP/API adapter.

Requirements:
- templates
- tenant brand
- unsubscribe for marketing
- bounce handling when provider exposes it
- transactional messages not blocked by marketing opt-out when legally permitted/appropriate

---

## 10. SMS

Optional provider adapter.

Use for:
- fallback OTP/verification if adopted
- critical reminder for tenants choosing SMS

Avoid hard-coding one Kenyan aggregator.

---

## 11. Object Storage

Storage abstraction supports:
- local filesystem development
- S3-compatible production
- self-hosted S3-compatible service if desired

Files store metadata in PostgreSQL:
- tenant
- owner/resource
- storage key
- original safe display name
- MIME
- bytes
- visibility
- hash
- created_by

No tenant file should be retrievable merely by guessing storage key.

---

## 12. Maps and Location

If a map provider is added:
- isolate provider
- minimize customer location tracking
- tenant branch coordinates are low sensitivity relative to member movement
- do not introduce member live-location tracking without a separately approved use case

---

## 13. Analytics

Product analytics:
- feature usage
- funnel
- technical UX

Do not send:
- health/injury notes
- payment credentials
- private free-text notes
- unnecessary phone/email

Prefer internal business analytics for tenant reports rather than third-party event streams containing customer PII.

---

## 14. Webhooks Outbound

Future tenant integrations may need outbound webhooks.

Design:
- signed
- event version
- event ID
- timestamp
- retry
- delivery log
- secret rotation
- disable on persistent failure
- no sensitive payload by default

---

## 15. Integration Failure UX

Provider failure must map to user-safe state.

Example payment:
- pending, checking provider
- failed
- timed out, verify before retry
- succeeded

Never encourage blind retry when duplicate payment is possible.

---

## 16. Sandbox Strategy

Provide development fakes:
- fake payment provider
- fake messaging provider
- local file storage

This makes E2E deterministic.

Staging uses provider sandbox where available.

Production integrations require explicit environment gate.
