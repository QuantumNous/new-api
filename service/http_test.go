package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldCopyUpstreamHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())

	blocked := []string{
		"Content-Length",
		"Alt-Svc",
		"Content-Location",
		"Link",
		"Location",
		"Connection",
		"Keep-Alive",
		"Proxy-Authenticate",
		"Proxy-Authorization",
		"TE",
		"Trailer",
		"Transfer-Encoding",
		"Upgrade",
		"Server",
		"Server-Timing",
		"Via",
		"X-Powered-By",
		"X-Request-ID",
		"X-Client-Request-ID",
		"Request-ID",
		"X-Correlation-ID",
		"X-Trace-ID",
		"Traceparent",
		"Tracestate",
		"CF-Ray",
		"CF-Cache-Status",
		"X-Upstream-Service-Time",
		"X-Backend-Server",
		"X-Envoy-Upstream-Service-Time",
		"X-Amz-Cf-Id",
		"X-Vercel-Id",
		"Fly-Request-Id",
		"NEL",
		"Report-To",
		"Reporting-Endpoints",
		"Set-Cookie",
		"WWW-Authenticate",
	}
	for _, header := range blocked {
		t.Run("blocks_"+header, func(t *testing.T) {
			assert.False(t, ShouldCopyUpstreamHeader(context, header, []string{"value"}))
		})
	}

	allowed := []string{
		"Content-Type",
		"Content-Disposition",
		"Cache-Control",
		"ETag",
		"Last-Modified",
		"OpenAI-Processing-Ms",
		"X-RateLimit-Remaining-Requests",
	}
	for _, header := range allowed {
		t.Run("allows_"+header, func(t *testing.T) {
			assert.True(t, ShouldCopyUpstreamHeader(context, header, []string{"value"}))
		})
	}

	assert.False(t, ShouldCopyUpstreamHeader(context, "X-Empty", nil))
}

func TestShouldCopyUpstreamHeaderCapturesNewAPIRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())

	require.False(t, ShouldCopyUpstreamHeader(context, common.RequestIdKey, []string{"upstream-id"}))
	value, exists := context.Get(common.UpstreamRequestIdKey)
	require.True(t, exists)
	assert.Equal(t, "upstream-id", value)
}

func TestIOCopyBytesGracefullyOmitsUpstreamIdentityHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	response := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type":        []string{"application/json"},
			"Server":              []string{"cloudflare"},
			"Via":                 []string{"1.1 Caddy"},
			"CF-Ray":              []string{"secret-edge-id"},
			"Report-To":           []string{`{"endpoints":[{"url":"https://a.nel.cloudflare.com/report"}]}`},
			"NEL":                 []string{`{"report_to":"cf-nel"}`},
			"Location":            []string{"https://api.aijws.com/redirect"},
			"X-Request-Id":        []string{"upstream-request-id"},
			"X-Client-Request-Id": []string{"upstream-client-request-id"},
			"X-Powered-By":        []string{"upstream"},
			"Set-Cookie":          []string{"upstream_session=secret"},
			"Content-Length":      []string{"999"},
		},
	}

	IOCopyBytesGracefully(context, response, []byte(`{"ok":true}`))

	result := recorder.Result()
	defer result.Body.Close()
	assert.Equal(t, "application/json", result.Header.Get("Content-Type"))
	assert.Equal(t, "11", result.Header.Get("Content-Length"))
	for _, header := range []string{
		"Server", "Via", "CF-Ray", "Report-To", "NEL", "Location", "X-Request-Id",
		"X-Client-Request-Id", "X-Powered-By", "Set-Cookie",
	} {
		assert.Empty(t, result.Header.Values(header))
	}
}
