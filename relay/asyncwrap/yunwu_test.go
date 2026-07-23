package asyncwrap

import (
	"context"
	"encoding/base64"
	"fmt"
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

func TestYunwuExecutorDelayedSuccess(t *testing.T) {
	png := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0})
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		time.Sleep(20 * time.Millisecond)
		assert.Equal(t, "/v1/images/generations", request.URL.Path)
		assert.Equal(t, "Bearer test-placeholder-key", request.Header.Get("Authorization"))
		writer.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(writer, `{"created":1,"data":[{"b64_json":%q}]}`, png)
	}))
	defer server.Close()

	executor, err := NewYunwuExecutor(server.URL, "test-placeholder-key", time.Second)
	require.NoError(t, err)
	var marked atomic.Int32
	outcome := executor.Execute(context.Background(), []byte(`{"model":"m","prompt":"p"}`), func() error {
		marked.Add(1)
		return nil
	})
	assert.Equal(t, model.AsyncStatusSuccess, outcome.Status)
	assert.Len(t, outcome.Media, 1)
	assert.Equal(t, int32(1), marked.Load())
}

func TestYunwuExecutorConvertsGeminiImageRequest(t *testing.T) {
	png := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0})
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		assert.Equal(t, "/v1beta/models/gemini-3.1-flash-image-preview:generateContent", request.URL.Path)
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{
			"contents":[{"role":"user","parts":[{"text":"draw a blue square"}]}],
			"generationConfig":{"responseModalities":["IMAGE","TEXT"],"imageConfig":{"aspectRatio":"16:9","imageSize":"2K"}}
		}`, string(body))
		writer.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(writer, `{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":%q}}]}}]}`, png)
	}))
	defer server.Close()

	executor, err := NewYunwuExecutor(server.URL+"/v1", "test-placeholder-key", time.Second)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{
		"model":"gemini-3.1-flash-image-preview",
		"prompt":"draw a blue square",
		"size":"1792x1024",
		"quality":"2K",
		"n":1
	}`), func() error { return nil })
	require.Equal(t, model.AsyncStatusSuccess, outcome.Status)
	require.Len(t, outcome.Media, 1)
	assert.Equal(t, "image/png", outcome.Media[0].ContentType)
	assert.Equal(t, png, outcome.Media[0].Base64)
}

func TestYunwuExecutorAppliesStableRouteWithoutChangingClientModel(t *testing.T) {
	t.Setenv("ASYNC_YUNWU_ROUTE_SUFFIX", "stable")
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, err := io.ReadAll(request.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{"model":"gpt-image-2:stable","prompt":"p"}`, string(body))
		_, _ = writer.Write([]byte(`{"data":[{"b64_json":"iVBORw0KGgo="}]}`))
	}))
	defer server.Close()

	executor, err := NewYunwuExecutor(server.URL, "test-placeholder-key", time.Second)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{"model":"gpt-image-2","prompt":"p"}`), func() error { return nil })
	assert.Equal(t, model.AsyncStatusSuccess, outcome.Status)
}

func TestYunwuExecutorRetries429(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempt := requests.Add(1)
		if attempt < 3 {
			writer.Header().Set("Retry-After", "0")
			writer.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = writer.Write([]byte(`{"data":[{"b64_json":"iVBORw0KGgo="}]}`))
	}))
	defer server.Close()

	executor, err := NewYunwuExecutor(server.URL, "test-placeholder-key", 5*time.Second)
	require.NoError(t, err)
	var marked atomic.Int32
	outcome := executor.Execute(context.Background(), []byte(`{"model":"m","prompt":"p"}`), func() error {
		marked.Add(1)
		return nil
	})
	assert.Equal(t, model.AsyncStatusSuccess, outcome.Status)
	assert.Equal(t, int32(3), requests.Load())
	assert.Equal(t, int32(1), marked.Load())
}

func TestYunwuExecutorReadTimeoutIsUncertain(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		time.Sleep(200 * time.Millisecond)
		_, _ = writer.Write([]byte(`{"data":[{"b64_json":"iVBORw0KGgo="}]}`))
	}))
	defer server.Close()

	executor, err := NewYunwuExecutor(server.URL, "test-placeholder-key", 50*time.Millisecond)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{"model":"m","prompt":"p"}`), func() error { return nil })
	assert.Equal(t, model.AsyncStatusUncertain, outcome.Status)
	assert.Equal(t, "upstream_result_uncertain", outcome.ErrorCode)
}

func TestYunwuImageEndpointWhitelistPath(t *testing.T) {
	endpoint, err := yunwuImageEndpoint("https://yunwu.ai/v1")
	require.NoError(t, err)
	assert.Equal(t, "https://yunwu.ai/v1/images/generations", endpoint)
	_, err = yunwuImageEndpoint("file:///tmp/socket")
	require.Error(t, err)
	_, err = yunwuImageEndpoint("https://yunwu.ai/unapproved-prefix")
	require.Error(t, err)
	endpoint, err = yunwuGeminiImageEndpoint("https://yunwu.ai/v1", "gemini-3-pro-image-preview:stable")
	require.NoError(t, err)
	assert.Equal(t, "https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:stable:generateContent", endpoint)
}

func TestYunwuExecutorClassifiesExplicitFailureAndServerError(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		refundable bool
	}{
		{name: "rejected request", status: http.StatusBadRequest, refundable: true},
		{name: "server failure", status: http.StatusInternalServerError, refundable: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(test.status)
			}))
			defer server.Close()
			executor, err := NewYunwuExecutor(server.URL, "test-placeholder-key", time.Second)
			require.NoError(t, err)
			outcome := executor.Execute(context.Background(), []byte(`{"model":"m","prompt":"p"}`), func() error { return nil })
			assert.Equal(t, model.AsyncStatusFailure, outcome.Status)
			assert.Equal(t, test.refundable, outcome.RefundEligible)
			assert.Equal(t, fmt.Sprintf("upstream_http_%d", test.status), outcome.ErrorCode)
		})
	}
}

func TestYunwuExecutorDoesNotFollowRedirects(t *testing.T) {
	var targetRequests atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		targetRequests.Add(1)
		writer.WriteHeader(http.StatusOK)
	}))
	defer target.Close()
	source := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Redirect(writer, &http.Request{}, target.URL, http.StatusTemporaryRedirect)
	}))
	defer source.Close()

	executor, err := NewYunwuExecutor(source.URL, "test-placeholder-key", time.Second)
	require.NoError(t, err)
	outcome := executor.Execute(context.Background(), []byte(`{"model":"m","prompt":"p"}`), func() error { return nil })
	assert.Equal(t, model.AsyncStatusFailure, outcome.Status)
	assert.Zero(t, targetRequests.Load())
}
