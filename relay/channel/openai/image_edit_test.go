package openai

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestConvertImageEditRequestMultipart verifies that ConvertImageRequest
// re-serializes multipart image edit requests with all fields (including
// stream) and the file intact, both when the form was already parsed and when
// it must be re-parsed from the reusable body.
func TestConvertImageEditRequestMultipart(t *testing.T) {
	gin.SetMode(gin.TestMode)

	newMultipartContext := func(t *testing.T, prompt string) *gin.Context {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "gpt-image-1"))
		require.NoError(t, writer.WriteField("prompt", prompt))
		require.NoError(t, writer.WriteField("stream", "true"))
		require.NoError(t, writer.WriteField("partial_images", "3"))
		part, err := writer.CreateFormFile("image", "input.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("fake image"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())

		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
		c.Request.Header.Set("Content-Type", writer.FormDataContentType())
		return c
	}

	convertAndReplay := func(t *testing.T, c *gin.Context, prompt string) {
		info := &relaycommon.RelayInfo{
			RelayMode: relayconstant.RelayModeImagesEdits,
		}
		request := dto.ImageRequest{
			Model:  "gpt-image-1",
			Prompt: prompt,
			Stream: common.GetPointer(true),
		}

		converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
		require.NoError(t, err)
		convertedBody, ok := converted.(*bytes.Buffer)
		require.True(t, ok)

		replayedRequest := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
		replayedRequest.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
		require.NoError(t, replayedRequest.ParseMultipartForm(32<<20))

		require.Equal(t, "gpt-image-1", replayedRequest.PostForm.Get("model"))
		require.Equal(t, prompt, replayedRequest.PostForm.Get("prompt"))
		require.Equal(t, "true", replayedRequest.PostForm.Get("stream"))
		require.Equal(t, "3", replayedRequest.PostForm.Get("partial_images"))
		require.Len(t, replayedRequest.MultipartForm.File["image"], 1)

		file, err := replayedRequest.MultipartForm.File["image"][0].Open()
		require.NoError(t, err)
		defer file.Close()
		fileBytes, err := io.ReadAll(file)
		require.NoError(t, err)
		require.Equal(t, []byte("fake image"), fileBytes)
	}

	t.Run("with pre-parsed form", func(t *testing.T) {
		prompt := "edit this image"
		c := newMultipartContext(t, prompt)
		require.NoError(t, c.Request.ParseMultipartForm(32<<20))

		convertAndReplay(t, c, prompt)
		convertAndReplay(t, c, prompt)
	})

	t.Run("re-parses reusable body when form is missing", func(t *testing.T) {
		prompt := "edit without pre-parsed form"
		c := newMultipartContext(t, prompt)

		storage, err := common.GetBodyStorage(c)
		require.NoError(t, err)
		c.Request.Body = io.NopCloser(storage)
		c.Request.MultipartForm = nil
		c.Request.PostForm = nil

		convertAndReplay(t, c, prompt)
	})
}

func TestConvertImageEditRequestReplaysAllOrderedReferenceForms(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "image-auto"))
	require.NoError(t, writer.WriteField("prompt", "combine references"))
	type imagePart struct {
		field string
		name  string
		body  string
	}
	items := []imagePart{
		{field: "image", name: "plain.png", body: "plain"},
		{field: "image[]", name: "array-1.png", body: "array-1"},
		{field: "image[]", name: "array-2.png", body: "array-2"},
	}
	for index := 3; index <= 13; index++ {
		value := fmt.Sprintf("array-%d", index)
		items = append(items, imagePart{field: "image[]", name: value + ".png", body: value})
	}
	items = append(items,
		imagePart{field: "image[2]", name: "indexed-2.png", body: "indexed-2"},
		imagePart{field: "image[0]", name: "indexed-0.png", body: "indexed-0"},
	)
	for _, item := range items {
		part, err := writer.CreateFormFile(item.field, item.name)
		require.NoError(t, err)
		_, err = part.Write([]byte(item.body))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	storage, err := common.GetBodyStorage(c)
	require.NoError(t, err)
	c.Request.Body = io.NopCloser(storage)

	request := dto.ImageRequest{Model: "image-auto", Prompt: "combine references"}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}
	wantNames := []string{"plain.png", "array-1.png", "array-2.png"}
	wantBodies := []string{"plain", "array-1", "array-2"}
	for index := 3; index <= 13; index++ {
		value := fmt.Sprintf("array-%d", index)
		wantNames = append(wantNames, value+".png")
		wantBodies = append(wantBodies, value)
	}
	wantNames = append(wantNames, "indexed-0.png", "indexed-2.png")
	wantBodies = append(wantBodies, "indexed-0", "indexed-2")
	require.Len(t, wantNames, 16)

	for attempt := 0; attempt < 3; attempt++ {
		converted, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
		require.NoError(t, err)
		convertedBody, ok := converted.(*bytes.Buffer)
		require.True(t, ok)

		replayed := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(convertedBody.Bytes()))
		replayed.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
		require.NoError(t, replayed.ParseMultipartForm(32<<20))
		files := replayed.MultipartForm.File["image[]"]
		require.Len(t, files, len(wantNames))
		for index, fileHeader := range files {
			require.Equal(t, wantNames[index], fileHeader.Filename)
			file, err := fileHeader.Open()
			require.NoError(t, err)
			contents, err := io.ReadAll(file)
			require.NoError(t, err)
			require.NoError(t, file.Close())
			require.Equal(t, wantBodies[index], string(contents))
		}
	}
}
