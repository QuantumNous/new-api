package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestOpenAIReasoningFallbackLearnsConversationAndRemovesAllEncryptedContent(t *testing.T) {
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
	})

	input := []byte(`[
		{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]},
		{"type":"reasoning","summary":[],"encrypted_content":"conversation-a-first"},
		{"type":"reasoning","summary":[{"type":"summary_text","text":"keep"}],"encrypted_content":"conversation-a-second"},
		{"type":"custom","encrypted_content":"not-reasoning"}
	]`)

	firstContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	unchanged, removed, err := PrepareOpenAIResponsesReasoningInput(firstContext, input)
	require.NoError(t, err)
	assert.Zero(t, removed)
	assert.JSONEq(t, string(input), string(unchanged))
	require.NotEmpty(t, firstContext.GetString(ginKeyOpenAIReasoningEncryptedContentHash))

	require.True(t, MarkOpenAIReasoningSignatureInvalid(firstContext))
	require.False(t, MarkOpenAIReasoningSignatureInvalid(firstContext), "only one immediate retry is allowed")
	retried, removed, err := PrepareOpenAIResponsesReasoningInput(firstContext, input)
	require.NoError(t, err)
	assert.Equal(t, 2, removed)
	assert.False(t, gjson.GetBytes(retried, "1.encrypted_content").Exists())
	assert.False(t, gjson.GetBytes(retried, "2.encrypted_content").Exists())
	assert.Equal(t, "keep", gjson.GetBytes(retried, "2.summary.0.text").String())
	assert.Equal(t, "not-reasoning", gjson.GetBytes(retried, "3.encrypted_content").String())

	nextContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	nextRequest, removed, err := PrepareOpenAIResponsesReasoningInput(nextContext, input)
	require.NoError(t, err)
	assert.Equal(t, 2, removed, "a later request should hit the learned conversation cache")
	assert.False(t, gjson.GetBytes(nextRequest, "1.encrypted_content").Exists())
	assert.False(t, gjson.GetBytes(nextRequest, "2.encrypted_content").Exists())
	assert.False(t, MarkOpenAIReasoningSignatureInvalid(nextContext), "a cache-hit request already applied the fallback")
}

func TestOpenAIReasoningFallbackUsesFirstEncryptedContentAsConversationKey(t *testing.T) {
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
	})

	learnedInput := []byte(`[
		{"type":"reasoning","encrypted_content":"conversation-b-first"},
		{"type":"reasoning","encrypted_content":"shared-later-item"}
	]`)
	learnContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	_, _, err := PrepareOpenAIResponsesReasoningInput(learnContext, learnedInput)
	require.NoError(t, err)
	require.True(t, MarkOpenAIReasoningSignatureInvalid(learnContext))

	differentFirstItem := []byte(`[
		{"type":"reasoning","encrypted_content":"conversation-c-first"},
		{"type":"reasoning","encrypted_content":"shared-later-item"}
	]`)
	requestContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	result, removed, err := PrepareOpenAIResponsesReasoningInput(requestContext, differentFirstItem)
	require.NoError(t, err)
	assert.Zero(t, removed)
	assert.JSONEq(t, string(differentFirstItem), string(result))
}

func TestOpenAIReasoningFallbackIgnoresInputsWithoutEncryptedReasoning(t *testing.T) {
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	input := []byte(`[{"type":"message","role":"user"},{"type":"reasoning","summary":[]}]`)

	result, removed, err := PrepareOpenAIResponsesReasoningInput(ctx, input)
	require.NoError(t, err)
	assert.Zero(t, removed)
	assert.JSONEq(t, string(input), string(result))
	assert.False(t, MarkOpenAIReasoningSignatureInvalid(ctx))
}
