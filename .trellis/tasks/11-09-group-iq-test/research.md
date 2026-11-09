# Repository Evidence for Scheduled Group IQ Tests

## Confirmed Existing Capabilities

- `controller/group.go:14`: administrator-facing groups are sourced from configured group ratios; user-visible groups are filtered separately by usability.
- `service/group.go:111`: `GetGroupsEnabledModels` enumerates enabled models across specified groups and deduplicates their names. Group-specific model enumeration is also available through `model.GetGroupEnabledModels` (`model/ability.go:53`).
- `controller/channel-test.go:73`: existing channel tests bind a specific channel and resolve a test user. They do not directly represent the customer-visible group-routing test requested here.
- `controller/channel-test.go:702`: existing test requests use short fixed prompts such as `hi` and `a cute cat`; multiple endpoints use a 16-token budget. Reusing these defaults would not produce a meaningful pelican HTML/SVG artifact.
- `router/channel-router.go:67`: existing test routes require the channel-operation permission. The new feature needs a deliberate permission boundary rather than anonymous access to these routes.
- `service/system_task.go:34`: existing task-handler registration and scheduled-handler interfaces provide a reusable execution foundation.
- `service/system_task.go:123`: the task runner is master-node-only and polls with lock/lease handling; do not add an independent uncoordinated scheduler without first evaluating this facility.
- `service/codex_credential_refresh_task.go:33`: other periodic services also guard startup with `common.IsMasterNode`.
- `web/src/components/html-content.tsx:19`: DOMPurify is already available. This is evidence of an existing sanitization dependency, not evidence that the current generic HTML component is sufficiently restrictive for model-generated SVG. HTML/SVG previews must treat model output as untrusted, isolate it from the host application, prevent external resource loading, and avoid inserting unsanitized model output into the application DOM. The user approved lightweight isolated JavaScript support for Canvas/animations; the generic HTML component forbids script elements and therefore cannot satisfy that requirement as-is. The precise origin/capability boundary and residual limits are described in `research/preview-security.md`.
- `web/package.json`: the frontend uses React 19, TypeScript, TanStack Router/Query, existing UI components, Vitest, and DOMPurify.
- Repository search did not identify an existing pelican/IQ-test feature.

## Confirmed Output Format

The user clarified that the test calls text models and requests a finished HTML artifact; models may also return standalone SVG. This is not an image-generation feature. The complete example prompt is preserved in `prd.md` and is the proposed editable default.

Plan extraction of HTML/SVG from model response text, including fenced code. Do not require SVG exclusively, convert the request into an image-generation call, or treat prompt language requesting a file as proof that an attachment API is available.

## Model Selection and Routing

- `model/ability.go:18`: model availability is recorded per group, model name, and channel ID; the same model may be served by multiple channels in a group.
- `model/ability.go:53`: enabled models can be enumerated separately for each group. The default group's catalog deliberately filters default-only upstream entries, which must be considered when reusing this helper for an administrator selector.
- `service/channel_select.go:114`: normal requests choose a channel for a group/model using the current routing rules; testing a selected group/model once is not equivalent to exhaustively testing every backing channel.

The user confirmed explicit administrator selection of the tested models and then clarified "只测分组就行" / "只测一次就行". Each execution attempts a selected group/model once through ordinary routing; do not automatically run every available model, enumerate channels, or take repeated samples. Recurring scheduling remains approved. The final-review proposal is no automatic retry/failover or crash replay.

## Scheduling Evidence and Confirmed Modes

- `service/system_task.go:42`: the current scheduled-handler contract exposes an interval, not a daily wall-clock time or timezone.
- `service/system_task.go:263`: the scheduler skips pending/running tasks and compares the latest task's `UpdatedAt` against the handler interval. This is completion-relative scheduling, not a fixed daily timetable.
- A user requirement for daily scheduled times must therefore preserve explicit timezone and next-run semantics rather than incorrectly treating this existing interval check as a calendar scheduler.

The user approved both an interval mode (every N hours) and a daily fixed-time mode after the recommendation to default fixed times to Beijing time (Asia/Shanghai). The initial UI should make the selected mode and timezone explicit; raw cron expressions are not a requested capability. The final-review proposal skips missed slots, deduplicates active work, recalculates the next due time on schedule edits, and leaves recurring cadence unchanged by manual runs.

