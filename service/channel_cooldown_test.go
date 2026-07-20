package service

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCooldownUpstreamHostForErrorOnlyIsolatesTransportFailures(t *testing.T) {
	model.ClearChannelHostCooldownsForTest()
	t.Cleanup(model.ClearChannelHostCooldownsForTest)

	tests := []struct {
		name string
		err  *types.NewAPIError
		want bool
	}{
		{
			name: "response header timeout",
			err:  types.NewErrorWithStatusCode(errors.New("net/http: timeout awaiting response headers"), types.ErrorCodeDoRequestFailed, http.StatusBadGateway),
			want: true,
		},
		{
			name: "upstream bad gateway",
			err:  upstreamStatusErrorForTest(http.StatusBadGateway, "bad response status code 502"),
			want: true,
		},
		{
			name: "upstream unavailable",
			err:  upstreamStatusErrorForTest(http.StatusServiceUnavailable, "service unavailable"),
			want: true,
		},
		{
			name: "local synthetic bad gateway has no upstream provenance",
			err:  types.NewErrorWithStatusCode(errors.New("local conversion failed"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway),
			want: false,
		},
		{
			name: "account pool unavailable stays channel scoped",
			err:  upstreamStatusErrorForTest(http.StatusServiceUnavailable, "no available accounts"),
			want: false,
		},
		{
			name: "distributor channel pool unavailable stays channel scoped",
			err:  distributorCapacityErrorForTest(),
			want: false,
		},
		{
			name: "generic upstream channel error remains host observable",
			err:  upstreamStatusErrorForTest(http.StatusServiceUnavailable, "no available channel"),
			want: true,
		},
		{
			name: "account rate limit stays channel scoped",
			err:  types.NewErrorWithStatusCode(errors.New("rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
			want: false,
		},
		{
			name: "client request stays unscored",
			err:  types.NewErrorWithStatusCode(errors.New("invalid prompt"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest),
			want: false,
		},
		{
			name: "client cancellation stays unscored",
			err:  types.NewErrorWithStatusCode(context.Canceled, types.ErrorCodeDoRequestFailed, http.StatusBadGateway),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model.ClearChannelHostCooldownsForTest()
			assert.False(t, ObserveUpstreamHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, tt.err))
			assert.False(t, ObserveUpstreamHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, tt.err))
			applied := ObserveUpstreamHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 42, tt.err)
			assert.Equal(t, tt.want, applied, "host circuit requires three failures from two channel IDs")
			assert.Equal(t, tt.want, model.IsChannelHostCoolingDown("aiccxx.cn", "gpt-5.6-sol", "/v1/responses"))
		})
	}
}

func TestCooldownUpstreamHostForErrorScopesByModelAndPath(t *testing.T) {
	model.ClearChannelHostCooldownsForTest()
	t.Cleanup(model.ClearChannelHostCooldownsForTest)
	err := types.NewErrorWithStatusCode(errors.New("net/http: timeout awaiting response headers"), types.ErrorCodeDoRequestFailed, http.StatusBadGateway)

	require.False(t, ObserveUpstreamHostFailure("https://AICCXX.cn/v1", "gpt-5.6-sol", "/v1/responses?trace=1", 41, err))
	require.False(t, ObserveUpstreamHostFailure("https://AICCXX.cn/v1", "gpt-5.6-sol", "/v1/responses?trace=1", 41, err))
	require.True(t, ObserveUpstreamHostFailure("https://AICCXX.cn/v1", "gpt-5.6-sol", "/v1/responses?trace=1", 42, err))

	assert.True(t, model.IsChannelHostCoolingDown("aiccxx.cn", "gpt-5.6-sol", "/v1/responses"))
	assert.False(t, model.IsChannelHostCoolingDown("aiccxx.cn", "gpt-5.6-sol", "/v1/chat/completions"))
	assert.False(t, model.IsChannelHostCoolingDown("aiccxx.cn", "gpt-5.5", "/v1/responses"))
}

func TestObserveUpstreamHostFailureRequiresDistinctChannels(t *testing.T) {
	model.ClearChannelHostCooldownsForTest()
	t.Cleanup(model.ClearChannelHostCooldownsForTest)
	err := types.NewErrorWithStatusCode(errors.New("net/http: timeout awaiting response headers"), types.ErrorCodeDoRequestFailed, http.StatusBadGateway)

	for i := 0; i < 4; i++ {
		assert.False(t, ObserveUpstreamHostFailure("aiccxx.cn", "gpt-5.6-sol", "/v1/responses", 41, err))
	}

	assert.False(t, model.IsChannelHostCoolingDown("aiccxx.cn", "gpt-5.6-sol", "/v1/responses"))
}

func upstreamStatusErrorForTest(status int, message string) *types.NewAPIError {
	err := types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeBadResponseStatusCode, status)
	err.UpstreamStatusCode = status
	return err
}

func distributorCapacityErrorForTest() *types.NewAPIError {
	err := types.WithOpenAIError(types.OpenAIError{
		Message: "No available channel for model gpt-5.6-sol under group gpt plus (distributor)",
		Type:    "new_api_error",
		Code:    string(types.ErrorCodeModelNotFound),
	}, http.StatusServiceUnavailable)
	err.UpstreamStatusCode = http.StatusServiceUnavailable
	return err
}

