package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestFormatUserLogsRemovesErrorDebugFields(t *testing.T) {
	logs := []*Log{
		{
			Id:          99,
			Type:        LogTypeError,
			Content:     "status_code=400, upstream rejected Authorization:*** api_key=*** channel #2 relay=openai key_hint=abc key_fp=def",
			ChannelId:   12,
			ChannelName: "secret-channel",
			TokenId:     34,
			TokenName:   "user-token",
			ModelName:   "gpt-test",
			Group:       "default",
			Quota:       10,
			Other: common.MapToJsonStr(map[string]interface{}{
				"request_path":         "/v1/chat/completions",
				"request_method":       "POST",
				"status_code":          400,
				"error_type":           "openai_error",
				"error_code":           "bad_request",
				"error_source":         "upstream",
				"admin_info":           map[string]interface{}{"use_channel": []string{"1", "2"}},
				"channel_id":           1,
				"channel_name":         "secret-channel",
				"channel_type":         1,
				"original_model_name":  "user-model",
				"final_model_name":     "upstream-model",
				"upstream_model_name":  "provider-model",
				"is_model_mapped":      true,
				"request_conversion":   []string{"openai", "claude"},
				"relay_mode":           "chat_completions",
				"relay_mode_id":        1,
				"relay_format":         "openai",
				"final_relay_format":   "claude",
				"retry_count":          1,
				"key_hint":             "secret-key-hint",
				"key_fp":               "secret-key-fp",
				"multi_key_index":      1,
				"upstream_error":       map[string]interface{}{"message": "masked upstream error"},
				"upstream_status_code": 400,
				"last_error_summary":   "masked upstream error",
				"stream_status":        map[string]interface{}{"status": "error"},
			}),
		},
	}

	userLogs := formatUserLogs(logs, 0)

	require.Len(t, userLogs, 1)
	require.Equal(t, 1, userLogs[0].Id)
	require.Equal(t, "user-token", userLogs[0].TokenName)
	require.Equal(t, "gpt-test", userLogs[0].ModelName)
	require.Equal(t, "default", userLogs[0].Group)
	require.Equal(t, 10, userLogs[0].Quota)
	require.Equal(t, "status_code=400", userLogs[0].Content)

	body, err := common.Marshal(userLogs[0])
	require.NoError(t, err)
	bodyText := string(body)
	for _, disallowed := range []string{
		`"channel"`,
		`"channel_name"`,
		`"token_id"`,
		"Authorization",
		"api_key",
		"channel #2",
		"upstream",
		"relay",
		"key_hint",
		"key_fp",
	} {
		require.NotContains(t, bodyText, disallowed)
	}

	other, err := common.StrToMap(userLogs[0].Other)
	require.NoError(t, err)
	require.Equal(t, float64(400), other["status_code"])
	require.Equal(t, "openai_error", other["error_type"])
	require.Equal(t, "bad_request", other["error_code"])
	require.Len(t, other, 3)
	require.NotContains(t, other, "request_path")
	require.NotContains(t, other, "request_method")
	require.NotContains(t, other, "error_source")
	require.NotContains(t, other, "admin_info")
	require.NotContains(t, other, "channel_id")
	require.NotContains(t, other, "channel_name")
	require.NotContains(t, other, "channel_type")
	require.NotContains(t, other, "original_model_name")
	require.NotContains(t, other, "final_model_name")
	require.NotContains(t, other, "upstream_model_name")
	require.NotContains(t, other, "is_model_mapped")
	require.NotContains(t, other, "request_conversion")
	require.NotContains(t, other, "relay_mode")
	require.NotContains(t, other, "relay_mode_id")
	require.NotContains(t, other, "relay_format")
	require.NotContains(t, other, "final_relay_format")
	require.NotContains(t, other, "retry_count")
	require.NotContains(t, other, "key_hint")
	require.NotContains(t, other, "key_fp")
	require.NotContains(t, other, "multi_key_index")
	require.NotContains(t, other, "upstream_error")
	require.NotContains(t, other, "upstream_status_code")
	require.NotContains(t, other, "last_error_summary")
	require.NotContains(t, other, "stream_status")
}

func TestFormatUserLogsNormalizesSensitiveErrorOtherValues(t *testing.T) {
	logs := []*Log{
		{
			Type:    LogTypeError,
			Content: "plain failure",
			Other: common.MapToJsonStr(map[string]interface{}{
				"status_code": 502,
				"error_type":  "upstream_error",
				"error_code":  "channel_unavailable",
			}),
		},
	}

	userLogs := formatUserLogs(logs, 0)

	other, err := common.StrToMap(userLogs[0].Other)
	require.NoError(t, err)
	require.Equal(t, float64(502), other["status_code"])
	require.Equal(t, "request_error", other["error_type"])
	require.Equal(t, "request_error", other["error_code"])
}

