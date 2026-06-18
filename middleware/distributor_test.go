package middleware

import "testing"

func TestAutoGroupForRequestPathRoutesChatCompletions(t *testing.T) {
	got, changed := autoGroupForRequestPath("auto", "/v1/chat/completions")

	if got != "codex-completions" {
		t.Fatalf("expected codex-completions, got %q", got)
	}
	if !changed {
		t.Fatal("expected chat completions path to change auto group")
	}
}

func TestAutoGroupForRequestPathKeepsResponsesAuto(t *testing.T) {
	got, changed := autoGroupForRequestPath("auto", "/v1/responses")

	if got != "auto" {
		t.Fatalf("expected auto, got %q", got)
	}
	if changed {
		t.Fatal("expected responses path to keep auto group")
	}
}

func TestAutoGroupForRequestPathKeepsExplicitGroup(t *testing.T) {
	got, changed := autoGroupForRequestPath("codex", "/v1/chat/completions")

	if got != "codex" {
		t.Fatalf("expected explicit group, got %q", got)
	}
	if changed {
		t.Fatal("expected explicit group to stay unchanged")
	}
}
