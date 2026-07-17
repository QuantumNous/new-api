package model

import (
	"bytes"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPersistImageTaskArtifactChunksAndRestoresExactOutput(t *testing.T) {
	truncateTables(t)
	task := &Task{
		TaskID:     "task_image_artifact",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusInProgress,
		Attempt:    2,
		Progress:   "10%",
		SubmitTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(task).Error)

	artifact := bytes.Repeat([]byte("artifact-data"), 100000)
	checkpoint := []byte(`{"request":{"prompt":"cat"},"artifact_stored":true}`)
	persisted, err := PersistImageTaskArtifact(task, checkpoint, artifact, "70%")
	require.NoError(t, err)
	require.True(t, persisted)

	var chunkCount int64
	require.NoError(t, DB.Model(&ImageTaskArtifactChunk{}).Where("task_id = ?", task.TaskID).Count(&chunkCount).Error)
	assert.Greater(t, chunkCount, int64(1))
	restored, err := LoadImageTaskArtifact(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, artifact, restored)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.JSONEq(t, string(checkpoint), string(stored.CheckpointData))
	assert.Equal(t, "70%", stored.Progress)

	stale := *task
	stale.Attempt--
	persisted, err = PersistImageTaskArtifact(&stale, checkpoint, []byte("stale"), "70%")
	require.NoError(t, err)
	assert.False(t, persisted)
	restored, err = LoadImageTaskArtifact(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, artifact, restored)
}

func TestLoadImageTaskArtifactRejectsMissingChunk(t *testing.T) {
	truncateTables(t)
	for _, chunk := range []ImageTaskArtifactChunk{
		{TaskID: "task_image_artifact_incomplete", ChunkIndex: 0, ChunkCount: 2, TotalSize: 6, Data: []byte("abc")},
		{TaskID: "task_image_artifact_incomplete", ChunkIndex: 2, ChunkCount: 2, TotalSize: 6, Data: []byte("def")},
	} {
		require.NoError(t, DB.Create(&chunk).Error)
	}
	_, err := LoadImageTaskArtifact("task_image_artifact_incomplete")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "incomplete")
}
