package model

import (
	"context"
	"errors"
	"io"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type panicReadCloser struct {
	readCalled bool
}

func (p *panicReadCloser) Read(_ []byte) (int, error) {
	p.readCalled = true
	return 0, errors.New("body should not be read")
}

func (p *panicReadCloser) Close() error {
	return nil
}

func configureRequestSamplingForTest(t *testing.T, enabled bool, rate float64, groups []string) {
	t.Helper()
	original := operation_setting.GetLogRequestSamplingSetting()
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.Enabled = enabled
		setting.SampleRate = rate
		setting.Groups = append([]string(nil), groups...)
	})
	t.Cleanup(func() {
		operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
			*setting = original
		})
	})

	oldRunner := logRequestSampleAsyncRunner
	oldRandom := logRequestSampleRandomFloat
	logRequestSampleAsyncRunner = func(fn func()) {
		fn()
	}
	logRequestSampleRandomFloat = func() float64 {
		return 0
	}
	t.Cleanup(func() {
		logRequestSampleAsyncRunner = oldRunner
		logRequestSampleRandomFloat = oldRandom
	})
}

func newRequestSamplingContext(method string, path string, body io.Reader) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(method, path, body)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("username", "sample-user")
	c.Set(common.RequestIdKey, "req_sample_1")
	common.SetContextKey(c, constant.ContextKeyRequestSamplingEligible, true)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "plg")
	return c
}

func countRequestSamples(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, LOG_DB.Model(&LogRequestSample{}).Count(&count).Error)
	return count
}

func TestRecordConsumeLogRequestSamplingDisabledDoesNotReadBody(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, false, 1, []string{"plg"})
	body := &panicReadCloser{}
	c := newRequestSamplingContext("POST", "/v1/chat/completions", body)
	c.Request.Body = body

	RecordConsumeLog(c, 123, RecordConsumeLogParams{
		ModelName:      "gpt-4o",
		TokenName:      "api-token",
		TokenId:        9,
		UseTimeSeconds: 1,
		Group:          "enterprise",
		Other:          map[string]interface{}{"note": "keep"},
	})

	if body.readCalled {
		t.Fatal("disabled sampling path read request body")
	}
	require.Equal(t, int64(0), countRequestSamples(t))
}

