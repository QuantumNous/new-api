package controller

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupOpenAIUpstreamResourceControllerTest(t *testing.T) {
	t.Helper()
	previousDB := model.DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.OpenAIUpstreamResource{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousType)
	})
}

func setOpenAIUpstreamResourceContext(c *gin.Context, baseURL string) {
	common.SetContextKey(c, constant.ContextKeyUserId, 101)
	common.SetContextKey(c, constant.ContextKeyChannelId, 71)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, baseURL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "upstream-key")
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyOriginalModel, "gpt-image-2")
}

func TestRelayOpenAIUpstreamResourcePreservesRequestAndBindsUploadedFile(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	type observedRequest struct {
		Method      string
		RequestURI  string
		ContentType string
		Auth        string
		Body        string
	}
	observed := make(chan observedRequest, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		observed <- observedRequest{
			Method:      r.Method,
			RequestURI:  r.URL.RequestURI(),
			ContentType: r.Header.Get("Content-Type"),
			Auth:        r.Header.Get("Authorization"),
			Body:        string(body),
		}
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Upstream-Request", "req_123")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"file_123","object":"file","purpose":"batch"}`))
	}))
	defer upstream.Close()

	body := "multipart-body-is-preserved"
	router := gin.New()
	router.POST("/v1/files", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
	}, RelayOpenAIUpstreamResource)
	request := httptest.NewRequest(http.MethodPost, "/v1/files?trace=1", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "multipart/form-data; boundary=test-boundary")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusCreated, response.Code, response.Body.String())
	assert.JSONEq(t, `{"id":"file_123","object":"file","purpose":"batch"}`, response.Body.String())
	assert.Equal(t, "req_123", response.Header().Get("X-Upstream-Request"))

	gotRequest := <-observed
	assert.Equal(t, http.MethodPost, gotRequest.Method)
	assert.Equal(t, "/v1/files?trace=1", gotRequest.RequestURI)
	assert.Equal(t, "multipart/form-data; boundary=test-boundary", gotRequest.ContentType)
	assert.Equal(t, "Bearer upstream-key", gotRequest.Auth)
	assert.Equal(t, body, gotRequest.Body)

	resource, found, err := model.GetOpenAIUpstreamResource(101, model.OpenAIUpstreamResourceTypeFile, "file_123")
	require.NoError(t, err)
	require.True(t, found)
	assert.Equal(t, 71, resource.ChannelId)
	assert.Equal(t, "gpt-image-2", resource.Model)
	assert.Equal(t, model.ChannelKeyFingerprint("upstream-key"), resource.ChannelKeyFingerprint)
}

func TestRelayOpenAIUpstreamResourceBindsBatchOutputFiles(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/v1/batches", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"batch_123",
			"input_file_id":"file_input",
			"output_file_id":"file_output",
			"error_file_id":"file_error",
			"status":"completed"
		}`))
	}))
	defer upstream.Close()

	router := gin.New()
	router.POST("/v1/batches", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
	}, RelayOpenAIUpstreamResource)
	request := httptest.NewRequest(http.MethodPost, "/v1/batches", bytes.NewBufferString(`{"input_file_id":"file_input"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	for resourceType, resourceID := range map[string]string{
		model.OpenAIUpstreamResourceTypeBatch: "batch_123",
		model.OpenAIUpstreamResourceTypeFile:  "file_output",
	} {
		resource, found, err := model.GetOpenAIUpstreamResource(101, resourceType, resourceID)
		require.NoError(t, err)
		require.True(t, found, resourceID)
		assert.Equal(t, 71, resource.ChannelId)
		assert.Equal(t, "gpt-image-2", resource.Model)
	}
	_, found, err := model.GetOpenAIUpstreamResource(101, model.OpenAIUpstreamResourceTypeFile, "file_error")
	require.NoError(t, err)
	assert.True(t, found)
}