func TestFormatUserLogsPreservesUserOwnedConsumeFields(t *testing.T) {
	logs := []*Log{
		{
			Id:               100,
			UserId:           7,
			Type:             LogTypeConsume,
			Content:          "ok",
			Username:         "alice",
			TokenName:        "my-token",
			TokenId:          88,
			ModelName:        "gpt-test",
			Quota:            123,
			PromptTokens:     10,
			CompletionTokens: 20,
			UseTime:          3,
			IsStream:         true,
			ChannelId:        9,
			ChannelName:      "secret-channel",
			Group:            "vip",
			Ip:               "127.0.0.1",
			RequestId:        "req-test",
			Other: common.MapToJsonStr(map[string]interface{}{
				"model_ratio":         1.5,
				"completion_ratio":    1,
				"admin_info":          map[string]interface{}{"use_channel": []string{"9"}},
				"upstream_model_name": "provider-model",
				"key_hint":            "secret-key-hint",
				"nested": map[string]interface{}{
					"channel_id":  9,
					"key-fp":      "nested-key-fp",
					"api_key":     "nested-api-key",
					"secret":      "nested-secret",
					"retry_chain": []interface{}{"9", "10"},
					"safe":        "keep",
				},
			}),
		},
	}

	userLogs := formatUserLogs(logs, 5)

	require.Len(t, userLogs, 1)
	userLog := userLogs[0]
	require.Equal(t, 6, userLog.Id)
	require.Equal(t, 7, userLog.UserId)
	require.Equal(t, "alice", userLog.Username)
	require.Equal(t, "my-token", userLog.TokenName)
	require.Equal(t, "gpt-test", userLog.ModelName)
	require.Equal(t, 123, userLog.Quota)
	require.Equal(t, 10, userLog.PromptTokens)
	require.Equal(t, 20, userLog.CompletionTokens)
	require.Equal(t, 3, userLog.UseTime)
	require.True(t, userLog.IsStream)
	require.Equal(t, "vip", userLog.Group)
	require.Equal(t, "127.0.0.1", userLog.Ip)
	require.Equal(t, "req-test", userLog.RequestId)

	body, err := common.Marshal(userLog)
	require.NoError(t, err)
	bodyText := string(body)
	require.NotContains(t, bodyText, `"channel"`)
	require.NotContains(t, bodyText, `"channel_name"`)
	require.NotContains(t, bodyText, `"token_id"`)
	require.NotContains(t, bodyText, "secret-channel")
	require.NotContains(t, bodyText, "provider-model")
	require.NotContains(t, bodyText, "secret-key-hint")
	require.NotContains(t, bodyText, "nested-api-key")
	require.NotContains(t, bodyText, "nested-secret")

	other, err := common.StrToMap(userLog.Other)
	require.NoError(t, err)
	require.Equal(t, 1.5, other["model_ratio"])
	require.Equal(t, float64(1), other["completion_ratio"])
	require.NotContains(t, other, "admin_info")
	require.NotContains(t, other, "upstream_model_name")
	require.NotContains(t, other, "key_hint")
	nested, ok := other["nested"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "keep", nested["safe"])
	require.NotContains(t, nested, "channel_id")
	require.NotContains(t, nested, "key-fp")
	require.NotContains(t, nested, "api_key")
	require.NotContains(t, nested, "secret")
	require.NotContains(t, nested, "retry_chain")
}

func TestUserLogContentLeavesPlainErrorMessage(t *testing.T) {
	log := &Log{
		Type:    LogTypeError,
		Content: "context length exceeded",
	}

	require.Equal(t, "context length exceeded", userLogContent(log))
}

func TestUserLogContentFallsBackWhenSensitiveWordsRemain(t *testing.T) {
	log := &Log{
		Type:    LogTypeError,
		Content: "upstream failed through relay channel with key_fp=abc",
		Other:   common.MapToJsonStr(map[string]interface{}{"status_code": 503}),
	}

	content := userLogContent(log)

	require.Equal(t, "status_code=503", content)
	require.False(t, strings.Contains(strings.ToLower(content), "upstream"))
	require.False(t, strings.Contains(strings.ToLower(content), "relay"))
	require.False(t, strings.Contains(strings.ToLower(content), "channel"))
	require.False(t, strings.Contains(strings.ToLower(content), "key_fp"))
}

func TestUserLogContentFallsBackForChineseInternalTerms(t *testing.T) {
	log := &Log{
		Type:    LogTypeError,
		Content: "上游渠道密钥失败",
		Other:   common.MapToJsonStr(map[string]interface{}{"status_code": 502}),
	}

	require.Equal(t, "status_code=502", userLogContent(log))
}
