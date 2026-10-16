package helper

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetAndValidAudioRequestParsesMultipartStream(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "qwen-audio-3.0-asr-flash"))
	require.NoError(t, writer.WriteField("response_format", "json"))
	require.NoError(t, writer.WriteField("stream", "true"))
	part, err := writer.CreateFormFile("file", "clip.wav")
	require.NoError(t, err)
	_, err = part.Write([]byte("audio"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())

	request, err := GetAndValidAudioRequest(c, constant.RelayModeAudioTranscription)
	require.NoError(t, err)
	require.NotNil(t, request.Stream)
	require.True(t, *request.Stream)
	require.True(t, request.IsStream(c.Request))
}
