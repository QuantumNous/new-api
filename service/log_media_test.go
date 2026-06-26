package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildVideoRequestDataFromTask_BillingContext(t *testing.T) {
	t.Parallel()

	task := &model.Task{
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "sora-2",
				OtherRatios: map[string]float64{
					"seconds": 8,
					"size":    1,
				},
			},
		},
		Data: []byte(`{"code":200,"data":{"status":"completed"}}`),
	}

	data := buildVideoRequestDataFromTask(task)
	require.Equal(t, "sora-2", data["model"])
	require.Equal(t, "8", data["seconds"])
	require.Equal(t, "1", data["size"])
}

func TestBuildVideoRequestDataFromTask_SkipsNilFields(t *testing.T) {
	t.Parallel()

	task := &model.Task{
		Data: []byte(`{"model":null,"seconds":null,"size":null}`),
	}
	require.Nil(t, buildVideoRequestDataFromTask(task))
}

func TestFmtTaskIDNil(t *testing.T) {
	t.Parallel()
	require.Equal(t, "", fmtTaskID(nil))
}
