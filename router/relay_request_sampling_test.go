package router

import "testing"

func TestIsGeminiTextGenerationPath(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{path: "/v1beta/models/gemini-2.5-pro:generateContent", want: true},
		{path: "/v1beta/models/gemini-2.5-pro:streamGenerateContent", want: true},
		{path: "/v1beta/models/gemini-2.5-pro:embedContent", want: false},
		{path: "/v1beta/models/gemini-2.5-pro:batchEmbedContents", want: false},
		{path: "/v1beta/models/gemini-2.5-pro:countTokens", want: false},
		{path: "/v1beta/models/gemini-2.5-pro:predict", want: false},
		{path: "/v1/models/gemini-2.5-pro:generateContent", want: true},
		{path: "/v1/models/gemini-2.5-pro:streamGenerateContent", want: true},
		{path: "/v1/models/gemini-2.5-pro:embedContent", want: false},
	}

	for _, tt := range tests {
		if got := isGeminiTextGenerationPath(tt.path); got != tt.want {
			t.Fatalf("isGeminiTextGenerationPath(%q) = %v, want %v", tt.path, got, tt.want)
		}
	}
}
