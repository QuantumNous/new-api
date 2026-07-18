package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrepareAsyncImageInputsStoresAndRewritesSources(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	originalStore := storeAsyncImageSources
	t.Cleanup(func() { storeAsyncImageSources = originalStore })
	storeAsyncImageSources = func(_ context.Context, response *dto.ImageResponse) (*storedAsyncImageSources, error) {
		require.Len(t, response.Data, 2)
		assert.Equal(t, "https://source.example.com/reference.png", response.Data[0].Url)
		assert.Equal(t, "data:image/png;base64,iVBORw0KGgo=", response.Data[1].Url)
		return &storedAsyncImageSources{
			URLs: []string{
				"https://test-account.r2.cloudflarestorage.com/test-input-bucket/inputs/first.png?signature=one",
				"https://test-account.r2.cloudflarestorage.com/test-input-bucket/inputs/second.png?signature=two",
			},
			ObjectKeys: []string{"inputs/first.png", "inputs/second.png"},
		}, nil
	}

	request := &dto.ImageRequest{
		Model:  "nano-banana-2",
		Prompt: "make a poster",
		Images: json.RawMessage(`[
			"https://source.example.com/reference.png",
			"data:image/png;base64,iVBORw0KGgo="
		]`),
	}
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	prepared, apiErr := PrepareAsyncImageInputs(c, request)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.Equal(t, []string{"inputs/first.png", "inputs/second.png"}, prepared.ObjectKeys)
	urls, err := request.ImageInputURLs()
	require.NoError(t, err)
	assert.Equal(t, []string{
		"https://test-account.r2.cloudflarestorage.com/test-input-bucket/inputs/first.png?signature=one",
		"https://test-account.r2.cloudflarestorage.com/test-input-bucket/inputs/second.png?signature=two",
	}, urls)
	assert.JSONEq(t, `"https://test-account.r2.cloudflarestorage.com/test-input-bucket/inputs/first.png?signature=one"`, string(request.Image))
}

func TestPrepareAsyncImageInputsStoresJSONMaskSeparately(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	originalStore := storeAsyncImageSources
	t.Cleanup(func() { storeAsyncImageSources = originalStore })
	call := 0
	storeAsyncImageSources = func(_ context.Context, response *dto.ImageResponse) (*storedAsyncImageSources, error) {
		call++
		require.Len(t, response.Data, 1)
		if call == 1 {
			assert.Equal(t, "https://source.example.com/reference.png", response.Data[0].Url)
			return &storedAsyncImageSources{
				URLs:       []string{"https://private.example.com/input.png"},
				ObjectKeys: []string{"inputs/reference.png"},
			}, nil
		}
		assert.Equal(t, "data:image/png;base64,iVBORw0KGgo=", response.Data[0].Url)
		return &storedAsyncImageSources{
			URLs:       []string{"https://private.example.com/mask.png"},
			ObjectKeys: []string{"inputs/mask.png"},
		}, nil
	}
	request := &dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "edit",
		Images: json.RawMessage(`["https://source.example.com/reference.png"]`),
		Mask:   json.RawMessage(`"data:image/png;base64,iVBORw0KGgo="`),
	}

	prepared, apiErr := PrepareAsyncImageInputs(nil, request)

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	assert.Equal(t, []string{"inputs/reference.png"}, prepared.ObjectKeys)
	assert.Equal(t, "inputs/mask.png", prepared.MaskObjectKey)
	assert.JSONEq(t, `"https://private.example.com/mask.png"`, string(request.Mask))
}

func TestPrepareAsyncImageInputsAppliesCombinedSizeLimitToJSONMask(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	originalStore := storeAsyncImageSources
	t.Cleanup(func() { storeAsyncImageSources = originalStore })
	call := 0
	storeAsyncImageSources = func(_ context.Context, _ *dto.ImageResponse) (*storedAsyncImageSources, error) {
		call++
		if call == 1 {
			return &storedAsyncImageSources{
				URLs:       []string{"https://private.example.com/input.png"},
				ObjectKeys: []string{"inputs/reference.png"},
				TotalBytes: 50 << 20,
			}, nil
		}
		return &storedAsyncImageSources{
			URLs:       []string{"https://private.example.com/mask.png"},
			ObjectKeys: []string{"inputs/mask.png"},
			TotalBytes: 20 << 20,
		}, nil
	}
	request := &dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "edit",
		Images: json.RawMessage(`["https://source.example.com/reference.png"]`),
		Mask:   json.RawMessage(`"data:image/png;base64,iVBORw0KGgo="`),
	}

	_, apiErr := PrepareAsyncImageInputs(nil, request)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "image inputs and mask exceed")
}

func TestPrepareAsyncImageInputsRequiresStorageBeforeTaskSubmission(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "")

	request := &dto.ImageRequest{
		Model:  "nano-banana-2",
		Prompt: "make a poster",
		Images: json.RawMessage(`["https://source.example.com/reference.png"]`),
	}

	_, apiErr := PrepareAsyncImageInputs(nil, request)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "separate private")
}

func TestPrepareAsyncImageInputsRejectsPublicOutputBucketReuse(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "shared-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "shared-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	request := &dto.ImageRequest{
		Model:  "nano-banana-2",
		Prompt: "make a poster",
		Images: json.RawMessage(`["https://source.example.com/reference.png"]`),
	}

	_, apiErr := PrepareAsyncImageInputs(nil, request)

	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
}

