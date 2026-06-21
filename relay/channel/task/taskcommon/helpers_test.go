package taskcommon

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestExtractVideoURLFromJSONRemixedFromVideoID(t *testing.T) {
	raw := []byte(`{
		"status": "completed",
		"remixed_from_video_id": "https://cdn.example.com/video.mp4"
	}`)
	if got := ExtractVideoURLFromJSON(raw); got != "https://cdn.example.com/video.mp4" {
		t.Fatalf("unexpected url: %q", got)
	}
}

func TestExtractVideoURLFromJSONContentVideoURL(t *testing.T) {
	raw := []byte(`{
		"status": "succeeded",
		"content": {
			"video_url": "https://cdn.example.com/volc.mp4"
		}
	}`)
	if got := ExtractVideoURLFromJSON(raw); got != "https://cdn.example.com/volc.mp4" {
		t.Fatalf("unexpected url: %q", got)
	}
}

func TestResolveTaskVideoURLAvoidsProxySelfReference(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public",
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://example.com/v1/videos/task_public/content",
		},
		Data: []byte(`{"remixed_from_video_id":"https://cdn.example.com/video.mp4"}`),
	}
	if got := ResolveTaskVideoURL(task); got != "https://cdn.example.com/video.mp4" {
		t.Fatalf("unexpected url: %q", got)
	}
}

func TestResolveTaskVideoURLSkipsExpiredSignedURL(t *testing.T) {
	expired := "https://tos.example.com/video.mp4?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Date=20200101T000000Z&X-Tos-Expires=86400"
	task := &model.Task{
		TaskID: "task_public",
		PrivateData: model.TaskPrivateData{
			ResultURL: expired,
		},
		Data: []byte(`{"content":{"video_url":"` + expired + `"}}`),
	}
	if got := ResolveTaskVideoURL(task); got != expired {
		t.Fatalf("unexpected url: %q", got)
	}
}

func TestExtractUpstreamTaskIDFromJSON(t *testing.T) {
	raw := []byte(`{"id":"cgt-123","status":"succeeded"}`)
	if got := ExtractUpstreamTaskIDFromJSON(raw, "task_public"); got != "cgt-123" {
		t.Fatalf("unexpected id: %q", got)
	}
}

func TestPickTaskResultURLPrefersDirectURLFromData(t *testing.T) {
	task := &model.Task{TaskID: "task_public"}
	raw := []byte(`{"remixed_from_video_id":"https://cdn.example.com/video.mp4"}`)
	got := PickTaskResultURL(task, "https://example.com/v1/videos/task_public/content", raw)
	if got != "https://cdn.example.com/video.mp4" {
		t.Fatalf("unexpected url: %q", got)
	}
}
