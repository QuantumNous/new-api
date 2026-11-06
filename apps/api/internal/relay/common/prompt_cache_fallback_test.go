package common

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func promptCacheKeyRequest() *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{Model: "gpt-4o"}
}

func TestFallbackPromptCacheAfterRejectionUndoesAndSuppresses(t *testing.T) {
	useTestRedis(t)
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := promptCacheKeyRequest()
	undo := MaybeInjectOpenAIPromptCacheKey(ctx, info, request)
	require.NotNil(t, undo)
	require.NotEmpty(t, request.PromptCacheKey)

	rejection := types.NewOpenAIError(
		errors.New(`bad response status code 400, body: {"error":{"message":"Unknown parameter: 'prompt_cache_key'."}}`),
		types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	require.True(t, FallbackPromptCacheAfterRejection(ctx, info, undo, PromptCacheFieldPromptCacheKey, rejection))
	assert.Empty(t, request.PromptCacheKey)

	// The same client request must not inject again on a later attempt.
	second := promptCacheKeyRequest()
	assert.Nil(t, MaybeInjectOpenAIPromptCacheKey(ctx, info, second))
	assert.Empty(t, second.PromptCacheKey)
}

func TestFallbackPromptCacheAfterRejectionIgnoresUnrelatedFailures(t *testing.T) {
	useTestRedis(t)
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	ctx := newPromptCacheContext(t, body)
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := promptCacheKeyRequest()
	undo := MaybeInjectOpenAIPromptCacheKey(ctx, info, request)
	require.NotNil(t, undo)

	unrelated := types.NewOpenAIError(
		errors.New(`bad response status code 400, body: {"error":{"message":"max_tokens must be positive"}}`),
		types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	assert.False(t, FallbackPromptCacheAfterRejection(ctx, info, undo, PromptCacheFieldPromptCacheKey, unrelated))
	assert.NotEmpty(t, request.PromptCacheKey)

	serverError := types.NewOpenAIError(
		errors.New("upstream timeout while routing prompt_cache_key"),
		types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	assert.False(t, FallbackPromptCacheAfterRejection(ctx, info, undo, PromptCacheFieldPromptCacheKey, serverError))
	assert.NotEmpty(t, request.PromptCacheKey)
}

func TestPromptCacheRejectionMarkerSuppressesLaterRequests(t *testing.T) {
	server := useTestRedis(t)
	body := `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`
	info := newPromptCacheRelayInfo("gpt-4o")
	info.ChannelOtherSettings.AutoPromptCacheKey = true

	request := promptCacheKeyRequest()
	undo := MaybeInjectOpenAIPromptCacheKey(newPromptCacheContext(t, body), info, request)
	require.NotNil(t, undo)
	rejection := types.NewOpenAIError(
		errors.New(`bad response status code 400, message: Unknown parameter: 'prompt_cache_key'.`),
		types.ErrorCodeInvalidRequest, http.StatusBadRequest)
	require.True(t, FallbackPromptCacheAfterRejection(newPromptCacheContext(t, body), info, undo, PromptCacheFieldPromptCacheKey, rejection))
	require.Contains(t, server.Keys(), "cache:reject:42")

	// A brand-new client request on the same channel reads the marker and
	// stays unmarked until it expires.
	next := promptCacheKeyRequest()
	assert.Nil(t, MaybeInjectOpenAIPromptCacheKey(newPromptCacheContext(t, body), info, next))
	assert.Empty(t, next.PromptCacheKey)
}

func TestMaybeInjectClaudeCacheControlUndoRestoresBlock(t *testing.T) {
	useTestRedis(t)
	body := claudePrefixBody(longSystemPrompt())
	info := newPromptCacheRelayInfo("claude-sonnet-4-5")
	info.ChannelOtherSettings.AutoPromptCacheControl = true

	newRequest := func() *dto.ClaudeRequest {
		return &dto.ClaudeRequest{
			Model:  "claude-sonnet-4-5",
			System: []dto.ClaudeMediaMessage{{Type: dto.ContentTypeText, Text: common.GetPointer(longSystemPrompt())}},
		}
	}
	// First turn only seeds the repeat-seen marker.
	MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, newRequest())

	request := newRequest()
	undo := MaybeInjectClaudeCacheControl(newPromptCacheContext(t, body), info, request)
	require.NotNil(t, undo)
	system := request.System.([]dto.ClaudeMediaMessage)
	require.Equal(t, json.RawMessage(`{"type":"ephemeral"}`), system[len(system)-1].CacheControl)

	undo()
	system = request.System.([]dto.ClaudeMediaMessage)
	assert.Empty(t, system[len(system)-1].CacheControl)
}
