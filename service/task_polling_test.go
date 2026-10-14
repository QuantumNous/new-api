package service

import (
	"bytes"
	"context"
	"io"
	"math"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type taskPollingFetchAdaptor struct {
	mu           sync.Mutex
	initInfo     *relaycommon.RelayInfo
	taskIDs      []string
	fetched      chan string
	blockTaskID  string
	blockStarted chan struct{}
	releaseBlock chan struct{}
	blockOnce    sync.Once
}

type batchPollingAdaptor struct {
	taskPollingFetchAdaptor
	batchCalls     int
	batchIDs       []string
	batchKeys      []string
	batchIDsByCall [][]string
	batchParseKeys []string
	parseErrors    map[string]error
	results        map[string]*BatchTaskResult
}

func (a *batchPollingAdaptor) FetchMode() string { return "batch" }
func (a *batchPollingAdaptor) FetchBatchTasks(_ string, key string, tasks []*model.Task, _ string) (*http.Response, error) {
	a.batchCalls++
	a.batchIDs = a.batchIDs[:0]
	for _, task := range tasks {
		a.batchIDs = append(a.batchIDs, task.GetUpstreamTaskID())
	}
	a.batchKeys = append(a.batchKeys, key)
	a.batchIDsByCall = append(a.batchIDsByCall, append([]string(nil), a.batchIDs...))
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader([]byte(`{}`)))}, nil
}
func (a *batchPollingAdaptor) ParseBatchResult(_ []*model.Task, _ *http.Response, _ []byte) (map[string]*BatchTaskResult, error) {
	key := a.initAPIKey()
	a.batchParseKeys = append(a.batchParseKeys, key)
	if err := a.parseErrors[key]; err != nil {
		return nil, err
	}
	if a.results != nil {
		return a.results, nil
	}
	results := make(map[string]*BatchTaskResult, len(a.batchIDs))
	for _, taskID := range a.batchIDs {
		results[taskID] = &BatchTaskResult{TaskInfo: relaycommon.TaskInfo{TaskID: taskID, Status: model.TaskStatusInProgress, Url: "https://example.com/result"}}
	}
	return results, nil
}

func (a *taskPollingFetchAdaptor) Init(info *relaycommon.RelayInfo) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.initInfo = info
}
func (a *taskPollingFetchAdaptor) initAPIKey() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.initInfo == nil {
		return ""
	}
	return a.initInfo.ApiKey
}
func (a *taskPollingFetchAdaptor) initChannelMeta() *relaycommon.ChannelMeta {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.initInfo == nil {
		return nil
	}
	return a.initInfo.ChannelMeta
}

func (a *taskPollingFetchAdaptor) FetchTask(_ string, _ string, task *model.Task, _ string) (*http.Response, error) {
	taskID := ""
	if task != nil {
		taskID = task.GetUpstreamTaskID()
	}
	if taskID == a.blockTaskID && a.releaseBlock != nil {
		a.blockOnce.Do(func() {
			if a.blockStarted != nil {
				close(a.blockStarted)
			}
		})
		<-a.releaseBlock
	}

	a.mu.Lock()
	a.taskIDs = append(a.taskIDs, taskID)
	a.mu.Unlock()
	if a.fetched != nil {
		select {
		case a.fetched <- taskID:
		default:
		}
	}

	response := taskdto.TaskResponse[model.Task]{
		Code: taskdto.TaskSuccessCode,
		Data: model.Task{
			TaskID:   taskID,
			Status:   model.TaskStatusInProgress,
			Progress: "30%",
		},
	}
	responseBody, err := common.Marshal(response)
	if err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
	}, nil
}

func (a *taskPollingFetchAdaptor) ParseTaskResult(*model.Task, *http.Response, []byte) (*relaycommon.TaskInfo, error) {
	return &relaycommon.TaskInfo{Status: model.TaskStatusInProgress}, nil
}

func (a *taskPollingFetchAdaptor) AdjustBillingOnComplete(_ *model.Task, _ *relaycommon.TaskInfo) int {
	return 0
}

func (a *taskPollingFetchAdaptor) fetchCount() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.taskIDs)
}

func (a *taskPollingFetchAdaptor) fetchedTaskIDs() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]string(nil), a.taskIDs...)
}

func TestRedactVideoResponseBodyPreservesPollingPayloadShape(t *testing.T) {
	rawVideo := strings.Repeat("a", 300)
	body, err := common.Marshal(map[string]any{
		"done": true,
		"name": "operations/provider-task",
		"response": map[string]any{
			"bytesBase64Encoded": "secret-bytes",
			"video":              rawVideo,
			"videos": []any{
				map[string]any{
					"bytesBase64Encoded": "other-secret-bytes",
					"mimeType":           "video/mp4",
					"uri":                "https://media.example/video.mp4",
				},
			},
		},
	})
	require.NoError(t, err)

	var stored map[string]any
	require.NoError(t, common.Unmarshal(redactVideoResponseBody(body), &stored))
	assert.Equal(t, true, stored["done"])
	assert.Equal(t, "operations/provider-task", stored["name"])
	response, ok := stored["response"].(map[string]any)
	require.True(t, ok)
	assert.NotContains(t, response, "bytesBase64Encoded")
	assert.Equal(t, strings.Repeat("a", 256)+"...", response["video"])
	videos, ok := response["videos"].([]any)
	require.True(t, ok)
	require.Len(t, videos, 1)
	video, ok := videos[0].(map[string]any)
	require.True(t, ok)
	assert.NotContains(t, video, "bytesBase64Encoded")
	assert.Equal(t, "video/mp4", video["mimeType"])
	assert.Equal(t, "https://media.example/video.mp4", video["uri"])
}

