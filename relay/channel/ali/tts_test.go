package ali

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func float64Ptr(v float64) *float64 {
	return &v
}

func TestConvertOpenAITTSRequestToAli(t *testing.T) {
	tests := []struct {
		name      string
		request   dto.AudioRequest
		wantText  string
		wantVoice string
		wantSpeed float64
	}{
		{
			name: "maps openai voice and passes speed",
			request: dto.AudioRequest{
				Model: "qwen-tts",
				Input: "你好，世界",
				Voice: "alloy",
				Speed: float64Ptr(1.25),
			},
			wantText:  "你好，世界",
			wantVoice: "Cherry",
			wantSpeed: 1.25,
		},
		{
			name: "unknown voice passes through",
			request: dto.AudioRequest{
				Model: "cosyvoice-v3",
				Input: "hello",
				Voice: "longxiaochun",
			},
			wantText:  "hello",
			wantVoice: "longxiaochun",
			wantSpeed: 0,
		},
		{
			name: "zero speed is omitted",
			request: dto.AudioRequest{
				Model: "qwen-tts",
				Input: "hi",
				Voice: "nova",
				Speed: float64Ptr(0),
			},
			wantText:  "hi",
			wantVoice: "Luna",
			wantSpeed: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := convertOpenAITTSRequestToAli(tt.request)
			assert.Equal(t, tt.request.Model, got.Model)
			assert.Equal(t, tt.wantText, got.Input.Text)
			assert.Equal(t, tt.wantVoice, got.Input.Voice)
			assert.Equal(t, tt.wantSpeed, got.Input.Speed)
			assert.Equal(t, "Chinese", got.Input.LanguageType)
		})
	}
}

func TestAliTTSGetRequestURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioSpeech,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://dashscope.aliyuncs.com",
		},
	}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", url)
}

func TestConvertAudioRequestRejectsNonSpeech(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioTranscription}

	_, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{Model: "whisper-1"})
	require.Error(t, err)
}

func TestConvertAudioRequestSpeech(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}

	reader, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{
		Model: "qwen-tts",
		Input: "测试文本",
		Voice: "shimmer",
		Speed: float64Ptr(1.5),
	})
	require.NoError(t, err)
	require.NotNil(t, reader)

	body, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Contains(t, string(body), `"model":"qwen-tts"`)
	assert.Contains(t, string(body), `"text":"测试文本"`)
	assert.Contains(t, string(body), `"voice":"Emily"`)
	assert.Contains(t, string(body), `"speed":1.5`)
}

func newAliTTSMockResponse(body string) *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func TestHandleAliTTSResponseBase64Audio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	audioBytes := []byte("fake-mp3-audio-data")
	respBody := `{"output":{"audio":{"data":"` + base64.StdEncoding.EncodeToString(audioBytes) + `"}},"usage":{"characters":42},"request_id":"req-1"}`

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}
	usageAny, apiErr := handleAliTTSResponse(c, newAliTTSMockResponse(respBody), info)
	require.Nil(t, apiErr)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "audio/mpeg", recorder.Header().Get("Content-Type"))
	assert.Equal(t, audioBytes, recorder.Body.Bytes())

	usage, ok := usageAny.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 42, usage.TotalTokens)
	assert.Equal(t, 0, usage.CompletionTokens)
}

func TestHandleAliTTSResponseAudioURLRedirect(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/v1/audio/speech", nil)

	respBody := `{"output":{"audio":{"url":"https://example.com/audio.wav","expires_at":1893456000}},"usage":{"characters":10},"request_id":"req-2"}`

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}
	usageAny, apiErr := handleAliTTSResponse(c, newAliTTSMockResponse(respBody), info)
	require.Nil(t, apiErr)

	assert.Equal(t, http.StatusFound, recorder.Code)
	assert.Equal(t, "https://example.com/audio.wav", recorder.Header().Get("Location"))

	usage, ok := usageAny.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 10, usage.TotalTokens)
}

func TestHandleAliTTSResponseUpstreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	respBody := `{"code":"InvalidParameter","message":"text is empty","request_id":"req-3"}`

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}
	usageAny, apiErr := handleAliTTSResponse(c, newAliTTSMockResponse(respBody), info)
	require.NotNil(t, apiErr)
	assert.Nil(t, usageAny)
	assert.Contains(t, apiErr.Error(), "InvalidParameter")
}

func TestHandleAliTTSResponseNoAudio(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	respBody := `{"output":{},"usage":{"characters":5},"request_id":"req-4"}`

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}
	usageAny, apiErr := handleAliTTSResponse(c, newAliTTSMockResponse(respBody), info)
	require.NotNil(t, apiErr)
	assert.Nil(t, usageAny)
}
