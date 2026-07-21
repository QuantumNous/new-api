package controller

import (
	"context"
	"errors"
	"net/http"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestShouldAvoidRetryHostOnlyForTransportFailure(t *testing.T) {
	t.Parallel()

	transportErr := types.NewErrorWithStatusCode(
		errors.New("net/http: timeout awaiting response headers"),
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
	)
	assert.True(t, shouldAvoidRetryHost(transportErr))

	badResponseErr := types.NewErrorWithStatusCode(
		errors.New("upstream returned 503"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)
	assert.False(t, shouldAvoidRetryHost(badResponseErr))

	canceledErr := types.NewErrorWithStatusCode(
		context.Canceled,
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
	)
	assert.False(t, shouldAvoidRetryHost(canceledErr))
}

func TestRelayRetryHostPrefersResolvedAttemptHost(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		AttemptUpstreamHost: "actual.example",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://configured.example/v1",
		},
	}
	assert.Equal(t, "actual.example", relayRetryHost(info))

	info.AttemptUpstreamHost = ""
	assert.Equal(t, "configured.example", relayRetryHost(info))
}

func TestShouldPreferDifferentCapacityHostOnlyForStreamingResponses(t *testing.T) {
	upstream429 := types.NewErrorWithStatusCode(
		errors.New("Upstream rate limit exceeded, please retry later"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	)
	upstream429.UpstreamStatusCode = http.StatusTooManyRequests

	streamingResponses := &relaycommon.RelayInfo{IsStream: true, RelayMode: relayconstant.RelayModeResponses}
	assert.True(t, shouldPreferDifferentCapacityHost(newTestContext(), streamingResponses, upstream429))

	nonStreamingResponses := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses}
	assert.False(t, shouldPreferDifferentCapacityHost(newTestContext(), nonStreamingResponses, upstream429))

	chatCompletions := &relaycommon.RelayInfo{IsStream: true, RelayMode: relayconstant.RelayModeChatCompletions}
	assert.False(t, shouldPreferDifferentCapacityHost(newTestContext(), chatCompletions, upstream429))
}

func TestShouldPreferDifferentRetryHostAcrossPrioritiesForTransportFailure(t *testing.T) {
	transportErr := types.NewErrorWithStatusCode(
		errors.New("net/http: timeout awaiting response headers"),
		types.ErrorCodeDoRequestFailed,
		http.StatusBadGateway,
	)

	assert.True(t, shouldPreferDifferentRetryHostAcrossPriorities(newTestContext(), nil, transportErr))
}

func TestPreferDifferentRetryHostRecordsSliceTimedOutHost(t *testing.T) {
	retryParam := &service.RetryParam{}
	info := &relaycommon.RelayInfo{
		AttemptUpstreamHost: "https://SLOW.example:443/v1/responses",
	}

	preferDifferentRetryHost(newTestContext(), retryParam, info, true)

	assert.Contains(t, retryParam.AvoidChannelHosts, "slow.example")
	assert.True(t, retryParam.PreferDifferentHost)
}