func seedTaskPollingChannel(t *testing.T, id int, disableSleep bool) {
	t.Helper()
	ch := &model.Channel{
		Id:     id,
		Type:   constant.ChannelTypeKling,
		Name:   "polling_channel",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	if disableSleep {
		ch.SetOtherSettings(dto.ChannelOtherSettings{DisableTaskPollingSleep: true})
	}
	require.NoError(t, model.DB.Create(ch).Error)
}

func seedPollingTask(t *testing.T, channelID int, publicID string, upstreamID string) *model.Task {
	t.Helper()
	task := &model.Task{
		TaskID:    publicID,
		Platform:  constant.TaskPlatform("kling"),
		UserId:    1,
		ChannelId: channelID,
		Action:    constant.TaskActionImageToVideo,
		Status:    model.TaskStatusInProgress,
		Progress:  "30%",
		CreatedAt: time.Now().Unix(),
		UpdatedAt: time.Now().Unix(),
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: upstreamID,
		},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func TestUpdateVideoTasksDefaultSleepWaitsBetweenTasks(t *testing.T) {
	truncate(t)

	const channelID = 101
	seedTaskPollingChannel(t, channelID, false)
	first := seedPollingTask(t, channelID, "task_public_1", "upstream_1")
	second := seedPollingTask(t, channelID, "task_public_2", "upstream_2")

	adaptor := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := UpdateVideoTasks(ctx, constant.TaskPlatform("kling"), map[int][]string{
		channelID: {
			first.GetUpstreamTaskID(),
			second.GetUpstreamTaskID(),
		},
	}, map[string]*model.Task{
		first.GetUpstreamTaskID():  first,
		second.GetUpstreamTaskID(): second,
	})

	require.ErrorIs(t, err, context.DeadlineExceeded)
	assert.Equal(t, 1, adaptor.fetchCount())
}

func TestPollingPassesExecutingChannelTypeToAdaptor(t *testing.T) {
	truncate(t)
	const channelID = 112
	baseURL := "https://gateway.example"
	gateway := &model.Channel{Id: channelID, Type: constant.ChannelTypeNewAPI, Name: "gateway", Key: "sk-gateway", Status: common.ChannelStatusEnabled, BaseURL: &baseURL}
	gateway.SetOtherSettings(dto.ChannelOtherSettings{DisableTaskPollingSleep: true})
	require.NoError(t, model.DB.Create(gateway).Error)
	task := seedPollingTask(t, channelID, "task_gateway", "upstream_gateway")
	taskChannels := map[int][]string{channelID: {task.GetUpstreamTaskID()}}
	tasks := map[string]*model.Task{task.GetUpstreamTaskID(): task}

	perTask := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return perTask }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })
	require.NoError(t, UpdateVideoTasks(context.Background(), constant.TaskPlatform("kling"), taskChannels, tasks))
	meta := perTask.initChannelMeta()
	require.NotNil(t, meta, "per-task polling initializes the adaptor with channel metadata")
	assert.Equal(t, constant.ChannelTypeNewAPI, meta.ChannelType, "the adaptor derives the upstream kind from the channel type")
	assert.Equal(t, channelID, meta.ChannelId)
	assert.Equal(t, baseURL, meta.ChannelBaseUrl)

	batch := &batchPollingAdaptor{}
	require.NoError(t, UpdateBatchTasks(context.Background(), batch, taskChannels, tasks))
	meta = batch.initChannelMeta()
	require.NotNil(t, meta, "batch polling initializes the adaptor with channel metadata")
	assert.Equal(t, constant.ChannelTypeNewAPI, meta.ChannelType)
	assert.Equal(t, channelID, meta.ChannelId)
	assert.Equal(t, baseURL, meta.ChannelBaseUrl)
}

func TestUpdateBatchTasksPartitionsTasksByPinnedCredential(t *testing.T) {
	truncate(t)
	const channelID = 113
	seedTaskPollingChannel(t, channelID, true)
	first := seedPollingTask(t, channelID, "task_pinned_a", "upstream_pinned_a")
	second := seedPollingTask(t, channelID, "task_pinned_b", "upstream_pinned_b")
	first.PrivateData.Key = "credential-a"
	second.PrivateData.Key = "credential-b"

	adaptor := &batchPollingAdaptor{}
	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{
		channelID: {first.GetUpstreamTaskID(), second.GetUpstreamTaskID(), first.GetUpstreamTaskID()},
	}, map[string]*model.Task{
		first.GetUpstreamTaskID():  first,
		second.GetUpstreamTaskID(): second,
	}))

	require.Equal(t, 2, adaptor.batchCalls)
	assert.Equal(t, adaptor.batchKeys, adaptor.batchParseKeys, "fetch and parse must use the same effective credential for each group")
	batches := make(map[string][]string, adaptor.batchCalls)
	for i, key := range adaptor.batchKeys {
		batches[key] = adaptor.batchIDsByCall[i]
	}
	assert.Equal(t, []string{first.GetUpstreamTaskID()}, batches[first.PrivateData.Key])
	assert.Equal(t, []string{second.GetUpstreamTaskID()}, batches[second.PrivateData.Key])
}

func TestUpdateBatchTasksIsolatesCredentialGroupErrors(t *testing.T) {
	truncate(t)
	const channelID = 114
	seedTaskPollingChannel(t, channelID, true)
	first := seedPollingTask(t, channelID, "task_error_a", "upstream_error_a")
	second := seedPollingTask(t, channelID, "task_error_b", "upstream_error_b")
	first.PrivateData.Key = "credential-a"
	second.PrivateData.Key = "credential-b"

	adaptor := &batchPollingAdaptor{parseErrors: map[string]error{"credential-a": io.ErrUnexpectedEOF}}
	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{
		channelID: {first.GetUpstreamTaskID(), second.GetUpstreamTaskID()},
	}, map[string]*model.Task{
		first.GetUpstreamTaskID():  first,
		second.GetUpstreamTaskID(): second,
	}))

	assert.Equal(t, []string{"credential-a", "credential-b"}, adaptor.batchKeys)
	assert.Equal(t, adaptor.batchKeys, adaptor.batchParseKeys, "a failed credential group must not block later groups")
	assert.Equal(t, 1, first.PrivateData.PollFailures)
	assert.Zero(t, second.PrivateData.PollFailures)
}

func TestDispatchPlatformUpdateUsesFetchMode(t *testing.T) {
	truncate(t)
	const channelID = 109
	seedTaskPollingChannel(t, channelID, true)
	task := seedPollingTask(t, channelID, "task_batch", "upstream_batch")
	taskChannels := map[int][]string{channelID: {task.GetUpstreamTaskID()}}
	tasks := map[string]*model.Task{task.GetUpstreamTaskID(): task}

	batch := &batchPollingAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return batch }
	DispatchPlatformUpdate(context.Background(), "batch-plugin", taskChannels, tasks)
	assert.Equal(t, 1, batch.batchCalls)
	assert.Equal(t, 0, batch.fetchCount())
	var persisted model.Task
	require.NoError(t, model.DB.First(&persisted, task.ID).Error)
	assert.Equal(t, "https://example.com/result", persisted.GetResultURL())

	perTask := &taskPollingFetchAdaptor{}
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return perTask }
	DispatchPlatformUpdate(context.Background(), "per-task-plugin", taskChannels, tasks)
	assert.Equal(t, 1, perTask.fetchCount())

	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return nil }
	assert.NotPanics(t, func() { DispatchPlatformUpdate(context.Background(), "missing-plugin", taskChannels, tasks) })
	GetTaskAdaptorFunc = previousFactory
}

