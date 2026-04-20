package gemini

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseTaskResultReadsStringError(t *testing.T) {
	adaptor := &TaskAdaptor{}
	taskInfo, err := adaptor.ParseTaskResult([]byte(`{
		"name": "operations/test",
		"done": true,
		"error": "video poll failed: 451 {\"error_code\":\"video_unsafe\",\"message\":\"The generated video appears to be unsafe. Try modifying the prompts or the seeds.\"}"
	}`))
	if err != nil {
		t.Fatalf("ParseTaskResult returned error: %v", err)
	}
	if taskInfo.Status != model.TaskStatusFailure {
		t.Fatalf("expected failure status, got %s", taskInfo.Status)
	}
	if !strings.Contains(taskInfo.Reason, "video poll failed: 451") {
		t.Fatalf("expected string error reason, got %q", taskInfo.Reason)
	}
	if !strings.Contains(taskInfo.Reason, "video_unsafe") {
		t.Fatalf("expected upstream error code in reason, got %q", taskInfo.Reason)
	}
	if taskInfo.Progress != "100%" {
		t.Fatalf("expected complete progress, got %q", taskInfo.Progress)
	}
}
