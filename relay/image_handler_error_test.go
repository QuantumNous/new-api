package relay

import (
	"errors"
	"net/http"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestSanitizeImageAutoErrorPreservesRequestNotSentRetryProof(t *testing.T) {
	plan, err := (types.ImageRoutingConfig{
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []types.ImageRoutingRoute{{
			ID:                 "route-a",
			ChannelID:          1,
			Priority:           1,
			Enabled:            true,
			BillingMode:        types.ImageRoutingBillingFixed,
			UpstreamModel:      "upstream-image",
			FixedQuotaPerImage: 1,
		}},
	}).BuildPlan("low", 1)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{ImageRouting: relaycommon.NewImageRoutingState(plan)}
	original := types.NewOpenAIError(
		errors.New("dial tcp: connection refused"),
		types.ErrorCodeDoRequestFailed,
		http.StatusInternalServerError,
		types.ErrOptionWithRequestNotSent(),
	)

	sanitized := sanitizeImageAutoError(info, original)

	require.True(t, types.IsRequestNotSentError(sanitized))
	require.True(t, types.IsImageRoutingErrorRetryable(sanitized, false, true))
}

func TestSanitizeImageAutoErrorPreservesDefinitiveRejectionProof(t *testing.T) {
	info := &relaycommon.RelayInfo{ImageRouting: &relaycommon.ImageRoutingState{}}
	original := types.ClassifyImageRoutingUpstreamResponse(types.NewOpenAIError(
		errors.New("rate limited"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusTooManyRequests,
	))
	original.StatusCode = http.StatusServiceUnavailable

	sanitized := sanitizeImageAutoError(info, original)

	require.True(t, types.IsImageRoutingUpstreamRejected(sanitized))
	require.Equal(t, http.StatusTooManyRequests, types.ImageRoutingUpstreamStatusCode(sanitized))
	require.Equal(t, http.StatusServiceUnavailable, sanitized.StatusCode)
	require.True(t, types.IsImageRoutingErrorRetryable(sanitized, false, true))
}
