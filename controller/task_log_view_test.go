package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskLogDTOSeparatesUserAdminAndRootDetails(t *testing.T) {
	task := &model.Task{
		TaskID:   "task_public",
		Platform: "document-parser",
		PrivateData: model.TaskPrivateData{
			Key:            "channel-secret-canary",
			UpstreamTaskID: "upstream-private",
			NodeName:       "node-a",
			Execution: &model.TaskExecutionSnapshot{
				RequestID:   "request-public",
				RequestPath: "/v1/documents",
				TaskPlugin: &model.TaskPluginSnapshot{
					Key:     "document-parser",
					Name:    "Document Parser",
					Version: "1.2.3",
					Author: &model.TaskPluginAuthorSnapshot{
						Name: "Community Author",
						URL:  "https://plugins.example/author",
					},
					APIVersion: 1,
					Generation: 42,
				},
			},
		},
	}

	userView := tasksToDto([]*model.Task{task}, false, common.RoleCommonUser)[0]
	assert.Nil(t, userView.AdminInfo)
	assert.Nil(t, userView.RootInfo)

	adminView := tasksToDto([]*model.Task{task}, false, common.RoleAdminUser)[0]
	require.NotNil(t, adminView.AdminInfo)
	require.NotNil(t, adminView.AdminInfo.TaskPlugin)
	assert.Equal(t, "document-parser", adminView.AdminInfo.TaskPlugin.Key)
	assert.Equal(t, "Document Parser", adminView.AdminInfo.TaskPlugin.Name)
	assert.Equal(t, "1.2.3", adminView.AdminInfo.TaskPlugin.Version)
	require.NotNil(t, adminView.AdminInfo.TaskPlugin.Author)
	assert.Equal(t, "Community Author", adminView.AdminInfo.TaskPlugin.Author.Name)
	assert.Equal(t, "https://plugins.example/author", adminView.AdminInfo.TaskPlugin.Author.URL)
	assert.Equal(t, "request-public", adminView.AdminInfo.RequestID)
	assert.Equal(t, "/v1/documents", adminView.AdminInfo.RequestPath)
	assert.Nil(t, adminView.RootInfo)

	rootView := tasksToDto([]*model.Task{task}, false, common.RoleRootUser)[0]
	require.NotNil(t, rootView.AdminInfo)
	require.NotNil(t, rootView.RootInfo)
	require.NotNil(t, rootView.RootInfo.TaskPlugin)
	assert.Equal(t, 1, rootView.RootInfo.TaskPlugin.APIVersion)
	assert.Equal(t, uint64(42), rootView.RootInfo.TaskPlugin.Generation)
	assert.Equal(t, "upstream-private", rootView.RootInfo.UpstreamTaskID)
	assert.Equal(t, "node-a", rootView.RootInfo.NodeName)

	adminJSON, err := common.Marshal(adminView)
	require.NoError(t, err)
	assert.NotContains(t, string(adminJSON), "channel-secret-canary")
	assert.NotContains(t, string(adminJSON), "upstream-private")

	rootJSON, err := common.Marshal(rootView)
	require.NoError(t, err)
	assert.NotContains(t, string(rootJSON), "channel-secret-canary")
	assert.Contains(t, string(rootJSON), "upstream-private")
}

func TestTaskLogDTODoesNotInventHistoricalPluginProvenance(t *testing.T) {
	task := &model.Task{
		TaskID:   "task_without_snapshot",
		Platform: "document-parser",
	}

	adminView := tasksToDto([]*model.Task{task}, false, common.RoleAdminUser)[0]

	assert.Nil(t, adminView.AdminInfo)
	assert.Nil(t, adminView.RootInfo)
}

