# Skill Marketplace Security and NFR Specification

本文档定义 DeepRouter Skill Marketplace V1 的企业级安全架构、运行时防护、合规边界和非功能需求。目标是让 Security、Backend、Frontend、Data、QA、Operations 和独立 Agent 可以按同一套威胁模型、控制点、错误码、SLO 和验收标准实施。

本文件以 `tasks/01_Functional_Requirements.md`、`tasks/03_Data_Model_and_API_Spec.md`、`tasks/04_Analytics_and_Operations.md` 为上游基准。若冲突，以 Functional Requirements 的产品边界为准，以 Data/API Spec 的 schema、错误码和 RBAC 为实现基准。

---

## 1. Security Scope

### 1.1 V1 Security Objectives

| Objective | Requirement |
|---|---|
| Protect platform IP | `instruction_template` and `prompt_guard_template` must never be exposed to client, user APIs, public exports, analytics, billing, support views, or normal logs |
| Enforce use-time authorization | Every Skill execution must validate auth, tenant, lifecycle, enabled state, entitlement, quota, Kids policy, model whitelist, rate limit, timeout, and context size before provider call |
| Prevent prompt and relay bypass | User input must never be concatenated into system instructions; Relay must preserve policy precedence across provider adapters |
| Protect Kids sessions | Kids state is server-derived only; unsafe Skills are blocked before prompt injection; Kids raw sensitive content is not persisted |
| Preserve tenant isolation | All user, entitlement, event, billing, cache, and audit access must be scoped by `tenant_id` where applicable |
| Enable incident response | Marketplace, individual Skills, Kids mode, model providers, and recommendation surfaces must be controllable by feature flag or kill switch |
| Provide enterprise reliability | Skill execution must meet defined timeout, latency, availability, alerting, and rollback requirements |

### 1.2 Non-Scope

| Item | Decision |
|---|---|
| User-created Skills | Not supported in V1 |
| Public Skill API trigger | Not supported in V1 |
| Public prompt export | Not supported |
| Client-side DRM | Not trusted as a security control |
| Full DLP for all user conversations | Existing platform scope; this file covers Skill Marketplace-specific data paths |

---

## 2. Threat Model

### 2.1 Protected Assets

| Asset | Classification | Primary Risk |
|---|---|---|
| `instruction_template` | Highly sensitive platform IP | Prompt theft, leakage through API/log/provider/debug UI |
| `prompt_guard_template` | Sensitive platform IP | Guardrail bypass if exposed |
| Skill execution snapshot | Sensitive | Unauthorized use or stale entitlement |
| Kids session state and content | Restricted sensitive | Child privacy and safety violation |
| Billing attribution | Financial | Double charge, fraudulent charge, incorrect revenue reporting |
| Admin actions and audit logs | Security sensitive | Privilege abuse or untraceable changes |
| Tenant/user identifiers | Personal / tenant confidential | Cross-tenant leakage |
| Model whitelist and safety config | Internal security config | Policy bypass or targeted attacks |

### 2.2 Abuse Cases and Required Controls

| Threat ID | Abuse Case | Required Controls | Priority |
|---|---|---|---|
| T-01 | User asks model to reveal Skill hidden prompt | Structured message separation, hidden guard, output leakage detector, safe refusal | P0 |
| T-02 | Indirect prompt injection through user input | User content isolation, no string concatenation, attack classifier, output guard | P0 |
| T-03 | Client sends fake `is_kids_session=false` | Server-derived Kids state only; ignore client field; audit spoof attempts | P0 |
| T-04 | Free user executes Pro Skill by direct Relay request | Use-time entitlement in Relay; standard `SKILL_PLAN_REQUIRED` error; no charge | P0 |
| T-05 | User executes disabled or archived Skill | Lifecycle and `user_enabled_skills` checks before injection | P0 |
| T-06 | Tenant A reads Tenant B enablement/events | Tenant-scoped query filters, cache keys, tests, dashboards | P0 |
| T-07 | Prompt leaks through logs, analytics, billing, audit, error, provider debug | Redaction, allowlisted telemetry schema, restricted provider logging, prompt hash only | P0 |
| T-08 | Unsupported model ignores system boundary | Model capability classification; block sensitive/Kids Skills on unsupported boundary models | P0 |
| T-09 | Streaming emits unsafe or prompt-leaking chunk | Buffer or chunk safety check; abort stream; no charge by default | P1 unless streaming is launch P0 |
| T-10 | Stale cache allows expired subscription | Short TTL, event-driven invalidation, use-time source-of-truth fallback | P0 |
| T-11 | Admin modifies Kids flags without approval | RBAC, approval workflow, publish checklist, immutable audit | P0 if Kids enabled |
| T-12 | Provider outage causes cascading failures | Timeout, circuit breaker, failover only within whitelist, graceful error | P0 |
| T-13 | Provider legal/security terms incomplete | Provider DPA, data retention, ZDR/logging, region, subprocessors, and security review approved before production provider traffic | P0 for production provider launch |
| T-14 | Streaming timeout free-riding | Timeout after delivered partial output is billed by actual consumed/output tokens under Finance-approved settlement | P0 if streaming enabled |
| T-15 | Quota lost on provider timeout/internal error | Idempotent quota reservation and compensation rollback for eligible failures | P0 |
| T-16 | Kids abuse cannot be actioned because analytics is anonymous | Auth/Risk layer triggers account-level controls from restricted runtime identity, independent of business analytics | P0 if Kids enabled |
| T-17 | Free quota burns unbounded input tokens | Enforce active version `max_input_tokens_snapshot` before provider call for Free Skills and free-quota paths | P0 |
| T-18 | Free user reaches premium model through Free Skill whitelist | Effective model set is intersection of user-plan models and Skill whitelist | P0 |
| T-19 | Kids prompt/data leaks to provider retention logs | Kids model pool requires provider ZDR/no-training/DPA path; unsupported providers are blocked | P0 if Kids enabled |
| T-20 | Billing ledger mutation hides refunds/voids | Append-only billing event ledger with compensating rows for refund/void | P0 if charging enabled |
| T-21 | Malicious tenant injects competitor `tenant_id` in payload to poison their analytics/billing/quota | Relay must extract `user_id` and `tenant_id` exclusively from validated auth token claims; any client-supplied tenant/user identifiers in request body, headers, or extensions must be stripped and discarded before use in any event, billing, quota, or audit path | P0 |
| T-22 | Multi-turn context accumulation converts free single-turn quota into unbounded provider cost | V1 Relay enforces stateless single-turn: prior-turn messages are stripped at entry; per-request provider cost = instruction_template tokens + current user input tokens | P0 |

