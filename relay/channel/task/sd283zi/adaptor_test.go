package sd283zi

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestResolveUpstreamModel(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"sd2fast", "fast"},
		{"SD2FAST", "fast"},
		{"sd2", "2.0"},
		{"SD2", "2.0"},
		{"fast", "fast"},
		{"2.0", "2.0"},
		{"custom", "custom"},
	}
	for _, tt := range tests {
		if got := resolveUpstreamModel(tt.in); got != tt.want {
			t.Fatalf("resolveUpstreamModel(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"status":"success","task_id":"a77e1768-c022-43c6-a3c8-9756ee11037d","task_status":"pending"}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID failed: %v", err)
	}
	if id != "a77e1768-c022-43c6-a3c8-9756ee11037d" {
		t.Fatalf("unexpected task id: %s", id)
	}
}

func TestParseTaskResultSuccess(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"success","progress":100,"video_url":"https://example.com/video.mp4"}`)
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

func TestParseTaskResultPolling(t *testing.T) {
	a := &TaskAdaptor{}
	body := []byte(`{"status":"polling","progress":80}`)
	ti, err := a.ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult failed: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %s, want in progress", ti.Status)
	}
	if ti.Progress != "80%" {
		t.Fatalf("progress = %q", ti.Progress)
	}
}

func TestUpstreamFileFieldName(t *testing.T) {
	tests := map[string]string{
		"files":             "files",
		"file":              "files",
		"image":             "files",
		"images":            "files",
		"reference_image":   "files",
		"reference_images":  "files",
		"input_reference":   "files",
		"custom_field":      "custom_field",
	}
	for in, want := range tests {
		if got := upstreamFileFieldName(in); got != want {
			t.Fatalf("upstreamFileFieldName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsTextMultipartField(t *testing.T) {
	if !isTextMultipartField("prompt") {
		t.Fatal("prompt should be text field")
	}
	if isTextMultipartField("files") {
		t.Fatal("files should not be text field")
	}
}

func TestToImageURLEntry(t *testing.T) {
	entry := toImageURLEntry("https://example.com/path/image2.png?x=1")
	if entry.URL != "https://example.com/path/image2.png?x=1" {
		t.Fatalf("unexpected url: %s", entry.URL)
	}
	if entry.FileName != "image2.png" {
		t.Fatalf("unexpected file name: %s", entry.FileName)
	}
	if entry.ContentType != "image/png" {
		t.Fatalf("unexpected content type: %s", entry.ContentType)
	}
}
