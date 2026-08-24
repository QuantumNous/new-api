package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUpdateVideoSingleTaskArchivePersistsMetadataBeforeSuccessSettlement(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 901, 1000)
	seedToken(t, 911, 901, "sk-techmobi-archive-success", 500)
	task := newTechMobiPollingTask(t, 901, 931, 100, 911)
	ch := newTechMobiPollingChannel("http://proxy.internal:8080")
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
	expected := &model.VideoResult{
		Bucket:      "archive-bucket",
		Object:      "video-results/20260806/task_archive_success.mp4",
		Generation:  12,
		ContentType: "video/mp4",
		Size:        2048,
		StoredAt:    time.Date(2026, 8, 6, 1, 2, 3, 0, time.UTC).Unix(),
		ExpiresAt:   time.Date(2026, 8, 7, 1, 2, 3, 0, time.UTC).Unix(),
	}
	var archiveCalls int
	archiveTechMobiVideoResult = func(_ context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error) {
		archiveCalls++
		require.Equal(t, "task_archive_success", publicTaskID)
		require.Equal(t, "https://secret.example/video.mp4?token=secret", upstreamURL)
		require.Equal(t, "http://proxy.internal:8080", proxy)
		require.EqualValues(t, model.TaskStatusInProgress, task.Status, "archive must run before final success status mutation")
		require.Zero(t, task.FinishTime, "archive must run before final finish time mutation")
		return expected, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.NoError(t, err)
	require.Equal(t, 1, archiveCalls)
	require.Equal(t, 1, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, "100%", stored.Progress)
	require.NotZero(t, stored.FinishTime)
	require.Equal(t, expected, stored.PrivateData.VideoResult)
	require.Equal(t, taskcommon.BuildProxyURL(task.TaskID), stored.PrivateData.ResultURL)
	require.NotEqual(t, "https://secret.example/video.mp4?token=secret", stored.PrivateData.ResultURL)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
	require.NotContains(t, string(stored.Data), "secret.example")
	require.NotContains(t, string(stored.Data), "video.mp4?token=secret")
}

func TestUpdateVideoSingleTaskGrokPollingPassesOriginChannelID(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	task := &model.Task{
		TaskID:    "task_grok_polling_channel",
		UserId:    901,
		ChannelId: 11301,
		Platform:  constant.TaskPlatform("113"),
		Quota:     100,
		Action:    constant.TaskActionGenerate,
		Status:    model.TaskStatusSubmitted,
		Progress:  "10%",
		Data:      []byte(`{}`),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-grok-request",
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	ch := &model.Channel{Id: 11301, Type: constant.ChannelTypeGrokSubscription, Key: "stored-oauth-json", Status: common.ChannelStatusEnabled}
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"status":"pending"}`),
		taskResult:   &relaycommon.TaskInfo{Status: model.TaskStatusQueued, Progress: "20%"},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{task.GetUpstreamTaskID(): task})
	require.NoError(t, err)
	require.Equal(t, map[string]any{
		"task_id":    "upstream-grok-request",
		"action":     constant.TaskActionGenerate,
		"channel_id": 11301,
	}, adaptor.fetchBody)
	require.Empty(t, adaptor.fetchKey, "Grok polling must not use the stored channel key as OAuth")
}

func TestUpdateVideoSingleTaskGrokVideoResultPersistsPrivateURLAndPublicProxy(t *testing.T) {
	truncate(t)
	ctx := context.Background()
	sourceURL := "https://vidgen.x.ai/tmp/private.mp4?token=secret"
	task := &model.Task{
		TaskID:    "task_grok_private_video_result",
		UserId:    901,
		ChannelId: 11301,
		Platform:  constant.TaskPlatform("113"),
		Quota:     100,
		Action:    constant.TaskActionGenerate,
		Status:    model.TaskStatusSubmitted,
		Progress:  "10%",
		Data:      []byte(`{}`),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-grok-request",
			BillingSource:  BillingSourceSubscription,
			SubscriptionId: 33,
			TokenId:        44,
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	ch := &model.Channel{Id: 11301, Type: constant.ChannelTypeGrokSubscription, Key: "stored-oauth-json", Status: common.ChannelStatusEnabled}
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"request_id":"upstream-grok-request","status":"done","video":{"url":"https://vidgen.x.ai/tmp/private.mp4?token=secret","duration":6.5,"resolution":"1080p"}}`),
		taskResult: &relaycommon.TaskInfo{
			TaskID:     "upstream-grok-request",
			Status:     model.TaskStatusSuccess,
			Url:        sourceURL,
			Progress:   "100%",
			Duration:   6.5,
			Resolution: "1080p",
		},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{task.GetUpstreamTaskID(): task})
	require.NoError(t, err)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, taskcommon.BuildProxyURL(task.TaskID), stored.PrivateData.ResultURL)
	require.NotContains(t, stored.PrivateData.ResultURL, "vidgen.x.ai")
	require.NotNil(t, stored.PrivateData.GrokVideoResult)
	require.Equal(t, sourceURL, stored.PrivateData.GrokVideoResult.URL)
	require.Equal(t, 6.5, stored.PrivateData.GrokVideoResult.Duration)
	require.Equal(t, "1080p", stored.PrivateData.GrokVideoResult.Resolution)
	require.NotContains(t, string(stored.Data), "vidgen.x.ai")
	require.NotContains(t, string(stored.Data), "upstream-grok-request")
	require.Empty(t, stored.PrivateData.Key)
	require.Equal(t, 33, stored.PrivateData.SubscriptionId)
	require.Equal(t, 44, stored.PrivateData.TokenId)
}

