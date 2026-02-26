package helper

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestBuildPassThroughRequestBodySyncMappedModel(t *testing.T) {
	ctx := newPassThroughTestContext(http.MethodPost, "/v1/chat/completions", "application/json", `{"model":"gpt-4o","temperature":0.2}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4.1-mini",
			IsModelMapped:     true,
		},
	}

	requestBody, err := BuildPassThroughRequestBody(ctx, info, true)
	if err != nil {
		t.Fatalf("BuildPassThroughRequestBody returned error: %v", err)
	}
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}

	bodyMap := map[string]any{}
	if err := common.Unmarshal(bodyBytes, &bodyMap); err != nil {
		t.Fatalf("unmarshal request body failed: %v", err)
	}
	if bodyMap["model"] != "gpt-4.1-mini" {
		t.Fatalf("expected mapped model gpt-4.1-mini, got %v", bodyMap["model"])
	}
	if bodyMap["temperature"] != float64(0.2) {
		t.Fatalf("expected temperature to keep 0.2, got %v", bodyMap["temperature"])
	}
}

func TestBuildPassThroughRequestBodySyncCompactModel(t *testing.T) {
	ctx := newPassThroughTestContext(http.MethodPost, "/v1/responses/compact", "application/json", `{"model":"gpt-4o-compact","input":"hello"}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o-compact",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
			IsModelMapped:     false,
		},
	}

	requestBody, err := BuildPassThroughRequestBody(ctx, info, true)
	if err != nil {
		t.Fatalf("BuildPassThroughRequestBody returned error: %v", err)
	}
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}

	bodyMap := map[string]any{}
	if err := common.Unmarshal(bodyBytes, &bodyMap); err != nil {
		t.Fatalf("unmarshal request body failed: %v", err)
	}
	if bodyMap["model"] != "gpt-4o" {
		t.Fatalf("expected compact model to sync to gpt-4o, got %v", bodyMap["model"])
	}
}

func TestBuildPassThroughRequestBodySkipWhenNotJSON(t *testing.T) {
	rawBody := `{"model":"gpt-4o"}`
	ctx := newPassThroughTestContext(http.MethodPost, "/v1/images/edits", "multipart/form-data; boundary=abc", rawBody)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4.1-mini",
			IsModelMapped:     true,
		},
	}

	requestBody, err := BuildPassThroughRequestBody(ctx, info, true)
	if err != nil {
		t.Fatalf("BuildPassThroughRequestBody returned error: %v", err)
	}
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}
	if string(bodyBytes) != rawBody {
		t.Fatalf("expected non-json body unchanged, got %s", string(bodyBytes))
	}
}

func TestBuildPassThroughRequestBodySkipWhenSyncDisabled(t *testing.T) {
	rawBody := `{"model":"gpt-4o"}`
	ctx := newPassThroughTestContext(http.MethodPost, "/v1/chat/completions", "application/json", rawBody)
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4.1-mini",
			IsModelMapped:     true,
		},
	}

	requestBody, err := BuildPassThroughRequestBody(ctx, info, false)
	if err != nil {
		t.Fatalf("BuildPassThroughRequestBody returned error: %v", err)
	}
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}
	if string(bodyBytes) != rawBody {
		t.Fatalf("expected body unchanged when sync disabled, got %s", string(bodyBytes))
	}
}

func newPassThroughTestContext(method, urlPath, contentType, body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(method, urlPath, strings.NewReader(body))
	request.Header.Set("Content-Type", contentType)
	ctx.Request = request
	return ctx
}
