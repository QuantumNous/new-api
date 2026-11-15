package controller

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

type nativeRouteBilling struct {
	events      []string
	preConsumed int
	userID      int
	settled     bool
	reserveErr  error
}

// Settle charges what the reservation did not cover.
func (b *nativeRouteBilling) Settle(quota int) error {
	b.events = append(b.events, "settle")
	if quota > b.preConsumed {
		if err := model.DecreaseUserQuota(b.userID, quota-b.preConsumed, true); err != nil {
			return err
		}
	}
	b.settled = true
	return nil
}

func (b *nativeRouteBilling) Refund(*gin.Context) {
	b.events = append(b.events, "refund")
	if !b.settled && b.preConsumed > 0 {
		_ = model.IncreaseUserQuota(b.userID, b.preConsumed, true)
		b.preConsumed = 0
	}
}

func (b *nativeRouteBilling) NeedsRefund() bool {
	return !b.settled && b.preConsumed > 0
}

func (b *nativeRouteBilling) GetPreConsumedQuota() int {
	return b.preConsumed
}

func (b *nativeRouteBilling) Reserve(quota int) error {
	b.events = append(b.events, "reserve")
	if b.reserveErr != nil {
		return b.reserveErr
	}
	if err := model.DecreaseUserQuota(b.userID, quota, true); err != nil {
		return err
	}
	b.preConsumed = quota
	return nil
}

// ReserveBeforeSubmit holds nothing: this fixture charges in Reserve once the
// upstream has accepted.
func (*nativeRouteBilling) ReserveBeforeSubmit(int) error { return nil }

