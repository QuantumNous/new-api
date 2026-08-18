package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCompactRetryBudgetAndStageTransition(t *testing.T) {
	originalRetryTimes := common.RetryTimes
	common.RetryTimes = 3
	t.Cleanup(func() { common.RetryTimes = originalRetryTimes })

	info := &relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		CompactAttemptStage: relaycommon.CompactAttemptExact,
	}
	state := newCompactRetryState(info)
	ctx, _ := gin.CreateTestContext(nil)
	require.Equal(t, 3, state.exactBudget)
	require.Equal(t, 2, state.baseBudget)

	state.recordAttempt(ctx, 17)
	common.SetContextKey(ctx, constant.ContextKeyAutoGroupIndex, 2)
	modelError := types.WithOpenAIError(types.OpenAIError{
		Message: "The requested model does not exist",
		Type:    "invalid_request_error",
		Param:   "model",
		Code:    "model_not_found",
	}, http.StatusBadRequest)
	require.True(t, state.advance(ctx, info, modelError, false))
	require.Equal(t, relaycommon.CompactAttemptBase, state.stage)
	require.Equal(t, 4, state.baseBudget)
	require.Empty(t, service.GetCompactAttemptedKeyIndexes(ctx, 17))
	groupIndex, exists := common.GetContextKey(ctx, constant.ContextKeyAutoGroupIndex)
	require.True(t, exists)
	require.Equal(t, 0, groupIndex)

	for attempt := 1; attempt <= state.baseBudget; attempt++ {
		state.recordAttempt(ctx, 17)
		continued := state.advance(ctx, info, types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError), true)
		require.Equal(t, attempt < state.baseBudget, continued)
	}
}

func TestCompactRetryTransfersAllExactBudgetWhenStartingAtBase(t *testing.T) {
	originalRetryTimes := common.RetryTimes
	common.RetryTimes = 3
	t.Cleanup(func() { common.RetryTimes = originalRetryTimes })

	state := newCompactRetryState(&relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		CompactAttemptStage: relaycommon.CompactAttemptBase,
	})
	require.Equal(t, 3, state.exactBudget)
	require.Equal(t, 5, state.baseBudget)
}

func TestCompactRetryStartsNonGPTRequestsAtBase(t *testing.T) {
	state := newCompactRetryState(&relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		RequestedModel:      "gemini-2.5-flash",
		CompactAttemptStage: relaycommon.CompactAttemptNone,
	})
	require.Equal(t, relaycommon.CompactAttemptBase, state.stage)
}

func TestCompactModelSemanticErrorDoesNotMatchOrdinaryParameter400(t *testing.T) {
	ordinary := types.WithOpenAIError(types.OpenAIError{
		Message: "Invalid value for input",
		Type:    "invalid_request_error",
		Param:   "input",
		Code:    "invalid_request_error",
	}, http.StatusBadRequest)
	require.False(t, isCompactModelSemanticError(ordinary))

	unsupported := types.WithOpenAIError(types.OpenAIError{
		Message: "unsupported model gpt-5-openai-compact",
		Type:    "invalid_request_error",
		Code:    "unsupported_model",
	}, http.StatusBadRequest)
	require.True(t, isCompactModelSemanticError(unsupported))

	for _, statusCode := range []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusTooManyRequests, http.StatusInternalServerError} {
		t.Run(http.StatusText(statusCode), func(t *testing.T) {
			err := types.WithOpenAIError(types.OpenAIError{
				Message: "model is temporarily unavailable",
				Type:    "upstream_error",
				Param:   "model",
				Code:    "upstream_error",
			}, statusCode)
			require.False(t, isCompactModelSemanticError(err))
		})
	}

	explicitCode := types.WithOpenAIError(types.OpenAIError{
		Message: "model unavailable",
		Code:    "model_not_found",
	}, http.StatusTooManyRequests)
	require.True(t, isCompactModelSemanticError(explicitCode))

	for _, message := range []string{
		"The model `gpt-5-openai-compact` does not exist",
		"Model gpt-5-openai-compact not found",
		"The requested model is not supported by this endpoint",
	} {
		semantic := types.WithOpenAIError(types.OpenAIError{Message: message}, http.StatusUnprocessableEntity)
		require.True(t, isCompactModelSemanticError(semantic), message)
	}
}
