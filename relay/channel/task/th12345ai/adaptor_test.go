package th12345ai

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveUpstreamModel(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"sd2-431", "videos_stable"},
		{"sd2-fast-431", "videos_stable_fast"},
		{"videos_stable", "videos_stable"},
		{"videos_stable_fast", "videos_stable_fast"},
		{"sd2", "videos_stable"},
		{"sd2fast", "videos_stable_fast"},
		{"Seedance-2.0-fast", "videos_stable_fast"},
	}
	for _, tt := range tests {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"id":"ca785792-2bba-407d-98b6-09ea49f902ce","kind":"video","status":"queued"}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID failed: %v", err)
	}
	if id != "ca785792-2bba-407d-98b6-09ea49f902ce" {
		t.Fatalf("unexpected task id: %s", id)
	}
}

func TestParseTaskResultSucceeded(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"id":"ca785792-2bba-407d-98b6-09ea49f902ce","status":"succeeded","video_url":"https://example.com/video.mp4","errorMessage":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %s, want success", ti.Status)
	}
	if ti.Url != "https://example.com/video.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestParseTaskResultProcessing(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"id":"ca785792-2bba-407d-98b6-09ea49f902ce","status":"processing","video_url":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
}

func TestParseTaskResultQueued(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"id":"ca785792-2bba-407d-98b6-09ea49f902ce","status":"queued","video_url":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusQueued {
		t.Fatalf("status = %s, want queued", ti.Status)
	}
}

func TestParseTaskResultFailed(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"id":"ca785792-2bba-407d-98b6-09ea49f902ce","status":"failed","errorMessage":"quota insufficient","video_url":null}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusFailure {
		t.Fatalf("status = %s, want failure", ti.Status)
	}
	if ti.Reason != "quota insufficient" {
		t.Fatalf("reason = %q", ti.Reason)
	}
}

func TestApiOrigin(t *testing.T) {
	if got := apiOrigin("https://sd.12345ai.net"); got != "https://sd.12345ai.net" {
		t.Fatalf("apiOrigin = %q", got)
	}
	if got := apiOrigin("https://sd.12345ai.net/api/tasks"); got != "https://sd.12345ai.net" {
		t.Fatalf("apiOrigin with /api/tasks = %q", got)
	}
	if got := apiOrigin("https://sd.12345ai.net/api/"); got != "https://sd.12345ai.net" {
		t.Fatalf("apiOrigin with /api/ = %q", got)
	}
}

func TestNormalizeResolution(t *testing.T) {
	if got := normalizeResolution("720P"); got != "720p" {
		t.Fatalf("normalizeResolution = %q", got)
	}
	if got := normalizeResolution("720p"); got != "720p" {
		t.Fatalf("normalizeResolution keep = %q", got)
	}
}
