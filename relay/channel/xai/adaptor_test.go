package xai

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestMapsXAIParametersAndJSONEditImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{
		Model:          "grok-imagine-image-2.0",
		Prompt:         "make it cinematic",
		N:              common.GetPointer(uint(2)),
		AspectRatio:    "16:9",
		Resolution:     "2k",
		Quality:        "medium",
		ResponseFormat: "b64_json",
		Image:          []byte(`"https://example.com/input.png"`),
	})
	require.NoError(t, err)
	body, err := common.Marshal(converted)
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, common.Unmarshal(body, &payload))
	require.Equal(t, "2k", payload["resolution"])
	require.Equal(t, "medium", payload["quality"])
	require.Equal(t, "16:9", payload["aspect_ratio"])
	require.Equal(t, "b64_json", payload["response_format"])
	require.Equal(t, map[string]any{"url": "https://example.com/input.png"}, payload["image"])
}

func TestConvertImageRequestConvertsMultipartImageToDataURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "grok-imagine-image-2.0"))
	require.NoError(t, writer.WriteField("prompt", "edit this"))
	require.NoError(t, writer.WriteField("aspect_ratio", "16:9"))
	require.NoError(t, writer.WriteField("resolution", "2k"))
	require.NoError(t, writer.WriteField("quality", "medium"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("image-bytes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, c.Request.ParseMultipartForm(32<<20))

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{
		Model:       "grok-imagine-image-2.0",
		Prompt:      "edit this",
		N:           common.GetPointer(uint(1)),
		AspectRatio: "16:9",
		Resolution:  "2k",
		Quality:     "medium",
	})
	require.NoError(t, err)
	bodyBytes, err := common.Marshal(converted)
	require.NoError(t, err)
	var payload struct {
		Image struct {
			URL string `json:"url"`
		} `json:"image"`
	}
	require.NoError(t, common.Unmarshal(bodyBytes, &payload))
	require.True(t, strings.HasPrefix(payload.Image.URL, "data:image/png;base64,"))
}
