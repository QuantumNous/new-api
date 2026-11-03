package ollama

import (
	"bytes"
	"context"
	"crypto/sha256"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testAudioFile struct {
	name        string
	contentType string
	data        []byte
}

func newAudioTestContext(t *testing.T, fields map[string]string, file *testAudioFile) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	if file != nil {
		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{
			"name":     "file",
			"filename": file.name,
		}))
		if file.contentType != "" {
			header.Set("Content-Type", file.contentType)
		}
		part, err := writer.CreatePart(header)
		require.NoError(t, err)
		_, err = part.Write(file.data)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c, recorder
}

func newAudioTestInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioTranscription,
		RelayFormat: relaytypes.RelayFormatOpenAIAudio,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: baseURL,
			ApiKey:         "ollama-key",
		},
	}
}

func readTestAudioFile(t *testing.T, header *multipart.FileHeader) []byte {
	t.Helper()
	file, err := header.Open()
	require.NoError(t, err)
	defer file.Close()
	data, err := io.ReadAll(file)
	require.NoError(t, err)
	return data
}

func TestOllamaAudioRequestURLs(t *testing.T) {
	tests := []struct {
		name       string
		mode       int
		openAIChat bool
		want       string
	}{
		{name: "transcription", mode: relayconstant.RelayModeAudioTranscription, want: "http://ollama:11434/v1/audio/transcriptions"},
		{name: "translation", mode: relayconstant.RelayModeAudioTranslation, want: "http://ollama:11434/v1/audio/translations"},
		{name: "chat remains native", mode: relayconstant.RelayModeChatCompletions, want: "http://ollama:11434/api/chat"},
		{name: "chat remains OpenAI compatible when configured", mode: relayconstant.RelayModeChatCompletions, openAIChat: true, want: "http://ollama:11434/v1/chat/completions"},
		{name: "completions remain unchanged", mode: relayconstant.RelayModeCompletions, want: "http://ollama:11434/api/generate"},
		{name: "embeddings remain unchanged", mode: relayconstant.RelayModeEmbeddings, want: "http://ollama:11434/api/embed"},
		{name: "responses remain unchanged", mode: relayconstant.RelayModeResponses, want: "http://ollama:11434/v1/responses"},
		{name: "responses compaction remains unchanged", mode: relayconstant.RelayModeResponsesCompact, want: "http://ollama:11434/v1/responses/compact"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := newAudioTestInfo("http://ollama:11434")
			info.RelayMode = tt.mode
			info.ChannelOtherSettings.OllamaOpenAIChat = tt.openAIChat
			got, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}

	info := newAudioTestInfo("http://ollama:11434/")
	got, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "http://ollama:11434/v1/audio/transcriptions", got)
}

