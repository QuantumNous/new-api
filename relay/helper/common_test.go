package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSetEventStreamHeadersIncludesUTF8Charset(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	SetEventStreamHeaders(c)

	if got := recorder.Header().Get("Content-Type"); got != "text/event-stream; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want %q", got, "text/event-stream; charset=utf-8")
	}
}