func TestKlingNativeRouteSubmitPollSettleAndQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousBatchUpdate := common.BatchUpdateEnabled
	previousLogConsume := common.LogConsumeEnabled
	previousRedisEnabled := common.RedisEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Channel{}, &model.Task{}, &model.Log{}))
	model.DB = database
	model.LOG_DB = database
	common.MemoryCacheEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = false
	common.RedisEnabled = false
	previousModelRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"kling-v3":1}`))
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.BatchUpdateEnabled = previousBatchUpdate
		common.LogConsumeEnabled = previousLogConsume
		common.RedisEnabled = previousRedisEnabled
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousModelRatios))
	})
	require.NoError(t, database.Create(&model.User{
		Id:       7,
		Username: "native-route-user",
		Group:    "default",
		Quota:    1_000_000,
	}).Error)

	var submitCalls atomic.Int32
	var queryCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/kling/v1/videos/text2video":
			submitCalls.Add(1)
			body, readErr := io.ReadAll(r.Body)
			if !assert.NoError(t, readErr) {
				http.Error(w, "read request", http.StatusInternalServerError)
				return
			}
			assert.Contains(t, string(body), `"model_name":"kling-v3"`)
			_, _ = io.WriteString(w, `{"code":0,"message":"","data":{"task_id":"kling-private-1","task_status":"submitted"}}`)
		case r.Method == http.MethodGet && r.URL.Path == "/kling/v1/videos/text2video/kling-private-1":
			queryCalls.Add(1)
			_, _ = io.WriteString(w, `{"code":0,"message":"","data":{"task_id":"kling-private-1","task_status":"succeed","task_status_msg":"","task_result":{"videos":[{"id":"video-private","url":"https://cdn.example/video.mp4","duration":"5"}]},"final_unit_deduction":"1"}}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()

	channel := model.Channel{
		Type:    constant.ChannelTypeKling,
		Name:    "kling-native-e2e",
		Key:     "sk-test",
		BaseURL: &upstream.URL,
		Status:  common.ChannelStatusEnabled,
		Models:  "kling-v3",
		Group:   "default",
	}
	require.NoError(t, database.Create(&channel).Error)

	generation := pluginruntime.DefaultRegistry.Generation()
	require.NotNil(t, generation)
	submitBinding, found := generation.LookupDeclaredRoute(http.MethodPost, "/kling/v1/videos/text2video")
	require.True(t, found)
	require.Equal(t, "kling", submitBinding.Plugin.Meta.Key)

	submitRecorder := httptest.NewRecorder()
	submitContext, _ := gin.CreateTestContext(submitRecorder)
	submitContext.Request = httptest.NewRequest(
		http.MethodPost,
		"/kling/v1/videos/text2video",
		bytes.NewBufferString(`{"model_name":"kling-v3","prompt":"a lighthouse"}`),
	)
	submitContext.Request.Header.Set("Content-Type", "application/json")
	submitContext.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{
		Generation: generation,
		Plugin:     submitBinding.Plugin,
		Route:      submitBinding.Route,
	})
	common.SetContextKey(submitContext, constant.ContextKeyUserId, 7)
	common.SetContextKey(submitContext, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(submitContext, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(submitContext, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(submitContext, constant.ContextKeyUserQuota, 1_000_000)

	middleware.PrepareTaskPluginRoute()(submitContext)
	require.False(t, submitContext.IsAborted(), submitRecorder.Body.String())
	require.Equal(t, "kling-v3", submitContext.GetString("resolved_task_model"))
	require.Equal(t, "text_to_video", submitContext.GetString("task_action"))
	require.Nil(t, middleware.SetupContextForSelectedChannel(submitContext, &channel, "kling-v3"))

	billing := &nativeRouteBilling{userID: 7}
	relayInfo := &relaycommon.RelayInfo{
		UserId:          7,
		UserGroup:       "default",
		UsingGroup:      "default",
		UserQuota:       1_000_000,
		TokenGroup:      "default",
		OriginModelName: "kling-v3",
		Billing:         billing,
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			Action:        submitContext.GetString("task_action"),
			PublicTaskID:  "task_kling_public",
			LockedChannel: &channel,
		},
	}

	outcome, taskErr := executeTaskSubmissionWith(submitContext, relayInfo, relay.RelayTaskSubmit)
	require.Nil(t, taskErr)
	require.NotNil(t, outcome)
	require.Equal(t, []string{"reserve", "settle"}, billing.events)
	require.False(t, submitContext.Writer.Written())

	presentTaskSubmission(submitContext, outcome)
	require.Equal(t, http.StatusOK, submitRecorder.Code)
	assert.Contains(t, submitRecorder.Body.String(), `"task_id":"task_kling_public"`)
	assert.NotContains(t, submitRecorder.Body.String(), "kling-private-1")
	assert.Equal(t, int32(1), submitCalls.Load())

	var persisted model.Task
	require.NoError(t, database.Where("task_id = ?", "task_kling_public").First(&persisted).Error)
	assert.Equal(t, constant.TaskPlatform("kling"), persisted.Platform)
	assert.Equal(t, "kling-private-1", persisted.PrivateData.UpstreamTaskID)
	assert.Equal(t, model.TaskStatus(model.TaskStatusNotStart), persisted.Status)

	previousAdaptorFactory := service.GetTaskAdaptorFunc
	service.GetTaskAdaptorFunc = func(platform constant.TaskPlatform) service.TaskPollingAdaptor {
		return relay.GetTaskAdaptor(platform)
	}
	t.Cleanup(func() { service.GetTaskAdaptorFunc = previousAdaptorFactory })
	service.DispatchPlatformUpdate(
		context.Background(),
		persisted.Platform,
		map[int][]string{channel.Id: {"kling-private-1"}},
		map[string]*model.Task{"kling-private-1": &persisted},
	)

	require.NoError(t, database.Where("task_id = ?", "task_kling_public").First(&persisted).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusSuccess), persisted.Status)
	assert.Equal(t, "100%", persisted.Progress)
	assert.Equal(t, 1, persisted.Quota)
	assert.Equal(t, int32(1), queryCalls.Load())
	var settledUser model.User
	require.NoError(t, database.First(&settledUser, 7).Error)
	assert.Equal(t, 999_999, settledUser.Quota)

	queryBinding, found := generation.LookupDeclaredRoute(http.MethodGet, "/kling/v1/videos/text2video/:task_id")
	require.True(t, found)
	queryRecorder := httptest.NewRecorder()
	queryContext, _ := gin.CreateTestContext(queryRecorder)
	queryContext.Request = httptest.NewRequest(http.MethodGet, "/kling/v1/videos/text2video/task_kling_public", nil)
	// The inner plugin router names wildcards by position.
	queryContext.Params = gin.Params{{Key: "s4", Value: "task_kling_public"}}
	queryContext.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{
		Generation: generation,
		Plugin:     queryBinding.Plugin,
		Route:      queryBinding.Route,
	})
	common.SetContextKey(queryContext, constant.ContextKeyUserId, 7)

	middleware.PrepareTaskPluginRoute()(queryContext)

	require.True(t, queryContext.IsAborted())
	require.Equal(t, http.StatusOK, queryRecorder.Code)
	assert.Contains(t, queryRecorder.Body.String(), `"task_id":"task_kling_public"`)
	assert.Contains(t, queryRecorder.Body.String(), `"task_status":"succeed"`)
	assert.NotContains(t, queryRecorder.Body.String(), "kling-private-1")
	assert.NotContains(t, queryRecorder.Body.String(), upstream.URL)
}

