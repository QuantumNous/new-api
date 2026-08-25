package common

import (
	"net/http/httptest"
	"testing"
)

func TestCustomEventWritesUTF8EventStreamContentType(t *testing.T) {
	recorder := httptest.NewRecorder()

	CustomEvent{Data: "data: 你好"}.WriteContentType(recorder)

	if got := recorder.Header().Get("Content-Type"); got != "text/event-stream; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want %q", got, "text/event-stream; charset=utf-8")
	}
}
