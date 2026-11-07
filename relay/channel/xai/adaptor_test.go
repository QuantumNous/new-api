package xai

import (
	"bytes"
	"encoding/base64"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestMultipartToXAIJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	pngData := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	c.Request = newMultipartRequest(t, "image", "input.png", pngData)
	require.NoError(t, c.Request.ParseMultipartForm(32<<20))

	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}
	converted, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{
		Model:  "grok-imagine-image",
		Prompt: "make it a painting",
	})
	require.NoError(t, err)
	request := converted.(ImageRequest)
	require.NotNil(t, request.Image)
	require.Empty(t, request.Images)
	require.Equal(t, "image_url", request.Image.Type)
	require.Equal(t, "data:image/png;base64,"+base64.StdEncoding.EncodeToString(pngData), request.Image.URL)
	require.Equal(t, "application/json", c.Request.Header.Get("Content-Type"))
}

func TestConvertImageRequestMultipartMultipleImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = newMultipartRequestWithFiles(t, "image[]", []fileFixture{{"one.png", []byte("one")}, {"two.png", []byte("two")}})
	require.NoError(t, c.Request.ParseMultipartForm(32<<20))

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{Prompt: "combine"})
	require.NoError(t, err)
	request := converted.(ImageRequest)
	require.Len(t, request.Images, 2)
	require.Nil(t, request.Image)
	require.True(t, strings.HasSuffix(request.Images[0].URL, base64.StdEncoding.EncodeToString([]byte("one"))))
	require.True(t, strings.HasSuffix(request.Images[1].URL, base64.StdEncoding.EncodeToString([]byte("two"))))
}

func TestConvertImageRequestRejectsUnsupportedMaskAndMissingImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	newContext := func() *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewBufferString(`{"model":"grok-imagine-image","prompt":"edit"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		return c
	}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	_, err := (&Adaptor{}).ConvertImageRequest(newContext(), info, dto.ImageRequest{Prompt: "edit", Mask: []byte(`{"foo":"bar"}`)})
	require.EqualError(t, err, "xAI image edits do not support mask")

	_, err = (&Adaptor{}).ConvertImageRequest(newContext(), info, dto.ImageRequest{Prompt: "edit"})
	require.EqualError(t, err, "xAI image edits require at least one image")
}

func TestConvertImageRequestPreservesNativeJSONImage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewBufferString(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{
		Prompt: "edit",
		Image:  []byte(`{"type":"image_url","url":"https://example.com/input.png"}`),
	})
	require.NoError(t, err)
	request := converted.(ImageRequest)
	require.Equal(t, "https://example.com/input.png", request.Image.URL)
}

func TestConvertImageRequestPreservesNativeJSONImages(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewBufferString(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")

	converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}, dto.ImageRequest{
		Prompt: "combine",
		Images: []byte(`[{"type":"image_url","url":"https://example.com/one.png"},{"type":"image_url","url":"https://example.com/two.png"}]`),
	})
	require.NoError(t, err)
	request := converted.(ImageRequest)
	require.Nil(t, request.Image)
	require.Equal(t, []ImageInput{
		{Type: "image_url", URL: "https://example.com/one.png"},
		{Type: "image_url", URL: "https://example.com/two.png"},
	}, request.Images)
}

func TestConvertImageRequestRejectsStreaming(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name      string
		relayMode int
	}{
		{name: "generation", relayMode: relayconstant.RelayModeImagesGenerations},
		{name: "edit", relayMode: relayconstant.RelayModeImagesEdits},
	} {
		t.Run(test.name, func(t *testing.T) {
			stream := true
			request := dto.ImageRequest{
				Model:  "grok-imagine-image",
				Prompt: "edit",
				Stream: &stream,
			}

			converted, err := (&Adaptor{}).ConvertImageRequest(
				ginTestContext(),
				&relaycommon.RelayInfo{RelayMode: test.relayMode},
				request,
			)
			require.Nil(t, converted)
			require.Error(t, err)
			apiErr, ok := err.(*types.NewAPIError)
			require.True(t, ok)
			require.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			require.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
			require.EqualError(t, apiErr, "xAI image generation and editing do not support streaming")
		})
	}
}

func ginTestContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewBufferString(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

type fileFixture struct {
	name string
	data []byte
}

func newMultipartRequest(t *testing.T, field, filename string, data []byte) *http.Request {
	return newMultipartRequestWithFiles(t, field, []fileFixture{{filename, data}})
}

func newMultipartRequestWithFiles(t *testing.T, field string, files []fileFixture) *http.Request {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, file := range files {
		part, err := writer.CreateFormFile(field, file.name)
		require.NoError(t, err)
		_, err = part.Write(file.data)
		require.NoError(t, err)
	}
	require.NoError(t, writer.WriteField("prompt", "edit"))
	require.NoError(t, writer.Close())
	request := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request
}
