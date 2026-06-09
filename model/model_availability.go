package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	ModelAvailabilityAvailable           = "available"
	ModelAvailabilityTemporaryFailure    = "temporary_failure"
	ModelAvailabilityOfficialUnsupported = "official_unsupported"
	ModelAvailabilityUnknownFailure      = "unknown_failure"
)

type ModelAvailabilityState struct {
	ModelName           string `json:"model_name" gorm:"primaryKey;type:varchar(255);autoIncrement:false"`
	Status              string `json:"availability_status" gorm:"type:varchar(32);index;default:available"`
	ReasonType          string `json:"availability_reason_type,omitempty" gorm:"type:varchar(64);index"`
	Reason              string `json:"availability_reason,omitempty" gorm:"type:text"`
	LastError           string `json:"availability_last_error,omitempty" gorm:"type:text"`
	FirstDetectedAt     int64  `json:"availability_detected_at,omitempty" gorm:"bigint;index"`
	LastCheckedAt       int64  `json:"availability_checked_at,omitempty" gorm:"bigint;index"`
	LastSuccessAt       int64  `json:"availability_last_success_at,omitempty" gorm:"bigint"`
	ConsecutiveFailures int    `json:"availability_consecutive_failures" gorm:"default:0"`
	CreatedTime         int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime         int64  `json:"updated_time" gorm:"bigint"`
}

type ModelAvailabilityProbeTarget struct {
	ModelName   string
	ChannelID   int
	ChannelType int
	ChannelName string
}

func (s *ModelAvailabilityState) normalize(now int64) {
	s.ModelName = strings.TrimSpace(s.ModelName)
	s.Status = strings.TrimSpace(s.Status)
	if s.Status == "" {
		s.Status = ModelAvailabilityAvailable
	}
	if s.CreatedTime == 0 {
		s.CreatedTime = now
	}
	s.UpdatedTime = now
}

func SaveModelAvailabilityState(next *ModelAvailabilityState) error {
	if next == nil || strings.TrimSpace(next.ModelName) == "" {
		return nil
	}
	now := common.GetTimestamp()
	next.normalize(now)

	var existing ModelAvailabilityState
	err := DB.First(&existing, "model_name = ?", next.ModelName).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return DB.Create(next).Error
	}

	if next.FirstDetectedAt == 0 {
		next.FirstDetectedAt = existing.FirstDetectedAt
	}
	next.CreatedTime = existing.CreatedTime
	return DB.Model(&ModelAvailabilityState{}).
		Where("model_name = ?", next.ModelName).
		Select(
			"status",
			"reason_type",
			"reason",
			"last_error",
			"first_detected_at",
			"last_checked_at",
			"last_success_at",
			"consecutive_failures",
			"updated_time",
		).
		Updates(next).Error
}

func GetModelAvailabilityState(modelName string) (*ModelAvailabilityState, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, nil
	}
	var state ModelAvailabilityState
	if err := DB.First(&state, "model_name = ?", modelName).Error; err != nil {
		if isModelAvailabilityTableMissingError(err) {
			return nil, nil
		}
		return nil, err
	}
	return &state, nil
}

func GetModelAvailabilityStateMap(modelNames []string) (map[string]ModelAvailabilityState, error) {
	result := make(map[string]ModelAvailabilityState)
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}
	var states []ModelAvailabilityState
	if err := DB.Where("model_name IN ?", modelNames).Find(&states).Error; err != nil {
		if isModelAvailabilityTableMissingError(err) {
			return result, nil
		}
		return nil, err
	}
	for _, state := range states {
		result[state.ModelName] = state
	}
	return result, nil
}

func IsModelOfficiallyUnsupported(modelName string) (bool, *ModelAvailabilityState) {
	state, err := GetModelAvailabilityState(modelName)
	if err != nil || state == nil {
		return false, nil
	}
	return state.Status == ModelAvailabilityOfficialUnsupported, state
}

func GetModelAvailabilityProbeModelNames() ([]string, error) {
	var models []string
	err := DB.Table("abilities").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Distinct("abilities.model").
		Order("abilities.model ASC").
		Pluck("abilities.model", &models).Error
	return models, err
}

func GetModelAvailabilityProbeTargets(modelName string) ([]ModelAvailabilityProbeTarget, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, nil
	}

	var targets []ModelAvailabilityProbeTarget
	err := DB.Table("abilities").
		Select("abilities.model as model_name, channels.id as channel_id, channels.type as channel_type, channels.name as channel_name").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.model = ? AND abilities.enabled = ? AND channels.status = ?", modelName, true, common.ChannelStatusEnabled).
		Order("COALESCE(abilities.priority, 0) DESC").
		Order("abilities.weight DESC").
		Order("channels.id ASC").
		Scan(&targets).Error
	if err != nil {
		return nil, err
	}

	seen := make(map[int]struct{}, len(targets))
	deduped := make([]ModelAvailabilityProbeTarget, 0, len(targets))
	for _, target := range targets {
		if _, ok := seen[target.ChannelID]; ok {
			continue
		}
		seen[target.ChannelID] = struct{}{}
		deduped = append(deduped, target)
	}
	return deduped, nil
}

func isModelAvailabilityTableMissingError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "no such table") ||
		strings.Contains(lower, "doesn't exist") ||
		strings.Contains(lower, "undefined_table") ||
		strings.Contains(lower, "sqlstate 42p01") ||
		strings.Contains(lower, "error 1146")
}
