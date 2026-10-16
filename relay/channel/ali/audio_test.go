package ali

import (
	"bytes"
	"encoding/binary"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func newAliAudioRequestContext(t *testing.T, fields map[string]string, filename string, fileContent []byte) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	if filename != "" {
		part, err := writer.CreateFormFile("file", filename)
		require.NoError(t, err)
		_, err = part.Write(fileContent)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c, recorder
}

func newAliAudioRelayInfo(request dto.AudioRequest) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		Request:   &request,
		RelayMode: constant.RelayModeAudioTranscription,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://dashscope.aliyuncs.com",
			UpstreamModelName: "qwen-audio-3.0-asr-flash",
			ApiKey:            "test-key",
		},
		StartTime: time.Now(),
	}
}

func TestAliAudioTranscriptionProtocolFor(t *testing.T) {
	tests := []struct {
		model    string
		protocol aliAudioTranscriptionProtocol
	}{
		{"qwen-audio-3.0-asr-flash", aliAudioTranscriptionProtocolLegacyMultimodal},
		{"fun-asr-flash-2026-06-15", aliAudioTranscriptionProtocolLegacyMultimodal},
		{"qwen3-asr-flash", aliAudioTranscriptionProtocolQwenASRMultimodal},
		{"qwen3-asr-flash-us", aliAudioTranscriptionProtocolQwenASRMultimodal},
		{"fun-asr", aliAudioTranscriptionProtocolUnsupported},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			assert.Equal(t, tt.protocol, aliAudioTranscriptionProtocolFor(tt.model))
		})
	}
}

func TestConvertAliAudioTranscriptionRequest(t *testing.T) {
	c, _ := newAliAudioRequestContext(t, map[string]string{
		"model":           "customer-asr",
		"language":        "zh",
		"prompt":          "品牌名：百炼",
		"response_format": "json",
	}, "clip.mp3", []byte("audio-bytes"))
	request := dto.AudioRequest{Model: "customer-asr", ResponseFormat: "json"}
	info := newAliAudioRelayInfo(request)

	converted, err := (&Adaptor{}).ConvertAudioRequest(c, info, request)
	require.NoError(t, err)
	body, err := io.ReadAll(converted)
	require.NoError(t, err)

	assert.Equal(t, "qwen-audio-3.0-asr-flash", gjson.GetBytes(body, "model").String())
	assert.Equal(t, "mp3", gjson.GetBytes(body, "parameters.format").String())
	assert.Equal(t, "zh", gjson.GetBytes(body, "parameters.language_hints.0").String())
	assert.Equal(t, "input_text", gjson.GetBytes(body, "input.messages.0.content.0.type").String())
	assert.Equal(t, "品牌名：百炼", gjson.GetBytes(body, "input.messages.0.content.0.text").String())
	assert.Equal(t, "input_audio", gjson.GetBytes(body, "input.messages.1.content.0.type").String())
	assert.Equal(t, "data:audio/mpeg;base64,YXVkaW8tYnl0ZXM=", gjson.GetBytes(body, "input.messages.1.content.0.input_audio.data").String())

	header := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer test-key", header.Get("Authorization"))
	assert.Equal(t, "application/json", header.Get("Content-Type"))
	assert.Equal(t, "disable", header.Get("X-DashScope-SSE"))
	info.IsStream = true
	streamHeader := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &streamHeader, info))
	assert.Equal(t, "enable", streamHeader.Get("X-DashScope-SSE"))
	assert.Equal(t, "text/event-stream", streamHeader.Get("Accept"))

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", requestURL)
}

