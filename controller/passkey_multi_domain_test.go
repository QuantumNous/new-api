package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParsePasskeyRPIDHint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"rp_id":"old.example.org"}`))
	hint, err := parsePasskeyRPIDHint(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if hint != "old.example.org" {
		t.Fatalf("hint = %q", hint)
	}
}

func TestParsePasskeyRPIDHintAllowsEmptyBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	hint, err := parsePasskeyRPIDHint(ctx)
	if err != nil || hint != "" {
		t.Fatalf("hint=%q err=%v", hint, err)
	}
}