func TestUpdateVideoSingleTaskGrokSubscriptionDoesNotLogPrivateDetails(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 909, 1000)
	seedToken(t, 919, 909, "sk-grok-log-leak", 500)
	task := &model.Task{
		TaskID:    "task_grok_log_leak",
		UserId:    909,
		ChannelId: 11301,
		Platform:  constant.TaskPlatform("113"),
		Quota:     100,
		Action:    constant.TaskActionGenerate,
		Status:    model.TaskStatusSubmitted,
		Progress:  "50%",
		Data:      []byte(`{"status":"processing"}`),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-grok-secret",
			BillingSource:  BillingSourceWallet,
			TokenId:        919,
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	ch := &model.Channel{Id: 11301, Type: constant.ChannelTypeGrokSubscription, Key: "stored-oauth-json", Status: common.ChannelStatusEnabled}
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"request_id":"upstream-grok-secret","status":"done","video":{"url":"https://vidgen.x.ai/private.mp4?token=secret","duration":6.5,"resolution":"1080p"}}`),
		taskResult: &relaycommon.TaskInfo{
			TaskID:     "upstream-grok-secret",
			Status:     model.TaskStatusSuccess,
			Url:        "https://vidgen.x.ai/private.mp4?token=secret",
			Progress:   "100%",
			Duration:   6.5,
			Resolution: "1080p",
		},
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{task.GetUpstreamTaskID(): task}))

	logText := logs.String()
	require.NotContains(t, logText, "upstream-grok-secret")
	require.NotContains(t, logText, "vidgen.x.ai")
	require.NotContains(t, logText, "private.mp4")
	require.NotContains(t, logText, "token=secret")
}

func TestUpdateVideoSingleTaskReturnSourceURLSkipsArchive(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 906, 1000)
	seedToken(t, 916, 906, "sk-techmobi-source-url", 500)
	task := newTechMobiPollingTask(t, 906, 936, 100, 916)
	ch := newTechMobiPollingChannelWithSourceURL(936)
	sourceURL := "https://secret.example/video.mp4?token=secret"
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-techmobi-success",
			Status:      model.TaskStatusSuccess,
			Url:         sourceURL,
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not be called when TechMobi source URL return is enabled")
		return nil, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.NoError(t, err)
	require.Equal(t, 1, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, sourceURL, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
	require.NotContains(t, string(stored.Data), "secret.example")
	require.NotContains(t, string(stored.Data), "token=secret")
}

func TestUpdateVideoSingleTaskReturnSourceURLSettingIgnoredForOtherWhitelabelChannels(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 908, 1000)
	seedToken(t, 918, 908, "sk-techmobi-source-url-other-whitelabel", 500)
	task := newTechMobiPollingTask(t, 908, 938, 100, 918)
	ch := newTechMobiPollingChannelWithSourceURL(938)
	ch.Type = constant.ChannelTypeKuaiziLizhen
	sourceURL := "https://secret.example/video.mp4?token=secret"
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-techmobi-success",
			Status:      model.TaskStatusSuccess,
			Url:         sourceURL,
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("TechMobi archive hook must not be called for other whitelabel channel types")
		return nil, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.NoError(t, err)
	require.Equal(t, 1, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, taskcommon.BuildProxyURL(task.TaskID), stored.PrivateData.ResultURL)
	require.NotEqual(t, sourceURL, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
}

func TestUpdateVideoSingleTaskReturnSourceURLCASLoserDoesNotSettleTwice(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 909, 1000)
	seedToken(t, 919, 909, "sk-techmobi-source-url-cas-loser", 500)
	task := newTechMobiPollingTask(t, 909, 939, 100, 919)
	var staleTask model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&staleTask).Error)

	ch := newTechMobiPollingChannelWithSourceURL(939)
	sourceURL := "https://secret.example/video.mp4?token=secret"
	winnerAdaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-techmobi-success",
			Status:      model.TaskStatusSuccess,
			Url:         sourceURL,
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	loserAdaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-techmobi-success",
			Status:      model.TaskStatusSuccess,
			Url:         sourceURL,
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not be called when TechMobi source URL return is enabled")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, winnerAdaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))
	require.NoError(t, updateVideoSingleTask(ctx, loserAdaptor, ch, staleTask.GetUpstreamTaskID(), techMobiTaskMap(&staleTask)))
	require.Equal(t, 1, winnerAdaptor.adjustCalls)
	require.Equal(t, 0, loserAdaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, sourceURL, stored.PrivateData.ResultURL)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
}

func TestUpdateVideoSingleTaskReturnSourceURLMissingDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 907, 1000)
	seedToken(t, 917, 907, "sk-techmobi-source-url-missing", 500)
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
		t.Fatal("archive hook must not be called when TechMobi source URL return is enabled")
		return nil, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "missing source URL")
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

func TestUpdateVideoSingleTaskArchiveErrorDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	resetVideoResultMetricsForServiceTest(t)
	ctx := context.Background()

	seedUser(t, 902, 1000)
	seedToken(t, 912, 902, "sk-techmobi-archive-error", 500)
	task := newTechMobiPollingTask(t, 902, 932, 100, 912)
	task.Progress = "ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id"
	ch := newTechMobiPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-techmobi-error",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
		actualQuota: 40,
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		return nil, errors.New("download failed from https://secret.example/video.mp4?token=secret")
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "video archive failed for task")
	require.Contains(t, err.Error(), "phase=archive")
	require.Contains(t, err.Error(), "status=SUCCESS")
	require.Contains(t, err.Error(), "archive unavailable")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), "upstream-secret-id")
	require.NotContains(t, err.Error(), "secret.example")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Equal(t, 100, stored.Quota)
	text, err := perfmetrics.BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `newapi_video_result_archive_retry_total{channel="techmobi",reason="archive_failure"} 1`)
}

func TestUpdateVideoSingleTaskModelAPIRejectsProxyBeforeFetchOrArchive(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 910, 1000)
	seedToken(t, 920, 910, "sk-modelapi-archive-success", 500)
	task := newModelAPIPollingTaskWithID(t, "task_proxy_fail_closed", 910, 940, 100, 920)
	ch := newModelAPIPollingChannel("http://proxy.internal:8080")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-modelapi-success",
			Status:      model.TaskStatusSuccess,
			Url:         "https://secret.example/video.mp4?token=secret",
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	var archiveCalls int
	archiveModelAPIVideoResult = func(_ context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error) {
		archiveCalls++
		return nil, errors.New("archive must not run")
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_proxy_fail_closed")
	require.Contains(t, err.Error(), "phase=fetch")
	require.NotContains(t, err.Error(), "proxy.internal")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.Equal(t, 0, archiveCalls)
	require.Equal(t, 0, adaptor.fetchCalls)
	require.Equal(t, 0, adaptor.parseCalls)
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.NotContains(t, string(stored.Data), "https://")
	require.NotContains(t, string(stored.Data), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(string(stored.Data)), "modelapi")
	require.NotContains(t, string(stored.Data), "secret.example")
}

func TestUpdateVideoSingleTaskModelAPIArchiveErrorDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	resetVideoResultMetricsForServiceTest(t)
	ctx := context.Background()

	seedUser(t, 911, 1000)
	seedToken(t, 921, 911, "sk-modelapi-archive-error", 500)
	task := newModelAPIPollingTaskWithID(t, "task_archive_error_public", 911, 941, 100, 921)
	task.Progress = "ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id"
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-modelapi-success",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
		actualQuota: 40,
	}
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		return nil, errors.New("download failed from https://secret.example/video.mp4?token=secret")
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "video archive failed for task")
	require.Contains(t, err.Error(), "phase=archive")
	require.Contains(t, err.Error(), "status=SUCCESS")
	require.Contains(t, err.Error(), "archive unavailable")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), "upstream-secret-id")
	require.NotContains(t, err.Error(), "secret.example")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Equal(t, 100, stored.Quota)

	text, err := perfmetrics.BuildPrometheusText(context.Background())
	require.NoError(t, err)
	require.Contains(t, text, `newapi_video_result_archive_retry_total{channel="modelapi",reason="archive_failure"} 1`)
}

func TestUpdateVideoSingleTaskModelAPIArchiveFailureNoUpstreamLeaks(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 927, 1000)
	seedToken(t, 927, 927, "sk-modelapi-archive-leak", 500)
	task := newModelAPIPollingTaskWithID(t, "task_archive_leak", 927, 947, 100, 927)
	task.Progress = "ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id"
	upstreamTaskID := task.GetUpstreamTaskID()
	ch := newModelAPIPollingChannel("")
	archiveError := errors.New("download failed from https://secret.example/video.mp4?token=secret")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-modelapi-success",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
	}
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		return nil, archiveError
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "phase=archive")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), upstreamTaskID)
	require.NotContains(t, err.Error(), "upstream-secret-id")
	require.NotContains(t, err.Error(), "secret.example")

	logText := logs.String()
	require.NotContains(t, logText, "modelapi")
	require.NotContains(t, logText, "api.modelapi.co")
	require.NotContains(t, logText, "https://")
	require.NotContains(t, logText, upstreamTaskID)
	require.NotContains(t, logText, "upstream-secret-id")
	require.NotContains(t, logText, "secret.example")
}

func TestUpdateVideoSingleTaskModelAPIFetchErrorDoesNotLeakUpstreamDetails(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 928, 1000)
	seedToken(t, 928, 928, "sk-modelapi-fetch-leak", 500)
	task := newModelAPIPollingTaskWithID(t, "task_fetch_error", 928, 948, 100, 928)
	upstreamTaskID := task.GetUpstreamTaskID()
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		fetchErr: &url.Error{
			Op:  "Get",
			URL: "https://api.modelapi.co/v1/tasks/upstream-secret-id",
			Err: errors.New("dial upstream-secret-id failed"),
		},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_fetch_error")
	require.Contains(t, err.Error(), "phase=fetch")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), upstreamTaskID)
	require.NotContains(t, err.Error(), "upstream-secret-id")
	require.NotContains(t, logs.String(), "https://")
	require.NotContains(t, logs.String(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(logs.String()), "modelapi")
	require.NotContains(t, logs.String(), upstreamTaskID)
	require.NotContains(t, logs.String(), "upstream-secret-id")
}

func TestUpdateVideoSingleTaskModelAPIReadErrorDoesNotLeakUpstreamDetails(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 929, 1000)
	seedToken(t, 929, 929, "sk-modelapi-read-leak", 500)
	task := newModelAPIPollingTaskWithID(t, "task_read_error", 929, 949, 100, 929)
	upstreamTaskID := task.GetUpstreamTaskID()
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		body: errReadCloser{err: errors.New("read https://api.modelapi.co/v1/tasks/upstream-secret-id failed")},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_read_error")
	require.Contains(t, err.Error(), "phase=read")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), upstreamTaskID)
	require.NotContains(t, err.Error(), "upstream-secret-id")
}

func TestUpdateVideoSingleTaskModelAPIOverLimitBodyDoesNotPersistOrLeak(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 933, 1000)
	seedToken(t, 933, 933, "sk-modelapi-read-limit", 500)
	task := newModelAPIPollingTaskWithID(t, "task_read_limit", 933, 953, 100, 933)
	ch := newModelAPIPollingChannel("")
	secretBody := append(bytes.Repeat([]byte("a"), 1024*1024), []byte("https://api.modelapi.co/v1/tasks/upstream-secret-id")...)
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: secretBody,
		taskResult: &relaycommon.TaskInfo{
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
		actualQuota: 40,
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_read_limit")
	require.Contains(t, err.Error(), "phase=read")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Equal(t, json.RawMessage(`{"status":"processing"}`), stored.Data)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
}

func TestUpdateVideoSingleTaskModelAPIParseErrorDoesNotLeakUpstreamDetails(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 930, 1000)
	seedToken(t, 930, 930, "sk-modelapi-parse-leak", 500)
	task := newModelAPIPollingTaskWithID(t, "task_parse_error", 930, 950, 100, 930)
	upstreamTaskID := task.GetUpstreamTaskID()
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"status":"not-new-api"}`),
		parseErr:     errors.New("parse ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id failed"),
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_parse_error")
	require.Contains(t, err.Error(), "phase=parse")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), upstreamTaskID)
	require.NotContains(t, err.Error(), "upstream-secret-id")
}

