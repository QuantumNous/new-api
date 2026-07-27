package relay

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSeedanceTaskIDFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodGet,
		"/seedance/api/v3/contents/generations/tasks?filter.task_ids=cgt-a,cgt-b&filter.task_ids=task_c&filter.task_ids[]=cgt-d",
		nil,
	)

	require.Equal(t, []string{"cgt-a", "cgt-b", "task_c", "cgt-d"}, seedanceTaskIDFilters(ctx))
}

func TestSeedanceTaskResponseUsesUpstreamShape(t *testing.T) {
	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		SubmitTime: 1710000000,
		UpdatedAt:  1710000100,
		Properties: model.Properties{
			OriginModelName: "doubao-seedance-1-5-pro",
		},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "cgt-upstream",
			ResultURL:      "https://example.com/video.mp4",
		},
		Data: json.RawMessage(`{"id":"cgt-upstream","status":"running","content":{},"service_tier":"default"}`),
	}

	resp := seedanceTaskResponse(task)
	assert.Equal(t, "cgt-upstream", resp["id"])
	assert.Equal(t, "doubao-seedance-1-5-pro", resp["model"])
	assert.Equal(t, "succeeded", resp["status"])
	assert.Equal(t, int64(1710000000), resp["created_at"])
	assert.Equal(t, int64(1710000100), resp["updated_at"])

	content, ok := resp["content"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "https://example.com/video.mp4", content["video_url"])
}
