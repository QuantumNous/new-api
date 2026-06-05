package blockrunseedance

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
)

// Compile-time guarantee that the adaptor satisfies the full polling +
// video-output surface of the channel package.
var (
	_ channel.TaskAdaptor          = (*TaskAdaptor)(nil)
	_ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
)

func TestParseTaskResult_Statuses(t *testing.T) {
	a := &TaskAdaptor{}

	// queued
	info, err := a.ParseTaskResult([]byte(`{"status":"queued"}`))
	if err != nil {
		t.Fatalf("queued: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusQueued {
		t.Fatalf("queued: status mismatch: %q", info.Status)
	}

	// in_progress
	info, err = a.ParseTaskResult([]byte(`{"status":"in_progress"}`))
	if err != nil {
		t.Fatalf("in_progress: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("in_progress: status mismatch: %q", info.Status)
	}

	// failed -> failure
	info, err = a.ParseTaskResult([]byte(`{"status":"failed","error":"boom"}`))
	if err != nil {
		t.Fatalf("failed: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("failed: status mismatch: %q", info.Status)
	}

	// completed: empty status with data[].url -> success and url surfaced
	info, err = a.ParseTaskResult([]byte(`{"status":"","data":[{"url":"https://up/v.mp4"}]}`))
	if err != nil {
		t.Fatalf("completed: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("completed: status mismatch: %q", info.Status)
	}
	if info.Url != "https://up/v.mp4" {
		t.Fatalf("completed: url mismatch: %q", info.Url)
	}

	// completed with no url and no error -> still in progress (don't drop)
	info, err = a.ParseTaskResult([]byte(`{"status":"","data":[]}`))
	if err != nil {
		t.Fatalf("pending: unexpected err: %v", err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("pending: status mismatch: %q", info.Status)
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	if got := ExtractUpstreamVideoURL(nil); got != "" {
		t.Fatalf("nil should yield empty, got %q", got)
	}
	if got := ExtractUpstreamVideoURL([]byte(`not-json`)); got != "" {
		t.Fatalf("bad json should yield empty, got %q", got)
	}
	got := ExtractUpstreamVideoURL([]byte(`{"data":[{"url":"https://up/host/v.mp4"}]}`))
	if got != "https://up/host/v.mp4" {
		t.Fatalf("url mismatch: %q", got)
	}
}