func TestOllamaConvertAudioRequestPreservesMultipart(t *testing.T) {
	largeAudio := bytes.Repeat([]byte{0x52, 0x49, 0x46, 0x46}, 256<<10)
	tests := []struct {
		name         string
		fields       map[string]string
		file         *testAudioFile
		requestModel string
		wantErr      string
		wantStream   bool
	}{
		{
			name: "wav with optional parameters",
			fields: map[string]string{
				"model":           "client-model",
				"language":        "zh",
				"prompt":          "meeting notes",
				"response_format": "verbose_json",
				"temperature":     "0.2",
				"stream":          "true",
			},
			file:         &testAudioFile{name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave")},
			requestModel: "mapped-model",
			wantStream:   true,
		},
		{
			name: "mp3 is forwarded without conversion",
			fields: map[string]string{
				"model":           "client-model",
				"response_format": "json",
				"language":        "en",
			},
			file:         &testAudioFile{name: "sample.mp3", contentType: "audio/mpeg", data: []byte("ID3-test-mp3")},
			requestModel: "mapped-model",
		},
		{
			name: "unsupported format is left for upstream validation",
			fields: map[string]string{
				"model": "client-model",
			},
			file:         &testAudioFile{name: "notes.txt", contentType: "text/plain", data: []byte("not audio")},
			requestModel: "mapped-model",
		},
		{
			name: "large file is not truncated",
			fields: map[string]string{
				"model":           "client-model",
				"response_format": "json",
			},
			file:         &testAudioFile{name: "large.wav", contentType: "audio/wav", data: largeAudio},
			requestModel: "mapped-model",
		},
		{
			name: "missing file",
			fields: map[string]string{
				"model": "client-model",
			},
			requestModel: "mapped-model",
			wantErr:      "file is required",
		},
		{
			name: "empty file",
			fields: map[string]string{
				"model": "client-model",
			},
			file:         &testAudioFile{name: "empty.wav", contentType: "audio/wav"},
			requestModel: "mapped-model",
			wantErr:      "file is empty",
		},
		{
			name: "missing model",
			fields: map[string]string{
				"response_format": "json",
			},
			file:    &testAudioFile{name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave")},
			wantErr: "model is required",
		},
		{
			name: "invalid stream value",
			fields: map[string]string{
				"model":  "client-model",
				"stream": "not-a-bool",
			},
			file:         &testAudioFile{name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave")},
			requestModel: "mapped-model",
			wantErr:      "invalid stream value",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := newAudioTestContext(t, tt.fields, tt.file)
			info := newAudioTestInfo("http://ollama:11434")
			adaptor := &Adaptor{}
			request := dto.AudioRequest{Model: tt.requestModel, ResponseFormat: tt.fields["response_format"]}

			converted, err := adaptor.ConvertAudioRequest(c, info, request)
			if tt.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantErr)
				var apiErr *relaytypes.NewAPIError
				require.ErrorAs(t, err, &apiErr)
				assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.wantStream, info.IsStream)

			mediaType, params, err := mime.ParseMediaType(c.Request.Header.Get("Content-Type"))
			require.NoError(t, err)
			assert.Equal(t, "multipart/form-data", mediaType)
			assert.NotEmpty(t, params["boundary"])

			requestBody, err := io.ReadAll(converted)
			require.NoError(t, err)
			replayed := httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", bytes.NewReader(requestBody))
			replayed.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
			require.NoError(t, replayed.ParseMultipartForm(32<<20))

			require.Len(t, replayed.MultipartForm.Value["model"], 1)
			assert.Equal(t, tt.requestModel, replayed.MultipartForm.Value["model"][0])
			for key, want := range tt.fields {
				if key == "model" {
					continue
				}
				require.NotEmpty(t, replayed.MultipartForm.Value[key], key)
				assert.Equal(t, want, replayed.MultipartForm.Value[key][0], key)
			}

			require.Len(t, replayed.MultipartForm.File["file"], 1)
			gotFile := replayed.MultipartForm.File["file"][0]
			assert.Equal(t, tt.file.name, gotFile.Filename)
			assert.Equal(t, tt.file.contentType, gotFile.Header.Get("Content-Type"))
			gotData := readTestAudioFile(t, gotFile)
			assert.Equal(t, len(tt.file.data), len(gotData))
			assert.Equal(t, sha256.Sum256(tt.file.data), sha256.Sum256(gotData))
		})
	}
}

func TestOllamaConvertAudioRequestResetsAudioState(t *testing.T) {
	c, _ := newAudioTestContext(t, map[string]string{"model": "client-model"}, &testAudioFile{
		name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave"),
	})
	info := newAudioTestInfo("http://ollama:11434")
	info.IsStream = true
	adaptor := &Adaptor{ResponseFormat: "verbose_json"}

	_, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{Model: "mapped-model"})
	require.NoError(t, err)
	assert.False(t, info.IsStream)
	assert.Equal(t, "json", adaptor.ResponseFormat)
}

