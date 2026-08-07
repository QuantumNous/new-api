package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
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
	require.Equal(t, 40, stored.PrivateData.TotalTokens)
	require.NotContains(t, string(stored.Data), "secret.example")
	require.NotContains(t, string(stored.Data), "video.mp4?token=secret")
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

func TestUpdateVideoSingleTaskArchiveErrorDoesNotFinalizeOrSettle(t *testing.T) {
	truncate(t)
	restoreArchiveHookForPollingTest(t)
	resetVideoResultMetricsForServiceTest(t)
	ctx := context.Background()

	seedUser(t, 902, 1000)
	seedToken(t, 912, 902, "sk-techmobi-archive-error", 500)
	task := newTechMobiPollingTask(t, 902, 932, 100, 912)
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
	require.Contains(t, err.Error(), "archive techmobi video result failed")
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
	require.NoError(t, json.Unmarshal(stored.Data, &data))
	require.Equal(t, "failed", data["status"])
	require.Equal(t, "render failed", data["reason"])

	require.NotContains(t, logs.String(), "secret.example")
	require.NotContains(t, logs.String(), "token=secret")
	require.Contains(t, logs.String(), "task_archive_success")
	require.Contains(t, logs.String(), "render failed")
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
	require.True(t, json.Valid(redacted))
	require.NotContains(t, string(redacted), "secret.example")
	require.NotContains(t, string(redacted), "token=secret")

	var got map[string]any
	require.NoError(t, json.Unmarshal(redacted, &got))
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
	t.Cleanup(func() { archiveTechMobiVideoResult = original })
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
	responseBody []byte
	taskResult   *relaycommon.TaskInfo
	actualQuota  int
	adjustCalls  int
}

func (a *fakeVideoPollingAdaptor) Init(*relaycommon.RelayInfo) {}

func (a *fakeVideoPollingAdaptor) FetchTask(string, string, map[string]any, string) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(a.responseBody)),
	}, nil
}

func (a *fakeVideoPollingAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
	return a.taskResult, nil
}

func (a *fakeVideoPollingAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	a.adjustCalls++
	return a.actualQuota
}
