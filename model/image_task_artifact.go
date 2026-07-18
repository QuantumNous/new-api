package model

import (
	"bytes"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

const (
	imageTaskArtifactChunkBytes = 512 << 10
	// Generic providers may return up to 40 MiB of decoded image bytes as
	// base64, which expands by roughly 4/3 before it can be checkpointed.
	maxImageTaskArtifactBytes = 64 << 20
	// AES-GCM adds a nonce and authentication tag before base64 encoding, so
	// encrypted chunks can be roughly one third larger than their plaintext.
	maxImageTaskArtifactStoredBytes = maxImageTaskArtifactBytes + (maxImageTaskArtifactBytes+2)/3 + 64
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

// encryptImageTaskArtifactData keeps upstream responses and their checkpoint
// out of the database in plaintext. Checkpoints are JSON columns, so their
// ciphertext is wrapped as a JSON string; chunk payloads are binary columns
// and can store the encrypted string directly.
func encryptImageTaskArtifactData(data []byte, jsonColumn bool) ([]byte, error) {
	encrypted, err := common.EncryptString(string(data))
	if err != nil {
		return nil, fmt.Errorf("encrypt image task artifact: %w", err)
	}
	if !jsonColumn {
		return []byte(encrypted), nil
	}
	encoded, err := common.Marshal(encrypted)
	if err != nil {
		return nil, fmt.Errorf("encode encrypted image task checkpoint: %w", err)
	}
	return encoded, nil
}

// EncryptImageTaskArtifactCheckpoint encrypts a task checkpoint before the
// task becomes visible to background workers.
func EncryptImageTaskArtifactCheckpoint(checkpointData []byte) ([]byte, error) {
	if len(checkpointData) == 0 {
		return nil, errors.New("image task checkpoint is empty")
	}
	if !common.AsyncImageEncryptedWritesEnabled() {
		return append([]byte(nil), checkpointData...), nil
	}
	return encryptImageTaskArtifactData(checkpointData, true)
}

// DecryptImageTaskArtifactCheckpoint restores checkpoint data written by
// the async image pipeline. Existing checkpoints were plaintext JSON, so they
// remain readable during the reader-first deployment phase.
func DecryptImageTaskArtifactCheckpoint(checkpointData []byte) ([]byte, error) {
	return decryptImageTaskArtifactData(checkpointData, true)
}

func decryptImageTaskArtifactData(data []byte, jsonColumn bool) ([]byte, error) {
	if len(data) == 0 {
		return nil, errors.New("image task artifact data is empty")
	}
	value := strings.TrimSpace(string(data))
	if jsonColumn {
		var encoded string
		if err := common.Unmarshal(data, &encoded); err == nil {
			value = encoded
		}
	}
	if !strings.HasPrefix(value, "enc:v1:") {
		return append([]byte(nil), data...), nil
	}
	plaintext, err := common.DecryptString(value)
	if err != nil {
		return nil, fmt.Errorf("decrypt image task artifact: %w", err)
	}
	return []byte(plaintext), nil
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
	storedCheckpoint, err := EncryptImageTaskArtifactCheckpoint(checkpointData)
	if err != nil {
		return false, err
	}

	chunkCount := (len(artifact) + imageTaskArtifactChunkBytes - 1) / imageTaskArtifactChunkBytes
	now := common.GetTimestamp()
	persisted := false
	err = DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Task{}).
			Where(
				"id = ? AND platform = ? AND status IN ? AND attempt = ?",
				task.ID,
				constant.TaskPlatformOpenAIImage,
				[]TaskStatus{TaskStatusInProgress, TaskStatusCheckpointPending},
				task.Attempt,
			).
			Updates(map[string]any{
				"status":               TaskStatusInProgress,
				"checkpoint_data":      storedCheckpoint,
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
			chunkData := append([]byte(nil), artifact[offset:end]...)
			if common.AsyncImageEncryptedWritesEnabled() {
				chunkData, err = common.EncryptBytes(chunkData)
				if err != nil {
					return fmt.Errorf("encrypt image task artifact chunk %d: %w", chunkIndex, err)
				}
			}
			chunk := &ImageTaskArtifactChunk{
				TaskID:     task.TaskID,
				ChunkIndex: chunkIndex,
				ChunkCount: chunkCount,
				TotalSize:  len(artifact),
				Data:       chunkData,
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
	task.CheckpointData = append(task.CheckpointData[:0], storedCheckpoint...)
	task.Status = TaskStatusInProgress
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
	if expectedChunks <= 0 || expectedChunks != len(chunks) || expectedSize <= 0 {
		return nil, errors.New("image task artifact manifest is invalid")
	}

	// Reader compatibility for the short-lived whole-artifact ciphertext format
	// written before per-chunk encryption was introduced.
	if bytes.HasPrefix(chunks[0].Data, []byte("enc:v1:")) {
		if expectedSize > maxImageTaskArtifactStoredBytes {
			return nil, errors.New("image task artifact stored manifest is invalid")
		}
		storedArtifact := make([]byte, 0, expectedSize)
		for chunkIndex, chunk := range chunks {
			if chunk.ChunkIndex != chunkIndex || chunk.ChunkCount != expectedChunks || chunk.TotalSize != expectedSize {
				return nil, errors.New("image task artifact chunks are incomplete")
			}
			if len(storedArtifact)+len(chunk.Data) > maxImageTaskArtifactStoredBytes {
				return nil, errors.New("image task artifact exceeds its stored size limit")
			}
			storedArtifact = append(storedArtifact, chunk.Data...)
		}
		artifact, err := decryptImageTaskArtifactData(storedArtifact, false)
		if err != nil {
			return nil, err
		}
		if len(storedArtifact) != expectedSize || len(artifact) > maxImageTaskArtifactBytes {
			return nil, errors.New("image task artifact size does not match its stored manifest")
		}
		return artifact, nil
	}
	if expectedSize > maxImageTaskArtifactBytes {
		return nil, errors.New("image task artifact manifest is invalid")
	}

	artifact := make([]byte, 0, expectedSize)
	for chunkIndex, chunk := range chunks {
		if chunk.ChunkIndex != chunkIndex || chunk.ChunkCount != expectedChunks || chunk.TotalSize != expectedSize {
			return nil, errors.New("image task artifact chunks are incomplete")
		}
		if len(chunk.Data) > imageTaskArtifactChunkBytes+128 {
			return nil, errors.New("image task artifact chunk is too large")
		}
		chunkData, err := common.DecryptBytes(chunk.Data)
		if err != nil {
			return nil, fmt.Errorf("decrypt image task artifact chunk %d: %w", chunkIndex, err)
		}
		if len(artifact)+len(chunkData) > expectedSize {
			return nil, errors.New("image task artifact exceeds its manifest size")
		}
		artifact = append(artifact, chunkData...)
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