func TestTaskLogDTODispatchDiagnosticsAreRootOnly(t *testing.T) {
	task := &model.Task{
		TaskID:            "task_uncertain_diagnostics",
		SubmitTime:        100,
		ExecutionMode:     model.TaskExecutionModeDeferred,
		DispatchStatus:    model.TaskDispatchStatusUncertain,
		DispatchOwner:     "private-runner-owner",
		DispatchLockUntil: 999,
		DispatchStartedAt: 125,
		DispatchAttempts:  2,
		DispatchError:     "provider submission outcome unknown",
		PrivateData: model.TaskPrivateData{
			Key: "private-provider-credential",
			DeferredRequest: &model.TaskDeferredRequest{
				RequestBody: []byte(`{"secret":"private-request"}`),
			},
		},
	}

	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser} {
		view := tasksToDto([]*model.Task{task}, false, role)[0]
		assert.Nil(t, view.RootInfo)
		encoded, err := common.Marshal(view)
		require.NoError(t, err)
		assert.NotContains(t, string(encoded), "execution_mode")
		assert.NotContains(t, string(encoded), "dispatch_status")
		assert.NotContains(t, string(encoded), "provider submission outcome unknown")
		assert.NotContains(t, string(encoded), "private-runner-owner")
		assert.NotContains(t, string(encoded), "private-provider-credential")
		assert.NotContains(t, string(encoded), "private-request")
	}

	rootView := tasksToDto([]*model.Task{task}, false, common.RoleRootUser)[0]
	require.NotNil(t, rootView.RootInfo)
	assert.Equal(t, model.TaskExecutionModeDeferred, rootView.RootInfo.ExecutionMode)
	assert.Equal(t, string(model.TaskDispatchStatusUncertain), rootView.RootInfo.DispatchStatus)
	assert.Equal(t, int64(125), rootView.RootInfo.DispatchStartedAt)
	assert.Equal(t, 2, rootView.RootInfo.DispatchAttempts)
	assert.Equal(t, "provider submission outcome unknown", rootView.RootInfo.DispatchError)
	assert.True(t, rootView.RootInfo.RequiresOperatorResolution)
	encoded, err := common.Marshal(rootView)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "private-runner-owner")
	assert.NotContains(t, string(encoded), "private-provider-credential")
	assert.NotContains(t, string(encoded), "private-request")
}

func TestTaskLogDTONormalizesLegacyFenceForRootDiagnostics(t *testing.T) {
	task := &model.Task{
		TaskID:            "task_legacy_uncertain_diagnostics",
		SubmitTime:        321,
		ExecutionMode:     model.TaskExecutionModeDeferred,
		DispatchStatus:    legacyDeferredDispatchStatusRunningForTest,
		DispatchOwner:     "legacy-private-owner",
		DispatchLockUntil: math.MaxInt64,
		DispatchAttempts:  1,
		DispatchError:     "legacy fence",
	}

	rootView := tasksToDto([]*model.Task{task}, false, common.RoleRootUser)[0]
	require.NotNil(t, rootView.RootInfo)
	assert.Equal(t, string(model.TaskDispatchStatusUncertain), rootView.RootInfo.DispatchStatus)
	assert.Equal(t, task.SubmitTime, rootView.RootInfo.DispatchStartedAt)
	assert.True(t, rootView.RootInfo.RequiresOperatorResolution)
	encoded, err := common.Marshal(rootView)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "legacy-private-owner")
}

func TestTaskLogDTONormalizesExpiredLegacyFiniteLeaseForRootDiagnostics(t *testing.T) {
	now := common.GetTimestamp()
	expired := &model.Task{
		TaskID:            "task_legacy_expired_diagnostics",
		SubmitTime:        321,
		ExecutionMode:     model.TaskExecutionModeDeferred,
		DispatchStatus:    legacyDeferredDispatchStatusRunningForTest,
		DispatchOwner:     "legacy-expired-private-owner",
		DispatchLockUntil: now - 1,
		DispatchAttempts:  1,
		DispatchError:     "legacy worker outcome unknown",
	}

	rootView := tasksToDto([]*model.Task{expired}, false, common.RoleRootUser)[0]
	require.NotNil(t, rootView.RootInfo)
	assert.Equal(t, string(model.TaskDispatchStatusUncertain), rootView.RootInfo.DispatchStatus)
	assert.Equal(t, expired.SubmitTime, rootView.RootInfo.DispatchStartedAt)
	assert.True(t, rootView.RootInfo.RequiresOperatorResolution)

	active := *expired
	active.TaskID = "task_legacy_active_diagnostics"
	active.DispatchLockUntil = now + 60
	activeView := tasksToDto([]*model.Task{&active}, false, common.RoleRootUser)[0]
	require.NotNil(t, activeView.RootInfo)
	assert.Equal(t, string(legacyDeferredDispatchStatusRunningForTest), activeView.RootInfo.DispatchStatus)
	assert.Zero(t, activeView.RootInfo.DispatchStartedAt)
	assert.False(t, activeView.RootInfo.RequiresOperatorResolution)

	current := *expired
	current.TaskID = "task_current_expired_diagnostics"
	current.DispatchStatus = model.TaskDispatchStatusRunning
	current.DispatchProtocolVersion = model.CurrentTaskDispatchProtocolVersion
	currentView := tasksToDto([]*model.Task{&current}, false, common.RoleRootUser)[0]
	require.NotNil(t, currentView.RootInfo)
	assert.Equal(t, string(model.TaskDispatchStatusRunning), currentView.RootInfo.DispatchStatus)
	assert.Zero(t, currentView.RootInfo.DispatchStartedAt)
	assert.False(t, currentView.RootInfo.RequiresOperatorResolution)
}

