package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/vertex"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type vertexStorageProbeBody struct {
	io.Reader
	closed bool
}

func (body *vertexStorageProbeBody) Close() error {
	body.closed = true
	return nil
}

func TestVertexStorageChannelProbeWritesReadsAndDeletesOnce(t *testing.T) {
	c := newVertexStorageChannelProbeContext(t)
	objectName := ".new-api-channel-test/probe-id/test.txt"
	var operations []vertex.StorageOperation
	var responseBodies []*vertexStorageProbeBody
	accessTokenCalls := 0
	deps := vertexStorageChannelProbeDependencies{
		newObjectName: func() string { return objectName },
		acquireAccessToken: func(input vertex.CachedAccessTokenRequest) (string, error) {
			accessTokenCalls++
			assert.Equal(t, 41, input.ChannelID)
			assert.True(t, input.ChannelIsMultiKey)
			assert.Equal(t, 2, input.ChannelMultiKeyIndex)
			assert.Equal(t, "service@example.com", input.Credentials.ClientEmail)
			assert.Equal(t, "http://proxy.example:8080", input.Proxy)
			return "access-token", nil
		},
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			operations = append(operations, input.Operation)
			assert.Equal(t, "bucket-a", input.Bucket)
			assert.Equal(t, "access-token", input.AccessToken)
			assert.Equal(t, "http://proxy.example:8080", input.Proxy)

			status := http.StatusOK
			bodyText := ""
			switch input.Operation {
			case vertex.StorageOperationUpload:
				assert.Equal(t, http.MethodPost, input.Method)
				query, err := url.ParseQuery(input.RawQuery)
				require.NoError(t, err)
				assert.Equal(t, "media", query.Get("uploadType"))
				assert.Equal(t, objectName, query.Get("name"))
				assert.Equal(t, "text/plain; charset=utf-8", input.Header.Get("Content-Type"))
				assert.Equal(t, int64(len(vertexStorageChannelTestContent)), input.ContentLength)
				uploaded, err := io.ReadAll(input.Body)
				require.NoError(t, err)
				assert.Equal(t, vertexStorageChannelTestContent, string(uploaded))
			case vertex.StorageOperationGet:
				assert.Equal(t, http.MethodGet, input.Method)
				assert.Equal(t, objectName, input.Object)
				assert.Equal(t, "alt=media", input.RawQuery)
				bodyText = vertexStorageChannelTestContent
			case vertex.StorageOperationDelete:
				assert.Equal(t, http.MethodDelete, input.Method)
				assert.Equal(t, objectName, input.Object)
				status = http.StatusNoContent
			default:
				t.Fatalf("unexpected storage operation %d", input.Operation)
			}

			body := &vertexStorageProbeBody{Reader: strings.NewReader(bodyText)}
			responseBodies = append(responseBodies, body)
			return &http.Response{StatusCode: status, Header: make(http.Header), Body: body}, nil
		},
	}

	err := testVertexStorageChannel(context.Background(), c, "storage:gs:bucket-a", deps)

	require.NoError(t, err)
	assert.Equal(t, 1, accessTokenCalls)
	assert.Equal(t, []vertex.StorageOperation{
		vertex.StorageOperationUpload,
		vertex.StorageOperationGet,
		vertex.StorageOperationDelete,
	}, operations)
	require.Len(t, responseBodies, 3)
	for _, body := range responseBodies {
		assert.True(t, body.closed)
	}
}

func TestVertexStorageChannelProbeContinuesAfterUploadFailure(t *testing.T) {
	c := newVertexStorageChannelProbeContext(t)
	var operations []vertex.StorageOperation
	deps := vertexStorageChannelProbeDependencies{
		newObjectName:      func() string { return ".new-api-channel-test/upload-failed/test.txt" },
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "access-token", nil },
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			operations = append(operations, input.Operation)
			status := http.StatusOK
			body := ""
			if input.Operation == vertex.StorageOperationUpload {
				status = http.StatusForbidden
				body = `{"error":{"message":"forbidden"}}`
			}
			if input.Operation == vertex.StorageOperationGet {
				body = vertexStorageChannelTestContent
			}
			if input.Operation == vertex.StorageOperationDelete {
				status = http.StatusNoContent
			}
			return newVertexStorageProbeResponse(status, body), nil
		},
	}

	err := testVertexStorageChannel(context.Background(), c, "storage:gs:bucket-a", deps)

	require.Error(t, err)
	assert.ErrorContains(t, err, "upload")
	assert.Equal(t, []vertex.StorageOperation{
		vertex.StorageOperationUpload,
		vertex.StorageOperationGet,
		vertex.StorageOperationDelete,
	}, operations)
}

