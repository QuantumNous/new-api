package xiaomi

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func xiaomiRelayInfo(relayMode int, request dto.Request) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAI,
		RelayMode:      relayMode,
		RequestURLPath: "/v1/audio/speech",
		Request:        request,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "sk-test",
			ChannelBaseUrl:    "https://api.xiaomimimo.com",
			ChannelType:       constant.ChannelTypeXiaomi,
			UpstreamModelName: "mimo-v2.5-tts",
		},
	}
}

func xiaomiGinContext(t *testing.T, path string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

// MiMo synthesises audio from a chat completion, so the OpenAI speech fields
// have to land as the two chat turns and the audio options MiMo reads.
func TestConvertSpeechRequestBuildsChatCompletion(t *testing.T) {
	for _, tc := range []struct {
		name         string
		request      dto.AudioRequest
		wantFormat   string
		wantVoice    string
		wantMessages int
	}{
		{
			name:         "defaults to wav and the default voice",
			request:      dto.AudioRequest{Model: "mimo-v2.5-tts", Input: "你好"},
			wantFormat:   "wav",
			wantVoice:    "mimo_default",
			wantMessages: 1,
		},
		{
			name:         "instructions become the style turn",
			request:      dto.AudioRequest{Model: "mimo-v2.5-tts", Input: "你好", Instructions: "轻声细语"},
			wantFormat:   "wav",
			wantVoice:    "mimo_default",
			wantMessages: 2,
		},
		{
			name:         "keeps an mp3 request and a MiMo preset voice",
			request:      dto.AudioRequest{Model: "mimo-v2.5-tts", Input: "你好", Voice: "冰糖", ResponseFormat: "mp3"},
			wantFormat:   "mp3",
			wantVoice:    "冰糖",
			wantMessages: 1,
		},
		{
			name:         "an OpenAI voice MiMo does not have falls back to the default",
			request:      dto.AudioRequest{Model: "mimo-v2.5-tts", Input: "你好", Voice: "alloy"},
			wantFormat:   "wav",
			wantVoice:    "mimo_default",
			wantMessages: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			adaptor := &Adaptor{}
			info := xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &tc.request)

			reader, err := adaptor.ConvertAudioRequest(xiaomiGinContext(t, "/v1/audio/speech"), info, tc.request)
			require.NoError(t, err)

			body, err := io.ReadAll(reader)
			require.NoError(t, err)
			assert.Equal(t, tc.wantFormat, adaptor.speechFormat)

			var payload struct {
				Model    string `json:"model"`
				Messages []struct {
					Role    string `json:"role"`
					Content string `json:"content"`
				} `json:"messages"`
				Audio struct {
					Format string `json:"format"`
					Voice  string `json:"voice"`
				} `json:"audio"`
				Stream bool `json:"stream"`
			}
			require.NoError(t, common.Unmarshal(body, &payload))

			assert.Equal(t, tc.request.Model, payload.Model)
			assert.Equal(t, tc.wantFormat, payload.Audio.Format)
			assert.Equal(t, tc.wantVoice, payload.Audio.Voice)
			assert.False(t, payload.Stream)
			require.Len(t, payload.Messages, tc.wantMessages)
			assert.Equal(t, "assistant", payload.Messages[len(payload.Messages)-1].Role)
			assert.Equal(t, tc.request.Input, payload.Messages[len(payload.Messages)-1].Content)
		})
	}
}

func TestConvertSpeechRequestRequiresInput(t *testing.T) {
	adaptor := &Adaptor{}
	request := dto.AudioRequest{Model: "mimo-v2.5-tts"}

	_, err := adaptor.ConvertAudioRequest(xiaomiGinContext(t, "/v1/audio/speech"),
		xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &request), request)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "input is required")
	requireClientRejection(t, err)
}

