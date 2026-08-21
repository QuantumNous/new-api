package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRelayTaskStopsRetryWhenSubmitOutcomeMayBeUnknown(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	adaptor := &relayTaskOutcomeAdaptor{
		results: map[int]*relay.TaskSubmitResult{
			131: {Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)), Quota: 50, OutcomeMayBeUnknown: true},
		},
		errors: map[int]*dto.TaskError{
			131: service.TaskErrorWrapper(assertErr("timeout after possible send"), "do_request_failed", http.StatusInternalServerError),
		},
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-a", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-b", 90, 1)
	model.InitChannelCache()

	c, recorder := newControllerRelayTaskContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"cinematic"}]}`)
	seedRelayTaskContext(c)

	RelayTask(c)

	require.Equal(t, http.StatusInternalServerError, recorder.Code, recorder.Body.String())
	require.Equal(t, []int{131}, adaptor.channelsSeen, "unknown outcome must not retry or switch channels")
}

func TestRelayTaskCanRetryDefinitePreSendFailure(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	adaptor := &relayTaskOutcomeAdaptor{
		results: map[int]*relay.TaskSubmitResult{
			131: {Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)), Quota: 50, OutcomeMayBeUnknown: false},
			132: {Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)), Quota: 50, UpstreamTaskID: "upstream-b", TaskData: []byte(`{"id":"upstream-b"}`)},
		},
		errors: map[int]*dto.TaskError{
			131: service.TaskErrorWrapper(channel.MarkDefinitelyNotSent(assertErr("paid gate failed before send")), "media_subscription_required", http.StatusServiceUnavailable),
		},
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-a", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-b", 90, 1)
	model.InitChannelCache()

	c, recorder := newControllerRelayTaskContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"cinematic"}]}`)
	seedRelayTaskContext(c)

	RelayTask(c)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Equal(t, []int{131, 132}, adaptor.channelsSeen)
	var response dto.OpenAIVideo
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "upstream-b", response.ID)
}

func TestLegacyVideoPollingPassesGrokOriginChannelID(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	task := &model.Task{
		TaskID:    "task_legacy_grok_poll",
		UserId:    7,
		ChannelId: 11301,
		Platform:  constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeGrokSubscription)),
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
	adaptor := &legacyGrokPollingAdaptor{}
	ch := &model.Channel{Id: 11301, Type: constant.ChannelTypeGrokSubscription, Key: "stored-oauth-json", Status: common.ChannelStatusEnabled}

	err := updateVideoSingleTask(context.Background(), adaptor, ch, task.GetUpstreamTaskID(), map[string]*model.Task{task.GetUpstreamTaskID(): task})
	require.NoError(t, err)
	require.Equal(t, map[string]any{
		"task_id":    "upstream-grok-request",
		"action":     constant.TaskActionGenerate,
		"channel_id": 11301,
	}, adaptor.body)
	require.Empty(t, adaptor.key)
}

func seedRelayTaskContext(c *gin.Context) {
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenId, 11)
	common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-11")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"seedance-2.0": true})
	// RelayTask is normally entered after the distributor has selected the
	// first channel and populated these channel-derived context values. Keep
	// the fixture faithful to that production contract so the retry loop can
	// exercise channel 131 first and reselect channel 132 only after the first
	// attempt is definitely retryable.
	common.SetContextKey(c, constant.ContextKeyChannelId, 131)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeBytePlus)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-provider-a")
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, "https://provider.example")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "seedance-2.0")
	c.Set("token_name", "task-token")
	c.Set("token_quota", 10000)
}

type relayTaskOutcomeAdaptor struct {
	channel.TaskAdaptor
	calls        atomic.Int32
	channelsSeen []int
	results      map[int]*relay.TaskSubmitResult
	errors       map[int]*dto.TaskError
}

func (a *relayTaskOutcomeAdaptor) Init(info *relaycommon.RelayInfo) {}
func (a *relayTaskOutcomeAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	var req dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	info.Action = constant.TaskActionGenerate
	info.OriginModelName = req.Model
	return nil
}
func (a *relayTaskOutcomeAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	return nil
}
func (a *relayTaskOutcomeAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return nil
}
func (a *relayTaskOutcomeAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}
func (a *relayTaskOutcomeAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "https://provider.example/tasks", nil
}
func (a *relayTaskOutcomeAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return nil
}
func (a *relayTaskOutcomeAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	return strings.NewReader(`{}`), nil
}
func (a *relayTaskOutcomeAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	a.calls.Add(1)
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	a.channelsSeen = append(a.channelsSeen, channelID)
	if taskErr := a.errors[channelID]; taskErr != nil {
		return nil, taskErr.Error
	}
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{}`)), Header: make(http.Header)}, nil
}
func (a *relayTaskOutcomeAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	result := a.results[channelID]
	if result == nil {
		result = &relay.TaskSubmitResult{UpstreamTaskID: fmt.Sprintf("upstream-%d", channelID), TaskData: []byte(`{}`)}
	}
	video := dto.NewOpenAIVideo()
	video.ID = result.UpstreamTaskID
	video.TaskID = result.UpstreamTaskID
	video.Model = info.OriginModelName
	c.JSON(http.StatusOK, video)
	return result.UpstreamTaskID, result.TaskData, nil
}
func (a *relayTaskOutcomeAdaptor) GetModelList() []string { return []string{"seedance-2.0"} }
func (a *relayTaskOutcomeAdaptor) GetChannelName() string { return "relay-task-outcome" }
func (a *relayTaskOutcomeAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	return nil, nil
}
func (a *relayTaskOutcomeAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	return nil, nil
}

type legacyGrokPollingAdaptor struct {
	channel.TaskAdaptor
	key  string
	body map[string]any
}

func (a *legacyGrokPollingAdaptor) Init(*relaycommon.RelayInfo) {}
func (a *legacyGrokPollingAdaptor) FetchTask(baseURL, key string, body map[string]any, proxy string) (*http.Response, error) {
	a.key = key
	a.body = body
	return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"status":"pending"}`)), Header: make(http.Header)}, nil
}
func (a *legacyGrokPollingAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
	return &relaycommon.TaskInfo{Status: model.TaskStatusQueued, Progress: "20%"}, nil
}
