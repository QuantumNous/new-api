package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldRecordRequestTiming(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		path     string
		expected bool
	}{
		{name: "chat completions", method: http.MethodPost, path: "/v1/chat/completions", expected: true},
		{name: "legacy completions", method: http.MethodPost, path: "/v1/completions", expected: true},
		{name: "responses", method: http.MethodPost, path: "/v1/responses", expected: true},
		{name: "claude messages", method: http.MethodPost, path: "/v1/messages", expected: true},
		{name: "gemini generate", method: http.MethodPost, path: "/v1beta/models/gemini-2.5-pro:generateContent", expected: true},
		{name: "gemini stream generate", method: http.MethodPost, path: "/v1beta/models/gemini-2.5-pro:streamGenerateContent", expected: true},
		{name: "get chat", method: http.MethodGet, path: "/v1/chat/completions", expected: false},
		{name: "responses compact", method: http.MethodPost, path: "/v1/responses/compact", expected: false},
		{name: "realtime", method: http.MethodPost, path: "/v1/realtime", expected: false},
		{name: "embedding", method: http.MethodPost, path: "/v1/embeddings", expected: false},
		{name: "playground", method: http.MethodPost, path: "/pg/chat/completions", expected: false},
		{name: "gemini embedding", method: http.MethodPost, path: "/v1beta/models/text-embedding:embedContent", expected: false},
		{name: "gemini missing model", method: http.MethodPost, path: "/v1beta/models/:generateContent", expected: false},
		{name: "gemini extra suffix", method: http.MethodPost, path: "/v1beta/models/gemini:generateContent/extra", expected: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, shouldRecordRequestTiming(test.method, test.path))
		})
	}
}

func TestRequestTimingMiddlewareIgnoresKeepaliveWrites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(RequestTiming())
	var session *common.RequestTimingSession
	engine.POST("/v1/chat/completions", func(c *gin.Context) {
		session = common.GetRequestTimingSession(c)
		require.NotNil(t, session)
		session.MarkUpstreamAttempt(time.Now(), true)
		_, err := c.Writer.Write([]byte(": PING\n\n"))
		require.NoError(t, err)
		session.MarkFirstUpstreamData(time.Now())
		_, err = c.Writer.WriteString("data: result\n\n")
		require.NoError(t, err)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	require.NotNil(t, session)
	timing := session.Snapshot(time.Now(), false)
	require.NotNil(t, timing)
	require.NotNil(t, timing.FirstDataToClientMs)
	assert.Equal(t, int64(0), *timing.FirstDataToClientMs)
}

func TestRequestTimingMiddlewareSkipsOtherRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	engine.Use(RequestTiming())
	var session *common.RequestTimingSession
	engine.POST("/v1/embeddings", func(c *gin.Context) {
		session = common.GetRequestTimingSession(c)
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/embeddings", nil)
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)

	assert.Nil(t, session)
}
