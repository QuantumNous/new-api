package agnes

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseTaskResultCompletedWithRemixedFromVideoID(t *testing.T) {
	raw := []byte(`{
		"id": "task_abc",
		"status": "completed",
		"progress": 100,
		"remixed_from_video_id": "https://cdn.example.com/video.mp4"
	}`)

	adaptor := &TaskAdaptor{}
	ti, err := adaptor.ParseTaskResult(raw)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("expected success, got %s", ti.Status)
	}
	if ti.Url != "https://cdn.example.com/video.mp4" {
		t.Fatalf("unexpected url: %s", ti.Url)
	}
}

func TestParseTaskResultCompleted(t *testing.T) {
	raw := []byte(`{
		"id": "task_abc",
		"status": "completed",
		"progress": 100,
		"video_url": "https://cdn.example.com/video.mp4"
	}`)

	adaptor := &TaskAdaptor{}
	ti, err := adaptor.ParseTaskResult(raw)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("expected success, got %s", ti.Status)
	}
	if ti.Url != "https://cdn.example.com/video.mp4" {
		t.Fatalf("unexpected url: %s", ti.Url)
	}
}

func TestParseTaskResultQueued(t *testing.T) {
	raw := []byte(`{"id":"task_abc","status":"queued","progress":0}`)
	adaptor := &TaskAdaptor{}
	ti, err := adaptor.ParseTaskResult(raw)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusQueued {
		t.Fatalf("expected queued, got %s", ti.Status)
	}
}

func TestApiOrigin(t *testing.T) {
	cases := map[string]string{
		"https://apihub.agnes-ai.com":     "https://apihub.agnes-ai.com",
		"https://apihub.agnes-ai.com/v1":  "https://apihub.agnes-ai.com",
		"https://apihub.agnes-ai.com/v1/": "https://apihub.agnes-ai.com",
	}
	for in, want := range cases {
		if got := apiOrigin(in); got != want {
			t.Fatalf("apiOrigin(%q) = %q, want %q", in, got, want)
		}
	}
}
