# TechMobi Source URL Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reversible channel-level switch that makes explicitly configured TechMobi tasks persist and return the upstream video URL without archiving it to GCS.

**Architecture:** Extend the existing `ChannelSettings` JSON with a default-off boolean and read it inside the existing video polling transaction path. Only TechMobi success transitions honor the switch: a non-empty source URL bypasses archival and is stored in `Task.PrivateData.ResultURL`; a missing URL returns before the terminal compare-and-swap and billing settlement. Existing white-label, redaction, archive, cache-invalidation, and multi-node compare-and-swap behavior remains in place for all other cases.

**Tech Stack:** Go 1.22+, GORM task persistence, testify/require, Redis Pub/Sub channel-cache invalidation, existing Cloud Run deployment workflow.

---

### Task 1: Add the default-off channel setting

**Files:**
- Create: `dto/channel_settings_test.go`
- Modify: `dto/channel_settings.go:3-14`

- [ ] **Step 1: Write the failing serialization test**

```go
package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestChannelSettingsReturnSourceURLJSON(t *testing.T) {
	enabled, err := common.Marshal(ChannelSettings{ReturnSourceURL: true})
	require.NoError(t, err)
	require.JSONEq(t, `{"proxy":"","return_source_url":true}`, string(enabled))

	disabled, err := common.Marshal(ChannelSettings{})
	require.NoError(t, err)
	require.JSONEq(t, `{"proxy":""}`, string(disabled))
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `go test ./dto -run TestChannelSettingsReturnSourceURLJSON -count=1`

Expected: compilation fails with `unknown field ReturnSourceURL in struct literal of type ChannelSettings`.

- [ ] **Step 3: Add the minimal setting field**

Add to `dto.ChannelSettings`:

```go
ReturnSourceURL bool `json:"return_source_url,omitempty"`
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `go test ./dto -run TestChannelSettingsReturnSourceURLJSON -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the setting contract**

```text
Make temporary source delivery opt-in at the channel boundary

Constraint: Existing channel JSON must retain GCS delivery by default.
Rejected: Global environment flag | It would affect unrelated channels and make rollback coarse.
Confidence: high
Scope-risk: narrow
Directive: Keep return_source_url honored only for explicitly supported channel types.
Tested: go test ./dto -run TestChannelSettingsReturnSourceURLJSON -count=1
```

### Task 2: Persist a valid TechMobi source URL without archiving

**Files:**
- Modify: `service/task_polling_video_result_test.go:23-430`
- Modify: `service/task_polling.go:355-556`

- [ ] **Step 1: Write the failing direct-source success test**

Add this test and helper to `service/task_polling_video_result_test.go`:

```go
func TestUpdateVideoSingleTaskReturnSourceURLSkipsArchive(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 906, 1000)
	seedToken(t, 916, 906, "sk-techmobi-source-success", 500)
	task := newTechMobiPollingTask(t, 906, 936, 100, 916)
	ch := newTechMobiPollingChannelWithSourceURL(936)
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-techmobi-success",
			Status:      model.TaskStatusSuccess,
			Url:         "https://secret.example/video.mp4?token=secret",
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not run when return_source_url is enabled")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))
	require.Equal(t, 1, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, "https://secret.example/video.mp4?token=secret", stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
	require.NotContains(t, string(stored.Data), "secret.example")
	require.NotContains(t, string(stored.Data), "token=secret")
}