// Once Ark's first event has reached a native client the submission settles
// and is never refunded. A stream Ark finished bills the images it delivered;
// one that broke off, whose first event the plugin could not read, or that
// kept sending keep-alive comments until the submission deadline bills the
// reserved images. A finished stream stays billed and logged when the host
// then fails to reserve its images or to store the task.
func TestDoubaoRelayedImageStreamSettlement(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousBatchUpdate := common.BatchUpdateEnabled
	previousLogConsume := common.LogConsumeEnabled
	previousRedisEnabled := common.RedisEnabled
	previousDeadline := constant.TaskPluginProtocolTimeoutSeconds
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Channel{}, &model.Task{}, &model.Log{}))
	model.DB = database
	model.LOG_DB = database
	common.MemoryCacheEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	common.RedisEnabled = false
	constant.TaskPluginProtocolTimeoutSeconds = 1
	var failTaskInsert atomic.Bool
	require.NoError(t, database.Callback().Create().Before("gorm:create").Register("test:fail_task_insert", func(tx *gorm.DB) {
		if failTaskInsert.Load() && tx.Statement.Schema != nil && tx.Statement.Schema.Name == "Task" {
			_ = tx.AddError(errors.New("injected task insert failure"))
		}
	}))
	const seedream = "doubao-seedream-5-0-lite-260128"
	previousPrices := ratio_setting.ModelPrice2JSONString()
	// 10,000 quota per image.
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"`+seedream+`":0.02}`))
	t.Cleanup(func() {
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.BatchUpdateEnabled = previousBatchUpdate
		common.LogConsumeEnabled = previousLogConsume
		common.RedisEnabled = previousRedisEnabled
		constant.TaskPluginProtocolTimeoutSeconds = previousDeadline
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousPrices))
	})
	require.NoError(t, database.Create(&model.User{Id: 7, Username: "relayed-stream-user", Group: "default", Quota: 1_000_000}).Error)

	const image = `data: {"type":"image_generation.partial_succeeded","model":"` + seedream + `","created":1,"image_index":0,"url":"https://cdn.example/0.png","size":"2048x2048"}` + "\n\n"
	const completed = `data: {"type":"image_generation.completed","model":"` + seedream + `","created":1,"usage":{"generated_images":1,"output_tokens":16384,"total_tokens":16384}}` + "\n\n"
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Prompt string `json:"prompt"`
		}
		_ = common.DecodeJson(r.Body, &request)
		w.Header().Set("Content-Type", "text/event-stream")
		write := func(frame string) {
			_, _ = io.WriteString(w, frame)
			w.(http.Flusher).Flush()
		}
		switch request.Prompt {
		case "finished", "reserve_fails", "insert_fails":
			write(image + completed + "data: [DONE]\n\n")
		case "broken":
			write(image)
			panic(http.ErrAbortHandler)
		case "unreadable":
			write("data: {\"type\":\n\n")
			write(image)
		case "stalled":
			// Keep-alives for longer than the one-second deadline, then a
			// clean end that would bill the one image delivered.
			write(image)
			for range 50 {
				select {
				case <-r.Context().Done():
					return
				case <-time.After(100 * time.Millisecond):
					write(": keep-alive\n\n")
				}
			}
		}
	}))
	defer upstream.Close()
	channel := model.Channel{Type: constant.ChannelTypeDoubaoVideo, Name: "ark-relayed-stream", Key: "ark-key", BaseURL: &upstream.URL,
		Status: common.ChannelStatusEnabled, Models: seedream, Group: "default"}
	require.NoError(t, database.Create(&channel).Error)
	generation := pluginruntime.DefaultRegistry.Generation()
	require.NotNil(t, generation)
	binding, found := generation.LookupDeclaredRoute(http.MethodPost, "/api/v3/images/generations")
	require.True(t, found)
	require.Equal(t, "doubao", binding.Plugin.Meta.Key)

	for _, tc := range []struct {
		prompt, firstFrame string
		wantQuota          int
	}{
		{"finished", image, 10_000},
		{"broken", image, 30_000},
		{"unreadable", "data: {\"type\":\n\n", 30_000},
		{"stalled", image, 30_000},
		// Ark finished these streams, then the host could not reserve the
		// billed images or store the task.
		{"reserve_fails", image, 10_000},
		{"insert_fails", image, 10_000},
	} {
		t.Run(tc.prompt, func(t *testing.T) {
			require.NoError(t, database.Model(&model.User{}).Where("id = ?", 7).Update("quota", 1_000_000).Error)
			require.NoError(t, database.Where("type = ?", model.LogTypeConsume).Delete(&model.Log{}).Error)
			failTaskInsert.Store(tc.prompt == "insert_fails")
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/v3/images/generations", strings.NewReader(`{"model":"`+seedream+`","prompt":"`+tc.prompt+`","stream":true,`+
				`"sequential_image_generation":"auto","sequential_image_generation_options":{"max_images":3}}`))
			c.Request.Header.Set("Content-Type", "application/json")
			c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{Generation: generation, Plugin: binding.Plugin, Route: binding.Route})
			common.SetContextKey(c, constant.ContextKeyUserId, 7)
			common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
			common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
			common.SetContextKey(c, constant.ContextKeyUserQuota, 1_000_000)
			middleware.PrepareTaskPluginRoute()(c)
			require.False(t, c.IsAborted(), recorder.Body.String())
			require.Nil(t, middleware.SetupContextForSelectedChannel(c, &channel, seedream))
			billing := &nativeRouteBilling{userID: 7}
			if tc.prompt == "reserve_fails" {
				billing.reserveErr = errors.New("token quota is not enough")
			}
			relayInfo := &relaycommon.RelayInfo{UserId: 7, UserGroup: "default", UsingGroup: "default", UserQuota: 1_000_000, TokenGroup: "default",
				OriginModelName: seedream, Billing: billing,
				TaskRelayInfo: &relaycommon.TaskRelayInfo{Action: c.GetString("task_action"), PublicTaskID: "task_" + tc.prompt, LockedChannel: &channel}}

			started := time.Now()
			outcome, taskErr := executeTaskSubmissionWith(c, relayInfo, relay.RelayTaskSubmit)
			assert.Less(t, time.Since(started), 10*time.Second, "the submission deadline bounds a relayed stream")
			assert.Equal(t, []string{"reserve", "settle"}, billing.events, "a relayed stream is never refunded")
			assert.True(t, strings.HasPrefix(recorder.Body.String(), tc.firstFrame), recorder.Body.String())
			relayed := recorder.Body.String()
			if tc.prompt == "insert_fails" {
				require.NotNil(t, taskErr)
				assert.Equal(t, "task_insert_failed", taskErr.Code)
				respondTaskSubmissionError(c, taskErr)
			} else {
				require.Nil(t, taskErr)
				assert.Equal(t, tc.wantQuota, outcome.Task.Quota)
				assert.Equal(t, model.TaskStatus(model.TaskStatusSuccess), outcome.Task.Status)
				presentTaskSubmission(c, outcome)
			}
			assert.Equal(t, relayed, recorder.Body.String(), "nothing follows the relayed events")
			var user model.User
			require.NoError(t, database.First(&user, 7).Error)
			assert.Equal(t, 1_000_000-tc.wantQuota, user.Quota, "the delivered images are charged")
			var consumeLogs []model.Log
			require.NoError(t, database.Where("type = ?", model.LogTypeConsume).Find(&consumeLogs).Error)
			require.Len(t, consumeLogs, 1)
			assert.Equal(t, tc.wantQuota, consumeLogs[0].Quota)
		})
	}
}

// reservingBilling holds the estimate when the attempt reserves it, as a
// billing session does, so a refund shows in the user's quota.
type reservingBilling struct{ nativeRouteBilling }

func (b *reservingBilling) ReserveBeforeSubmit(quota int) error { return b.Reserve(quota) }

// A task submission runs the request plugins: ingress on the client body
// before it is decoded, priced or reserved, egress on the body the task
// plugin built. An ingress stop charges nothing, an egress stop gives the
// reservation back, and the logs carry the record.
func TestTaskSubmissionRunsRequestPlugins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	require.NoError(t, i18n.Init())

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMemoryCache, previousBatchUpdate, previousLogConsume, previousRedis, previousErrorLog := common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled, constant.ErrorLogEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Channel{}, &model.Task{}, &model.Log{}))
	model.DB, model.LOG_DB = database, database
	common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled, constant.ErrorLogEnabled = false, false, true, false, true
	previousPrices := ratio_setting.ModelPrice2JSONString()
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"rp-video-1":0.01}`))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled, constant.ErrorLogEnabled = previousMemoryCache, previousBatchUpdate, previousLogConsume, previousRedis, previousErrorLog
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousPrices))
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	require.NoError(t, database.Create(&model.User{Id: 7, Username: "task-plugins-user", Group: "default", Quota: 1_000_000}).Error)

	var sent []string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		sent = append(sent, string(body))
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"up-1"}`)
	}))
	defer upstream.Close()

	for _, source := range []string{`export const meta = {apiVersion: 1, key: "rp-video", name: "Video", version: "1.0.0", author: {name: "Test"}, models: ["rp-video-1"], fetchMode: "per_task"};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit", method: "POST", body: {model: ctx.requestBody.model, prompt: ctx.requestBody.prompt}}; }
