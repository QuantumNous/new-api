package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestBuildVolcNativeTaskResponseReplacesUpstreamTaskID(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public_id",
		Data:   []byte(`{"id":"upstream-task-id","status":"running","watermark":false}`),
	}

	body := buildVolcNativeTaskResponse(task)

	require.Equal(t, "task_public_id", gjson.GetBytes(body, "id").String())
	require.NotContains(t, string(body), "upstream-task-id")
	require.Equal(t, false, gjson.GetBytes(body, "watermark").Bool())
}

func TestBuildVolcNativeTaskResponseSynthesizesPendingTask(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public_id",
		Status: model.TaskStatusQueued,
		Properties: model.Properties{
			OriginModelName: "doubao-seedance-2-0-260128",
		},
	}

	body := buildVolcNativeTaskResponse(task)

	require.Equal(t, "task_public_id", gjson.GetBytes(body, "id").String())
	require.Equal(t, "doubao-seedance-2-0-260128", gjson.GetBytes(body, "model").String())
	require.Equal(t, "queued", gjson.GetBytes(body, "status").String())
}
