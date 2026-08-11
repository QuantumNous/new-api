package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type trackingVertexStorageBody struct {
	io.Reader
	closed bool
}

func (body *trackingVertexStorageBody) Close() error {
	body.closed = true
	return nil
}

func TestRelayVertexStorageProxyRejectsLocallyInAuthorizationOrder(t *testing.T) {
	tests := []struct {
		name       string
		operation  vertex.StorageOperation
		configure  func(*gin.Context)
		wantStatus int
		wantCode   string
	}{
		{
			name:      "bucket before channel type",
			operation: vertex.StorageOperationList,
			configure: func(c *gin.Context) {
				c.Params[0].Value = "bucket-a/path"
				common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
			},
			wantStatus: http.StatusBadRequest,
			wantCode:   "invalid_bucket",
		},
		{
			name:      "channel type before bucket authorization",
			operation: vertex.StorageOperationList,
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
				common.SetContextKey(c, constant.ContextKeyChannelModels, []string{"storage:gs:bucket-b"})
			},
			wantStatus: http.StatusInternalServerError,
			wantCode:   "channel_type_mismatch",
		},
		{
			name:      "exact bucket authorization before key type",
			operation: vertex.StorageOperationList,
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelModels, []string{"storage:gs:bucket-a-archive"})
				common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeAPIKey})
			},
			wantStatus: http.StatusForbidden,
			wantCode:   "bucket_not_allowed",
		},
		{
			name:      "key type before service account JSON",
			operation: vertex.StorageOperationList,
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeAPIKey})
				common.SetContextKey(c, constant.ContextKeyChannelKey, "not-json")
			},
			wantStatus: http.StatusBadRequest,
			wantCode:   "unsupported_key_type",
		},
		{
			name:      "service account JSON before object",
			operation: vertex.StorageOperationGet,
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelKey, "not-json")
			},
			wantStatus: http.StatusInternalServerError,
			wantCode:   "invalid_channel_credentials",
		},
		{
			name:       "object before OAuth",
			operation:  vertex.StorageOperationDelete,
			configure:  func(_ *gin.Context) {},
			wantStatus: http.StatusBadRequest,
			wantCode:   "object_required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder, c := newVertexStorageProxyTestContext(t, http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", "bucket-a")
			tt.configure(c)
			deps := rejectingVertexStorageProxyDependencies(t)

			relayVertexStorageProxy(c, tt.operation, deps)

			assert.Equal(t, tt.wantStatus, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"code":"`+tt.wantCode+`"`)
		})
	}
}

func TestRelayVertexStorageProxyStopsAfterOAuthFailure(t *testing.T) {
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", "bucket-a")
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(input vertex.CachedAccessTokenRequest) (string, error) {
			assert.Equal(t, 41, input.ChannelID)
			assert.True(t, input.ChannelIsMultiKey)
			assert.Equal(t, 3, input.ChannelMultiKeyIndex)
			assert.Equal(t, "svc@example.com", input.Credentials.ClientEmail)
			assert.Equal(t, "http://proxy.example:8080", input.Proxy)
			return "", errors.New("oauth unavailable")
		},
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			t.Fatal("GCS proxy must not run when OAuth fails")
			return nil, nil
		},
	}

	relayVertexStorageProxy(c, vertex.StorageOperationList, deps)

	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"code":"access_token_failed"`)
	assert.NotContains(t, recorder.Body.String(), "oauth unavailable")
}

