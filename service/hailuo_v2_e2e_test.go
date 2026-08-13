package service_test

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/hailuo"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpdateVideoTasksV2EndToEnd 覆盖审核评论的核心场景：渠道模型映射别名
// （h3 -> MiniMax-H3）提交的任务，轮询必须携带正确的模型名并打到 V2 查询端点，
// 任务完成后状态与结果 URL 正确落库。
func TestUpdateVideoTasksV2EndToEnd(t *testing.T) {
	tests := []struct {
		name       string
		properties model.Properties
	}{
		{"mapped alias uses upstream model name", model.Properties{OriginModelName: "h3", UpstreamModelName: "MiniMax-H3"}},
		{"legacy task falls back to origin model name", model.Properties{OriginModelName: "MiniMax-H3"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			model.DB.Exec("DELETE FROM tasks")
			model.DB.Exec("DELETE FROM channels")
			t.Cleanup(func() {
				model.DB.Exec("DELETE FROM tasks")
				model.DB.Exec("DELETE FROM channels")
			})

			const upstreamID = "upstream_001"
			var mu sync.Mutex
			var queryPaths []string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				queryPaths = append(queryPaths, r.URL.Path)
				mu.Unlock()
				if !strings.HasPrefix(r.URL.Path, hailuo.QueryTaskV2Endpoint+"/") {
					http.NotFound(w, r)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"task":{"id":"`+upstreamID+`","status":"succeeded","content":{"url":"https://cdn.example.com/h3.mp4"}}}`)
			}))
			defer srv.Close()

			ch := &model.Channel{
				Type:   constant.ChannelTypeMiniMax,
				Name:   "minimax-h3-e2e",
				Key:    "sk-test",
				Status: common.ChannelStatusEnabled,
			}
			ch.BaseURL = common.GetPointer(srv.URL)
			require.NoError(t, model.DB.Create(ch).Error)

			task := &model.Task{
				TaskID:     "task_public_1",
				Platform:   constant.TaskPlatform("35"),
				UserId:     1,
				ChannelId:  ch.Id,
				Action:     constant.TaskActionGenerate,
				Status:     model.TaskStatusInProgress,
				Progress:   "30%",
				Properties: tt.properties,
				PrivateData: model.TaskPrivateData{
					UpstreamTaskID: upstreamID,
				},
			}
			require.NoError(t, model.DB.Create(task).Error)

			previousFactory := service.GetTaskAdaptorFunc
			service.GetTaskAdaptorFunc = func(constant.TaskPlatform) service.TaskPollingAdaptor { return &hailuo.TaskAdaptor{} }
			t.Cleanup(func() { service.GetTaskAdaptorFunc = previousFactory })

			err := service.UpdateVideoTasks(context.Background(), constant.TaskPlatform("35"), map[int][]string{
				ch.Id: {upstreamID},
			}, map[string]*model.Task{task.GetUpstreamTaskID(): task})
			require.NoError(t, err)

			mu.Lock()
			require.Equal(t, []string{hailuo.QueryTaskV2Endpoint + "/" + upstreamID}, queryPaths)
			mu.Unlock()

			var updated model.Task
			require.NoError(t, model.DB.First(&updated, task.ID).Error)
			assert.Equal(t, string(model.TaskStatusSuccess), string(updated.Status))
			assert.Equal(t, "https://cdn.example.com/h3.mp4", updated.PrivateData.ResultURL)
		})
	}
}
