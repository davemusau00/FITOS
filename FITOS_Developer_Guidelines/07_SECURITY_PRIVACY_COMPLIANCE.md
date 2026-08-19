# FITOS Security, Privacy and Compliance Guidelines

> This document is engineering guidance, not legal advice. Before enabling sensitive health-data workflows or entering regulated partnerships, obtain qualified legal/compliance review for the jurisdictions in which FITOS operates.

## 1. Security Baseline

Use OWASP ASVS as the verification baseline, aiming at a strong Level 2 posture for the core SaaS application and raising controls for higher-risk modules.

Also review the current OWASP Top 10 during release security review.

Security is a release criterion, not a later hardening sprint.

---

## 2. Threat Model

At minimum model:
- cross-tenant data access
- account takeover
- receptionist privilege escalation
- payment callback spoofing
- webhook replay
- booking capacity race
- session theft
- insecure password reset
- public form abuse
- CSV formula injection
- file upload abuse
- stored XSS in notes/public website content
- SQL injection
- sensitive-log leakage
- exposed backups
- misconfigured object storage
- compromised admin device
- malicious staff export
- dependency compromise
- SSRF through integration configuration

Update threat model when adding major integrations.

---

## 3. Authentication

Requirements:
- strong password hashing using modern password-hashing algorithm/library
- rate-limited login
- account lock/risk controls without easy denial-of-service
- secure session cookies
- server-side revocation
- session listing/revocation for users where feasible
- password reset tokens one-time and short-lived
- no password hints
- no plaintext passwords in logs or email
- MFA support for owners/platform admins

---

## 4. Sessions

Cookie:
- `HttpOnly`
- `Secure`
- appropriate `SameSite`
- narrow domain/path where practical

Session:
- opaque identifier
- server-side state
- rotation after authentication/privilege change
- expiry
- revocation
- device/session metadata only if justified

Do not put sensitive auth tokens into localStorage by default.

---

## 5. Authorization

Use deny-by-default.

Server authorizes:
- capability
- tenant
- branch
- record context
- sensitive-data scope

Platform support roles must not automatically gain arbitrary tenant access. Use explicit support-access workflows with:
- reason
- time limit
- audit
- elevated confirmation

---

## 6. Tenant Isolation

Automated test suite must attempt:
- member A accessing tenant B member ID
- booking mutation across tenant
- report query across tenant
- payment lookup across tenant
- file lookup across tenant
- export across tenant

A tenant identifier in a URL is not authorization.

---

## 7. Sensitive Data

Fitness businesses may collect:
- injury notes
- body measurements
- health goals
- medical/physical restrictions
- progress photos

Treat these as sensitive.

Engineering requirements:
- minimize collection
- separate capabilities
- encryption at rest where architecture supports it
- TLS in transit
- never put in analytics events
- redact from logs
- configurable retention
- access auditing
- explicit export behavior
- explicit deletion/retention workflow

---

## 8. Kenya Privacy Context

FITOS should be designed for privacy by default and data minimization.

The Kenyan Data Protection Act defines health data and sensitive personal data and contains data-protection-by-design/default requirements. The product architecture should therefore avoid collecting health information merely because it might become useful later.

Practical platform consequences:
- make sensitive assessment modules optional
- configure purpose/consent records where required
- support access and export workflows
- support retention/deletion policy
- log access to sensitive modules
- document processor/subprocessor boundaries
- expose privacy settings per tenant

Before positioning FITOS as a medical/clinical record system, conduct a separate legal and regulatory assessment.

---

## 9. Encryption

### In Transit
TLS for all public traffic.

Internal Docker traffic on one host may remain private to a Docker network, but credentials and host exposure must be tightly controlled.

### At Rest
At minimum:
- encrypted VPS disk if provider supports it
- encrypted off-site backups
- encrypted secret store/secret files
- field-level encryption for especially sensitive values where threat model requires it

Encryption keys must not be stored beside encrypted backups in the same trust boundary.

---

## 10. Secrets

Secrets include:
- DB password
- session signing/encryption keys
- payment credentials
- webhook secrets
- SMTP credentials
- object-store credentials
- API tokens

Rules:
- no Git
- no frontend
- separate per environment
- rotation procedure
- least privilege
- revoke on staff offboarding
- do not print at boot

---

## 11. Input and Output Security

- validate all input
- parameterize DB queries
- encode output
- sanitize rich text if rich text is allowed
- prefer plain text notes in MVP
- reject dangerous file types where unnecessary
- set content disposition correctly for downloads
- protect CSV exports from formula injection
- validate URLs before server-side fetch
- never execute user input

---

## 12. File Uploads

Requirements:
- allowed MIME/extensions
- actual content validation where practical
- random server-generated object key
- size limit
- tenant-scoped authorization
- malware scanning strategy for risky document types
- no direct execution
- private by default
- signed/time-limited delivery where appropriate

Public tenant logos can be public objects; member documents should not.

---

## 13. Web Security Headers

Nginx/app should set an appropriate set of:
- HSTS after HTTPS verified
- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- frame-ancestors through CSP

Do not deploy a CSP that is so permissive it provides no value. Build it around actual dependencies.

---

## 14. CSRF

If using cookie authentication:
- use SameSite protection
- implement CSRF token/appropriate anti-CSRF strategy for state-changing routes
- reject unexpected origins for sensitive requests where appropriate

CORS is not CSRF protection.

---

## 15. CORS

Production preferred architecture:
- web and API under same trusted site/domain where possible
- explicit allowed origins
- no wildcard origin with credentials
- environment-specific config

---

## 16. Payment Security

- verify provider authenticity
- use idempotency
- compare expected amount/currency/reference
- immutable provider transaction identifiers
- do not trust browser payment success callback as authoritative
- restrict refunds
- audit manual matching
- alert on suspicious duplicate/replay activity

---

## 17. Logging

Never log:
- passwords
- session cookies
- full auth headers
- payment secrets
- full sensitive assessment contents
- raw private files

Mask:
- phone
- email
- transaction identifiers where log purpose does not require full values

Logs should include:
- timestamp
- service
- environment
- level
- request ID
- tenant ID if safe
- user ID if safe
- event code

---

## 18. Audit vs Logs

Audit:
- business/security accountability
- longer retention
- user-visible/admin-visible where appropriate

Application logs:
- troubleshooting/operations

Do not treat a mutable log stream as the sole financial audit trail.

---

## 19. Security Release Gate

Before production:
- dependency scan
- secret scan
- lint/type/test
- tenant isolation tests
- auth tests
- authorization tests
- CSP/security header review
- backup permissions review
- object storage review
- payment webhook replay test
- rate-limit test
- production debug disabled
- source-map exposure decision
- admin routes reviewed

High-risk release:
perform manual security review and, before material scale, independent penetration testing.
