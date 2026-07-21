package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldRetryOpenAIReasoningSignatureInvalid(t *testing.T) {
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
	})

	newContext := func(encryptedContent string) *gin.Context {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		input := []byte(`[{"type":"reasoning","encrypted_content":"` + encryptedContent + `"}]`)
		_, _, err := service.PrepareOpenAIResponsesReasoningInput(ctx, input)
		require.NoError(t, err)
		return ctx
	}
	invalidSignature := types.WithOpenAIError(types.OpenAIError{
		Code:    string(types.ErrorCodeThinkingSignatureInvalid),
		Message: "encrypted content could not be verified",
	}, http.StatusBadRequest)

	openAIResponses := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
			ChannelSetting: dto.ChannelSettings{
				EnableThinkingSignatureFallback: true,
			},
		},
	}
	ctx := newContext("controller-openai-responses")
	assert.True(t, shouldRetryOpenAIReasoningSignatureInvalid(ctx, openAIResponses, invalidSignature))
	assert.False(t, shouldRetryOpenAIReasoningSignatureInvalid(ctx, openAIResponses, invalidSignature), "the fallback adds only one retry")

	nonOpenAI := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
		},
	}
	assert.False(t, shouldRetryOpenAIReasoningSignatureInvalid(newContext("controller-codex"), nonOpenAI, invalidSignature))

	disabledOpenAI := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
		},
	}
	assert.False(t, shouldRetryOpenAIReasoningSignatureInvalid(newContext("controller-disabled-openai"), disabledOpenAI, invalidSignature))

	openAIChat := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
			ChannelSetting: dto.ChannelSettings{
				EnableThinkingSignatureFallback: true,
			},
		},
	}
	assert.False(t, shouldRetryOpenAIReasoningSignatureInvalid(newContext("controller-openai-chat"), openAIChat, invalidSignature))

	otherError := types.WithOpenAIError(types.OpenAIError{
		Code:    "invalid_request_error",
		Message: "bad request",
	}, http.StatusBadRequest)
	assert.False(t, shouldRetryOpenAIReasoningSignatureInvalid(newContext("controller-other-error"), openAIResponses, otherError))
}
