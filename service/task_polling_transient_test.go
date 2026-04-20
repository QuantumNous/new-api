package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestIsTransientVideoNotFoundResponse(t *testing.T) {
	oldGraceMinutes := constant.TaskNotFoundGraceMinutes
	constant.TaskNotFoundGraceMinutes = 10
	defer func() {
		constant.TaskNotFoundGraceMinutes = oldGraceMinutes
	}()

	now := int64(1000)

	tests := []struct {
		name       string
		statusCode int
		body       []byte
		submitTime int64
		models     []string
		want       bool
	}{
		{
			name:       "upstream result not ready",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"Not Found"}`),
			submitTime: now - 9*60,
			want:       true,
		},
		{
			name:       "upstream result not ready at grace boundary",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"Not Found"}`),
			submitTime: now - 10*60,
			want:       true,
		},
		{
			name:       "upstream result not found after grace expires",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"Not Found"}`),
			submitTime: now - 11*60,
			want:       false,
		},
		{
			name:       "video generation missing is terminal for unlisted model",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 1*60,
			models:     []string{"grok-imagine-1.0-video"},
			want:       false,
		},
		{
			name:       "sora video generation missing is transient inside grace",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 9*60,
			models:     []string{"sora2"},
			want:       true,
		},
		{
			name:       "sora video generation missing is transient at grace boundary",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 10*60,
			models:     []string{"sora-2"},
			want:       true,
		},
		{
			name:       "sora video generation missing is terminal after grace expires",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 11*60,
			models:     []string{"sora2"},
			want:       false,
		},
		{
			name:       "veo video generation missing is transient inside grace",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 9*60,
			models:     []string{"veo31-fast"},
			want:       true,
		},
		{
			name:       "veo path model video generation missing is transient inside grace",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 9*60,
			models:     []string{"publishers/google/models/veo-3.0-generate-001"},
			want:       true,
		},
		{
			name:       "veo video generation missing is terminal after grace expires",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"video generation not found"}`),
			submitTime: now - 11*60,
			models:     []string{"veo-3.1-generate-preview"},
			want:       false,
		},
		{
			name:       "task missing is terminal",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"message":"task not found"}`),
			submitTime: now - 1*60,
			want:       false,
		},
		{
			name:       "non not found 404",
			statusCode: http.StatusNotFound,
			body:       []byte(`{"detail":"permission denied"}`),
			submitTime: now - 1*60,
			want:       false,
		},
		{
			name:       "not found body without 404",
			statusCode: http.StatusOK,
			body:       []byte(`{"detail":"Not Found"}`),
			submitTime: now - 1*60,
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTransientVideoNotFoundResponse(tt.statusCode, tt.body, tt.submitTime, now, tt.models...); got != tt.want {
				t.Fatalf("isTransientVideoNotFoundResponse() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsTransientVideoNotFoundResponseWithZeroGrace(t *testing.T) {
	oldGraceMinutes := constant.TaskNotFoundGraceMinutes
	constant.TaskNotFoundGraceMinutes = 0
	defer func() {
		constant.TaskNotFoundGraceMinutes = oldGraceMinutes
	}()

	if got := isTransientVideoNotFoundResponse(http.StatusNotFound, []byte(`{"detail":"Not Found"}`), 100, 101); got {
		t.Fatalf("isTransientVideoNotFoundResponse() = %v, want false", got)
	}
}
