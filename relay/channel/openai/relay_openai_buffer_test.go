package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenaiHandlerBuffersChatCompletionStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"pong"},"finish_reason":null,"logprobs":null}]}

data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.Equal(t, &dto.Usage{PromptTokens: 2, CompletionTokens: 1, TotalTokens: 3}, usage)

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "chatcmpl-test", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Equal(t, "gpt-test", parsed.Model)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, 0, parsed.Choices[0].Index)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "pong", parsed.Choices[0].Message.Content)
	require.Equal(t, "stop", parsed.Choices[0].FinishReason)
	require.Equal(t, 2, parsed.PromptTokens)
	require.Equal(t, 1, parsed.CompletionTokens)
	require.Equal(t, 3, parsed.TotalTokens)
}

func TestOpenaiHandlerBuffersUsageOnlyStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"chatcmpl-usage","object":"chat.completion.chunk","created":456,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":0,"total_tokens":12}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.Equal(t, &dto.Usage{PromptTokens: 12, CompletionTokens: 0, TotalTokens: 12}, usage)

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "chatcmpl-usage", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "", parsed.Choices[0].Message.Content)
	require.Equal(t, "stop", parsed.Choices[0].FinishReason)
	require.Equal(t, 12, parsed.PromptTokens)
	require.Equal(t, 0, parsed.CompletionTokens)
	require.Equal(t, 12, parsed.TotalTokens)
}

func TestOpenaiHandlerBuffersResponsesStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"type":"response.created","response":{"id":"resp-test","created_at":123,"model":"gpt-test"}}

data: {"type":"response.output_text.delta","delta":"po"}

data: {"type":"response.output_text.delta","delta":"ng"}

data: {"type":"response.completed","response":{"id":"resp-test","object":"response","created_at":123,"model":"gpt-test","output":[{"id":"msg-1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"pong"}]}],"usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.NotNil(t, usage)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 1, usage.CompletionTokens)
	require.Equal(t, 3, usage.TotalTokens)
	require.Equal(t, 2, usage.InputTokens)
	require.Equal(t, 1, usage.OutputTokens)

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "resp-test", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Equal(t, "gpt-test", parsed.Model)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "pong", parsed.Choices[0].Message.Content)
	require.Equal(t, "stop", parsed.Choices[0].FinishReason)
	require.Equal(t, 2, parsed.PromptTokens)
	require.Equal(t, 1, parsed.CompletionTokens)
	require.Equal(t, 3, parsed.TotalTokens)
	require.Equal(t, 2, parsed.InputTokens)
	require.Equal(t, 1, parsed.OutputTokens)
}

func TestConvertOpenAIRequestForcesGPT5NonStreamUpstreamStream(t *testing.T) {
	stream := false
	req := &dto.GeneralOpenAIRequest{
		Model:  "gpt-5.4-mini",
		Stream: &stream,
		Messages: []dto.Message{
			{Role: "user", Content: "ping"},
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-5.4-mini",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          constant.ChannelTypeOpenAI,
			UpstreamModelName:    "gpt-5.4-mini",
			SupportStreamOptions: true,
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, req)

	require.NoError(t, err)
	convertedReq := converted.(*dto.GeneralOpenAIRequest)
	require.False(t, info.IsStream)
	require.NotNil(t, convertedReq.Stream)
	require.True(t, *convertedReq.Stream)
	require.NotNil(t, convertedReq.StreamOptions)
	require.True(t, convertedReq.StreamOptions.IncludeUsage)
}

func TestConvertOpenAIRequestKeepsNonGPT5NonStreamRequest(t *testing.T) {
	stream := false
	req := &dto.GeneralOpenAIRequest{
		Model:  "gpt-4o",
		Stream: &stream,
		Messages: []dto.Message{
			{Role: "user", Content: "ping"},
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: "gpt-4o",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, req)

	require.NoError(t, err)
	convertedReq := converted.(*dto.GeneralOpenAIRequest)
	require.NotNil(t, convertedReq.Stream)
	require.False(t, *convertedReq.Stream)
	require.Nil(t, convertedReq.StreamOptions)
}

func TestOpenaiImageStreamHandlerForwardsSSEAndExtractsUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		IsStream:        true,
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: "gpt-image-2",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: "gpt-image-2",
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"type":"image_generation.partial_image","partial_image_index":0,"b64_json":"abc"}

data: {"type":"image_generation.completed","usage":{"input_tokens":3,"output_tokens":5,"total_tokens":8,"input_tokens_details":{"image_tokens":2,"text_tokens":1}}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandlerWithUsage(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), `data: {"type":"image_generation.partial_image"`)
	require.Contains(t, recorder.Body.String(), `data: {"type":"image_generation.completed"`)
	require.Contains(t, recorder.Body.String(), `data: [DONE]`)
	require.Equal(t, &dto.Usage{
		PromptTokens:     3,
		CompletionTokens: 5,
		TotalTokens:      8,
		InputTokens:      3,
		OutputTokens:     5,
		InputTokensDetails: &dto.InputTokenDetails{
			ImageTokens: 2,
			TextTokens:  1,
		},
		PromptTokensDetails: dto.InputTokenDetails{
			ImageTokens: 2,
			TextTokens:  1,
		},
	}, usage)
}

func TestOpenaiImageJSONToStreamHandlerWrapsFinalResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		IsStream:        true,
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: "gpt-image-2",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: "gpt-image-2",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"application/json"},
		},
		Body: io.NopCloser(strings.NewReader(`{"created":123,"data":[{"b64_json":"abc"}],"usage":{"input_tokens":2,"output_tokens":4,"total_tokens":6}}`)),
	}

	usage, newAPIError := OpenaiHandlerWithUsage(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "text/event-stream")
	require.Contains(t, recorder.Body.String(), `data: {"created":123`)
	require.Contains(t, recorder.Body.String(), `data: [DONE]`)
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 4, usage.CompletionTokens)
	require.Equal(t, 6, usage.TotalTokens)
}

func newChatCompletionSSE(statusCode int, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Header: http.Header{
			"Content-Type": []string{" Text/Event-Stream; charset=utf-8"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}
