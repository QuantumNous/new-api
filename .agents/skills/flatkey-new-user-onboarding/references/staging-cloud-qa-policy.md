# Selected-Environment Cloud QA Policy

## Activation Gate

This policy applies only when the caller explicitly loads this file and provides a concrete selected-environment QA run id.

If the run id is missing, or if this file was not explicitly loaded by the caller, stop using this policy and return to human-confirmation onboarding mode from the parent skill.

## Authorized Purpose

Use this policy only for isolated Flatkey selected-environment onboarding QA:

- Replay the recorded signup, email verification, starting credit, API key creation, documentation navigation, and cleanup-readiness path for the selected environment.
- Explore only bounded, replay-adjacent selected-environment hypotheses after replay checkpoint.
- Produce a concise QA report with checkpoint state, failures, cleanup state, and redacted artifacts.

Execution modes are fixed:

- core_body = recorded replay -> qa_replay_checkpoint (synchronously completes runtime fixed cases)
- core = core_body -> no exploration -> terminal cleanup/report
- normal = core_body -> qa_start_exploration -> bounded exploration -> terminal cleanup/report

Normal includes the complete core replay. Exploration cannot skip, shorten, replace, or stand in for the recorded replay.

## Identity Rules

Only use a deterministic run-scoped disposable QA identity assigned for the run id and selected environment.

Allowed identity properties:

- A run-scoped disposable email alias or mailbox identifier.
- A run-scoped username/display name.
- A run-scoped disposable password only when explicitly provided as disposable QA material by the caller or test harness.

Secrets and sensitive values must stay out of chat, logs, filenames, screenshots, and reports:

- Do not reveal the Gmail base address.
- Do not reveal the full plus alias.
- Do not reveal passwords.
- Do not reveal verification codes.
- Do not reveal cookies.
- Do not reveal `Authorization` headers.
- Do not reveal full API keys.

Use redacted forms such as `<qa-email-redacted>`, `<verification-code-redacted>`, and `sk-...<redacted>`.

## Origin Boundary

Writable browser actions are allowed only on the exact selected website and selected console origins supplied by the caller or test harness for this run.

For staging, the selected writable origins are `https://staging-website.flatkey.ai` and `https://staging-console.flatkey.ai`.

For production, the selected writable origins are `https://flatkey.ai` and `https://console.flatkey.ai`, and writes are limited to the recorded replay for the run-scoped disposable QA identity plus independent cleanup for that same run.

Forbidden writable origins include any Flatkey website or console origin that is not the exact selected origin for the run.

`https://docs.flatkey.ai` may be opened only for read-only documentation lookup in an independent no-cookie browser context. Do not reuse a signed-in staging console context for docs. Do not write, authenticate, submit forms, or carry cookies/session storage into the docs context.

If the browser is on an origin that is not explicitly authorized for the current run, stop before clicking, typing, submitting, accepting terms, creating keys, deleting resources, or mutating state.

## Authorized Actions

When this policy is active and origin checks pass, the agent is authorized to:

- Accept selected-environment Flatkey terms that are presented as part of creating the disposable QA account.
- Create the disposable QA account assigned to the run id.
- Claim selected-environment starting credit for that disposable account.
- Create a temporary selected-environment API key for the run id.
- Delete the temporary selected-environment API key only as part of reaching a cleanup-ready checkpoint.
- Delete the disposable QA account only as part of reaching a cleanup-ready checkpoint.
- Read docs in an independent no-cookie context.

After `qa_replay_checkpoint`, authorized normal-mode exploration may inspect only the replay-created temporary account and existing API key page state. Post-checkpoint exploration allows only navigation, read-only inspection, and non-submitting field, dialog, or client-side validation checks. Form validation/repeat actions/loading states are limited to non-submitting client-side observation.

Do not submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change after qa_replay_checkpoint. Recorded replay and independent runtime cleanup are the only server-write exceptions.

These authorizations do not apply to real users, non-selected origins, or non-run-scoped accounts.

## Forbidden Actions

Never perform these actions under this policy:

- Use non-selected Flatkey website or console origins for writable actions.
- Purchase, subscribe, upgrade, add payment methods, or change billing.
- Send invitations or add users.
- Change admin, organization, workspace, global, model, routing, pricing, provider, or security settings.
- Make real model calls with a live Flatkey API key.
- Use a non-disposable or personally owned account.
- Persist credentials beyond the run-scoped browser/session state required for QA.
- Do not bypass, forge, replay, outsource, or solve CAPTCHA/Turnstile through a third-party service.
- Bypass, solve externally, outsource, or work around CAPTCHA, Cloudflare, or Turnstile challenges.
- Submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change after `qa_replay_checkpoint`, except for the recorded replay before the checkpoint and independent runtime cleanup after Codex exits.
- Register a second account, create a second key, create an extra API key, or rerun registration as open-ended exploration after the replay checkpoint.

CAPTCHA, Cloudflare, and Turnstile fail closed. If encountered, stop the run, record only the blocked boolean state with redactions, and do not proceed to account creation, key creation, exploration, or cleanup mutations. Never record token, widget response, query string, cookie, verification code, or challenge content. If the selected environment is production and CAPTCHA/Turnstile normally blocks registration or verification before `qa_replay_checkpoint`, report runtime classification `human_verification_blocked`.

