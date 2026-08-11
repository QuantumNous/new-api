package mao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseCreateTaskID(t *testing.T) {
	id, err := parseCreateTaskID([]byte(`{"task_id":"t1","status":"queued"}`))
	if err != nil || id != "t1" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	id, err = parseCreateTaskID([]byte(`{"data":{"task_id":"t2"}}`))
	if err != nil || id != "t2" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestParseCreateTaskID_Missing(t *testing.T) {
	_, err := parseCreateTaskID([]byte(`{"status":"queued"}`))
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestParseTaskResult_PreparingRefVideo(t *testing.T) {
	ti, err := parseTaskResult([]byte(`{"status":"preparing_reference_video"}`))
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusInProgress {
		t.Fatalf("status=%v", ti.Status)
	}
}

func TestParseTaskResult_SuccessURL(t *testing.T) {
	raw := []byte(`{"status":"completed","video_url":"https://cdn.example.com/v.mp4"}`)
	ti, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusSuccess || ti.Url != "https://cdn.example.com/v.mp4" {
		t.Fatalf("status=%v url=%q", ti.Status, ti.Url)
	}
}

func TestParseTaskResult_Failed(t *testing.T) {
	raw := []byte(`{"status":"failed","fail_reason":"audit"}`)
	ti, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if ti.Status != model.TaskStatusFailure || ti.Reason != "audit" {
		t.Fatalf("status=%v reason=%q", ti.Status, ti.Reason)
	}
}