---

## 3. Data Security and Privacy

### 3.1 Classification and Handling

| Data | Classification | Storage | Access | Export |
|---|---|---|---|---|
| `instruction_template` | Highly sensitive platform IP | `skill_versions`; encrypted at rest where available | Super Admin write/read with audit; Relay read for execution | Never |
| `prompt_guard_template` | Sensitive platform IP | `skill_versions`; same protection as instruction | Super Admin + Relay | Never |
| Public Skill metadata | Public | `skills`, `skills_i18n` | User APIs | Allowed |
| User input / model output | User content | Not stored in Skill analytics by default | Existing platform rules | Not from Skill analytics |
| Kids raw input/output | Restricted sensitive | Must not be persisted in Skill logs/events | Runtime safety path only | Never |
| Usage events | Internal analytics | `skill_usage_events` | Ops/Product aggregate; Safety subset | Aggregate only, P1 |
| Billing events | Financial | `skill_billing_events` | Finance/Super Admin/service account | Finance-controlled only |
| Audit logs | Security sensitive | `skill_audit_log` | Super Admin/Security | Security-approved only |

### 3.2 Prompt Leakage Prohibitions

`instruction_template` and `prompt_guard_template` must be absent from:

- client API responses
- frontend state, local storage, browser logs, and telemetry
- server application logs
- error responses and exception traces
- analytics events and `metadata`
- billing events
- audit `before_value` and `after_value`
- CSV exports
- support diagnostics
- provider debug logs where provider controls allow disabling
- streaming chunks and final model output

Template changes must be represented by `instruction_template_sha256`, version id, actor id, and changed field names only.

### 3.3 Telemetry Allowlist

Events and logs may include only approved fields:

| Category | Allowed Examples |
|---|---|
| Identity | `user_id`, `tenant_id`, `session_id`, `request_id` |
| Skill | `skill_id`, `skill_version_id`, `status`, `required_plan`, Kids flags |
| Execution | `model`, token counts, latency, success, error code, block reason |
| Safety | boolean detection flags, violation stage, policy category |
| Billing | idempotency key, charge status, amount fields in billing table only |

Reject or quarantine telemetry containing restricted keys such as `instruction_template`, `prompt`, `system_prompt`, `raw_messages`, `provider_payload`, `kids_raw_input`, or `full_user_input`.

### 3.4 Retention

| Data | Minimum Requirement |
|---|---|
| Skill versions | Permanent while product exists |
| Usage events | Hot 90 days; aggregate/archive after 90 days |
| Kids event metadata | No raw sensitive content; anonymize personal fields per legal policy |
| Billing events | Follow finance retention policy |
| Audit logs | Minimum 2 years; append-only or tamper-evident where available |
| Security incidents | Minimum 2 years after resolution |

---

## 4. Authentication, Authorization, and RBAC

### 4.1 Route Access

| Route / Capability | Anonymous | Normal User | Operation | Product/Growth | Safety Reviewer | Support | Super Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public Marketplace list/detail | Yes, public fields | Yes | Yes | Yes | Yes | Yes | Yes |
| Enable/disable Skill | No | Own user only | No | No | No | Assisted status only | Audited support action only |
| Playground Skill execution | No | Own user only | No | No | Preview only if allowed | No | Preview/test only |
| Ops aggregate dashboard | No | No | Yes | Yes | Safety subset | Limited diagnostics | Yes |
| CSV export | No | No | P1 aggregate only | P1 aggregate only | No by default | No | Yes |
| Create/edit Skill metadata | No | No | No | No | No | No | Yes |
| View/edit `instruction_template` | No | No | No | No | No | No | Yes with audit |
| Approve Kids safety | No | No | No | No | Yes | No | Emergency override with reason |
| View audit log | No | No | No | No | Own approvals only | No | Yes |