func TestPrepareAsyncImageInputsDoesNotRequirePrivateBucketWithoutSources(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "")
	request := &dto.ImageRequest{Model: "nano-banana-2", Prompt: "make a poster"}

	prepared, apiErr := PrepareAsyncImageInputs(nil, request)

	require.Nil(t, apiErr)
	assert.Nil(t, prepared)
}

func TestValidateAsyncMultipartImageFieldShapeRejectsAmbiguousStyles(t *testing.T) {
	form := &multipart.Form{Value: map[string][]string{
		"image":   {"https://example.com/first.png"},
		"image[]": {"https://example.com/second.png"},
	}}

	err := validateAsyncMultipartImageFieldShape(form)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "one field style")
}

func TestValidateAsyncMultipartImageFieldShapeAcceptsIndexedImages(t *testing.T) {
	form := &multipart.Form{Value: map[string][]string{
		"image[0]": {"https://example.com/first.png"},
		"image[1]": {"https://example.com/second.png"},
	}}

	err := validateAsyncMultipartImageFieldShape(form)

	require.NoError(t, err)
}

func TestIndexedImageFieldNumberRejectsMalformedNames(t *testing.T) {
	for _, name := range []string{"image[", "image[]x", "image[-1]", "image[01]", "image[one]"} {
		t.Run(name, func(t *testing.T) {
			_, ok := indexedImageFieldNumber(name)
			assert.False(t, ok)
			assert.False(t, isImageFieldName(name))
		})
	}
}

func TestDefaultStoreAsyncMultipartImageSourcesOrdersIndexedImagesNumerically(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	imageTwo := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x02, 0x02}
	imageTen := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x0a, 0x0a}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image[10]", "ten.png")
	require.NoError(t, err)
	_, err = part.Write(imageTen)
	require.NoError(t, err)
	part, err = writer.CreateFormFile("image[2]", "two.png")
	require.NoError(t, err)
	_, err = part.Write(imageTwo)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	request := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, request.ParseMultipartForm(1<<20))
	t.Cleanup(func() { _ = request.MultipartForm.RemoveAll() })

	var uploaded [][]byte
	previousTransport := http.DefaultClient.Transport
	http.DefaultClient.Transport = genericImageRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		got, readErr := io.ReadAll(request.Body)
		require.NoError(t, readErr)
		uploaded = append(uploaded, got)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(nil)),
			Request:    request,
		}, nil
	})
	t.Cleanup(func() { http.DefaultClient.Transport = previousTransport })

	stored, err := defaultStoreAsyncMultipartImageSources(context.Background(), request.MultipartForm)

	require.NoError(t, err)
	require.Len(t, stored.ObjectKeys, 2)
	assert.Equal(t, [][]byte{imageTwo, imageTen}, uploaded)
}

func TestPrepareAsyncImageInputsStreamsSpilledDataURIToPrivateR2(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01, 0x02}
	previousTransport := http.DefaultClient.Transport
	http.DefaultClient.Transport = genericImageRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPut, request.Method)
		got, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.Equal(t, png, got)
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(bytes.NewReader(nil)),
			Request:    request,
		}, nil
	})
	t.Cleanup(func() { http.DefaultClient.Transport = previousTransport })

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "gpt-image-1"))
	require.NoError(t, writer.WriteField("prompt", "edit"))
	require.NoError(t, writer.WriteField("image", "data:image/png;base64,"+base64.StdEncoding.EncodeToString(png)))
	require.NoError(t, writer.Close())
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	form, err := common.ParseMultipartFormReusable(c)
	require.NoError(t, err)
	require.Empty(t, form.Value["image"])

	prepared, apiErr := PrepareAsyncImageInputs(c, &dto.ImageRequest{Model: "gpt-image-1", Prompt: "edit"})

	require.Nil(t, apiErr)
	require.NotNil(t, prepared)
	require.Len(t, prepared.ObjectKeys, 1)
	assert.Contains(t, prepared.ObjectKeys[0], "/"+sha256HexBytes(png)+".png")
}

func TestDefaultStoreAsyncImageSourcesRejectsInvalidImageAsPermanent(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	_, err := defaultStoreAsyncImageSources(context.Background(), &dto.ImageResponse{Data: []dto.ImageData{{
		Url: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("not an image")),
	}}})

	require.Error(t, err)
	var storageErr *imageStorageError
	require.ErrorAs(t, err, &storageErr)
	assert.True(t, storageErr.Permanent())
	assert.Contains(t, err.Error(), "unsupported image type")
}

func TestDefaultStoreAsyncImageSourcesRejectsInvalidBase64AsPermanent(t *testing.T) {
	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")

	_, err := defaultStoreAsyncImageSources(context.Background(), &dto.ImageResponse{Data: []dto.ImageData{{
		Url: "data:image/png;base64,not-valid-base64!",
	}}})

	require.Error(t, err)
	var storageErr *imageStorageError
	require.ErrorAs(t, err, &storageErr)
	assert.True(t, storageErr.Permanent())
	assert.Contains(t, err.Error(), "decode image base64")
}
