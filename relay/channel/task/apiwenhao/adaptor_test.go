package apiwenhao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseCreateTaskID(t *testing.T) {
	body := []byte(`{"data":{"res_type":"success","task_id":"task_abc","msg":"ok"},"msg":"操作成功","code":1}`)
	id, err := parseCreateTaskID(body)
	if err != nil {
		t.Fatalf("parseCreateTaskID: %v", err)
	}
	if id != "task_abc" {
		t.Fatalf("task_id = %q, want task_abc", id)
	}
}

func TestParseCreateTaskIDCodeError(t *testing.T) {
	body := []byte(`{"code":0,"msg":"余额不足"}`)
	_, err := parseCreateTaskID(body)
	if err == nil {
		t.Fatal("expected error for non-success code")
	}
}

func TestParseTaskResultSuccess(t *testing.T) {
	body := []byte(`{
  "res_type": "success",
  "task_id": "task_01KRXBSHDV2AMQM79WSS0X6GFV",
  "data": {
    "video_url": "https://example.com/out.mp4",
    "result": { "status": "completed", "progress": 100 }
  }
}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %v, want SUCCESS", ti.Status)
	}
	if ti.Url != "https://example.com/out.mp4" {
		t.Fatalf("url = %q", ti.Url)
	}
}

func TestParseTaskResultFail(t *testing.T) {
	body := []byte(`{
  "msg": "Timeout occurred",
  "data": { "error": { "message": "Timeout occurred" } },
  "res_type": "fail",
  "task_id": "gemini_xxx"
}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusFailure {
		t.Fatalf("status = %v, want FAILURE", ti.Status)
	}
	if ti.Reason == "" {
		t.Fatal("expected failure reason")
	}
}

func TestParseTaskResultGenerating(t *testing.T) {
	body := []byte(`{
  "msg": "操作成功",
  "code": 1,
  "data": {
    "msg": "进行中",
    "data": {
      "tips": "进行中",
      "state": 0,
      "result": {
        "status": "unknown",
        "progress": 0
      },
      "video_url": "",
      "state_text": "进行中"
    },
    "task_id": "task_pWX4frsim3MpViQVHAk5SAan0E9bKOqq",
    "res_type": "generating"
  }
}`)
	ti, err := (&TaskAdaptor{}).ParseTaskResult(body)
	if err != nil {
		t.Fatalf("ParseTaskResult: %v", err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status = %v, want IN_PROGRESS", ti.Status)
	}
	if ti.Reason != "" {
		t.Fatalf("reason = %q, want empty", ti.Reason)
	}
}

func TestFetchReqKey(t *testing.T) {
	if got := fetchReqKey(map[string]any{"req_key": "newapi_grok"}); got != "newapi_grok" {
		t.Fatalf("got %q", got)
	}
	if got := fetchReqKey(map[string]any{"upstream_model": "mapped_key"}); got != "mapped_key" {
		t.Fatalf("got %q", got)
	}
}
