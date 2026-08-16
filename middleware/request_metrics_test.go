package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuditResponseSuccessUsesBusinessSuccessField(t *testing.T) {
	assert.False(t, auditResponseSuccess(200, []byte(`{"success":false,"message":"validation failed"}`)))
	assert.True(t, auditResponseSuccess(200, []byte(`{"success":true,"data":{}}`)))
}

func TestRequestMetricsCountsBytesActuallyReadAndWritten(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRequestMetrics())
	router.POST("/test", func(c *gin.Context) {
		buffer := make([]byte, 4)
		_, err := io.ReadFull(c.Request.Body, buffer)
		require.NoError(t, err)
		_, err = c.Writer.Write([]byte("response payload"))
		require.NoError(t, err)
	})

	beforeRequest, beforeResponse := common.ApplicationTrafficSnapshot()
	request := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader("request payload"))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	afterRequest, afterResponse := common.ApplicationTrafficSnapshot()
	assert.Equal(t, uint64(4), afterRequest-beforeRequest)
	assert.Equal(t, uint64(len("response payload")), afterResponse-beforeResponse)
}

func TestRequestMetricsCountsStreamingWritesImmediately(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRequestMetrics())
	router.GET("/stream", func(c *gin.Context) {
		_, err := c.Writer.Write([]byte("first"))
		require.NoError(t, err)
		_, err = c.Writer.Write([]byte("second"))
		require.NoError(t, err)
		_, err = c.Writer.WriteString("third")
		require.NoError(t, err)
	})

	_, beforeResponse := common.ApplicationTrafficSnapshot()
	request := httptest.NewRequest(http.MethodGet, "/stream", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	_, afterResponse := common.ApplicationTrafficSnapshot()
	assert.Equal(t, uint64(len("firstsecondthird")), afterResponse-beforeResponse)
}

func TestRequestMetricsExcludesOptionsAndSystemStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRequestMetrics())
	router.Any("/*path", func(c *gin.Context) {
		_, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		_, err = c.Writer.Write([]byte("ignored response"))
		require.NoError(t, err)
	})

	beforeRequest, beforeResponse := common.ApplicationTrafficSnapshot()
	requests := []*http.Request{
		httptest.NewRequest(http.MethodOptions, "/other", strings.NewReader("ignored request")),
		httptest.NewRequest(http.MethodGet, "/api/next/dashboard/system-status", strings.NewReader("ignored request")),
	}
	for _, request := range requests {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
	}

	afterRequest, afterResponse := common.ApplicationTrafficSnapshot()
	assert.Equal(t, uint64(0), afterRequest-beforeRequest)
	assert.Equal(t, uint64(0), afterResponse-beforeResponse)
}

func TestRelayTrafficPathOnlyIncludesRelayRoutes(t *testing.T) {
	assert.True(t, isRelayTrafficPath("/v1/chat/completions"))
	assert.True(t, isRelayTrafficPath("/v1beta/models/gemini"))
	assert.True(t, isRelayTrafficPath("/pg/chat/completions"))
	assert.True(t, isRelayTrafficPath("/kling/v1/videos/text2video"))
	assert.True(t, isRelayTrafficPath("/jimeng/"))
	assert.True(t, isRelayTrafficPath("/mj/submit/imagine"))
	assert.True(t, isRelayTrafficPath("/relay/mj/submit/imagine"))
	assert.True(t, isRelayTrafficPath("/suno/submit/music"))
	assert.False(t, isRelayTrafficPath("/api/mj"))
	assert.False(t, isRelayTrafficPath("/api/mj/self"))
	assert.False(t, isRelayTrafficPath("/api/next/dashboard/system-status"))
	assert.False(t, isRelayTrafficPath("/v10/chat/completions"))
	assert.False(t, isRelayTrafficPath("/assets/app.js"))
}

func TestRelayRequestMetricsCountsRelayTrafficOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRelayRequestMetrics())
	router.Any("/*path", func(c *gin.Context) {
		_, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		_, err = c.Writer.Write([]byte("relay response"))
		require.NoError(t, err)
	})

	beforeRequest, beforeResponse := common.ApplicationTrafficSnapshot()
	for _, path := range []string{"/v1/chat/completions", "/api/mj/self", "/assets/app.js"} {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader("relay request"))
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
	}

	afterRequest, afterResponse := common.ApplicationTrafficSnapshot()
	assert.Equal(t, uint64(len("relay request")), afterRequest-beforeRequest)
	assert.Equal(t, uint64(len("relay response")), afterResponse-beforeResponse)
}

func TestRelayRequestMetricsPreservesResponseControllerUnwrap(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRelayRequestMetrics())
	want := time.Unix(500, 0)
	router.GET("/v1/stream", func(c *gin.Context) {
		require.NoError(t, http.NewResponseController(c.Writer).SetWriteDeadline(want))
		c.Status(http.StatusNoContent)
	})

	response := &writeDeadlineRecorder{ResponseRecorder: httptest.NewRecorder()}
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/stream", nil))

	assert.Equal(t, want, response.deadline)
}

func TestAPIRequestMetricsDoesNotChangeModelSuccessRate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	before := common.GetRequestSuccessRate()

	apiRouter := gin.New()
	apiRouter.Use(RecordRequestMetrics())
	apiRouter.GET("/api/data/self", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false})
	})
	for i := 0; i < 20; i++ {
		apiRouter.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/data/self", nil))
	}

	assert.Equal(t, before, common.GetRequestSuccessRate())
}

func TestRelayRequestMetricsObservesOnlyRelayOutcomes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	outcomes := make([]bool, 0, 4)

	relayRouter := gin.New()
	relayRouter.Use(recordRequestMetrics(isRelayTrafficPath, func(success bool) {
		outcomes = append(outcomes, success)
	}))
	relayRouter.GET("/v1/success", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"id": "response"})
	})
	relayRouter.GET("/v1/business-fail", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": false})
	})
	relayRouter.GET("/v1/http-fail", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "upstream failed"})
	})
	relayRouter.GET("/v1/stream-fail", func(c *gin.Context) {
		MarkRelayRequestFailed(c)
		c.Data(http.StatusOK, "text/event-stream", []byte("data: {\"type\":\"upstream_error\"}\n\n"))
	})
	relayRouter.GET("/api/mj/self", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false})
	})
	relayRouter.GET("/assets/app.js", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false})
	})

	for _, path := range []string{
		"/v1/success",
		"/v1/business-fail",
		"/v1/http-fail",
		"/v1/stream-fail",
		"/api/mj/self",
		"/assets/app.js",
	} {
		relayRouter.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}

	assert.Equal(t, []bool{true, false, false, false}, outcomes)
}

func TestRelayRequestMetricsPopulatesModelSuccessRate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RecordRelayRequestMetrics())
	router.GET("/v1/business-fail", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": false})
	})

	for i := 0; i < 15; i++ {
		router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/v1/business-fail", nil))
	}

	rate := common.GetRequestSuccessRate()
	require.NotNil(t, rate)
	assert.Less(t, *rate, 100.0)
}

type writeDeadlineRecorder struct {
	*httptest.ResponseRecorder
	deadline time.Time
}

func (r *writeDeadlineRecorder) SetWriteDeadline(deadline time.Time) error {
	r.deadline = deadline
	return nil
}
