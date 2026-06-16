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
