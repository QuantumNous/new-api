# Unlimited Managed Upstream Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit every supported managed upstream route while keeping each request limited to five distinct channel attempts.

**Architecture:** Preserve the existing candidate-ranking and failover systems, but separate their limits. `candidate_limit=0` becomes an unlimited admission sentinel; `request_attempt_limit=5` remains the independent runtime cap. SQL probe loading must omit `LIMIT` when admission is unlimited.

**Tech Stack:** Go, GORM, SQLite test fixtures, testify, existing NewAPI upstream orchestration and relay failover packages.

---

## Task 1: Candidate-Limit Setting Semantics

**Files:**

- Create: `setting/operation_setting/upstream_orchestration_test.go`
- Modify: `setting/operation_setting/upstream_orchestration.go:71-75`

- [ ] **Step 1: Write the failing normalization test**

```go
package operation_setting

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestNormalizeUpstreamOrchestrationCandidateLimit(t *testing.T) {
    tests := []struct {
        name  string
        input int
        want  int
    }{
        {name: "zero means unlimited", input: 0, want: 0},
        {name: "positive values above five are accepted", input: 12, want: 12},
        {name: "negative values use default", input: -1, want: 5},
    }
    for _, testCase := range tests {
        t.Run(testCase.name, func(t *testing.T) {
            setting := UpstreamOrchestrationSetting{CandidateLimit: testCase.input}
            normalizeUpstreamOrchestrationSetting(&setting)
            assert.Equal(t, testCase.want, setting.CandidateLimit)
        })
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
go test ./setting/operation_setting -run TestNormalizeUpstreamOrchestrationCandidateLimit -count=1
```

Expected: FAIL because zero and `12` are normalized to `5`.

- [ ] **Step 3: Implement the minimal normalization change**

Replace the candidate-limit guard with:

```go
if setting.CandidateLimit < 0 {
    setting.CandidateLimit = 5
}
```

Do not change the `request_attempt_limit` guard.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
go test ./setting/operation_setting -run TestNormalizeUpstreamOrchestrationCandidateLimit -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit the setting contract**

```bash
git add setting/operation_setting/upstream_orchestration.go setting/operation_setting/upstream_orchestration_test.go
git commit -m "feat(upstream): allow unlimited candidate pools"
```

## Task 2: Unlimited Selection and Probe Scheduling

**Files:**

- Modify: `service/upstream_orchestration_test.go`
- Modify: `service/upstream_routing.go:374-381`
- Modify: `service/upstream_health.go:325-349`

- [ ] **Step 1: Write the failing unlimited-selection test**

Add a test beside the existing candidate-limit tests:

```go
func TestSelectUpstreamCandidateGroupsUnlimitedReturnsAllSortedCandidates(t *testing.T) {
    candidates := []upstreamRouteCandidate{
        {source: model.UpstreamSource{ID: 1}, group: model.UpstreamGroup{SourceID: 1, ExternalID: "expensive", Platform: "openai", EffectiveMultiplier: 0.3}, models: []string{"gpt-test"}},
        {source: model.UpstreamSource{ID: 2}, group: model.UpstreamGroup{SourceID: 2, ExternalID: "cheap", Platform: "openai", EffectiveMultiplier: 0.1}, models: []string{"gpt-test"}},
        {source: model.UpstreamSource{ID: 3}, group: model.UpstreamGroup{SourceID: 3, ExternalID: "middle", Platform: "openai", EffectiveMultiplier: 0.2}, models: []string{"gpt-test"}},
    }

    selected := selectUpstreamCandidateGroups(candidates, 0)

    require.Len(t, selected, 3)
    assert.Equal(t, []string{"cheap", "middle", "expensive"}, []string{
        selected[0].group.ExternalID,
        selected[1].group.ExternalID,
        selected[2].group.ExternalID,
    })
    for _, candidate := range selected {
        assert.Equal(t, []string{"gpt-test"}, candidate.models)
    }
}
```

- [ ] **Step 2: Write the failing unlimited-probe test**

```go
func TestEnqueueStaleManagedRouteProbesUnlimitedSchedulesEveryRoute(t *testing.T) {
    setupUpstreamOrchestrationTest(t)
    setting := operation_setting.GetUpstreamOrchestrationSetting()
    original := *setting
    setting.CandidateLimit = 0
    t.Cleanup(func() { *setting = original })

    now := int64(1_800_000_000)
    current := &model.UpstreamManagedRoute{
        Platform:  "openai",
        Protocol:  model.UpstreamProtocolOpenAI,
        ChannelID: 99,
    }
    for index := 1; index <= 6; index++ {
        require.NoError(t, model.DB.Create(&model.UpstreamManagedRoute{
            SourceID:        int64(index),
            ExternalGroupID: fmt.Sprintf("group-%d", index),
            Platform:        current.Platform,
            Protocol:        current.Protocol,
            ChannelID:       index,
            State:           model.UpstreamRouteStateActive,
        }).Error)
    }

    enqueueStaleManagedRouteProbes(current, now, 60)

    var scheduled int64
    require.NoError(t, model.DB.Model(&model.UpstreamManagedRoute{}).
        Where("next_probe_at = ?", now).
        Count(&scheduled).Error)
    assert.EqualValues(t, 6, scheduled)
}
```

- [ ] **Step 3: Run both tests and verify RED**

Run:

