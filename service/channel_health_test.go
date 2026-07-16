package service

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

// TestChannelHealthOutcomeStatusScoresEmptyUpstreamAsFailure covers the pure
// status-mapping helper: a real upstream error keeps its own status, a clean
// success is 200, and a 200-but-empty upstream response (UpstreamEmptyResponse)
// is scored 502 so the circuit treats a channel that silently returns nothing
// as failing rather than healthy.
func TestChannelHealthOutcomeStatusScoresEmptyUpstreamAsFailure(t *testing.T) {
	upstreamErr := types.NewErrorWithStatusCode(errors.New("do request failed"), types.ErrorCodeDoRequestFailed, http.StatusBadGateway)
	localErr := types.NewErrorWithStatusCode(errors.New("convert request failed"), types.ErrorCodeConvertRequestFailed, http.StatusInternalServerError)

	tests := []struct {
		name         string
		apiErr       *types.NewAPIError
		relayInfo    *relaycommon.RelayInfo
		wantStatus   int
		wantLocalErr bool
	}{
		{name: "clean success", apiErr: nil, relayInfo: &relaycommon.RelayInfo{}, wantStatus: http.StatusOK, wantLocalErr: false},
		{name: "nil relay info", apiErr: nil, relayInfo: nil, wantStatus: http.StatusOK, wantLocalErr: false},
		{name: "empty upstream response", apiErr: nil, relayInfo: &relaycommon.RelayInfo{UpstreamEmptyResponse: true}, wantStatus: http.StatusBadGateway, wantLocalErr: false},
		{name: "upstream error wins over empty flag", apiErr: upstreamErr, relayInfo: &relaycommon.RelayInfo{UpstreamEmptyResponse: true}, wantStatus: http.StatusBadGateway, wantLocalErr: false},
		{name: "gateway-local error", apiErr: localErr, relayInfo: &relaycommon.RelayInfo{}, wantStatus: http.StatusInternalServerError, wantLocalErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, localErr := channelHealthOutcomeStatus(tt.apiErr, tt.relayInfo)
			if status != tt.wantStatus {
				t.Fatalf("status = %d, want %d", status, tt.wantStatus)
			}
			if localErr != tt.wantLocalErr {
				t.Fatalf("localError = %v, want %v", localErr, tt.wantLocalErr)
			}
		})
	}
}

// TestRecordChannelHealthOutcomeCountsEmptyUpstreamResponse verifies the
// end-to-end effect: repeated 200-but-empty upstream responses (no apiErr, only
// the UpstreamEmptyResponse flag) open the channel circuit, so a channel that
// keeps truncating streams is routed away from instead of staying "healthy".
func TestRecordChannelHealthOutcomeCountsEmptyUpstreamResponse(t *testing.T) {
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	t.Cleanup(func() { common.AdaptiveChannelHealthEnabled = oldEnabled })

	const channelID = 9001426
	const modelName = "test-empty-upstream-response"
	const requestPath = "/v1/responses"

	emptyInfo := &relaycommon.RelayInfo{UpstreamEmptyResponse: true}

	for i := 0; i < 5; i++ {
		RecordChannelHealthOutcome(channelID, modelName, requestPath, emptyInfo, time.Now(), nil, false)
	}

	if IsChannelHealthAvailable(channelID, modelName, requestPath) {
		t.Fatal("expected repeated empty upstream responses to open the channel circuit")
	}
}

// TestRecordChannelHealthOutcomeHealthySuccessStaysAvailable is the contrast:
// a normal 200 with real output (no empty flag) must not open the circuit.
func TestRecordChannelHealthOutcomeHealthySuccessStaysAvailable(t *testing.T) {
	oldEnabled := common.AdaptiveChannelHealthEnabled
	common.AdaptiveChannelHealthEnabled = true
	t.Cleanup(func() { common.AdaptiveChannelHealthEnabled = oldEnabled })

	const channelID = 9001427
	const modelName = "test-healthy-success"
	const requestPath = "/v1/responses"

	healthyInfo := &relaycommon.RelayInfo{}

	for i := 0; i < 5; i++ {
		RecordChannelHealthOutcome(channelID, modelName, requestPath, healthyInfo, time.Now(), nil, false)
	}

	if !IsChannelHealthAvailable(channelID, modelName, requestPath) {
		t.Fatal("expected healthy successes to keep the channel available")
	}
}

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