func TestRelayVertexStorageProxyRejectsDotSegmentObjectsBeforeOAuth(t *testing.T) {
	tests := []struct {
		name      string
		method    string
		operation vertex.StorageOperation
		object    string
	}{
		{
			name:      "get parent segment",
			method:    http.MethodGet,
			operation: vertex.StorageOperationGet,
			object:    "/../bucket-metadata",
		},
		{
			name:      "delete nested parent segment",
			method:    http.MethodDelete,
			operation: vertex.StorageOperationDelete,
			object:    "/folder/../object.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder, c := newVertexStorageProxyTestContext(t, tt.method, "/vertexai/storage/v1/b/bucket-a/o"+tt.object, "bucket-a")
			c.Params = append(c.Params, gin.Param{Key: "object", Value: tt.object})

			relayVertexStorageProxy(c, tt.operation, rejectingVertexStorageProxyDependencies(t))

			assert.Equal(t, http.StatusBadRequest, recorder.Code)
			assert.Contains(t, recorder.Body.String(), `"code":"invalid_object"`)
		})
	}
}

func TestRelayVertexStorageProxyStreamsRequestAndRangeResponse(t *testing.T) {
	incomingBody := &trackingVertexStorageBody{Reader: strings.NewReader("upload-bytes")}
	responseBody := &trackingVertexStorageBody{Reader: strings.NewReader("file-bytes")}
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(input vertex.CachedAccessTokenRequest) (string, error) {
			require.Equal(t, vertex.Credentials{
				ProjectID:   "project-a",
				ClientEmail: "svc@example.com",
				PrivateKey:  "private-key",
			}, input.Credentials)
			return "google-token", nil
		},
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			assert.Equal(t, vertex.StorageOperationGet, input.Operation)
			assert.Equal(t, http.MethodGet, input.Method)
			assert.Equal(t, "bucket-a", input.Bucket)
			assert.Equal(t, "folder/file.bin", input.Object)
			assert.Equal(t, "alt=media&generation=7", input.RawQuery)
			assert.Equal(t, "bytes=0-9", input.Header.Get("Range"))
			assert.Same(t, incomingBody, input.Body)
			assert.Equal(t, int64(12), input.ContentLength)
			assert.Equal(t, "google-token", input.AccessToken)
			assert.Equal(t, "http://proxy.example:8080", input.Proxy)
			return &http.Response{
				StatusCode: http.StatusPartialContent,
				Header: http.Header{
					"Content-Type":   {"application/octet-stream"},
					"Content-Range":  {"bytes 0-9/100"},
					"Etag":           {`"etag-1"`},
					"Content-Length": {"10"},
					"Connection":     {"keep-alive"},
				},
				Body: responseBody,
			}, nil
		},
	}
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o/folder%2Ffile.bin?alt=media&generation=7", "bucket-a")
	c.Params = append(c.Params, gin.Param{Key: "object", Value: "/folder/file.bin"})
	c.Request.Body = incomingBody
	c.Request.ContentLength = 12
	c.Request.Header.Set("Range", "bytes=0-9")

	relayVertexStorageProxy(c, vertex.StorageOperationGet, deps)

	assert.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, "file-bytes", recorder.Body.String())
	assert.Equal(t, "bytes 0-9/100", recorder.Header().Get("Content-Range"))
	assert.Equal(t, `"etag-1"`, recorder.Header().Get("ETag"))
	assert.Empty(t, recorder.Header().Get("Content-Length"))
	assert.Empty(t, recorder.Header().Get("Connection"))
	assert.True(t, responseBody.closed)
}

func TestRelayVertexStorageProxyPreservesGCSErrorStatusAndBody(t *testing.T) {
	responseBody := &trackingVertexStorageBody{Reader: strings.NewReader(`{"error":{"code":403,"message":"forbidden"}}`)}
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "google-token", nil },
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusForbidden,
				Header:     http.Header{"Content-Type": {"application/json"}},
				Body:       responseBody,
			}, nil
		},
	}
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", "bucket-a")

	relayVertexStorageProxy(c, vertex.StorageOperationList, deps)

	assert.Equal(t, http.StatusForbidden, recorder.Code)
	assert.JSONEq(t, `{"error":{"code":403,"message":"forbidden"}}`, recorder.Body.String())
	assert.True(t, responseBody.closed)
}

