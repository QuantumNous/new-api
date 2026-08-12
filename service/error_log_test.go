package service

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
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

func TestBuildErrorLogOther_AttachesRequestBodies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{"model":"guanzhuan-seedance2.0","metadata":{"resolution":"1080p"},"prompt":"x"}`)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	storage, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatal(err)
	}
	c.Set(common.KeyBodyStorage, storage)
	c.Set(taskcommon.GinKeyUpstreamRequestBody, `{"model":"sd-2-0-1080p","metadata":{"resolution":"1080p"},"prompt":"x"}`)

	other := BuildErrorLogOther(c, constant.ErrorCategoryUpstream, map[string]interface{}{
		"error_code": "fail_to_fetch_task",
	})
	reqBody, ok := other["request_body"].(map[string]interface{})
	if !ok {
		t.Fatalf("request_body type=%T val=%v", other["request_body"], other["request_body"])
	}
	if reqBody["model"] != "guanzhuan-seedance2.0" {
		t.Fatalf("request_body.model=%v", reqBody["model"])
	}
	md, _ := reqBody["metadata"].(map[string]interface{})
	if md["resolution"] != "1080p" {
		t.Fatalf("metadata.resolution=%v", md["resolution"])
	}
	up, ok := other["upstream_request_body"].(map[string]interface{})
	if !ok {
		t.Fatalf("upstream_request_body=%v", other["upstream_request_body"])
	}
	if up["model"] != "sd-2-0-1080p" {
		t.Fatalf("upstream model=%v", up["model"])
	}
}

func TestSanitizeErrorLogBodyBytes_RedactsDataURL(t *testing.T) {
	raw := []byte(`{"image":"data:image/png;base64,` + strings.Repeat("A", 500) + `","prompt":"hi"}`)
	v := sanitizeErrorLogBodyBytes(raw)
	m, ok := v.(map[string]interface{})
	if !ok {
		t.Fatalf("type=%T", v)
	}
	img, _ := m["image"].(string)
	if !strings.Contains(img, "data_url_redacted") {
		t.Fatalf("image not redacted: %q", img)
	}
	if m["prompt"] != "hi" {
		t.Fatalf("prompt=%v", m["prompt"])
	}
}