func TestUpdateVideoSingleTaskModelAPISkipsGenericWrapperAndRequiresAdaptorParse(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 934, 1000)
	seedToken(t, 934, 934, "sk-modelapi-wrapper-bypass", 500)
	task := newModelAPIPollingTaskWithID(t, "task_wrapper_bypass", 934, 954, 100, 934)
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{
			"code":"success",
			"data":{
				"task_id":"task_wrapper_bypass",
				"status":"SUCCESS",
				"fail_reason":"https://secret.example/forged.mp4?token=secret",
				"progress":"100%"
			}
		}`),
		parseErr: errors.New("parse ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id failed"),
	}
	var archiveCalls int
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		archiveCalls++
		return &model.VideoResult{
			Bucket:      "archive-bucket",
			Object:      "video-results/20260806/task_wrapper_bypass.mp4",
			ContentType: "video/mp4",
			Size:        1,
		}, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Equal(t, 1, adaptor.parseCalls)
	require.Equal(t, 0, archiveCalls)
	require.Contains(t, err.Error(), "task_wrapper_bypass")
	require.Contains(t, err.Error(), "phase=parse")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
}

func TestUpdateVideoSingleTaskModelAPIFetchAndReadUseHardDeadline(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 935, 1000)
	seedToken(t, 935, 935, "sk-modelapi-deadline", 500)
	task := newModelAPIPollingTaskWithID(t, "task_modelapi_deadline", 935, 955, 100, 935)
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		taskResult: &relaycommon.TaskInfo{
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
	}
	body := &deadlineAwareReadCloser{ctx: &adaptor.fetchCtx}
	adaptor.body = body

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_modelapi_deadline")
	require.Contains(t, err.Error(), "phase=read")
	require.True(t, adaptor.fetchUsedContext)
	require.NotNil(t, adaptor.fetchCtx)
	deadline, ok := adaptor.fetchCtx.Deadline()
	require.True(t, ok, "ModelAPI fetch must receive a hard deadline even with Background parent ctx")
	require.WithinDuration(t, time.Now().Add(30*time.Second), deadline, time.Second)
	require.True(t, body.sawDeadline, "ModelAPI body read must use the same deadline-bound context")
	require.Equal(t, 0, adaptor.parseCalls)
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Empty(t, stored.PrivateData.ResultURL)
	require.Nil(t, stored.PrivateData.VideoResult)
}

func TestUpdateVideoTasksModelAPIDoesNotLogChannelID(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 931, 1000)
	seedToken(t, 931, 931, "sk-modelapi-channel-log", 500)
	task := newModelAPIPollingTaskWithID(t, "task_channel_log", 931, 951, 100, 931)
	ch := newModelAPIPollingChannel("")
	ch.Id = 951
	require.NoError(t, model.DB.Create(ch).Error)
	originalAdaptorFunc := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(platform constant.TaskPlatform) TaskPollingAdaptor {
		require.Equal(t, constant.TaskPlatform("111"), platform)
		return &fakeVideoPollingAdaptor{
			fetchErr: errors.New("fetch failed from https://api.modelapi.co/v1/tasks/upstream-secret-id"),
		}
	}
	t.Cleanup(func() {
		GetTaskAdaptorFunc = originalAdaptorFunc
	})

	require.NoError(t, UpdateVideoTasks(ctx, constant.TaskPlatform("111"), map[int][]string{ch.Id: []string{task.GetUpstreamTaskID()}}, modelAPITaskMap(task)))

	logText := logs.String()
	require.NotContains(t, logText, "Channel #")
	require.NotContains(t, logText, "951")
	require.NotContains(t, logText, "https://")
	require.NotContains(t, logText, "api.modelapi.co")
	require.NotContains(t, strings.ToLower(logText), "modelapi")
	require.NotContains(t, logText, task.GetUpstreamTaskID())
	require.NotContains(t, logText, "upstream-secret-id")
}

func TestUpdateVideoSingleTaskModelAPIUnknownStatusDoesNotLeakUpstreamDetails(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 932, 1000)
	seedToken(t, 932, 932, "sk-modelapi-status-leak", 500)
	task := newModelAPIPollingTaskWithID(t, "task_status_error", 932, 952, 100, 932)
	upstreamTaskID := task.GetUpstreamTaskID()
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"status":"not-new-api"}`),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-modelapi-success",
			Status:   "ModelAPI failed at https://api.modelapi.co/v1/tasks/upstream-secret-id",
			Reason:   "reason from https://api.modelapi.co/v1/tasks/upstream-secret-id",
			Progress: "100%",
		},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "task_status_error")
	require.Contains(t, err.Error(), "phase=status")
	require.Contains(t, err.Error(), "status=unknown")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), upstreamTaskID)
	require.NotContains(t, err.Error(), "upstream-secret-id")

	logText := logs.String()
	require.NotContains(t, logText, "https://")
	require.NotContains(t, logText, "api.modelapi.co")
	require.NotContains(t, strings.ToLower(logText), "modelapi")
	require.NotContains(t, logText, upstreamTaskID)
	require.NotContains(t, logText, "upstream-secret-id")
}

