package common

import "testing"

func TestStartupURL(t *testing.T) {
	original := AppBasePath
	t.Cleanup(func() {
		AppBasePath = original
	})

	tests := []struct {
		name     string
		basePath string
		want     string
	}{
		{
			name:     "without base path",
			basePath: "",
			want:     "http://localhost:3000/",
		},
		{
			name:     "with base path",
			basePath: "/app",
			want:     "http://localhost:3000/app/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			AppBasePath = tt.basePath

			if got := startupURL("localhost", "3000"); got != tt.want {
				t.Fatalf("startupURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
