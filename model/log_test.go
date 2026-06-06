package model

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

func TestFormatUserLogsMasksUpstreamError(t *testing.T) {
	logs := []*Log{{
		Id:                99,
		Type:              LogTypeError,
		Content:           "status_code=403, unexpected status 403 Forbidden: token quota is not enough, url: https://example.invalid/responses",
		ChannelId:         12,
		ChannelName:       "upstream-channel",
		UpstreamRequestId: "upstream-req-123",
		Other: common.MapToJsonStr(map[string]interface{}{
			"status_code":    http.StatusForbidden,
			"error_code":     "provider_quota_error",
			"error_type":     "openai_error",
			"upstream_error": true,
			"channel_id":     12,
			"channel_name":   "upstream-channel",
			"channel_type":   1,
			"admin_info": map[string]interface{}{
				"use_channel": []int{12},
			},
		}),
	}}

	formatUserLogs(logs, 0)

	if logs[0].Content != "status_code=503, Service Unavailable" {
		t.Fatalf("content = %q", logs[0].Content)
	}
	if logs[0].ChannelId != 0 {
		t.Fatalf("channel id = %d, want 0", logs[0].ChannelId)
	}
	if logs[0].ChannelName != "" {
		t.Fatalf("channel name = %q, want empty", logs[0].ChannelName)
	}
	if logs[0].UpstreamRequestId != "" {
		t.Fatalf("upstream request id = %q, want empty", logs[0].UpstreamRequestId)
	}

	other, _ := common.StrToMap(logs[0].Other)
	if other["status_code"] != float64(http.StatusServiceUnavailable) {
		t.Fatalf("status code = %v, want %d", other["status_code"], http.StatusServiceUnavailable)
	}
	if other["error_code"] != string(types.ErrorCodeServiceUnavailable) {
		t.Fatalf("error code = %v, want %s", other["error_code"], types.ErrorCodeServiceUnavailable)
	}
	if _, ok := other["admin_info"]; ok {
		t.Fatal("admin_info should be removed")
	}
	if _, ok := other["channel_id"]; ok {
		t.Fatal("channel_id should be removed")
	}
	if _, ok := other["upstream_error"]; ok {
		t.Fatal("upstream_error should be removed")
	}
}

func TestFormatUserLogsKeepsLocalError(t *testing.T) {
	logs := []*Log{{
		Type:              LogTypeError,
		Content:           "Invalid token",
		ChannelId:         0,
		UpstreamRequestId: "",
		Other: common.MapToJsonStr(map[string]interface{}{
			"status_code":    http.StatusUnauthorized,
			"error_code":     "",
			"error_type":     "new_api_error",
			"upstream_error": false,
		}),
	}}

	formatUserLogs(logs, 0)

	if logs[0].Content != "Invalid token" {
		t.Fatalf("content = %q", logs[0].Content)
	}
	other, _ := common.StrToMap(logs[0].Other)
	if other["status_code"] != float64(http.StatusUnauthorized) {
		t.Fatalf("status code = %v, want %d", other["status_code"], http.StatusUnauthorized)
	}
}
