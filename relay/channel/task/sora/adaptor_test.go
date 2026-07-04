package sora

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseTaskResultFailedWithStringError(t *testing.T) {
	adaptor := &TaskAdaptor{}

	taskInfo, err := adaptor.ParseTaskResult([]byte(`{
		"id": "task_upstream",
		"status": "failed",
		"error": "safety system rejected this request"
	}`))

	require.NoError(t, err)
	require.NotNil(t, taskInfo)
	assert.Equal(t, model.TaskStatusFailure, taskInfo.Status)
	assert.Equal(t, "safety system rejected this request", taskInfo.Reason)
}

func TestParseTaskResultFailedWithObjectError(t *testing.T) {
	adaptor := &TaskAdaptor{}

	taskInfo, err := adaptor.ParseTaskResult([]byte(`{
		"id": "task_upstream",
		"status": "failed",
		"error": {"message": "invalid prompt", "code": "invalid_request"}
	}`))

	require.NoError(t, err)
	require.NotNil(t, taskInfo)
	assert.Equal(t, model.TaskStatusFailure, taskInfo.Status)
	assert.Equal(t, "invalid prompt", taskInfo.Reason)
}

func TestParseTaskResultErrorWithoutStatus(t *testing.T) {
	adaptor := &TaskAdaptor{}

	taskInfo, err := adaptor.ParseTaskResult([]byte(`{
		"code": "Client specified an invalid argument",
		"error": "Generated video rejected by content moderation.",
		"id": "task_upstream",
		"task_id": "task_upstream",
		"model": "grok-image-video"
	}`))

	require.NoError(t, err)
	require.NotNil(t, taskInfo)
	assert.Equal(t, model.TaskStatusFailure, taskInfo.Status)
	assert.Equal(t, "Generated video rejected by content moderation.", taskInfo.Reason)
}
