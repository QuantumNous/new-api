package model_setting

import "testing"

func TestIsGeminiModelSupportImagine(t *testing.T) {
	for _, model := range []string{
		"gemini-2.0-flash-exp-image-generation",
		"gemini-3-pro-image-preview",
		"gemini-3.1-flash-image-preview",
		"nano-banana-pro-preview",
		"nano-banana-2",
	} {
		if !IsGeminiModelSupportImagine(model) {
			t.Fatalf("IsGeminiModelSupportImagine(%q) = false, want true", model)
		}
	}

	if IsGeminiModelSupportImagine("gemini-2.5-flash") {
		t.Fatal("IsGeminiModelSupportImagine(gemini-2.5-flash) = true, want false")
	}
}