func TestRelayOpenAIUpstreamResourcePreservesUpstreamError(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Add("X-Upstream-Debug", "first")
		w.Header().Add("X-Upstream-Debug", "second")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"error":{"message":"invalid batch"}}`))
	}))
	defer upstream.Close()

	router := gin.New()
	router.GET("/v1/batches/:id", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
	}, RelayOpenAIUpstreamResource)
	request := httptest.NewRequest(http.MethodGet, "/v1/batches/batch_bad?include=errors", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnprocessableEntity, response.Code)
	assert.JSONEq(t, `{"error":{"message":"invalid batch"}}`, response.Body.String())
	assert.Equal(t, []string{"first", "second"}, response.Header().Values("X-Upstream-Debug"))
}

func TestRelayOpenAIUpstreamResourceDeletesFileBindingAfterUpstreamSuccess(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:                101,
		ChannelId:             71,
		ChannelKeyFingerprint: model.ChannelKeyFingerprint("upstream-key"),
		ResourceType:          model.OpenAIUpstreamResourceTypeFile,
		ResourceId:            "file_delete",
		Model:                 "gpt-image-2",
	}}))
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodDelete, r.Method)
		assert.Equal(t, "/v1/files/file_delete", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"file_delete","deleted":true}`))
	}))
	defer upstream.Close()

	router := gin.New()
	router.DELETE("/v1/files/:id", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
	}, RelayOpenAIUpstreamResource)
	request := httptest.NewRequest(http.MethodDelete, "/v1/files/file_delete", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	_, found, err := model.GetOpenAIUpstreamResource(101, model.OpenAIUpstreamResourceTypeFile, "file_delete")
	require.NoError(t, err)
	assert.False(t, found)
}

func TestRelayOpenAIUpstreamResourceDeleteRetryCleansBindingAfterUpstreamNotFound(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	var upstreamCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if upstreamCalls.Add(1) == 1 {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"id":"file_retry","deleted":true}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"message":"file not found"}}`))
	}))
	defer upstream.Close()

	router := gin.New()
	router.DELETE("/v1/files/:id", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
	}, RelayOpenAIUpstreamResource)

	require.NoError(t, model.DB.Migrator().DropTable(&model.OpenAIUpstreamResource{}))
	firstRequest := httptest.NewRequest(http.MethodDelete, "/v1/files/file_retry", nil)
	firstResponse := httptest.NewRecorder()
	router.ServeHTTP(firstResponse, firstRequest)
	require.Equal(t, http.StatusBadGateway, firstResponse.Code, firstResponse.Body.String())

	require.NoError(t, model.DB.AutoMigrate(&model.OpenAIUpstreamResource{}))
	require.NoError(t, model.SaveOpenAIUpstreamResources([]model.OpenAIUpstreamResource{{
		UserId:                101,
		ChannelId:             71,
		ChannelKeyFingerprint: model.ChannelKeyFingerprint("upstream-key"),
		ResourceType:          model.OpenAIUpstreamResourceTypeFile,
		ResourceId:            "file_retry",
		Model:                 "gpt-image-2",
	}}))

	secondRequest := httptest.NewRequest(http.MethodDelete, "/v1/files/file_retry", nil)
	secondResponse := httptest.NewRecorder()
	router.ServeHTTP(secondResponse, secondRequest)
	require.Equal(t, http.StatusNotFound, secondResponse.Code, secondResponse.Body.String())
	assert.JSONEq(t, `{"error":{"message":"file not found"}}`, secondResponse.Body.String())

	_, found, err := model.GetOpenAIUpstreamResource(101, model.OpenAIUpstreamResourceTypeFile, "file_retry")
	require.NoError(t, err)
	assert.False(t, found)
	assert.Equal(t, int32(2), upstreamCalls.Load())
}

func TestRelayOpenAIUpstreamResourceRejectsModelMappingBeforeUpload(t *testing.T) {
	setupOpenAIUpstreamResourceControllerTest(t)
	var upstreamCalled atomic.Bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		upstreamCalled.Store(true)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	router := gin.New()
	router.POST("/v1/files", func(c *gin.Context) {
		setOpenAIUpstreamResourceContext(c, upstream.URL)
		common.SetContextKey(c, constant.ContextKeyChannelModelMapping, `{"gpt-image-2":"provider-image-model"}`)
	}, RelayOpenAIUpstreamResource)
	request := httptest.NewRequest(http.MethodPost, "/v1/files", bytes.NewBufferString("multipart-body"))
	request.Header.Set("Content-Type", "multipart/form-data; boundary=test")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusBadRequest, response.Code)
	assert.False(t, upstreamCalled.Load())
}

func TestCopyOpenAIUpstreamResponseHeadersRemovesConnectionScopedHeaders(t *testing.T) {
	source := http.Header{
		"Connection":        []string{"keep-alive, X-Internal-Hop"},
		"Keep-Alive":        []string{"timeout=5"},
		"X-Internal-Hop":    []string{"secret"},
		"X-Upstream-Result": []string{"one", "two"},
	}
	destination := make(http.Header)

	copyOpenAIUpstreamResponseHeaders(destination, source)

	assert.Empty(t, destination.Values("Connection"))
	assert.Empty(t, destination.Values("Keep-Alive"))
	assert.Empty(t, destination.Values("X-Internal-Hop"))
	assert.Equal(t, []string{"one", "two"}, destination.Values("X-Upstream-Result"))
}
