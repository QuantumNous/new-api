package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestApplyTaskInfoToRelayTaskDoesNotRegressAsyncVideoStatus(t *testing.T) {
	task := &model.Task{
		Status:    model.TaskStatusInProgress,
		Progress:  "30%",
		StartTime: 123,
	}

	applyTaskInfoToRelayTask(task, &relaycommon.TaskInfo{
		Status:   string(model.TaskStatusSubmitted),
		Progress: "0%",
	}, 456)

	assert.EqualValues(t, model.TaskStatusInProgress, task.Status)
	assert.Equal(t, "30%", task.Progress)
	assert.EqualValues(t, 123, task.StartTime)
}

func TestApplyTaskInfoToRelayTaskAllowsForwardProgressionToSuccess(t *testing.T) {
	task := &model.Task{
		Status:    model.TaskStatusInProgress,
		Progress:  "45%",
		StartTime: 123,
	}

	applyTaskInfoToRelayTask(task, &relaycommon.TaskInfo{
		Status:   string(model.TaskStatusSuccess),
		Progress: "100%",
		Url:      "https://example.com/video.mp4",
	}, 789)

	assert.EqualValues(t, model.TaskStatusSuccess, task.Status)
	assert.Equal(t, "100%", task.Progress)
	assert.EqualValues(t, 789, task.FinishTime)
	assert.Equal(t, "https://example.com/video.mp4", task.PrivateData.ResultURL)
}