### 4.2 Authorization Rules

- Authorization must be enforced server-side on every route.
- `/api/v1/admin/*` defaults to Super Admin only unless explicitly scoped.
- `/api/v1/ops/*` exposes aggregate views only and must never return prompt or raw user content.
- Service-to-service calls must use scoped credentials and must not rely on frontend-provided role claims.
- Every admin write must include actor, role, request id, changed fields, reason where applicable, IP, user agent, and timestamp.
- Super Admin access to `instruction_template` must create an audit record even for read/preview actions.

### 4.3 Tenant Isolation

- All user-specific tables and queries must include `tenant_id` where the upstream platform supports tenancy.
- Cache keys must include tenant and user dimensions for entitlement, enabled state, quota, and session-derived Kids state.
- Analytics dashboards must aggregate within the viewer's permitted tenant scope.
- Cross-tenant access attempts must return a generic not-found or forbidden error without revealing resource existence.
- Tests must include Tenant A / Tenant B isolation for user APIs, Relay, Ops dashboard, cache, and audit access.

**Identity immutability assertion (Tenant Spoofing prevention)**:

`user_id` and `tenant_id` used in ALL analytics event construction, billing event construction, quota operations, cache key scoping, rate limit counters, and audit log entries must be extracted **exclusively** from the gateway's deeply validated authentication token claims (e.g., verified JWT `sub`/`tenant_id` claims, or equivalent platform auth session). The following are **forbidden as sources** for analytics/billing identity:

- HTTP request body fields (e.g., `"tenant_id": "..."` in JSON payload)
- Query string parameters
- HTTP headers other than the platform-signed auth token (e.g., `X-Tenant-ID` set by client)
- Skill execution metadata sent by the Playground client
- Any field that a client can arbitrarily set without platform authentication

Relay must discard and overwrite any client-provided identity fields with the auth-token-derived identity before constructing any event, billing entry, quota key, or cache key. This must be enforced as a gateway-layer invariant, not a per-endpoint check. Violation of this rule allows a malicious tenant to write events, exhaust quota, or trigger safety alerts under a competitor's `tenant_id`.

---

## 5. Relay Security Architecture

### 5.1 Execution Chain

Skill execution must follow this order:

1. Client / Playground sends `deeprouter.skill_id`.
2. Gateway assigns `request_id`.
3. Auth resolver validates logged-in user.
4. Tenant resolver establishes tenant scope.
5. Session resolver derives Kids state server-side.
6. Subscription and plan resolver loads active entitlement.
7. Feature flag and kill switch checks run.
8. Skill lifecycle and enabled-state checks run.
9. Use-time entitlement, quota, and rate limit checks run.
10. Kids Safety Gate runs before prompt injection.
11. Immutable Skill version and execution snapshot are selected.
12. Model whitelist and provider capability checks run.
13. Context/token estimation runs.
14. `instruction_template` is injected server-side.
15. Provider adapter sends structured request.
16. Output safety and leakage guard validates response.
17. Usage, billing, safety, and blocked events are emitted.

If any check before step 14 fails, Relay must not load or inject prompt text into the provider request.

### 5.1.1 Runtime Context vs Persisted Events

Relay execution context and persisted analytics identity are intentionally decoupled:

- Relay must hold the real authenticated `user_id`, `tenant_id`, session state, plan, and entitlement in memory for use-time authorization, quota, user-level rate limiting, abuse control, billing attribution, and audit routing.
- `skill_billing_events` may persist the real `user_id` and `tenant_id` because it is a restricted financial/accounting table; it must not store prompt text, raw input/output, provider raw payloads, Kids-sensitive content, or hidden Skill instructions.
- `skill_usage_events` must persist Kids Session analytics with `user_id=NULL`, `is_kids_session=true`, and `session_id=kids_session_pseudo_id`.
- `kids_session_pseudo_id = HMAC_SHA256(user_id + tenant_id + salt_version, daily_salt)`. `salt_version` is derived from authenticated session creation time or gateway-maintained sticky salt for that session, not event trigger time. The salt is secret-managed, rotated daily, and unavailable to analytics/dashboard users.
- Cross-day Kids identity stitching is disabled by default. Any alternative pseudonymous schema requires Legal/Privacy and Security approval.

### 5.1.2 Transaction Boundary Discipline

Never wrap external HTTP calls, including provider/model execution, inside a database transaction.

Required implementation discipline:

1. Open short transactions only for reads or writes that require atomicity.
2. Commit or release the database connection before calling a provider.
3. Execute the provider HTTP call outside any database transaction.
4. Open a new short transaction after the provider returns to write billing, usage, audit, and safety records.
5. Use idempotency keys and retry-safe writes for post-provider persistence.

Holding a database transaction or pooled connection open while waiting for a provider response is a P0 NFR violation because Skill execution can take up to the configured timeout window.

### 5.2 Policy Precedence

Policy precedence is strict:

```text
Kids hard constraints
> platform safety policy
> tenant policy
> Skill instruction
> user message
```

User input must never override a higher-precedence layer. The Relay must preserve this order across OpenAI, Anthropic, Gemini, and any future provider adapter.

