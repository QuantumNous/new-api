# Skill Marketplace Safety and Kids Mode Compliance

## 1. Purpose

Define mandatory compliance controls for Kids Mode, Skill safety, prompt protection, output safety, and safety monitoring. This file aligns with `tasks/01_Functional_Requirements.md`, `tasks/03_Data_Model_and_API_Spec.md`, `tasks/04_Analytics_and_Operations.md`, and `tasks/05_Security_and_NFR.md`.

## 2. Release Baseline

Kids Mode is disabled by default unless Product, Safety, Legal, Engineering, and QA approve GA. If GA is not approved, Kids Mode may only run as closed beta behind a feature flag.

| Scenario | Allowed V1 Behavior |
|---|---|
| Kids not approved | Hide Kids surfaces; ignore Kids filters for normal users; do not allow Kids execution paths. |
| Kids closed beta | Enable only for approved test tenants/users; apply full Kids runtime gates. |
| Kids GA | Requires full sign-off, monitoring, incident response, support process, and safety test pass. |

## 3. Runtime Kids Rules

| Control | Requirement |
|---|---|
| Session source | `is_kids_session` is derived from authenticated server-side session state only. |
| Client spoofing | Client-provided Kids fields are ignored and may be logged as spoof attempts without raw content. |
| Eligibility | Kids Session may execute only Skills with `is_kids_safe=true` and `kids_approval_status='approved'`, except audited time-bounded `emergency_approved` incident override. |
| Kids Exclusive | `is_kids_exclusive=true` Skills are blocked or hidden from normal sessions unless an approved family-mode exception exists. |
| Injection order | Kids eligibility, entitlement, model whitelist, rate limit, timeout, and context checks run before any provider execution. |
| Model pool | Kids executions use only the approved safe model pool and provider allowlist. |
| Provider retention | Kids executions may route only to providers/models with approved DPA, no-training commitment, and ZDR/no-retention endpoint or request mode. Providers without that capability are excluded from Kids Safe model pool. |
| Failure mode | If Kids safety state, approval state, or safety service is uncertain, fail closed. |
| Logging | No raw Kids input/output in logs, analytics, support diagnostics, billing, audit diff, or exports. |

## 4. Kids Approval Workflow

`skill_audit_log` is the system-of-record for Kids approval, rejection, revocation, and emergency override. Analytics may receive derived `skill_kids_approved` workflow events, but those events must reference the audit `request_id` and must not contain raw review notes or child-sensitive data.

| Step | Requirement |
|---|---|
| Request | Super Admin requests Kids approval after mandatory fields, version, model whitelist, output schema, and preview test are ready. |
| Review | Safety Reviewer reviews content, template intent, expected outputs, model pool, category, age suitability, and abuse cases. |
| Decision | Approval sets `kids_approval_status='approved'`; emergency override sets `emergency_approved`; rejection sets `rejected`; revocation sets `revoked`. |
| Audit | Actions use `kids_approval_granted`, `kids_approval_rejected`, `kids_approval_revoked`, or `kids_approval_overridden`. |
| Invalidation | Template, model whitelist, output schema, safety-critical setting, or Kids flag changes invalidate prior approval. |
| Override | Emergency Super Admin override requires reason, time-bounded scope, incident reference, `kids_approval_status='emergency_approved'`, a non-null `kids_emergency_approval_expires_at` timestamp (maximum 72 hours from grant time unless extended by a second Super Admin), and audit log. |
| Expiry enforcement | At execution time, if `kids_approval_status='emergency_approved'` and `kids_emergency_approval_expires_at < now()`, Relay must treat the Skill as `rejected` and fail closed for Kids sessions. A daily background job must scan for expired entries and emit `kids_emergency_approval_expired` alerts for Safety and Security review. |

## 5. Platform Secret and IP Protection (R2/D-09)

- The published `instruction_template` ships in the downloadable package and is readable; it is no longer a confidentiality boundary.
- Provider credentials and server-side routing/model-selection logic are stored server-side only and must never appear in the package, public/user/ops/support/analytics/billing/audit-export/error APIs.
- The downloadable package must never contain provider credentials, server routing logic, or draft templates.
- Logs, errors, events, billing records, provider diagnostics, support views, and audit diffs must never contain provider credentials, raw user input, PII, or provider raw payloads. `instruction_template_sha256` is retained as a package/version integrity check.
- D-06 (re-scoped under D-09) requires encryption-at-rest only for draft templates and sensitive server-side config (provider creds, routing logic), not for published templates that ship in the package.