func TestUpdateVideoSingleTaskModelAPIEmptySuccessURLDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 912, 1000)
	seedToken(t, 922, 912, "sk-modelapi-empty-url", 500)
	task := newModelAPIPollingTaskWithID(t, "task_empty_url_public", 912, 942, 100, 922)
	task.Progress = "ModelAPI https://api.modelapi.co/v1/tasks/upstream-secret-id"
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-modelapi-success",
			Status:   model.TaskStatusSuccess,
			Url:      "   ",
			Progress: "100%",
		},
		actualQuota: 40,
	}
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not be called when ModelAPI success URL is empty")
		return nil, nil
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.Error(t, err)
	require.Contains(t, err.Error(), "missing source URL")
	require.Contains(t, err.Error(), "phase=source")
	require.NotContains(t, err.Error(), "https://")
	require.NotContains(t, err.Error(), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(err.Error()), "modelapi")
	require.NotContains(t, err.Error(), "upstream-secret-id")
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusInProgress, stored.Status)
	require.Equal(t, "50%", stored.Progress)
	require.Zero(t, stored.FinishTime)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.Empty(t, stored.PrivateData.ResultURL)
}

func TestUpdateVideoSingleTaskModelAPIRedactsStoredDataAndLogs(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 913, 1000)
	seedToken(t, 923, 913, "sk-modelapi-redaction", 500)
	task := newModelAPIPollingTaskWithID(t, "task_archive_redaction", 913, 943, 100, 923)
	ch := newModelAPIPollingChannel("")
	upstreamURL := "https://api.modelapi.co/private/video.mp4?token=secret"
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIRedactionResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-modelapi-success",
			Status:      model.TaskStatusSuccess,
			Url:         upstreamURL,
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		return &model.VideoResult{
			Bucket:      "archive-bucket",
			Object:      "video-results/20260806/task_archive_redaction.mp4",
			ContentType: "video/mp4",
			Size:        1,
		}, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task)))

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	storedData := string(stored.Data)
	require.NotContains(t, storedData, upstreamURL)
	require.NotContains(t, storedData, "opaque-upstream-task-123")
	require.NotContains(t, storedData, "task_id")
	require.NotContains(t, storedData, "https://")
	require.NotContains(t, storedData, "api.modelapi.co")
	require.NotContains(t, strings.ToLower(storedData), "modelapi")

	logText := logs.String()
	upstreamTaskID := "upstream-modelapi-success"
	require.NotContains(t, logText, upstreamTaskID)
	require.NotContains(t, logText, upstreamURL)
	require.NotContains(t, logText, "https://")
	require.NotContains(t, logText, "api.modelapi.co")
	require.NotContains(t, logText, "channel_id=")
	require.NotContains(t, logText, "reason=")
	require.NotContains(t, strings.ToLower(logText), "modelapi")
}

