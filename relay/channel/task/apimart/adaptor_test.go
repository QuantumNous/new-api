package apimart

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"code":200,"data":{"id":"task_01JNXXXXXXXX","status":"submitted","progress":0}}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID: %v", err)
	}
	if id != "task_01JNXXXXXXXX" {
		t.Fatalf("id = %q", id)
	}
}

func TestParseCreateTaskIDDataArray(t *testing.T) {
	body := []byte(`{"code":200,"data":[{"status":"submitted","task_id":"task_01KS1X4C4KT0J0N2G5TAXXHXZX"}]}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID: %v", err)
	}
	if id != "task_01KS1X4C4KT0J0N2G5TAXXHXZX" {
		t.Fatalf("id = %q", id)
	}
}

func TestParseTaskResultCompleted(t *testing.T) {
	body := []byte(`{
  "code": 200,
  "data": {
    "id": "task_01K9S419324DREZFBWNSVXYR6H",
    "status": "completed",
    "progress": 100,
    "result": {
      "videos": [{
        "url": ["https://upload.apimart.ai/f/video/out.mp4"]
      }]
    }
  }
}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %v", ti.Status)
	}
	if ti.Url != "https://upload.apimart.ai/f/video/out.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestParseTaskResultProcessing(t *testing.T) {
	body := []byte(`{"code":200,"data":{"id":"task_x","status":"processing","progress":1}}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %v", ti.Status)
	}
}

func TestGjsonParseStringArray(t *testing.T) {
	urls := gjsonParseStringArray([]interface{}{"https://example.com/a.png"})
	if len(urls) != 1 || urls[0] != "https://example.com/a.png" {
		t.Fatalf("urls = %#v", urls)
	}
}

func TestNormalizeApimartCreatePayloadImagesAndSize(t *testing.T) {
	payload := map[string]interface{}{
		"model":        "grok-imagine-1.0-video-apimart",
		"prompt":       "test",
		"images":       []interface{}{"https://example.com/ref.png"},
		"aspect_ratio": "3:2",
		"size":         "3:2",
		"quality":      "720p",
	}
	normalizeApimartCreatePayload(payload)
	if _, ok := payload["images"]; ok {
		t.Fatal("images should be removed")
	}
	urls, ok := payload["image_urls"].([]string)
	if !ok || len(urls) != 1 || urls[0] != "https://example.com/ref.png" {
		t.Fatalf("image_urls = %#v", payload["image_urls"])
	}
	if payload["size"] != "3:2" {
		t.Fatalf("size = %#v", payload["size"])
	}
	q, _ := payload["quality"].(string)
	if q != "720p" {
		t.Fatalf("quality = %#v", payload["quality"])
	}
}

func TestNormalizeMaps720PSizeToQuality(t *testing.T) {
	payload := map[string]interface{}{
		"images": []string{"https://example.com/a.png"},
		"size":   "720P",
	}
	normalizeApimartCreatePayload(payload)
	if payload["quality"] != "720p" {
		t.Fatalf("quality = %#v", payload["quality"])
	}
	if _, ok := payload["size"]; ok {
		t.Fatalf("size should move to quality, got %#v", payload["size"])
	}
}

func TestApimartSizeAndQualityFromRequest(t *testing.T) {
	req := relaycommon.TaskSubmitReq{
		AspectRatio: "16:9",
		Size:        "720p",
		Duration:    6,
	}
	if got := apimartSizeFromRequest(&req); got != "16:9" {
		t.Fatalf("size = %q", got)
	}
	if got := apimartQualityFromRequest(&req); got != "720p" {
		t.Fatalf("quality = %q", got)
	}
	if got := apimartDurationFromRequest(&req); got != 6 {
		t.Fatalf("duration = %d", got)
	}
}