func TestUpdateBatchTasksSettlesTieredUsageForTerminalStates(t *testing.T) {
	testCases := []struct {
		name        string
		status      model.TaskStatus
		units       float64
		actualQuota int
	}{
		{name: "success with usage", status: model.TaskStatusSuccess, units: 3, actualQuota: 3_000},
		{name: "failure with usage", status: model.TaskStatusFailure, units: 3, actualQuota: 0},
		{name: "success with zero usage", status: model.TaskStatusSuccess, units: 0, actualQuota: 0},
		{name: "failure with zero usage", status: model.TaskStatusFailure, units: 0, actualQuota: 0},
		{name: "cancelled without reason", status: model.TaskStatusCancelled, units: 0, actualQuota: 0},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			truncate(t)

			const userID, tokenID, channelID = 41, 41, 141
			const initialQuota, preConsumedQuota = 10_000, 5_000
			const tokenRemain = 8_000
			seedUser(t, userID, initialQuota)
			seedToken(t, tokenID, userID, "sk-batch-tiered", tokenRemain)
			seedTaskPollingChannel(t, channelID, true)

			expression := `tier("actual", u("units"))`
			task := makeTask(userID, channelID, preConsumedQuota, tokenID, BillingSourceWallet, 0)
			task.TaskID = "task_batch_tiered_" + string(testCase.status)
			task.Platform = "batch-plugin"
			task.PrivateData.UpstreamTaskID = "upstream_batch_tiered_" + string(testCase.status)
			task.SetData(map[string]any{"provider_payload": "must-be-preserved"})
			task.PrivateData.BillingContext.TieredSnapshot = &billingexpr.BillingSnapshot{
				ExprString:       expression,
				ExprHash:         billingexpr.ExprHashString(expression),
				GroupRatio:       1,
				QuotaPerUnit:     1_000,
				ExprVersion:      1,
				TaskUsageBilling: true,
			}
			require.NoError(t, model.DB.Create(task).Error)

			upstreamID := task.GetUpstreamTaskID()
			reason := ""
			if testCase.status == model.TaskStatusFailure {
				reason = "upstream failed"
			}
			result := &BatchTaskResult{TaskInfo: relaycommon.TaskInfo{
				TaskID:     upstreamID,
				Status:     string(testCase.status),
				Reason:     reason,
				UsageFacts: map[string]any{"units": testCase.units},
			}}
			adaptor := &batchPollingAdaptor{results: map[string]*BatchTaskResult{upstreamID: result}}
			taskIDs := []string{upstreamID}
			taskMap := map[string]*model.Task{upstreamID: task}

			require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{channelID: taskIDs}, taskMap))

			var persisted model.Task
			require.NoError(t, model.DB.First(&persisted, task.ID).Error)
			assert.Equal(t, testCase.status, persisted.Status)
			assert.Equal(t, testCase.actualQuota, persisted.Quota)
			var persistedData map[string]any
			require.NoError(t, common.Unmarshal(persisted.Data, &persistedData))
			assert.Equal(t, "must-be-preserved", persistedData["provider_payload"])
			assert.Equal(t, initialQuota+(preConsumedQuota-testCase.actualQuota), getUserQuota(t, userID))
			assert.Equal(t, tokenRemain+(preConsumedQuota-testCase.actualQuota), getTokenRemainQuota(t, tokenID))
			assert.Equal(t, int64(1), countLogs(t))
			if testCase.status == model.TaskStatusFailure {
				log := getLastLog(t)
				require.NotNil(t, log)
				assert.Equal(t, model.LogTypeRefund, log.Type)
			}

			// A duplicate terminal response must not settle the same task twice.
			require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{channelID: taskIDs}, taskMap))
			assert.Equal(t, initialQuota+(preConsumedQuota-testCase.actualQuota), getUserQuota(t, userID))
			assert.Equal(t, int64(1), countLogs(t))
		})
	}
}

func TestUpdateBatchTasksRefundsFailedTieredTask(t *testing.T) {
	truncate(t)

	const userID, tokenID, channelID = 43, 43, 143
	const initialQuota, preConsumedQuota, tokenRemain = 10_000, 5_000, 8_000
	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "sk-batch-tiered-refund", tokenRemain)
	seedTaskPollingChannel(t, channelID, true)

	expression := `tier("actual", u("units"))`
	task := makeTask(userID, channelID, preConsumedQuota, tokenID, BillingSourceWallet, 0)
	task.TaskID = "task_batch_tiered_refund"
	task.Platform = "batch-plugin"
	task.PrivateData.UpstreamTaskID = "upstream_batch_tiered_refund"
	task.PrivateData.BillingContext.TieredSnapshot = &billingexpr.BillingSnapshot{
		ExprString:       expression,
		ExprHash:         billingexpr.ExprHashString(expression),
		GroupRatio:       1,
		QuotaPerUnit:     1_000,
		ExprVersion:      1,
		TaskUsageBilling: true,
		UsageFacts:       map[string]any{"units": float64(5)},
		EstimatedTier:    "actual",
	}
	require.NoError(t, model.DB.Create(task).Error)

	upstreamID := task.GetUpstreamTaskID()
	adaptor := &batchPollingAdaptor{results: map[string]*BatchTaskResult{
		upstreamID: {TaskInfo: relaycommon.TaskInfo{
			TaskID:     upstreamID,
			Status:     model.TaskStatusFailure,
			Reason:     "upstream failed",
			UsageFacts: map[string]any{"units": float64(5)},
		}},
	}}
	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{channelID: {upstreamID}}, map[string]*model.Task{upstreamID: task}))

	var persisted model.Task
	require.NoError(t, model.DB.First(&persisted, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, persisted.Status)
	assert.Zero(t, persisted.Quota)
	assert.Equal(t, initialQuota+preConsumedQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumedQuota, getTokenRemainQuota(t, tokenID))

	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
	assert.Equal(t, preConsumedQuota, log.Quota)
	var other map[string]any
	require.NoError(t, common.UnmarshalJsonStr(log.Other, &other))
	assert.Equal(t, "tiered_expr", other["billing_mode"])
	assert.Equal(t, "actual", other["matched_tier"])
	facts, ok := other["usage_facts"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, map[string]any{"units": float64(5)}, facts)
}

func TestUpdateBatchTasksRefundsFailedTaskWithoutUsageSettlement(t *testing.T) {
	truncate(t)

	const userID, tokenID, channelID = 42, 42, 142
	const initialQuota, preConsumedQuota, tokenRemain = 10_000, 4_000, 7_000
	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "sk-batch-refund", tokenRemain)
	seedTaskPollingChannel(t, channelID, true)

	task := makeTask(userID, channelID, preConsumedQuota, tokenID, BillingSourceWallet, 0)
	task.TaskID = "task_batch_refund"
	task.Platform = "batch-plugin"
	task.Properties.OriginModelName = "missing-batch-token-price"
	task.PrivateData.UpstreamTaskID = "upstream_batch_refund"
	task.PrivateData.BillingContext.OriginModelName = "missing-batch-token-price"
	require.NoError(t, model.DB.Create(task).Error)

	upstreamID := task.GetUpstreamTaskID()
	adaptor := &batchPollingAdaptor{results: map[string]*BatchTaskResult{
		upstreamID: {TaskInfo: relaycommon.TaskInfo{TaskID: upstreamID, Status: model.TaskStatusFailure, Reason: "upstream failed", TotalTokens: 123}},
	}}
	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{channelID: {upstreamID}}, map[string]*model.Task{upstreamID: task}))

	assert.Equal(t, initialQuota+preConsumedQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumedQuota, getTokenRemainQuota(t, tokenID))
	log := getLastLog(t)
	require.NotNil(t, log)
	assert.Equal(t, model.LogTypeRefund, log.Type)
}

