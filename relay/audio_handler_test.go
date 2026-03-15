package relay

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestApplyAudioParamOverrideForSpeech(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/audio/speech", bytes.NewReader([]byte(`{"model":"tts-1"}`)))
	c.Request.Header.Set("Content-Type", gin.MIMEJSON)

	request := &dto.AudioRequest{
		Model:          "tts-1",
		Input:          "hello",
		Voice:          "alloy",
		ResponseFormat: "mp3",
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioSpeech,
		Request:   request,
		ChannelMeta: &relaycommon.ChannelMeta{
			ParamOverride: map[string]any{
				"voice":           "nova",
				"response_format": "pcm",
			},
		},
	}

	err := applyAudioParamOverride(c, info, request)
	require.NoError(t, err)
	require.Equal(t, "nova", request.Voice)
	require.Equal(t, "pcm", request.ResponseFormat)
	require.Same(t, request, info.Request)
}

func TestApplyAudioParamOverrideForMultipartStoresEffectiveForm(t *testing.T) {
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

	audioRequest := &dto.AudioRequest{
		Model:          "whisper-1",
		ResponseFormat: "json",
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeAudioTranscription,
		Request:   audioRequest,
		ChannelMeta: &relaycommon.ChannelMeta{
			ParamOverride: map[string]any{
				"response_format": "verbose_json",
				"temperature":     0.2,
			},
		},
	}

	err = applyAudioParamOverride(c, info, audioRequest)
	require.NoError(t, err)
	require.Equal(t, "verbose_json", audioRequest.ResponseFormat)

	formOverride := common.GetContextKeyStringMap(c, constant.ContextKeyAudioFormOverride)
	require.Equal(t, "verbose_json", formOverride["response_format"])
	require.Equal(t, 0.2, formOverride["temperature"])
	require.Equal(t, "en", formOverride["language"])
}