func TestVertexStorageChannelProbeDeletesAfterContentMismatch(t *testing.T) {
	c := newVertexStorageChannelProbeContext(t)
	deleteCalls := 0
	deps := vertexStorageChannelProbeDependencies{
		newObjectName:      func() string { return ".new-api-channel-test/mismatch/test.txt" },
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "access-token", nil },
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			switch input.Operation {
			case vertex.StorageOperationUpload:
				return newVertexStorageProbeResponse(http.StatusOK, ""), nil
			case vertex.StorageOperationGet:
				return newVertexStorageProbeResponse(http.StatusOK, "different content"), nil
			case vertex.StorageOperationDelete:
				deleteCalls++
				return newVertexStorageProbeResponse(http.StatusNoContent, ""), nil
			default:
				t.Fatalf("unexpected storage operation %d", input.Operation)
				return nil, nil
			}
		},
	}

	err := testVertexStorageChannel(context.Background(), c, "storage:gs:bucket-a", deps)

	require.Error(t, err)
	assert.ErrorContains(t, err, "content mismatch")
	assert.Equal(t, 1, deleteCalls)
}

func TestVertexStorageChannelProbeReportsObjectWhenDeleteFails(t *testing.T) {
	c := newVertexStorageChannelProbeContext(t)
	objectName := ".new-api-channel-test/delete-failed/test.txt"
	deps := vertexStorageChannelProbeDependencies{
		newObjectName:      func() string { return objectName },
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "access-token", nil },
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			switch input.Operation {
			case vertex.StorageOperationUpload:
				return newVertexStorageProbeResponse(http.StatusOK, ""), nil
			case vertex.StorageOperationGet:
				return newVertexStorageProbeResponse(http.StatusOK, vertexStorageChannelTestContent), nil
			case vertex.StorageOperationDelete:
				return newVertexStorageProbeResponse(http.StatusForbidden, `{"error":{"message":"forbidden"}}`), nil
			default:
				t.Fatalf("unexpected storage operation %d", input.Operation)
				return nil, nil
			}
		},
	}

	err := testVertexStorageChannel(context.Background(), c, "storage:gs:bucket-a", deps)

	require.Error(t, err)
	assert.ErrorContains(t, err, "delete")
	assert.ErrorContains(t, err, objectName)
}

func TestVertexStorageChannelProbeUsesIndependentDeleteContext(t *testing.T) {
	c := newVertexStorageChannelProbeContext(t)
	parent, cancel := context.WithCancel(context.Background())
	cancel()
	deleteCalls := 0
	deps := vertexStorageChannelProbeDependencies{
		newObjectName:      func() string { return ".new-api-channel-test/canceled/test.txt" },
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "access-token", nil },
		doProxy: func(ctx context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			if input.Operation == vertex.StorageOperationDelete {
				deleteCalls++
				assert.NoError(t, ctx.Err())
				return newVertexStorageProbeResponse(http.StatusNoContent, ""), nil
			}
			return nil, ctx.Err()
		},
	}

	err := testVertexStorageChannel(parent, c, "storage:gs:bucket-a", deps)

	require.Error(t, err)
	assert.Equal(t, 1, deleteCalls)
}

