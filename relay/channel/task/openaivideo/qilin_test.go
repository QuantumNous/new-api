package openaivideo

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestQilinGrokLongDurationTransportModel(t *testing.T) {
	p := &qilinProvider{}
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video",
		"prompt":   "test",
		"duration": 20,
	}

	p.normalizeJSONRequest(body, "grok-imagine-1.0-video", "grok-imagine-1.0-video", 0)

	if got := body["model"]; got != "grok-imagine-1.0-video-20s" {
		t.Fatalf("model = %#v", got)
	}
	if got := body["duration"]; got != 20 {
		t.Fatalf("duration = %#v", got)
	}
	if got := body["seconds"]; got != "20" {
		t.Fatalf("seconds = %#v", got)
	}
}

func TestQilinGrokLockedDurationModel(t *testing.T) {
	p := &qilinProvider{}
	body := map[string]interface{}{
		"model":    "grok-imagine-1.0-video-30s",
		"prompt":   "test",
		"duration": 10,
		"seconds":  "10",
	}

	p.normalizeJSONRequest(body, "grok-imagine-1.0-video-30s", "grok-imagine-1.0-video-30s", 0)

	if got := body["model"]; got != "grok-imagine-1.0-video-30s" {
		t.Fatalf("model = %#v", got)
	}
	if got := body["duration"]; got != 30 {
		t.Fatalf("duration = %#v", got)
	}
	if got := body["seconds"]; got != "30" {
		t.Fatalf("seconds = %#v", got)
	}
}

func TestQilinGrokAdditionalAspectRatios(t *testing.T) {
	p := &qilinProvider{}
	body := map[string]interface{}{
		"model":        "grok-imagine-1.0-video",
		"prompt":       "test",
		"aspect_ratio": "21:9",
	}

	p.normalizeJSONRequest(body, "grok-imagine-1.0-video", "grok-imagine-1.0-video", 0)

	if got := body["size"]; got != "1680x720" {
		t.Fatalf("size = %#v", got)
	}
}

func TestQilinParseQueryPrefersOutputURLBeforeProxyURL(t *testing.T) {
	p := &qilinProvider{}
	info, err := p.parseQueryResponse([]byte(`{"id":"task_1","status":"completed","progress":100,"url":"https://proxy.example.com/v1/videos/task_1/content","output":{"url":"https://cdn.example.com/video.mp4"}}`))
	if err != nil {
		t.Fatalf("parseQueryResponse error: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q", info.Status)
	}
	if info.Url != "https://cdn.example.com/video.mp4" {
		t.Fatalf("url = %q", info.Url)
	}
}