func TestOllamaAudioTranscriptionRelay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	type capturedRequest struct {
		path           string
		contentType    string
		authorization  string
		model          string
		language       string
		prompt         string
		responseFormat string
		fileName       string
		fileType       string
		fileData       []byte
		parseErr       error
	}
	captured := make(chan capturedRequest, 1)
	audioData := []byte("RIFF-full-relay-wave")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		snapshot := capturedRequest{path: r.URL.Path, contentType: r.Header.Get("Content-Type"), authorization: r.Header.Get("Authorization")}
		snapshot.parseErr = r.ParseMultipartForm(32 << 20)
		if snapshot.parseErr == nil {
			snapshot.model = r.MultipartForm.Value["model"][0]
			snapshot.language = r.MultipartForm.Value["language"][0]
			snapshot.prompt = r.MultipartForm.Value["prompt"][0]
			snapshot.responseFormat = r.MultipartForm.Value["response_format"][0]
			fileHeader := r.MultipartForm.File["file"][0]
			snapshot.fileName = fileHeader.Filename
			snapshot.fileType = fileHeader.Header.Get("Content-Type")
			file, openErr := fileHeader.Open()
			if openErr == nil {
				snapshot.fileData, snapshot.parseErr = io.ReadAll(file)
				_ = file.Close()
			} else {
				snapshot.parseErr = openErr
			}
		}
		captured <- snapshot
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"text":"hello world"}`)
	}))
	defer server.Close()

	c, responseRecorder := newAudioTestContext(t, map[string]string{
		"model":           "client-model",
		"language":        "en",
		"prompt":          "test prompt",
		"response_format": "json",
	}, &testAudioFile{name: "sample.wav", contentType: "audio/wav", data: audioData})
	info := newAudioTestInfo(server.URL)
	adaptor := &Adaptor{}
	request := dto.AudioRequest{Model: "mapped-model", ResponseFormat: "json"}

	converted, err := adaptor.ConvertAudioRequest(c, info, request)
	require.NoError(t, err)
	responseAny, err := adaptor.DoRequest(c, info, converted)
	require.NoError(t, err)
	httpResp, ok := responseAny.(*http.Response)
	require.True(t, ok)
	require.NotNil(t, httpResp)
	require.Equal(t, http.StatusOK, httpResp.StatusCode)

	got := <-captured
	require.NoError(t, got.parseErr)
	assert.Equal(t, "/v1/audio/transcriptions", got.path)
	assert.Equal(t, "Bearer ollama-key", got.authorization)
	assert.Equal(t, "mapped-model", got.model)
	assert.Equal(t, "en", got.language)
	assert.Equal(t, "test prompt", got.prompt)
	assert.Equal(t, "json", got.responseFormat)
	assert.Equal(t, "sample.wav", got.fileName)
	assert.Equal(t, "audio/wav", got.fileType)
	assert.Equal(t, audioData, got.fileData)
	mediaType, params, err := mime.ParseMediaType(got.contentType)
	require.NoError(t, err)
	assert.Equal(t, "multipart/form-data", mediaType)
	assert.NotEmpty(t, params["boundary"])

	usage, apiErr := adaptor.DoResponse(c, httpResp, info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, http.StatusOK, responseRecorder.Code)
	assert.Equal(t, "application/json", responseRecorder.Header().Get("Content-Type"))
	var response dto.AudioResponse
	require.NoError(t, common.Unmarshal(responseRecorder.Body.Bytes(), &response))
	assert.Equal(t, "hello world", response.Text)
}

func TestOllamaAudioUpstreamErrorStatuses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	for _, status := range []int{http.StatusBadRequest, http.StatusUnauthorized, http.StatusNotFound, http.StatusInternalServerError} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = io.WriteString(w, `{"error":{"message":"upstream says no","type":"invalid_request_error"}}`)
			}))
			defer server.Close()

			c, _ := newAudioTestContext(t, map[string]string{"model": "client-model"}, &testAudioFile{
				name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave"),
			})
			info := newAudioTestInfo(server.URL)
			adaptor := &Adaptor{}
			converted, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{Model: "mapped-model", ResponseFormat: "json"})
			require.NoError(t, err)
			responseAny, err := adaptor.DoRequest(c, info, converted)
			require.NoError(t, err)
			resp, ok := responseAny.(*http.Response)
			require.True(t, ok)
			require.Equal(t, status, resp.StatusCode)

			apiErr := service.RelayErrorHandler(context.Background(), resp, true)
			require.NotNil(t, apiErr)
			assert.Equal(t, status, apiErr.StatusCode)
			assert.Contains(t, apiErr.Error(), "upstream says no")
		})
	}
}

func TestOllamaAudioUpstreamConnectionFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()

	c, _ := newAudioTestContext(t, map[string]string{"model": "client-model"}, &testAudioFile{
		name: "sample.wav", contentType: "audio/wav", data: []byte("RIFF-test-wave"),
	})
	info := newAudioTestInfo("http://127.0.0.1:0")
	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{Model: "mapped-model", ResponseFormat: "json"})
	require.NoError(t, err)

	resp, err := adaptor.DoRequest(c, info, converted)
	require.Error(t, err)
	assert.Nil(t, resp)
}

type audioErrorReader struct {
	err error
}

func (r audioErrorReader) Read([]byte) (int, error) {
	return 0, r.err
}

func TestOllamaAudioResponseHandling(t *testing.T) {
	tests := []struct {
		name           string
		responseFormat string
		body           string
		contentType    string
		wantBody       string
		wantErrCode    relaytypes.ErrorCode
	}{
		{
			name:           "json response",
			responseFormat: "json",
			body:           `{"text":"hello"}`,
			contentType:    "application/json",
			wantBody:       `{"text":"hello"}`,
		},
		{
			name:           "empty transcription",
			responseFormat: "json",
			body:           `{"text":""}`,
			contentType:    "application/json",
			wantBody:       `{"text":""}`,
		},
		{
			name:           "verbose json response",
			responseFormat: "verbose_json",
			body:           `{"task":"transcribe","language":"english","duration":1.5,"text":"hello","segments":[{"id":0,"start":0,"end":1.5,"text":"hello"}]}`,
			contentType:    "application/json",
			wantBody:       `{"task":"transcribe","language":"english","duration":1.5,"text":"hello","segments":[{"id":0,"start":0,"end":1.5,"text":"hello"}]}`,
		},
		{
			name:           "text response",
			responseFormat: "text",
			body:           "hello",
			contentType:    "text/plain; charset=utf-8",
			wantBody:       "hello",
		},
		{
			name:           "invalid json response",
			responseFormat: "json",
			body:           "not-json",
			contentType:    "application/json",
			wantErrCode:    relaytypes.ErrorCodeBadResponseBody,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{tt.contentType}},
				Body:       io.NopCloser(strings.NewReader(tt.body)),
			}
			adaptor := &Adaptor{ResponseFormat: tt.responseFormat}
			usage, apiErr := adaptor.DoResponse(c, resp, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioTranscription})
			require.NotNil(t, usage)
			if tt.wantErrCode != "" {
				require.NotNil(t, apiErr)
				assert.Equal(t, tt.wantErrCode, apiErr.GetErrorCode())
				return
			}
			require.Nil(t, apiErr)
			assert.Equal(t, tt.wantBody, recorder.Body.String())
			assert.Equal(t, tt.contentType, recorder.Header().Get("Content-Type"))
		})
	}

	for _, readErr := range []error{io.ErrUnexpectedEOF, context.DeadlineExceeded} {
		t.Run(readErr.Error(), func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(audioErrorReader{err: readErr}),
			}
			usage, apiErr := (&Adaptor{ResponseFormat: "json"}).DoResponse(c, resp, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioTranscription})
			assert.Nil(t, usage)
			require.NotNil(t, apiErr)
			assert.Equal(t, relaytypes.ErrorCodeReadResponseBodyFailed, apiErr.GetErrorCode())
		})
	}
}

func TestOllamaAudioStreamingResponse(t *testing.T) {
	streamBody := "data: {\"type\":\"transcript.text.delta\",\"delta\":\"hel\"}\n\n" +
		"data: {\"type\":\"transcript.text.delta\",\"delta\":\"lo\"}\n\n" +
		"data: {\"type\":\"transcript.text.done\",\"text\":\"hello\"}\n\n"
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(streamBody)),
	}
	usage, apiErr := (&Adaptor{ResponseFormat: "json"}).DoResponse(c, resp, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioTranscription, IsStream: true})
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Equal(t, streamBody, recorder.Body.String())
}
