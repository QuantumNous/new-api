package model

import (
	"time"

	"github.com/google/uuid"
)

// An upscale lease can be retried without repeating the paid image generation.
type ImageUpscaleJob struct {
	ID           string `json:"id" gorm:"type:varchar(36);primaryKey"`
	Status       string `json:"status" gorm:"type:varchar(24);index"`
	Target       int    `json:"target"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	OutputFormat string `json:"output_format" gorm:"type:varchar(12)"`
	Lease        string `json:"lease,omitempty" gorm:"type:varchar(36)"`
	LeaseUntil   int64  `json:"-"`
	CreatedAt    int64  `json:"-"`
	ClaimedAtMs  int64  `json:"-"`
	FinishedAtMs int64  `json:"-"`
	ComputeMs    int64  `json:"-"`
	EncodeMs     int64  `json:"-"`
	UploadMs     int64  `json:"-"`
	ResultBytes  int64  `json:"-"`
	ExpiresAt    int64  `json:"-" gorm:"index"`
}

func ClaimImageUpscaleJob(now int64) (*ImageUpscaleJob, error) {
	var job ImageUpscaleJob
	err := DB.Where("expires_at > ? AND (status = ? OR (status = ? AND lease_until < ?))", now, "queued", "running", now).Order("created_at ASC").Limit(1).Find(&job).Error
	if err != nil {
		return nil, err
	}
	if job.ID == "" {
		return nil, nil
	}
	lease := uuid.NewString()
	claimedAtMs := time.Now().UnixMilli()
	result := DB.Model(&ImageUpscaleJob{}).Where("id = ? AND expires_at > ? AND (status = ? OR (status = ? AND lease_until < ?))", job.ID, now, "queued", "running", now).Updates(map[string]any{"status": "running", "lease": lease, "lease_until": now + 900, "claimed_at_ms": claimedAtMs})
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	job.Status, job.Lease, job.LeaseUntil, job.ClaimedAtMs = "running", lease, now+900, claimedAtMs
	return &job, nil
}
