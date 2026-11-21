package controller

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type codingPlanTransport func(*http.Request) (*http.Response, error)

func (transport codingPlanTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestCodingPlanFailover(t *testing.T) {
	for _, plan := range []struct {
		name    string
		baseURL string
		formats []types.RelayFormat
	}{
		{"coding", constant.VolcengineCodingPlanPreset, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatOpenAIResponses}},
		{"coding_url", constant.VolcengineCodingPlanBaseURL, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatOpenAIResponses}},
		{"token", constant.VolcengineTokenPlanBaseURL, []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude, types.RelayFormatOpenAIResponses}},
	} {
		for _, format := range plan.formats {
			t.Run(plan.name+"/"+string(format), func(t *testing.T) { testCodingPlanFailover(t, format, plan.baseURL) })
		}
	}
}

func testCodingPlanFailover(t *testing.T, format types.RelayFormat, plan string) {
	t.Helper()
	require.NoError(t, i18n.Init())
	dialect := os.Getenv("TEST_TASK_DB_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	var dsn string
	switch dialect {
	case "mysql":
		dsn = os.Getenv("TEST_MYSQL_DSN")
	case "postgres":
		dsn = os.Getenv("TEST_POSTGRES_DSN")
	}
	db := modelManagementDB(t, dialect, dsn)
	require.NoError(t, db.AutoMigrate(&model.Token{}, &model.Log{}, &model.UserSubscription{}))
	oldBatch, oldConsume, oldRetry := common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RetryTimes
	common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RetryTimes = false, true, 0
	t.Cleanup(func() {
		common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RetryTimes = oldBatch, oldConsume, oldRetry
	})
	require.NoError(t, db.Create(&model.User{Id: 7, Username: "plan-user", Group: "default", Quota: 1_000_000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 8, UserId: 7, Key: "consumer", UnlimitedQuota: true}).Error)

	requestPath := "/v1/chat/completions"
	switch format {
	case types.RelayFormatClaude:
		requestPath = "/v1/messages"
	case types.RelayFormatOpenAIResponses:
		requestPath = "/v1/responses"
	}
	const modelName = "gpt-4o-mini"
	withTieredBillingConfig(t, map[string]string{modelName: "tiered_expr"}, map[string]string{modelName: "p * 1.0 + c * 2.0"})
	quotaCode := "QuotaExceeded"
	quotaMessage := "Coding Plan quota exhausted"
	if plan == constant.VolcengineTokenPlanBaseURL {
		quotaCode = "QuotaExceeded.AgentPlanQuotaExceeded"
		quotaMessage = "Agent Plan quota exhausted"
	}
	quotaBody := `{"error":{"code":"` + quotaCode + `","type":"TooManyRequests","message":"window exhausted"}}`
	tag := "coding-plan:" + t.Name() + "/" + dialect
	paidURL := "https://paid.example"
	channels := []model.Channel{
		{Name: "plan A", Key: "plan-a", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan, Tag: &tag, Priority: common.GetPointer(int64(30))},
		{Name: "duplicate of plan A", Key: "plan-a-copy", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan, Tag: &tag, Priority: common.GetPointer(int64(20))},
		{Name: "plan B", Key: "plan-b", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan, Tag: common.GetPointer(tag + "/b"), Priority: common.GetPointer(int64(10))},
		{Name: "paid", Key: "paid", Type: constant.ChannelTypeOpenAI, BaseURL: &paidURL, Priority: common.GetPointer(int64(100))},
	}
	for i := range channels {
		ch := &channels[i]
		ch.Group, ch.Models, ch.Status = "default", modelName, common.ChannelStatusEnabled
		require.NoError(t, db.Create(ch).Error)
		require.NoError(t, ch.AddAbilities(db))
	}

	service.InitHttpClient()
	client := service.GetHttpClient()
	originalTransport := client.Transport
	t.Cleanup(func() { client.Transport = originalTransport })
	var attempts []string
	var planBExhausted bool
	client.Transport = codingPlanTransport(func(request *http.Request) (*http.Response, error) {
		key := strings.TrimPrefix(request.Header.Get("Authorization"), "Bearer ")
		if key == "" {
			key = request.Header.Get("X-Api-Key")
		}
		if key != "paid" {
			planPath := "/api/coding"
			if plan == constant.VolcengineTokenPlanBaseURL {
				planPath = "/api/plan"
			}
			switch format {
			case types.RelayFormatClaude:
				assert.Equal(t, planPath+"/v1/messages", request.URL.Path)
			case types.RelayFormatOpenAIResponses:
				assert.Equal(t, planPath+"/v3/responses", request.URL.Path)
			default:
				assert.Equal(t, planPath+"/v3/chat/completions", request.URL.Path)
			}
		}
		attempts = append(attempts, key)
		switch key {
		case "plan-dial-failed":
			return nil, &net.OpError{Op: "dial", Net: "tcp", Err: io.ErrUnexpectedEOF}
		case "plan-read-failed":
			return nil, &net.OpError{Op: "read", Net: "tcp", Err: io.ErrUnexpectedEOF}
		}
		status := http.StatusOK
		header := http.Header{"Content-Type": {"text/event-stream"}}
		body := "data: {\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4o-mini\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"hello\"},\"finish_reason\":null}]}\n\n" +
			"data: {\"id\":\"chatcmpl-test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4o-mini\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":5,\"total_tokens\":17}}\n\n" +
			"data: [DONE]\n\n"
		if format == types.RelayFormatClaude && key != "paid" {
			const start = `data: {"type":"message_start","message":{"id":"msg-test","type":"message","role":"assistant","model":"gpt-4o-mini","content":[],"stop_reason":null,"usage":{"input_tokens":12,"output_tokens":0}}}` + "\n\n"
			body = start +
				`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}` + "\n\n" +
				`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}` + "\n\n" +
				`data: {"type":"content_block_stop","index":0}` + "\n\n" +
				`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}` + "\n\n" +
				`data: {"type":"message_stop"}` + "\n\n"
			if key == "plan-a" {
				body = start + `data: {"type":"error","error":{"type":"` + quotaCode + `","message":"window exhausted"}}` + "\n\n"
				return &http.Response{StatusCode: status, Header: header, Body: io.NopCloser(strings.NewReader(body)), Request: request}, nil
			}
		}
		if format == types.RelayFormatOpenAIResponses {
			body = `data: {"type":"response.output_text.delta","delta":"hello","output_index":0,"content_index":0}` + "\n\n" +
				`data: {"type":"response.completed","response":{"id":"resp_test","object":"response","status":"completed","model":"gpt-4o-mini","output":[],"usage":{"input_tokens":12,"output_tokens":5,"total_tokens":17}}}` + "\n\n"
		}
		if key == "plan-transient" {
			status = http.StatusTooManyRequests
			header = http.Header{"Content-Type": {"application/json"}, "Retry-After": {"90"}}
			body = `{"error":{"code":"RateLimitExceeded","type":"TooManyRequests","message":"short limit"}}`
		}
		if key == "plan-partial" {
			switch format {
			case types.RelayFormatClaude:
				body, _, _ = strings.Cut(body, `data: {"type":"content_block_stop"`)
			case types.RelayFormatOpenAIResponses:
				body, _, _ = strings.Cut(body, `data: {"type":"response.completed"`)
				body += `data: {"type":"response.failed","response":{"status":"failed","error":{"code":"` + quotaCode + `","message":"window exhausted"}}}` + "\n\n"
			default:
				body, _, _ = strings.Cut(body, "data: [DONE]")
			}
			if format != types.RelayFormatOpenAIResponses {
				body += `data: {"type":"error","error":{"code":"` + quotaCode + `","message":"window exhausted"}}` + "\n\n"
			}
		}
		if key == "plan-a" || key == "plan-a-copy" || (key == "plan-b" && planBExhausted) {
			status = http.StatusTooManyRequests
			header = http.Header{"Content-Type": {"application/json"}, "Retry-After": {"120"}}
			body = quotaBody
		}
		if key == "plan-invalid" {
			status = http.StatusUnauthorized
			header = http.Header{"Content-Type": {"application/json"}}
			body = `{"error":{"code":"InvalidAuthentication","message":"invalid credentials"}}`
		}
		if key == "plan-unavailable" {
			status = http.StatusServiceUnavailable
			header = http.Header{"Content-Type": {"application/json"}, "Retry-After": {"20"}}
			body = `{"error":{"code":"ServiceUnavailable","message":"upstream unavailable"}}`
		}
		return &http.Response{StatusCode: status, Header: header, Body: io.NopCloser(strings.NewReader(body)), Request: request}, nil
	})
	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })
	settings := operation_setting.GetGeneralSetting()
	oldSettings := *settings
	settings.PingIntervalEnabled = true
	t.Cleanup(func() { *settings = oldSettings })
	engine := gin.New()
	engine.POST(requestPath, func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserId, 7)
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyTokenId, 8)
		common.SetContextKey(c, constant.ContextKeyTokenKey, "consumer")
		common.SetContextKey(c, constant.ContextKeyTokenUnlimited, true)
	}, middleware.Distribute(), func(c *gin.Context) {
		Relay(c, format)
	})

	requestPayload := `{"model":"gpt-4o-mini","stream":true,"max_tokens":16,"messages":[{"role":"user","content":"test"}]}`
	if format == types.RelayFormatOpenAIResponses {
		requestPayload = `{"model":"gpt-4o-mini","stream":true,"input":"test"}`
	}
	request := func() *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, requestPath, strings.NewReader(requestPayload))
		req.Header.Set("Content-Type", "application/json")
		engine.ServeHTTP(recorder, req)
		return recorder
	}
	t.Setenv("CODING_PLAN_PAID_FALLBACK_GROUPS", "")
	first := request()
	require.Equal(t, http.StatusOK, first.Code, first.Body.String())
	assert.Contains(t, first.Body.String(), "hello")
	assert.NotContains(t, first.Body.String(), "QuotaExceeded")
	assert.Equal(t, []string{"plan-a", "plan-b"}, attempts)
	var logs []model.Log
	require.NoError(t, db.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, channels[2].Id, logs[0].ChannelId)
	var user model.User
	require.NoError(t, db.First(&user, 7).Error)
	assert.Equal(t, 1_000_000-logs[0].Quota, user.Quota)

	common.MemoryCacheEnabled = true
	model.InitChannelCache()
	planBExhausted = true
	exhausted := request()
	assert.Equal(t, http.StatusTooManyRequests, exhausted.Code, exhausted.Body.String())
	assert.Equal(t, []string{"plan-a", "plan-b", "plan-b"}, attempts)
	assert.Equal(t, http.StatusTooManyRequests, request().Code)
	t.Setenv("CODING_PLAN_PAID_FALLBACK_GROUPS", "default")
	paid := request()
	assert.Equal(t, http.StatusOK, paid.Code, paid.Body.String())
	assert.Equal(t, []string{"plan-a", "plan-b", "plan-b", "paid"}, attempts)
	require.NotEmpty(t, exhausted.Header().Get("Retry-After"))
	clearChannelInfo(&channels[1])
	require.NotNil(t, channels[1].CodingPlanStatus)
	assert.Equal(t, "exhausted", channels[1].CodingPlanStatus.State)
	if format != types.RelayFormatClaude {
		assert.Positive(t, channels[1].CodingPlanStatus.RetryAt)
	} else {
		assert.Zero(t, channels[1].CodingPlanStatus.RetryAt)
	}

	transientTag := tag + "/transient"
	extra := []model.Channel{
		{Name: "short limit", Key: "plan-transient", Tag: &transientTag, Priority: common.GetPointer(int64(50))},
		{Name: "short limit sibling", Key: "plan-transient-copy", Tag: &transientTag, Priority: common.GetPointer(int64(40))},
	}
	for i := range extra {
		ch := &extra[i]
		ch.Type, ch.BaseURL, ch.Group, ch.Models, ch.Status = constant.ChannelTypeVolcEngine, &plan, "default", modelName, common.ChannelStatusEnabled
		require.NoError(t, db.Create(ch).Error)
		require.NoError(t, ch.AddAbilities(db))
	}
	model.InitChannelCache()
	attempts = nil
	recovered := request()
	require.Equal(t, http.StatusOK, recovered.Code, recovered.Body.String())
	assert.Equal(t, []string{"plan-transient", "plan-transient-copy"}, attempts)
	blocked, _ := extra[0].CodingPlanChannelBlocked()
	assert.True(t, blocked)
	blocked, _ = model.CodingPlanBlocked(extra[0].CodingPlanPool())
	assert.False(t, blocked)
	clearChannelInfo(&extra[0])
	require.NotNil(t, extra[0].CodingPlanStatus)
	assert.Equal(t, "cooldown", extra[0].CodingPlanStatus.State)

	partialChannel := model.Channel{Name: "interrupted", Key: "plan-partial", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan,
		Tag: common.GetPointer(tag + "/partial"), Group: "default", Models: modelName, Status: common.ChannelStatusEnabled,
		Priority: common.GetPointer(int64(90))}
	require.NoError(t, db.Create(&partialChannel).Error)
	require.NoError(t, partialChannel.AddAbilities(db))
	model.InitChannelCache()
	attempts = nil
	interrupted := request()
	assert.Equal(t, http.StatusOK, interrupted.Code)
	assert.Contains(t, interrupted.Body.String(), "hello")
	assert.Contains(t, interrupted.Body.String(), quotaMessage)
	assert.Equal(t, []string{"plan-partial"}, attempts)
	require.NoError(t, db.Where("type = ? AND channel_id = ?", model.LogTypeConsume, partialChannel.Id).Find(&logs).Error)
	assert.Empty(t, logs)

	if format == types.RelayFormatOpenAIResponses {
		rejectedContinuation := partialChannel
		rejectedContinuation.Id = 0
		rejectedContinuation.Key = "plan-unavailable"
		rejectedContinuation.Tag = common.GetPointer(tag + "/stateful")
		require.NoError(t, db.Create(&rejectedContinuation).Error)
		require.NoError(t, rejectedContinuation.AddAbilities(db))
		model.InitChannelCache()
		requestPayload = `{"model":"gpt-4o-mini","stream":true,"input":"continue","previous_response_id":"resp_test"}`
		attempts = nil
		assert.Equal(t, http.StatusServiceUnavailable, request().Code)
		assert.Equal(t, []string{"plan-unavailable"}, attempts)
	}

	if plan != constant.VolcengineTokenPlanBaseURL || format != types.RelayFormatOpenAI {
		return
	}
	outage := model.Channel{Name: "outage", Key: "plan-unavailable", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan,
		Group: "default", Models: modelName, Status: common.ChannelStatusEnabled, Priority: common.GetPointer(int64(110))}
	require.NoError(t, db.Create(&outage).Error)
	require.NoError(t, outage.AddAbilities(db))
	for _, badKey := range []string{"plan-invalid", "plan-transient", "plan-a"} {
		multiKey := model.Channel{
			Name: "multiple keys", Key: badKey + "\nplan-healthy", Type: constant.ChannelTypeVolcEngine, BaseURL: &plan,
			Group: "default", Models: modelName, Status: common.ChannelStatusEnabled, Priority: common.GetPointer(int64(100)),
			ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling},
		}
		require.NoError(t, db.Create(&multiKey).Error)
		require.NoError(t, multiKey.AddAbilities(db))
		model.InitChannelCache()
		attempts = nil
		result := request()
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		switch badKey {
		case "plan-a":
			assert.Equal(t, []string{badKey, "plan-transient-copy"}, attempts)
			assert.Equal(t, "exhausted", multiKey.GetCodingPlanStatus().State)
		case "plan-invalid":
			assert.Equal(t, []string{"plan-unavailable", badKey, "plan-healthy"}, attempts)
			assert.Equal(t, "cooldown", outage.GetCodingPlanStatus().State)
		default:
			assert.Equal(t, []string{badKey, "plan-healthy"}, attempts)
			assert.Equal(t, "available", multiKey.GetCodingPlanStatus().State)
		}
		require.NoError(t, db.Model(&multiKey).Update("status", common.ChannelStatusManuallyDisabled).Error)
		require.NoError(t, multiKey.UpdateAbilities(nil))
	}

	for _, failure := range []struct {
		key      string
		status   int
		attempts []string
	}{
		{"plan-dial-failed", http.StatusOK, []string{"plan-dial-failed", "plan-transient-copy"}},
		{"plan-read-failed", http.StatusInternalServerError, []string{"plan-read-failed"}},
	} {
		route := model.Channel{Name: failure.key, Key: failure.key, Type: constant.ChannelTypeVolcEngine, BaseURL: &plan,
			Group: "default", Models: modelName, Status: common.ChannelStatusEnabled, Priority: common.GetPointer(int64(120))}
		require.NoError(t, db.Create(&route).Error)
		require.NoError(t, route.AddAbilities(db))
		model.InitChannelCache()
		attempts = nil
		assert.Equal(t, failure.status, request().Code)
		assert.Equal(t, failure.attempts, attempts)
	}
}