func TestUpdateBatchTasksRefundsCancelledTaskWithoutReasonExactlyOnce(t *testing.T) {
	truncate(t)

	const userID, tokenID, channelID = 44, 44, 144
	const initialQuota, preConsumedQuota, tokenRemain = 10_000, 4_000, 7_000
	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "sk-batch-cancelled", tokenRemain)
	seedTaskPollingChannel(t, channelID, true)

	task := makeTask(userID, channelID, preConsumedQuota, tokenID, BillingSourceWallet, 0)
	task.TaskID = "task_batch_cancelled"
	task.Platform = "batch-plugin"
	task.PrivateData.UpstreamTaskID = "upstream_batch_cancelled"
	require.NoError(t, model.DB.Create(task).Error)

	upstreamID := task.GetUpstreamTaskID()
	adaptor := &batchPollingAdaptor{results: map[string]*BatchTaskResult{
		upstreamID: {TaskInfo: relaycommon.TaskInfo{TaskID: upstreamID, Status: model.TaskStatusCancelled}},
	}}
	taskChannels := map[int][]string{channelID: {upstreamID}}
	tasks := map[string]*model.Task{upstreamID: task}

	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, taskChannels, tasks))

	var persisted model.Task
	require.NoError(t, model.DB.First(&persisted, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusCancelled, persisted.Status)
	assert.Zero(t, persisted.Quota)
	assert.Equal(t, initialQuota+preConsumedQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumedQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))

	require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, taskChannels, tasks))
	assert.Equal(t, initialQuota+preConsumedQuota, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumedQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestUpdateVideoTasksCanSkipPollingSleepPerChannel(t *testing.T) {
	truncate(t)

	const channelID = 102
	seedTaskPollingChannel(t, channelID, true)
	first := seedPollingTask(t, channelID, "task_public_3", "upstream_3")
	second := seedPollingTask(t, channelID, "task_public_4", "upstream_4")

	adaptor := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	err := UpdateVideoTasks(ctx, constant.TaskPlatform("kling"), map[int][]string{
		channelID: {
			first.GetUpstreamTaskID(),
			second.GetUpstreamTaskID(),
		},
	}, map[string]*model.Task{
		first.GetUpstreamTaskID():  first,
		second.GetUpstreamTaskID(): second,
	})

	require.NoError(t, err)
	assert.Equal(t, 2, adaptor.fetchCount())
}

func TestUpdateVideoTasksDefaultSleepDoesNotBlockOtherChannels(t *testing.T) {
	truncate(t)

	const firstChannelID = 201
	const secondChannelID = 202
	seedTaskPollingChannel(t, firstChannelID, false)
	seedTaskPollingChannel(t, secondChannelID, false)
	firstChannelFirst := seedPollingTask(t, firstChannelID, "task_public_5", "upstream_a_1")
	firstChannelSecond := seedPollingTask(t, firstChannelID, "task_public_6", "upstream_a_2")
	secondChannelFirst := seedPollingTask(t, secondChannelID, "task_public_7", "upstream_b_1")
	secondChannelSecond := seedPollingTask(t, secondChannelID, "task_public_8", "upstream_b_2")

	adaptor := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	err := UpdateVideoTasks(ctx, constant.TaskPlatform("kling"), map[int][]string{
		firstChannelID: {
			firstChannelFirst.GetUpstreamTaskID(),
			firstChannelSecond.GetUpstreamTaskID(),
		},
		secondChannelID: {
			secondChannelFirst.GetUpstreamTaskID(),
			secondChannelSecond.GetUpstreamTaskID(),
		},
	}, map[string]*model.Task{
		firstChannelFirst.GetUpstreamTaskID():   firstChannelFirst,
		firstChannelSecond.GetUpstreamTaskID():  firstChannelSecond,
		secondChannelFirst.GetUpstreamTaskID():  secondChannelFirst,
		secondChannelSecond.GetUpstreamTaskID(): secondChannelSecond,
	})

	require.ErrorIs(t, err, context.DeadlineExceeded)
	assert.ElementsMatch(t, []string{"upstream_a_1", "upstream_b_1"}, adaptor.fetchedTaskIDs())
}

func TestUpdateVideoTasksSlowChannelDoesNotBlockOtherChannels(t *testing.T) {
	truncate(t)

	const slowChannelID = 251
	const fastChannelID = 252
	seedTaskPollingChannel(t, slowChannelID, false)
	seedTaskPollingChannel(t, fastChannelID, true)
	slowTask := seedPollingTask(t, slowChannelID, "task_public_slow", "upstream_slow_1")
	fastFirst := seedPollingTask(t, fastChannelID, "task_public_fast_1", "upstream_fast_parallel_1")
	fastSecond := seedPollingTask(t, fastChannelID, "task_public_fast_2", "upstream_fast_parallel_2")

	adaptor := &taskPollingFetchAdaptor{
		fetched:      make(chan string, 4),
		blockTaskID:  slowTask.GetUpstreamTaskID(),
		blockStarted: make(chan struct{}),
		releaseBlock: make(chan struct{}),
	}
	var releaseOnce sync.Once
	releaseBlockedTask := func() {
		releaseOnce.Do(func() {
			close(adaptor.releaseBlock)
		})
	}
	t.Cleanup(releaseBlockedTask)
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	errCh := make(chan error, 1)
	gopool.Go(func() {
		errCh <- UpdateVideoTasks(context.Background(), constant.TaskPlatform("kling"), map[int][]string{
			slowChannelID: {
				slowTask.GetUpstreamTaskID(),
			},
			fastChannelID: {
				fastFirst.GetUpstreamTaskID(),
				fastSecond.GetUpstreamTaskID(),
			},
		}, map[string]*model.Task{
			slowTask.GetUpstreamTaskID():   slowTask,
			fastFirst.GetUpstreamTaskID():  fastFirst,
			fastSecond.GetUpstreamTaskID(): fastSecond,
		})
	})

	select {
	case <-adaptor.blockStarted:
	case <-time.After(500 * time.Millisecond):
		t.Fatal("slow channel did not start blocking")
	}

	require.Eventually(t, func() bool {
		fetchedTaskIDs := adaptor.fetchedTaskIDs()
		return len(fetchedTaskIDs) == 2 &&
			fetchedTaskIDs[0] == fastFirst.GetUpstreamTaskID() &&
			fetchedTaskIDs[1] == fastSecond.GetUpstreamTaskID()
	}, 500*time.Millisecond, 10*time.Millisecond)

	releaseBlockedTask()
	require.NoError(t, <-errCh)
	assert.ElementsMatch(t, []string{
		slowTask.GetUpstreamTaskID(),
		fastFirst.GetUpstreamTaskID(),
		fastSecond.GetUpstreamTaskID(),
	}, adaptor.fetchedTaskIDs())
}

func TestUpdateVideoTasksMixedChannelSleepSettings(t *testing.T) {
	truncate(t)

	const sleepyChannelID = 301
	const fastChannelID = 302
	seedTaskPollingChannel(t, sleepyChannelID, false)
	seedTaskPollingChannel(t, fastChannelID, true)
	sleepyFirst := seedPollingTask(t, sleepyChannelID, "task_public_9", "upstream_sleepy_1")
	sleepySecond := seedPollingTask(t, sleepyChannelID, "task_public_10", "upstream_sleepy_2")
	fastFirst := seedPollingTask(t, fastChannelID, "task_public_11", "upstream_fast_1")
	fastSecond := seedPollingTask(t, fastChannelID, "task_public_12", "upstream_fast_2")

	adaptor := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := UpdateVideoTasks(ctx, constant.TaskPlatform("kling"), map[int][]string{
		sleepyChannelID: {
			sleepyFirst.GetUpstreamTaskID(),
			sleepySecond.GetUpstreamTaskID(),
		},
		fastChannelID: {
			fastFirst.GetUpstreamTaskID(),
			fastSecond.GetUpstreamTaskID(),
		},
	}, map[string]*model.Task{
		sleepyFirst.GetUpstreamTaskID():  sleepyFirst,
		sleepySecond.GetUpstreamTaskID(): sleepySecond,
		fastFirst.GetUpstreamTaskID():    fastFirst,
		fastSecond.GetUpstreamTaskID():   fastSecond,
	})

	require.ErrorIs(t, err, context.DeadlineExceeded)
	assert.ElementsMatch(t, []string{"upstream_sleepy_1", "upstream_fast_1", "upstream_fast_2"}, adaptor.fetchedTaskIDs())
}

func TestUpdateSunoTasksStalePollsRefundExactlyOnce(t *testing.T) {
	truncate(t)

	const userID, tokenID, channelID = 401, 401, 401
	const initialUserQuota, initialTokenQuota, taskQuota = 10_000, 6_000, 2_500
	const publicTaskID, upstreamTaskID = "suno_public_refund_once", "suno_upstream_refund_once"

	seedUser(t, userID, initialUserQuota)
	seedToken(t, tokenID, userID, "sk-suno-refund-once", initialTokenQuota)
	baseURL := "https://suno.invalid"
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:      channelID,
		Type:    constant.ChannelTypeSunoAPI,
		Name:    "suno_refund_once",
		Key:     "sk-suno-channel",
		Status:  common.ChannelStatusEnabled,
		BaseURL: &baseURL,
	}).Error)

	task := makeTask(userID, channelID, taskQuota, tokenID, BillingSourceWallet, 0)
	task.TaskID = publicTaskID
	task.Platform = constant.TaskPlatformSuno
	task.Status = model.TaskStatusInProgress
	task.Progress = "50%"
	task.SubmitTime = time.Now().Unix()
	task.PrivateData.UpstreamTaskID = upstreamTaskID
	require.NoError(t, model.DB.Create(task).Error)

	var firstPollTask model.Task
	var staleSecondPollTask model.Task
	require.NoError(t, model.DB.First(&firstPollTask, task.ID).Error)
	require.NoError(t, model.DB.First(&staleSecondPollTask, task.ID).Error)

	adaptor := &batchPollingAdaptor{results: map[string]*BatchTaskResult{
		upstreamTaskID: {TaskInfo: relaycommon.TaskInfo{
			TaskID: upstreamTaskID,
			Status: model.TaskStatusFailure,
			Reason: "upstream failed",
		}},
	}}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	require.NoError(t, updateBatchTasks(context.Background(), adaptor, channelID, []string{upstreamTaskID}, map[string]*model.Task{
		upstreamTaskID: &firstPollTask,
	}))
	require.NoError(t, updateBatchTasks(context.Background(), adaptor, channelID, []string{upstreamTaskID}, map[string]*model.Task{
		upstreamTaskID: &staleSecondPollTask,
	}))

	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloaded.Status)
	assert.Zero(t, reloaded.Quota)
	assert.Equal(t, initialUserQuota+taskQuota, getUserQuota(t, userID))
	assert.Equal(t, initialTokenQuota+taskQuota, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestRunTaskPollingOnceDoesNotRefundHistoricalFailedTask(t *testing.T) {
	truncate(t)

	const userID, initialQuota, taskQuota = 402, 10_000, 1_200
	seedUser(t, userID, initialQuota)

	task := makeTask(userID, 0, taskQuota, 0, BillingSourceWallet, 0)
	task.TaskID = "historical_failed_already_refunded"
	task.Status = model.TaskStatusFailure
	task.Progress = "100%"
	task.SubmitTime = time.Now().Add(-90 * 24 * time.Hour).Unix()
	task.UpdatedAt = time.Now().Add(-time.Minute).Unix()
	require.NoError(t, model.DB.Create(task).Error)

	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor {
		return &taskPollingFetchAdaptor{}
	}
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	summary := RunTaskPollingOnce(context.Background(), nil)

	assert.Zero(t, summary.UnfinishedTasks)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
	assert.Equal(t, taskQuota, getTaskQuota(t, task.ID))
	assert.Equal(t, int64(0), countLogs(t))
}

func TestSweepTimedOutTasksHonorsRefundRolloutBoundary(t *testing.T) {
	truncate(t)

	const (
		userID          = 403
		initialQuota    = 10_000
		legacyTaskQuota = 1_800
		deferredQuota   = 1_200
		foregroundQuota = 900
	)
	seedUser(t, userID, initialQuota)

	legacyTask := makeTask(userID, 0, legacyTaskQuota, 0, BillingSourceWallet, 0)
	legacyTask.TaskID = "legacy_timeout_without_refund"
	legacyTask.Progress = "50%"
	legacyTask.SubmitTime = 1771718399 // 2026-02-21 23:59:59 UTC
	require.NoError(t, model.DB.Create(legacyTask).Error)

	deferredTask := makeTask(userID, 0, deferredQuota, 0, BillingSourceWallet, 0)
	deferredTask.TaskID = "dispatched_deferred_timeout_with_refund"
	deferredTask.Progress = "50%"
	deferredTask.SubmitTime = 1771718400 // 2026-02-22 00:00:00 UTC
	deferredTask.ExecutionMode = model.TaskExecutionModeDeferred
	deferredTask.DispatchStatus = model.TaskDispatchStatusDispatched
	require.NoError(t, model.DB.Create(deferredTask).Error)

	foregroundTask := makeTask(userID, 0, foregroundQuota, 0, BillingSourceWallet, 0)
	foregroundTask.TaskID = "foreground_timeout_with_refund"
	foregroundTask.Progress = "50%"
	foregroundTask.SubmitTime = 1771718400
	require.NoError(t, model.DB.Create(foregroundTask).Error)

	previousTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = previousTimeout })

	sweepTimedOutTasks(context.Background())

	var reloadedLegacy model.Task
	var reloadedDeferred model.Task
	var reloadedForeground model.Task
	require.NoError(t, model.DB.First(&reloadedLegacy, legacyTask.ID).Error)
	require.NoError(t, model.DB.First(&reloadedDeferred, deferredTask.ID).Error)
	require.NoError(t, model.DB.First(&reloadedForeground, foregroundTask.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloadedLegacy.Status)
	assert.EqualValues(t, model.TaskStatusFailure, reloadedDeferred.Status)
	assert.EqualValues(t, model.TaskStatusFailure, reloadedForeground.Status)
	assert.Zero(t, reloadedLegacy.Quota)
	assert.Zero(t, reloadedDeferred.Quota)
	assert.Zero(t, reloadedForeground.Quota)
	assert.Contains(t, reloadedLegacy.FailReason, "旧系统遗留任务")
	assert.Contains(t, reloadedDeferred.FailReason, "任务超时")
	assert.Contains(t, reloadedForeground.FailReason, "任务超时")
	assert.Equal(t, initialQuota+deferredQuota+foregroundQuota, getUserQuota(t, userID))
	assert.Equal(t, int64(2), countLogs(t))
}

