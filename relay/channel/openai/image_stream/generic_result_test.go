package image_stream

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type genericImageRoundTripFunc func(*http.Request) (*http.Response, error)

func (f genericImageRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestBuildStoredGenericImageResponseMaterializesBase64WithoutProviderMetadata(t *testing.T) {
	png := append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, []byte("image-one")...)
	response := &dto.ImageResponse{
		Created:  1710000000,
		Metadata: json.RawMessage(`{"provider":"example"}`),
		Data: []dto.ImageData{{
			B64Json:       base64.StdEncoding.EncodeToString(png),
			RevisedPrompt: "revised cat",
		}},
	}

	var uploaded []byte
	var claimedFormat string
	stored, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		response,
		&http.Client{},
		func(_ context.Context, raw []byte, format string) (string, string, error) {
			uploaded = append([]byte(nil), raw...)
			claimedFormat = format
			return "https://cdn.example.com/image.png", format, nil
		},
		defaultGenericImageMaterializationLimits,
	)

	require.NoError(t, err)
	require.Len(t, stored.Data, 1)
	assert.Equal(t, int64(1710000000), stored.Created)
	assert.Empty(t, stored.Metadata)
	assert.Equal(t, "https://cdn.example.com/image.png", stored.Data[0].Url)
	assert.Empty(t, stored.Data[0].B64Json)
	assert.Equal(t, "revised cat", stored.Data[0].RevisedPrompt)
	assert.Equal(t, png, uploaded)
	assert.Equal(t, "png", claimedFormat)
	assert.NotEmpty(t, response.Data[0].B64Json, "the durable provider result must remain reusable")
}

func TestBuildStoredGenericImageResponsePreservesMultipleImageOrder(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1}
	jpeg := []byte{0xff, 0xd8, 0xff, 2}
	webp := []byte{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 3}
	gif := []byte{'G', 'I', 'F', '8', '9', 'a', 4}
	response := &dto.ImageResponse{Data: []dto.ImageData{
		{B64Json: base64.StdEncoding.EncodeToString(png), RevisedPrompt: "one"},
		{Url: "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(jpeg), RevisedPrompt: "two"},
		{B64Json: "data:image/webp;base64," + base64.StdEncoding.EncodeToString(webp), RevisedPrompt: "three"},
		{Url: "data:image/gif;base64," + base64.StdEncoding.EncodeToString(gif), RevisedPrompt: "four"},
	}}

	var formats []string
	stored, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		response,
		&http.Client{},
		func(_ context.Context, _ []byte, format string) (string, string, error) {
			formats = append(formats, format)
			return fmt.Sprintf("https://cdn.example.com/%d.%s", len(formats), format), format, nil
		},
		defaultGenericImageMaterializationLimits,
	)

	require.NoError(t, err)
	assert.Equal(t, []string{"png", "jpg", "webp", "gif"}, formats)
	require.Len(t, stored.Data, 4)
	for index, item := range stored.Data {
		assert.Equal(t, fmt.Sprintf("https://cdn.example.com/%d.%s", index+1, formats[index]), item.Url)
		assert.Empty(t, item.B64Json)
		assert.Equal(t, response.Data[index].RevisedPrompt, item.RevisedPrompt)
	}
}

