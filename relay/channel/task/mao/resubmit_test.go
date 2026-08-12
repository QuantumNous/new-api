package mao

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestTryResubmitOnFailure_EmptyBody(t *testing.T) {
	a := &TaskAdaptor{}
	ch := &model.Channel{Key: "k"}
	base := "http://example.invalid"
	ch.BaseURL = &base
	task := &model.Task{}
	ok, prog, err := a.TryResubmitOnFailure(context.Background(), ch, task, "timeout")
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if ok || prog != "" {
		t.Fatalf("expected no resubmit, got ok=%v prog=%q", ok, prog)
	}
	if task.PrivateData.RetryCount != 0 {
		t.Fatalf("RetryCount should stay 0, got %d", task.PrivateData.RetryCount)
	}
}

func TestTryResubmitOnFailure_AuditNoHTTP(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"task_id":"should-not"}`))
	}))
	defer srv.Close()

	a := &TaskAdaptor{}
	ch := &model.Channel{Key: "k", BaseURL: &srv.URL}
	task := &model.Task{
		PrivateData: model.TaskPrivateData{
			RequestBody:    `{"model":"x"}`,
			UpstreamTaskID: "old",
		},
	}
	ok, prog, err := a.TryResubmitOnFailure(context.Background(), ch, task, "audit failed")
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if ok || prog != "" {
		t.Fatalf("expected no resubmit, got ok=%v prog=%q", ok, prog)
	}
	if hit {
		t.Fatal("audit reason must not hit HTTP")
	}
	if task.PrivateData.RetryCount != 0 {
		t.Fatalf("RetryCount should stay 0, got %d", task.PrivateData.RetryCount)
	}
	if task.PrivateData.UpstreamTaskID != "old" {
		t.Fatalf("UpstreamTaskID changed: %q", task.PrivateData.UpstreamTaskID)
	}
}

func TestTryResubmitOnFailure_RetryCount2NoHTTP(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"task_id":"should-not"}`))
	}))
	defer srv.Close()

	a := &TaskAdaptor{}
	ch := &model.Channel{Key: "k", BaseURL: &srv.URL}
	task := &model.Task{
		PrivateData: model.TaskPrivateData{
			RequestBody:    `{"model":"x"}`,
			UpstreamTaskID: "old",
			RetryCount:     2,
		},
	}
	ok, prog, err := a.TryResubmitOnFailure(context.Background(), ch, task, "timeout")
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if ok || prog != "" {
		t.Fatalf("expected no resubmit, got ok=%v prog=%q", ok, prog)
	}
	if hit {
		t.Fatal("RetryCount=2 must not hit HTTP")
	}
	if task.PrivateData.RetryCount != 2 {
		t.Fatalf("RetryCount should stay 2, got %d", task.PrivateData.RetryCount)
	}
	if task.PrivateData.UpstreamTaskID != "old" {
		t.Fatalf("UpstreamTaskID changed: %q", task.PrivateData.UpstreamTaskID)
	}
}

func TestTryResubmitOnFailure_SuccessUpdatesUpstreamTaskID(t *testing.T) {
	var gotAuth, gotBody string
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"task_id":"new1"}`))
	}))
	defer srv.Close()

	a := &TaskAdaptor{}
	ch := &model.Channel{Key: "channel-key", BaseURL: &srv.URL}
	task := &model.Task{
		Status:     model.TaskStatusFailure,
		FailReason: "timeout",
		FinishTime: 123,
		PrivateData: model.TaskPrivateData{
			Key:                   "task-key",
			RequestBody:           `{"model":"guanzhuan-seedance2.0"}`,
			UpstreamTaskID:        "old-id",
			RetryCount:            0,
			SameChannelMaxRetries: 3,
		},
	}

	ok, prog, err := a.TryResubmitOnFailure(context.Background(), ch, task, "timeout")
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if !ok {
		t.Fatal("expected resubmitted")
	}
	if prog != "retrying 1/3" {
		t.Fatalf("progress=%q", prog)
	}
	if task.PrivateData.UpstreamTaskID != "new1" {
		t.Fatalf("UpstreamTaskID=%q", task.PrivateData.UpstreamTaskID)
	}
	if task.PrivateData.RetryCount != 1 {
		t.Fatalf("RetryCount=%d", task.PrivateData.RetryCount)
	}
	if task.Status != model.TaskStatusQueued {
		t.Fatalf("Status=%q", task.Status)
	}
	if task.FailReason != "" || task.FinishTime != 0 {
		t.Fatalf("FailReason=%q FinishTime=%d", task.FailReason, task.FinishTime)
	}
	if gotAuth != "Bearer task-key" {
		t.Fatalf("Authorization=%q", gotAuth)
	}
	if gotBody != `{"model":"guanzhuan-seedance2.0"}` {
		t.Fatalf("body=%q", gotBody)
	}
	if !strings.HasSuffix(gotPath, createPath) {
		t.Fatalf("path=%q want suffix %q", gotPath, createPath)
	}
}
