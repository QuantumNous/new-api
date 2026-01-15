package common

import "testing"

func TestResolveMultiEndpointRequestURL_PlainURL(t *testing.T) {
	got, err := ResolveMultiEndpointRequestURL("https://example.com/v1/chat/completions", "/v1/chat/completions", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://example.com/v1/chat/completions" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_JSONByPath(t *testing.T) {
	raw := `{
		"openai": "https://oai.example.com/v1/chat/completions",
		"openai_responses": "https://resp.example.com/v1/responses"
	}`

	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/chat/completions", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://oai.example.com/v1/chat/completions" {
		t.Fatalf("unexpected request url: %q", got)
	}

	got, err = ResolveMultiEndpointRequestURL(raw, "/v1/responses", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://resp.example.com/v1/responses" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_FallbackDefault(t *testing.T) {
	raw := `{"default":"https://default.example.com{path}"}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/responses", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://default.example.com/v1/responses" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_StrictRequiresPathMatchOrTemplate(t *testing.T) {
	raw := `{
		"openai_responses": "https://resp.example.com"
	}`
	_, err := ResolveMultiEndpointRequestURL(raw, "/v1/responses", "gpt-4o-mini")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	raw = `{
		"openai_responses": "https://resp.example.com{path}"
	}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/responses", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://resp.example.com/v1/responses" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_Images(t *testing.T) {
	raw := `{
		"openai_image": "https://img.example.com{path}"
	}`

	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/images/edits", "gpt-image-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://img.example.com/v1/images/edits" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_KeyCanonicalization(t *testing.T) {
	raw := `{"openai-response":"https://resp.example.com/v1/responses","openai":"https://oai.example.com/v1/chat/completions"}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/responses", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://resp.example.com/v1/responses" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_ModelTemplate(t *testing.T) {
	raw := `{"openai":"https://example.com/v1/chat/completions?model={model}"}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/chat/completions", "gpt-4o-mini")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://example.com/v1/chat/completions?model=gpt-4o-mini" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_RealtimeSchemeAndQuery(t *testing.T) {
	raw := `{"openai_realtime":"wss://example.com{path}{query}"}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/realtime?model=gpt-4o-realtime-preview", "gpt-4o-realtime-preview")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "wss://example.com/v1/realtime?model=gpt-4o-realtime-preview" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_OpenAIPathMismatch(t *testing.T) {
	raw := `{"openai":"https://oai.example.com/v1/chat/completions"}`
	_, err := ResolveMultiEndpointRequestURL(raw, "/v1/completions", "gpt-3.5-turbo")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	raw = `{"openai":"https://oai.example.com{path}"}`
	got, err := ResolveMultiEndpointRequestURL(raw, "/v1/completions", "gpt-3.5-turbo")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "https://oai.example.com/v1/completions" {
		t.Fatalf("unexpected request url: %q", got)
	}
}

func TestResolveMultiEndpointRequestURL_InvalidJSON(t *testing.T) {
	_, err := ResolveMultiEndpointRequestURL("{", "/v1/chat/completions", "gpt-4o-mini")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}