func TestUpdateVideoSingleTaskModelAPIFailureRedactsDBAndLogs(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 914, 1000)
	seedToken(t, 924, 914, "sk-modelapi-failure-redaction", 500)
	task := newModelAPIPollingTaskWithID(t, "task_archive_failure", 914, 944, 100, 924)
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIFailureResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-modelapi-success",
			Status:   model.TaskStatusFailure,
			Reason:   "ModelAPI render failed at https://api.modelapi.co/private/failure.mp4?token=secret",
			Progress: "100%",
		},
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task)))

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusFailure, stored.Status)
	require.NotContains(t, strings.ToLower(stored.FailReason), "modelapi")
	require.NotContains(t, stored.FailReason, "https://")
	require.NotContains(t, stored.FailReason, "api.modelapi.co")
	require.NotContains(t, strings.ToLower(string(stored.Data)), "modelapi")
	require.NotContains(t, string(stored.Data), "https://")
	require.NotContains(t, string(stored.Data), "api.modelapi.co")
	require.NotContains(t, strings.ToLower(logs.String()), "modelapi")
	require.NotContains(t, logs.String(), "https://")
	require.NotContains(t, logs.String(), "api.modelapi.co")
	require.NotContains(t, logs.String(), "channel_id=")
	require.NotContains(t, logs.String(), "reason=")
	require.NotContains(t, logs.String(), "render failed")
	require.NotContains(t, logs.String(), "upstream-modelapi-success")
}

func TestUpdateVideoSingleTaskModelAPIUnknownErrorFormatDoesNotLogRawResponse(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 915, 1000)
	seedToken(t, 925, 915, "sk-modelapi-unknown-redaction", 500)
	task := newModelAPIPollingTaskWithID(t, "task_archive_unknown", 915, 945, 100, 925)
	ch := newModelAPIPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: []byte(`{"unexpected":"ModelAPI raw https://api.modelapi.co/private/video.mp4?token=secret"}`),
		taskResult:   &relaycommon.TaskInfo{},
	}

	err := updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task))
	require.NoError(t, err)
	require.NotContains(t, strings.ToLower(logs.String()), "modelapi")
	require.NotContains(t, logs.String(), "https://")
	require.NotContains(t, logs.String(), "api.modelapi.co")
	require.NotContains(t, logs.String(), "upstream-modelapi-success")
}

