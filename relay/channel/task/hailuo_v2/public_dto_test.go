package hailuov2_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	hailuov2 "github.com/QuantumNous/new-api/relay/channel/task/hailuo_v2"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTaskModel2DtoCannotExposeH3UpstreamTaskID(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		OriginModelName: hailuov2.ModelName,
	}
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-secret","status":"queued"}`))}

	upstreamID, taskData, taskErr := (&hailuov2.TaskAdaptor{}).DoResponse(c, resp, info)
	require.Nil(t, taskErr)
	require.Equal(t, "upstream-secret", upstreamID)

	task := &model.Task{
		TaskID:   "task_public",
		Platform: constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeMiniMaxH3)),
		Status:   model.TaskStatusQueued,
		Data:     taskData,
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: upstreamID,
		},
	}
	publicBody, err := common.Marshal(relay.TaskModel2Dto(task))
	require.NoError(t, err)
	require.NotContains(t, string(publicBody), "upstream-secret")
	require.Contains(t, string(publicBody), "task_public")
}