func TestRecordConsumeLogRequestSamplingWritesRedactedSampleForEligiblePLG(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.AllowTextContentStorage = true
	})
	body := strings.NewReader(`{
		"model":"gpt-4o",
		"messages":[{"role":"user","content":"hello"}],
		"headers":[{"Name":"Authorization","Value":"opaque-token"}],
		"inline_data":{"mime_type":"image/png","data":"QUJD"},
		"inlineData":{"mimeType":"audio/wav","data":"REVG"},
		"api_key":"sk-secret",
		"x-api-key":"AIzaSyA000000000000000000000000000000",
		"proxy-authorization":"Bearer plain-oauth-token-value",
		"aws_key":"AKIAABCDEFGHIJKLMNOP",
		"private-key":"BEGIN PRIVATE KEY",
		"accessToken":"opaque-access-token",
		"clientSecret":"plain-client-secret",
		"privateKey":"plain-private-key",
		"old_password":"plain-old-password",
		"user_password":"plain-user-password",
		"current-password":"plain-current-password",
		"cookie":"sid=secret",
		"session_id":"session-secret",
		"service_credentials":"credential-secret",
		"note":"Authorization Bearer abcdefghijklmnop and jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
		"url":"https://user:pass@example.com/path?token=abc&safe=ok",
		"image_url":"data:image/png;base64,AAAA"
	}`)
	c := newRequestSamplingContext("POST", "/v1/chat/completions", body)

	RecordConsumeLog(c, 123, RecordConsumeLogParams{
		ModelName:        "gpt-4o",
		TokenName:        "api-token",
		TokenId:          9,
		PromptTokens:     3,
		CompletionTokens: 4,
		UseTimeSeconds:   1,
		Group:            "plg",
		Other:            map[string]interface{}{"note": "keep"},
	})

	var log Log
	require.NoError(t, LOG_DB.First(&log).Error)
	require.NotZero(t, log.Id)
	require.NotContains(t, log.Other, "hello")

	var sample LogRequestSample
	require.NoError(t, LOG_DB.Where("log_id = ?", log.Id).First(&sample).Error)
	require.Equal(t, log.Id, sample.LogId)
	require.Equal(t, "req_sample_1", sample.RequestId)
	require.Equal(t, 123, sample.UserId)
	require.Equal(t, 9, sample.TokenId)
	require.Equal(t, "plg", sample.UserGroup)
	require.Equal(t, "/v1/chat/completions", sample.RequestPath)
	require.Equal(t, "gpt-4o", sample.ModelName)
	require.NotZero(t, sample.RequestBodySize)
	require.Equal(t, 1.0, sample.SampleRate)
	require.NotEmpty(t, sample.RedactionVersion)

	var payload map[string]interface{}
	require.NoError(t, common.Unmarshal([]byte(sample.RequestParams), &payload))
	require.Equal(t, "[redacted]", payload["api_key"])
	require.Equal(t, "[redacted]", payload["x-api-key"])
	require.Equal(t, "[redacted]", payload["proxy-authorization"])
	require.Equal(t, "[redacted]", payload["private-key"])
	require.Equal(t, "[redacted]", payload["accessToken"])
	require.Equal(t, "[redacted]", payload["clientSecret"])
	require.Equal(t, "[redacted]", payload["privateKey"])
	require.Equal(t, "[redacted]", payload["old_password"])
	require.Equal(t, "[redacted]", payload["user_password"])
	require.Equal(t, "[redacted]", payload["current-password"])
	require.Equal(t, "[redacted]", payload["cookie"])
	require.Equal(t, "[redacted]", payload["session_id"])
	require.Equal(t, "[redacted]", payload["service_credentials"])
	require.Contains(t, sample.RequestParams, "hello")
	require.NotContains(t, sample.RequestParams, "opaque-token")
	require.NotContains(t, sample.RequestParams, `"data":"QUJD"`)
	require.NotContains(t, sample.RequestParams, `"data":"REVG"`)
	require.Contains(t, sample.RequestParams, `"data":"[dropped]"`)
	require.NotContains(t, sample.RequestParams, "sk-secret")
	require.NotContains(t, sample.RequestParams, "AIza")
	require.NotContains(t, sample.RequestParams, "AKIA")
	require.NotContains(t, sample.RequestParams, "plain-oauth-token-value")
	require.NotContains(t, sample.RequestParams, "BEGIN PRIVATE KEY")
	require.NotContains(t, sample.RequestParams, "opaque-access-token")
	require.NotContains(t, sample.RequestParams, "plain-client-secret")
	require.NotContains(t, sample.RequestParams, "plain-private-key")
	require.NotContains(t, sample.RequestParams, "plain-old-password")
	require.NotContains(t, sample.RequestParams, "plain-user-password")
	require.NotContains(t, sample.RequestParams, "plain-current-password")
	require.NotContains(t, sample.RequestParams, "sid=secret")
	require.NotContains(t, sample.RequestParams, "session-secret")
	require.NotContains(t, sample.RequestParams, "credential-secret")
	require.NotContains(t, sample.RequestParams, "abcdefghijklmnop")
	require.NotContains(t, sample.RequestParams, "eyJhbGci")
	require.NotContains(t, sample.RequestParams, "user:pass")
	require.NotContains(t, sample.RequestParams, "token=abc")
	require.NotContains(t, sample.RequestParams, "example.com")
	require.NotContains(t, sample.RequestParams, "safe=ok")
	require.NotContains(t, sample.RequestParams, "data:image/png;base64")
}

func TestRecordConsumeLogRequestSamplingUsesLoggedGroupForEligibility(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})

	c := newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
	common.SetContextKey(c, constant.ContextKeyUserGroup, "root")
	RecordConsumeLog(c, 123, RecordConsumeLogParams{
		ModelName: "gpt-4o",
		TokenId:   9,
		Group:     "plg",
		Other:     map[string]interface{}{},
	})

	var sample LogRequestSample
	require.NoError(t, LOG_DB.First(&sample).Error)
	require.Equal(t, "plg", sample.UserGroup)

	c = newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
	common.SetContextKey(c, constant.ContextKeyUserGroup, "plg")
	RecordConsumeLog(c, 123, RecordConsumeLogParams{
		ModelName: "gpt-4o",
		TokenId:   9,
		Group:     "enterprise",
		Other:     map[string]interface{}{},
	})

	require.Equal(t, int64(1), countRequestSamples(t))
}