## 6. Prompt Injection and Leakage Defense

The platform must use structured message boundaries and policy precedence. It must not rely on deleting strings from user input as the primary defense.

Required controls:

- Build system/instruction/user messages server-side with explicit role separation.
- Never concatenate raw `instruction_template` and user input into a single untrusted string.
- Enforce provider/model system-boundary allowlist before production Relay integration.
- For Kids Sessions, Relay Adapter must explicitly select the provider-approved ZDR/no-retention/no-training path or fail closed before provider call.
- Detect prompt extraction and jailbreak attempts using a maintained test corpus.
- Emit `skill_safety_violation` for blocked unsafe output and set `prompt_injection_detected=true` when applicable.
- Return generic safe error copy; never echo hidden instructions, full input, or full model output.
- If all approved providers/models are unavailable, return a standard error instead of falling back to an unapproved model.

## 7. Content Safety

| Area | Requirement |
|---|---|
| Unsafe output | Block or replace with safe response; emit `skill_safety_violation`. |
| Kids unsafe output | Critical incident; disable affected Skill or Kids mode until Safety and Engineering review. |
| User disclosure | AI-generated disclosure remains visible where required by UX PRD. |
| Deprecated/archived Skill | Existing sessions must follow lifecycle rules and may not bypass safety or Kids gates. |
| Admin preview | Excluded from business analytics and revenue, but subject to hard preview limits, audit/security telemetry, and the same safety/leakage/provider guardrails as production execution. |

## 8. Safety Events and Monitoring

Canonical events and fields must align with Analytics PRD:

| Signal | Source | Notes |
|---|---|---|
| `skill_blocked` | Relay / entitlement / safety | Include `block_reason`; no raw prompt. |
| `skill_safety_violation` | Output guard / safety service | Used for unsafe output and prompt extraction blocks. |
| `skill_timeout_error` | Relay | No charge by default for no-output timeout; usable partial streaming timeout follows Finance-approved settlement. |
| `skill_kids_approved` | Derived workflow analytics | Source of truth remains `skill_audit_log`. |
| `prompt_injection_detected` | Event boolean / metadata | Canonical prompt-injection signal for V1. |

Operational thresholds:

- Critical: any confirmed unsafe Kids output.
- High: repeated Kids blocks, injection attempts, or safety violations for the same Skill/model.
- Medium: telemetry quality issue affecting Kids or safety dashboards.

## 9. Incident Response

| Severity | Trigger | Required Action |
|---|---|---|
| Critical | Confirmed unsafe Kids output, provider-credential/routing-logic exposure, or identity/billing spoofing | Disable affected Skill or feature flag through emergency invalidation/broadcast, page Safety/Security/Engineering, open incident, preserve audit trail. |
| High | Repeated safety violations, suspicious admin access, or provider boundary failure | Review model, template, policy, and logs within 1 business day. |
| Medium | Data quality, event quarantine, or monitoring gap | Quarantine affected events and fix before dashboard or launch use. |

## 10. Launch Acceptance

Kids or safety-sensitive launch paths cannot ship unless:

1. Kids mode is disabled, closed beta, or fully approved for GA.
2. Client-provided Kids state is ignored in automated tests.
3. Non-Kids-Safe Skills are blocked before any provider execution in Kids Sessions.
4. `is_kids_exclusive=true` behavior matches normal-session hiding/blocking plus approved exception policy.
5. Secret-leakage (provider creds/routing logic/raw input/PII), identity/billing-spoofing, and package-content boundary tests pass across API, log, analytics, billing, audit, export, and error paths.
6. Provider/model allowlist and safe model pool are approved, including Kids-specific DPA, no-training, and ZDR/no-retention validation.
7. Kids provider adapter test proves unsupported retention/logging paths fail closed.
8. Safety incident response and kill switch are tested, including emergency invalidation/broadcast rather than waiting for normal cache TTL.
