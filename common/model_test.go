package common

import "testing"

func TestIsImageGenerationModel_gptImage2(t *testing.T) {
	cases := map[string]bool{
		"gpt-image-2":                      true,
		"gpt-image-2-official":             true,
		"gpt-image-1":                      true,
		"gpt-image-1-mini":                 true,
		"gemini-3.1-flash-image-preview":   true,
		"gemini-2.5-flash-image":           true,
		"claude-sonnet-4-6":                false,
		"gpt-5.4":                          false,
	}
	for model, want := range cases {
		if got := IsImageGenerationModel(model); got != want {
			t.Fatalf("IsImageGenerationModel(%q) = %v, want %v", model, got, want)
		}
	}
}

func TestUsesAsyncImageTaskUpstream(t *testing.T) {
	if !UsesAsyncImageTaskUpstream("gpt-image-2") {
		t.Fatal("expected gpt-image-2 to use async upstream")
	}
	if !UsesAsyncImageTaskUpstream("gpt-image-2-official") {
		t.Fatal("expected gpt-image-2-official to use async upstream")
	}
	if UsesAsyncImageTaskUpstream("gpt-image-1") {
		t.Fatal("gpt-image-1 should not use gpt-image-2 async upstream")
	}
	if !UsesAsyncImageTaskUpstream("gemini-3.1-flash-image-preview") {
		t.Fatal("expected gemini-3.1-flash-image-preview to use async upstream")
	}
	if UsesAsyncImageTaskUpstream("gemini-3.1-flash-lite") {
		t.Fatal("text flash-lite models should not use image async upstream")
	}
}