// MiMo has no translation endpoint, and the caller picked it, so the rejection
// must reach them as a 400 rather than a gateway failure.
func TestConvertAudioRequestRejectsTranslation(t *testing.T) {
	_, err := (&Adaptor{}).ConvertAudioRequest(xiaomiGinContext(t, "/v1/audio/translations"),
		xiaomiRelayInfo(relayconstant.RelayModeAudioTranslation, &dto.AudioRequest{}), dto.AudioRequest{})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not support this audio endpoint")
	requireClientRejection(t, err)
}

// MiMo answers synthesis and recognition on the chat endpoint, so both audio
// relay modes have to be rewritten there instead of the OpenAI audio paths the
// caller used.
func TestGetRequestURLPointsAudioModesAtChatCompletions(t *testing.T) {
	for _, tc := range []struct {
		name      string
		relayMode int
		path      string
	}{
		{name: "speech", relayMode: relayconstant.RelayModeAudioSpeech, path: "/v1/audio/speech"},
		{name: "transcription", relayMode: relayconstant.RelayModeAudioTranscription, path: "/v1/audio/transcriptions"},
		{name: "chat keeps its own path", relayMode: relayconstant.RelayModeChatCompletions, path: "/v1/chat/completions"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := xiaomiRelayInfo(tc.relayMode, nil)
			info.RequestURLPath = tc.path

			url, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, "https://api.xiaomimimo.com/v1/chat/completions", url)
		})
	}
}

// Answering a container MiMo cannot render with wav bytes would hand the client
// a payload its decoder cannot read, so the request fails instead of degrading.
func TestConvertSpeechRequestRejectsContainersMiMoCannotRender(t *testing.T) {
	for _, responseFormat := range []string{"opus", "aac", "flac", "pcm"} {
		t.Run(responseFormat, func(t *testing.T) {
			adaptor := &Adaptor{}
			request := dto.AudioRequest{Model: "mimo-v2.5-tts", Input: "你好", ResponseFormat: responseFormat}

			_, err := adaptor.ConvertAudioRequest(xiaomiGinContext(t, "/v1/audio/speech"),
				xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &request), request)

			require.Error(t, err)
			assert.Contains(t, err.Error(), "unsupported response_format")
			assert.Empty(t, adaptor.speechFormat)
			requireClientRejection(t, err)
		})
	}
}

// MiMo returns no timestamps, so the timed transcription formats cannot be
// honoured and must fail before the upstream is charged for a transcript.
func TestConvertTranscriptionRequestRejectsTimedFormats(t *testing.T) {
	for _, responseFormat := range []string{"srt", "vtt", "verbose_json"} {
		t.Run(responseFormat, func(t *testing.T) {
			c := xiaomiGinContext(t, "/v1/audio/transcriptions")
			c.Request.Header.Set("Content-Type", multipartAudioBody(t, c, "clip.wav", "audio/wav", []byte{0x01}))

			_, err := buildTranscriptionRequest(c, dto.AudioRequest{Model: "mimo-v2.5-asr", ResponseFormat: responseFormat})

			require.Error(t, err)
			assert.Contains(t, err.Error(), "unsupported response_format")
			requireClientRejection(t, err)
		})
	}
}

// A rejected request format is the client's mistake, so it must surface as a
// 400. Left as a plain error the helper would wrap it into a retryable 500 that
// hides the rejection behind unrelated channels.
func requireClientRejection(t *testing.T, err error) {
	t.Helper()

	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
}

