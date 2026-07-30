package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service/storage"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type taskPollingFetchAdaptor struct {
	mu           sync.Mutex
	taskIDs      []string
	fetched      chan string
	blockTaskID  string
	blockStarted chan struct{}
	releaseBlock chan struct{}
	blockOnce    sync.Once
}

type sunoFailurePollingAdaptor struct{}

type videoSuccessPollingAdaptor struct {
	resultURL string
}

func (a *sunoFailurePollingAdaptor) Init(_ *relaycommon.RelayInfo) {}
func (a *sunoFailurePollingAdaptor) FetchTask(_ string, _ string, body map[string]any, _ string) (*http.Response, error) {
	taskIDs, _ := body["ids"].([]string)
	items := make([]dto.SunoDataResponse, 0, len(taskIDs))
	for _, taskID := range taskIDs {
		items = append(items, dto.SunoDataResponse{TaskID: taskID, Status: string(model.TaskStatusFailure), FailReason: "upstream failed"})
	}
	data, err := common.Marshal(dto.TaskResponse[[]dto.SunoDataResponse]{Code: dto.TaskSuccessCode, Data: items})
	if err != nil {
		return nil, err
	}
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(data))}, nil
}
func (a *sunoFailurePollingAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
	return nil, nil
}
func (a *sunoFailurePollingAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	return 0
}

func (a *videoSuccessPollingAdaptor) Init(_ *relaycommon.RelayInfo) {}
func (a *videoSuccessPollingAdaptor) FetchTask(_ string, _ string, body map[string]any, _ string) (*http.Response, error) {
	taskID, _ := body["task_id"].(string)
	response := dto.TaskResponse[model.Task]{
		Code: dto.TaskSuccessCode,
		Data: model.Task{
			TaskID:     taskID,
			Status:     model.TaskStatusSuccess,
			FailReason: a.resultURL,
		},
	}
	data, err := common.Marshal(response)
	if err != nil {
		return nil, err
	}
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(data))}, nil
}
func (a *videoSuccessPollingAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
	return nil, nil
}
func (a *videoSuccessPollingAdaptor) AdjustBillingOnComplete(*model.Task, *relaycommon.TaskInfo) int {
	return 0
}

func TestRedactVideoResponseBodyRemovesXAIUpstreamURL(t *testing.T) {
	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeXai))
	body := []byte(`{"status":"done","video":{"url":"https://signed.video.example/v.mp4?secret=token","duration":8}}`)

	redacted := redactVideoResponseBody(body, platform)

	require.NotContains(t, string(redacted), "signed.video.example")
	var result map[string]any
	require.NoError(t, common.Unmarshal(redacted, &result))
	require.NotContains(t, result["video"].(map[string]any), "url")
}

func TestRedactVideoResponseBodyFailsClosedForMalformedXAIResponse(t *testing.T) {
	platform := constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeXai))
	body := []byte(`{"video":{"url":"https://signed.video.example/v.mp4?secret=token"}`)

	redacted := redactVideoResponseBody(body, platform)

	assert.JSONEq(t, `{"redacted":true}`, string(redacted))
}

func (a *taskPollingFetchAdaptor) Init(_ *relaycommon.RelayInfo) {}

