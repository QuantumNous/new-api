package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

const (
	imageTaskArtifactChunkBytes = 512 << 10
	// Generic providers may return up to 40 MiB of decoded image bytes as
	// base64, which expands by roughly 4/3 before it can be checkpointed.
	maxImageTaskArtifactBytes = 64 << 20
)

var ErrImageTaskArtifactTooLarge = errors.New("image task artifact is too large")

// ImageTaskArtifactChunk is a bounded, temporary spool for generated output.
// Chunking keeps every SQL statement below common MySQL packet limits.
type ImageTaskArtifactChunk struct {
	ID         int64  `gorm:"primaryKey"`
	TaskID     string `gorm:"type:varchar(191);uniqueIndex:idx_image_artifact_chunk,priority:1;index"`
	ChunkIndex int    `gorm:"uniqueIndex:idx_image_artifact_chunk,priority:2"`
	ChunkCount int
	TotalSize  int
	Data       []byte
	CreatedAt  int64 `gorm:"index"`
}

func PersistImageTaskArtifact(task *Task, checkpointData []byte, artifact []byte, progress string) (bool, error) {
	if task == nil || task.ID == 0 || task.TaskID == "" {
		return false, errors.New("persisted image task is required")
	}
	if len(checkpointData) == 0 || len(artifact) == 0 {
		return false, errors.New("image task checkpoint and artifact are required")
	}
	if len(artifact) > maxImageTaskArtifactBytes {
		return false, fmt.Errorf("%w: %d bytes", ErrImageTaskArtifactTooLarge, len(artifact))
	}

	chunkCount := (len(artifact) + imageTaskArtifactChunkBytes - 1) / imageTaskArtifactChunkBytes
	now := common.GetTimestamp()
	persisted := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Task{}).
			Where(
				"id = ? AND platform = ? AND status = ? AND attempt = ?",
				task.ID,
				constant.TaskPlatformOpenAIImage,
				TaskStatusInProgress,
				task.Attempt,
			).
			Updates(map[string]any{
				"checkpoint_data":      checkpointData,
				"progress":             progress,
				"worker_attempts":      0,
				"worker_next_retry_at": 0,
				"worker_error":         "",
				"updated_at":           now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}

		if err := tx.Where("task_id = ?", task.TaskID).Delete(&ImageTaskArtifactChunk{}).Error; err != nil {
			return err
		}
		for chunkIndex, offset := 0, 0; offset < len(artifact); chunkIndex, offset = chunkIndex+1, offset+imageTaskArtifactChunkBytes {
			end := offset + imageTaskArtifactChunkBytes
			if end > len(artifact) {
				end = len(artifact)
			}
			chunk := &ImageTaskArtifactChunk{
				TaskID:     task.TaskID,
				ChunkIndex: chunkIndex,
				ChunkCount: chunkCount,
				TotalSize:  len(artifact),
				Data:       append([]byte(nil), artifact[offset:end]...),
				CreatedAt:  now,
			}
			if err := tx.Create(chunk).Error; err != nil {
				return err
			}
		}
		persisted = true
		return nil
	})
	if err != nil || !persisted {
		return persisted, err
	}
	task.CheckpointData = append(task.CheckpointData[:0], checkpointData...)
	task.Progress = progress
	task.WorkerAttempts = 0
	task.WorkerNextRetryAt = 0
	task.WorkerError = ""
	task.UpdatedAt = now
	return true, nil
}

func LoadImageTaskArtifact(taskID string) ([]byte, error) {
	if taskID == "" {
		return nil, errors.New("image task id is required")
	}
	var chunks []ImageTaskArtifactChunk
	if err := DB.Select("chunk_index", "chunk_count", "total_size", "data").
		Where("task_id = ?", taskID).
		Order("chunk_index asc").
		Find(&chunks).Error; err != nil {
		return nil, err
	}
	if len(chunks) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	expectedChunks := chunks[0].ChunkCount
	expectedSize := chunks[0].TotalSize
	if expectedChunks <= 0 || expectedChunks != len(chunks) || expectedSize <= 0 || expectedSize > maxImageTaskArtifactBytes {
		return nil, errors.New("image task artifact manifest is invalid")
	}

	artifact := make([]byte, 0, expectedSize)
	for chunkIndex, chunk := range chunks {
		if chunk.ChunkIndex != chunkIndex || chunk.ChunkCount != expectedChunks || chunk.TotalSize != expectedSize {
			return nil, errors.New("image task artifact chunks are incomplete")
		}
		if len(artifact)+len(chunk.Data) > expectedSize {
			return nil, errors.New("image task artifact exceeds its manifest size")
		}
		artifact = append(artifact, chunk.Data...)
	}
	if len(artifact) != expectedSize {
		return nil, errors.New("image task artifact size does not match its manifest")
	}
	return artifact, nil
}

func deleteImageTaskArtifactTx(tx *gorm.DB, taskID string) error {
	if taskID == "" {
		return nil
	}
	return tx.Where("task_id = ?", taskID).Delete(&ImageTaskArtifactChunk{}).Error
}
