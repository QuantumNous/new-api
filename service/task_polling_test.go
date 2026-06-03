package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildTaskFetchBodyUsesUpstreamTaskAndModelContext(t *testing.T) {
	task := &model.Task{
		TaskID: "task_public",
		Action: "generate",
		Properties: model.Properties{
			UpstreamModelName:  "jimeng_v30_pro",
			OriginModelName:    "jimeng_v30_pro",
			UpstreamRequestKey: "jimeng_ti2v_v30_pro",
		},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream_task",
		},
	}

	body := BuildTaskFetchBody(task)

	require.Equal(t, "upstream_task", body["task_id"])
	require.Equal(t, "generate", body["action"])
	require.Equal(t, "jimeng_v30_pro", body["upstream_model_name"])
	require.Equal(t, "jimeng_v30_pro", body["origin_model_name"])
	require.Equal(t, "jimeng_ti2v_v30_pro", body["upstream_request_key"])
}
