package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestExtractBytePlusVideoURLUsesPersistedTaskData(t *testing.T) {
	task := &model.Task{
		Data: []byte(`{"status":"succeeded","content":{"video_url":"https://cdn.bytepluses.com/private.mp4"}}`),
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://flatkey.example/v1/videos/task_public/content",
		},
	}
	if got := extractBytePlusVideoURL(task); got != "https://cdn.bytepluses.com/private.mp4" {
		t.Fatalf("video URL = %q", got)
	}
}
