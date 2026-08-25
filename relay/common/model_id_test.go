package common

import "testing"

func TestModelIDWithoutPublisher(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in   string
		want string
	}{
		{in: "gemini-3.7-flash", want: "gemini-3.7-flash"},
		{in: "google/gemini-3.7-flash", want: "gemini-3.7-flash"},
		{in: "models/gemini-3.7-flash", want: "gemini-3.7-flash"},
		{in: "publishers/google/models/gemini-3.7-flash", want: "gemini-3.7-flash"},
		{in: "anthropic/claude-sonnet-4", want: "claude-sonnet-4"},
		{in: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()
			if got := ModelIDWithoutPublisher(tt.in); got != tt.want {
				t.Fatalf("ModelIDWithoutPublisher(%q)=%q want %q", tt.in, got, tt.want)
			}
		})
	}
}