func TestBuildStoredGenericImageResponseFetchesURLWithContext(t *testing.T) {
	type contextKey string
	const key contextKey = "task"
	ctx := context.WithValue(context.Background(), key, "task-123")
	gif := []byte{'G', 'I', 'F', '8', '7', 'a', 1}
	client := &http.Client{Transport: genericImageRoundTripFunc(func(request *http.Request) (*http.Response, error) {
		assert.Equal(t, "task-123", request.Context().Value(key))
		assert.Equal(t, http.MethodGet, request.Method)
		assert.Equal(t, "image/png,image/jpeg,image/webp,image/gif", request.Header.Get("Accept"))
		return &http.Response{
			StatusCode:    http.StatusOK,
			ContentLength: int64(len(gif)),
			Body:          io.NopCloser(bytes.NewReader(gif)),
			Header:        make(http.Header),
		}, nil
	})}

	stored, err := buildStoredGenericImageResponseWithDependencies(
		ctx,
		&dto.ImageResponse{Data: []dto.ImageData{{Url: "https://images.example.com/result"}}},
		client,
		func(uploadCtx context.Context, raw []byte, format string) (string, string, error) {
			assert.Equal(t, "task-123", uploadCtx.Value(key))
			assert.Equal(t, gif, raw)
			assert.Equal(t, "gif", format)
			return "https://cdn.example.com/result.gif", format, nil
		},
		defaultGenericImageMaterializationLimits,
	)

	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/result.gif", stored.Data[0].Url)
}

func TestBuildStoredGenericImageResponseValidatesAllSourcesBeforeUploading(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1}
	jpeg := []byte{0xff, 0xd8, 0xff, 2}
	uploads := 0
	fetches := 0
	client := &http.Client{Transport: genericImageRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		fetches++
		assert.Zero(t, uploads, "no object may be uploaded before every source passes validation")
		return &http.Response{
			StatusCode:    http.StatusOK,
			ContentLength: int64(len(jpeg)),
			Body:          io.NopCloser(bytes.NewReader(jpeg)),
			Header:        make(http.Header),
		}, nil
	})}

	stored, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: []dto.ImageData{
			{B64Json: base64.StdEncoding.EncodeToString(png)},
			{Url: "https://images.example.com/second.jpg"},
		}},
		client,
		func(_ context.Context, _ []byte, format string) (string, string, error) {
			assert.Equal(t, 1, fetches)
			uploads++
			return fmt.Sprintf("https://cdn.example.com/%d.%s", uploads, format), format, nil
		},
		genericImageMaterializationLimits{maxImages: 2, maxImageBytes: 32},
	)

	require.NoError(t, err)
	assert.Equal(t, 1, fetches)
	assert.Equal(t, 2, uploads)
	require.Len(t, stored.Data, 2)
}

func TestBuildStoredGenericImageResponseDoesNotUploadPartialAggregate(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1, 2, 3, 4}
	uploads := 0

	_, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: []dto.ImageData{
			{B64Json: base64.StdEncoding.EncodeToString(png)},
			{B64Json: base64.StdEncoding.EncodeToString(png)},
		}},
		&http.Client{},
		func(_ context.Context, _ []byte, format string) (string, string, error) {
			uploads++
			return "https://cdn.example.com/result." + format, format, nil
		},
		genericImageMaterializationLimits{
			maxImages:     2,
			maxImageBytes: int64(len(png)),
			maxTotalBytes: int64(len(png)*2 - 1),
		},
	)

	require.Error(t, err)
	assert.Zero(t, uploads)
	assert.Contains(t, err.Error(), "total byte limit")
}

func TestBuildStoredGenericImageResponseRejectsDisallowedInputFormatBeforeUpload(t *testing.T) {
	gif := []byte{'G', 'I', 'F', '8', '9', 'a', 1}
	uploads := 0

	_, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: []dto.ImageData{{B64Json: base64.StdEncoding.EncodeToString(gif)}}},
		&http.Client{},
		func(_ context.Context, _ []byte, format string) (string, string, error) {
			uploads++
			return "https://cdn.example.com/result." + format, format, nil
		},
		genericImageMaterializationLimits{
			maxImages:     1,
			maxImageBytes: 32,
			maxTotalBytes: 32,
			allowedFormats: map[string]struct{}{
				"png":  {},
				"jpg":  {},
				"webp": {},
			},
		},
	)

	require.Error(t, err)
	assert.Zero(t, uploads)
	assert.Contains(t, err.Error(), "format gif is not supported")
}

