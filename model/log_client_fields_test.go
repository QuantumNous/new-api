package model

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecordConsumeLogStoresClientHeaders(t *testing.T) {
	truncateTables(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("username", "tester")
	ctx.Set(common.RequestIdKey, "oneapi-req-1")
	ctx.Request.Header.Set(common.ClientRequestIdHeader, "xcw-req-1")
	ctx.Request.Header.Set(common.ClientConversationIdHeader, "conv-1")
	ctx.Request.Header.Set(common.ClientPresetIdHeader, "preset-roleplay")
	ctx.Request.Header.Set(common.ClientTaskNameHeader, "chat")
	ctx.Request.Header.Set(common.ClientCallIdHeader, "call-1")
	ctx.Request.Header.Set(common.ClientServiceNameHeader, "xcw-chat-service")

	RecordConsumeLog(ctx, 42, RecordConsumeLogParams{
		ChannelId:        7,
		PromptTokens:     11,
		CompletionTokens: 13,
		ModelName:        "gpt-test",
		TokenName:        "test-token",
		Quota:            99,
		Content:          "consume",
		TokenId:          3,
		UseTimeSeconds:   2,
		IsStream:         false,
		Group:            "default",
	})

	var log Log
	require.NoError(t, LOG_DB.Order("id desc").First(&log).Error)
	assert.Equal(t, "oneapi-req-1", log.RequestId)
	assert.Equal(t, "xcw-req-1", log.ClientRequestId)
	assert.Equal(t, "conv-1", log.ClientConversationId)
	assert.Equal(t, "preset-roleplay", log.ClientPresetId)
	assert.Equal(t, "chat", log.ClientTaskName)
	assert.Equal(t, "call-1", log.ClientCallId)
	assert.Equal(t, "xcw-chat-service", log.ClientServiceName)
}

func TestRecordErrorLogStoresClientHeaders(t *testing.T) {
	truncateTables(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("username", "tester")
	ctx.Set(common.RequestIdKey, "oneapi-req-2")
	ctx.Request.Header.Set(common.ClientRequestIdHeader, "xcw-req-2")
	ctx.Request.Header.Set(common.ClientConversationIdHeader, "conv-2")
	ctx.Request.Header.Set(common.ClientPresetIdHeader, "preset-summary")
	ctx.Request.Header.Set(common.ClientTaskNameHeader, "summary_event")
	ctx.Request.Header.Set(common.ClientCallIdHeader, "call-2")
	ctx.Request.Header.Set(common.ClientServiceNameHeader, "xcw-chat-service")

	RecordErrorLog(ctx, 24, 8, "gpt-test", "test-token", "boom", 4, 3, false, "default", map[string]interface{}{
		"reason": "upstream_error",
	})

	var log Log
	require.NoError(t, LOG_DB.Order("id desc").First(&log).Error)
	assert.Equal(t, LogTypeError, log.Type)
	assert.Equal(t, "oneapi-req-2", log.RequestId)
	assert.Equal(t, "xcw-req-2", log.ClientRequestId)
	assert.Equal(t, "conv-2", log.ClientConversationId)
	assert.Equal(t, "preset-summary", log.ClientPresetId)
	assert.Equal(t, "summary_event", log.ClientTaskName)
	assert.Equal(t, "call-2", log.ClientCallId)
	assert.Equal(t, "xcw-chat-service", log.ClientServiceName)
}
