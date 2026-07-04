package minimax

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLForImageGeneration(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.minimax.chat",
		},
	}

	got, err := GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://api.minimax.chat/v1/image_generation"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}
}

func TestConvertImageRequest(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "image-01",
	}
	request := dto.ImageRequest{
		Model:          "image-01",
		Prompt:         "a red fox in snowfall",
		Size:           "1536x1024",
		ResponseFormat: "url",
		N:              uintPtr(2),
	}

	got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}

	if payload["model"] != "image-01" {
		t.Fatalf("model = %#v, want %q", payload["model"], "image-01")
	}
	if payload["prompt"] != request.Prompt {
		t.Fatalf("prompt = %#v, want %q", payload["prompt"], request.Prompt)
	}
	if payload["n"] != float64(2) {
		t.Fatalf("n = %#v, want 2", payload["n"])
	}
	if payload["aspect_ratio"] != "3:2" {
		t.Fatalf("aspect_ratio = %#v, want %q", payload["aspect_ratio"], "3:2")
	}
	if payload["response_format"] != "url" {
		t.Fatalf("response_format = %#v, want %q", payload["response_format"], "url")
	}
}

func TestDoResponseForImageGeneration(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		StartTime: time.Unix(1700000000, 0),
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       httptest.NewRecorder().Result().Body,
	}
	resp.Body = ioNopCloser(`{"data":{"image_urls":["https://example.com/minimax.png"]}}`)

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)
	if err != nil {
		t.Fatalf("DoResponse returned error: %v", err)
	}
	if usage == nil {
		t.Fatalf("DoResponse returned nil usage")
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"url":"https://example.com/minimax.png"`) {
		t.Fatalf("response body = %s, want OpenAI image response with image URL", body)
	}
	if strings.Contains(body, `"image_urls"`) {
		t.Fatalf("response body = %s, should not expose raw MiniMax image_urls payload", body)
	}
}

func TestDoResponseForOpenAITextStripsMiniMaxFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "minimax-text-test")

	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "MiniMax-M3",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body: ioNopCloser(`{
			"id":"chatcmpl-minimax",
			"object":"chat.completion",
			"created":1710000000,
			"model":"MiniMax-M3",
			"choices":[{
				"index":0,
				"message":{
					"role":"assistant",
					"content":"hello",
					"name":"MiniMax AI",
					"audio_content":""
				},
				"finish_reason":"stop"
			}],
			"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3},
			"input_sensitive":false,
			"output_sensitive":false,
			"input_sensitive_type":0,
			"output_sensitive_type":0,
			"output_sensitive_int":0,
			"service_tier":"standard",
			"base_resp":{"status_code":0,"status_msg":""}
		}`),
	}

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)

	require.Nil(t, err)
	require.NotNil(t, usage)
	body := recorder.Body.String()
	assert.Contains(t, body, `"object":"chat.completion"`)
	assert.Contains(t, body, `"content":"hello"`)
	assert.Contains(t, body, `"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3`)
	assert.NotContains(t, body, `"input_sensitive"`)
	assert.NotContains(t, body, `"output_sensitive"`)
	assert.NotContains(t, body, `"service_tier"`)
	assert.NotContains(t, body, `"base_resp"`)
	assert.NotContains(t, body, `"name"`)
	assert.NotContains(t, body, `"audio_content"`)
}

func TestDoResponseForOpenAIStreamStripsMiniMaxFieldsAndMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := appconstant.StreamingTimeout
	appconstant.StreamingTimeout = 30
	t.Cleanup(func() { appconstant.StreamingTimeout = oldTimeout })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "minimax-stream-test")

	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		IsStream:    true,
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "MiniMax-M3",
		},
	}
	streamBody := strings.Join([]string{
		`data: {"id":"chatcmpl-minimax","object":"chat.completion.chunk","created":1710000000,"model":"MiniMax-M3","choices":[{"index":0,"delta":{"role":"assistant","name":"MiniMax AI","audio_content":""},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-minimax","object":"chat.completion.chunk","created":1710000000,"model":"MiniMax-M3","choices":[{"index":0,"delta":{"content":"hello","reasoning_content":"thinking"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-minimax","object":"chat.completion.chunk","created":1710000000,"model":"MiniMax-M3","choices":[{"index":0,"delta":{},"message":{"role":"assistant","content":"hello","name":"MiniMax AI","audio_content":""},"finish_reason":"stop"}]}`,
		`data: [DONE]`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       ioNopCloser(streamBody),
	}

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)

	require.Nil(t, err)
	require.NotNil(t, usage)
	body := recorder.Body.String()
	assert.Contains(t, body, `"role":"assistant"`)
	assert.Contains(t, body, `"content":"hello"`)
	assert.Contains(t, body, `"reasoning_content":"thinking"`)
	assert.Contains(t, body, `"finish_reason":"stop"`)
	assert.Contains(t, body, `data: [DONE]`)
	assert.NotContains(t, body, `"message"`)
	assert.NotContains(t, body, `"name"`)
	assert.NotContains(t, body, `"audio_content"`)
}

type nopReadCloser struct {
	*strings.Reader
}

func (n nopReadCloser) Close() error {
	return nil
}

func ioNopCloser(body string) nopReadCloser {
	return nopReadCloser{Reader: strings.NewReader(body)}
}

func uintPtr(v uint) *uint {
	return &v
}