func TestConvertAliAudioTranscriptionRequestIncludesWAVSampleRate(t *testing.T) {
	wav := make([]byte, 44)
	copy(wav, "RIFF")
	copy(wav[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(wav[16:20], 16)
	binary.LittleEndian.PutUint32(wav[24:28], 16000)
	copy(wav[36:], "data")

	c, _ := newAliAudioRequestContext(t, map[string]string{
		"model": "qwen-audio-3.0-asr-flash",
	}, "asr_zh.wav", wav)
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json"}
	converted, err := (&Adaptor{}).ConvertAudioRequest(c, newAliAudioRelayInfo(request), request)
	require.NoError(t, err)
	body, err := io.ReadAll(converted)
	require.NoError(t, err)

	assert.Equal(t, "wav", gjson.GetBytes(body, "parameters.format").String())
	assert.Equal(t, "16000", gjson.GetBytes(body, "parameters.sample_rate").String())
}

func TestConvertAliQwenASRTranscriptionRequest(t *testing.T) {
	c, _ := newAliAudioRequestContext(t, map[string]string{
		"model":    "qwen3-asr-flash",
		"language": "zh",
	}, "clip.mp3", []byte("audio-bytes"))
	request := dto.AudioRequest{Model: "qwen3-asr-flash", ResponseFormat: "json"}
	info := newAliAudioRelayInfo(request)
	info.UpstreamModelName = "qwen3-asr-flash"

	converted, err := (&Adaptor{}).ConvertAudioRequest(c, info, request)
	require.NoError(t, err)
	body, err := io.ReadAll(converted)
	require.NoError(t, err)

	assert.Equal(t, "qwen3-asr-flash", gjson.GetBytes(body, "model").String())
	assert.Equal(t, "data:audio/mpeg;base64,YXVkaW8tYnl0ZXM=", gjson.GetBytes(body, "input.messages.0.content.0.audio").String())
	assert.Equal(t, "zh", gjson.GetBytes(body, "parameters.asr_options.language").String())

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", requestURL)
}

func TestConvertAliAudioTranscriptionRequestRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name           string
		fields         map[string]string
		filename       string
		fileContent    []byte
		responseFormat string
		wantError      string
	}{
		{
			name:           "missing file",
			fields:         map[string]string{"model": "qwen-audio-3.0-asr-flash"},
			responseFormat: "json",
			wantError:      "file is required",
		},
		{
			name:           "unsupported response format",
			fields:         map[string]string{"model": "qwen-audio-3.0-asr-flash"},
			filename:       "clip.mp3",
			fileContent:    []byte("audio"),
			responseFormat: "srt",
			wantError:      "response_format",
		},
		{
			name:           "data URI too large",
			fields:         map[string]string{"model": "qwen-audio-3.0-asr-flash"},
			filename:       "clip.wav",
			fileContent:    bytes.Repeat([]byte("a"), 8<<20),
			responseFormat: "json",
			wantError:      "too large",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := newAliAudioRequestContext(t, tt.fields, tt.filename, tt.fileContent)
			request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: tt.responseFormat}
			_, err := (&Adaptor{}).ConvertAudioRequest(c, newAliAudioRelayInfo(request), request)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantError)
		})
	}

	c, _ := newAliAudioRequestContext(t, map[string]string{"model": "qwen-audio-3.0-asr-flash"}, "clip.mp3", []byte("audio"))
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json"}
	info := newAliAudioRelayInfo(request)
	info.RelayMode = constant.RelayModeAudioTranslation
	_, err := (&Adaptor{}).ConvertAudioRequest(c, info, request)
	require.EqualError(t, err, "Ali audio adaptor supports transcription only")
}

