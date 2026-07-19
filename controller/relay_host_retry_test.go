package controller

import (
	"context"
	"errors"
	"net/http"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
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
