package sora2u

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseCreateResponse_UnwrapsTaskID(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ckabc","status":"pending","model":"seedance-2.0"}}`)
	id, st, err := parseCreateTask(raw)
	if err != nil || id != "ckabc" || st != "pending" {
		t.Fatalf("id=%q status=%q err=%v", id, st, err)
	}
}

func TestParseCreateResponse_EmptyTaskID(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"status":"pending"}}`)
	_, _, err := parseCreateTask(raw)
	if err == nil {
		t.Fatal("expected error for empty task id")
	}
}

func TestParseTaskResult_CompletedSetsURL(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"completed","progress":100,"video_url":"https://cdn.example.com/v.mp4"}}`)
	info, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != string(model.TaskStatusSuccess) {
		t.Fatalf("status=%q", info.Status)
	}
	if info.Url != "https://cdn.example.com/v.mp4" {
		t.Fatalf("url=%q", info.Url)
	}
}

func TestParseTaskResult_FailedReason(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"failed","error":"audit","error_code":"video_audit_rejected"}}`)
	info, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != string(model.TaskStatusFailure) {
		t.Fatalf("status=%q", info.Status)
	}
	if info.Reason == "" {
		t.Fatal("expected reason")
	}
}

func TestParseTaskResult_PendingQueued(t *testing.T) {
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"pending"}}`)
	info, err := parseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != string(model.TaskStatusQueued) {
		t.Fatalf("status=%q", info.Status)
	}
}
