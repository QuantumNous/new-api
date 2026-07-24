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

func TestDetectResponsesEventStreamSniffsMissingContentTypeAndPreservesBody(t *testing.T) {
	body := strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created"}`,
		``,
	}, "\n")
	resp := &http.Response{
		Header: http.Header{},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	require.True(t, detectResponsesEventStream(resp))

	got, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, body, string(got))
}

func TestDetectResponsesEventStreamSkipsLeadingWhitespaceAndBOM(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "leading whitespace", body: " event: response.created\n"},
		{name: "UTF-8 BOM", body: "\ufeffevent: response.created\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				Header: http.Header{},
				Body:   io.NopCloser(strings.NewReader(tt.body)),
			}

			require.True(t, detectResponsesEventStream(resp))

			got, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.body, string(got))
		})
	}
}

func TestDetectResponsesEventStreamLeavesJsonBodyAsNonStream(t *testing.T) {
	body := `{"id":"resp_1","status":"completed"}`
	resp := &http.Response{
		Header: http.Header{},
		Body:   io.NopCloser(strings.NewReader(body)),
	}

	require.False(t, detectResponsesEventStream(resp))

	got, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	assert.Equal(t, body, string(got))
}

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
