package apimart

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	apiCommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestAPIMartChannelTypeUsesDedicatedAPIType(t *testing.T) {
	apiType, known := apiCommon.ChannelType2APIType(constant.ChannelTypeAPIMartImage)
	if !known {
		t.Fatal("APIMart Image channel type must be registered")
	}
	if apiType != constant.APITypeAPIMartImage {
		t.Fatalf("api type = %d, want %d", apiType, constant.APITypeAPIMartImage)
	}
}

func TestIsTerminal(t *testing.T) {
	for _, status := range []string{"completed", "FAILED", "cancelled", "error"} {
		if !isTerminal(status) {
			t.Errorf("%q should be terminal", status)
		}
	}
	for _, status := range []string{"submitted", "processing", ""} {
		if isTerminal(status) {
			t.Errorf("%q must keep polling", status)
		}
	}
}

func TestDoResponseWaitsForCompletedTaskAndReturnsImage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/tasks/task-1" {
			t.Fatalf("unexpected task path %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("task query must preserve channel authorization")
		}
		_, _ = io.WriteString(w, `{"code":200,"data":{"status":"completed","result":{"images":[{"url":["https://example.test/image.png"]}]}}}`)
	}))
	defer server.Close()

	oldInitial, oldInterval := pollInitialDelay, pollInterval
	pollInitialDelay, pollInterval = 0, 0
	defer func() { pollInitialDelay, pollInterval = oldInitial, oldInterval }()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		StartTime:   time.Unix(1, 0),
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL, ApiKey: "test-key"},
	}
	resp := &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"code":200,"data":[{"status":"submitted","task_id":"task-1"}]}`))}

	usage, apiErr := (&Adaptor{}).DoResponse(c, resp, info)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	if usage == nil || !strings.Contains(recorder.Body.String(), "https://example.test/image.png") {
		t.Fatalf("unexpected response body: %s", recorder.Body.String())
	}
}