func TestAliAudioTranscriptionResponseHandler(t *testing.T) {
	tests := []struct {
		name            string
		responseFormat  string
		wantBody        string
		wantContentType string
	}{
		{
			name:            "json",
			responseFormat:  "json",
			wantBody:        `{"text":"你好，百炼。"}`,
			wantContentType: "application/json",
		},
		{
			name:            "text",
			responseFormat:  "text",
			wantBody:        "你好，百炼。",
			wantContentType: "text/plain; charset=utf-8",
		},
		{
			name:            "verbose json",
			responseFormat:  "verbose_json",
			wantBody:        `{"task":"transcribe","duration":60,"text":"你好，百炼。","segments":[{"id":1,"start":0,"end":1.2,"text":"你好，百炼。","words":[{"word":"你好","start":0,"end":0.5}]}]}`,
			wantContentType: "application/json",
		},
	}
	upstreamBody := `{"output":{"text":"你好，百炼。","sentence":{"sentence_id":1,"sentence_end":true,"begin_time":0,"end_time":1200,"text":"你好，百炼。","words":[{"text":"你好","begin_time":0,"end_time":500}]}},"usage":{"duration":60}}`

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
			request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: tt.responseFormat}
			info := newAliAudioRelayInfo(request)
			response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(upstreamBody))}

			usage, apiErr := aliAudioTranscriptionHandler(c, response, info)
			require.Nil(t, apiErr)
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, tt.wantContentType, recorder.Header().Get("Content-Type"))
			if tt.responseFormat == "text" {
				assert.Equal(t, tt.wantBody, recorder.Body.String())
			} else {
				assert.JSONEq(t, tt.wantBody, recorder.Body.String())
			}
			usageData, ok := usage.(*dto.Usage)
			require.True(t, ok)
			assert.Equal(t, 1000, usageData.PromptTokens)
			assert.Equal(t, 1000, usageData.PromptTokensDetails.AudioTokens)
		})
	}
}

func TestAliAudioTranscriptionResponseHandlerAcceptsNestedSentence(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	request := dto.AudioRequest{Model: "fun-asr-flash-2026-06-15", ResponseFormat: "verbose_json"}
	info := newAliAudioRelayInfo(request)
	info.UpstreamModelName = "fun-asr-flash-2026-06-15"
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"output":{"text":"你好，百炼。","output":{"sentence":{"sentence_id":1,"sentence_end":true,"begin_time":0,"end_time":1200,"text":"你好，百炼。"}}},"usage":{"duration":2}}`)),
	}

	_, apiErr := aliAudioTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.JSONEq(t, `{"task":"transcribe","duration":2,"text":"你好，百炼。","segments":[{"id":1,"start":0,"end":1.2,"text":"你好，百炼。"}]}`, recorder.Body.String())
}

func TestAliQwenASRTranscriptionResponseHandler(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	request := dto.AudioRequest{Model: "qwen3-asr-flash", ResponseFormat: "verbose_json"}
	info := newAliAudioRelayInfo(request)
	info.UpstreamModelName = "qwen3-asr-flash"
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"output":{"choices":[{"message":{"content":[{"text":"你好，百炼。"}]}}]},"usage":{"seconds":2}}`)),
	}

	usage, apiErr := aliQwenASRTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"task":"transcribe","duration":2,"text":"你好，百炼。"}`, recorder.Body.String())
	usageData, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 33, usageData.PromptTokens)
	assert.Equal(t, 33, usageData.PromptTokensDetails.AudioTokens)
}

func TestAliAudioTranscriptionStreamHandler(t *testing.T) {
	streamBody := strings.Join([]string{
		`event: result`,
		`data: {"output":{"text":"你好","sentence":{"sentence_id":1,"sentence_end":true,"text":"你好"}},"usage":{"duration":1}}`,
		``,
		`data: {"output":{"text":"你好，百炼。","sentence":{"sentence_id":1,"sentence_end":true,"text":"你好"}},"usage":{"duration":2}}`,
		``,
		`data: {"output":{"text":"你好，百炼。","sentence":{"sentence_id":2,"sentence_end":true,"text":"，百炼。"}},"usage":{"duration":2}}`,
		``,
	}, "\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	stream := true
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json", Stream: &stream}
	info := newAliAudioRelayInfo(request)
	info.IsStream = true
	response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(streamBody))}

	usage, apiErr := aliAudioTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"delta":"你好"`))
	assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"delta":"，百炼。"`))
	assert.Contains(t, recorder.Body.String(), `event: transcript.text.done`)
	assert.Contains(t, recorder.Body.String(), `"text":"你好，百炼。"`)
	assert.Contains(t, recorder.Body.String(), `"seconds":2`)
	usageData, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 33, usageData.PromptTokens)
	assert.Equal(t, 33, usageData.PromptTokensDetails.AudioTokens)
}

func TestAliAudioTranscriptionStreamHandlerAcceptsJSONFallback(t *testing.T) {
	upstreamBody := `{"sentence":{"sentence_id":1,"begin_time":560,"end_time":3920,"text":"甚至出现交易几乎停滞的情况。","sentence_end":true},"text":"甚至出现交易几乎停滞的情况。","output":{"sentence":{"sentence_id":1,"begin_time":560,"end_time":3920,"text":"甚至出现交易几乎停滞的情况。","sentence_end":true},"text":"甚至出现交易几乎停滞的情况。"},"usage":{"duration":4}}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	stream := true
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json", Stream: &stream}
	info := newAliAudioRelayInfo(request)
	info.IsStream = true
	response := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json; charset=utf-8"}},
		Body:       io.NopCloser(strings.NewReader(upstreamBody)),
	}

	usage, apiErr := aliAudioTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.Contains(t, recorder.Body.String(), `event: transcript.text.delta`)
	assert.Contains(t, recorder.Body.String(), `"delta":"甚至出现交易几乎停滞的情况。"`)
	assert.Contains(t, recorder.Body.String(), `event: transcript.text.done`)
	assert.Contains(t, recorder.Body.String(), `"text":"甚至出现交易几乎停滞的情况。"`)
	assert.Contains(t, recorder.Body.String(), `"seconds":4`)
	usageData, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 67, usageData.PromptTokensDetails.AudioTokens)
}

