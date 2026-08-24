package model

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestInitTaskPersistsTechMobiSelectedKeyForPolling(t *testing.T) {
	task := InitTask(constant.TaskPlatform("106"), &relaycommon.RelayInfo{
		UserId: 7,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeTechMobiVideo,
			ApiKey:      "techmobi-selected-key",
		},
	})

	require.Equal(t, "techmobi-selected-key", task.PrivateData.Key)
}

func TestInitTaskPersistsModelAPISeedanceSelectedKeyForPolling(t *testing.T) {
	task := InitTask(constant.TaskPlatform("49"), &relaycommon.RelayInfo{
		UserId: 7,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeModelAPISeedance,
			ApiKey:      "modelapi-selected-key",
		},
	})

	require.Equal(t, "modelapi-selected-key", task.PrivateData.Key)
}

func TestTaskKeyGrokSubscriptionOAuthIsNeverPersisted(t *testing.T) {
	task := InitTask(constant.TaskPlatform("113"), &relaycommon.RelayInfo{
		UserId: 7,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeGrokSubscription,
			ApiKey:      `{"access_token":"oauth-access","refresh_token":"oauth-refresh","expires_at":4102444800}`,
		},
	})

	require.Empty(t, task.PrivateData.Key)
}

func TestTechMobiSubmittingFencePreservesSelectedKeyAfterExpiry(t *testing.T) {
	truncateTables(t)

	task := &Task{
		TaskID:                    "task_techmobi_expired_submit_fence_key",
		Status:                    TaskStatusQueued,
		PreparationStatus:         TaskPreparationStatusPreparing,
		PreparationLeaseOwner:     "node-a",
		PreparationLeaseExpiresAt: 220,
		PreparationAttemptCount:   2,
		Quota:                     100,
		Data:                      json.RawMessage(`{}`),
		PrivateData:               TaskPrivateData{TokenId: 11},
	}
	insertTask(t, task)

	fenced, err := MarkQueuedTaskSubmittingWithPollingKey(
		task.TaskID,
		"node-a",
		2,
		120,
		106,
		constant.TaskPlatform("106"),
		246,
		"techmobi-key-b",
	)
	require.NoError(t, err)
	require.True(t, fenced)

	quarantined, err := MarkExpiredAssetTaskSubmissionUnknown(task.TaskID, "node-a", 220, 2, 221, nil, 500)
	require.NoError(t, err)
	require.True(t, quarantined)

	var stored Task
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, TaskStatusUnknown, stored.Status)
	require.Equal(t, TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, "techmobi-key-b", stored.PrivateData.Key)
	require.Equal(t, 11, stored.PrivateData.TokenId)
}

func TestTaskPollingKeyPersistenceTrimsAndIgnoresBlankValues(t *testing.T) {
	t.Run("accepted trims selected key", func(t *testing.T) {
		truncateTables(t)
		task := &Task{
			TaskID:                    "task_accepted_trimmed_polling_key",
			UserId:                    7,
			Status:                    TaskStatusQueued,
			PreparationLeaseOwner:     "node-a",
			PreparationLeaseExpiresAt: 220,
			Quota:                     100,
			Data:                      json.RawMessage(`{}`),
			PrivateData:               TaskPrivateData{Key: "previous-key", TokenId: 11},
		}
		insertTask(t, task)

		accepted, err := MarkQueuedTaskAcceptedWithPollingKey(
			task.TaskID, "node-a", 220, 120, 130, 106, constant.TaskPlatform("106"), 246,
			"upstream-task", []byte(`{"id":"upstream-task"}`), "  selected-key  ", nil, 120, 500,
		)
		require.NoError(t, err)
		require.True(t, accepted)

		var stored Task
		require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
		require.Equal(t, "selected-key", stored.PrivateData.Key)
		require.Equal(t, 11, stored.PrivateData.TokenId)
	})

	t.Run("unknown preserves key for blank input", func(t *testing.T) {
		truncateTables(t)
		task := &Task{
			TaskID:                  "task_unknown_blank_polling_key",
			UserId:                  7,
			Status:                  TaskStatusQueued,
			PreparationAttemptCount: 2,
			Quota:                   100,
			Data:                    json.RawMessage(`{}`),
			PrivateData:             TaskPrivateData{Key: "selected-key", TokenId: 11},
		}
		insertTask(t, task)

		quarantined, err := MarkQueuedTaskSubmissionUnknownWithPollingKey(
			task.TaskID, 2, 120, 130, 106, constant.TaskPlatform("106"), 246,
			"", nil, " \t ", nil, 120, 500,
		)
		require.NoError(t, err)
		require.True(t, quarantined)

		var stored Task
		require.NoError(t, DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
		require.Equal(t, "selected-key", stored.PrivateData.Key)
		require.Equal(t, 11, stored.PrivateData.TokenId)
	})
}
