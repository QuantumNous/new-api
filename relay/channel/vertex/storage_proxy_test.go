package vertex

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildStorageRequestUsesFixedGoogleHostAndEscapesObjectAsOneSegment(t *testing.T) {
	req, err := buildStorageRequest(context.Background(), StorageProxyRequest{
		Operation:   StorageOperationGet,
		Method:      http.MethodGet,
		Bucket:      "bucket-a",
		Object:      "docs/a b.pdf",
		RawQuery:    "alt=media",
		AccessToken: "secret",
	})
	require.NoError(t, err)
	assert.Equal(t, "https", req.URL.Scheme)
	assert.Equal(t, "storage.googleapis.com", req.URL.Host)
	assert.Contains(t, req.URL.EscapedPath(), "docs%2Fa%20b.pdf")
	assert.Equal(t, "alt=media", req.URL.RawQuery)
	assert.Equal(t, "Bearer secret", req.Header.Get("Authorization"))
}

func TestBuildStorageRequestRejectsDotSegmentObjects(t *testing.T) {
	for _, object := range []string{".", "..", "folder/./file.txt", "folder/../file.txt"} {
		t.Run(object, func(t *testing.T) {
			_, err := buildStorageRequest(context.Background(), StorageProxyRequest{
				Operation:   StorageOperationGet,
				Method:      http.MethodGet,
				Bucket:      "bucket-a",
				Object:      object,
				AccessToken: "secret",
			})
			require.Error(t, err)
		})
	}
}

func TestBuildStorageRequestFiltersClientCredentialsAndHopByHopHeaders(t *testing.T) {
	header := http.Header{
		"Authorization":       {"Bearer client-secret"},
		"Host":                {"attacker.example.com"},
		"Connection":          {"keep-alive, X-Remove-Me"},
		"Keep-Alive":          {"timeout=5"},
		"Proxy-Authenticate":  {"Basic"},
		"Proxy-Authorization": {"Basic secret"},
		"Proxy-Connection":    {"keep-alive"},
		"Te":                  {"trailers"},
		"Trailer":             {"X-Trailer"},
		"Transfer-Encoding":   {"chunked"},
		"Upgrade":             {"websocket"},
		"X-Remove-Me":         {"connection-scoped"},
		"Cookie":              {"session=secret"},
		"X-Api-Key":           {"api-secret"},
		"X-Goog-Api-Key":      {"google-secret"},
		"Content-Type":        {"application/pdf"},
		"Content-Range":       {"bytes 0-9/10"},
		"Range":               {"bytes=0-9"},
		"If-Match":            {"etag-a"},
		"If-None-Match":       {"etag-b"},
		"X-Goog-Meta-Owner":   {"alice"},
	}

	req, err := buildStorageRequest(context.Background(), StorageProxyRequest{
		Operation:   StorageOperationUpload,
		Method:      http.MethodPost,
		Bucket:      "bucket-a",
		RawQuery:    "uploadType=resumable&name=docs%2Fa.pdf",
		Header:      header,
		AccessToken: "upstream-token",
	})
	require.NoError(t, err)

	assert.Equal(t, "Bearer upstream-token", req.Header.Get("Authorization"))
	for _, name := range []string{
		"Host", "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
		"Proxy-Connection", "Te", "Trailer", "Transfer-Encoding", "Upgrade", "X-Remove-Me",
		"Cookie", "X-Api-Key", "X-Goog-Api-Key",
	} {
		assert.Empty(t, req.Header.Values(name), name)
	}
	assert.Equal(t, "application/pdf", req.Header.Get("Content-Type"))
	assert.Equal(t, "bytes 0-9/10", req.Header.Get("Content-Range"))
	assert.Equal(t, "bytes=0-9", req.Header.Get("Range"))
	assert.Equal(t, "etag-a", req.Header.Get("If-Match"))
	assert.Equal(t, "etag-b", req.Header.Get("If-None-Match"))
	assert.Equal(t, "alice", req.Header.Get("X-Goog-Meta-Owner"))
	assert.Equal(t, "Bearer client-secret", header.Get("Authorization"), "source header must not be mutated")
}

func TestSanitizeStorageResponseHeaderRemovesHopByHopHeaders(t *testing.T) {
	header := http.Header{
		"Connection":        {"X-Internal"},
		"X-Internal":        {"secret"},
		"Transfer-Encoding": {"chunked"},
		"Cache-Control":     {"public, max-age=3600"},
		"Expires":           {"Wed, 12 Aug 2026 00:00:00 GMT"},
		"Age":               {"120"},
		"Content-Type":      {"application/octet-stream"},
		"Content-Range":     {"bytes 0-9/10"},
		"Etag":              {"etag-a"},
		"Location":          {"https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?upload_id=abc"},
	}

	got := SanitizeStorageResponseHeader(header)

	assert.Empty(t, got.Values("Connection"))
	assert.Empty(t, got.Values("X-Internal"))
	assert.Empty(t, got.Values("Transfer-Encoding"))
	assert.Equal(t, "private, no-store", got.Get("Cache-Control"))
	assert.Empty(t, got.Values("Expires"))
	assert.Empty(t, got.Values("Age"))
	assert.Equal(t, "application/octet-stream", got.Get("Content-Type"))
	assert.Equal(t, "bytes 0-9/10", got.Get("Content-Range"))
	assert.Equal(t, "etag-a", got.Get("Etag"))
	assert.Equal(t, header.Get("Location"), got.Get("Location"))
	assert.Equal(t, "X-Internal", header.Get("Connection"), "source header must not be mutated")
	assert.Equal(t, "public, max-age=3600", header.Get("Cache-Control"), "source header must not be mutated")
}

