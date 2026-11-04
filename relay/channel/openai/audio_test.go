package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"testing/iotest"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertAudioSpeechRequestPreservesVendorFields(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioSpeech}

	request := dto.AudioRequest{
		Model:          "moss-tts-nano",
		Input:          "hello",
		Voice:          "Nachoneko",
		ResponseFormat: "mp3",
		MaxNewFrames:   []byte("220"),
	}
	reader, err := (&Adaptor{}).ConvertAudioRequest(c, info, request)
	require.NoError(t, err)

	body, err := io.ReadAll(reader)
	require.NoError(t, err)
	var replayed dto.AudioRequest
	require.NoError(t, common.Unmarshal(body, &replayed))
	assert.Equal(t, "moss-tts-nano", replayed.Model)
	assert.Equal(t, "Nachoneko", replayed.Voice)
	assert.Equal(t, "mp3", replayed.ResponseFormat)
	assert.JSONEq(t, "220", string(replayed.MaxNewFrames))
}

func TestOpenaiTTSHandlerRejectsFailedResponseBodies(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name string
		body io.ReadCloser
		code types.ErrorCode
	}{
		{
			name: "read error",
			body: io.NopCloser(iotest.ErrReader(io.ErrUnexpectedEOF)),
			code: types.ErrorCodeReadResponseBodyFailed,
		},
		{
			name: "empty body",
			body: io.NopCloser(strings.NewReader("")),
			code: types.ErrorCodeEmptyResponse,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"audio/mpeg"}},
				Body:       tt.body,
			}
			info := &relaycommon.RelayInfo{
				Request: &dto.AudioRequest{ResponseFormat: "mp3"},
			}

			usage, apiErr := OpenaiTTSHandler(c, resp, info)
			require.Nil(t, usage)
			require.NotNil(t, apiErr)
			assert.Equal(t, tt.code, apiErr.GetErrorCode())
			assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
			assert.False(t, c.Writer.Written())
			assert.Empty(t, recorder.Body.Bytes())
			assert.Empty(t, recorder.Header().Get("Content-Type"))
		})
	}
}

func TestOpenaiTTSHandlerWritesCompleteAudioResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	audio := []byte("ID3fake-mp3-audio")
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type":        []string{"audio/mpeg"},
			"Content-Disposition": []string{`inline; filename="speech.mp3"`},
		},
		Body: io.NopCloser(bytes.NewReader(audio)),
	}
	info := &relaycommon.RelayInfo{
		Request: &dto.AudioRequest{ResponseFormat: "mp3"},
	}

	usage, apiErr := OpenaiTTSHandler(c, resp, info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "audio/mpeg", recorder.Header().Get("Content-Type"))
	assert.Equal(t, `inline; filename="speech.mp3"`, recorder.Header().Get("Content-Disposition"))
	assert.Equal(t, strconv.Itoa(len(audio)), recorder.Header().Get("Content-Length"))
	assert.Equal(t, len(audio), recorder.Body.Len())
	assert.Equal(t, audio, recorder.Body.Bytes())
}
