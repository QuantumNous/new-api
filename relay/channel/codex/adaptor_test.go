package codex

import (
	"strings"
	"testing"
)

func TestExtractCompletedResponseFromSSE_OpenAIStyle(t *testing.T) {
	sse := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hi"}`,
		`data: {"type":"response.completed","response":{"id":"resp_1","object":"response","created_at":0,"status":"completed","model":"gpt-5.2"}}`,
		`data: [DONE]`,
		``,
	}, "\n")

	got, err := extractCompletedResponseFromSSE(strings.NewReader(sse))
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	want := `{"id":"resp_1","object":"response","created_at":0,"status":"completed","model":"gpt-5.2"}`
	if strings.TrimSpace(string(got)) != want {
		t.Fatalf("unexpected response\nwant: %s\ngot:  %s", want, strings.TrimSpace(string(got)))
	}
}

func TestExtractCompletedResponseFromSSE_EventLineStyle(t *testing.T) {
	sse := strings.Join([]string{
		`event: response.completed`,
		`data: {"id":"resp_2","object":"response","created_at":0,"status":"completed","model":"gpt-5.2"}`,
		``,
	}, "\n")

	got, err := extractCompletedResponseFromSSE(strings.NewReader(sse))
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	want := `{"id":"resp_2","object":"response","created_at":0,"status":"completed","model":"gpt-5.2"}`
	if strings.TrimSpace(string(got)) != want {
		t.Fatalf("unexpected response\nwant: %s\ngot:  %s", want, strings.TrimSpace(string(got)))
	}
}

func TestExtractCompletedResponseFromSSE_JSONFallback(t *testing.T) {
	body := `{"id":"resp_json","object":"response","status":"completed"}`
	got, err := extractCompletedResponseFromSSE(strings.NewReader(body))
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if strings.TrimSpace(string(got)) != body {
		t.Fatalf("unexpected response\nwant: %s\ngot:  %s", body, strings.TrimSpace(string(got)))
	}
}
