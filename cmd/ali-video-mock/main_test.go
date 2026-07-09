package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	taskali "github.com/QuantumNous/new-api/relay/channel/task/ali"
)

func TestHappyHorseTaskLifecycle(t *testing.T) {
	server := newMockServer()

	submitBody := `{
		"model":"happyhorse-1.1-t2v",
		"input":{"prompt":"a running horse"},
		"parameters":{"size":"1280*720","duration":5}
	}`
	submitReq := httptest.NewRequest(http.MethodPost, "/api/v1/services/aigc/video-generation/video-synthesis", strings.NewReader(submitBody))
	submitReq.Host = "ali-video-mock:8080"
	submitResp := httptest.NewRecorder()
	server.routes().ServeHTTP(submitResp, submitReq)

	if submitResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", submitResp.Code)
	}

	var submit taskali.AliVideoResponse
	if err := common.Unmarshal(submitResp.Body.Bytes(), &submit); err != nil {
		t.Fatalf("unmarshal submit response failed: %v", err)
	}
	if submit.Output.TaskStatus != mockTaskPending {
		t.Fatalf("expected pending status, got %s", submit.Output.TaskStatus)
	}

	firstFetch := fetchTask(t, server, submit.Output.TaskID)
	if firstFetch.Output.TaskStatus != mockTaskRunning {
		t.Fatalf("expected running status, got %s", firstFetch.Output.TaskStatus)
	}

	secondFetch := fetchTask(t, server, submit.Output.TaskID)
	if secondFetch.Output.TaskStatus != mockTaskSuccess {
		t.Fatalf("expected success status, got %s", secondFetch.Output.TaskStatus)
	}
	if secondFetch.Usage == nil {
		t.Fatalf("expected usage payload")
	}
	if sr := intValue(secondFetch.Usage.SR); sr != 720 {
		t.Fatalf("expected SR 720, got %d", sr)
	}
	if secondFetch.Output.VideoURL == "" {
		t.Fatalf("expected video url")
	}
}

func TestKlingTaskLifecycleReturnsWatermark(t *testing.T) {
	server := newMockServer()

	submitBody := `{
		"model":"kling/kling-v3-video-generation",
		"input":{"prompt":"a cinematic robot"},
		"parameters":{"mode":"std","duration":5,"audio":false}
	}`
	submitReq := httptest.NewRequest(http.MethodPost, "/api/v1/services/aigc/video-generation/video-synthesis", strings.NewReader(submitBody))
	submitReq.Host = "ali-video-mock:8080"
	submitResp := httptest.NewRecorder()
	server.routes().ServeHTTP(submitResp, submitReq)

	if submitResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", submitResp.Code)
	}

	var submit taskali.AliVideoResponse
	if err := common.Unmarshal(submitResp.Body.Bytes(), &submit); err != nil {
		t.Fatalf("unmarshal submit response failed: %v", err)
	}

	_ = fetchTask(t, server, submit.Output.TaskID)
	finalFetch := fetchTask(t, server, submit.Output.TaskID)
	if finalFetch.Output.TaskStatus != mockTaskSuccess {
		t.Fatalf("expected success status, got %s", finalFetch.Output.TaskStatus)
	}
	if finalFetch.Output.WatermarkURL == "" {
		t.Fatalf("expected watermark url for kling")
	}
	if finalFetch.Usage == nil {
		t.Fatalf("expected usage payload")
	}
	if sr := intValue(finalFetch.Usage.SR); sr != 720 {
		t.Fatalf("expected SR 720, got %d", sr)
	}
	if audio, ok := finalFetch.Usage.Audio.(bool); !ok || audio {
		t.Fatalf("expected audio=false in usage, got %#v", finalFetch.Usage.Audio)
	}
}

func TestTaskLifecycleCanFailOnSecondPoll(t *testing.T) {
	server := newMockServerWithConfig(mockConfig{
		FailRate: 1,
	})

	submitBody := `{
		"model":"happyhorse-1.1-t2v",
		"input":{"prompt":"a running horse"},
		"parameters":{"size":"1280*720","duration":5}
	}`
	submitReq := httptest.NewRequest(http.MethodPost, "/api/v1/services/aigc/video-generation/video-synthesis", strings.NewReader(submitBody))
	submitReq.Host = "ali-video-mock:8080"
	submitResp := httptest.NewRecorder()
	server.routes().ServeHTTP(submitResp, submitReq)

	if submitResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", submitResp.Code)
	}

	var submit taskali.AliVideoResponse
	if err := common.Unmarshal(submitResp.Body.Bytes(), &submit); err != nil {
		t.Fatalf("unmarshal submit response failed: %v", err)
	}

	firstFetch := fetchTask(t, server, submit.Output.TaskID)
	if firstFetch.Output.TaskStatus != mockTaskRunning {
		t.Fatalf("expected running status, got %s", firstFetch.Output.TaskStatus)
	}

	secondFetch := fetchTask(t, server, submit.Output.TaskID)
	if secondFetch.Output.TaskStatus != mockTaskFailed {
		t.Fatalf("expected failed status, got %s", secondFetch.Output.TaskStatus)
	}
	if secondFetch.Output.VideoURL != "" {
		t.Fatalf("expected empty video url on failure, got %q", secondFetch.Output.VideoURL)
	}
}

func fetchTask(t *testing.T, server *mockServer, taskID string) taskali.AliVideoResponse {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks/"+taskID, nil)
	req.Host = "ali-video-mock:8080"
	resp := httptest.NewRecorder()
	server.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	var out taskali.AliVideoResponse
	if err := common.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal fetch response failed: %v", err)
	}
	return out
}

func intValue(v any) int {
	switch typed := v.(type) {
	case int:
		return typed
	case float64:
		return int(typed)
	default:
		return 0
	}
}
