package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsPublicTaskIDAcceptsOnlyLocallyGeneratedFormat(t *testing.T) {
	t.Parallel()

	assert.True(t, IsPublicTaskID("task_0123456789abcdefghijklmnopqrstuv"))
	assert.True(t, IsPublicTaskID(GenerateTaskID()))
	assert.False(t, IsPublicTaskID("upstream-task-id"))
	assert.False(t, IsPublicTaskID("task_short"))
	assert.False(t, IsPublicTaskID("task_0123456789abcdefghijklmnopqrstu-"))
}
