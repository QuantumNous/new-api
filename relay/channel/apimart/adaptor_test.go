package apimart

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

func TestConvertImageRequest(t *testing.T) {
	a := &Adaptor{}
	n := uint(1)
	req := dto.ImageRequest{Model: "gpt-image-2", Prompt: "a blue cube", N: &n, Size: "1024x1024"}
	out, err := a.ConvertImageRequest(nil, nil, req)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	b, _ := common.Marshal(out)
	var got SubmitRequest
	if err := common.Unmarshal(b, &got); err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if got.Model != "gpt-image-2" || got.Prompt != "a blue cube" || got.Size != "1024x1024" || got.N == nil || *got.N != 1 {
		t.Fatalf("bad mapping: %+v", got)
	}
}

func TestPollTaskCompletes(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			io.WriteString(w, `{"code":200,"data":{"status":"pending","progress":50}}`)
			return
		}
		io.WriteString(w, `{"code":200,"data":{"status":"completed","progress":100,"result":{"images":[{"url":["https://cdn/x.png"]}]}}}`)
	}))
	defer srv.Close()

	url, err := pollTask(context.Background(), srv.Client(), srv.URL, "k", "task_1", 10*time.Millisecond, 5*time.Second)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if url != "https://cdn/x.png" {
		t.Fatalf("got url %q", url)
	}
	if calls < 2 {
		t.Fatalf("expected at least 2 polls, got %d", calls)
	}
}

func TestPollTaskFails(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, `{"code":200,"data":{"status":"failed","error":"moderation"}}`)
	}))
	defer srv.Close()
	_, err := pollTask(context.Background(), srv.Client(), srv.URL, "k", "task_1", 10*time.Millisecond, 5*time.Second)
	if err == nil {
		t.Fatalf("expected error on failed status")
	}
}
