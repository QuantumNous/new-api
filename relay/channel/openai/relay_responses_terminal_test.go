package openai

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestOaiResponsesStreamHandlerReportsMissingTerminal checks protocol error
// delivery and usage preservation for streams without a terminal event.
func TestOaiResponsesStreamHandlerReportsMissingTerminal(t *testing.T) {
	oldMode, oldTimeout := gin.Mode(), constant.StreamingTimeout
	gin.SetMode(gin.TestMode)
	constant.StreamingTimeout = 1
	t.Cleanup(func() {
		gin.SetMode(oldMode)
		constant.StreamingTimeout = oldTimeout
	})

	for _, tc := range []struct {
		name            string
		upstream        string
		readError       error
		holdOpen        bool
		wantErrorEvents int
		wantSuccess     bool
		wantLogOK       bool
		wantPrompt      int
		wantAttribution string
	}{
		{
			name:            "clean EOF without terminal",
			upstream:        "data: {\"type\":\"response.created\",\"sequence_number\":7}\n\n",
			wantErrorEvents: 1,
			wantPrompt:      2,
			wantAttribution: "upstream",
		},
		{
			name:            "read reset without terminal",
			upstream:        "data: {\"type\":\"response.created\",\"sequence_number\":7}\n\n",
			readError:       errors.New("secret upstream host 10.0.0.1:443 reset"),
			wantErrorEvents: 1,
			wantPrompt:      2,
			wantAttribution: "upstream",
		},
		{
			name:            "upstream stalled without terminal",
			upstream:        "data: {\"type\":\"response.created\",\"sequence_number\":7}\n\n",
			holdOpen:        true,
			wantErrorEvents: 1,
			wantPrompt:      2,
			wantAttribution: "stream stopped",
		},
		{
			name:            "DONE marker without terminal",
			upstream:        "data: {\"type\":\"response.created\",\"sequence_number\":7}\n\ndata: [DONE]\n\n",
			wantErrorEvents: 1,
			wantPrompt:      2,
			wantAttribution: "upstream",
		},
		{
			name:        "completed response",
			upstream:    "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n\n",
			wantSuccess: true,
			wantLogOK:   true,
			wantPrompt:  2,
		},
		{
			name:            "upstream error already delivered",
			upstream:        "data: {\"type\":\"error\",\"code\":\"upstream_error\",\"message\":\"failed\"}\n\n",
			wantErrorEvents: 1,
		},
		{
			name:     "response.failed already delivered",
			upstream: "data: {\"type\":\"response.failed\",\"response\":{\"status\":\"failed\"}}\n\n",
		},
		{
			name:       "response.incomplete is terminal",
			upstream:   "data: {\"type\":\"response.incomplete\",\"response\":{\"status\":\"incomplete\"}}\n\n",
			wantLogOK:  true,
			wantPrompt: 2,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var body io.ReadCloser = io.NopCloser(strings.NewReader(tc.upstream))
			if tc.readError != nil || tc.holdOpen {
				body = &responsesLifecycleBody{data: strings.NewReader(tc.upstream), waiting: make(chan struct{}), closed: make(chan struct{}), readErr: tc.readError}
			}
			writer := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(writer)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			info := &relaycommon.RelayInfo{
				OriginModelName: "test-model", IsStream: true, DisablePing: true, StartTime: time.Now(),
				RelayFormat: types.RelayFormatOpenAIResponses,
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "test-model"},
			}
			info.SetEstimatePromptTokens(2)
			resp := &http.Response{StatusCode: http.StatusOK, Body: body, Header: http.Header{"Content-Type": {"text/event-stream"}}}
			usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, tc.wantPrompt, usage.PromptTokens)
			require.NotNil(t, info.StreamStatus)

			output := writer.Body.String()
			assert.Equal(t, tc.wantErrorEvents, strings.Count(output, "event: error\n"))
			assert.NotContains(t, output, "secret upstream host")
			if tc.wantErrorEvents == 1 && tc.name != "upstream error already delivered" {
				var errorEvent map[string]any
				for _, frame := range strings.Split(output, "\n\n") {
					if strings.HasPrefix(frame, "event: error\ndata: ") {
						require.NoError(t, json.Unmarshal([]byte(strings.TrimPrefix(frame, "event: error\ndata: ")), &errorEvent))
					}
				}
				require.NotNil(t, errorEvent)
				assert.Equal(t, "error", errorEvent["type"])
				assert.Equal(t, "upstream_stream_interrupted", errorEvent["code"])
				assert.Equal(t, float64(8), errorEvent["sequence_number"])
				assert.Contains(t, errorEvent, "param")
				assert.Nil(t, errorEvent["param"])
				assert.NotContains(t, errorEvent, "object")
			}
			log := service.GenerateTextOtherInfo(c, info, 1, 1, 1, 0, 1, 0, 1).Snapshot()["stream_status"].(map[string]any)
			assert.Equal(t, tc.wantSuccess, service.RequestPolicy(c).Successful)
			assert.Equal(t, tc.wantLogOK, log["status"] == "ok")
			if tc.wantAttribution != "" {
				require.NotEmpty(t, info.StreamStatus.Errors)
				assert.Contains(t, info.StreamStatus.Errors[len(info.StreamStatus.Errors)-1].Message, tc.wantAttribution)
			}
		})
	}
}