// The speech endpoint promises a raw audio body, so the base64 payload MiMo
// returns inside the chat completion has to be unpacked and labelled with the
// container that was actually rendered.
func TestSpeechResponseUnpacksAudioAndLabelsContainer(t *testing.T) {
	audio := wavWithPCM(make([]byte, 320))
	completion, err := common.Marshal(map[string]any{
		"choices": []any{
			map[string]any{"message": map[string]any{"audio": map[string]any{"data": base64.StdEncoding.EncodeToString(audio)}}},
		},
	})
	require.NoError(t, err)

	for _, tc := range []struct {
		name        string
		format      string
		contentType string
	}{
		{name: "wav request answers audio/wav", format: audioFormatWAV, contentType: "audio/wav"},
		{name: "mp3 request answers audio/mpeg", format: audioFormatMP3, contentType: "audio/mpeg"},
		{name: "no negotiated format answers audio/wav", format: "", contentType: "audio/wav"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder, c := xiaomiRecorder(t)

			_, apiErr := (&Adaptor{speechFormat: tc.format}).doSpeechResponse(c, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(completion)),
			}, xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &dto.AudioRequest{}))

			require.Nil(t, apiErr)
			assert.Equal(t, tc.contentType, recorder.Header().Get("Content-Type"))
			assert.Equal(t, audio, recorder.Body.Bytes())
		})
	}
}

// MiMo reports no duration for synthesis, so the reply is billed by the audio
// it returned, and a payload whose header cannot be read still costs something
// instead of settling to zero.
func TestSpeechResponseBillsRenderedAudio(t *testing.T) {
	for _, tc := range []struct {
		name      string
		audio     []byte
		format    string
		wantToken int
	}{
		{
			name:      "one second of wav bills one minute's worth of 1000 tokens",
			audio:     wavWithPCM(make([]byte, 16000)),
			format:    audioFormatWAV,
			wantToken: 17,
		},
		{
			name:      "an unreadable payload falls back to its size",
			audio:     []byte{0x00, 0x01, 0x02, 0x03},
			format:    audioFormatWAV,
			wantToken: 1,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			completion, err := common.Marshal(map[string]any{
				"choices": []any{
					map[string]any{"message": map[string]any{"audio": map[string]any{"data": base64.StdEncoding.EncodeToString(tc.audio)}}},
				},
			})
			require.NoError(t, err)
			_, c := xiaomiRecorder(t)

			usage, apiErr := (&Adaptor{speechFormat: tc.format}).doSpeechResponse(c, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(completion)),
			}, xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &dto.AudioRequest{}))

			require.Nil(t, apiErr)
			assert.Equal(t, tc.wantToken, usage.CompletionTokenDetails.AudioTokens)
			assert.Equal(t, tc.wantToken, usage.CompletionTokens)
			assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
		})
	}
}

// The upstream has already generated and charged for this audio by the time the
// body is written, so a failed write must still report the audio tokens.
// Reporting zero would settle the request as text-only and leave the gateway
// absorbing the synthesis cost.
func TestSpeechResponseBillsRenderedAudioWhenTheWriteFails(t *testing.T) {
	audio := wavWithPCM(make([]byte, 16000))
	completion, err := common.Marshal(map[string]any{
		"choices": []any{
			map[string]any{"message": map[string]any{"audio": map[string]any{"data": base64.StdEncoding.EncodeToString(audio)}}},
		},
	})
	require.NoError(t, err)

	c, _ := gin.CreateTestContext(&failingResponseWriter{})
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)

	usage, apiErr := (&Adaptor{speechFormat: audioFormatWAV}).doSpeechResponse(c, &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(completion)),
	}, xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &dto.AudioRequest{}))

	require.Nil(t, apiErr)
	assert.Equal(t, 17, usage.CompletionTokenDetails.AudioTokens)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
}

func TestSpeechResponseRejectsACompletionWithoutAudio(t *testing.T) {
	_, c := xiaomiRecorder(t)

	_, apiErr := (&Adaptor{}).doSpeechResponse(c, &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader([]byte(`{"choices":[{"message":{"content":""}}]}`))),
	}, xiaomiRelayInfo(relayconstant.RelayModeAudioSpeech, &dto.AudioRequest{}))

	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "no audio")
}

