package relay

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	openaiadaptor "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestPrepareImageUpscaleMultipartKeepsImageAndForcesOneKPNG(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-2.5-2k"))
	require.NoError(t, writer.WriteField("prompt", "edit this"))
	require.NoError(t, writer.WriteField("size", "4096x2304"))
	require.NoError(t, writer.WriteField("n", "1"))
	require.NoError(t, writer.WriteField("stream", "false"))
	require.NoError(t, writer.WriteField("response_format", "url"))
	require.NoError(t, writer.WriteField("output_format", "png"))
	part, err := writer.CreateFormFile("image", "input.png")
	require.NoError(t, err)
	_, err = part.Write([]byte("source image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	form, err := common.ParseMultipartFormReusable(c)
	require.NoError(t, err)
	c.Request.MultipartForm = form

	n := uint(1)
	stream := false
	request := &dto.ImageRequest{
		Model:  "gpt-image-2.5",
		Prompt: "edit this",
		Size:   "4096x2304",
		N:      &n,
		Stream: &stream,
	}
	require.NoError(t, prepareImageUpscaleRequest(c, request))
	converted, err := (&openaiadaptor.Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, *request)
	require.NoError(t, err)
	convertedBody, ok := converted.(*bytes.Buffer)
	require.True(t, ok)
	upstream := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
	upstream.Header.Set("Content-Type", c.GetHeader("Content-Type"))
	require.NoError(t, upstream.ParseMultipartForm(32<<20))

	require.Equal(t, "1024x576", request.Size)
	require.Equal(t, "gpt-image-2.5", upstream.PostForm.Get("model"))
	require.Equal(t, "1024x576", upstream.PostForm.Get("size"))
	require.Equal(t, "1", upstream.PostForm.Get("n"))
	require.Equal(t, "false", upstream.PostForm.Get("stream"))
	require.Equal(t, "b64_json", upstream.PostForm.Get("response_format"))
	require.Equal(t, "png", upstream.PostForm.Get("output_format"))
	require.Empty(t, upstream.PostForm.Get("partial_images"))
	require.Len(t, upstream.MultipartForm.File["image"], 1)
	file, err := upstream.MultipartForm.File["image"][0].Open()
	require.NoError(t, err)
	defer file.Close()
	contents, err := io.ReadAll(file)
	require.NoError(t, err)
	require.Equal(t, []byte("source image"), contents)
}