func TestRewriteStorageResumableLocation(t *testing.T) {
	got, err := RewriteStorageResumableLocation(
		"https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?upload_id=abc",
		"https://gateway.example.com",
		"bucket-a",
	)
	require.NoError(t, err)
	assert.Equal(t, "https://gateway.example.com/vertexai/upload/storage/v1/b/bucket-a/o?upload_id=abc", got)
}

func TestRewriteStorageResumableLocationRejectsUnsafeInput(t *testing.T) {
	tests := []struct {
		name       string
		location   string
		gatewayURL string
		bucket     string
	}{
		{
			name:       "empty server address",
			location:   "https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?upload_id=abc",
			gatewayURL: "",
			bucket:     "bucket-a",
		},
		{
			name:       "non google location",
			location:   "https://attacker.example.com/upload/storage/v1/b/bucket-a/o?upload_id=abc",
			gatewayURL: "https://gateway.example.com",
			bucket:     "bucket-a",
		},
		{
			name:       "google lookalike location",
			location:   "https://storage.googleapis.com.attacker.example.com/upload/storage/v1/b/bucket-a/o?upload_id=abc",
			gatewayURL: "https://gateway.example.com",
			bucket:     "bucket-a",
		},
		{
			name:       "bucket mismatch",
			location:   "https://storage.googleapis.com/upload/storage/v1/b/bucket-b/o?upload_id=abc",
			gatewayURL: "https://gateway.example.com",
			bucket:     "bucket-a",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RewriteStorageResumableLocation(tt.location, tt.gatewayURL, tt.bucket)
			require.Error(t, err)
		})
	}
}

type storageCountingReader struct {
	reads int
}

func (r *storageCountingReader) Read([]byte) (int, error) {
	r.reads++
	return 0, io.EOF
}

func TestDoStorageProxyDoesNotBufferRequestBody(t *testing.T) {
	body := &storageCountingReader{}
	_, err := DoStorageProxy(context.Background(), StorageProxyRequest{
		Operation:     StorageOperationUpload,
		Method:        http.MethodPost,
		Bucket:        "bucket-a",
		RawQuery:      "uploadType=media&name=a.txt",
		Body:          body,
		ContentLength: int64(len("contents")),
		AccessToken:   "secret",
		Proxy:         "://",
	})
	require.Error(t, err)
	assert.Zero(t, body.reads)
}

type storageHostRoutingTransport struct {
	upstream        *url.URL
	crossHostTarget *url.URL
	base            http.RoundTripper
}

func (t *storageHostRoutingTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	var target *url.URL
	switch request.URL.Host {
	case vertexStorageHost:
		target = t.upstream
	case "8.8.8.8":
		target = t.crossHostTarget
	default:
		return t.base.RoundTrip(request)
	}
	routedRequest := request.Clone(request.Context())
	routedURL := *request.URL
	routedURL.Scheme = target.Scheme
	routedURL.Host = target.Host
	routedRequest.URL = &routedURL
	return t.base.RoundTrip(routedRequest)
}

func TestDoStorageProxyReturnsRedirectWithoutFollowing(t *testing.T) {
	service.InitHttpClient()
	sharedClient := service.GetHttpClient()
	require.NotNil(t, sharedClient)
	require.NotNil(t, sharedClient.Transport)
	require.NotNil(t, sharedClient.CheckRedirect)
	originalRedirectPolicy := reflect.ValueOf(sharedClient.CheckRedirect).Pointer()

	tests := []struct {
		name             string
		redirectLocation string
	}{
		{
			name:             "same host",
			redirectLocation: "/redirect-target",
		},
		{
			name:             "cross host",
			redirectLocation: "http://8.8.8.8/redirect-target",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var crossHostRequests atomic.Int32
			crossHostTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				crossHostRequests.Add(1)
				w.WriteHeader(http.StatusTeapot)
			}))
			defer crossHostTarget.Close()

			const responseBody = "storage redirect"
			var sourceRequests atomic.Int32
			var sourceRedirects atomic.Int32
			source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				sourceRequests.Add(1)
				if request.URL.Path == "/redirect-target" {
					sourceRedirects.Add(1)
					w.WriteHeader(http.StatusTeapot)
					return
				}
				w.Header().Set("Location", tt.redirectLocation)
				w.WriteHeader(http.StatusFound)
				_, _ = io.WriteString(w, responseBody)
			}))
			defer source.Close()

			upstreamURL, err := url.Parse(source.URL)
			require.NoError(t, err)
			crossHostTargetURL, err := url.Parse(crossHostTarget.URL)
			require.NoError(t, err)
			originalTransport := sharedClient.Transport
			sharedClient.Transport = &storageHostRoutingTransport{
				upstream:        upstreamURL,
				crossHostTarget: crossHostTargetURL,
				base:            originalTransport,
			}
			t.Cleanup(func() {
				sharedClient.Transport = originalTransport
			})

			response, err := DoStorageProxy(context.Background(), StorageProxyRequest{
				Operation:   StorageOperationGet,
				Method:      http.MethodGet,
				Bucket:      "bucket-a",
				Object:      "docs/a.pdf",
				AccessToken: "secret",
			})
			require.NoError(t, err)
			defer response.Body.Close()
			body, err := io.ReadAll(response.Body)
			require.NoError(t, err)

			assert.Equal(t, http.StatusFound, response.StatusCode)
			assert.Equal(t, tt.redirectLocation, response.Header.Get("Location"))
			assert.Equal(t, responseBody, string(body))
			assert.EqualValues(t, 1, sourceRequests.Load())
			assert.Zero(t, sourceRedirects.Load())
			assert.Zero(t, crossHostRequests.Load())

			assert.Equal(t, originalRedirectPolicy, reflect.ValueOf(sharedClient.CheckRedirect).Pointer(), "the cached client must not be mutated")
		})
	}
}
