package service

import (
	"net/http"
	"testing"
)

func TestIsTransientVideoNotFoundResponse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		statusCode int
		body       []byte
		want       bool
	}{
		{
			name:       "upstream result not ready",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"Not Found"}`),
			want:       true,
		},
		{
			name:       "non not found 404",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"permission denied"}`),
			want:       false,
		},
		{
			name:       "not found body without 404",
			statusCode: http.StatusOK,
			body:       []byte(`{"detail":"Not Found"}`),
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := isTransientVideoNotFoundResponse(tt.statusCode, tt.body); got != tt.want {
				t.Fatalf("isTransientVideoNotFoundResponse() = %v, want %v", got, tt.want)
			}
		})
	}
}
