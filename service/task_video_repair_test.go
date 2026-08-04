package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestNeedsUpstreamVideoURLRefresh(t *testing.T) {
	t.Parallel()

	taskID := "task_myLRRiVFca1QUou1UOUEldleMUtDa6KG"
	proxyURL := "http://39.106.85.47:3018/v1/videos/" + taskID + "/content"

	tests := []struct {
		name string
		task *model.Task
		want bool
	}{
		{
			name: "proxy-only result url",
			task: &model.Task{
				TaskID:      taskID,
				PrivateData: model.TaskPrivateData{ResultURL: proxyURL},
				Data:        []byte(`{"upstream_response":{"content":{"video_url":""}}}`),
			},
			want: true,
		},
		{
			name: "direct upstream url",
			task: &model.Task{
				TaskID: taskID,
				PrivateData: model.TaskPrivateData{
					ResultURL: "https://ark-aigc-cn-beijing.tos-s3-cn-beijing.volces.com/demo.mp4",
				},
			},
			want: false,
		},
		{
			name: "empty result url",
			task: &model.Task{
				TaskID: taskID,
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := NeedsUpstreamVideoURLRefresh(tt.task); got != tt.want {
				t.Fatalf("NeedsUpstreamVideoURLRefresh() = %v, want %v", got, tt.want)
			}
		})
	}
}