## Replay And Exploration Gates

Replay comes before exploration. Do not explore before qa_replay_checkpoint.

Core mode is replay-only. Core mode must complete core_body by finishing the recorded replay and calling `qa_replay_checkpoint`, which synchronously completes runtime fixed cases. After that successful checkpoint, skip exploration, allow terminal cleanup/report, and do not call `qa_start_exploration`.

Normal mode includes the complete core replay. Normal mode must complete core_body by finishing the recorded replay and calling `qa_replay_checkpoint`, which synchronously completes runtime fixed cases. Then call `qa_start_exploration` exactly once after `qa_replay_checkpoint` succeeds, run only bounded exploration, and allow terminal cleanup/report.

After replay reaches a state that is safe to clean up, call `qa_replay_checkpoint`. `qa_replay_checkpoint` takes no arguments. Put the run id, redacted account/key identifiers, current URL, and cleanup readiness state in the final result/report narrative, not in MCP tool arguments.

Do not start exploration until `qa_replay_checkpoint` has returned successfully after runtime fixed cases finish.

Before exploratory browser actions, call `qa_start_exploration`. `qa_start_exploration` takes no arguments. Put the run id, current URL, authorized staging origins, and remaining budget in the final result/report narrative, not in MCP tool arguments.

If replay fails before reaching a cleanup-ready state, do not enter exploration. Report the replay failure and wait for supervisor or cleanup-job direction. If production replay fails because CAPTCHA/Turnstile normally blocks registration or verification, stop without solving it and report only sanitized `human_verification_blocked` state.

Do not register a second account, do not create an extra API key, and do not use exploration to create a second key. Use only the temporary account created by this replay and the current API key state from that replay.

After `qa_replay_checkpoint`, do not submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change. Recorded replay and independent runtime cleanup are the only server-write exceptions.

## Exploration Budget

Exploration stops when the first limit is reached:

- 5 minutes of wall-clock time after `qa_start_exploration`.
- 30 browser actions after `qa_start_exploration` (the same budget may be described as 30 Playwright actions in tests or reports).

Count Playwright actions that mutate or navigate browser state, including click, fill, type, press, select, check, uncheck, navigate, reload, file upload, dialog accept/dismiss, and any script evaluation that changes page state. Read-only inspection and screenshots do not count unless they trigger page mutation.

When the budget is exhausted, stop taking browser actions and produce the QA report.

## Bounded Hypothesis Exploration

Normal-mode exploration must use a bounded hypothesis queue. For each item:

1. Observe.
2. Propose one reproducible hypothesis.
3. Take the smallest low-risk action.
4. Collect evidence.
5. Discard the hypothesis if disproved, or record it if confirmed.
6. Continue to the next hypothesis.

Stop exploration when the budget is exhausted, no high-value hypothesis remains, or a safety boundary is reached.

Explore in this fixed priority order:

1. replay-adjacent recovery/navigation.
2. form validation/repeat actions/loading states are limited to non-submitting client-side observation.
3. same-origin API/frontend exceptions.
4. locale/empty-state/UI consistency.
5. low-risk adjacent allowed paths.

Allowed exploration surfaces are registration, verification, onboarding, existing API-key page state, non-submitted dialog validation, and docs entry points.

Forbidden exploration surfaces are payment, subscriptions, invitations, admin/global settings, non-selected origins, arbitrary navigation, real model calls, CAPTCHA/Turnstile bypass, second account creation, second key creation, and extra API key creation.

## Finding Evidence And Noise Handling

A formal finding must include at least one real evidence path from `screenshots/*.png`, `browser/console.jsonl`, or `browser/network.jsonl`. A claim without this evidence is observation/info only and must not be actionable.

Failures actively denied by allowlist or egress controls for third-party services such as GTM, Mixpanel, app.solvea.cx, or similar external hosts default to environment observation/info. Do not upgrade them to a formal finding unless independent staging same-origin evidence proves product impact.

## Cleanup Authority

The agent may drive the selected-environment UI only to a cleanup-ready state and may perform policy-authorized temporary key/account deletion when that is part of the selected replay path and origin checks pass.

Final cleanup completion is not decided by model narration. The supervisor and an independent cleanup job decide and verify final cleanup. The report must distinguish:

- `cleanup-ready`: resources are identified and can be cleaned.
- `cleanup-attempted`: deletion controls were used under this policy.
- `cleanup-verified-by-job`: only if the independent cleanup job provides evidence.
- `cleanup-blocked`: a CAPTCHA, missing authority, origin mismatch, or UI failure prevented cleanup.

Do not claim `cleanup-verified-by-job` from browser observation alone.

## Report Requirements

Every selected-environment QA report must include:

- Run id.
- Selected environment and exact selected origins used.
- Whether `qa_replay_checkpoint` was called.
- Whether `qa_start_exploration` was called.
- Replay result.
- Exploration budget consumed, in minutes and Playwright actions.
- Cleanup state using the exact cleanup labels above.
- Redacted account/key identifiers.
- Blockers, including CAPTCHA/Turnstile fail-closed events.
- Confirmation that no Gmail base, plus alias, password, verification code, cookie, `Authorization` header, or full API key was exposed.