func (a *taskPollingFetchAdaptor) FetchTask(_ string, _ string, body map[string]any, _ string) (*http.Response, error) {
	taskID, _ := body["task_id"].(string)
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

	response := dto.TaskResponse[model.Task]{
		Code: dto.TaskSuccessCode,
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

func (a *taskPollingFetchAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
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
		Action:    constant.TaskActionGenerate,
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
	slowUpstreamID := slowTask.GetUpstreamTaskID()
	fastFirstUpstreamID := fastFirst.GetUpstreamTaskID()
	fastSecondUpstreamID := fastSecond.GetUpstreamTaskID()

	adaptor := &taskPollingFetchAdaptor{
		fetched:      make(chan string, 4),
		blockTaskID:  slowUpstreamID,
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
				slowUpstreamID,
			},
			fastChannelID: {
				fastFirstUpstreamID,
				fastSecondUpstreamID,
			},
		}, map[string]*model.Task{
			slowUpstreamID:       slowTask,
			fastFirstUpstreamID:  fastFirst,
			fastSecondUpstreamID: fastSecond,
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
			fetchedTaskIDs[0] == fastFirstUpstreamID &&
			fetchedTaskIDs[1] == fastSecondUpstreamID
	}, 500*time.Millisecond, 10*time.Millisecond)

	releaseBlockedTask()
	require.NoError(t, <-errCh)
	assert.ElementsMatch(t, []string{
		slowUpstreamID,
		fastFirstUpstreamID,
		fastSecondUpstreamID,
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

func TestUpdateSunoTasksStaleSnapshotsRefundOnce(t *testing.T) {
	truncate(t)
	const userID, tokenID, channelID, quota = 401, 401, 401, 2500
	seedUser(t, userID, 10000)
	seedToken(t, tokenID, userID, "sk-suno-token", 6000)
	baseURL := "https://suno.invalid"
	require.NoError(t, model.DB.Create(&model.Channel{Id: channelID, Type: constant.ChannelTypeSunoAPI, Name: "suno", Key: "sk-channel", Status: common.ChannelStatusEnabled, BaseURL: &baseURL}).Error)
	task := makeTask(userID, channelID, quota, tokenID, BillingSourceWallet, 0)
	task.TaskID = "suno_public"
	task.Platform = constant.TaskPlatformSuno
	task.PrivateData.UpstreamTaskID = "suno_upstream"
	require.NoError(t, model.DB.Create(task).Error)
	var first, stale model.Task
	require.NoError(t, model.DB.First(&first, task.ID).Error)
	require.NoError(t, model.DB.First(&stale, task.ID).Error)

	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return &sunoFailurePollingAdaptor{} }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	require.NoError(t, updateSunoTasks(context.Background(), channelID, []string{"suno_upstream"}, map[string]*model.Task{"suno_upstream": &first}))
	require.NoError(t, updateSunoTasks(context.Background(), channelID, []string{"suno_upstream"}, map[string]*model.Task{"suno_upstream": &stale}))

	assert.Equal(t, 12500, getUserQuota(t, userID))
	assert.Equal(t, 8500, getTokenRemainQuota(t, tokenID))
	assert.Equal(t, int64(1), countLogs(t))
	assert.Zero(t, getTaskQuota(t, task.ID))
}

func TestSweepTimedOutTasksRefundBoundaryAndCASLoser(t *testing.T) {
	truncate(t)
	const userID = 402
	seedUser(t, userID, 10000)
	legacy := makeTask(userID, 0, 1800, 0, BillingSourceWallet, 0)
	legacy.TaskID = "legacy_timeout"
	legacy.SubmitTime = model.TaskRefundLegacyCutoff - 1
	require.NoError(t, model.DB.Create(legacy).Error)
	modern := makeTask(userID, 0, 1200, 0, BillingSourceWallet, 0)
	modern.TaskID = "modern_timeout"
	modern.SubmitTime = model.TaskRefundLegacyCutoff
	require.NoError(t, model.DB.Create(modern).Error)

	previousTimeout := constant.TaskTimeoutMinutes
	constant.TaskTimeoutMinutes = 1
	t.Cleanup(func() { constant.TaskTimeoutMinutes = previousTimeout })
	sweepTimedOutTasks(context.Background())

	assert.Zero(t, getTaskQuota(t, legacy.ID))
	assert.Zero(t, getTaskQuota(t, modern.ID))
	assert.Equal(t, 11200, getUserQuota(t, userID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestFailPollingTaskCASWinnerAndLoser(t *testing.T) {
	truncate(t)
	const userID, quota = 403, 900
	seedUser(t, userID, 10000)
	task := makeTask(userID, 0, quota, 0, BillingSourceWallet, 0)
	task.TaskID = "missing_upstream"
	require.NoError(t, model.DB.Create(task).Error)
	var winner, stale model.Task
	require.NoError(t, model.DB.First(&winner, task.ID).Error)
	require.NoError(t, model.DB.First(&stale, task.ID).Error)

	assert.True(t, failPollingTask(context.Background(), &winner, "missing upstream task ID"))
	assert.False(t, failPollingTask(context.Background(), &stale, "missing upstream task ID"))
	assert.Equal(t, 10900, getUserQuota(t, userID))
	assert.Equal(t, int64(1), countLogs(t))
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloaded.Status)
	assert.Equal(t, "100%", reloaded.Progress)
	assert.NotZero(t, reloaded.FinishTime)
	assert.Equal(t, "missing upstream task ID", reloaded.FailReason)
}

func TestUpdateVideoTasksFallsBackToDatabaseOnCacheMiss(t *testing.T) {
	truncate(t)

	const channelID = 404
	seedTaskPollingChannel(t, channelID, true)
	task := seedPollingTask(t, channelID, "cache_fallback_public", "cache_fallback_upstream")

	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = previousMemoryCacheEnabled })

	adaptor := &taskPollingFetchAdaptor{}
	previousFactory := GetTaskAdaptorFunc
	GetTaskAdaptorFunc = func(constant.TaskPlatform) TaskPollingAdaptor { return adaptor }
	t.Cleanup(func() { GetTaskAdaptorFunc = previousFactory })

	require.NoError(t, UpdateVideoTasks(context.Background(), task.Platform, map[int][]string{
		channelID: {task.GetUpstreamTaskID()},
	}, map[string]*model.Task{
		task.GetUpstreamTaskID(): task,
	}))

	assert.Equal(t, 1, adaptor.fetchCount())
	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusInProgress, reloaded.Status)
	assert.Empty(t, reloaded.FailReason)
}

func TestUpdateVideoTasksPermanentlyMissingChannelRefundsCASWinner(t *testing.T) {
	truncate(t)

	const userID, channelID, quota = 405, 405, 700
	seedUser(t, userID, 10_000)
	task := makeTask(userID, channelID, quota, 0, BillingSourceWallet, 0)
	task.TaskID = "missing_channel_public"
	task.Platform = constant.TaskPlatform("kling")
	task.PrivateData.UpstreamTaskID = "missing_channel_upstream"
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, UpdateVideoTasks(context.Background(), task.Platform, map[int][]string{
		channelID: {task.GetUpstreamTaskID()},
	}, map[string]*model.Task{
		task.GetUpstreamTaskID(): task,
	}))

	var reloaded model.Task
	require.NoError(t, model.DB.First(&reloaded, task.ID).Error)
	assert.EqualValues(t, model.TaskStatusFailure, reloaded.Status)
	assert.Zero(t, reloaded.Quota)
	assert.Equal(t, 10_000+quota, getUserQuota(t, userID))
	assert.Equal(t, int64(1), countLogs(t))
}