### 5.3 Provider Adapter Requirements

| Provider Type | Requirement |
|---|---|
| OpenAI-compatible messages | Place platform/Skill instruction in system/developer-equivalent channel according to adapter standard |
| Anthropic | Use `system` parameter for system-level instruction |
| Gemini | Use `systemInstruction` when available |
| Models without reliable system boundary | Not eligible for Kids, Pro gated, high-sensitivity, or prompt-protected Skills unless Security explicitly approves |

Provider adapters must not log raw payloads containing `instruction_template`. If provider SDK logging cannot be disabled or redacted, that provider is not allowed for Skill execution.

Kids provider rule:

- If `is_kids_session=true`, Relay may route only to providers/models with approved DPA, no-training commitment, and Zero Data Retention or equivalent no-retention endpoint/configuration.
- The adapter must select the provider's approved ZDR/no-retention path or request option where applicable.
- Providers that cannot guarantee ZDR/no-training/no-retention for Kids traffic are prohibited from the Kids Safe model pool, even if they are otherwise allowed for normal sessions.
- Kids provider selection must be auditable by provider, model, retention mode, and DPA approval version without logging raw Kids input/output.

### 5.4 Smart Router Boundary

- Smart router may select models only from Relay-provided `allowed_models`.
- Smart router must not receive `instruction_template`, entitlement details, billing policy, or Kids-sensitive content beyond required model constraints.
- Relay must compute `effective_allowed_models = intersection(user_plan_allowed_models, skill.model_whitelist_snapshot or skill.model_whitelist)`.
- If `effective_allowed_models` is empty, Relay must return `SKILL_PLAN_REQUIRED` or an equivalent plan/model entitlement error before provider call.
- Smart Router receives only `effective_allowed_models`, never the raw Skill whitelist if it includes models the current user plan cannot access.
- `user_plan_allowed_models` must be sourced from the platform's canonical plan-to-model allowlist configuration (the mapping of Free → allowed models, Pro → allowed models, Enterprise → allowed models). This mapping must be explicitly defined and owner-signed as part of D-05 before Relay provider integration. If no platform-level plan-model mapping exists today, D-05 must produce one before the intersection check can be implemented correctly; do not hard-code assumptions about which plans allow which models.
- Relay must validate the selected model against whitelist and capability policy after routing.
- If every whitelisted model is unavailable, Relay returns a standard error instead of falling back to an unapproved model.
- Context/token estimation must be safe across all candidate fallback models, not only the first-choice model.
- Free Skills and any execution path using free quota must enforce the immutable `max_input_tokens_snapshot` selected at request entry in addition to provider context limits. The snapshot is populated from `skills.max_input_tokens` at version activation.
- If the Free/free-quota token cap is missing from the active execution snapshot, Relay must block before provider call and the Admin publish/activation checklist must fail until configuration is fixed.
- If input exceeds the free-path cap (`max_input_tokens_snapshot`), Relay must return `SKILL_CONTEXT_TOO_LONG` before provider call. **Truncation is prohibited on the free-quota path**: truncation still consumes provider tokens and does not prevent cost abuse — an attacker can repeatedly send oversized inputs that always truncate to the cap, burning platform cost at the cap rate per call. Truncation as graceful degradation is permitted only on paid (Pro/Enterprise) execution paths where the user bears actual token cost, and only where the Skill policy explicitly opts in.
- For cross-provider fallback, Relay must use the most conservative provider limit and reserve at least a 20% safety buffer, or use a Security-approved character-weighted estimator that is more conservative than provider-specific tokenizers.
- If a request does not fit the conservative fallback budget, Relay must return `SKILL_CONTEXT_TOO_LONG` before provider call instead of relying on provider 400 errors.
- Smart Router must not fallback from a larger-context model to a smaller-context model unless the conservative context budget still passes.

---

## 6. Prompt Injection and Anti-Copy Controls

### 6.1 Input Handling

- User input must be passed as a separate user message or structured content block.
- User input must not be interpolated into `instruction_template`.
- Any reference implementation or pseudocode that concatenates Skill instructions and user input into one string is non-compliant; implementation must use structured `messages`/role separation or an equivalent provider-native boundary.
- The system must not rely on deleting strings such as `---`, `[SYSTEM]`, or `{{` as the primary security mechanism.
- Normalization may be used for transport safety, but it must not silently change user semantics.
- Prompt-injection detection must emit `prompt_injection_detected=true` and a safety event when policy requires.

### 6.2 Output Leakage Guard

The output guard must inspect final output, and streaming output when enabled, for:

- requests to reveal hidden prompt or policy
- verbatim or near-verbatim Skill instruction leakage
- internal model/provider configuration leakage
- chain-of-thought or hidden policy leakage where platform policy forbids it
- Kids safety violation when `is_kids_session=true`

Blocked output returns `SKILL_SAFETY_VIOLATION` or a safe replacement response and emits `skill_safety_violation`. Failed or blocked safety output does not create a charge by default.

### 6.3 Admin Preview