// Transcription only reaches MiMo as a chat message carrying the upload as a
// data URL, so the container has to be recognised before the base64 step.
func TestConvertTranscriptionRequestCarriesAudioDataURL(t *testing.T) {
	for _, tc := range []struct {
		name        string
		filename    string
		partType    string
		wantDataURL string
		wantErr     string
	}{
		{name: "wav by extension", filename: "clip.wav", partType: "application/octet-stream", wantDataURL: "data:audio/wav;base64,"},
		{name: "mp3 by extension", filename: "clip.mp3", partType: "application/octet-stream", wantDataURL: "data:audio/mpeg;base64,"},
		{name: "content type decides when the name has no extension", filename: "clip", partType: "audio/mpeg", wantDataURL: "data:audio/mpeg;base64,"},
		{name: "rejects a container MiMo cannot decode", filename: "clip.flac", partType: "audio/flac", wantErr: "unsupported audio format"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := xiaomiGinContext(t, "/v1/audio/transcriptions")
			c.Request.Header.Set("Content-Type", multipartAudioBody(t, c, tc.filename, tc.partType, []byte{0x01, 0x02}))

			reader, err := buildTranscriptionRequest(c, dto.AudioRequest{Model: "mimo-v2.5-asr"})
			if tc.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
				requireClientRejection(t, err)
				return
			}
			require.NoError(t, err)

			body, err := io.ReadAll(reader)
			require.NoError(t, err)

			var payload struct {
				Model    string `json:"model"`
				Messages []struct {
					Content []struct {
						Type       string `json:"type"`
						InputAudio struct {
							Data string `json:"data"`
						} `json:"input_audio"`
					} `json:"content"`
				} `json:"messages"`
				ASROptions struct {
					Language string `json:"language"`
				} `json:"asr_options"`
			}
			require.NoError(t, common.Unmarshal(body, &payload))

			assert.Equal(t, "mimo-v2.5-asr", payload.Model)
			require.Len(t, payload.Messages, 1)
			require.Len(t, payload.Messages[0].Content, 1)
			assert.Equal(t, "input_audio", payload.Messages[0].Content[0].Type)
			assert.Equal(t,
				tc.wantDataURL+base64.StdEncoding.EncodeToString([]byte{0x01, 0x02}),
				payload.Messages[0].Content[0].InputAudio.Data)
			assert.Equal(t, "auto", payload.ASROptions.Language)
		})
	}
}

func TestAsrLanguageNarrowsTheOpenAIHint(t *testing.T) {
	assert.Equal(t, "auto", asrLanguage(nil))
	assert.Equal(t, "zh", asrLanguage([]string{"zh"}))
	assert.Equal(t, "en", asrLanguage([]string{"EN"}))
	assert.Equal(t, "auto", asrLanguage([]string{"ja"}))
}

// The transcript arrives as chat message content, but the endpoint promises an
// OpenAI transcription payload.
func TestTranscriptionResponseRendersRequestedFormat(t *testing.T) {
	const completion = `{"choices":[{"message":{"content":"你好世界"}}],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10,"prompt_tokens_details":{"audio_tokens":25}}}`

	for _, tc := range []struct {
		name           string
		responseFormat string
		wantType       string
		wantBody       string
	}{
		{name: "json by default", responseFormat: "", wantType: "application/json", wantBody: `{"text":"你好世界"}`},
		{name: "json explicitly", responseFormat: "json", wantType: "application/json", wantBody: `{"text":"你好世界"}`},
		{name: "plain text", responseFormat: "text", wantType: "text/plain; charset=utf-8", wantBody: "你好世界"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder, c := xiaomiRecorder(t)
			request := dto.AudioRequest{Model: "mimo-v2.5-asr", ResponseFormat: tc.responseFormat}

			usage, apiErr := doTranscriptionResponse(c, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader([]byte(completion))),
			}, xiaomiRelayInfo(relayconstant.RelayModeAudioTranscription, &request))

			require.Nil(t, apiErr)
			assert.Equal(t, tc.wantType, recorder.Header().Get("Content-Type"))
			assert.Equal(t, tc.wantBody, recorder.Body.String())
			// The audio-token detail is what makes the request settle against
			// the audio prices instead of the text ones.
			assert.Equal(t, 25, usage.PromptTokensDetails.AudioTokens)
		})
	}
}