func TestUpdateVideoSingleTaskModelAPICASLoserDoesNotSettleTwice(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 916, 1000)
	seedToken(t, 926, 916, "sk-modelapi-cas-loser", 500)
	task := newModelAPIPollingTaskWithID(t, "task_modelapi_cas_loser", 916, 946, 100, 926)
	var staleTask model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&staleTask).Error)

	ch := newModelAPIPollingChannel("")
	winnerAdaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-modelapi-success",
			Status:      model.TaskStatusSuccess,
			Url:         "https://secret.example/video.mp4?token=secret",
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	loserAdaptor := &fakeVideoPollingAdaptor{
		responseBody: modelAPIArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:      "upstream-modelapi-success",
			Status:      model.TaskStatusSuccess,
			Url:         "https://secret.example/video.mp4?token=secret",
			Progress:    "100%",
			TotalTokens: 40,
		},
		actualQuota: 40,
	}
	archiveModelAPIVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		return &model.VideoResult{
			Bucket:      "archive-bucket",
			Object:      "video-results/20260806/task_modelapi_cas_loser.mp4",
			ContentType: "video/mp4",
			Size:        1,
		}, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, winnerAdaptor, ch, task.GetUpstreamTaskID(), modelAPITaskMap(task)))
	require.NoError(t, updateVideoSingleTask(ctx, loserAdaptor, ch, staleTask.GetUpstreamTaskID(), modelAPITaskMap(&staleTask)))
	require.Equal(t, 1, winnerAdaptor.adjustCalls)
	require.Equal(t, 0, loserAdaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
}

func TestUpdateVideoSingleTaskArchiveSkipsExistingMetadata(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 903, 1000)
	seedToken(t, 913, 903, "sk-techmobi-archive-existing", 500)
	task := newTechMobiPollingTask(t, 903, 933, 100, 913)
	existing := &model.VideoResult{
		Bucket:      "archive-bucket",
		Object:      "video-results/old.mp4",
		Generation:  8,
		ContentType: "video/mp4",
		Size:        99,
		StoredAt:    1,
		ExpiresAt:   2,
	}
	task.PrivateData.VideoResult = existing
	require.NoError(t, model.DB.Save(task).Error)
	ch := newTechMobiPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-techmobi-existing",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not be called when metadata already exists")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))
	require.Equal(t, 1, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Equal(t, existing, stored.PrivateData.VideoResult)
}

func TestUpdateVideoSingleTaskArchiveDoesNotBackfillHistoricalSuccess(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	ctx := context.Background()

	seedUser(t, 904, 1000)
	seedToken(t, 914, 904, "sk-techmobi-archive-historical", 500)
	task := newTechMobiPollingTask(t, 904, 934, 100, 914)
	task.Status = model.TaskStatusSuccess
	task.Progress = "100%"
	task.FinishTime = 123
	require.NoError(t, model.DB.Save(task).Error)
	ch := newTechMobiPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiArchiveResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-techmobi-existing",
			Status:   model.TaskStatusSuccess,
			Url:      "https://secret.example/video.mp4?token=secret",
			Progress: "100%",
		},
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not backfill historical success tasks")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))
	require.Equal(t, 0, adaptor.adjustCalls)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSuccess, stored.Status)
	require.Nil(t, stored.PrivateData.VideoResult)
	require.EqualValues(t, 123, stored.FinishTime)
}

func TestUpdateVideoSingleTaskArchiveFailurePayloadRedactsDBAndLogs(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	logs := capturePollingLogs(t)
	ctx := context.Background()

	seedUser(t, 905, 1000)
	seedToken(t, 915, 905, "sk-techmobi-failure-redaction", 500)
	task := newTechMobiPollingTask(t, 905, 935, 100, 915)
	ch := newTechMobiPollingChannel("")
	adaptor := &fakeVideoPollingAdaptor{
		responseBody: techMobiFailureResponseBody(),
		taskResult: &relaycommon.TaskInfo{
			TaskID:   "upstream-techmobi-success",
			Status:   model.TaskStatusFailure,
			Reason:   "render failed: https://secret.example/failure.mp4?token=secret",
			Progress: "100%",
		},
	}
	archiveTechMobiVideoResult = func(context.Context, string, string, string) (*model.VideoResult, error) {
		t.Fatal("archive hook must not run for failure payloads")
		return nil, nil
	}

	require.NoError(t, updateVideoSingleTask(ctx, adaptor, ch, task.GetUpstreamTaskID(), techMobiTaskMap(task)))

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusFailure, stored.Status)
	require.Contains(t, stored.FailReason, "render failed")
	require.NotContains(t, stored.FailReason, "secret.example")
	require.NotContains(t, stored.FailReason, "token=secret")
	require.Equal(t, "100%", stored.Progress)
	require.NotContains(t, string(stored.Data), "secret.example")
	require.NotContains(t, string(stored.Data), "token=secret")

	var data map[string]any
	require.NoError(t, common.Unmarshal(stored.Data, &data))
	require.Equal(t, "failed", data["status"])
	require.Equal(t, "render failed", data["reason"])

	require.NotContains(t, logs.String(), "secret.example")
	require.NotContains(t, logs.String(), "token=secret")
	require.Contains(t, logs.String(), "task_archive_success")
	require.NotContains(t, logs.String(), "render failed")
}

