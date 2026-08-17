package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
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

	state.recordAttempt()
	ctx.Set("compact_stage_channels", []string{"17"})
	common.SetContextKey(ctx, constant.ContextKeyAutoGroupIndex, 2)
	modelError := types.WithOpenAIError(types.OpenAIError{
		Message: "The requested model does not exist",
		Type:    "invalid_request_error",
		Param:   "model",
		Code:    "model_not_found",
	}, http.StatusBadRequest)
	require.True(t, state.advance(ctx, info, modelError, false))
	require.Equal(t, relaycommon.CompactAttemptBase, state.stage)
	require.Empty(t, ctx.GetStringSlice("compact_stage_channels"))
	groupIndex, exists := common.GetContextKey(ctx, constant.ContextKeyAutoGroupIndex)
	require.True(t, exists)
	require.Equal(t, 0, groupIndex)

	state.recordAttempt()
	require.True(t, state.advance(ctx, info, types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError), true))
	state.recordAttempt()
	require.False(t, state.advance(ctx, info, types.InitOpenAIError(types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError), true))
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
}
