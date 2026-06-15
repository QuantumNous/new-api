package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CodexModelGovernanceProbeState struct {
	ModelName           string `json:"model_name" gorm:"primaryKey;type:varchar(255);autoIncrement:false"`
	ChannelID           int    `json:"channel_id" gorm:"primaryKey;autoIncrement:false"`
	ConsecutiveFailures int    `json:"consecutive_failures" gorm:"not null;default:0"`
	LastFailedAt        int64  `json:"last_failed_at" gorm:"bigint;not null;default:0"`
	LastHealthyAt       int64  `json:"last_healthy_at" gorm:"bigint;not null;default:0"`
	CreatedTime         int64  `json:"created_time" gorm:"bigint;not null;default:0"`
	UpdatedTime         int64  `json:"updated_time" gorm:"bigint;not null;default:0"`
}

func RecordCodexModelGovernanceProbeUnsupportedFailure(modelName string, channelID int, threshold int) (int, bool, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || channelID <= 0 {
		return 0, false, nil
	}
	if threshold < 1 {
		threshold = 1
	}
	if DB == nil {
		return 0, false, errors.New("database is not initialized")
	}

	count := 0
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		var state CodexModelGovernanceProbeState
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&state, "model_name = ? AND channel_id = ?", modelName, channelID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			state = CodexModelGovernanceProbeState{
				ModelName:           modelName,
				ChannelID:           channelID,
				ConsecutiveFailures: 1,
				LastFailedAt:        now,
				CreatedTime:         now,
				UpdatedTime:         now,
			}
			if err := tx.Create(&state).Error; err != nil {
				return err
			}
			count = state.ConsecutiveFailures
			return nil
		}
		if err != nil {
			return err
		}

		count = state.ConsecutiveFailures + 1
		if count > threshold {
			count = threshold
		}
		return tx.Model(&CodexModelGovernanceProbeState{}).
			Where("model_name = ? AND channel_id = ?", modelName, channelID).
			Updates(map[string]any{
				"consecutive_failures": count,
				"last_failed_at":       now,
				"updated_time":         now,
			}).Error
	})
	if err != nil {
		if isModelAvailabilityTableMissingError(err) {
			return 0, false, err
		}
		return 0, false, err
	}
	return count, count >= threshold, nil
}

func ResetCodexModelGovernanceProbeFailure(modelName string, channelID int) error {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" || channelID <= 0 || DB == nil {
		return nil
	}
	return DB.Where("model_name = ? AND channel_id = ?", modelName, channelID).
		Delete(&CodexModelGovernanceProbeState{}).Error
}
