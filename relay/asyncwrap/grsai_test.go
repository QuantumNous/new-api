package asyncwrap

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGRSAIExecutorUsesSynchronousJSONMode(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requests.Add(1)
		assert.Equal(t, "/v1/api/generate", request.URL.Path)
		assert.Equal(t, "Bearer test-placeholder-key", request.Header.Get("Authorization"))
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{
			"model":"nano-banana-2",
			"prompt":"draw a lighthouse",
			"images":["https://example.com/reference.png"],
			"aspectRatio":"16:9",
			"imageSize":"2K",
			"replyType":"json"
		}`, string(body))
		_, _ = writer.Write([]byte(`{"id":"sync-1","status":"succeeded","results":[{"url":"https://example.com/result.png"}]}`))
	}))
	defer server.Close()

	executor, err := NewGRSAIExecutor(server.URL+"/v1", "test-placeholder-key", time.Second)
	require.NoError(t, err)
	var marked atomic.Int32
	outcome := executor.Execute(context.Background(), []byte(`{
		"model":"nano-banana-2",
		"prompt":"draw a lighthouse",
		"image":["https://example.com/reference.png"],
		"size":"16:9",
		"quality":"2K",
		"n":1,
		"replyType":"async"
	}`), func() error {
		marked.Add(1)
		return nil
	})

	assert.Equal(t, model.AsyncStatusSuccess, outcome.Status)
	require.Len(t, outcome.Media, 1)
	assert.Equal(t, "https://example.com/result.png", outcome.Media[0].URL)
	assert.Equal(t, int32(1), requests.Load())
	assert.Equal(t, int32(1), marked.Load())
}

func TestGRSAIExecutorNeverPollsPendingSynchronousResponse(t *testing.T) {
	var requestedPaths []string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestedPaths = append(requestedPaths, request.URL.Path)
		_, _ = writer.Write([]byte(`{"id":"unexpected-pending","status":"running","progress":10}`))
	}))
	defer server.Close()

	executor, err := NewGRSAIExecutor(server.URL, "test-placeholder-key", time.Second)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{"model":"gpt-image-2","prompt":"draw","n":1}`), func() error { return nil })

	assert.Equal(t, model.AsyncStatusUncertain, outcome.Status)
	assert.Equal(t, "upstream_sync_result_pending", outcome.ErrorCode)
	assert.Equal(t, []string{"/v1/api/generate"}, requestedPaths)
}

func TestGRSAILiteModelUsesProviderDefaultResolution(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{
			"model":"nano-banana-2-lite",
			"prompt":"draw",
			"aspectRatio":"1:1",
			"replyType":"json"
		}`, string(body))
		_, _ = writer.Write([]byte(`{"status":"succeeded","results":[{"url":"https://example.com/result.png"}]}`))
	}))
	defer server.Close()

	executor, err := NewGRSAIExecutor(server.URL, "test-placeholder-key", time.Second)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{"model":"nano-banana-2-lite","prompt":"draw","size":"1:1","quality":"auto"}`), func() error { return nil })
	assert.Equal(t, model.AsyncStatusSuccess, outcome.Status)
}

func TestGRSAISynchronousImageEndpointRejectsUnapprovedPaths(t *testing.T) {
	endpoint, err := grsaiSynchronousImageEndpoint("https://grsaiapi.com/v1")
	require.NoError(t, err)
	assert.Equal(t, "https://grsaiapi.com/v1/api/generate", endpoint)
	_, err = grsaiSynchronousImageEndpoint("https://grsaiapi.com/dashboard")
	require.Error(t, err)
	_, err = grsaiSynchronousImageEndpoint("file:///tmp/socket")
	require.Error(t, err)
}
