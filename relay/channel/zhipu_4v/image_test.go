package zhipu_4v

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestZhipu4vImageHandlerReturnsProviderURLForURLResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	providerURL := "http://127.0.0.1:1/must-not-be-downloaded.png"
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewBufferString(`{"created":1710000000,"data":[{"url":"` + providerURL + `"}]}`)),
	}
	info := &relaycommon.RelayInfo{
		StartTime: time.Unix(1700000000, 0),
		Request:   &dto.ImageRequest{ResponseFormat: "url"},
	}

	usage, apiErr := zhipu4vImageHandler(c, resp, info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	var payload dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Len(t, payload.Data, 1)
	assert.Equal(t, providerURL, payload.Data[0].Url)
	assert.Empty(t, payload.Data[0].B64Json)
}

func TestZhipu4vImageHandlerPreservesProviderBase64WithoutURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewBufferString(`{"data":[{"b64_image":"cG5n"}]}`)),
	}
	info := &relaycommon.RelayInfo{
		StartTime: time.Unix(1700000000, 0),
		Request:   &dto.ImageRequest{ResponseFormat: "b64_json"},
	}

	usage, apiErr := zhipu4vImageHandler(c, resp, info)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)

	var payload dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Len(t, payload.Data, 1)
	assert.Empty(t, payload.Data[0].Url)
	assert.Equal(t, "cG5n", payload.Data[0].B64Json)
}

func TestDownloadZhipuImageBase64UsesContextAndSizeLimit(t *testing.T) {
	imageBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(imageBytes)
	}))
	t.Cleanup(server.Close)

	t.Run("success", func(t *testing.T) {
		encoded, err := downloadZhipuImageBase64(context.Background(), server.Client(), server.URL, int64(len(imageBytes)))
		require.NoError(t, err)
		assert.Equal(t, base64.StdEncoding.EncodeToString(imageBytes), encoded)
	})

	t.Run("canceled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		_, err := downloadZhipuImageBase64(ctx, server.Client(), server.URL, int64(len(imageBytes)))
		require.Error(t, err)
		assert.ErrorIs(t, err, context.Canceled)
	})

	t.Run("too large", func(t *testing.T) {
		_, err := downloadZhipuImageBase64(context.Background(), server.Client(), server.URL, int64(len(imageBytes)-1))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "exceeds maximum allowed size")
	})
}
