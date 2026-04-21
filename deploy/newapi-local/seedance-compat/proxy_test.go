package main

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateTaskProxy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/video/generations" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatalf("unexpected auth header: %q", r.Header.Get("Authorization"))
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if !strings.Contains(string(body), `"seconds":"5"`) {
			t.Fatalf("expected seconds in upstream body: %s", string(body))
		}
		if !strings.Contains(string(body), `"camera_movement":"pan_left"`) {
			t.Fatalf("expected unknown field passthrough in upstream body: %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"task_123","task_id":"task_123","object":"video","model":"doubao-seedance-2-0-260128","status":"queued","created_at":1776323511,"metadata":{"url":"https://example.com/video.mp4"}}`))
	}))
	defer upstream.Close()

	server := newServer(Config{NewAPIBaseURL: upstream.URL})
	req := httptest.NewRequest(http.MethodPost, "/api/v3/contents/generations/tasks", bytes.NewBufferString(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"A panda drinking coffee in a neon cafe"}],
		"duration":5,
		"camera_movement":"pan_left"
	}`))
	req.Header.Set("Authorization", "Bearer test-key")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"id":"task_123"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"video_url":"https://example.com/video.mp4"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}

func TestGetTaskProxy(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/video/generations/task_123" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"task_123","task_id":"task_123","object":"video","model":"doubao-seedance-2-0-260128","status":"completed","progress":100,"created_at":1776323511,"completed_at":1776323522,"metadata":{"url":"https://example.com/video.mp4"}}`))
	}))
	defer upstream.Close()

	server := newServer(Config{NewAPIBaseURL: upstream.URL})
	req := httptest.NewRequest(http.MethodGet, "/api/v3/contents/generations/tasks/task_123", nil)
	req.Header.Set("Authorization", "Bearer test-key")
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"id":"task_123"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"status":"succeeded"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), `"content":{"video_url":"https://example.com/video.mp4"}`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}