func TestTaskLogDTORootDispatchDiagnosticsIncludeZeroValues(t *testing.T) {
	task := &model.Task{
		TaskID:         "task_pending_diagnostics",
		ExecutionMode:  model.TaskExecutionModeDeferred,
		DispatchStatus: model.TaskDispatchStatusPending,
	}

	rootView := tasksToDto([]*model.Task{task}, false, common.RoleRootUser)[0]
	require.NotNil(t, rootView.RootInfo)
	encoded, err := common.Marshal(rootView)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"execution_mode":"deferred"`)
	assert.Contains(t, string(encoded), `"dispatch_status":"pending_v1"`)
	assert.Contains(t, string(encoded), `"dispatch_started_at":0`)
	assert.Contains(t, string(encoded), `"dispatch_attempts":0`)
	assert.Contains(t, string(encoded), `"dispatch_error":""`)
	assert.Contains(t, string(encoded), `"requires_operator_resolution":false`)
}

func TestTaskLogDTOReplacesLegacyVideoURLWithAvailabilityFlag(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_legacy_video",
		Platform:   "jimeng",
		Action:     constant.TaskActionTextToVideo,
		Status:     model.TaskStatusSuccess,
		FailReason: "https://private-upstream.invalid/video.mp4?signature=secret",
	}

	view := tasksToDto([]*model.Task{task}, false, common.RoleCommonUser)[0]
	assert.True(t, view.LegacyVideoAvailable)
	assert.Empty(t, view.ResultURL)
	assert.Empty(t, view.FailReason)
	encoded, err := common.Marshal(view)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "private-upstream.invalid")
	assert.NotContains(t, string(encoded), "result_url")
	assert.Contains(t, string(encoded), "legacy_video_available")
}

func TestTaskLogDTOKeepsFailureReasonAndDoesNotMarkPluginTaskLegacy(t *testing.T) {
	failed := &model.Task{
		TaskID:     "task_failed",
		Platform:   "jimeng",
		Action:     constant.TaskActionTextToVideo,
		Status:     model.TaskStatusFailure,
		FailReason: "provider rejected the request",
	}
	failedView := tasksToDto([]*model.Task{failed}, false, common.RoleCommonUser)[0]
	assert.Equal(t, "provider rejected the request", failedView.FailReason)
	assert.False(t, failedView.LegacyVideoAvailable)

	pluginTask := &model.Task{
		TaskID:     "task_plugin_video",
		Platform:   "community-video",
		Action:     constant.TaskActionTextToVideo,
		Status:     model.TaskStatusSuccess,
		FailReason: "https://stale-upstream.invalid/plugin-video.mp4",
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://private-upstream.invalid/plugin-video.mp4",
			Execution: &model.TaskExecutionSnapshot{
				TaskPlugin: &model.TaskPluginSnapshot{Key: "community-video"},
			},
		},
	}
	pluginView := tasksToDto([]*model.Task{pluginTask}, false, common.RoleCommonUser)[0]
	assert.False(t, pluginView.LegacyVideoAvailable)
	assert.Empty(t, pluginView.ResultURL)
	assert.Empty(t, pluginView.FailReason)
}
