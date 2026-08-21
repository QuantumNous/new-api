package codex

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLAlphaSearch(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeCodex,
			ChannelBaseUrl: "https://chatgpt.com",
		},
		RelayMode: relayconstant.RelayModeAlphaSearch,
	}

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://chatgpt.com/backend-api/codex/alpha/search", url)
}

// The Codex backend rejects these fields, so the adaptor clears them rather
// than forwarding what the client sent.
func TestConvertOpenAIResponsesRequestDropsPenalties(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeCodex},
		RelayMode:   relayconstant.RelayModeResponses,
	}

	converted, err := adaptor.ConvertOpenAIResponsesRequest(nil, info, dto.OpenAIResponsesRequest{
		Model:            "gpt-5-codex",
		Input:            json.RawMessage(`"hello"`),
		MaxOutputTokens:  lo.ToPtr(uint(128)),
		Temperature:      lo.ToPtr(1.0),
		FrequencyPenalty: json.RawMessage(`1.5`),
		PresencePenalty:  json.RawMessage(`1.5`),
	})
	require.NoError(t, err)

	request, ok := converted.(dto.OpenAIResponsesRequest)
	require.True(t, ok)
	assert.Nil(t, request.MaxOutputTokens)
	assert.Nil(t, request.Temperature)
	assert.Nil(t, request.FrequencyPenalty)
	assert.Nil(t, request.PresencePenalty)
}

func TestDoRequestForcesStreamInFinalResponsesBody(t *testing.T) {
	type capturedRequest struct {
		body   []byte
		accept string
		path   string
	}
	captured := make(chan capturedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		captured <- capturedRequest{
			body:   body,
			accept: r.Header.Get("Accept"),
			path:   r.URL.Path,
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("Content-Type", "application/json")

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeCodex,
			ChannelBaseUrl: server.URL,
			ApiKey:         `{"access_token":"token","account_id":"account"}`,
		},
		RelayMode: relayconstant.RelayModeResponses,
		IsStream:  false,
	}

	tests := []struct {
		name string
		body string
	}{
		{
			name: "explicit false from client or parameter override",
			body: `{"model":"gpt-5-codex","stream":false,"provider_extension":{"keep":1}}`,
		},
		{
			name: "stream omitted by passthrough body",
			body: `{"model":"gpt-5-codex","provider_extension":{"keep":1}}`,
		},
		{
			name: "duplicate stream fields in passthrough body",
			body: `{"model":"gpt-5-codex","stream":false,"stream":false,"provider_extension":{"keep":1}}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			respAny, err := adaptor.DoRequest(c, info, strings.NewReader(tt.body))
			require.NoError(t, err)
			resp, ok := respAny.(*http.Response)
			require.True(t, ok)
			require.NoError(t, resp.Body.Close())

			got := <-captured
			assert.Equal(t, "/backend-api/codex/responses", got.path)
			assert.Equal(t, "text/event-stream", got.accept)

			var body map[string]json.RawMessage
			require.NoError(t, common.Unmarshal(got.body, &body))
			assert.JSONEq(t, `true`, string(body["stream"]))
			assert.JSONEq(t, `{"keep":1}`, string(body["provider_extension"]))
		})
	}
}

func TestDoRequestRejectsNullResponsesBody(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeResponses}

	var err error
	require.NotPanics(t, func() {
		_, err = adaptor.DoRequest(nil, info, strings.NewReader("null"))
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JSON object")
}

// Regression test for upstream 400 "Stream must be set to true": a non-stream
// client on a Codex channel receives an SSE upstream response (stream is forced
// upstream) that must be buffered into a single aggregated JSON response.
func TestDoResponseBuffersUpstreamSSEForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		`data: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-5-codex","status":"completed","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":5,"output_tokens":7,"total_tokens":12}}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeCodex,
			UpstreamModelName: "gpt-5-codex",
		},
		RelayMode:       relayconstant.RelayModeResponses,
		IsStream:        false,
		OriginModelName: "gpt-5-codex",
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usageAny, apiErr := adaptor.DoResponse(c, resp, info)
	require.Nil(t, apiErr)
	usage, ok := usageAny.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 5, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 12, usage.TotalTokens)

	got := w.Body.String()
	assert.NotContains(t, got, "data:")
	assert.Contains(t, got, `"id":"resp_1"`)
	assert.Contains(t, got, `"text":"hello"`)
}

// If the upstream ever answers a non-stream request with plain JSON, the
// adaptor must keep passing it through instead of misreading it as SSE.
func TestDoResponseNonStreamPassesThroughJSONResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"id":"resp_2","model":"gpt-5-codex","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}`

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeCodex,
			UpstreamModelName: "gpt-5-codex",
		},
		RelayMode:       relayconstant.RelayModeResponses,
		IsStream:        false,
		OriginModelName: "gpt-5-codex",
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	usageAny, apiErr := adaptor.DoResponse(c, resp, info)
	require.Nil(t, apiErr)
	usage, ok := usageAny.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 3, usage.TotalTokens)
	assert.Contains(t, w.Body.String(), `"id":"resp_2"`)
}