func TestVertexStorageChannelProbeRejectsInvalidConfigurationBeforeUpstream(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
		configure func(*gin.Context)
		want      string
	}{
		{
			name:      "invalid storage model",
			modelName: "storage:gs:bucket-a/path",
			configure: func(*gin.Context) {},
			want:      "invalid",
		},
		{
			name:      "wrong channel type",
			modelName: "storage:gs:bucket-a",
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeGemini)
			},
			want: "Vertex AI",
		},
		{
			name:      "bucket not configured",
			modelName: "storage:gs:bucket-a",
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelModels, []string{"storage:gs:bucket-b"})
			},
			want: "does not allow",
		},
		{
			name:      "API key mode",
			modelName: "storage:gs:bucket-a",
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeAPIKey})
			},
			want: "service account",
		},
		{
			name:      "invalid credentials",
			modelName: "storage:gs:bucket-a",
			configure: func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyChannelKey, "not-json")
			},
			want: "credentials",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := newVertexStorageChannelProbeContext(t)
			tt.configure(c)
			deps := vertexStorageChannelProbeDependencies{
				newObjectName: func() string { return ".new-api-channel-test/rejected/test.txt" },
				acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) {
					t.Fatal("OAuth must not run for invalid local configuration")
					return "", nil
				},
				doProxy: func(context.Context, vertex.StorageProxyRequest) (*http.Response, error) {
					t.Fatal("GCS proxy must not run for invalid local configuration")
					return nil, nil
				},
			}

			err := testVertexStorageChannel(context.Background(), c, tt.modelName, deps)

			require.Error(t, err)
			assert.ErrorContains(t, err, tt.want)
		})
	}
}

func TestChannelTestRoutesVertexStorageBeforeBillingAndConsumeLogs(t *testing.T) {
	originalDB, originalLogDB := model.DB, model.LOG_DB
	model.DB, model.LOG_DB = nil, nil
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
	})

	settingBytes, err := common.Marshal(dto.ChannelSettings{Proxy: "http://proxy.example:8080"})
	require.NoError(t, err)
	channel := &model.Channel{
		Id:            41,
		Type:          constant.ChannelTypeVertexAi,
		Key:           `{"project_id":"project-a","client_email":"service@example.com","private_key":"private-key"}`,
		Models:        "gemini-2.5-pro,storage:gs:bucket-a",
		Setting:       common.GetPointer(string(settingBytes)),
		OtherSettings: `{"vertex_key_type":"json"}`,
	}
	deps := successfulVertexStorageChannelProbeDependencies(t)

	result := testChannelWithVertexStorageDependencies(context.Background(), channel, -1, " storage:gs:bucket-a ", "", false, deps)

	require.NoError(t, result.localErr)
	assert.Nil(t, result.newAPIError)
	assert.NotNil(t, result.context)
}

func TestChannelTestOnlyRoutesVertexStorageModelsOnVertexChannels(t *testing.T) {
	assert.True(t, isVertexStorageChannelTest(&model.Channel{Type: constant.ChannelTypeVertexAi}, "storage:gs:bucket-a"))
	assert.False(t, isVertexStorageChannelTest(&model.Channel{Type: constant.ChannelTypeVertexAi}, "gemini-2.5-pro"))
	assert.False(t, isVertexStorageChannelTest(&model.Channel{Type: constant.ChannelTypeGemini}, "storage:gs:bucket-a"))
	assert.False(t, isVertexStorageChannelTest(nil, "storage:gs:bucket-a"))
}

func newVertexStorageChannelProbeContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(c, constant.ContextKeyChannelId, 41)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeVertexAi)
	common.SetContextKey(c, constant.ContextKeyChannelModels, []string{"gemini-2.5-pro", "storage:gs:bucket-a"})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{VertexKeyType: dto.VertexKeyTypeJSON})
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{Proxy: "http://proxy.example:8080"})
	common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
	common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, 2)
	common.SetContextKey(c, constant.ContextKeyChannelKey, `{"project_id":"project-a","client_email":"service@example.com","private_key":"private-key"}`)
	return c
}

func newVertexStorageProbeResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

func successfulVertexStorageChannelProbeDependencies(t *testing.T) vertexStorageChannelProbeDependencies {
	t.Helper()
	return vertexStorageChannelProbeDependencies{
		newObjectName:      func() string { return ".new-api-channel-test/routed/test.txt" },
		acquireAccessToken: func(vertex.CachedAccessTokenRequest) (string, error) { return "access-token", nil },
		doProxy: func(_ context.Context, input vertex.StorageProxyRequest) (*http.Response, error) {
			switch input.Operation {
			case vertex.StorageOperationUpload:
				return newVertexStorageProbeResponse(http.StatusOK, ""), nil
			case vertex.StorageOperationGet:
				return newVertexStorageProbeResponse(http.StatusOK, vertexStorageChannelTestContent), nil
			case vertex.StorageOperationDelete:
				return newVertexStorageProbeResponse(http.StatusNoContent, ""), nil
			default:
				return nil, errors.New("unexpected storage operation")
			}
		},
	}
}
