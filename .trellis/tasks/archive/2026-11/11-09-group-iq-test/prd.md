# Scheduled Group IQ Tests and Result Gallery

## Goal

Provide a repeatable, administrator-configured visual capability test for text models in selected routing groups. Signed-in viewers compare finished HTML/SVG artwork in a grouped gallery inspired by the user's screenshot. "IQ" is a feature label, not a claim of standardized intelligence measurement.

## Background and Evidence

- Existing groups and group-specific enabled-model lists are available (`controller/group.go:14`, `model/ability.go:53`).
- Existing channel tests are short-prompt connectivity checks, not this feature (`controller/channel-test.go:702`).
- Existing system-task registration and a master-node task runner provide an execution foundation (`service/system_task.go:34`, `service/system_task.go:123`).
- Repository evidence, scope decisions, and preview-security limitations are recorded in `research.md` and `research/preview-security.md`.
- The user approved the final proposal and explicitly authorized implementation on 2026-11-09. They requested only focused, useful verification rather than excessive or unrelated testing.

## Requirements

### Confirmed Scope

- **R1 — Editable prompt:** Administrators configure the test prompt. The user-supplied prompt below is the proposed initial template; it is not an immutable benchmark.
- **R2 — Explicit group/model targets, one attempt:** Administrators select concrete routing groups and explicitly check the models to test in each group. Each execution attempts each selected group/model once through normal group routing. Do not enumerate backing channels, test unselected models, or run repeated samples. "Once" applies to each scheduled execution, not removal of the recurring schedule.
- **R3 — Two scheduling modes:** Support both every-N-hours and daily fixed-time schedules. Display the timezone for daily execution, defaulting to Asia/Shanghai (Beijing time).
- **R4 — Grouped comparison:** Show group sections with model-labeled artwork preview cards and test time. Indicate pending/running, success, timeout, unavailable model, and invalid-artifact outcomes honestly; do not display a failed test as a new successful artwork.
- **R5 — HTML/SVG and lightweight isolation:** Call text models, not image-generation models. Support complete HTML and standalone SVG returned directly or inside Markdown code fences. Preserve self-contained JavaScript/Canvas artwork and animations using browser-native isolation, without an additional sandbox service. Never execute generated code in the main application document or expose host credentials to it. Restrict external subresource loading; do not equate browser sandboxing with a hardened VM or a guarantee against all network/navigation or CPU-abuse scenarios (see the security research).
- **R6 — Authentication and administration:** Require login for the gallery and associated result/artifact/source data. Only administrators can change prompts, targets, schedules, or initiate a chargeable test run.

### Approved First-Version Defaults

- **R7 — Latest results only:** In the first version, show and retain only the latest terminal result/artifact for each currently selected group/model. Do not add a user-facing historical-run browser. During an active run, prior results remain clearly timestamped until each replacement finishes. Existing operational task/audit metadata is not artwork history and must not be erased by this policy.
- **R8 — Bounded execution and costs:** Upstream tests consume site/provider resources, not the viewing user's balance. Do not deduct end-user quota merely for viewing results. Do not automatically retry/fail over a failed pair, repeat incomplete work after a crash, or generate extra samples. Provide an administrator-only manual run and a schedule enable/disable control; schedules are disabled initially. Proposed safety defaults are two concurrent pairs, a three-minute per-pair timeout, a 16,384-token output limit, and at most 100 selected pairs. These bounds limit exposure but are not a guaranteed currency budget.
- **R9 — No duplicate or catch-up batches:** Allow at most one active IQ batch across application instances. Skip missed schedule slots after downtime rather than replaying them. If a batch is still active, do not enqueue another overlapping batch. Saving schedule changes recalculates the next run; a manual run does not reset the recurring schedule.
- **R10 — Group visibility:** An ordinary signed-in viewer sees only results for groups they are currently allowed to use. Administrators can inspect all configured IQ groups. Restrict artifact/detail access using the same rule, not just the gallery filter.

