package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

const (
	whitelabelOriginModel   = "flatkey-llama-3.1-70b" // client-requested name
	whitelabelUpstreamModel = "llama3.1:70b"          // leaked upstream/engine name
)

// sample upstream chunk from a self-hosted Ollama-backed compute channel:
// leaks both system_fingerprint=fp_ollama and the upstream model name.
const whitelabelUpstreamStreamChunk = `{"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1700000000,"model":"llama3.1:70b","system_fingerprint":"fp_ollama","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}`

// sample upstream non-streaming body with the same leaks.
const whitelabelUpstreamJSONBody = `{"id":"chatcmpl-abc","object":"chat.completion","created":1700000000,"model":"llama3.1:70b","system_fingerprint":"fp_ollama","choices":[{"index":0,"message":{"role":"assistant","content":"hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}`

func newTestRelayInfo(whitelabel bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: whitelabelOriginModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: whitelabelUpstreamModel,
			ChannelSetting: dto.ChannelSettings{
				WhitelabelUpstream: whitelabel,
			},
		},
	}
}

// scrubWhitelabelStreamResponse: model forced to origin name, fingerprint cleared.
func TestScrubWhitelabelStreamResponse(t *testing.T) {
	var resp dto.ChatCompletionsStreamResponse
	require.NoError(t, common.UnmarshalJsonStr(whitelabelUpstreamStreamChunk, &resp))
	require.Equal(t, whitelabelUpstreamModel, resp.Model)
	require.Equal(t, "fp_ollama", resp.GetSystemFingerprint())

	scrubWhitelabelStreamResponse(&resp, newTestRelayInfo(true))

	require.Equal(t, whitelabelOriginModel, resp.Model)
	require.Nil(t, resp.SystemFingerprint)
	require.Equal(t, "", resp.GetSystemFingerprint())
}

// Streaming chunk path: flag ON scrubs, flag OFF passes through byte-for-byte.
func TestSendStreamData_Whitelabel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("flag on scrubs fingerprint and model", func(t *testing.T) {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		err := sendStreamData(c, newTestRelayInfo(true), whitelabelUpstreamStreamChunk, false, false)
		require.NoError(t, err)

		out := rec.Body.String()
		require.NotContains(t, out, "fp_ollama")
		require.NotContains(t, out, whitelabelUpstreamModel)
		require.Contains(t, out, whitelabelOriginModel)
	})

	t.Run("flag off passes upstream through unchanged", func(t *testing.T) {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		err := sendStreamData(c, newTestRelayInfo(false), whitelabelUpstreamStreamChunk, false, false)
		require.NoError(t, err)

		out := rec.Body.String()
		// off => raw passthrough, upstream leaks preserved (zero behavior change)
		require.Contains(t, out, "fp_ollama")
		require.Contains(t, out, whitelabelUpstreamModel)
		require.NotContains(t, out, whitelabelOriginModel)
	})
}

func newUpstreamResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// Non-streaming handler: flag ON scrubs fingerprint + forces origin model while
// preserving other fields; flag OFF leaves the upstream body untouched.
func TestOpenaiHandler_Whitelabel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("flag on scrubs body", func(t *testing.T) {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		_, apiErr := OpenaiHandler(c, newTestRelayInfo(true), newUpstreamResponse(whitelabelUpstreamJSONBody))
		require.Nil(t, apiErr)

		out := rec.Body.String()
		require.NotContains(t, out, "fp_ollama")
		require.NotContains(t, out, "system_fingerprint")
		require.NotContains(t, out, whitelabelUpstreamModel)
		require.Contains(t, out, whitelabelOriginModel)
		// unrelated content preserved
		require.Contains(t, out, `"hi"`)
	})

	t.Run("flag off leaves body unchanged", func(t *testing.T) {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		_, apiErr := OpenaiHandler(c, newTestRelayInfo(false), newUpstreamResponse(whitelabelUpstreamJSONBody))
		require.Nil(t, apiErr)

		out := rec.Body.String()
		require.Contains(t, out, "fp_ollama")
		require.Contains(t, out, whitelabelUpstreamModel)
		require.NotContains(t, out, whitelabelOriginModel)
	})
}
