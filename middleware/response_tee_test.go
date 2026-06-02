package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestBodyTeeWriterCapsCapture(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	// c.Writer is already a gin.ResponseWriter wrapping rec
	tee := newBodyTeeWriter(c.Writer, 5)
	c.Writer = tee
	tee.Write([]byte("hello world")) // 11 bytes
	if got := tee.Captured(); string(got) != "hello" {
		t.Fatalf("capture cap failed: %q", got)
	}
	if rec.Body.String() != "hello world" {
		t.Fatalf("passthrough failed: %q", rec.Body.String())
	}
}
