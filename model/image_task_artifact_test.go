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
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
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
	var chunks []ImageTaskArtifactChunk
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).Order("chunk_index asc").Find(&chunks).Error)
	require.Len(t, chunks, int(chunkCount))
	for _, chunk := range chunks {
		assert.True(t, bytes.HasPrefix(chunk.Data, []byte("encb:v1:")))
		assert.LessOrEqual(t, len(chunk.Data), imageTaskArtifactChunkBytes+128)
	}
	restored, err := LoadImageTaskArtifact(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, artifact, restored)

	var stored Task
	require.NoError(t, DB.First(&stored, task.ID).Error)
	assert.NotContains(t, string(stored.CheckpointData), "artifact-data")
	restoredCheckpoint, err := DecryptImageTaskArtifactCheckpoint(stored.CheckpointData)
	require.NoError(t, err)
	assert.JSONEq(t, string(checkpoint), string(restoredCheckpoint))
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

func TestPersistImageTaskArtifactEncryptsSignedURLAndRejectsDamagedCiphertext(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	task := &Task{
		TaskID:     "task_image_artifact_encrypted",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusInProgress,
		Attempt:    1,
		SubmitTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(task).Error)
	signedURL := "https://provider.example/image.png?X-Amz-Signature=signed-secret&token=bearer-secret"
	checkpoint := []byte(`{"upstream_url":"` + signedURL + `"}`)
	artifact := []byte(`{"data":[{"url":"` + signedURL + `"}]}`)
	persisted, err := PersistImageTaskArtifact(task, checkpoint, artifact, "70%")
	require.NoError(t, err)
	require.True(t, persisted)

	var storedTask Task
	require.NoError(t, DB.First(&storedTask, task.ID).Error)
	assert.NotContains(t, string(storedTask.CheckpointData), "signed-secret")
	var chunks []ImageTaskArtifactChunk
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).Order("chunk_index asc").Find(&chunks).Error)
	require.NotEmpty(t, chunks)
	for _, chunk := range chunks {
		assert.NotContains(t, string(chunk.Data), "signed-secret")
		assert.NotContains(t, string(chunk.Data), "bearer-secret")
	}

	restoredCheckpoint, err := DecryptImageTaskArtifactCheckpoint(storedTask.CheckpointData)
	require.NoError(t, err)
	assert.JSONEq(t, string(checkpoint), string(restoredCheckpoint))
	restoredArtifact, err := LoadImageTaskArtifact(task.TaskID)
	require.NoError(t, err)
	assert.JSONEq(t, string(artifact), string(restoredArtifact))

	corruptedChunk := append([]byte(nil), chunks[0].Data...)
	corruptedChunk[len(corruptedChunk)-1] ^= 1
	require.NoError(t, DB.Model(&ImageTaskArtifactChunk{}).Where("task_id = ? AND chunk_index = 0", task.TaskID).Update("data", corruptedChunk).Error)
	_, err = LoadImageTaskArtifact(task.TaskID)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "signed-secret")
	_, err = DecryptImageTaskArtifactCheckpoint([]byte(`"enc:v1:damaged"`))
	require.Error(t, err)
}

func TestImageTaskArtifactReadsLegacyPlaintext(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	checkpoint := []byte(`{"request":{"prompt":"legacy"}}`)
	artifact := []byte(`{"data":[{"b64_json":"legacy"}]}`)
	require.NoError(t, DB.Create(&ImageTaskArtifactChunk{
		TaskID:     "task_image_artifact_legacy",
		ChunkIndex: 0,
		ChunkCount: 1,
		TotalSize:  len(artifact),
		Data:       artifact,
	}).Error)

	restoredCheckpoint, err := DecryptImageTaskArtifactCheckpoint(checkpoint)
	require.NoError(t, err)
	assert.Equal(t, checkpoint, restoredCheckpoint)
	restoredArtifact, err := LoadImageTaskArtifact("task_image_artifact_legacy")
	require.NoError(t, err)
	assert.Equal(t, artifact, restoredArtifact)
}

func TestImageTaskArtifactReadsWholeArtifactCiphertextFormat(t *testing.T) {
	truncateTables(t)
	artifact := bytes.Repeat([]byte("whole-artifact-ciphertext"), 30000)
	storedArtifact, err := encryptImageTaskArtifactData(artifact, false)
	require.NoError(t, err)
	chunkCount := (len(storedArtifact) + imageTaskArtifactChunkBytes - 1) / imageTaskArtifactChunkBytes
	for chunkIndex, offset := 0, 0; offset < len(storedArtifact); chunkIndex, offset = chunkIndex+1, offset+imageTaskArtifactChunkBytes {
		end := min(offset+imageTaskArtifactChunkBytes, len(storedArtifact))
		require.NoError(t, DB.Create(&ImageTaskArtifactChunk{
			TaskID:     "task_image_artifact_whole_ciphertext",
			ChunkIndex: chunkIndex,
			ChunkCount: chunkCount,
			TotalSize:  len(storedArtifact),
			Data:       append([]byte(nil), storedArtifact[offset:end]...),
		}).Error)
	}

	restored, err := LoadImageTaskArtifact("task_image_artifact_whole_ciphertext")
	require.NoError(t, err)
	assert.Equal(t, artifact, restored)
}

func TestPersistImageTaskArtifactReaderFirstModeWritesLegacyFormat(t *testing.T) {
	truncateTables(t)
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "false")
	task := &Task{
		TaskID:     "task_image_artifact_reader_first",
		Platform:   constant.TaskPlatformOpenAIImage,
		Status:     TaskStatusInProgress,
		Attempt:    1,
		SubmitTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(task).Error)
	checkpoint := []byte(`{"request":{"prompt":"legacy-compatible"}}`)
	artifact := bytes.Repeat([]byte("legacy-compatible-artifact"), 30000)

	persisted, err := PersistImageTaskArtifact(task, checkpoint, artifact, "70%")
	require.NoError(t, err)
	require.True(t, persisted)
	assert.Equal(t, checkpoint, []byte(task.CheckpointData))
	var chunks []ImageTaskArtifactChunk
	require.NoError(t, DB.Where("task_id = ?", task.TaskID).Order("chunk_index asc").Find(&chunks).Error)
	require.Greater(t, len(chunks), 1)
	joined := make([]byte, 0, len(artifact))
	for _, chunk := range chunks {
		joined = append(joined, chunk.Data...)
	}
	assert.Equal(t, artifact, joined)
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