func TestSweepTimedOutTasksPreservesNewlyResolvedDeferredTaskBeforeFirstPoll(t *testing.T) {
	truncate(t)

	const userID, initialQuota, taskQuota = 405, 10_000, 1_200
	seedUser(t, userID, initialQuota)

	now := time.Now().Unix()
	task := makeTask(userID, 0, taskQuota, 0, BillingSourceWallet, 0)
	task.TaskID = "deferred_resolved_before_first_poll"
	task.Status = model.TaskStatusNotStart
	task.Progress = "0%"
	task.SubmitTime = now - 2*60
	task.ExecutionMode = model.TaskExecutionModeDeferred
	task.DispatchStatus = model.TaskDispatchStatusUncertain
	task.DispatchStartedAt = now - 90
	task.PrivateData.DeferredRequest = &model.TaskDeferredRequest{RequestBody: []byte(`{}`)}
	require.NoError(t, model.DB.Create(task).Error)

	won, err := model.ResolveDeferredTask(
		task,
		true,
		"upstream-resolved-before-poll",
		"provider confirmed acceptance",
		now,
	)
	require.NoError(t, err)
	require.True(t, won)
	require.Equal(t, now, task.StartTime)

	previousTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = previousTimeout })

	sweepTimedOutTasks(context.Background())

	var stored model.Task
	require.NoError(t, model.DB.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusSubmitted), stored.Status)
	assert.Equal(t, "10%", stored.Progress)
	assert.Equal(t, model.TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.Equal(t, now, stored.StartTime)
	assert.Equal(t, taskQuota, stored.Quota)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
	assert.Zero(t, countLogs(t))
}

