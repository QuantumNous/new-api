package task7tai

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveUpstreamModel(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"sd2-fast福利", "sd2-fast福利"},
		{"sd2-福利", "sd2-福利"},
		{"SD2.0-720p", "SD2.0-720p"},
		{"seedance-2.0-720p", "SD2.0-720p"},
		{"SD2.0-480p-fast", "SD2.0-480p-fast"},
		{"SD2.0-480p", "SD2.0-480p"},
	}
	for _, tt := range tests {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"id":"task_abc","task_id":"task_abc","status":"processing"}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID failed: %v", err)
	}
	if id != "task_abc" {
		t.Fatalf("unexpected task id: %s", id)
	}
}

func TestParseTaskResultSuccessWrapped(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":"success","data":{"status":"SUCCESS","progress":"100%","result_url":"https://example.com/video.mp4","data":{"status":"succeeded","video_url":"https://example.com/video.mp4"}}}`)
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

func TestParseTaskResultInProgress(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":"success","data":{"status":"IN_PROGRESS","progress":"30%","data":{"status":"processing","progress":1}}}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
	if ti.Progress != "30%" {
		t.Fatalf("progress = %q", ti.Progress)
	}
}

func TestParseTaskResultFailed(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"code":"success","data":{"status":"FAILED","fail_reason":"quota insufficient"}}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusFailure {
		t.Fatalf("status = %s, want failure", ti.Status)
	}
}

func TestApiOrigin(t *testing.T) {
	if got := apiOrigin("https://api.7tai.cc"); got != "https://api.7tai.cc/v1" {
		t.Fatalf("apiOrigin = %q", got)
	}
	if got := apiOrigin("https://api.7tai.cc/v1"); got != "https://api.7tai.cc/v1" {
		t.Fatalf("apiOrigin with /v1 = %q", got)
	}
}