func TestMaterializedGenericImageResponseSurvivesProviderURLExpiry(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 7}
	fetches := 0
	providerClient := &http.Client{Transport: genericImageRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		fetches++
		return &http.Response{
			StatusCode:    http.StatusOK,
			ContentLength: int64(len(png)),
			Body:          io.NopCloser(bytes.NewReader(png)),
			Header:        make(http.Header),
		}, nil
	})}
	materialized, err := materializeGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: []dto.ImageData{{Url: "https://provider.example/temporary.png"}}},
		providerClient,
		defaultGenericImageMaterializationLimits,
	)
	require.NoError(t, err)
	require.Len(t, materialized.Data, 1)
	assert.Empty(t, materialized.Data[0].Url)
	assert.NotEmpty(t, materialized.Data[0].B64Json)
	assert.Equal(t, 1, fetches)

	expiredClient := &http.Client{Transport: genericImageRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("temporary provider URL expired")
	})}
	stored, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		materialized,
		expiredClient,
		func(_ context.Context, raw []byte, format string) (string, string, error) {
			assert.Equal(t, png, raw)
			return "https://cdn.example.com/stable.png", format, nil
		},
		defaultGenericImageMaterializationLimits,
	)
	require.NoError(t, err)
	assert.Equal(t, "https://cdn.example.com/stable.png", stored.Data[0].Url)
}

func TestBuildStoredGenericImageResponseRejectsInvalidMagic(t *testing.T) {
	uploaded := false
	_, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: []dto.ImageData{{B64Json: base64.StdEncoding.EncodeToString([]byte("not an image"))}}},
		&http.Client{},
		func(_ context.Context, _ []byte, _ string) (string, string, error) {
			uploaded = true
			return "", "", nil
		},
		defaultGenericImageMaterializationLimits,
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported magic bytes")
	assert.False(t, uploaded)
	var storageErr *imageStorageError
	require.ErrorAs(t, err, &storageErr)
	assert.True(t, storageErr.Permanent())
}

func TestBuildStoredGenericImageResponseEnforcesByteLimits(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 1, 2, 3, 4}
	encoded := base64.StdEncoding.EncodeToString(png)
	tests := []struct {
		name     string
		response *dto.ImageResponse
		limits   genericImageMaterializationLimits
		message  string
	}{
		{
			name:     "single image",
			response: &dto.ImageResponse{Data: []dto.ImageData{{B64Json: encoded}}},
			limits:   genericImageMaterializationLimits{maxImages: 1, maxImageBytes: int64(len(png) - 1), maxTotalBytes: 100},
			message:  "image exceeds",
		},
		{
			name:     "combined images",
			response: &dto.ImageResponse{Data: []dto.ImageData{{B64Json: encoded}, {B64Json: encoded}}},
			limits:   genericImageMaterializationLimits{maxImages: 2, maxImageBytes: 100, maxTotalBytes: int64(len(png)*2 - 1)},
			message:  "total byte limit",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := buildStoredGenericImageResponseWithDependencies(
				context.Background(),
				test.response,
				&http.Client{},
				func(_ context.Context, _ []byte, format string) (string, string, error) {
					return "https://cdn.example.com/result." + format, format, nil
				},
				test.limits,
			)
			require.Error(t, err)
			assert.Contains(t, err.Error(), test.message)
			var storageErr *imageStorageError
			require.ErrorAs(t, err, &storageErr)
			assert.True(t, storageErr.Permanent())
		})
	}
}

func TestBuildStoredGenericImageResponseRejectsTooManyImages(t *testing.T) {
	data := make([]dto.ImageData, dto.MaxImageN+1)
	_, err := buildStoredGenericImageResponseWithDependencies(
		context.Background(),
		&dto.ImageResponse{Data: data},
		&http.Client{},
		func(_ context.Context, _ []byte, _ string) (string, string, error) { return "", "", nil },
		defaultGenericImageMaterializationLimits,
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), fmt.Sprintf("max %d", dto.MaxImageN))
}
