package vertex

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildStorageRequestPinsUpstreamTarget(t *testing.T) {
	tests := []struct {
		name     string
		input    StorageProxyRequest
		wantPath string
		wantURL  string
	}{
		{
			name: "media upload",
			input: StorageProxyRequest{
				Operation:   StorageOperationUpload,
				Method:      http.MethodPost,
				Bucket:      "example-bucket",
				RawQuery:    "uploadType=media&name=docs%2Freport.pdf",
				AccessToken: "token",
			},
			wantURL: "https://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?uploadType=media&name=docs%2Freport.pdf",
		},
		{
			name: "list objects",
			input: StorageProxyRequest{
				Operation:   StorageOperationList,
				Method:      http.MethodGet,
				Bucket:      "example-bucket",
				RawQuery:    "prefix=docs%2F",
				AccessToken: "token",
			},
			wantURL: "https://storage.googleapis.com/storage/v1/b/example-bucket/o?prefix=docs%2F",
		},
		{
			name: "object name is escaped into a single path segment",
			input: StorageProxyRequest{
				Operation:   StorageOperationGet,
				Method:      http.MethodGet,
				Bucket:      "example-bucket",
				Object:      "docs/report 1.pdf",
				RawQuery:    "alt=media",
				AccessToken: "token",
			},
			wantURL: "https://storage.googleapis.com/storage/v1/b/example-bucket/o/docs%2Freport%201.pdf?alt=media",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request, err := buildStorageRequest(context.Background(), tt.input)
			require.NoError(t, err)
			assert.Equal(t, tt.wantURL, request.URL.String())
			assert.Equal(t, "storage.googleapis.com", request.URL.Host)
		})
	}
}

func TestBuildStorageRequestRejectsInvalidInput(t *testing.T) {
	base := StorageProxyRequest{
		Operation:   StorageOperationGet,
		Method:      http.MethodGet,
		Bucket:      "example-bucket",
		Object:      "docs/report.pdf",
		AccessToken: "token",
	}

	withInput := func(mutate func(*StorageProxyRequest)) StorageProxyRequest {
		input := base
		mutate(&input)
		return input
	}

	tests := []struct {
		name  string
		input StorageProxyRequest
	}{
		{name: "missing access token", input: withInput(func(i *StorageProxyRequest) { i.AccessToken = "  " })},
		{name: "bucket with path", input: withInput(func(i *StorageProxyRequest) { i.Bucket = "example-bucket/docs" })},
		{name: "object parent segment", input: withInput(func(i *StorageProxyRequest) { i.Object = "docs/../report.pdf" })},
		{name: "empty object", input: withInput(func(i *StorageProxyRequest) { i.Object = "" })},
		{name: "method mismatch on get", input: withInput(func(i *StorageProxyRequest) { i.Method = http.MethodDelete })},
		{name: "method not allowed on upload", input: withInput(func(i *StorageProxyRequest) {
			i.Operation = StorageOperationUpload
			i.Method = http.MethodPatch
		})},
		{name: "unknown operation", input: withInput(func(i *StorageProxyRequest) { i.Operation = 0 })},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request, err := buildStorageRequest(context.Background(), tt.input)
			assert.Error(t, err)
			assert.Nil(t, request)
		})
	}
}

func TestBuildStorageRequestReplacesClientCredentials(t *testing.T) {
	clientHeader := http.Header{}
	clientHeader.Set("Authorization", "Bearer client-token")
	clientHeader.Set("Cookie", "session=secret")
	clientHeader.Set("X-Api-Key", "client-key")
	clientHeader.Set("X-Goog-Api-Key", "client-goog-key")
	clientHeader.Set("Host", "internal.example.com")
	clientHeader.Set("Content-Length", "17")
	clientHeader.Set("Connection", "X-Forwarded-Secret")
	clientHeader.Set("X-Forwarded-Secret", "leaked")
	clientHeader.Set("Content-Type", "application/pdf")

	request, err := buildStorageRequest(context.Background(), StorageProxyRequest{
		Operation:   StorageOperationUpload,
		Method:      http.MethodPost,
		Bucket:      "example-bucket",
		Header:      clientHeader,
		AccessToken: "channel-token",
	})
	require.NoError(t, err)

	assert.Equal(t, "Bearer channel-token", request.Header.Get("Authorization"))
	assert.Equal(t, "application/pdf", request.Header.Get("Content-Type"))
	for _, name := range []string{"Cookie", "X-Api-Key", "X-Goog-Api-Key", "Host", "Content-Length", "Connection", "X-Forwarded-Secret"} {
		assert.Empty(t, request.Header.Get(name), name)
	}
}

func TestSanitizeStorageResponseHeaderForbidsSharedCaching(t *testing.T) {
	upstream := http.Header{}
	upstream.Set("Cache-Control", "public, max-age=3600")
	upstream.Set("Expires", "Wed, 21 Oct 2026 07:28:00 GMT")
	upstream.Set("Age", "120")
	upstream.Set("Transfer-Encoding", "chunked")
	upstream.Set("ETag", "\"abc\"")

	sanitized := sanitizeStorageResponseHeader(upstream)

	assert.Equal(t, "private, no-store", sanitized.Get("Cache-Control"))
	assert.Empty(t, sanitized.Get("Expires"))
	assert.Empty(t, sanitized.Get("Age"))
	assert.Empty(t, sanitized.Get("Transfer-Encoding"))
	assert.Equal(t, "\"abc\"", sanitized.Get("ETag"))
}

func TestRewriteStorageResumableLocation(t *testing.T) {
	rewritten, err := RewriteStorageResumableLocation(
		"https://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?uploadType=resumable&upload_id=SESSION",
		"https://api.example.com",
		"example-bucket",
	)
	require.NoError(t, err)
	assert.Equal(t,
		"https://api.example.com/vertexai/upload/storage/v1/b/example-bucket/o?uploadType=resumable&upload_id=SESSION",
		rewritten,
	)

	tests := []struct {
		name     string
		location string
		gateway  string
		bucket   string
	}{
		{name: "foreign host", location: "https://evil.example.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "example-bucket"},
		{name: "plaintext upstream", location: "http://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "example-bucket"},
		{name: "other bucket", location: "https://storage.googleapis.com/upload/storage/v1/b/other-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "example-bucket"},
		{name: "other api path", location: "https://storage.googleapis.com/storage/v1/b/example-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "example-bucket"},
		{name: "userinfo in location", location: "https://user:pass@storage.googleapis.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "example-bucket"},
		{name: "empty gateway address", location: "https://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "", bucket: "example-bucket"},
		{name: "invalid gateway scheme", location: "https://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "ftp://api.example.com", bucket: "example-bucket"},
		{name: "invalid bucket", location: "https://storage.googleapis.com/upload/storage/v1/b/example-bucket/o?upload_id=S", gateway: "https://api.example.com", bucket: "gs://example-bucket"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rewritten, err := RewriteStorageResumableLocation(tt.location, tt.gateway, tt.bucket)
			assert.Error(t, err)
			assert.Empty(t, rewritten)
		})
	}
}