// Upstream normally reports the recognised audio, and those counts are what the
// request settles on. A reply that reports prompt tokens without the audio
// detail still reports what the upstream recognised, so those counts stay as
// they are; only a reply that reports no prompt tokens at all leaves the local
// estimate to stand in for them.
func TestTranscriptionUsagePrefersUpstreamCountsAndFallsBackToTheEstimate(t *testing.T) {
	for _, tc := range []struct {
		name       string
		completion string
		wantPrompt int
		wantTotal  int
	}{
		{
			name:       "reported audio tokens are kept",
			completion: `{"choices":[{"message":{"content":"你好"}}],"usage":{"prompt_tokens":25,"completion_tokens":3,"total_tokens":28,"prompt_tokens_details":{"audio_tokens":25}}}`,
			wantPrompt: 25,
			wantTotal:  28,
		},
		{
			name:       "prompt tokens reported without the audio detail are kept",
			completion: `{"choices":[{"message":{"content":"你好"}}],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}`,
			wantPrompt: 7,
			wantTotal:  10,
		},
		{
			name:       "a reply without prompt tokens falls back to the estimate",
			completion: `{"choices":[{"message":{"content":"你好"}}],"usage":{"completion_tokens":3,"total_tokens":3}}`,
			wantPrompt: 42,
			wantTotal:  45,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, c := xiaomiRecorder(t)
			info := xiaomiRelayInfo(relayconstant.RelayModeAudioTranscription, &dto.AudioRequest{Model: "mimo-v2.5-asr"})
			info.SetEstimatePromptTokens(42)

			usage, apiErr := doTranscriptionResponse(c, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader([]byte(tc.completion))),
			}, info)

			require.Nil(t, apiErr)
			assert.Equal(t, tc.wantPrompt, usage.PromptTokens)
			assert.Equal(t, tc.wantTotal, usage.TotalTokens)
		})
	}
}

func xiaomiRecorder(t *testing.T) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio", nil)
	return recorder, c
}

// failingResponseWriter accepts headers and the status line but refuses the
// body, standing in for a client that disconnected mid-response.
type failingResponseWriter struct {
	header http.Header
}

func (w *failingResponseWriter) Header() http.Header {
	if w.header == nil {
		w.header = make(http.Header)
	}
	return w.header
}

func (w *failingResponseWriter) Write([]byte) (int, error) {
	return 0, errors.New("client disconnected")
}

func (w *failingResponseWriter) WriteHeader(int) {}

// multipartAudioBody puts a file part on the request and returns the multipart
// content type the caller must advertise.
func multipartAudioBody(t *testing.T, c *gin.Context, filename string, partType string, content []byte) string {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreatePart(map[string][]string{
		"Content-Disposition": {`form-data; name="file"; filename="` + filename + `"`},
		"Content-Type":        {partType},
	})
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c.Request.Body = io.NopCloser(bytes.NewReader(body.Bytes()))
	return writer.FormDataContentType()
}

// wavWithPCM wraps PCM samples in the minimal 16-bit mono 8 kHz RIFF header the
// duration parser reads.
func wavWithPCM(pcm []byte) []byte {
	header := make([]byte, 44)
	copy(header, "RIFF")
	binary.LittleEndian.PutUint32(header[4:], uint32(36+len(pcm)))
	copy(header[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(header[16:], 16)
	binary.LittleEndian.PutUint16(header[20:], 1)     // PCM
	binary.LittleEndian.PutUint16(header[22:], 1)     // mono
	binary.LittleEndian.PutUint32(header[24:], 8000)  // sample rate
	binary.LittleEndian.PutUint32(header[28:], 16000) // byte rate
	binary.LittleEndian.PutUint16(header[32:], 2)     // block align
	binary.LittleEndian.PutUint16(header[34:], 16)    // bits per sample
	copy(header[36:], "data")
	binary.LittleEndian.PutUint32(header[40:], uint32(len(pcm)))
	return append(header, pcm...)
}
