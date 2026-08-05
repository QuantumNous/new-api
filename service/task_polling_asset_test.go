package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAssetTaskPollingIgnoresPreparingAssetTasks(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	oldLimit := constant.TaskQueryLimit
	constant.TaskQueryLimit = 100
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
		constant.TaskQueryLimit = oldLimit
	})

	seedUser(t, 701, 1000)
	seedToken(t, 711, 701, "sk-asset-polling", 500)
	seedChannel(t, 731)
	queued := &model.Task{
		TaskID:            "",
		UserId:            701,
		Group:             "default",
		ChannelId:         0,
		Platform:          constant.TaskPlatform("107"),
		Quota:             123,
		Status:            model.TaskStatusQueued,
		PreparationStatus: model.TaskPreparationStatusPreparingAssets,
		SubmitTime:        0,
		Progress:          "0%",
		CreatedAt:         time.Now().Add(-time.Hour).Unix(),
		UpdatedAt:         time.Now().Add(-time.Hour).Unix(),
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			TokenId:       711,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "seedance-2.0",
			},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
	}
	require.NoError(t, model.DB.Create(queued).Error)

	sweepTimedOutTasks(ctx)
	pollUnfinishedTasksOnce(ctx)

	var stored model.Task
	require.NoError(t, model.DB.First(&stored, queued.ID).Error)
	require.EqualValues(t, model.TaskStatusQueued, stored.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, stored.PreparationStatus)
	require.Equal(t, "0%", stored.Progress)
	require.Equal(t, 1000, getUserQuota(t, 701), "preparing asset task must not be refunded by generic timeout sweep")
	require.Equal(t, 500, getTokenRemainQuota(t, 711), "preparing asset task must not touch token quota")
	require.Zero(t, countLogs(t), "generic poller must not emit refund logs for preparing asset tasks")
}

func TestTaskPollingStillFailsOrdinaryNullUpstreamTask(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 0
	oldLimit := constant.TaskQueryLimit
	constant.TaskQueryLimit = 100
	t.Cleanup(func() {
		constant.TaskTimeoutMinutes = oldTimeout
		constant.TaskQueryLimit = oldLimit
	})

	ordinary := &model.Task{
		TaskID:            "",
		UserId:            702,
		Group:             "default",
		ChannelId:         732,
		Platform:          constant.TaskPlatform("107"),
		Status:            model.TaskStatusQueued,
		PreparationStatus: "",
		SubmitTime:        time.Now().Unix(),
		Progress:          "0%",
		Data:              []byte(`{}`),
	}
	require.NoError(t, model.DB.Create(ordinary).Error)

	pollUnfinishedTasksOnce(ctx)

	var stored model.Task
	require.NoError(t, model.DB.First(&stored, ordinary.ID).Error)
	require.EqualValues(t, model.TaskStatusFailure, stored.Status)
	require.Equal(t, "100%", stored.Progress)
}

func TestTimedOutSweepStillFailsAndRefundsOrdinaryQueuedTask(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	oldTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = oldTimeout })

	seedUser(t, 703, 1000)
	seedToken(t, 713, 703, "sk-ordinary-timeout", 500)
	seedChannel(t, 733)
	task := &model.Task{
		TaskID:            "ordinary_timeout",
		UserId:            703,
		Group:             "default",
		ChannelId:         733,
		Platform:          constant.TaskPlatform("107"),
		Quota:             123,
		Status:            model.TaskStatusQueued,
		PreparationStatus: "",
		SubmitTime:        time.Now().Add(-time.Hour).Unix(),
		Progress:          "0%",
		Data:              []byte(`{}`),
		PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceWallet,
			TokenId:       713,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "seedance-2.0",
			},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
	}
	require.NoError(t, model.DB.Create(task).Error)

	sweepTimedOutTasks(ctx)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "ordinary_timeout").First(&stored).Error)
	require.EqualValues(t, model.TaskStatusFailure, stored.Status)
	require.Equal(t, "100%", stored.Progress)
	require.Equal(t, 1123, getUserQuota(t, 703))
	require.Equal(t, 623, getTokenRemainQuota(t, 713))
	require.EqualValues(t, 1, countLogs(t))
}

func TestModelUnfinishedQueriesExcludePreparingAssetTasks(t *testing.T) {
	truncate(t)
	old := time.Now().Add(-time.Hour).Unix()
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:            "preparing_assets_query",
		Status:            model.TaskStatusQueued,
		PreparationStatus: model.TaskPreparationStatusPreparingAssets,
		SubmitTime:        0,
		Progress:          "0%",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:            "preparing_query",
		Status:            model.TaskStatusQueued,
		PreparationStatus: model.TaskPreparationStatusPreparing,
		SubmitTime:        old,
		Progress:          "0%",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:            "ordinary_query",
		Status:            model.TaskStatusQueued,
		PreparationStatus: "",
		SubmitTime:        old,
		Progress:          "0%",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:            "submitting_query",
		Status:            model.TaskStatusQueued,
		PreparationStatus: model.TaskPreparationStatusSubmitting,
		SubmitTime:        old,
		Progress:          "0%",
	}).Error)
	require.NoError(t, model.DB.Create(&model.Task{
		TaskID:            "unknown_outcome_query",
		Status:            model.TaskStatusUnknown,
		PreparationStatus: model.TaskPreparationStatusUnknownOutcome,
		SubmitTime:        old,
		Progress:          "0%",
	}).Error)

	timedOut := model.GetTimedOutUnfinishedTasks(time.Now().Unix(), 10)
	unfinished := model.GetAllUnFinishSyncTasks(10)

	require.ElementsMatch(t, []string{"ordinary_query"}, taskIDsForPollingTest(timedOut))
	require.ElementsMatch(t, []string{"ordinary_query"}, taskIDsForPollingTest(unfinished))
}

func taskIDsForPollingTest(tasks []*model.Task) []string {
	ids := make([]string, 0, len(tasks))
	for _, task := range tasks {
		if task.TaskID != "" {
			ids = append(ids, task.TaskID)
		}
	}
	return ids
}