func TestRecordConsumeLogRequestSamplingCanRedactTextContent(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.AllowTextContentStorage = false
	})
	body := strings.NewReader(`{
		"model":"gpt-4o",
		"messages":[{"role":"user","content":"private prompt"}],
		"contents":[{"parts":[{"text":"private gemini text"}]}],
		"parts":[{"text":"private nested text"}],
		"data":[{"type":"input_text","text":"private data text"}],
		"texts":"private texts",
		"tool_calls":[{"function":{"arguments":"private tool args"}}],
		"metadata":{"customer":"private metadata"},
		"input":"private input",
		"prompt":"private prompt field",
		"temperature":0.2
	}`)
	c := newRequestSamplingContext("POST", "/v1/chat/completions", body)

	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{}})

	var sample LogRequestSample
	require.NoError(t, LOG_DB.First(&sample).Error)
	require.Contains(t, sample.RequestParams, `"messages":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"contents":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"arguments":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"metadata":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"input":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"prompt":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"texts":"[redacted]"`)
	require.Contains(t, sample.RequestParams, `"temperature":0.2`)
	require.NotContains(t, sample.RequestParams, "private prompt")
	require.NotContains(t, sample.RequestParams, "private gemini text")
	require.NotContains(t, sample.RequestParams, "private nested text")
	require.NotContains(t, sample.RequestParams, "private data text")
	require.NotContains(t, sample.RequestParams, "private texts")
	require.NotContains(t, sample.RequestParams, "private input")
	require.NotContains(t, sample.RequestParams, "private tool args")
	require.NotContains(t, sample.RequestParams, "private metadata")
}

func TestSanitizeLogRequestSampleBodyCapsStoredJSON(t *testing.T) {
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.AllowTextContentStorage = true
		setting.MaxBodyBytes = operation_setting.MaxLogRequestSamplingBodyBytes
		setting.MaxStringBytes = operation_setting.MaxLogRequestSamplingMaxStringBytes
	})
	snapshot := operation_setting.GetLogRequestSamplingRuntimeSnapshot()
	parts := make([]string, 0, 80)
	for i := 0; i < 80; i++ {
		parts = append(parts, `"field`+strconv.Itoa(i)+`":"`+strings.Repeat(`\"`, 900)+`"`)
	}
	body := []byte(`{` + strings.Join(parts, ",") + `}`)

	params, err := sanitizeLogRequestSampleBody(body, snapshot)
	require.NoError(t, err)
	require.LessOrEqual(t, len(params), maxLogRequestSampleParamsBytes)
	require.Contains(t, params, `"_truncated":true`)
	require.Contains(t, params, `"_sanitized_bytes":`)
}

