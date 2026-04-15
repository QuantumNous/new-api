package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
)

func TestBuildAsyncVideoTaskResponseHidesTransientNotFoundFailure(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_transient",
		Status:     model.TaskStatusFailure,
		SubmitTime: time.Now().Unix(),
		FinishTime: time.Now().Unix(),
		Progress:   taskcommon.ProgressComplete,
		FailReason: `{"detail":"Not Found"}`,
		Properties: model.Properties{
			OriginModelName: "grok-imagine-1.0-video",
		},
	}

	resp := buildAsyncVideoTaskResponse(task)

	if resp.Status != "in_progress" {
		t.Fatalf("status = %q, want in_progress", resp.Status)
	}
	if resp.CompletedAt != 0 {
		t.Fatalf("completed_at = %d, want 0", resp.CompletedAt)
	}
	if resp.Error != nil {
		t.Fatalf("error = %+v, want nil", resp.Error)
	}
}

func TestBuildAsyncVideoTaskResponseKeepsOldFailure(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_old_failure",
		Status:     model.TaskStatusFailure,
		SubmitTime: time.Now().Add(-3 * time.Minute).Unix(),
		FinishTime: time.Now().Unix(),
		Progress:   taskcommon.ProgressComplete,
		FailReason: `{"detail":"Not Found"}`,
	}

	resp := buildAsyncVideoTaskResponse(task)

	if resp.Status != "failed" {
		t.Fatalf("status = %q, want failed", resp.Status)
	}
	if resp.Error == nil {
		t.Fatal("error = nil, want failure error")
	}
}
