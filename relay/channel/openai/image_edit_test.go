package openai

import (
	"bytes"
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
	"github.com/stretchr/testify/assert"
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

// TestConvertImageEditRequestPreservesFilenames verifies that multipart conversion
// preserves image and mask attachments with filenames that require escaping.
func TestConvertImageEditRequestPreservesFilenames(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, filename := range []string{"input.png", `input"quoted.png`, `input\\backslash.png`, "图片.png"} {
		for _, imageField := range []string{"image", "image[]"} {
			t.Run(imageField+"/"+filename, func(t *testing.T) {
				var body bytes.Buffer
				writer := multipart.NewWriter(&body)
				fields := []string{imageField, "mask"}
				if imageField == "image[]" {
					fields = append(fields, imageField)
				}
				for _, field := range fields {
					part, err := writer.CreateFormFile(field, filename)
					require.NoError(t, err)
					_, err = io.WriteString(part, "contents of "+field)
					require.NoError(t, err)
				}
				require.NoError(t, writer.Close())

				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
				c.Request.Header.Set("Content-Type", writer.FormDataContentType())
				require.NoError(t, c.Request.ParseMultipartForm(32<<20))
				t.Cleanup(func() { require.NoError(t, c.Request.MultipartForm.RemoveAll()) })

				converted, err := (&Adaptor{}).ConvertImageRequest(c, &relaycommon.RelayInfo{
					RelayMode: relayconstant.RelayModeImagesEdits,
				}, dto.ImageRequest{Model: "gpt-image-1"})
				require.NoError(t, err)
				convertedBody, ok := converted.(*bytes.Buffer)
				require.True(t, ok)
				replayed := httptest.NewRequest(http.MethodPost, "/v1/images/edits", convertedBody)
				replayed.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
				require.NoError(t, replayed.ParseMultipartForm(32<<20))
				t.Cleanup(func() { require.NoError(t, replayed.MultipartForm.RemoveAll()) })

				for _, field := range []string{imageField, "mask"} {
					wantCount := 1
					if field == "image[]" {
						wantCount = 2
					}
					files := replayed.MultipartForm.File[field]
					require.Len(t, files, wantCount)
					for _, header := range files {
						assert.Equal(t, c.Request.MultipartForm.File[field][0].Filename, header.Filename)
						assert.Equal(t, "image/png", header.Header.Get("Content-Type"))
						file, err := header.Open()
						require.NoError(t, err)
						contents, err := io.ReadAll(file)
						require.NoError(t, err)
						require.NoError(t, file.Close())
						assert.Equal(t, "contents of "+field, string(contents))
					}
				}
			})
		}
	}
}
