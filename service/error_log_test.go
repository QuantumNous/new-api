package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func TestBuildErrorLogOther_SetsCategory(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	other := BuildErrorLogOther(c, constant.ErrorCategoryUpstream, map[string]interface{}{
		"status_code": 500,
	})
	if other["error_category"] != constant.ErrorCategoryUpstream {
		t.Fatalf("category=%v", other["error_category"])
	}
	if other["request_path"] != "/v1/chat/completions" {
		t.Fatalf("path=%v", other["request_path"])
	}
	if other["status_code"] != 500 {
		t.Fatalf("status_code=%v", other["status_code"])
	}
}

func TestErrorLogRecorded_MarkAndIs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	if IsErrorLogRecorded(c) {
		t.Fatal("expected not recorded initially")
	}
	MarkErrorLogRecorded(c)
	if !IsErrorLogRecorded(c) {
		t.Fatal("expected recorded after mark")
	}
}
