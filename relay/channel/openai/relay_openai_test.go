package openai

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// buildAudioSSE constructs an SSE stream body that mimics OpenAI audio model
// streaming behavior: usage info appears in the second-to-last data chunk.
//
// Layout: chunk1 (content) -> chunk2 (content + usage) -> chunk3 (finish) -> [DONE]
// After processing, secondLastStreamData = chunk2 (carries usage).
func buildAudioSSE(upstreamModel string, usage dto.Usage) []byte {
	var b bytes.Buffer

	// Chunk 1: content delta
	b.WriteString(fmt.Sprintf(`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"%s","choices":[{"index":0,"delta":{"content":"Hello"}}]}`, upstreamModel))
	b.WriteString("\n\n")

	// Chunk 2: content + usage (second-to-last -> becomes secondLastStreamData)
	b.WriteString(fmt.Sprintf(`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"%s","choices":[{"index":0,"delta":{"content":" world"}}],"usage":{"prompt_tokens":%d,"completion_tokens":%d,"total_tokens":%d}}`,
		upstreamModel, usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens))
	b.WriteString("\n\n")

	// Chunk 3: finish (last -> becomes lastStreamData, no usage)
	b.WriteString(fmt.Sprintf(`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"%s","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`, upstreamModel))
	b.WriteString("\n\n")

	b.WriteString("data: [DONE]\n\n")
	return b.Bytes()
}

type nopCloser struct{ io.Reader }

func (nopCloser) Close() error { return nil }

// TestOaiStreamHandler_AudioModelDetection_MappedModel verifies that when the
// caller model name does not contain "audio" but the upstream model is an audio
// model (model_mapping scenario), the handler still extracts usage from the
// second-to-last SSE chunk instead of falling back to text-based estimation.
func TestOaiStreamHandler_AudioModelDetection_MappedModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })

	callerModel := "my-voice-bot"
	upstreamModel := "gpt-4o-audio-preview"

	upstreamUsage := dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	sseBody := buildAudioSSE(upstreamModel, upstreamUsage)
	resp := &http.Response{
		Body:   nopCloser{strings.NewReader(string(sseBody))},
		Header: make(http.Header),
	}
	resp.Header.Set("Content-Type", "text/event-stream")

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: callerModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: upstreamModel,
		},
		RelayMode: relayconstant.RelayModeChatCompletions,
	}
	info.SetEstimatePromptTokens(10)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr, "OaiStreamHandler should not return an error")
	require.NotNil(t, usage, "usage should not be nil")

	require.Equal(t, 100, usage.PromptTokens,
		"PromptTokens should match upstream audio usage (not estimated)")
	require.Equal(t, 50, usage.CompletionTokens,
		"CompletionTokens should match upstream audio usage (not estimated)")
	require.Equal(t, 150, usage.TotalTokens,
		"TotalTokens should match upstream audio usage (not estimated)")
}

// TestOaiStreamHandler_AudioModelDetection_CallerModelContainsAudio verifies
// that when the caller model itself contains "audio", usage is also extracted
// correctly. This serves as a control case ensuring both paths converge.
func TestOaiStreamHandler_AudioModelDetection_CallerModelContainsAudio(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })

	callerModel := "gpt-4o-audio-preview"
	upstreamModel := "gpt-4o-audio-preview"

	upstreamUsage := dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	sseBody := buildAudioSSE(upstreamModel, upstreamUsage)
	resp := &http.Response{
		Body:   nopCloser{strings.NewReader(string(sseBody))},
		Header: make(http.Header),
	}
	resp.Header.Set("Content-Type", "text/event-stream")

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: callerModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: upstreamModel,
		},
		RelayMode: relayconstant.RelayModeChatCompletions,
	}
	info.SetEstimatePromptTokens(10)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	require.Equal(t, 100, usage.PromptTokens)
	require.Equal(t, 50, usage.CompletionTokens)
	require.Equal(t, 150, usage.TotalTokens)
}

// TestOaiStreamHandler_NonAudioModel_SkipsSecondLastUsage verifies that for a
// non-audio model, the second-to-last usage is NOT extracted (the fallback
// text-based estimation path is used instead).
func TestOaiStreamHandler_NonAudioModel_SkipsSecondLastUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })

	callerModel := "gpt-4o"
	upstreamModel := "gpt-4o"

	upstreamUsage := dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 50,
		TotalTokens:      150,
	}

	sseBody := buildAudioSSE(upstreamModel, upstreamUsage)
	resp := &http.Response{
		Body:   nopCloser{strings.NewReader(string(sseBody))},
		Header: make(http.Header),
	}
	resp.Header.Set("Content-Type", "text/event-stream")

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: callerModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: upstreamModel,
		},
		RelayMode: relayconstant.RelayModeChatCompletions,
	}
	info.SetEstimatePromptTokens(10)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	// Non-audio model should NOT use the second-to-last chunk's usage;
	// it falls through to text-based estimation or last-chunk usage.
	require.Equal(t, 10, usage.PromptTokens,
		"Non-audio model should use estimated prompt tokens, not second-to-last usage")
}
