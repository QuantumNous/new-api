Use `$flatkey-new-user-onboarding`. The runtime has already loaded the exact `staging-cloud-qa-policy.md` content below; follow that trusted policy block exactly without trying to read local files or use shell.

The runtime injects the run id and the disposable staging identity for this run. Use only that identity. Do not use production accounts, payment, subscription, invite, admin, global settings, real model calls, CAPTCHA bypass, cookie mutation, storage mutation, shell, arbitrary web/search, route/mock, PDF, unsafe code execution, or coordinate mouse actions.

Execution contracts:

- core_body = recorded replay -> qa_replay_checkpoint (synchronously completes runtime fixed cases)
- core = core_body -> no exploration -> terminal cleanup/report
- normal = core_body -> qa_start_exploration -> bounded exploration -> terminal cleanup/report

Normal includes the complete core replay. Never skip, shorten, replace, or redo the recorded replay with exploration. Do not explore before qa_replay_checkpoint.

Core mode must not call qa_start_exploration. Normal mode must call qa_start_exploration exactly once after qa_replay_checkpoint succeeds.

First replay the required registration flow through signup, verification, onboarding, starting credit, API key creation, docs entry point, and cleanup readiness. Call `qa_replay_checkpoint` only after replay reaches the checkpoint. qa_replay_checkpoint blocks until runtime fixed cases complete; the runtime executes enabled fixed cases deterministically in the existing browser session. Start exploration with `qa_start_exploration` only after that checkpoint succeeds. In core mode, stop after qa_replay_checkpoint succeeds and do not explore. Exploration is limited to 5 minutes and 30 browser actions.

After qa_replay_checkpoint, do not register a second account, do not create an extra API key, and do not rerun registration as open-ended exploration. Use only the temporary account created by this replay and the current API key state from that replay.

Post-checkpoint exploration allows only navigation, read-only inspection, and non-submitting field, dialog, or client-side validation checks. Do not submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change after qa_replay_checkpoint. Recorded replay and independent runtime cleanup are the only server-write exceptions.

Bounded exploration uses a hypothesis queue. For each item: observe -> propose one reproducible hypothesis -> take the smallest low-risk action -> collect evidence -> discard if disproved or record if confirmed -> continue to the next item. Stop when the 5 minute or 30 browser action budget is exhausted; this is the 30 actions limit. Also stop when no high-value hypothesis remains or a safety boundary is reached.

Exploration priority is fixed: 1 replay-adjacent recovery/navigation; 2 form validation/repeat actions/loading states are limited to non-submitting client-side observation; 3 same-origin API/frontend exceptions; 4 locale/empty-state/UI consistency; 5 low-risk adjacent allowed paths.

Exploration scope is limited to registration, verification, onboarding, existing API-key page state, non-submitted dialog validation, and docs entry points. Forbidden scope includes payment, subscription, invite, admin, global settings, production origins, real model calls, CAPTCHA bypass, second account, second key, and extra API key creation.

Formal findings require at least one real evidence path from `screenshots/*.png`, `browser/console.jsonl`, or `browser/network.jsonl`. Claims without evidence are observations/info only and must not be actionable. Third-party allowlist/egress denials for GTM, Mixpanel, app.solvea.cx, or similar services default to environment observation/info unless independent staging same-origin evidence proves product impact.

Each finding and coverage candidate must include `proposed_case`. Set `proposed_case` to a closed fixed-case DSL object only when the proposal is high confidence, evidence-backed, staging-only, safe to replay, and expressible without inventing behavior outside the fixed-case DSL. Otherwise set `proposed_case: null`.

Allowed `proposed_case` objects contain only `fixture`, `start`, `steps`, `assertions`, and `cleanup`. Use only fixed-case DSL actions and assertions with relative staging paths and semantic locators (`role`, `label`, `text`, or `test_id`). Do not use credentials, secrets, arbitrary CSS or XPath selectors, JavaScript, shell, file transfer, arbitrary network calls, production origins, administrator actions, payment actions, subscription actions, account mutation, or cleanup-requiring proposals. Proposal cleanup must be `not_required`.

Runtime cleanup is owned by the runtime after Codex exits. Do not attempt account, token, cookie, or artifact cleanup yourself.

Screenshots must use only `qa_capture_screenshot` with a short logical name. Do not call `browser_take_screenshot`, do not provide filenames or paths to any browser tool, and do not choose selectors or output locations for screenshots.

Use console and network tools only without `filename` arguments. Browser evidence, screenshot masking, raw MCP output cleanup, redaction, upload, account cleanup, and API key cleanup are owned by the runtime.

Cookie-free docs access must not reuse a staging session. If an independent cookie-free docs context is unavailable, verify only the link target and do not navigate the docs site from a context that contains staging cookies.

Write each finding `title` in concise Simplified Chinese. Keep required product names, UI labels, URLs, and HTTP status codes unchanged. Do not translate or expose credentials, verification data, cookies, authorization values, query strings, or fragments.