func TestCooldownChannelForRetryUsesShortDurationFor5xx(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	chErr := types.NewChannelError(9001, 1, "test", false, "", true)
	err := types.NewErrorWithStatusCode(errors.New("bad response status code 500"), types.ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)

	CooldownChannelForRetry(*chErr, err)

	reason, expires, cooling := model.GetChannelCooldown(9001)
	if !cooling {
		t.Fatalf("expected retryable 5xx error to cool the channel")
	}
	if !strings.Contains(reason, "retryable_transient") {
		t.Fatalf("expected retryable_transient reason, got %q", reason)
	}
	if remaining := time.Until(time.Unix(expires, 0)); remaining < 4*time.Minute || remaining > 6*time.Minute {
		t.Fatalf("expected ~5m short cooldown, got %s", remaining)
	}
}

func TestCooldownChannelForRetryUsesTwoHoursForUpstream429(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	t.Cleanup(model.ClearChannelCooldownsForTest)

	chErr := types.NewChannelError(9004, 1, "rate-limited", false, "", true)
	err := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusServiceUnavailable,
	)
	err.UpstreamStatusCode = http.StatusTooManyRequests

	CooldownChannelForRetry(*chErr, err)

	reason, expires, cooling := model.GetChannelCooldown(9004)
	require.True(t, cooling)
	assert.Contains(t, reason, "upstream_rate_limit")
	remaining := time.Until(time.Unix(expires, 0))
	assert.Greater(t, remaining, 119*time.Minute)
	assert.Less(t, remaining, 121*time.Minute)

	CooldownChannelForRetry(*chErr, types.NewErrorWithStatusCode(
		errors.New("temporary bad gateway"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	))
	_, expiresAfterShortCooldown, cooling := model.GetChannelCooldown(9004)
	require.True(t, cooling)
	assert.Equal(t, expires, expiresAfterShortCooldown, "a later short cooldown must not shorten the 429 isolation")
}

func TestIsUpstreamRateLimitErrorRequiresUpstreamProvenance(t *testing.T) {
	mappedUpstream429 := types.NewErrorWithStatusCode(
		errors.New("upstream rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)
	mappedUpstream429.UpstreamStatusCode = http.StatusTooManyRequests

	local429 := types.NewErrorWithStatusCode(
		errors.New("local rate limit exceeded"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)

	assert.True(t, IsUpstreamRateLimitError(mappedUpstream429))
	assert.False(t, IsUpstreamRateLimitError(local429))
}

func TestCooldownChannelForRetryUsesFullDurationForCapabilityGap(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	chErr := types.NewChannelError(9003, 1, "test", false, "", true)
	err := types.NewErrorWithStatusCode(errors.New("Image generation is not enabled for this group"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	CooldownChannelForRetry(*chErr, err)

	reason, expires, cooling := model.GetChannelCooldown(9003)
	if !cooling {
		t.Fatalf("expected capability gap to cool the channel")
	}
	if !strings.Contains(reason, "capability_gap") {
		t.Fatalf("expected capability_gap reason, got %q", reason)
	}
	if remaining := time.Until(time.Unix(expires, 0)); remaining < 29*time.Minute || remaining > 31*time.Minute {
		t.Fatalf("expected ~30m cooldown, got %s", remaining)
	}
}

func TestCooldownSlowChannelCoolsFullDuration(t *testing.T) {
	model.ClearChannelCooldownsForTest()
	chErr := types.NewChannelError(9002, 1, "test", false, "", true)

	CooldownSlowChannel(*chErr, 42*time.Second)

	reason, expires, cooling := model.GetChannelCooldown(9002)
	if !cooling {
		t.Fatalf("expected slow channel to be cooled")
	}
	if !strings.Contains(reason, "slow_upstream") {
		t.Fatalf("expected slow_upstream reason, got %q", reason)
	}
	if remaining := time.Until(time.Unix(expires, 0)); remaining < 29*time.Minute || remaining > 31*time.Minute {
		t.Fatalf("expected ~30m cooldown, got %s", remaining)
	}
}

func TestShouldCooldownChannelForBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("Insufficient account balance"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForChineseBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("账户余额不足"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected Chinese balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForLowCreditBalanceError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("Your credit balance is too low"), types.ErrorCodeBadResponseStatusCode, http.StatusForbidden)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected low credit balance error to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelForInsufficientQuotaCode(t *testing.T) {
	err := types.NewOpenAIError(errors.New("You exceeded your current quota"), types.ErrorCode("insufficient_quota"), http.StatusTooManyRequests)

	if !ShouldCooldownChannel(err) {
		t.Fatalf("expected insufficient_quota error code to trigger channel cooldown")
	}
}

func TestShouldCooldownChannelIgnoresUnrelatedError(t *testing.T) {
	err := types.NewErrorWithStatusCode(errors.New("unsupported parameter: max_output_tokens"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest)

	if ShouldCooldownChannel(err) {
		t.Fatalf("expected unrelated bad request to skip channel cooldown")
	}
}