func TestSweepTimedOutTasksDoesNotOverwriteDeferredFenceAcquiredAfterSelection(t *testing.T) {
	truncate(t)

	const userID, initialQuota, taskQuota = 404, 10_000, 1_200
	seedUser(t, userID, initialQuota)

	task := makeTask(userID, 0, taskQuota, 0, BillingSourceWallet, 0)
	task.TaskID = "deferred_timeout_fenced_after_selection"
	task.Progress = "0%"
	task.SubmitTime = time.Now().Add(-2 * time.Minute).Unix()
	task.ExecutionMode = model.TaskExecutionModeDeferred
	task.DispatchStatus = model.TaskDispatchStatusPending
	require.NoError(t, model.DB.Create(task).Error)

	const callbackName = "test:fence-deferred-timeout-after-query"
	fenceApplied := false
	var fenceErr error
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if fenceApplied {
			return
		}
		if _, ok := tx.Statement.Dest.(*[]*model.Task); !ok {
			return
		}
		fenceApplied = true
		fenceErr = model.DB.Model(&model.Task{}).Where("id = ?", task.ID).Updates(map[string]any{
			"dispatch_status":           model.TaskDispatchStatusRunning,
			"dispatch_owner":            "runner-fenced",
			"dispatch_lock_until":       int64(math.MaxInt64),
			"dispatch_attempts":         1,
			"dispatch_protocol_version": model.CurrentTaskDispatchProtocolVersion,
		}).Error
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	previousTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = previousTimeout })

	sweepTimedOutTasks(context.Background())

	require.True(t, fenceApplied)
	require.NoError(t, fenceErr)
	var stored model.Task
	require.NoError(t, model.DB.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusInProgress), stored.Status)
	assert.Equal(t, "0%", stored.Progress)
	assert.Equal(t, model.TaskDispatchStatusRunning, stored.DispatchStatus)
	assert.Equal(t, "runner-fenced", stored.DispatchOwner)
	assert.Equal(t, int64(math.MaxInt64), stored.DispatchLockUntil)
	assert.Equal(t, 1, stored.DispatchAttempts)
	assert.Equal(t, taskQuota, stored.Quota)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
	assert.Zero(t, countLogs(t))
}

