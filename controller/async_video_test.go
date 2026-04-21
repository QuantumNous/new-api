package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
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

func TestInitAsyncVideoTaskStoresClientRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name          string
		bodyRequestID string
		headerID      string
		want          string
	}{
		{
			name:          "body request id wins",
			bodyRequestID: "creative-request-body",
			headerID:      "creative-request-header",
			want:          "creative-request-body",
		},
		{
			name:     "header fallback",
			headerID: "creative-request-header",
			want:     "creative-request-header",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest("POST", "/v1/video/async-generations", nil)
			c.Set(common.RequestIdKey, "internal-request-id")
			if tt.headerID != "" {
				c.Request.Header.Set("X-Request-Id", tt.headerID)
			}

			task := initAsyncVideoTask(c, relaycommon.TaskSubmitReq{
				Model:     "sora2",
				Prompt:    "make a short video",
				RequestId: tt.bodyRequestID,
			})

			if got := task.PrivateData.ClientRequestId; got != tt.want {
				t.Fatalf("ClientRequestId = %q, want %q", got, tt.want)
			}
			if got := task.PrivateData.RequestId; got != "internal-request-id" {
				t.Fatalf("RequestId = %q, want internal request id", got)
			}
		})
	}
}