func TestRedactTechMobiVideoResponseBodyRemovesUpstreamURLsAndKeepsPublicFields(t *testing.T) {
	body := []byte(`{
		"id":"upstream-techmobi-123",
		"status":"succeeded",
		"progress":"100%",
		"url":"https://secret.example/top.mp4?token=secret",
		"usage":{"total_tokens":40,"completion_tokens":40},
		"content":[
			{"type":"video","video_url":"https://secret.example/array-string.mp4?token=secret"},
			{"type":"video","video_url":{"url":"https://secret.example/array-object.mp4?token=secret","mime_type":"video/mp4"}},
			{"type":"text","text":"safe"}
		],
		"result":{
			"content":{"video_url":["https://secret.example/object-content.mp4?token=secret","safe"]},
			"message":"download at https://secret.example/message.mp4?token=secret, when ready",
			"nested":{"download_url":"https://secret.example/nested.mp4?token=secret","objectURL":"https://secret.example/object-url.mp4"}
		}
	}`)

	redacted := redactTechMobiVideoResponseBody(body)
	var redactedValue any
	require.NoError(t, common.Unmarshal(redacted, &redactedValue))
	require.NotContains(t, string(redacted), "secret.example")
	require.NotContains(t, string(redacted), "token=secret")

	var got map[string]any
	require.NoError(t, common.Unmarshal(redacted, &got))
	require.Equal(t, "upstream-techmobi-123", got["id"])
	require.Equal(t, "succeeded", got["status"])
	require.Equal(t, "100%", got["progress"])
	require.Equal(t, float64(40), got["usage"].(map[string]any)["total_tokens"])
	require.Equal(t, "[redacted]", got["url"])
	content := got["content"].([]any)
	require.Equal(t, "[redacted]", content[0].(map[string]any)["video_url"])
	videoURLObject := content[1].(map[string]any)["video_url"].(map[string]any)
	require.Equal(t, "[redacted]", videoURLObject["url"])
	require.Equal(t, "video/mp4", videoURLObject["mime_type"])
	result := got["result"].(map[string]any)
	videoURLs := result["content"].(map[string]any)["video_url"].([]any)
	require.Equal(t, "[redacted]", videoURLs[0])
	require.Equal(t, "safe", videoURLs[1])
	require.Equal(t, "download at [redacted], when ready", result["message"])
}

func TestRedactTechMobiVideoResponseBodyHandlesTopLevelValues(t *testing.T) {
	for _, tt := range []struct {
		name string
		body string
		want string
	}{
		{
			name: "array",
			body: `["https://secret.example/array.mp4?token=secret","safe"]`,
			want: `["[redacted]","safe"]`,
		},
		{
			name: "string",
			body: `"see https://secret.example/string.mp4?token=secret) done"`,
			want: `"see [redacted]) done"`,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			redacted := redactTechMobiVideoResponseBody([]byte(tt.body))
			require.JSONEq(t, tt.want, string(redacted))
			require.NotContains(t, string(redacted), "secret.example")
			require.NotContains(t, string(redacted), "token=secret")
		})
	}
}

func restoreArchiveHookForPollingTest(t *testing.T) {
	t.Helper()
	original := archiveTechMobiVideoResult
	originalModelAPI := archiveModelAPIVideoResult
	originalForChannel := archiveVideoResultForChannel
	t.Cleanup(func() {
		archiveTechMobiVideoResult = original
		archiveModelAPIVideoResult = originalModelAPI
		archiveVideoResultForChannel = originalForChannel
	})
}

func capturePollingLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	originalDebug := common.DebugEnabled
	originalWriter := gin.DefaultWriter
	originalErrorWriter := gin.DefaultErrorWriter
	buf := &bytes.Buffer{}
	common.LogWriterMu.Lock()
	common.DebugEnabled = true
	gin.DefaultWriter = buf
	gin.DefaultErrorWriter = buf
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		common.DebugEnabled = originalDebug
		gin.DefaultWriter = originalWriter
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})
	return buf
}

func techMobiTaskMap(task *model.Task) map[string]*model.Task {
	return map[string]*model.Task{task.GetUpstreamTaskID(): task}
}

