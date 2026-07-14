package service

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

func TestChannelHealthPathNormalizesBoundedRouteFamilies(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{path: "/v1/responses?beta=true", want: "/v1/responses"},
		{path: "/pg/chat/completions", want: "/v1/chat/completions"},
		{path: "/v1beta/models/gemini-2.5-pro:generateContent", want: "/gemini/generate"},
		{path: "/v1beta/models/gemini-2.5-pro:streamGenerateContent", want: "/gemini/stream_generate"},
		{path: "/v1/videos/task-123", want: "/v1/tasks"},
		{path: "/arbitrary/user-controlled/value", want: "/other"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			if got := ChannelHealthPath(tt.path); got != tt.want {
				t.Fatalf("ChannelHealthPath(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}

// TestRecordChannelHealthOutcomeIgnoresGatewayLocalErrors verifies that
// failures which never reached the upstream channel (request conversion,
// pricing, serialization — the gateway's own processing) don't open a
// healthy channel's circuit. Only errors attributable to the upstream
// channel itself should count against adaptive health.
func TestRecordChannelHealthOutcomeIgnoresGatewayLocalErrors(t *testing.T) {
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	t.Cleanup(func() { common.AdaptiveChannelHealthEnabled = oldEnabled })

	const channelID = 9001424
	const modelName = "test-local-error-classification"
	const requestPath = "/v1/responses"

	localErr := types.NewErrorWithStatusCode(errors.New("failed to copy request to GeneralOpenAIRequest"), types.ErrorCodeConvertRequestFailed, http.StatusInternalServerError)

	for i := 0; i < 5; i++ {
		RecordChannelHealthOutcome(channelID, modelName, requestPath, nil, time.Now(), localErr, false)
	}

	if !IsChannelHealthAvailable(channelID, modelName, requestPath) {
		t.Fatal("expected gateway-local errors (e.g. request conversion failures) not to open the channel circuit")
	}
}

// TestRecordChannelHealthOutcomeCountsChannelAttributableErrors is the
// contrasting case: a genuine upstream failure (do-request failed) must
// still open the circuit after the failure threshold.
func TestRecordChannelHealthOutcomeCountsChannelAttributableErrors(t *testing.T) {
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	t.Cleanup(func() { common.AdaptiveChannelHealthEnabled = oldEnabled })

	const channelID = 9001425
	const modelName = "test-upstream-error-classification"
	const requestPath = "/v1/responses"

	upstreamErr := types.NewErrorWithStatusCode(errors.New("do request failed"), types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)

	for i := 0; i < 5; i++ {
		RecordChannelHealthOutcome(channelID, modelName, requestPath, nil, time.Now(), upstreamErr, false)
	}

	if IsChannelHealthAvailable(channelID, modelName, requestPath) {
		t.Fatal("expected repeated do-request-failed errors to open the channel circuit")
	}
}
