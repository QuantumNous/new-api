package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestShouldRefreshAsyncVideoTask(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		task *model.Task
		want bool
	}{
		{
			name: "nil task",
			task: nil,
			want: false,
		},
		{
			name: "terminal success task does not refresh",
			task: &model.Task{
				Status:    model.TaskStatusSuccess,
				ChannelId: 1,
				PrivateData: model.TaskPrivateData{
					UpstreamTaskID: "upstream-task",
				},
			},
			want: false,
		},
		{
			name: "missing channel does not refresh",
			task: &model.Task{
				Status: model.TaskStatusInProgress,
				PrivateData: model.TaskPrivateData{
					UpstreamTaskID: "upstream-task",
				},
			},
			want: false,
		},
		{
			name: "missing upstream id does not refresh",
			task: &model.Task{
				Status:    model.TaskStatusInProgress,
				ChannelId: 1,
			},
			want: false,
		},
		{
			name: "in progress task with upstream id refreshes",
			task: &model.Task{
				Status:    model.TaskStatusInProgress,
				ChannelId: 1,
				PrivateData: model.TaskPrivateData{
					UpstreamTaskID: "upstream-task",
				},
			},
			want: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := shouldRefreshAsyncVideoTask(tt.task); got != tt.want {
				t.Fatalf("shouldRefreshAsyncVideoTask() = %v, want %v", got, tt.want)
			}
		})
	}
}