```bash
go test ./service -run 'Test(SelectUpstreamCandidateGroupsUnlimitedReturnsAllSortedCandidates|EnqueueStaleManagedRouteProbesUnlimitedSchedulesEveryRoute)$' -count=1
```

Expected: FAIL because zero currently selects no candidates and the normalized
probe query is capped at five.

- [ ] **Step 4: Implement unlimited candidate selection**

Sort before interpreting the limit:

```go
func selectUpstreamCandidateGroups(candidates []upstreamRouteCandidate, limit int) []upstreamRouteCandidate {
    sort.SliceStable(candidates, func(i, j int) bool {
        return lessUpstreamCandidate(candidates[i], candidates[j])
    })
    if limit == 0 {
        return candidates
    }
    if limit < 0 {
        return nil
    }
    // Existing positive-limit selection remains unchanged below.
```

- [ ] **Step 5: Implement unlimited probe loading**

Build the query before applying an optional positive limit:

```go
    query := model.DB.Where(
        "platform = ? AND protocol = ? AND detached = ? AND channel_id <> ? AND state IN ? AND last_success_at < ?",
        current.Platform,
        current.Protocol,
        false,
        current.ChannelID,
        []string{model.UpstreamRouteStateActive, model.UpstreamRouteStateQuarantined},
        now-int64(freshnessSeconds),
    ).Order("rank asc")
    if limit := operation_setting.GetUpstreamOrchestrationSetting().CandidateLimit; limit > 0 {
        query = query.Limit(limit)
    }
    if err := query.Find(&routes).Error; err != nil {
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
go test ./service -run 'Test(SelectUpstreamCandidateGroups|EnqueueStaleManagedRouteProbes|RankManagedRoutes)' -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit selection and probe behavior**

```bash
git add service/upstream_orchestration_test.go service/upstream_routing.go service/upstream_health.go
git commit -m "feat(upstream): retain all eligible managed routes"
```

## Task 3: Verify Five-Attempt Runtime Boundary

**Files:**

- Verify: `router/relay_failover_test.go`
- Verify: `service/channel_select.go`

- [ ] **Step 1: Run the existing failover cap regression**

Run:

```bash
go test ./router -run TestRelayChannelFailoverCapsAttemptsAtFivePriorities -count=1
```

Expected: PASS and only the first five upstreams receive one request.

- [ ] **Step 2: Run affected package tests**

Run:

```bash
go test ./setting/operation_setting -count=1
go test ./service -run 'Test(SelectUpstreamCandidateGroups|EnqueueStaleManagedRouteProbes|RankManagedRoutes|ManagedRoute|ManagedCandidate|Upstream)' -count=1
go test ./router -run 'TestRelayChannelFailover' -count=1
```

Expected: all commands PASS.

- [ ] **Step 3: Run static verification**

Run:

```bash
gofmt -w setting/operation_setting/upstream_orchestration_test.go setting/operation_setting/upstream_orchestration.go service/upstream_orchestration_test.go service/upstream_routing.go service/upstream_health.go
git diff --check
go test ./setting/operation_setting ./service ./router -run 'TestNormalizeUpstreamOrchestrationCandidateLimit|TestSelectUpstreamCandidateGroups|TestEnqueueStaleManagedRouteProbes|TestRankManagedRoutes|TestRelayChannelFailover' -count=1
```

Expected: formatting produces no diff beyond intended files, `git diff --check`
exits zero, and the combined targeted suite passes.

- [ ] **Step 4: Record the known unrelated baseline**

Record that plain `go test ./service` on production commit
`39b86ed5925f` fails App Plugin runtime-metadata assertions unless run through
the repository's dialect matrix with isolated environment ownership. Do not
modify those tests in this task.

- [ ] **Step 5: Commit any final plan-status update**

```bash
git status --short
git log -3 --oneline
```

Expected: only intended files are changed and the two implementation commits
follow the design and plan commits.

## Task 4: Production Canary and Full Enrollment

**Files:**

- Update evidence under: `/Users/bytedance/newapi/reports/host-migration-20260924`
- Update remote evidence under: `/data1/newapi-backups/channel-maintenance-20260929T163030Z`

- [ ] **Step 1: Build and identify an immutable image**

Build from this worktree, record the image digest and source revision, and do
not mutate the production Compose file yet.

- [ ] **Step 2: Refresh production backup evidence**

Capture a new database dump, Compose copy, browser-extension ZIP, channel/route
snapshots, rollback SQL, and SHA-256 manifest before deployment.

- [ ] **Step 3: Deploy with bounded request behavior**

Deploy the immutable image, confirm `request_attempt_limit=5`, then set
`candidate_limit=0`. Verify service health before any upstream enrollment.

- [ ] **Step 4: Complete the Leyi 124 canary**

Use the already-created `newapi-managed-leyi-124` credential without exposing
its value. Create the paired disabled channels and shadow routes, add abilities,
run `/v1/models` plus Chat/Responses/Messages probes, and promote only after the
existing three-success shadow threshold.

- [ ] **Step 5: Enroll the remaining supported groups**

For each currently eligible GPT, Claude, and Grok group across Leyi, Hualong,
and EBond, create exactly one named upstream key if absent, securely transfer it
once, create the paired channel/routes transactionally, probe, and record a
checkpoint. Never retry an ambiguous upstream key-creation write.

- [ ] **Step 6: Verify and seal evidence**

Confirm every supported group is represented, every unsupported or unsafe group
is excluded, request failover still attempts at most five routes, no secret is
present in evidence, rollback is executable, and all artifact hashes verify.