func TestRelayVertexStorageProxyClosesResponseBodyWhenProxyReturnsError(t *testing.T) {
	responseBody := &trackingVertexStorageBody{Reader: strings.NewReader("must-not-leak")}
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "google-token", nil },
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Header:     http.Header{"X-Upstream-Secret": {"secret"}},
				Body:       responseBody,
			}, errors.New("redirect rejected")
		},
	}
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodGet, "/vertexai/storage/v1/b/bucket-a/o", "bucket-a")

	relayVertexStorageProxy(c, vertex.StorageOperationList, deps)

	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"code":"upstream_request_failed"`)
	assert.NotContains(t, recorder.Body.String(), "must-not-leak")
	assert.Empty(t, recorder.Header().Get("X-Upstream-Secret"))
	assert.True(t, responseBody.closed)
}

func TestRelayVertexStorageProxyRewritesResumableLocation(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://api.example.com/base"
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	responseBody := &trackingVertexStorageBody{Reader: strings.NewReader("")}
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "google-token", nil },
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header: http.Header{"Location": {
					"https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?uploadType=resumable&upload_id=session-1",
				}},
				Body: responseBody,
			}, nil
		},
	}
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodPost, "/vertexai/upload/storage/v1/b/bucket-a/o?uploadType=resumable&name=file.bin", "bucket-a")

	relayVertexStorageProxy(c, vertex.StorageOperationUpload, deps)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "https://api.example.com/vertexai/upload/storage/v1/b/bucket-a/o?uploadType=resumable&upload_id=session-1", recorder.Header().Get("Location"))
	assert.True(t, responseBody.closed)
}

func TestRelayVertexStorageProxyDoesNotLeakUnsafeResumableLocation(t *testing.T) {
	previousAddress := system_setting.ServerAddress
	system_setting.ServerAddress = ""
	t.Cleanup(func() { system_setting.ServerAddress = previousAddress })

	responseBody := &trackingVertexStorageBody{Reader: strings.NewReader("upstream-body")}
	deps := vertexStorageProxyDependencies{
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "google-token", nil },
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header: http.Header{"Location": {
					"https://storage.googleapis.com/upload/storage/v1/b/bucket-a/o?uploadType=resumable&upload_id=session-1",
				}},
				Body: responseBody,
			}, nil
		},
	}
	recorder, c := newVertexStorageProxyTestContext(t, http.MethodPost, "/vertexai/upload/storage/v1/b/bucket-a/o?uploadType=resumable&name=file.bin", "bucket-a")

	relayVertexStorageProxy(c, vertex.StorageOperationUpload, deps)

	assert.Equal(t, http.StatusBadGateway, recorder.Code)
	assert.Empty(t, recorder.Header().Get("Location"))
	assert.NotContains(t, recorder.Body.String(), "storage.googleapis.com")
	assert.NotContains(t, recorder.Body.String(), "session-1")
	assert.NotContains(t, recorder.Body.String(), "upstream-body")
	assert.True(t, responseBody.closed)
}

func newVertexStorageProxyTestContext(t *testing.T, method, target, bucket string) (*httptest.ResponseRecorder, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, target, nil)
	c.Params = gin.Params{{Key: "bucket", Value: bucket}}
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeVertexAi)
	common.SetContextKey(c, constant.ContextKeyChannelModels, []string{"storage:gs:bucket-a"})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeJSON})
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{Proxy: "http://proxy.example:8080"})
	common.SetContextKey(c, constant.ContextKeyChannelId, 41)
	common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, 3)
	common.SetContextKey(c, constant.ContextKeyChannelKey, `{"project_id":"project-a","client_email":"svc@example.com","private_key":"private-key"}`)
	return recorder, c
}

func rejectingVertexStorageProxyDependencies(t *testing.T) vertexStorageProxyDependencies {
	t.Helper()
	return vertexStorageProxyDependencies{
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) {
			t.Fatal("OAuth must not run after local validation rejects the request")
			return "", nil
		},
		doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
			t.Fatal("GCS proxy must not run after local validation rejects the request")
			return nil, nil
		},
	}
}