- Preview is available only to Super Admin, and Safety Reviewer only for safety-scoped tests where approved.
- Preview response must not echo the hidden prompt.
- Preview requests use `entry_point=admin_preview`.
- Preview usage is excluded from business analytics and revenue.
- Preview is not a free or ungoverned execution channel. It must have dedicated hard rate limits, default maximum 50 previews per admin per UTC day unless Security explicitly approves a different cap.
- Preview must pass the same content safety, prompt leakage, output leakage, provider allowlist, and Kids/content-safety guardrails as production execution.
- Preview must emit audit/security telemetry outside business analytics, including actor, request id, Skill/version, model, token usage, safety result, and block/error status.
- Preview abuse, suspicious volume, or unsafe output must trigger Security/Safety alerts and may revoke preview access or disable the affected Admin account/session.

---

## 7. Kids Safety Gate

### 7.1 Release Baseline

Kids mode is disabled by default unless Product, Safety, Legal, Engineering, and QA approve it for GA. If not approved for GA, Kids mode may only run as closed beta behind a feature flag.

### 7.2 Runtime Rules

| Rule | Requirement |
|---|---|
| Session source | `is_kids_session` is derived from authenticated session/server state only |
| Client spoofing | Client-provided Kids fields are ignored and may be logged as spoof attempts without raw content |
| Skill eligibility | Kids Session can execute only Skills with `is_kids_safe=true` and approved Kids status |
| Kids Exclusive | `is_kids_exclusive=true` Skills are blocked or hidden from normal sessions unless family-mode exception is approved |
| Model pool | Kids executions use only approved safe model pool |
| Injection order | Kids block occurs before prompt injection |
| Output guard | Safety output guard is mandatory |
| Logging | No raw Kids input/output in Skill logs, analytics, or support diagnostics |

### 7.3 Publish and Approval

- Kids Safe or Kids Exclusive publish requires Safety Reviewer approval.
- Template, model whitelist, output schema, or safety-critical setting changes invalidate prior Kids approval.
- Safety violation after publish can trigger single-Skill kill switch, archive, or full Kids kill switch.
- Emergency Super Admin override requires reason and creates audit log.

### 7.4 Kids Incident Response

| Severity | Trigger | Required Action |
|---|---|---|
| Critical | Any confirmed unsafe Kids output | Disable affected Skill or Kids mode, page Safety + Engineering, open incident |
| High | Repeated Kids block or injection attempts | Review Skill, model, and guard policy within 1 business day |
| Medium | Data quality issue in Kids telemetry | Quarantine events and fix pipeline before dashboard use |

Severe Kids abuse handling must not depend on business analytics identity. The Auth/Risk layer retains the real authenticated `user_id` in restricted runtime context and may trigger account-level temporary freeze, step-up verification, session revocation, or tenant-level abuse controls when configured thresholds are crossed. Ops dashboards may show aggregate or pseudonymous Kids analytics, but user-level enforcement is driven by restricted security/risk systems with audit trails.

---

## 8. Entitlement, Quota, and Billing Security

### 8.1 Entitlement Rules

- Enablement does not grant permanent execution rights.
- Relay must perform use-time checks on every execution.
- Subscription expiry, plan downgrade, quota exhaustion, archived status, or disabled Skill must block the next request.
- Direct Relay calls must not bypass marketplace enablement.
- Deprecated Skills can execute only for already-enabled and still-entitled users.

### 8.1.1 Quota Reservation and Compensation

Free Skill quota must use request-scoped reservation, not irreversible pre-decrement without recovery.

Required flow:

1. Before provider call, create an idempotent quota reservation keyed by `request_id` or execution id.
2. If the call succeeds and produces usable output, commit the reservation as consumed.
3. **Compensation principle (principle-based, not enumeration-based)**: Any request that is blocked or fails **before the provider produces usable output** must trigger an idempotent compensation command that restores the reserved quota. This includes — but is not limited to — `SKILL_INTERNAL_ERROR`, `SKILL_TIMEOUT` without usable output, `SKILL_CONTEXT_TOO_LONG`, `SKILL_PLAN_REQUIRED`, `SKILL_QUOTA_EXCEEDED` re-check failure, `kids_mode_blocked`, safety pre-flight blocks, entitlement failures, and any other mid-Relay rejection before provider response. Do not implement compensation as an explicit allow-list of error codes; the invariant is: **no usable provider output → restore quota**. New error codes introduced in future sprints automatically qualify for compensation unless Finance explicitly approves consuming quota without usable output.
4. If the user aborts before any usable output is delivered, compensate.
5. If streaming timeout occurs after usable partial output was delivered, quota treatment follows the Finance/Product streaming settlement policy and must be consistent with the billing event.

Quota compensation must be retry-safe. Duplicate timeout callbacks, worker retries, or delayed provider errors must not over-refund quota. Redis counters require a durable reservation/compensation ledger or equivalent idempotency store for reconciliation.

**Dangling reservation TTL (pod crash safety net)**: The Redis quota reservation key must carry a physical TTL of `max(skill.timeout_seconds + 10, 60)` seconds. If the Relay/Gateway process dies, is OOM-killed, or is evicted by Kubernetes before it can actively commit or compensate, Redis automatically expires and releases the reservation at TTL. The application must still attempt proactive compensation immediately on any error path; the TTL is strictly a last-resort safety net against process termination, not a substitute for explicit compensation logic. After TTL release, the Relay must not attempt further compensation for that `request_id` (the slot was already returned by Redis). The durable compensation ledger must treat TTL-released reservations as already compensated to prevent double-refund.

