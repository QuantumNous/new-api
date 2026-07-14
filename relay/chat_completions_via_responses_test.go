package relay

import (
	"io"
	"math"
	"net/http"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsResponsesEventStreamContentType(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		want        bool
	}{
		{name: "plain", contentType: "text/event-stream", want: true},
		{name: "mixed case with charset", contentType: "Text/Event-Stream; charset=utf-8", want: true},
		{name: "json", contentType: "application/json", want: false},
		{name: "empty", contentType: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isResponsesEventStreamContentType(tt.contentType))
		})
	}
}

// TestIsResponsesStreamResponseSniffsBodyPrefix verifies SSE detection works
// with missing or incorrect media types without consuming the response body.
func TestIsResponsesStreamResponseSniffsBodyPrefix(t *testing.T) {
	tests := []struct {
		name         string
		contentType  string
		body         string
		clientStream bool
		want         bool
	}{
		{name: "event stream header", contentType: "text/event-stream", body: "data: {}\n", want: true},
		{name: "missing header with event prefix", body: "event: response.created\ndata: {}\n", clientStream: true, want: true},
		{name: "missing header with data prefix", body: "data: {}\n", clientStream: true, want: true},
		{name: "missing header with json body", body: `{"id":"resp_1"}`, clientStream: true, want: false},
		{name: "json header with data prefix", contentType: "application/json", body: "data: {}\n", clientStream: true, want: true},
		{name: "plain text header with event prefix", contentType: "text/plain", body: "event: response.created\ndata: {}\n", clientStream: true, want: true},
		{name: "json header with json body", contentType: "application/json", body: `{"id":"resp_1"}`, clientStream: true, want: false},
		{name: "non-stream client does not sniff", body: "data: {}\n", clientStream: false, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				Header: http.Header{"Content-Type": []string{tt.contentType}},
				Body:   io.NopCloser(strings.NewReader(tt.body)),
			}

			assert.Equal(t, tt.want, isResponsesStreamResponse(resp, tt.clientStream))
			gotBody, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.body, string(gotBody))
			require.NoError(t, resp.Body.Close())
		})
	}
}

// TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers ensures non-finite and
// non-positive provider ratios cannot corrupt a valid task adjustment.
func TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"duration": 3,
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.True(t, ok)
	assert.Equal(t, 150, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}

func TestRecalcQuotaFromRatiosRejectsAllInvalidAdjustedRatios(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.False(t, ok)
	assert.Equal(t, 0, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}
