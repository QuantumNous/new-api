# Integration Validation and Review

## State

Implementation and the focused local quality gate are complete. The user
explicitly authorized the planned work commit and push with “提交推送”. Final
commit/archive/session state is recorded in task metadata and the journal.
No production provider was called and automatic schedules remain disabled by
default. Parent is the sole writer; there are no active child writers.

Backend source was handed off successfully. Frontend child
`bd94b386-6670-4798-b39b-c6d3c3aacbd5` and its same-session recovery
`9a37a300-34b1-49fb-b299-7e474c6c5e1d` both failed with `fetch failed` before
producing their final handoff. Existing source and exact command logs were
preserved. The parent continued directly under the user's explicit earlier
approval, performed a full-scope inline review, and made the fixes below.
An independent child review was NOT completed; no such success is claimed.

## Actual Fixes Found During Integration

1. SQLite fixtures inserted duplicate empty unique `users.aff_code` values.
   Give each fixture a distinct nonempty code; do not alter the production key.
2. Router fixture omitted dialect column initialization, causing `SELECT FROM`.
   Initialize the existing SQLite quoting path through `InitLogDB` without
   creating another database; restore global database-type settings on cleanup.
3. Real controller execution requires explicit fixture model pricing; seed and
   restore mock prices rather than relying on production option bootstrap.
4. Browser mode switching reused native number/time inputs and lost values.
   Give interval/daily branches distinct React keys; extend the existing settings
   round-trip test to retain 24 hours and the edited daily time across switches.

## Backend Commands and Results

- Original child command:
  `GOTOOLCHAIN=auto go test ./model ./service ./controller ./router ./relay/channel -run 'TestIQ|TestChannelTestOpenAIChatCompatibility|TestResolveChannelTestUserIDUsesRequestUser' -count=1`
  was prerequisite-download blocked at 300 seconds. It did not pass tests.
- Parent reran the same bounded command once after implementation. Dependency
  setup completed; model, service and relay/channel PASSED. Controller/router
  exposed the fixture issues above. All five packages compiled.
- After initial fixture fixes:
  `GOTOOLCHAIN=auto go test ./controller ./router -run 'TestIQ' -count=1`:
  router PASSED; controller exposed missing explicit pricing. That panic was a
  missing test bootstrap, not a production i18n change.
- After pricing fix:
  `GOTOOLCHAIN=auto go test ./controller -run 'TestIQSingleRoutingAttemptFundingAndGalleryAccess' -count=1` PASSED.
- Final narrow remaining controller/legacy regression:
  `GOTOOLCHAIN=auto go test ./controller -run 'TestIQNativeRequestsAndOutputBounds|TestChannelTestOpenAIChatCompatibility|TestResolveChannelTestUserIDUsesRequestUser' -count=1` PASSED.
- Added one small concurrent enqueue/runner-claim case, then ran only it:
  `GOTOOLCHAIN=auto go test ./model -run 'TestIQConcurrentBatchAndRunnerClaims' -count=1` PASSED.
- Affected Go files formatted with gofmt. The aggregate passing evidence covers
  nine IQ test functions across five packages, including single routing/call
  counts, no repeat after checkpoints, group access, quota/health non-mutation,
  deterministic scheduling, latest replacement, concurrent claims and recovery.

No unrelated backend full suite or live provider/database matrix was run.

## Frontend Commands and Results

Recovered exact commands from the saved frontend session, not inferred from
source file presence:

- `bun run test -- src/features/iq-tests`: four files / nine tests PASSED before
  subsequent targeted fixes; no full frontend suite.
- After preview/gallery fixes:
  `bun run test -- src/features/iq-tests/__tests__/preview-document.test.ts src/features/iq-tests/__tests__/gallery.test.tsx src/features/iq-tests/__tests__/settings.test.tsx`:
  eight assertions passed, but two cleanup-time fixture exceptions made the
  command FAIL. Do not report that invocation as green.
- Child fixed the authenticated settings fixture cleanup, then
  `bun run test -- src/features/iq-tests/__tests__/settings.test.tsx` PASSED
  (two tests), and affected-file oxlint PASSED.
- Affected-feature/navigation oxlint PASSED after local fixes. Commands used
  `node_modules/.bin/oxlint -c .oxlintrc.json` with feature, route, sidebar,
  terminal-layout, easy-task-dock and console-nav paths, never the whole repo.