Quota compensation applies only to the business/monthly quota ledger. Gateway abuse controls are separate: rate-limit token buckets, concurrency semaphores, IP/user/provider abuse counters, and admin-route preview buckets are never refunded for failed, timed-out, malformed, or compensated requests. A compensated request may restore monthly quota, but it still counts against rate limiting and abuse detection.

### 8.2 Cache Consistency

| Cache | Required Scope | Max TTL | Invalidation |
|---|---|---:|---|
| Public Skill list/detail | status, locale, category | 5 minutes | publish/deprecate/archive/update |
| User enabled state | tenant, user, skill | 60 seconds | enable/disable |
| Entitlement/subscription | tenant, user, plan | 60 seconds | billing webhook, plan change, expiry |
| Kids session state | session/user | session policy | session update |
| Skill execution snapshot | skill/version | 5 minutes | version activation/archive |

On cache miss or stale-risk condition, Relay must prefer source-of-truth validation over allowing execution.

### 8.3 Billing Controls

- Blocked calls must not create `skill_billing_events`.
- Failed calls do not charge by default.
- Partial streaming output defaults to `charge_status='not_charged'` for safety-aborted, provider-error-without-usable-output, preview, and client-disconnect-before-usable-output paths unless Finance approves otherwise.
- Client disconnect after usable streamed output is a billable partial path and must be settled by actual delivered/consumed tokens under Finance-approved policy.
- Streaming timeout after usable partial output is not free by default. If Relay delivered streamed content or provider usage indicates consumed/output tokens before timeout, the billing path must record actual token counts and settle as `pending` or `charged` according to Finance-approved policy.
- For billable partial streaming paths, input-token cost is never prorated after usable output starts. Charge 100% of actual/provider-reported `input_tokens`; prorate only `output_tokens` to delivered/generated output at disconnect or timeout.
- Billing events must use `idempotency_key` to prevent duplicate charges.
- Billing events are append-only financial ledger entries. Refunds, voids, and adjustments must insert compensating events; they must not update a prior charged row in place.
- Revenue dashboards count only Finance-approved charge statuses and must distinguish gross from net attribution. V1 gross attribution counts positive `charged` rows only. Net or reconciliation views must include append-only `refunded`/`voided` compensation rows only as negative adjustments and must never mutate the original charged event.

---

## 9. Rate Limiting, Abuse, and Availability Protection

### 9.1 Rate Limit Dimensions

| Dimension | Requirement |
|---|---|
| User | Prevent account-level abuse and runaway cost |
| IP | Prevent unauthenticated browse scraping and login-adjacent abuse |
| Tenant | Prevent one tenant from exhausting shared capacity |
| Skill | Prevent one Skill from causing provider/cost spike |
| Provider/model | Prevent provider overload |
| Admin routes | Protect write operations and preview execution |

Rate-limited responses use `SKILL_RATE_LIMITED`, HTTP 429, and `Retry-After`.

### 9.2 Circuit Breakers

| Breaker | Condition | Action |
|---|---|---|
| Skill timeout risk | 5+ timeouts per Skill per hour or timeout rate > 5% with >= 20 executions | Mark `timeout_risk=true`, alert Engineering/Ops |
| Provider failure | Provider error rate > 10% over 5 minutes | Stop routing new Skill traffic to provider if safe whitelist fallback exists |
| Safety spike | Prompt injection or safety violation spike | Alert Security/Safety; consider kill switch |
| Billing mismatch | Billing events fail reconciliation | Disable charging for affected path and alert Finance/Engineering |

Fallback must stay within the Skill model whitelist and provider capability policy.

---

## 10. Non-Functional Requirements

### 10.1 Availability and Reliability

| Area | Target |
|---|---|
| Marketplace list/detail APIs | 99.9% monthly availability |
| Enable/disable APIs | 99.9% monthly availability |
| Skill Relay execution path | 99.5% monthly availability excluding provider outages |
| Admin Skill management | 99.5% monthly availability |
| Ops dashboards | 99.0% monthly availability |
| Critical alerts | Delivered within 5 minutes of trigger |

### 10.2 Latency and Timeout

| Path | Target |
|---|---|
| Marketplace list API | p95 < 500ms excluding cold cache |
| Skill detail API | p95 < 500ms excluding cold cache |
| My Skills API | p95 < 700ms |
| Enable/disable API | p95 < 700ms |
| Relay pre-provider checks | p95 < 300ms |
| Skill total execution timeout | Default 45s; configurable per Skill between 1s and 120s |
| Ops dashboard query | p95 < 3s for default 7-day range |

Timeout returns `SKILL_TIMEOUT` and emits `skill_timeout_error`. Non-streaming timeout or timeout with no usable output creates no charge by default and must trigger eligible quota compensation. Streaming timeout after usable partial output follows partial-timeout billing rules and may be charged by actual delivered/consumed tokens.

### 10.3 Scalability

