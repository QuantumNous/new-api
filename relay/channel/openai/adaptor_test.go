package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIRequest_ForceUpstreamStream(t *testing.T) {
	tests := []struct {
		name               string
		clientStream       *bool
		forceUpstream      bool
		supportStreamOpts  bool
		channelType        int
		wantStreamSent     bool // what the upstream should receive
		wantForcedFlag     bool // whether UpstreamStreamForced should be set
		wantIsStream       bool // info.IsStream after conversion (always matches client request)
		wantStreamOptions  bool // whether StreamOptions.IncludeUsage should be true
	}{
		{
			name:              "client non-stream + force -> upstream stream + forced flag",
			clientStream:      lo.ToPtr(false),
			forceUpstream:     true,
			supportStreamOpts: true,
			wantStreamSent:    true,
			wantForcedFlag:    true,
			wantIsStream:      false, // IsStream reflects client request, not forced upstream
			wantStreamOptions: true,
		},
		{
			name:              "client stream + force -> upstream stream, no forced flag",
			clientStream:      lo.ToPtr(true),
			forceUpstream:     true,
			supportStreamOpts: true,
			wantStreamSent:    true,
			wantForcedFlag:    false,
			wantIsStream:      true,
			wantStreamOptions: false, // forced flag not set, so StreamOptions not injected by force path
		},
		{
			name:              "client non-stream + no force -> upstream non-stream, no forced flag",
			clientStream:      lo.ToPtr(false),
			forceUpstream:     false,
			supportStreamOpts: true,
			wantStreamSent:    false,
			wantForcedFlag:    false,
			wantIsStream:      false,
			wantStreamOptions: false,
		},
		{
			name:              "force + no stream options support -> stream injected but no StreamOptions",
			clientStream:      lo.ToPtr(false),
			forceUpstream:     true,
			supportStreamOpts: false,
			wantStreamSent:    true,
			wantForcedFlag:    true,
			wantIsStream:      false,
			wantStreamOptions: false,
		},
		{
			// Bug-injection: non-OpenAI/Azure channel with force + stream options
			// support. The buggy code unconditionally nils StreamOptions for
			// non-OpenAI/Azure channels, making the IncludeUsage injection
			// dead code. The fix scopes the nil-out with
			// !info.UpstreamStreamForced so the forced-stream path keeps its
			// StreamOptions.
			name:              "force + non-OpenAI channel + stream options support -> StreamOptions preserved",
			clientStream:      lo.ToPtr(false),
			forceUpstream:     true,
			supportStreamOpts: true,
			channelType:       constant.ChannelTypeDeepSeek,
			wantStreamSent:    true,
			wantForcedFlag:    true,
			wantIsStream:      false,
			wantStreamOptions: true,
		},
		{
			// force + non-OpenAI channel + NO stream options support -> StreamOptions stripped.
			// Even in forced-stream mode, if the channel doesn't support
			// StreamOptions, we must nil them to avoid upstream 400 errors.
			name:              "force + non-OpenAI channel + no stream options support -> StreamOptions stripped",
			clientStream:      lo.ToPtr(false),
			forceUpstream:     true,
			supportStreamOpts: false,
			channelType:       constant.ChannelTypeDeepSeek,
			wantStreamSent:    true,
			wantForcedFlag:    true,
			wantIsStream:      false,
			wantStreamOptions: false,
		},
		{
			// nil *bool clientStream should be treated as false (non-stream),
			// matching lo.FromPtrOr's default. Force should still apply.
			name:              "nil clientStream + force -> upstream stream + forced flag",
			clientStream:      nil,
			forceUpstream:     true,
			supportStreamOpts: true,
			channelType:       constant.ChannelTypeOpenAI,
			wantStreamSent:    true,
			wantForcedFlag:    true,
			wantIsStream:      false,
			wantStreamOptions: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)

			chType := tt.channelType
			if chType == 0 {
				chType = constant.ChannelTypeOpenAI
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:         chType,
					UpstreamModelName:   "test-model",
					ChannelSetting:      dto.ChannelSettings{ForceUpstreamStream: tt.forceUpstream},
					SupportStreamOptions: tt.supportStreamOpts,
				},
				RelayFormat: types.RelayFormatOpenAI,
			}

			request := &dto.GeneralOpenAIRequest{
				Model:  "test-model",
				Stream: tt.clientStream,
			}

			adaptor := &Adaptor{ChannelType: chType}
			result, err := adaptor.ConvertOpenAIRequest(c, info, request)
			require.NoError(t, err)

			returnedRequest, ok := result.(*dto.GeneralOpenAIRequest)
			require.True(t, ok, "expected *GeneralOpenAIRequest, got %T", result)

			assert.Equal(t, tt.wantStreamSent, lo.FromPtrOr(returnedRequest.Stream, false),
				"upstream stream field mismatch")
			assert.Equal(t, tt.wantForcedFlag, info.UpstreamStreamForced,
				"UpstreamStreamForced flag mismatch")
			assert.Equal(t, tt.wantIsStream, info.IsStream,
				"info.IsStream must match the original client request, not the forced upstream stream")

			if tt.wantStreamOptions {
				require.NotNil(t, returnedRequest.StreamOptions,
					"StreamOptions should be injected when stream is forced and provider supports it")
				assert.True(t, returnedRequest.StreamOptions.IncludeUsage,
					"StreamOptions.IncludeUsage must be true")
			} else {
				assert.Nil(t, returnedRequest.StreamOptions,
					"StreamOptions must not be injected when stream is not forced or provider does not support it")
			}
		})
	}
}

func TestDoResponse_RoutesForcedStreamToBufferedHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Set a valid streaming timeout to avoid NewTicker panic in OaiStreamHandler
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	// SSE response that OaiBufferedStreamHandler can aggregate
	sseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-x","object":"chat.completion.chunk","created":1,"model":"test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")

	tests := []struct {
		name               string
		upstreamStreamForced bool
		wantJSON             bool // true = buffered handler (JSON), false = stream handler (SSE)
	}{
		{
			name:               "forced stream -> buffered handler (JSON response)",
			upstreamStreamForced: true,
			wantJSON:             true,
		},
		{
			name:               "normal stream -> stream handler (SSE response)",
			upstreamStreamForced: false,
			wantJSON:             false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				StatusCode: 200,
				Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
				Body:       io.NopCloser(bytes.NewReader([]byte(sseBody))),
			}

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequestWithContext(t.Context(), "POST", "/v1/chat/completions", nil)
			c.Set(common.RequestIdKey, "test-req")

			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeOpenAI,
					UpstreamModelName: "test",
				},
				IsStream:             true,
				UpstreamStreamForced: tt.upstreamStreamForced,
				RelayFormat:          types.RelayFormatOpenAI,
			}

			adaptor := &Adaptor{ChannelType: constant.ChannelTypeOpenAI}
			usage, apiErr := adaptor.DoResponse(c, resp, info)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)

			contentType := w.Header().Get("Content-Type")
			body := w.Body.String()
			if tt.wantJSON {
				// Buffered handler produces a single JSON object with
				// Content-Type application/json.
				assert.Contains(t, contentType, "application/json",
					"forced stream route must return application/json")
				assert.Contains(t, body, "chat.completion",
					"expected JSON response from buffered handler")
				assert.NotContains(t, body, "data: ",
					"buffered handler should not produce SSE data: lines")
			} else {
				// Stream handler writes SSE chunks with "data:" prefix
				assert.True(t, strings.Contains(body, "data:") || strings.Contains(contentType, "text/event-stream"),
					"expected SSE response from stream handler, got: %s", body[:min(100, len(body))])
			}
		})
	}
}