func TestSweepTimedOutTasksDoesNotRefundDeferredTaskWhoseStartTimeRefreshesAfterSelection(t *testing.T) {
	truncate(t)

	const userID, initialQuota, taskQuota = 406, 10_000, 1_200
	seedUser(t, userID, initialQuota)

	task := makeTask(userID, 0, taskQuota, 0, BillingSourceWallet, 0)
	task.TaskID = "deferred_timeout_start_time_refreshed_after_selection"
	task.Progress = "50%"
	task.SubmitTime = time.Now().Add(-2 * time.Minute).Unix()
	task.StartTime = task.SubmitTime
	task.ExecutionMode = model.TaskExecutionModeDeferred
	task.DispatchStatus = model.TaskDispatchStatusDispatched
	require.NoError(t, model.DB.Create(task).Error)

	const callbackName = "test:refresh-deferred-timeout-start-after-query"
	refreshApplied := false
	var refreshErr error
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if refreshApplied {
			return
		}
		if _, ok := tx.Statement.Dest.(*[]*model.Task); !ok {
			return
		}
		refreshApplied = true
		refreshErr = model.DB.Model(&model.Task{}).
			Where("id = ?", task.ID).
			Update("start_time", time.Now().Unix()).Error
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})

	previousTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = previousTimeout })

	sweepTimedOutTasks(context.Background())

	require.True(t, refreshApplied)
	require.NoError(t, refreshErr)
	var stored model.Task
	require.NoError(t, model.DB.First(&stored, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusInProgress), stored.Status)
	assert.Equal(t, "50%", stored.Progress)
	assert.Equal(t, model.TaskDispatchStatusDispatched, stored.DispatchStatus)
	assert.GreaterOrEqual(t, stored.StartTime, time.Now().Add(-time.Minute).Unix())
	assert.Equal(t, taskQuota, stored.Quota)
	assert.Equal(t, initialQuota, getUserQuota(t, userID))
	assert.Zero(t, countLogs(t))
}

type scriptedPollingAdaptor struct {
	statusCode  int
	body        []byte
	fetchErr    error
	parse       *relaycommon.TaskInfo
	parseErr    error
	adjustCalls int
}

func (a *scriptedPollingAdaptor) Init(*relaycommon.RelayInfo) {}
func (a *scriptedPollingAdaptor) FetchTask(string, string, *model.Task, string) (*http.Response, error) {
	if a.fetchErr != nil {
		return nil, a.fetchErr
	}
	code := a.statusCode
	if code == 0 {
		code = http.StatusOK
	}
	body := a.body
	if body == nil {
		body = []byte(`{}`)
	}
	return &http.Response{StatusCode: code, Body: io.NopCloser(bytes.NewReader(body))}, nil
}
func (a *scriptedPollingAdaptor) ParseTaskResult(*model.Task, *http.Response, []byte) (*relaycommon.TaskInfo, error) {
	if a.parseErr != nil {
		return nil, a.parseErr
	}
	if a.parse != nil {
		return a.parse, nil
	}
	return &relaycommon.TaskInfo{Status: model.TaskStatusInProgress}, nil
}
func (a *scriptedPollingAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	a.adjustCalls++
	return 0
}

func TestUpdateVideoSingleTaskCancelledUsesTerminalFinalizerExactlyOnce(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PerfMetric{}))

	const userID, tokenID, channelID = 509, 509, 509
	const initialQuota, preConsumed, tokenRemain = 10_000, 4_000, 7_000
	seedUser(t, userID, initialQuota)
	seedToken(t, tokenID, userID, "sk-cancel-finalizer", tokenRemain)

	task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
	task.TaskID = "task_cancel_finalizer"
	task.SubmitTime = time.Now().Add(-time.Minute).Unix()
	task.Properties.OriginModelName = "cancel-finalizer-model"
	task.PrivateData.UpstreamTaskID = "upstream_cancel_finalizer"
	task.PrivateData.BillingContext.OriginModelName = task.Properties.OriginModelName
	require.NoError(t, model.DB.Create(task).Error)
	metricRequestCount := func() int64 {
		metrics, err := perfmetrics.QuerySummaryAll(1, nil)
		require.NoError(t, err)
		for _, summary := range metrics.Models {
			if summary.ModelName == task.Properties.OriginModelName {
				return summary.RequestCount
			}
		}
		return 0
	}
	metricBaseline := metricRequestCount()

	var winnerTask model.Task
	var staleTask model.Task
	require.NoError(t, model.DB.First(&winnerTask, task.ID).Error)
	require.NoError(t, model.DB.First(&staleTask, task.ID).Error)

	adaptor := &scriptedPollingAdaptor{parse: &relaycommon.TaskInfo{Status: model.TaskStatusCancelled}}
	ch := &model.Channel{Id: channelID, Type: constant.ChannelTypeKling, Key: "channel-credential"}
	for _, candidate := range []*model.Task{&winnerTask, &staleTask} {
		require.NoError(t, updateVideoSingleTask(context.Background(), adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{
			task.GetUpstreamTaskID(): candidate,
		}))
	}

	assert.Equal(t, 1, adaptor.adjustCalls)
	assert.Equal(t, initialQuota+preConsumed, getUserQuota(t, userID))
	assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))

	assert.Equal(t, int64(1), metricRequestCount()-metricBaseline)
}

type scriptedBatchPollingAdaptor struct {
	scriptedPollingAdaptor
	results map[string]*BatchTaskResult
}

func (a *scriptedBatchPollingAdaptor) FetchMode() string { return "batch" }
func (a *scriptedBatchPollingAdaptor) FetchBatchTasks(string, string, []*model.Task, string) (*http.Response, error) {
	return a.FetchTask("", "", nil, "")
}
func (a *scriptedBatchPollingAdaptor) ParseBatchResult([]*model.Task, *http.Response, []byte) (map[string]*BatchTaskResult, error) {
	if a.parseErr != nil {
		return nil, a.parseErr
	}
	return a.results, nil
}

