package governorlab

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMockHandlerReturnsChatCompletion(t *testing.T) {
	handler := NewMockHandler(MockConfig{
		Delay:        0,
		ResponseText: "mock-ok",
		Models:       []string{"gpt-4o-mini"},
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":false}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("expected valid JSON response, got error: %v", err)
	}

	if payload.Model != "gpt-4o-mini" {
		t.Fatalf("expected echoed model, got %q", payload.Model)
	}
	if len(payload.Choices) != 1 {
		t.Fatalf("expected one choice, got %d", len(payload.Choices))
	}
	if payload.Choices[0].Message.Content != "mock-ok" {
		t.Fatalf("expected response text mock-ok, got %q", payload.Choices[0].Message.Content)
	}
	if payload.Choices[0].FinishReason != "stop" {
		t.Fatalf("expected finish reason stop, got %q", payload.Choices[0].FinishReason)
	}
	if payload.Usage.TotalTokens <= 0 || payload.Usage.PromptTokens <= 0 || payload.Usage.CompletionTokens <= 0 {
		t.Fatalf("expected positive usage values, got %+v", payload.Usage)
	}
}

func TestMockHandlerReturnsModelList(t *testing.T) {
	handler := NewMockHandler(MockConfig{
		Delay:  0,
		Models: []string{"gpt-4o-mini", "gpt-4.1-mini"},
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("expected valid JSON response, got error: %v", err)
	}

	if len(payload.Data) != 2 {
		t.Fatalf("expected two models, got %d", len(payload.Data))
	}
	if payload.Data[0].ID != "gpt-4o-mini" || payload.Data[1].ID != "gpt-4.1-mini" {
		t.Fatalf("unexpected model list: %+v", payload.Data)
	}
}

func TestMockHandlerStreamsMinimalSSE(t *testing.T) {
	handler := NewMockHandler(MockConfig{
		Delay:        0,
		ResponseText: "stream-ok",
		Models:       []string{"gpt-4o-mini"},
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":true}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()

	started := time.Now()
	handler.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("expected SSE content type, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "stream-ok") {
		t.Fatalf("expected streamed content in body, got %q", body)
	}
	if !strings.Contains(body, "[DONE]") {
		t.Fatalf("expected [DONE] marker in stream body, got %q", body)
	}
	if time.Since(started) < 0 {
		t.Fatalf("unexpected negative duration")
	}
}