func TestAliAudioTranscriptionStreamHandlerUsesChoicesTextFallback(t *testing.T) {
	streamBody := strings.Join([]string{
		`data: {"output":{"choices":[{"message":{"content":[{"text":"甚至出现"}]}}]}}`,
		``,
		`data: {"output":{"choices":[{"message":{"content":[{"text":"甚至出现交易几乎停滞的情况。"}]}}]},"usage":{"duration":4}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	stream := true
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json", Stream: &stream}
	info := newAliAudioRelayInfo(request)
	info.IsStream = true
	response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(streamBody))}

	_, apiErr := aliAudioTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.Contains(t, recorder.Body.String(), `"delta":"甚至出现"`)
	assert.Contains(t, recorder.Body.String(), `"delta":"交易几乎停滞的情况。"`)
	assert.Contains(t, recorder.Body.String(), `"text":"甚至出现交易几乎停滞的情况。"`)
}

func TestAliAudioTranscriptionStreamHandlerUsesOpenAIStyleDeltaFallback(t *testing.T) {
	streamBody := strings.Join([]string{
		`data: {"choices":[{"delta":{"content":"甚至出现"}}]}`,
		``,
		`data: {"choices":[{"delta":{"content":"交易几乎停滞的情况。"}}]}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", nil)
	stream := true
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash", ResponseFormat: "json", Stream: &stream}
	info := newAliAudioRelayInfo(request)
	info.IsStream = true
	response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(streamBody))}

	_, apiErr := aliAudioTranscriptionHandler(c, response, info)
	require.Nil(t, apiErr)
	assert.Contains(t, recorder.Body.String(), `"delta":"甚至出现"`)
	assert.Contains(t, recorder.Body.String(), `"delta":"交易几乎停滞的情况。"`)
	assert.Contains(t, recorder.Body.String(), `"text":"甚至出现交易几乎停滞的情况。"`)
}

func TestAliAudioUsageFromDurationFallsBackAndAuditsSaturation(t *testing.T) {
	request := dto.AudioRequest{Model: "qwen-audio-3.0-asr-flash"}
	info := newAliAudioRelayInfo(request)
	info.SetEstimatePromptTokens(123)

	fallbackUsage := aliAudioUsageFromDuration(info, nil)
	assert.Equal(t, 123, fallbackUsage.PromptTokensDetails.AudioTokens)

	hugeDuration := math.MaxFloat64
	saturatedUsage := aliAudioUsageFromDuration(info, &hugeDuration)
	assert.Equal(t, math.MaxInt32, saturatedUsage.PromptTokensDetails.AudioTokens)
	require.NotNil(t, info.QuotaClamp)
}