func TestCompletedVideoOutputIsPersistedOnlyByCASWinner(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PlaygroundRun{}, &model.PlaygroundAsset{}))
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM playground_runs")
		model.DB.Exec("DELETE FROM playground_assets")
	})

	t.Setenv("STORAGE_BACKEND", "local")
	t.Setenv("PLAYGROUND_ASSETS_DIR", t.TempDir())
	storage.Reset()
	t.Cleanup(storage.Reset)

	const channelID = 406
	seedTaskPollingChannel(t, channelID, true)
	task := seedPollingTask(t, channelID, "video_output_public", "video_output_upstream")
	require.NoError(t, model.CreatePlaygroundRun(&model.PlaygroundRun{
		UserId:   task.UserId,
		Modality: "video",
		TaskId:   task.TaskID,
	}))

	var winner, stale model.Task
	require.NoError(t, model.DB.First(&winner, task.ID).Error)
	require.NoError(t, model.DB.First(&stale, task.ID).Error)
	mp4 := append([]byte{0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70}, []byte("isom video bytes")...)
	adaptor := &videoSuccessPollingAdaptor{resultURL: "data:video/mp4;base64," + base64.StdEncoding.EncodeToString(mp4)}
	channel, err := model.GetChannelById(channelID, true)
	require.NoError(t, err)

	require.NoError(t, updateVideoSingleTask(context.Background(), adaptor, channel, task.GetUpstreamTaskID(), map[string]*model.Task{
		task.GetUpstreamTaskID(): &winner,
	}))
	require.NoError(t, updateVideoSingleTask(context.Background(), adaptor, channel, task.GetUpstreamTaskID(), map[string]*model.Task{
		task.GetUpstreamTaskID(): &stale,
	}))

	require.Eventually(t, func() bool {
		var run model.PlaygroundRun
		return model.DB.Where("task_id = ?", task.TaskID).First(&run).Error == nil && run.AssetId != 0
	}, time.Second, 10*time.Millisecond)
	var assetCount int64
	require.NoError(t, model.DB.Model(&model.PlaygroundAsset{}).Where("user_id = ?", task.UserId).Count(&assetCount).Error)
	assert.Equal(t, int64(1), assetCount)
}