## Gallery Access Evidence and Confirmed Audience

- `router/api-router.go:40`: model pricing is exposed using `HeaderNavModuleAuth("pricing")`, rather than being inherently restricted to administrators or always public.
- `middleware/header_nav.go:104`: the navigation access middleware supports disabled, login-required, and public-with-optional-auth modes. Its default is public; reusing it without an explicit policy must not accidentally publish IQ results.
- `controller/group.go:26`: the ordinary group list is filtered by the current user's usable groups. Gallery visibility is a separate product policy, not proof that all configured groups should be published.

The user confirmed that viewers must be logged in. This must protect result data and artifact/source access, not merely hide a navigation entry. Anonymous display is not in scope. Group-level visibility filtering is still a proposed final-review default: ordinary viewers see only their usable groups and administrators can inspect all test results. Only administrators may modify prompts, targets, schedules, or trigger chargeable runs.

## HTML Preview Fidelity Decision

The existing generic HTML component forbids scripts (`web/src/components/html-content.tsx:86`). That makes it unsuitable as-is for an HTML artifact that draws entirely using canvas JavaScript or drives animations with JavaScript.

After asking about sandbox complexity and receiving an explanation, the user approved preserving animations/Canvas using lightweight browser-native isolation. Use an iframe sandbox with an opaque origin (no `allow-same-origin`) and a trusted restrictive content-security policy, rather than adding Docker/VM/container services or a server-side screenshot farm. Preserve self-contained HTML/JavaScript behavior while enforcing isolation from host DOM/credentials and restrictions on external resources, popup/top navigation, and downloads.

This architecture still requires deliberate handling of document extraction, navigation/external-resource paths, preview lifecycles, and adversarial tests; adding a sandbox attribute alone is not a complete security guarantee. CPU/memory abuse and browser limitations must be considered in design. Do not claim that CSP universally blocks all navigation or that arbitrary generated scripts cannot consume browser resources. Do not enable scripts in the existing generic HTML component globally.

## Execution, Retention, and Operational Evidence

- `controller/system_task_handlers.go:20`: existing scheduled handlers are wired in the controller layer. Keep IQ orchestration there to reuse relay/middleware/service without introducing a service-to-controller import cycle.
- `controller/channel-test.go:506`: current model tests record resource/usage logs through `RecordConsumeLog`; their result type does not return an artifact body. A narrow custom-request/response extension is needed, not the existing hard-coded connectivity request.
- `relay/common/relay_info.go:632`: `UsingGroup` is read from `ContextKeyUsingGroup`. The IQ executor must set it to the tested group and not implicitly use the root operator's home group.
- `model/system_task.go:29`: task rows contain generic payload/state/result fields and durable active-key/lease metadata. Store bounded checkpoints there as appropriate, not full HTML artifacts in publicly/listed task payloads.
- `model/main.go:345`: additive primary database migrations register existing models through AutoMigrate. Large artifact strings need a portable explicit large-text column definition, especially for MySQL.
- `web/src/hooks/use-sidebar-data.ts`: easy and developer console modes have different navigation arrays. The authenticated gallery should be reachable in both modes without becoming an operator-only page.
- `web/components.json`: this project uses the installed Base UI/shadcn setup; no new UI library or iframe service is necessary.
- `web/package.json`: Bun scripts provide Vitest, type checking, lint, formatting, build, and i18n sync. Bun/Go are installed, but `web/node_modules` is absent at this planning checkpoint; no business-code test has been run or claimed.

The final-review defaults are latest-only artwork storage, no artwork-history UI, site-funded bounded test execution, schedule-disabled deployment, and usable-group-filtered authenticated access. These defaults were subsequently approved by the user before implementation. Operational task/audit traces remain distinct from artwork history and should not be cleaned up by latest-result replacement.

The first MDN browser read produced a tool-managed spill file outside the repository. It is inventoried in `.group-iq-test-temp-artifacts.md` as a non-business intermediate output; do not delete it or the inventory until the user agrees at completion. Trellis logs are excluded from that cleanup.

## Git Tracking Note

The repository ignores `.trellis/` in `.gitignore:49`, although many existing task artifacts are explicitly tracked. This task's intended planning/spec artifacts must be explicitly included in the eventual Git commit; disposable session pointers and other unrelated files must not be swept into that commit.