func newTechMobiPollingTask(t *testing.T, userID, channelID, quota, tokenID int) *model.Task {
	t.Helper()
	task := &model.Task{
		TaskID:    "task_archive_success",
		UserId:    userID,
		ChannelId: channelID,
		Quota:     quota,
		Status:    model.TaskStatusInProgress,
		Group:     "default",
		Progress:  "50%",
		Data:      json.RawMessage(`{"status":"processing"}`),
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-techmobi-success",
			BillingSource:  BillingSourceWallet,
			TokenId:        tokenID,
			BillingContext: &model.TaskBillingContext{OriginModelName: "seedance-2.0"},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func newModelAPIPollingTask(t *testing.T, userID, channelID, quota, tokenID int) *model.Task {
	t.Helper()
	return newModelAPIPollingTaskWithID(t, "task_modelapi_success", userID, channelID, quota, tokenID)
}

func newModelAPIPollingTaskWithID(t *testing.T, taskID string, userID, channelID, quota, tokenID int) *model.Task {
	t.Helper()
	task := &model.Task{
		TaskID:    taskID,
		UserId:    userID,
		ChannelId: channelID,
		Quota:     quota,
		Status:    model.TaskStatusInProgress,
		Group:     "default",
		Progress:  "50%",
		Data:      json.RawMessage(`{"status":"processing"}`),
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-video-success",
			BillingSource:  BillingSourceWallet,
			TokenId:        tokenID,
			BillingContext: &model.TaskBillingContext{OriginModelName: "seedance-2.5"},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.5"},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func newModelAPIPollingChannel(proxy string) *model.Channel {
	ch := &model.Channel{
		Id:     940,
		Type:   constant.ChannelTypeModelAPISeedance,
		Key:    "sk-modelapi",
		Status: 1,
	}
	if proxy != "" {
		ch.SetSetting(dto.ChannelSettings{Proxy: proxy})
	}
	return ch
}

func modelAPIArchiveResponseBody() []byte {
	return []byte(`{
		"id":"upstream-modelapi-success",
		"status":"succeeded",
		"result":{"assets":[{"type":"video","url":"https://secret.example/video.mp4?token=secret"}]},
		"usage":{"total_tokens":40}
	}`)
}

func modelAPIRedactionResponseBody() []byte {
	return []byte(`{
		"id":"upstream-modelapi-success",
		"task_id":"opaque-upstream-task-123",
		"status":"succeeded",
		"result":{
			"assets":[
				{"type":"video","url":"https://api.modelapi.co/private/video.mp4?token=secret"},
				{"type":"thumbnail","download_url":"https://api.modelapi.co/private/thumb.jpg?token=secret"}
			],
			"message":"ModelAPI asset at https://api.modelapi.co/private/video.mp4?token=secret"
		},
		"usage":{"total_tokens":40}
	}`)
}

func modelAPIFailureResponseBody() []byte {
	return []byte(`{
		"id":"upstream-modelapi-success",
		"status":"failed",
		"reason":"ModelAPI render failed at https://api.modelapi.co/private/failure.mp4?token=secret",
		"result":{"assets":[{"url":"https://api.modelapi.co/private/video.mp4?token=secret"}]}
	}`)
}

func modelAPITaskMap(task *model.Task) map[string]*model.Task {
	return map[string]*model.Task{task.GetUpstreamTaskID(): task}
}

func newTechMobiPollingChannel(proxy string) *model.Channel {
	ch := &model.Channel{
		Id:     931,
		Type:   constant.ChannelTypeTechMobiVideo,
		Key:    "sk-techmobi",
		Status: 1,
	}
	if proxy != "" {
		ch.SetSetting(dto.ChannelSettings{Proxy: proxy})
	}
	return ch
}

func newTechMobiPollingChannelWithSourceURL(id int) *model.Channel {
	ch := newTechMobiPollingChannel("")
	ch.Id = id
	setting := ch.GetSetting()
	setting.ReturnSourceURL = true
	ch.SetSetting(setting)
	return ch
}

func techMobiArchiveResponseBody() []byte {
	return []byte(`{
		"id":"upstream-techmobi-success",
		"status":"succeeded",
		"progress":"100%",
		"content":[{"type":"video","video_url":"https://secret.example/video.mp4?token=secret"}],
		"usage":{"total_tokens":40}
	}`)
}

func techMobiFailureResponseBody() []byte {
	return []byte(`{
		"id":"upstream-techmobi-success",
		"status":"failed",
		"reason":"render failed",
		"url":"https://secret.example/top.mp4?token=secret",
		"content":[{"type":"video","video_url":"https://secret.example/video.mp4?token=secret"}],
		"result":{"download_url":"https://secret.example/download.mp4?token=secret"}
	}`)
}

type fakeVideoPollingAdaptor struct {
	responseBody     []byte
	taskResult       *relaycommon.TaskInfo
	actualQuota      int
	adjustCalls      int
	fetchErr         error
	parseErr         error
	fetchCalls       int
	parseCalls       int
	body             io.ReadCloser
	fetchCtx         context.Context
	fetchUsedContext bool
	fetchBaseURL     string
	fetchKey         string
	fetchBody        map[string]any
	fetchProxy       string
}

func (a *fakeVideoPollingAdaptor) Init(*relaycommon.RelayInfo) {}

func (a *fakeVideoPollingAdaptor) FetchTask(string, string, map[string]any, string) (*http.Response, error) {
	a.fetchCalls++
	if a.fetchErr != nil {
		return nil, a.fetchErr
	}
	body := a.body
	if body == nil {
		body = io.NopCloser(bytes.NewReader(a.responseBody))
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       body,
	}, nil
}

func (a *fakeVideoPollingAdaptor) FetchTaskWithContext(ctx context.Context, baseURL string, key string, body map[string]any, proxy string) (*http.Response, error) {
	a.fetchCtx = ctx
	a.fetchUsedContext = true
	a.fetchBaseURL = baseURL
	a.fetchKey = key
	a.fetchBody = body
	a.fetchProxy = proxy
	return a.FetchTask(baseURL, key, body, proxy)
}

func (a *fakeVideoPollingAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
	a.parseCalls++
	if a.parseErr != nil {
		return nil, a.parseErr
	}
	return a.taskResult, nil
}

func (a *fakeVideoPollingAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	a.adjustCalls++
	return a.actualQuota
}

type errReadCloser struct {
	err error
}

func (r errReadCloser) Read([]byte) (int, error) {
	return 0, r.err
}

func (r errReadCloser) Close() error {
	return nil
}

type deadlineAwareReadCloser struct {
	ctx         *context.Context
	sawDeadline bool
}

func (r *deadlineAwareReadCloser) Read([]byte) (int, error) {
	if r.ctx != nil && *r.ctx != nil {
		if _, ok := (*r.ctx).Deadline(); ok {
			r.sawDeadline = true
		}
	}
	return 0, errors.New("forced read error")
}

func (r *deadlineAwareReadCloser) Close() error {
	return nil
}
