const taskDir = '.trellis/tasks/11-09-group-iq-test';
const cwd = '/Users/lyh_god/orca/workspaces/new-api/iq-test';
const shared = [
  'Active task: ' + taskDir,
  'You are already the assigned Trellis specialist. Work directly; do not spawn subagents, create/start tasks, commit, push, deploy, or call production model providers.',
  'Repository/cwd: ' + cwd + '; branch iq-test; starting planning commit 446cda6d9. The task is in_progress and the user has approved the final PRD/design defaults.',
  'The earlier runtime blocker is resolved: a real trellis-research child returned RUNTIME_OK iq-test. Proceed with the approved assigned slice; do not spend effort on more harness probes or environment repair. Host GOTOOLCHAIN=local reports Go 1.24.4 while go.mod requires 1.26.10; an initial automatic toolchain download timed out at 30 seconds. Use bounded prerequisite setup if needed and accurately report blockers; do not lower the project Go requirement merely to make checks run.',
  'Read the task prd.md, design.md, implement.md, delegation.md, and applicable curated specs/research before editing. Current scope is group-routed text-model HTML/SVG IQ tests with selected models, two schedules, latest-only results, authenticated group-filtered gallery and lightweight active-HTML isolation.',
  'USER CONSTRAINT: do not perform excessive/useless tests. Add only focused cases that prove changed behavior, run narrow relevant checks once after implementation, and rerun only for actual fixes. No unrelated full repository test suites or redundant validation. No real provider calls.',
  'Keep the change small and complete. Preserve unrelated existing work. Never relax generic HtmlContent globally, change unrelated health-test behavior, add repeated model samples/retries, or silently expand product scope. Ask the parent if a material architecture/scope decision blocks safe delivery.',
  'Do not modify task metadata, PRD/design/checklists, journals or specs; parent owns integration/wrap-up. The specified backend API handoff is an allowed task-research exception. Use managed output for scratch reports. If creating disposable artifacts, record them in the existing .group-iq-test-temp-artifacts.md; do not delete any without user approval.'
].join('\n');

const backend = await runs.run('iq-backend', {
  agent: 'trellis-implement',
  label: 'Implement group IQ backend',
  cwd,
  context: 'fresh',
  timeoutMs: 2400000,
  output: 'iq/backend.md',
  outputMode: 'file-only',
  task: shared + '\n\n' + [
    'You are already the trellis-implement sub-agent; implement this slice directly, without spawning trellis-implement/trellis-check. Exclusive backend ownership: Go model/config/latest-result/checkpoint persistence and migration, schedule calculation, system-task registration/orchestration, once-per-selected-group/model executor, bounded HTML/SVG extraction, and authenticated/RBAC API routes. No web/ edits or frontend dependency installs. You are the sole writer during this stage.',
    'Use existing controller/channel-test.go and controller/system_task_handlers.go foundations. Prefer a narrow request/result extension over a copied relay pipeline. Ensure selected group context precedes relay-info generation. One normal routing choice at retry=0 and one outbound attempt per selected pair, no channel enumeration/retry/failover, no channel health-disable side effects, no viewer quota deduction. Initial schedules disabled; use durable active-task/lease controls and at-most-once checkpoints.',
    'Support returned full HTML or standalone SVG/fences, including preserved inline Canvas scripts. Artifact endpoint returns authenticated JSON, not same-origin executable HTML. Bound response/artifact sizes, final text rather than reasoning/tool-only content, and sanitize error metadata. Ensure two schedule modes with Beijing timezone, no overlap/catch-up, config version safety, latest-only replacements and current usable-group access filtering.',
    'Keep all artifacts out of SystemTask list/state bodies. Retain existing task/audit traces. Config target catalog must be verified concrete enabled groups/models and must account for default-group catalog filtering and native endpoint compatibility.',
    'Necessary validation only: add compact IQ-focused unit/integration cases for scheduling, single-call behavior, extraction, persistence and route authorization; run one focused Go command plus the narrow health-test regression affected by any executor refactor. Do not sweep unrelated packages/tests. If toolchain/environment blocks checks, report the exact blocker rather than repeatedly retrying.',
    'Before finishing, write the durable actual API contract to ' + taskDir + '/research/api-contract.md: exact endpoint paths, config/results/target/artifact JSON examples and field/status names, Unix time units, permissions, progress shape, and any frontend integration caveats. This handoff must match actual code, not the earlier suggested schema.',
    'Return a concise handoff via the configured output: changed files, exact commands/results, actual contract path, implemented invariants, and concrete remaining issues. If not usable by the frontend, clearly state BLOCKED and the reason.'
  ].join('\n')
});
if (!backend.ok) return { stage: 'backend', backend };