export function parseSubmitResponse(ctx) { return {taskId: "up-1", taskData: {prompt: ctx.requestBody.prompt}}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }`,
		`export const meta = {apiVersion: 1, key: "rp-task", name: "Task", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  if (ctx.config.reject) return {action: "reject", code: "blocked.task", message: "No " + ctx.format};
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "replace", path: "/prompt", value: req.body.prompt.replace("a@b.c", "[email]")}]}]};
}
export function egress(ctx, req) {
  if (ctx.config.egress) return {action: "reject", code: "blocked.egress", message: ctx.format + " " + req.body.prompt};
  return {action: "continue"};
}`} {
		plugin, registerErr := pluginruntime.DefaultRegistry.Register(source, pluginruntime.Options{})
		require.NoError(t, registerErr)
		t.Cleanup(func() { _ = pluginruntime.DefaultRegistry.Unregister(plugin.Meta.Key) })
	}
	channel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Name: "rp-video", Key: "sk-test", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "rp-video-1", Group: "default"}
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: "rp-video"})
	require.NoError(t, database.Create(&channel).Error)

	submit := func(instances, taskID string) (*httptest.ResponseRecorder, *reservingBilling, *taskdto.TaskError) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: instances}))
		sent = nil
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/tasks/rp-video", strings.NewReader(`{"model":"rp-video-1","prompt":"mail a@b.c a cat"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Params = gin.Params{{Key: "key", Value: "rp-video"}}
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserQuota, 1_000_000)
		middleware.PrepareTaskPluginSubmit()(c)
		require.False(t, c.IsAborted(), recorder.Body.String())
		require.Nil(t, middleware.SetupContextForSelectedChannel(c, &channel, "rp-video-1"))
		billing := &reservingBilling{nativeRouteBilling{userID: 7}}
		relayInfo := &relaycommon.RelayInfo{
			UserId: 7, UserGroup: "default", UsingGroup: "default", UserQuota: 1_000_000, TokenGroup: "default",
			OriginModelName: "rp-video-1", Billing: billing,
			TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: taskID, LockedChannel: &channel},
		}
		outcome, taskErr := executeTaskSubmissionWith(c, relayInfo, relay.RelayTaskSubmit)
		if taskErr != nil {
			respondTaskSubmissionError(c, taskErr)
		} else {
			presentTaskSubmission(c, outcome)
		}
		return recorder, billing, taskErr
	}
	lastLog := func(logType int) model.Log {
		var entry model.Log
		require.NoError(t, database.Where("type = ?", logType).Order("id DESC").First(&entry).Error)
		return entry
	}
	quota := func() int {
		var user model.User
		require.NoError(t, database.First(&user, 7).Error)
		return user.Quota
	}

	// An ingress rejection answers in the task error format before anything
	// is decoded, priced or reserved, and its error log has the record.
	recorder, billing, taskErr := submit(`[{"id":"door","name":"Door","plugin":"rp-task","enabled":true,"global":true,"config":{"reject":true}}]`, "task_rp_rejected")
	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.JSONEq(t, `{"code":"request_rejected","message":"No task (code: blocked.task)","data":null}`, recorder.Body.String())
	assert.NotContains(t, billing.events, "reserve")
	assert.Empty(t, sent)
	assert.Equal(t, 1_000_000, quota())
	errorLog := lastLog(model.LogTypeError)
	assert.Zero(t, errorLog.ChannelId)
	assert.JSONEq(t, `[{"plugin":"rp-task","name":{"en":"Task"},"stage":"ingress","rejected":{"code":"blocked.task"}}]`, gjson.Get(errorLog.Other, "request_plugins").Raw)
	assert.Equal(t, "reject", gjson.Get(errorLog.Other, "admin_info.request_plugins.0.action").Str)

	// The redacted prompt is what the task plugin decodes, prices, sends and
	// stores; the consume log shows the change.
	recorder, billing, taskErr = submit(`[{"id":"redact","name":"Redact","plugin":"rp-task","enabled":true,"global":true}]`, "task_rp_redacted")
	require.Nil(t, taskErr, recorder.Body.String())
	assert.NotContains(t, billing.events, "refund")
	require.Len(t, sent, 1)
	assert.JSONEq(t, `{"model":"rp-video-1","prompt":"mail [email] a cat"}`, sent[0])
	var task model.Task
	require.NoError(t, database.Where("task_id = ?", "task_rp_redacted").First(&task).Error)
	assert.JSONEq(t, `{"prompt":"mail [email] a cat"}`, string(task.Data))
	consumeLog := lastLog(model.LogTypeConsume)
	assert.JSONEq(t, `[{"plugin":"rp-task","name":{"en":"Task"},"stage":"ingress","changes":[{"op":"replace","path":"prompt","value":"mail [email] a cat"}]}]`, gjson.Get(consumeLog.Other, "request_plugins").Raw)
	assert.Equal(t, "redact", gjson.Get(consumeLog.Other, "admin_info.request_plugins.0.instance").Str)
	assert.NotContains(t, consumeLog.Other, "a@b.c")
	charged := 1_000_000 - quota()
	assert.Positive(t, charged)

	// Egress reads the body the task plugin built, after the reserve: its
	// stop sends nothing and the existing refund gives the quota back.
	before := quota()
	recorder, billing, taskErr = submit(`[
		{"id":"redact","name":"Redact","plugin":"rp-task","enabled":true,"global":true},
		{"id":"final","name":"Final","plugin":"rp-task","enabled":true,"global":true,"config":{"egress":true}}
	]`, "task_rp_egress")
	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.Equal(t, "request_rejected", taskErr.Code)
	assert.Equal(t, "task mail [email] a cat (code: blocked.egress)", taskErr.Message)
	assert.Equal(t, []string{"reserve", "refund"}, billing.events)
	assert.Empty(t, sent)
	assert.Equal(t, before, quota())
	errorLog = lastLog(model.LogTypeError)
	assert.Equal(t, channel.Id, errorLog.ChannelId)
	assert.JSONEq(t, `{"plugin":"rp-task","name":{"en":"Task"},"stage":"egress","rejected":{"code":"blocked.egress"}}`, gjson.Get(errorLog.Other, `request_plugins.#(stage=="egress")`).Raw)
}