func TestCodingPlanRecoveryProbe(t *testing.T) {
	for _, shared := range []bool{false, true} {
		name := "memory"
		if shared {
			name = "redis"
		}
		t.Run(name, func(t *testing.T) {
			previousClient, previousEnabled := common.RDB, common.RedisEnabled
			common.RedisEnabled = false
			t.Cleanup(func() { common.RDB, common.RedisEnabled = previousClient, previousEnabled })
			if shared {
				address := os.Getenv("TEST_CODING_PLAN_REDIS_ADDR")
				if address == "" {
					t.Skip("TEST_CODING_PLAN_REDIS_ADDR is not configured")
				}
				client := redis.NewClient(&redis.Options{Addr: address})
				t.Cleanup(func() { assert.NoError(t, client.Close()) })
				require.NoError(t, client.Ping(t.Context()).Err())
				common.RDB, common.RedisEnabled = client, true
			}
			pool := t.Name() + "/" + strconv.FormatInt(time.Now().UnixNano(), 10)
			model.CoolDownCodingPlan(pool, time.Nanosecond)
			require.Eventually(t, func() bool { return model.GetCodingPlanStatus(pool).State == "recovering" }, time.Second, time.Millisecond)

			state, ok := model.AcquireCodingPlanProbe(t.Context(), pool)
			require.True(t, ok)
			require.NotEmpty(t, state)
			var admitted atomic.Int32
			var group sync.WaitGroup
			for range 8 {
				group.Go(func() {
					if _, allowed := model.AcquireCodingPlanProbe(context.Background(), pool); allowed {
						admitted.Add(1)
					}
				})
			}
			group.Wait()
			assert.Zero(t, admitted.Load())
			model.CompleteCodingPlanProbe(t.Context(), pool, state)
			require.Equal(t, "available", model.GetCodingPlanStatus(pool).State)
			_, ok = model.AcquireCodingPlanProbe(t.Context(), pool)
			assert.True(t, ok)
		})
	}
}
