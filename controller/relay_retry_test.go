package controller

import (
	"errors"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPrepareNextRelayAttemptScopesDedicatedRetries(t *testing.T) {
	tests := []struct {
		name       string
		relayMode  int
		statusCode int
		message    string
		budget     relayRetryBudget
		want       bool
		wantBudget relayRetryBudget
	}{
		{name: "400 upstream failed", relayMode: relayconstant.RelayModeResponses, statusCode: 400, message: "Upstream request failed", budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry503Remaining: 1, retry524Remaining: 1}, want: true, wantBudget: relayRetryBudget{retry503Remaining: 1, retry524Remaining: 1}},
		{name: "400 upstream failed chat completions", relayMode: relayconstant.RelayModeChatCompletions, statusCode: 400, message: "Upstream request failed", budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1}, want: true},
		{name: "400 upstream failed disabled", relayMode: relayconstant.RelayModeResponses, statusCode: 400, message: "Upstream request failed", budget: relayRetryBudget{}, want: false},
		{name: "other 400", relayMode: relayconstant.RelayModeResponses, statusCode: 400, message: "Unsupported parameter: max_output_tokens", budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1}, want: false, wantBudget: relayRetryBudget{retry400UpstreamFailedRemaining: 1}},
		{name: "400 upstream failed image generation", relayMode: relayconstant.RelayModeImagesGenerations, statusCode: 400, message: "Upstream request failed", budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1}, want: false, wantBudget: relayRetryBudget{retry400UpstreamFailedRemaining: 1}},
		{name: "503 chat completions", relayMode: relayconstant.RelayModeChatCompletions, statusCode: 503, budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry503Remaining: 1, retry524Remaining: 1}, want: true, wantBudget: relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry524Remaining: 1}},
		{name: "503 responses", relayMode: relayconstant.RelayModeResponses, statusCode: 503, budget: relayRetryBudget{retry503Remaining: 1}, want: true},
		{name: "503 disabled", relayMode: relayconstant.RelayModeChatCompletions, statusCode: 503, budget: relayRetryBudget{}, want: false},
		{name: "524 chat completions", relayMode: relayconstant.RelayModeChatCompletions, statusCode: 524, budget: relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry503Remaining: 1, retry524Remaining: 1}, want: true, wantBudget: relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry503Remaining: 1}},
		{name: "524 responses", relayMode: relayconstant.RelayModeResponses, statusCode: 524, budget: relayRetryBudget{retry524Remaining: 1}, want: true},
		{name: "524 disabled", relayMode: relayconstant.RelayModeChatCompletions, statusCode: 524, budget: relayRetryBudget{}, want: false},
		{name: "image generation", relayMode: relayconstant.RelayModeImagesGenerations, statusCode: 503, budget: relayRetryBudget{retry503Remaining: 1}, want: false, wantBudget: relayRetryBudget{retry503Remaining: 1}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("specific_channel_id", "2")
			retry := 0
			retryParam := &service.RetryParam{Retry: &retry}
			message := tt.message
			if message == "" {
				message = "upstream unavailable"
			}
			apiErr := types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponseStatusCode, tt.statusCode)

			require.Equal(t, tt.want, prepareNextRelayAttempt(c, tt.relayMode, apiErr, retryParam, &tt.budget))
			require.Equal(t, tt.wantBudget, tt.budget)
		})
	}
}

func TestPrepareNextRelayAttemptClearsPendingAutoGroupResetForDedicatedRetries(t *testing.T) {
	tests := []struct {
		statusCode int
		message    string
	}{
		{statusCode: 400, message: "Upstream request failed"},
		{statusCode: 503, message: "upstream unavailable"},
		{statusCode: 524, message: "upstream timeout"},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("status %d", tt.statusCode), func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			retry := 2
			retryParam := &service.RetryParam{Retry: &retry}
			retryParam.ResetRetryNextTry()
			budget := relayRetryBudget{retry400UpstreamFailedRemaining: 1, retry503Remaining: 1, retry524Remaining: 1}
			apiErr := types.NewOpenAIError(errors.New(tt.message), types.ErrorCodeBadResponseStatusCode, tt.statusCode)

			require.True(t, prepareNextRelayAttempt(c, relayconstant.RelayModeResponses, apiErr, retryParam, &budget))
			require.Equal(t, 2, retryParam.GetRetry())

			retryParam.IncreaseRetry()
			require.Equal(t, 3, retryParam.GetRetry())
		})
	}
}

func TestPrepareNextRelayAttemptFallsBackToConfiguredSystemRetry(t *testing.T) {
	originalRetryTimes := common.RetryTimes
	originalRanges := operation_setting.AutomaticRetryStatusCodeRanges
	t.Cleanup(func() {
		common.RetryTimes = originalRetryTimes
		operation_setting.AutomaticRetryStatusCodeRanges = originalRanges
	})
	common.RetryTimes = 2
	operation_setting.AutomaticRetryStatusCodeRanges = []operation_setting.StatusCodeRange{
		{Start: 400, End: 400},
		{Start: 503, End: 503},
		{Start: 524, End: 524},
	}

	tests := []struct {
		name       string
		statusCode int
		message    string
	}{
		{name: "400 upstream failed", statusCode: 400, message: "Upstream request failed"},
		{name: "503", statusCode: 503, message: "upstream unavailable"},
		{name: "524", statusCode: 524, message: "upstream timeout"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			retry := 0
			retryParam := &service.RetryParam{Retry: &retry}
			budget := relayRetryBudget{
				retry400UpstreamFailedRemaining: 1,
				retry503Remaining:               1,
				retry524Remaining:               1,
			}
			apiErr := types.NewOpenAIError(errors.New(test.message), types.ErrorCodeBadResponseStatusCode, test.statusCode)

			require.True(t, prepareNextRelayAttempt(c, relayconstant.RelayModeResponses, apiErr, retryParam, &budget))
			require.Zero(t, retryParam.GetRetry())
			require.True(t, prepareNextRelayAttempt(c, relayconstant.RelayModeResponses, apiErr, retryParam, &budget))
			require.Equal(t, 1, retryParam.GetRetry())
		})
	}
}

func TestPrepareNextRelayAttemptStopsWhenSystemRetryDoesNotIncludeStatus(t *testing.T) {
	originalRetryTimes := common.RetryTimes
	originalRanges := operation_setting.AutomaticRetryStatusCodeRanges
	t.Cleanup(func() {
		common.RetryTimes = originalRetryTimes
		operation_setting.AutomaticRetryStatusCodeRanges = originalRanges
	})
	common.RetryTimes = 2
	operation_setting.AutomaticRetryStatusCodeRanges = nil

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	retryParam := &service.RetryParam{Retry: &retry}
	budget := relayRetryBudget{}
	apiErr := types.NewOpenAIError(errors.New("upstream unavailable"), types.ErrorCodeBadResponseStatusCode, 503)

	require.False(t, prepareNextRelayAttempt(c, relayconstant.RelayModeResponses, apiErr, retryParam, &budget))
	require.Zero(t, retryParam.GetRetry())
}

func TestShouldRetry502StillUsesDefaultBudget(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	apiErr := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, 502)

	require.True(t, shouldRetry(c, apiErr, 1))
	require.False(t, shouldRetry(c, apiErr, 0))
}
