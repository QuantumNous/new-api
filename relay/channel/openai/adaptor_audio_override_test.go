package openai

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertAudioRequestUsesOverriddenMultipartFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	requestBody := &bytes.Buffer{}
	writer := multipart.NewWriter(requestBody)
	require.NoError(t, writer.WriteField("model", "whisper-1"))
	require.NoError(t, writer.WriteField("response_format", "json"))
	require.NoError(t, writer.WriteField("language", "en"))
	fileWriter, err := writer.CreateFormFile("file", "sample.wav")
	require.NoError(t, err)
	_, err = fileWriter.Write([]byte("fake audio"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/transcriptions", requestBody)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	c.Set(string(constant.ContextKeyAudioFormOverride), map[string]any{
		"model":           "whisper-1",
		"response_format": "verbose_json",
		"language":        "fr",
		"temperature":     0.2,
	})

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeAudioTranscription}
	reader, err := adaptor.ConvertAudioRequest(c, info, dto.AudioRequest{Model: "whisper-1"})
	require.NoError(t, err)

	body, err := io.ReadAll(reader)
	require.NoError(t, err)

	_, params, err := mime.ParseMediaType(c.Request.Header.Get("Content-Type"))
	require.NoError(t, err)
	multipartReader := multipart.NewReader(bytes.NewReader(body), params["boundary"])
	form, err := multipartReader.ReadForm(1024 * 1024)
	require.NoError(t, err)

	require.Equal(t, "verbose_json", form.Value["response_format"][0])
	require.Equal(t, "fr", form.Value["language"][0])
	require.Equal(t, "0.2", form.Value["temperature"][0])
	require.Len(t, form.File["file"], 1)
}