func TestUpdateVideoSingleTaskPollClassification(t *testing.T) {
	testCases := []struct {
		name          string
		statusCode    int
		fetchErr      error
		parse         *relaycommon.TaskInfo
		parseErr      error
		priorFailures int
		priorState    string
		maxFailures   int
		wantStatus    model.TaskStatus
		wantFailures  int
		wantRefund    bool
		wantReason    string
		wantState     string
		wantUnchanged bool
	}{
		{
			name:          "404 fails immediately and refunds",
			statusCode:    http.StatusNotFound,
			wantStatus:    model.TaskStatusFailure,
			wantRefund:    true,
			wantReason:    "upstream task not found (HTTP 404)",
			wantUnchanged: false,
		},
		{
			name:          "401 increments without changing status",
			statusCode:    http.StatusUnauthorized,
			wantStatus:    model.TaskStatusInProgress,
			wantFailures:  1,
			wantUnchanged: true,
		},
		{
			name:          "429 reaches threshold and refunds",
			statusCode:    http.StatusTooManyRequests,
			priorFailures: 2,
			maxFailures:   3,
			wantStatus:    model.TaskStatusFailure,
			wantFailures:  3,
			wantRefund:    true,
			wantReason:    "poll failed: transient (HTTP 429)",
		},
		{
			name:          "UNKNOWN increments",
			statusCode:    http.StatusOK,
			parse:         &relaycommon.TaskInfo{Status: model.TaskStatusUnknown, Reason: "weird"},
			wantStatus:    model.TaskStatusInProgress,
			wantFailures:  1,
			wantUnchanged: true,
		},
		{
			name:          "valid 2xx resets the failure counter",
			statusCode:    http.StatusOK,
			parse:         &relaycommon.TaskInfo{Status: model.TaskStatusInProgress},
			priorFailures: 5,
			wantStatus:    model.TaskStatusInProgress,
			wantFailures:  0,
		},
		{
			name:       "omit state preserves previous plugin state",
			statusCode: http.StatusOK,
			parse:      &relaycommon.TaskInfo{Status: model.TaskStatusInProgress},
			priorState: `{"req_key":"keep"}`,
			wantStatus: model.TaskStatusInProgress,
			wantState:  `{"req_key":"keep"}`,
		},
		{
			name:       "returned state replaces plugin state",
			statusCode: http.StatusOK,
			parse: &relaycommon.TaskInfo{
				Status:      model.TaskStatusInProgress,
				PluginState: []byte(`{"req_key":"new"}`),
			},
			priorState: `{"req_key":"old"}`,
			wantStatus: model.TaskStatusInProgress,
			wantState:  `{"req_key":"new"}`,
		},
		{
			name:          "other 4xx non-terminal is unrecognized",
			statusCode:    http.StatusBadRequest,
			parse:         &relaycommon.TaskInfo{Status: model.TaskStatusInProgress},
			wantStatus:    model.TaskStatusInProgress,
			wantFailures:  1,
			wantUnchanged: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			truncate(t)
			const userID, tokenID, channelID = 510, 510, 510
			const initialQuota, preConsumed, tokenRemain = 10_000, 4_000, 7_000
			seedUser(t, userID, initialQuota)
			seedToken(t, tokenID, userID, "sk-poll-class", tokenRemain)
			ch := &model.Channel{Id: channelID, Type: constant.ChannelTypeKling, Name: "poll", Key: "sk-test", Status: common.ChannelStatusEnabled}

			if testCase.maxFailures > 0 {
				previous := constant.TaskPollMaxFailures
				constant.TaskPollMaxFailures = testCase.maxFailures
				t.Cleanup(func() { constant.TaskPollMaxFailures = previous })
			}

			task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
			task.TaskID = "task_poll_class"
			task.PrivateData.UpstreamTaskID = "upstream_poll_class"
			task.PrivateData.PollFailures = testCase.priorFailures
			if testCase.priorState != "" {
				task.PrivateData.PluginState = []byte(testCase.priorState)
			}
			require.NoError(t, model.DB.Create(task).Error)

			adaptor := &scriptedPollingAdaptor{statusCode: testCase.statusCode, fetchErr: testCase.fetchErr, parse: testCase.parse, parseErr: testCase.parseErr}
			require.NoError(t, updateVideoSingleTask(context.Background(), adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{
				task.GetUpstreamTaskID(): task,
			}))

			var persisted model.Task
			require.NoError(t, model.DB.First(&persisted, task.ID).Error)
			assert.EqualValues(t, testCase.wantStatus, persisted.Status)
			assert.Equal(t, testCase.wantFailures, persisted.PrivateData.PollFailures)
			if testCase.wantUnchanged {
				assert.Empty(t, persisted.FailReason)
			}
			if testCase.wantReason != "" {
				assert.Contains(t, persisted.FailReason, testCase.wantReason)
			}
			if testCase.wantState != "" {
				assert.JSONEq(t, testCase.wantState, string(persisted.PrivateData.PluginState))
			}
			if testCase.wantRefund {
				assert.Equal(t, initialQuota+preConsumed, getUserQuota(t, userID))
				assert.Equal(t, tokenRemain+preConsumed, getTokenRemainQuota(t, tokenID))
				assert.Zero(t, persisted.Quota)
				log := getLastLog(t)
				require.NotNil(t, log)
				assert.Equal(t, model.LogTypeRefund, log.Type)
			} else {
				assert.Equal(t, initialQuota, getUserQuota(t, userID))
				assert.Equal(t, tokenRemain, getTokenRemainQuota(t, tokenID))
			}
		})
	}
}

func TestUpdateBatchTasksPollClassification(t *testing.T) {
	testCases := []struct {
		name         string
		statusCode   int
		resultStatus model.TaskStatus
		wantStatus   model.TaskStatus
		wantFailures int
		wantRefund   bool
		wantReason   string
	}{
		{
			name:       "404 fails the batch and refunds",
			statusCode: http.StatusNotFound,
			wantStatus: model.TaskStatusFailure,
			wantRefund: true,
			wantReason: "upstream task not found (HTTP 404)",
		},
		{
			name:         "401 increments every task",
			statusCode:   http.StatusUnauthorized,
			wantStatus:   model.TaskStatusInProgress,
			wantFailures: 1,
		},
		{
			name:         "UNKNOWN increments",
			statusCode:   http.StatusOK,
			resultStatus: model.TaskStatusUnknown,
			wantStatus:   model.TaskStatusInProgress,
			wantFailures: 1,
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			truncate(t)
			const userID, tokenID, channelID = 610, 610, 610
			const initialQuota, preConsumed, tokenRemain = 10_000, 4_000, 7_000
			seedUser(t, userID, initialQuota)
			seedToken(t, tokenID, userID, "sk-batch-class", tokenRemain)
			seedTaskPollingChannel(t, channelID, true)

			task := makeTask(userID, channelID, preConsumed, tokenID, BillingSourceWallet, 0)
			task.TaskID = "task_batch_class"
			task.PrivateData.UpstreamTaskID = "upstream_batch_class"
			require.NoError(t, model.DB.Create(task).Error)
			upstreamID := task.GetUpstreamTaskID()

			adaptor := &scriptedBatchPollingAdaptor{
				scriptedPollingAdaptor: scriptedPollingAdaptor{statusCode: testCase.statusCode},
			}
			if testCase.resultStatus != "" {
				adaptor.results = map[string]*BatchTaskResult{
					upstreamID: {TaskInfo: relaycommon.TaskInfo{TaskID: upstreamID, Status: string(testCase.resultStatus), Reason: "weird"}},
				}
			}

			require.NoError(t, UpdateBatchTasks(context.Background(), adaptor, map[int][]string{channelID: {upstreamID}}, map[string]*model.Task{upstreamID: task}))

			var persisted model.Task
			require.NoError(t, model.DB.First(&persisted, task.ID).Error)
			assert.EqualValues(t, testCase.wantStatus, persisted.Status)
			assert.Equal(t, testCase.wantFailures, persisted.PrivateData.PollFailures)
			if testCase.wantReason != "" {
				assert.Contains(t, persisted.FailReason, testCase.wantReason)
			}
			if testCase.wantRefund {
				assert.Equal(t, initialQuota+preConsumed, getUserQuota(t, userID))
				assert.Zero(t, persisted.Quota)
			} else {
				assert.Equal(t, initialQuota, getUserQuota(t, userID))
			}
		})
	}
}