| Capability | Requirement |
|---|---|
| Public list/detail | Supports cacheable read-heavy traffic |
| Relay checks | Avoid N+1 DB calls; use scoped metadata and entitlement caches |
| Analytics writes | Event ingestion handles burst traffic without blocking user response where possible |
| Dashboard queries | Use indexed/aggregated sources for common ranges |
| Admin writes | Low QPS but strong audit and consistency requirements |

### 10.4 Degradation

| Failure | Expected Behavior |
|---|---|
| Analytics pipeline down | User path continues; events queued or quarantined; alert Data/Engineering |
| Billing attribution down | Execution may continue only if finance policy allows; otherwise fail closed for paid paths |
| Entitlement service uncertain | Fail closed for paid Skills |
| Safety service uncertain in Kids mode | Fail closed |
| Provider unavailable | Retry/failover only within whitelist; otherwise graceful error |
| Marketplace feature flag off | Hide entry points but preserve data and admin access |

---

## 11. Observability and Audit

### 11.1 Logs

Logs must include:

- `request_id`
- route or execution stage
- `tenant_id` where applicable
- `user_id` where allowed
- `skill_id`
- `skill_version_id` for execution
- error code or block reason
- latency and timeout fields

Logs must not include `instruction_template`, raw full user input, raw Kids input, provider raw payload, or full model output.

### 11.2 Metrics

P0 metrics:

- Skill execution count, success rate, block rate, timeout rate
- latency p50/p95/p99 for APIs and Relay stages
- prompt injection detections
- safety violations
- Kids blocks and violations
- provider error rate
- billing event creation/reconciliation failures
- event ingestion rejection/quarantine count
- cache hit/miss and stale fallback count

### 11.3 Audit

Audit is required for:

- create/update/publish/deprecate/archive Skill
- create/activate/archive Skill version
- view or edit `instruction_template`
- change model whitelist, entitlement, timeout, Kids flags, or featured flag/rank
- Kids approval, rejection, revocation, or override
- export operation
- kill switch activation/deactivation

Audit records must not include prompt text; use hashes and changed field names.

---

## 12. Feature Flags, Kill Switches, and Rollback

### 12.1 Required Controls

| Control | Scope | Owner |
|---|---|---|
| `marketplace_enabled` | Hide/show marketplace entry and APIs as configured | Product/Engineering |
| `skill_execution_enabled` | Disable Skill execution globally | Engineering |
| `skill_id_enabled` | Disable one Skill | Super Admin/Incident Commander |
| `kids_mode_enabled` | Enable/disable Kids paths | Safety/Legal/Product |
| `recommendation_rails_enabled` | Disable P1 rails | Product/Growth |
| `provider_enabled` | Disable provider/model path | Engineering/Security |
| `billing_for_skills_enabled` | Disable paid charging path | Finance/Engineering |

Emergency controls for `skill_id_enabled`, `kids_mode_enabled`, `provider_enabled`, and `skill_execution_enabled` must support urgent invalidation/broadcast across all Relay/Gateway instances. Safety-critical disablement must not wait for the normal cache TTL; target propagation is immediate best effort and no more than 5 seconds under healthy infrastructure.

### 12.2 Rollback Requirements

- Publishing a new `skill_version` must support rollback to the previous active version.
- Rollback must preserve usage, billing, and audit history.
- Rollout percentage must not route users to inactive or archived versions.
- Emergency archive or kill switch must prevent new execution immediately after urgent cache invalidation/broadcast.

---

## 13. Error Handling

### 13.1 Standard Errors

Use Data/API Spec error codes:

| Code | Security Handling |
|---|---|
| `AUTH_REQUIRED` | No resource details in response |
| `SKILL_NOT_FOUND` | Do not reveal cross-tenant or unpublished existence |
| `SKILL_NOT_PUBLISHED` | Generic unavailable message |
| `SKILL_NOT_ENABLED` | No prompt load |
| `SKILL_PLAN_REQUIRED` | No prompt load; upgrade CTA allowed |
| `SKILL_SUBSCRIPTION_INACTIVE` | No prompt load; renew CTA allowed |
| `SKILL_QUOTA_EXCEEDED` | 429; include retry guidance |
| `SKILL_KIDS_MODE_BLOCKED` | No prompt load; safe UX copy |
| `SKILL_CONTEXT_TOO_LONG` | Do not echo full input |
| `SKILL_RATE_LIMITED` | 429 with `Retry-After` |
| `SKILL_TIMEOUT` | No internal provider trace |
| `SKILL_SAFETY_VIOLATION` | Safe replacement or block; no leaked policy |
| `SKILL_INTERNAL_ERROR` | Generic message with request id |

### 13.2 Secure Error Rules

- Errors must include `request_id`.
- Errors must not expose hidden prompt, provider raw payload, stack trace, model credentials, or policy internals.
- Cross-tenant, unpublished, and unauthorized access may use generic not-found/forbidden responses.
- Blocked and failed calls do not charge by default.

---

## 14. Security Testing and Acceptance Criteria

### 14.1 P0 Security Tests

