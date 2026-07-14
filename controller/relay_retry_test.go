package controller

import (
	"errors"
	"net/http/httptest"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPrepareNextRelayAttemptScopes524Retries(t *testing.T) {
	tests := []struct {
		name      string
		relayMode int
		budget    int
		want      bool
	}{
		{name: "chat completions", relayMode: relayconstant.RelayModeChatCompletions, budget: 1, want: true},
		{name: "responses", relayMode: relayconstant.RelayModeResponses, budget: 1, want: true},
		{name: "disabled", relayMode: relayconstant.RelayModeChatCompletions, budget: 0, want: false},
		{name: "image generation", relayMode: relayconstant.RelayModeImagesGenerations, budget: 1, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("specific_channel_id", "2")
			retry := 0
			retryParam := &service.RetryParam{Retry: &retry}
			apiErr := types.NewOpenAIError(errors.New("cloudflare timeout"), types.ErrorCodeBadResponseStatusCode, 524)

			require.Equal(t, tt.want, prepareNextRelayAttempt(c, tt.relayMode, apiErr, retryParam, &tt.budget))
		})
	}
}

func TestPrepareNextRelayAttemptClearsPendingAutoGroupResetFor524(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 2
	retryParam := &service.RetryParam{Retry: &retry}
	retryParam.ResetRetryNextTry()
	retry524Remaining := 1
	apiErr := types.NewOpenAIError(errors.New("cloudflare timeout"), types.ErrorCodeBadResponseStatusCode, 524)

	require.True(t, prepareNextRelayAttempt(c, relayconstant.RelayModeResponses, apiErr, retryParam, &retry524Remaining))
	require.Zero(t, retry524Remaining)
	require.Equal(t, 2, retryParam.GetRetry())

	retryParam.IncreaseRetry()
	require.Equal(t, 3, retryParam.GetRetry())
}

func TestShouldRetryNon524StillUsesDefaultBudget(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	apiErr := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, 502)

	require.True(t, shouldRetry(c, apiErr, 1))
	require.False(t, shouldRetry(c, apiErr, 0))
}
