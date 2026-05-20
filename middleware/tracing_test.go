package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/pkg/armsotel"

	"github.com/gin-gonic/gin"
)

func TestTraceMiddlewareExtractsTraceContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Trace())
	router.GET("/ping", func(c *gin.Context) {
		traceID, _ := armsotel.TraceIDsFromContext(c.Request.Context())
		c.String(http.StatusOK, traceID)
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("traceparent", "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Body.String() != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("trace id = %q", rec.Body.String())
	}
}