| Test | Required Assertion |
|---|---|
| Prompt leakage API test | No user/public/ops/support API returns `instruction_template` |
| Prompt leakage log test | Logs, analytics, billing, audit, and errors contain no prompt text |
| Prompt extraction jailbreak corpus | Model output does not reveal hidden instruction; blocked outputs emit safety event |
| Indirect injection corpus | User input cannot override policy precedence |
| Kids spoof test | Client-provided `is_kids_session` is ignored |
| Kids unsafe Skill test | Non-Kids-Safe Skill blocks before prompt injection |
| Entitlement bypass test | Direct Relay request from unauthorized user blocks before prompt injection |
| Tenant isolation test | Tenant A cannot read or execute Tenant B state |
| Model whitelist test | Relay never routes outside whitelist |
| Model entitlement intersection test | Free user cannot reach premium model through Free Skill whitelist; empty intersection returns plan/model entitlement error |
| Free token cap test | Free/free-quota request over active version `max_input_tokens_snapshot` returns `SKILL_CONTEXT_TOO_LONG` before provider call; truncation must NOT occur on the free-quota path |
| Unsupported model boundary test | Sensitive/Kids Skills cannot use models without reliable system boundary |
| Kids provider ZDR test | Kids execution cannot route to providers/models without approved DPA, no-training, and ZDR/no-retention mode |
| Rate limit test | 429 and `Retry-After` returned for configured abuse thresholds |
| Timeout test | Timeout returns `SKILL_TIMEOUT`; non-streaming/no-output timeout creates no charge and restores eligible quota; streaming partial timeout follows approved partial billing |
| Quota compensation test | Internal error and provider timeout restore reserved quota exactly once; successful executions consume once; partial streaming timeout follows approved settlement |
| Audit test | Admin writes and prompt access create audit records without prompt text |
| Billing idempotency test | Duplicate execution callback cannot double-charge |
| Append-only billing ledger test | Refund/void inserts compensating event and does not update original charged row |
| Cache invalidation test | Plan expiry/archive/disable blocks next execution within TTL policy; Kids/provider/global execution kill switches propagate within the emergency invalidation target |

### 14.2 NFR Tests

| Test | Required Assertion |
|---|---|
| API performance | Marketplace/detail/My Skills meet p95 targets under expected load |
| Relay stage timing | Pre-provider checks p95 < 300ms |
| Provider outage chaos | Failover only within whitelist or graceful failure |
| Provider transaction boundary | Load test proves provider HTTP calls do not hold database transactions or pooled connections open |
| Cross-provider context budget | Fallback between different provider tokenizers still returns `SKILL_CONTEXT_TOO_LONG` before provider 400 when conservative budget fails |
| Kids analytics identity | Kids execution uses real runtime user for auth/quota/billing, while `skill_usage_events.user_id=NULL` and `session_id=kids_session_pseudo_id` |
| Kids risk enforcement | Repeated severe Kids safety violations can trigger restricted Auth/Risk account-level action without relying on analytics `user_id` |
| Deprecated patch rollout | Deprecated Skill safety patch activates for existing enabled entitled users and remains hidden/unavailable to new or disabled users |
| Analytics degradation | User path survives event pipeline outage where policy allows |
| Dashboard performance | Default dashboard p95 < 3s |
| Alert freshness | Critical alerts fire within 5 minutes |
| Export permission | Non-authorized roles cannot export; exports contain no restricted fields |

### 14.3 Launch Acceptance

1. Every P0 threat in Section 2 has an implemented control and passing test.
2. `instruction_template` is absent from all non-Super-Admin surfaces and all telemetry.
3. Relay blocks unauthorized, unsafe, stale, over-quota, rate-limited, and unsupported-model requests before prompt injection.
4. Kids mode is either disabled by default or has full Kids approval, testing, monitoring, and incident response in place.
5. Tenant isolation tests pass for API, Relay, cache, analytics, and audit paths.
6. Rate limiting, timeout, circuit breaker, and kill switch tests pass.
7. Billing idempotency and no-charge-for-blocked/failed behavior pass.
8. NFR p95 and alert freshness targets pass in staging load test.
9. Security sign-off, Safety sign-off if Kids enabled, Finance sign-off if charging enabled, Legal/Privacy sign-off for provider DPA/IP/output terms, and QA sign-off are recorded.

---

## 15. Security Decision Defaults and Launch Gates

| ID | Decision | Recommended Default | Owner | Blocking |
|---|---|---|---|---|
| SEC-01 | Is Kids mode GA in V1? | Disabled or closed beta unless all Kids controls pass | Product + Safety + Legal | Kids release |
| SEC-02 | Which providers are approved for reliable system boundary? | Maintain explicit allowlist | Security + Engineering | Model whitelist |
| SEC-03 | Is Skill billing allowed to continue if attribution pipeline is down? | Fail closed for paid paths until Finance approves fallback | Finance + Engineering | Paid launch |
| SEC-04 | Which encryption mechanism protects `instruction_template`? | DB/storage encryption plus restricted access; field encryption if available | Security + Backend | Production launch |
| SEC-05 | Are streaming Skill responses launch P0? | No unless streaming safety and billing tests pass | Product + Engineering | Streaming launch |
| SEC-06 | Are provider DPA, retention, ZDR/logging, region, and output/IP terms approved? | No production provider traffic until Legal/Privacy and Security approve | Legal/Privacy + Security | Production provider launch |