const frontend = await runs.run('iq-frontend', {
  agent: 'trellis-implement',
  label: 'Implement IQ gallery and settings',
  cwd,
  context: 'fresh',
  timeoutMs: 2400000,
  output: 'iq/frontend.md',
  outputMode: 'file-only',
  task: shared + '\n\n' + [
    'You are already the trellis-implement sub-agent; implement this slice directly, without spawning trellis-implement/trellis-check. Exclusive frontend ownership: web/src/features/iq-tests and focused tests, authenticated /iq-tests route, easy/developer navigation integration, seven locales via the required script workflow, existing UI composition, and affected frontend generated route metadata if required. Backend stage has finished; no Go edits. .gitignore/package-manager cache/log exclusions may be adjusted if necessary, but do not ignore tracked dependency lockfiles.',
    'First read the backend actual API contract at ' + taskDir + '/research/api-contract.md, inspect actual response structs/routes, and consume them exactly. Backend report reference: ' + backend.output,
    'Load .agents/skills/shadcn-ui/SKILL.md, i18n-translate/SKILL.md, and vercel-react-best-practices/SKILL.md before writing relevant UI/copy. Use installed Base UI/shadcn primitives and existing authenticated console patterns; no unnecessary dependencies/redesign.',
    'Build a grouped responsive gallery like the user screenshot: per-model latest artwork/time/status, lazy artifact fetching, visible run state, larger accessible preview. Show admin settings for prompt/group/model checkboxes, every-N-hours vs daily Beijing-time schedule, enable toggle and manual run. Ordinary users cannot configure/execute tests. Keep both console modes navigable and caches scoped to viewer identity.',
    'Use a dedicated iframe sandbox=allow-scripts without allow-same-origin/other permissions and trusted restrictive CSP before normalized model content. Preserve self-contained inline HTML/SVG/Canvas behavior. Do not use unsandboxed host-DOM insertion or relax existing generic HtmlContent. Block external subresource loads, exclude generated base/meta refresh/policy/nested frames/forms, avoid passing any app credentials or honoring arbitrary postMessage commands. Do not claim universal self-navigation/CPU isolation.',
    'Bound/lazy-mount live preview iframes and unmount closed/off-screen previews. Keep full artifact bodies out of list payloads. Do not require a screenshot service or production provider for previews.',
    'Localization: ALL locale writes through add-missing-keys.mjs and final bun run i18n:sync, all seven languages. Do not hand-edit locale JSON. Record any disposable scripts/reports in the temporary inventory; do not delete without user approval.',
    'Necessary verification only: a small focused feature test set, one typecheck/build, affected-file lint/format. web/node_modules was absent at planning; use Bun/frozen-lock bootstrap if necessary, no upgrades or npm/pnpm cache/log noise committed. Do not run full frontend tests or repeat successful unrelated commands. Parent will perform one browser smoke check; do not add a large browser matrix.',
    'Return changed files, exact commands/results, any dependency/build blockers, preview construction and lifecycle behavior, locale evidence, and concrete remaining integration issues. Do not commit.'
  ].join('\n')
});
if (!frontend.ok) return { stage: 'frontend', backend, frontend };

const check = await runs.run('iq-review', {
  agent: 'trellis-check',
  label: 'Review IQ integration risks',
  cwd,
  context: 'fresh',
  timeoutMs: 1200000,
  output: 'iq/review.md',
  outputMode: 'file-only',
  task: shared + '\n\n' + [
    'You are already the trellis-check specialist. This stage is READ ONLY: do not modify project/source/task files, run auto-fixes, or spawn other agents. Returning findings through the managed output is allowed.',
    'Review the actual integrated diff against 446cda6d9, the approved task artifacts, the actual API contract, and backend/frontend validation evidence. Backend report: ' + backend.output + '; frontend report: ' + frontend.output,
    'Focus on concrete reachable mistakes: one group/model call only; no hidden retries/quota charges; scheduler dedup and date semantics; latest-only/result visibility; real login/admin/group gates on direct artifact access; artifact bounds/extraction; sandbox/CSP placement and no same-origin/host credential injection; frontend/backend type contract and locale completeness.',
    'Honor the user request to avoid useless testing. Do not rerun successful gates or full suites. Prefer source/diff and command evidence; run a new very narrow check only if required to prove a specific reachable defect. Parent owns the browser smoke test and final integration.',
    'Return only evidence-backed P0/P1/P2 findings with file:line and smallest viable fix; distinguish environment limitations and speculative improvements. End with Merge verdict: BLOCK, OK, or OK with notes. A clean review is evidence, not authority to commit or finish the task.'
  ].join('\n')
});
return {
  stage: 'ready-for-parent-integration',
  backend: { ok: backend.ok, runId: backend.runId, output: backend.output, outputReference: backend.outputReference, outputPathMapping: backend.outputPathMapping, artifactPaths: backend.artifactPaths },
  frontend: { ok: frontend.ok, runId: frontend.runId, output: frontend.output, outputReference: frontend.outputReference, outputPathMapping: frontend.outputPathMapping, artifactPaths: frontend.artifactPaths },
  check: { ok: check.ok, runId: check.runId, output: check.output, outputReference: check.outputReference, outputPathMapping: check.outputPathMapping, artifactPaths: check.artifactPaths }
};