## User-Supplied Prompt

> 画一个鹈鹕骑单车的HTML，我要的是最高水准的完成品，不要草稿，黄昏氛围，角色有表情和配饰，场景有远近层次，动作自然，带一个小彩蛋，你先想好整体的设计再动手，不用测试，直接发我文件

"Send me the file" is part of the benchmark prompt, not proof that a model supplies an attachment API. Collect the returned artifact content; a response containing only a file path, a tool call, or an external download link is not a completed artwork. Do not follow model-provided URLs or execute file-generation tools.

## Acceptance Criteria

- [x] **AC1 (R1):** An administrator can save/update the prompt, and a later execution receives that exact saved user prompt.
- [x] **AC2 (R2, R8):** With multiple selected pairs, each pair has at most one execution attempt in a batch; unselected models and additional backing channels receive no calls. Provider failure does not trigger a second IQ request.
- [x] **AC3 (R3, R9):** Deterministic-clock tests cover every-N-hours, daily Beijing time, crossing midnight, edits, disabled schedules, missed slots, and overlapping/manual runs without duplicate batches.
- [x] **AC4 (R4, R7):** Group sections contain model identity, last-tested time, and honest outcome states; successful cards open a larger preview. Only the latest result for each selected pair is presented, and stale results are not labeled as belonging to the active run.
- [x] **AC5 (R5):** Direct/fenced HTML and SVG fixtures extract correctly. Missing markup, truncation, unsupported file-only responses, and size overflow produce an explicit invalid/incomplete-artifact state rather than false success.
- [x] **AC6 (R5):** Browser tests verify no parent DOM/storage access, no host credentials passed into the artifact, blocked external subresource fetches, and no popups/top navigation/forms/download permissions. Document the sandbox's residual self-navigation/resource-exhaustion limitations; do not claim complete egress prevention.
- [x] **AC7 (R6, R10):** Anonymous requests cannot obtain the gallery/result/artifact data. Ordinary users cannot configure or execute tests or directly retrieve another restricted group's artifact; administrators retain access to all configured IQ groups.
- [x] **AC8 (R5):** Self-contained JavaScript/Canvas and animation fixtures render in the isolated preview without a separate sandbox server/container service.
- [x] **AC9 (R7):** Replacing a result removes the superseded artwork content from the IQ latest-result store; no unrelated system-task/audit records are deleted.
- [x] **AC10 (R8):** Viewing results never invokes a provider or changes account quota; execution respects the pair/concurrency/timeout/output bounds and records sanitized failure information.
- [x] **AC11 (R9):** Duplicate manual requests, concurrent master-node claims, lease loss, and crash recovery do not replay already-started pair calls. Ambiguous interrupted requests are surfaced as interrupted, not retried.

Focused local evidence and qualification limitations are documented in `research/validation.md`. These checks do not certify live MySQL/PostgreSQL/distributed deployment or provider acceptance; browser self-navigation and resource-exhaustion limitations remain explicit. The user explicitly approved the planned commit and push (“提交推送”).

## Out of Scope

- Image-generation APIs and raster-image generation workflows.
- Exhaustive per-channel checks, repeated sampling, automatic judge models, numeric scoring, or a leaderboard.
- Additional VM/container sandbox services, screenshot farms, arbitrary code-hosting, external asset browsing, or attachment-tool execution.
- Multiple independently scheduled prompt suites, arbitrary cron expressions, artwork history UI, and production test execution during development without separate authorization.

## Implementation Approval and Verification Scope

The user approved R1–R10 and the summarized final plan, then said: “可以开始，记得写完不要做过多无用的测试”. Proceed after task activation. Use a compact set of focused backend/frontend checks for scheduling, single-attempt execution, access controls, extraction and preview isolation, plus necessary static/build validation. Do not repeatedly run unrelated full suites, create large redundant test matrices, or call production providers. Product/scope changes still require approval.