- `bun run typecheck` and `bun run build:check` PASSED in the child recovery.
- After the parent fixed the actual browser-discovered input identity bug,
  reran ONLY `bun run test -- src/features/iq-tests/__tests__/settings.test.tsx`
  (two tests PASSED), oxlint for those two changed files (PASSED), and
  `bun run build:check` (PASSED). These reruns were required by a real fix.
- Seven locale files each gained 48 keys using the sanctioned insertion script
  and `bun run i18n:sync`; localization test PASSED. No direct locale JSON edits,
  dependency/lockfile upgrades, or package-cache/log files are part of the patch.

## One Local Browser Smoke

Used the real production-built application against a loopback-only Bun mock
server at `127.0.0.1:4311`, session `iq-feature-smoke`. Server, source, screenshots
and JSON evidence are inventoried in `.group-iq-test-temp-artifacts.md`, not
published into web/public or committed. The server and browser were stopped;
files are retained pending user cleanup approval.

Observed:
- Full HTML inline Canvas drew pixels; standalone/nested animated SVG rendered.
- Real sandbox probes reported blocked parent DOM, parent/own localStorage,
  cookies, fetch, worker, popup and top-navigation access. Parent remained on
  /iq-tests. Dynamic image/script/frame/form probes produced no server requests.
- Frames had exactly sandbox=allow-scripts and no-referrer. No real token or
  account data was given to artifact code; smoke tokens/host sentinels were fake.
- Opening the expanded accessible preview unmounted cards: one live iframe.
  Settings paused all card frames; closing/offscreen lifecycle is also unit-tested.
- 390px member view had no document overflow, only the public group, no admin
  settings/run controls and one visible lazy iframe.
- Anonymous reload redirected to /sign-in?redirect=%2Fiq-tests with no artwork.
- Mobile settings dialog measured 358px within 390px, without page overflow;
  daily/interval controls switched. A native automation time fill emptied its
  value, so that attempted browser save was NOT counted as a successful round
  trip. The subsequent keyed-input fix and exact form round-trip are covered by
  the passing focused settings test/build, not a fabricated browser save result.

### Observed residual limitation (not hidden)

The first adversarial fixture dynamically clicked an anchor with a download
attribute. Despite no download sandbox permission, it fell back to navigating
its OWN frame and reached the local /__smoke/egress-download endpoint. It did not
navigate the parent. Saved evidence: self-navigation-observed.json. The initial
frame then had no completed report; that initial probe was not counted as a
successful isolation test. Removing only that deliberately navigating probe
allowed the other capability/subresource checks and Canvas drawing to report.

This confirms the approved lightweight design's documented limitation: not a
universal network air gap, download-behavior guarantee, CPU quota or hostile-code
VM. Do not broaden security claims or silently disable approved active scripts.

## Full-Scope Inline Review

Reviewed all affected backend/frontend seams, migrations, model helpers,
channel-test/transport extension, scheduler integration, route/PAT/RBAC gates,
JSON projections, artifact extraction and wrapper, cache revision/session keys,
iframe lifecycle, settings, both navigation modes and locale coverage. Used
existing exact command evidence rather than rerunning successful/full suites.
Concrete findings above are resolved. No unresolved P0/P1/P2 source finding from
this inline review; an independent-agent review remains unavailable, not passed.

Unexercised qualification: live MySQL/PostgreSQL and distributed deployments,
provider-specific live acceptance (notably Codex output-cap rejection), and a
cross-browser/device matrix. These are explicitly outside this focused local
verification budget and are not represented as passing tests.

## Commit Plan

One cohesive work commit: `feat(iq-tests): add scheduled group artwork tests`.

Include the controller/model/service/router/relay/middleware feature and tests;
frontend feature and authenticated route, both console navigation changes,
generated route tree, all seven locales; the task planning/execution/research
records and new linked backend/frontend executable specs. Explicitly force-add
intended Trellis files because the root ignore excludes that tree.

Exclude temporary inventory, managed smoke/build/translation outputs,
node_modules, package caches/logs, unrelated workspace journals/session pointers
and all other tasks. No unrecognized business changes were observed. The user
confirmed staging/committing and pushing with “提交推送”. Push only the
current iq-test branch, without force, after the work/archive/journal commits.
Archive/journal only after the verified work commit, never before.