// On a native route the plugin decodes the body again after ingress changed
// it, so the vendor receives the changed prompt.
func TestNativeRouteDecodesTheIngressBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	require.NoError(t, i18n.Init())

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMemoryCache, previousBatchUpdate, previousLogConsume, previousRedis := common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled
	database, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, database.AutoMigrate(&model.User{}, &model.Channel{}, &model.Task{}, &model.Log{}))
	model.DB, model.LOG_DB = database, database
	common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled = false, false, false, false
	previousModelRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"kling-v3":1}`))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled = previousMemoryCache, previousBatchUpdate, previousLogConsume, previousRedis
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousModelRatios))
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: "[]"}))
	})
	require.NoError(t, database.Create(&model.User{Id: 7, Username: "native-ingress-user", Group: "default", Quota: 1_000_000}).Error)

	var sent string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		sent = string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":0,"message":"","data":{"task_id":"kling-private-2","task_status":"submitted"}}`)
	}))
	defer upstream.Close()
	plugin, err := pluginruntime.DefaultRegistry.Register(`export const meta = {apiVersion: 1, key: "rp-native", name: "Native", version: "1.0.0", author: {name: "Test"}};
export function ingress(ctx, req) {
  return {action: "continue", effects: [{type: "json.patch", ops: [{op: "replace", path: "/prompt", value: ctx.format + ": " + req.body.prompt.replace("a@b.c", "[email]")}]}]};
}`, pluginruntime.Options{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = pluginruntime.DefaultRegistry.Unregister(plugin.Meta.Key) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{request_plugin_setting.InstancesOption: `[{"id":"redact","name":"Redact","plugin":"rp-native","enabled":true,"global":true}]`}))
	channel := model.Channel{Type: constant.ChannelTypeKling, Name: "kling-native-ingress", Key: "sk-test", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "kling-v3", Group: "default"}
	require.NoError(t, database.Create(&channel).Error)

	generation := pluginruntime.DefaultRegistry.Generation()
	binding, found := generation.LookupDeclaredRoute(http.MethodPost, "/kling/v1/videos/text2video")
	require.True(t, found)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/kling/v1/videos/text2video", strings.NewReader(`{"model_name":"kling-v3","prompt":"mail a@b.c a lighthouse"}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set(pluginruntime.ContextKeyPinnedRoute, pluginruntime.PinnedRoute{Generation: generation, Plugin: binding.Plugin, Route: binding.Route})
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserQuota, 1_000_000)
	middleware.PrepareTaskPluginRoute()(c)
	require.False(t, c.IsAborted(), recorder.Body.String())
	require.Nil(t, middleware.SetupContextForSelectedChannel(c, &channel, "kling-v3"))
	relayInfo := &relaycommon.RelayInfo{
		UserId: 7, UserGroup: "default", UsingGroup: "default", UserQuota: 1_000_000, TokenGroup: "default",
		OriginModelName: "kling-v3", Billing: &nativeRouteBilling{userID: 7},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{Action: c.GetString("task_action"), PublicTaskID: "task_kling_ingress", LockedChannel: &channel},
	}

	_, taskErr := executeTaskSubmissionWith(c, relayInfo, relay.RelayTaskSubmit)

	require.Nil(t, taskErr)
	assert.Equal(t, "task: mail [email] a lighthouse", gjson.Get(sent, "prompt").Str, sent)
	assert.Equal(t, "kling-v3", gjson.Get(sent, "model_name").Str)
}