func newTechMobiPollingChannelWithSourceURL(id int) *model.Channel {
	ch := newTechMobiPollingChannel("")
	ch.Id = id
	settings := ch.GetSetting()
	settings.ReturnSourceURL = true
	ch.SetSetting(settings)
	return ch
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLSkipsArchive -count=1`

Expected: FAIL at `archive hook must not run when return_source_url is enabled`.

- [ ] **Step 3: Implement the minimal valid-source branch**

At the start of `updateVideoSingleTask`, parse the setting once:

```go
channelSetting := ch.GetSetting()
proxy := channelSetting.Proxy
returnSourceURL := ch.Type == constant.ChannelTypeTechMobiVideo && channelSetting.ReturnSourceURL
```

Change the TechMobi archive guard to exclude direct-source mode:

```go
if ch.Type == constant.ChannelTypeTechMobiVideo && !returnSourceURL && taskResult.Status == model.TaskStatusSuccess && snap.Status != model.TaskStatusSuccess {
	if task.PrivateData.VideoResult == nil {
		videoResult, archiveErr := archiveTechMobiVideoResult(ctx, task.TaskID, taskResult.Url, proxy)
		if archiveErr != nil {
			perfmetrics.RecordVideoResultArchiveRetry("techmobi", "archive_failure")
			return fmt.Errorf("archive techmobi video result failed for task %s: %s", task.TaskID, sanitizeVideoResultArchiveError(archiveErr))
		}
		task.PrivateData.VideoResult = videoResult
	}
}
```

Place the explicit direct-source result before the general white-label branch:

```go
} else if returnSourceURL {
	task.PrivateData.ResultURL = strings.TrimSpace(taskResult.Url)
} else if taskcommon.ShouldWhitelabelChannelType(ch.Type) {
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLSkipsArchive -count=1`

Expected: PASS.

- [ ] **Step 5: Commit valid direct-source delivery**

```text
Let opted-in TechMobi tasks retain their upstream result

Constraint: Direct delivery must bypass GCS without weakening the default white-label path.
Rejected: Remove TechMobi from the global white-label registry | It would expose every TechMobi channel.
Confidence: high
Scope-risk: moderate
Directive: Do not generalize this exception beyond an explicit channel setting.
Tested: go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLSkipsArchive -count=1
```

### Task 3: Retry instead of finalizing when the source URL is missing

**Files:**
- Modify: `service/task_polling_video_result_test.go`
- Modify: `service/task_polling.go:422-455`

- [ ] **Step 1: Write the failing missing-URL test**

```go
func TestUpdateVideoSingleTaskReturnSourceURLMissingDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 907, 1000)
	seedToken(t, 917, 907, "sk-techmobi-source-missing", 500)
	task := newTechMobiPollingTask(t, 907, 937, 100, 917)
	ch := newTechMobiPollingChannelWithSourceURL(937)
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-techmobi-success",
			Status:   model.TaskStatusSuccess,
			Url:      "   ",
			Progress: "100%",
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not run in direct-source mode")
		return nil, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.ErrorContains(t, err, "missing source URL")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Equal(t, 100, stored.Quota)
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLMissingDoesNotFinalizeOrSettle -count=1`

Expected: FAIL because the current direct-source branch finalizes the task with an empty result URL and returns no error.

- [ ] **Step 3: Add the pre-terminal retry guard**

Immediately before TechMobi archival:

```go
if returnSourceURL && taskResult.Status == model.TaskStatusSuccess && snap.Status != model.TaskStatusSuccess && strings.TrimSpace(taskResult.Url) == "" {
	return fmt.Errorf("techmobi task %s missing source URL", task.TaskID)
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLMissingDoesNotFinalizeOrSettle -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the retry guard**

```text
Keep incomplete direct-source results retryable

Constraint: A successful upstream status without a usable URL must not become a billed terminal task.
Rejected: Fabricate the existing proxy URL | Direct-source tasks have no archived object for that proxy to serve.
Confidence: high
Scope-risk: narrow
Directive: Keep this guard before terminal status mutation and billing settlement.
Tested: go test ./service -run TestUpdateVideoSingleTaskReturnSourceURLMissingDoesNotFinalizeOrSettle -count=1
```

### Task 4: Lock compatibility, redaction, and multi-node settlement behavior

**Files:**
- Modify: `service/task_polling_video_result_test.go`

- [ ] **Step 1: Strengthen the default-off archive assertion**

Add to `TestUpdateVideoSingleTaskArchivePersistsMetadataBeforeSuccessSettlement`:

```go
require.Equal(t, taskcommon.BuildProxyURL(task.TaskID), stored.PrivateData.ResultURL)
require.NotEqual(t, "https://secret.example/video.mp4?token=secret", stored.PrivateData.ResultURL)
```

Add the `taskcommon` import used by this assertion.

- [ ] **Step 2: Add the non-TechMobi guard test**

```go
func TestUpdateVideoSingleTaskReturnSourceURLSettingIgnoredForOtherWhitelabelChannels(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 908, 1000)
	seedToken(t, 918, 908, "sk-kuaizi-source-ignored", 500)
	task := newTechMobiPollingTask(t, 908, 938, 100, 918)
	ch := newTechMobiPollingChannelWithSourceURL(938)
	ch.Type = constant.ChannelTypeKuaiziLizhen
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-kuaizi-success",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("TechMobi archive hook must not run for another channel type")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.Equal(t, taskcommon.BuildProxyURL(task.TaskID), stored.PrivateData.ResultURL)
	require.NotEqual(t, "https://secret.example/video.mp4?token=secret", stored.PrivateData.ResultURL)
}
```

- [ ] **Step 3: Add the stale-replica compare-and-swap test**

```go
func TestUpdateVideoSingleTaskReturnSourceURLCASLoserDoesNotSettleTwice(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 909, 1000)
	seedToken(t, 919, 909, "sk-techmobi-source-cas", 500)
	winnerTask := newTechMobiPollingTask(t, 909, 939, 100, 919)
	var staleTask model.Task
	require.NoError(t, model.DB.Where("task_id = ?", winnerTask.TaskID).First(&staleTask).Error)
	ch := newTechMobiPollingChannelWithSourceURL(939)
	result := &relaycommon.TaskInfo{
		TaskID:   "upstream-techmobi-success",
		Status:   model.TaskStatusSuccess,
		Url:      "https://secret.example/video.mp4?token=secret",
		Progress: "100%",
	}
	winnerAdaptor := &fakeVideoPollingAdaptor{responseBody: techMobiArchiveResponseBody(), taskResult: result}
	loserAdaptor := &fakeVideoPollingAdaptor{responseBody: techMobiArchiveResponseBody(), taskResult: result}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not run in direct-source mode")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, winnerAdaptor, ch, winnerTask.GetUpstreamTaskID(), techMobiTaskMap(winnerTask)))
	require.NoError(t, updateVideoSingleTask(ctx, loserAdaptor, ch, staleTask.GetUpstreamTaskID(), techMobiTaskMap(&staleTask)))
	require.Equal(t, 1, winnerAdaptor.adjustCalls)
	require.Equal(t, 0, loserAdaptor.adjustCalls)
}
```

- [ ] **Step 4: Run compatibility tests**

Run:

```text
go test ./service -run 'TestUpdateVideoSingleTask(ArchivePersistsMetadataBeforeSuccessSettlement|ReturnSourceURL)' -count=1
go test ./service -run 'TestRedactTechMobiVideoResponseBody|TestCASGuarded(Settle|Refund)' -count=1
```

Expected: PASS, including default GCS behavior, non-TechMobi white-label behavior, URL redaction, and one settlement for a stale-replica race.

- [ ] **Step 5: Commit compatibility coverage**

```text
Protect default delivery and terminal billing semantics

Constraint: Production is multi-node and all unconfigured channels must keep their current delivery contract.
Rejected: Process-local locking | It cannot prevent duplicate settlement across Cloud Run instances.
Confidence: high
Scope-risk: narrow
Directive: Preserve the database compare-and-swap as the only terminal settlement gate.
Tested: focused service polling, redaction, and CAS billing tests
```

### Task 5: Format, verify, and review the complete change

**Files:**
- Verify: `dto/channel_settings.go`
- Verify: `dto/channel_settings_test.go`
- Verify: `service/task_polling.go`
- Verify: `service/task_polling_video_result_test.go`

- [ ] **Step 1: Format changed Go files**

Run:

```text
gofmt -w dto/channel_settings.go dto/channel_settings_test.go service/task_polling.go service/task_polling_video_result_test.go
```

Expected: exit 0.

- [ ] **Step 2: Run focused package tests**

Run:

```text
go test ./dto -run TestChannelSettingsReturnSourceURLJSON -count=1
go test ./service -run 'TestUpdateVideoSingleTaskArchive|TestUpdateVideoSingleTaskReturnSourceURL|TestRedactTechMobiVideoResponseBody|TestCASGuarded(Settle|Refund)' -count=1
go test ./relay/channel/task/techmobi -count=1
go test ./controller -run 'TestArchivedTechMobiVideoRedirect|TestLegacyTechMobiVideoProxyUsesExtractor' -count=1
```

Expected: all commands exit 0.

- [ ] **Step 3: Run static and broader checks**

Run:

```text
go vet ./dto ./service ./relay/channel/task/techmobi ./controller
go test ./service ./relay/channel/task/techmobi ./controller -count=1
```

Expected: `go vet` exits 0. Record the broader test command as a timeout gap if it again exceeds the environment limit; do not report it as passing unless it exits 0.

- [ ] **Step 4: Review the final diff against the design**

Run:

```text
git diff --check
git diff -- dto/channel_settings.go dto/channel_settings_test.go service/task_polling.go service/task_polling_video_result_test.go
```

Expected: no whitespace errors; no changes to Cloud Run traffic, revision retention, Terraform, GCS infrastructure, frontend, or deployment workflows.

- [ ] **Step 5: Commit final formatting or review fixes if needed**

Use a Lore-format commit only when Step 4 required edits; otherwise leave the prior focused commits unchanged.

### Task 6: Deploy the compatible revision and activate only channel 106

**Files:**
- Operational only: existing `gcp-deploy.yml` production workflow and existing `PUT /api/channel/` management path
- Do not modify: Cloud Run traffic policy, revision retention, Terraform, GCS, website, or workflow files

- [ ] **Step 1: Deploy the compatible application revision through the existing production workflow**

Deploy the Go application revision using the repository's established production approval path. The console/master revision is required because it owns polling and persistence. Deploying the same immutable image to router is acceptable when the existing workflow deploys console and router together; no workflow edit is part of this change.

Expected: the deployed revision contains `return_source_url` support while all channels still behave as before because the field defaults to false.

- [ ] **Step 2: Read channel 106 through the authenticated management API**

Use the existing signed-in root/admin session to request `GET /api/channel/106`. Save the complete returned channel object in memory for the next request; do not log or copy its key into the repository.

Expected: channel type is `105` (`TechMobiVideo`) and the existing `setting` JSON is available.

- [ ] **Step 3: Preserve all channel fields and enable only the new key**

Parse the existing `setting` JSON, add:

```json
"return_source_url": true
```

Submit the complete channel object to `PUT /api/channel/`. Do not use direct SQL. The existing path calls `model.Channel.Update()`, refreshes the local channel cache, publishes `ConfigScopeChannels` through Redis Pub/Sub, and retains the 60-second `SyncChannelCache` fallback for any missed notification.

Expected: only channel 106 changes; unrelated setting keys remain byte-equivalent in meaning.

- [ ] **Step 4: Verify cache visibility and a new customer task**

Read channel 106 back through the management API and confirm `return_source_url=true`. Submit a new TechMobi task, poll it to success, and verify:

```text
result_url is the upstream HTTPS URL
task data and logs do not expose the URL
no new object exists for that task under the GCS video-result prefix
the task settles exactly once
```

Expected: the customer can download directly from the upstream URL. Existing completed GCS tasks remain unchanged.

- [ ] **Step 5: Record the reversible rollback**

To restore GCS for subsequent tasks, repeat the same management update and either remove `return_source_url` or set it to `false`. Do not change Cloud Run traffic allocation or revision policy for this rollback.

Expected: only future successful tasks return to GCS archival; already completed direct-source tasks are not rewritten.