func TestRecordConsumeLogRequestSamplingSkipsNonMatchingGroupInvalidJSONAndViolationFee(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})

	c := newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
	common.SetContextKey(c, constant.ContextKeyUserGroup, "enterprise")
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{}})

	c = newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{bad json`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{}})

	c = newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{"violation_fee": true}})

	c = newRequestSamplingContext("POST", "/v1/chat/completions", strings.NewReader(`{"messages":[{"content":"hi"}]}`))
	c.Request.Header.Set("Content-Type", "text/plain")
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{}})

	require.Equal(t, int64(0), countRequestSamples(t))
}

func TestRecordConsumeLogRequestSamplingSkipsGeminiNonTextActions(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})

	c := newRequestSamplingContext("POST", "/v1beta/models/gemini-2.5-pro:embedContent", strings.NewReader(`{"content":{"parts":[{"text":"hi"}]}}`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gemini-2.5-pro", Other: map[string]interface{}{}})
	require.Equal(t, int64(0), countRequestSamples(t))

	c = newRequestSamplingContext("POST", "/v1beta/models/gemini-2.5-pro:generateContent", strings.NewReader(`{"contents":[{"parts":[{"text":"hi"}]}]}`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gemini-2.5-pro", Other: map[string]interface{}{}})
	require.Equal(t, int64(1), countRequestSamples(t))

	c = newRequestSamplingContext("POST", "/v1/models/gemini-2.5-pro:embedContent", strings.NewReader(`{"content":{"parts":[{"text":"hi"}]}}`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gemini-2.5-pro", Other: map[string]interface{}{}})
	require.Equal(t, int64(1), countRequestSamples(t))

	c = newRequestSamplingContext("POST", "/v1/models/gemini-2.5-pro:generateContent", strings.NewReader(`{"contents":[{"parts":[{"text":"hi"}]}]}`))
	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gemini-2.5-pro", Other: map[string]interface{}{}})
	require.Equal(t, int64(2), countRequestSamples(t))
}

func TestRecordConsumeLogRequestSamplingRestoresBodyPosition(t *testing.T) {
	truncateTables(t)
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})
	c := newRequestSamplingContext("POST", "/v1/responses", strings.NewReader(`{"input":"hello"}`))

	RecordConsumeLog(c, 123, RecordConsumeLogParams{ModelName: "gpt-4o", Other: map[string]interface{}{}})

	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	body, err := storage.Bytes()
	require.NoError(t, err)
	require.JSONEq(t, `{"input":"hello"}`, string(body))
	pos, err := storage.Seek(0, io.SeekCurrent)
	require.NoError(t, err)
	require.Equal(t, int64(0), pos)
}

func TestInsertLogRequestSampleSkipsMissingLog(t *testing.T) {
	truncateTables(t)
	err := insertLogRequestSample(context.Background(), LogRequestSample{
		LogId:         999,
		CreatedAt:     time.Now().Unix(),
		RequestParams: `{}`,
	})
	require.NoError(t, err)
	require.Equal(t, int64(0), countRequestSamples(t))
}

func TestListLogRequestSamplesFiltersAndOrders(t *testing.T) {
	truncateTables(t)
	samples := []LogRequestSample{
		{LogId: 1, UserId: 100, CreatedAt: 100, ModelName: "gpt-4o", TokenId: 9, UserGroup: "plg", RequestPath: "/v1/chat/completions", RequestId: "req-a", RequestParams: `{"a":1}`},
		{LogId: 2, UserId: 100, CreatedAt: 200, ModelName: "gpt-4o", TokenId: 9, UserGroup: "plg", RequestPath: "/v1/chat/completions", RequestId: "req-b", RequestParams: `{"b":2}`},
		{LogId: 3, UserId: 200, CreatedAt: 300, ModelName: "claude-3-5-sonnet", TokenId: 10, UserGroup: "default", RequestPath: "/v1/messages", RequestId: "req-c", RequestParams: `{"c":3}`},
	}
	require.NoError(t, LOG_DB.Create(&samples).Error)

	items, total, err := ListLogRequestSamples(LogRequestSampleQuery{
		UserId:         100,
		StartTimestamp: 50,
		EndTimestamp:   250,
		ModelName:      "gpt-4o",
		TokenId:        9,
		UserGroup:      "plg",
		RequestPath:    "/v1/chat/completions",
	}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, items, 2)
	require.Equal(t, 2, items[0].LogId)
	require.Equal(t, 1, items[1].LogId)

	items, total, err = ListLogRequestSamples(LogRequestSampleQuery{LogId: 1}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, "req-a", items[0].RequestId)

	items, total, err = ListLogRequestSamples(LogRequestSampleQuery{RequestId: "req-b"}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, 2, items[0].LogId)
}

func TestListLogRequestSamplesClampsPagination(t *testing.T) {
	truncateTables(t)
	samples := make([]LogRequestSample, 0, 101)
	for i := 1; i <= 101; i++ {
		samples = append(samples, LogRequestSample{
			LogId:         i,
			UserId:        100,
			CreatedAt:     int64(i),
			RequestParams: `{}`,
		})
	}
	require.NoError(t, LOG_DB.Create(&samples).Error)

	items, total, err := ListLogRequestSamples(LogRequestSampleQuery{UserId: 100}, -50, -1)
	require.NoError(t, err)
	require.Equal(t, int64(101), total)
	require.Len(t, items, 100)
	require.Equal(t, 101, items[0].LogId)
	require.Equal(t, 2, items[99].LogId)
}

func TestSanitizeLogRequestSampleStringTruncatesAtUTF8Boundary(t *testing.T) {
	configureRequestSamplingForTest(t, true, 1, []string{"plg"})
	operation_setting.UpdateLogRequestSamplingSetting(func(setting *operation_setting.LogRequestSamplingSetting) {
		setting.AllowTextContentStorage = true
		setting.MaxStringBytes = 5
	})
	snapshot := operation_setting.GetLogRequestSamplingRuntimeSnapshot()

	got := sanitizeLogRequestSampleString("note", "你好🙂abc", snapshot)

	require.True(t, utf8.ValidString(got), "truncated sample string must remain valid UTF-8: %q", got)
	require.NotContains(t, got, "\uFFFD")
	require.Equal(t, "你"+truncatedSuffix, got)
}

func TestDeleteOldLogLeavesRequestSamplesUntouched(t *testing.T) {
	truncateTables(t)
	require.NoError(t, LOG_DB.Create(&Log{Id: 1, CreatedAt: 100, Type: LogTypeConsume}).Error)
	require.NoError(t, LOG_DB.Create(&Log{Id: 2, CreatedAt: 300, Type: LogTypeConsume}).Error)
	require.NoError(t, LOG_DB.Create(&LogRequestSample{LogId: 1, CreatedAt: 100, RequestParams: `{}`}).Error)
	require.NoError(t, LOG_DB.Create(&LogRequestSample{LogId: 2, CreatedAt: 300, RequestParams: `{}`}).Error)

	deleted, err := DeleteOldLog(t.Context(), 200, 100)
	require.NoError(t, err)
	require.Equal(t, int64(1), deleted)

	var oldSampleCount int64
	require.NoError(t, LOG_DB.Model(&LogRequestSample{}).Where("log_id = ?", 1).Count(&oldSampleCount).Error)
	require.Equal(t, int64(1), oldSampleCount)
	require.Equal(t, int64(2), countRequestSamples(t))
}
