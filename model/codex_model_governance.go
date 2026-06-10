package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
)

const (
	CodexModelGovernanceStatusActive                   = "active"
	CodexModelGovernanceStatusUnsupportedPendingReview = "unsupported_pending_review"
	CodexModelGovernanceStatusRemoved                  = "removed"
	CodexModelGovernanceStatusIgnored                  = "ignored"

	CodexModelGovernanceSourceProbe               = "probe"
	CodexModelGovernanceSourceOfficialCodexNotice = "official_codex_notice"
	CodexModelGovernanceSourceManual              = "manual"
)

type CodexModelGovernanceRecord struct {
	ID                 int    `json:"id" gorm:"primaryKey"`
	ModelName          string `json:"model_name" gorm:"type:varchar(255);uniqueIndex;not null"`
	Status             string `json:"status" gorm:"type:varchar(32);index;not null"`
	Source             string `json:"source" gorm:"type:varchar(64);index;not null"`
	MatchedRule        string `json:"matched_rule" gorm:"type:varchar(255)"`
	LastError          string `json:"last_error" gorm:"type:text"`
	AffectedChannelIDs string `json:"affected_channel_ids" gorm:"type:text"`
	DetectedAt         int64  `json:"detected_at" gorm:"bigint;index"`
	LastCheckedAt      int64  `json:"last_checked_at" gorm:"bigint;index"`
	ReviewedAt         int64  `json:"reviewed_at" gorm:"bigint"`
	ReviewedBy         int    `json:"reviewed_by" gorm:"index;default:0"`
	ReviewNote         string `json:"review_note" gorm:"type:text"`
	CreatedTime        int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64  `json:"updated_time" gorm:"bigint"`
}

type CodexModelGovernancePendingInput struct {
	ModelName          string
	Source             string
	MatchedRule        string
	LastError          string
	AffectedChannelIDs []int
	LastCheckedAt      int64
}

func encodeCodexModelGovernanceChannelIDs(channelIDs []int) string {
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	parts := make([]string, 0, len(channelIDs))
	for _, id := range channelIDs {
		parts = append(parts, strconv.Itoa(id))
	}
	return strings.Join(parts, ",")
}

func decodeCodexModelGovernanceChannelIDs(encoded string) []int {
	if strings.TrimSpace(encoded) == "" {
		return nil
	}
	parts := strings.Split(encoded, ",")
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		id, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return normalizeCodexModelGovernanceChannelIDs(ids)
}

func normalizeCodexModelGovernanceChannelIDs(channelIDs []int) []int {
	seen := make(map[int]struct{}, len(channelIDs))
	normalized := make([]int, 0, len(channelIDs))
	for _, id := range channelIDs {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized
}

func UpsertCodexModelGovernancePending(input CodexModelGovernancePendingInput) (*CodexModelGovernanceRecord, error) {
	modelName := strings.TrimSpace(input.ModelName)
	if modelName == "" {
		return nil, errors.New("model name is required")
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = CodexModelGovernanceSourceProbe
	}
	now := common.GetTimestamp()
	lastCheckedAt := input.LastCheckedAt
	if lastCheckedAt == 0 {
		lastCheckedAt = now
	}
	affectedChannelIDs := normalizeCodexModelGovernanceChannelIDs(input.AffectedChannelIDs)
	if len(affectedChannelIDs) == 0 {
		var err error
		affectedChannelIDs, err = FindAffectedCodexChannelIDs(modelName)
		if err != nil {
			return nil, err
		}
	}

	var record CodexModelGovernanceRecord
	err := DB.First(&record, "model_name = ?", modelName).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		record = CodexModelGovernanceRecord{
			ModelName:          modelName,
			Status:             CodexModelGovernanceStatusUnsupportedPendingReview,
			Source:             source,
			MatchedRule:        strings.TrimSpace(input.MatchedRule),
			LastError:          strings.TrimSpace(input.LastError),
			AffectedChannelIDs: encodeCodexModelGovernanceChannelIDs(affectedChannelIDs),
			DetectedAt:         now,
			LastCheckedAt:      lastCheckedAt,
			CreatedTime:        now,
			UpdatedTime:        now,
		}
		if err := DB.Create(&record).Error; err != nil {
			return nil, err
		}
	} else {
		if record.DetectedAt == 0 {
			record.DetectedAt = now
		}
		updates := map[string]any{
			"status":               CodexModelGovernanceStatusUnsupportedPendingReview,
			"source":               source,
			"matched_rule":         strings.TrimSpace(input.MatchedRule),
			"last_error":           strings.TrimSpace(input.LastError),
			"affected_channel_ids": encodeCodexModelGovernanceChannelIDs(affectedChannelIDs),
			"detected_at":          record.DetectedAt,
			"last_checked_at":      lastCheckedAt,
			"updated_time":         now,
		}
		if err := DB.Model(&CodexModelGovernanceRecord{}).Where("id = ?", record.ID).Updates(updates).Error; err != nil {
			return nil, err
		}
		if err := DB.First(&record, "id = ?", record.ID).Error; err != nil {
			return nil, err
		}
	}

	if err := DisableCodexModelAbilities(modelName, affectedChannelIDs); err != nil {
		return &record, err
	}
	return &record, nil
}

func ListCodexModelGovernanceRecords(status string) ([]CodexModelGovernanceRecord, error) {
	var records []CodexModelGovernanceRecord
	query := DB.Model(&CodexModelGovernanceRecord{})
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	err := query.Order("updated_time DESC").Order("id DESC").Find(&records).Error
	return records, err
}

func GetCodexModelGovernanceRecord(id int) (*CodexModelGovernanceRecord, error) {
	if id <= 0 {
		return nil, gorm.ErrRecordNotFound
	}
	var record CodexModelGovernanceRecord
	if err := DB.First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func FindAffectedCodexChannelIDs(modelName string) ([]int, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, nil
	}
	var channels []Channel
	if err := DB.Model(&Channel{}).
		Where("type = ?", constant.ChannelTypeCodex).
		Find(&channels).Error; err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(channels))
	for _, channel := range channels {
		if codexGovernanceChannelHasModel(channel.Models, modelName) {
			ids = append(ids, channel.Id)
		}
	}
	return normalizeCodexModelGovernanceChannelIDs(ids), nil
}

func DisableCodexModelAbilities(modelName string, channelIDs []int) error {
	return setCodexModelAbilityEnabled(modelName, channelIDs, false)
}

func RestoreCodexModelAbilities(modelName string, channelIDs []int) error {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return errors.New("model name is required")
	}
	codexChannelIDs, err := filterCodexChannelIDsWithModel(modelName, channelIDs)
	if err != nil {
		return err
	}
	if len(codexChannelIDs) == 0 {
		return nil
	}
	if err := DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, codexChannelIDs).
		Select("enabled").
		Update("enabled", true).Error; err != nil {
		return err
	}
	publishChannelsChanged()
	return nil
}

func RemoveCodexModelFromChannels(modelName string, channelIDs []int) error {
	modelName = strings.TrimSpace(modelName)
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if modelName == "" {
		return errors.New("model name is required")
	}
	if len(channelIDs) == 0 {
		return nil
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var channels []Channel
	if err := tx.Where("id IN ? AND type = ?", channelIDs, constant.ChannelTypeCodex).Find(&channels).Error; err != nil {
		tx.Rollback()
		return err
	}
	for _, channel := range channels {
		nextModels, changed := removeCodexGovernanceModel(channel.Models, modelName)
		if !changed {
			continue
		}
		channel.Models = nextModels
		if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("models", nextModels).Error; err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Where("channel_id = ?", channel.Id).Delete(&Ability{}).Error; err != nil {
			tx.Rollback()
			return err
		}
		if strings.TrimSpace(channel.Models) != "" {
			if err := channel.AddAbilities(tx); err != nil {
				tx.Rollback()
				return err
			}
		}
	}
	if err := tx.Commit().Error; err != nil {
		return err
	}
	publishChannelsChanged()
	return nil
}

func ReviewCodexModelGovernanceRecord(id int, status string, reviewerID int, note string) error {
	record, err := GetCodexModelGovernanceRecord(id)
	if err != nil {
		return err
	}
	nextStatus := strings.TrimSpace(status)
	channelIDs := decodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs)
	switch nextStatus {
	case CodexModelGovernanceStatusActive:
		if err := RestoreCodexModelAbilities(record.ModelName, channelIDs); err != nil {
			return err
		}
	case CodexModelGovernanceStatusRemoved:
		if err := RemoveCodexModelFromChannels(record.ModelName, channelIDs); err != nil {
			return err
		}
	case CodexModelGovernanceStatusIgnored:
	case CodexModelGovernanceStatusUnsupportedPendingReview:
		if err := DisableCodexModelAbilities(record.ModelName, channelIDs); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported codex model governance status: %s", status)
	}

	now := common.GetTimestamp()
	return DB.Model(&CodexModelGovernanceRecord{}).Where("id = ?", id).Updates(map[string]any{
		"status":       nextStatus,
		"reviewed_at":  now,
		"reviewed_by":  reviewerID,
		"review_note":  strings.TrimSpace(note),
		"updated_time": now,
	}).Error
}

func setCodexModelAbilityEnabled(modelName string, channelIDs []int, enabled bool) error {
	modelName = strings.TrimSpace(modelName)
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if modelName == "" {
		return errors.New("model name is required")
	}
	if len(channelIDs) == 0 {
		return nil
	}
	codexChannelIDs, err := filterCodexChannelIDs(channelIDs)
	if err != nil {
		return err
	}
	if len(codexChannelIDs) == 0 {
		return nil
	}
	if err := DB.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, codexChannelIDs).
		Select("enabled").
		Update("enabled", enabled).Error; err != nil {
		return err
	}
	publishChannelsChanged()
	return nil
}

func filterCodexChannelIDs(channelIDs []int) ([]int, error) {
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if len(channelIDs) == 0 {
		return nil, nil
	}
	var channels []Channel
	if err := DB.Model(&Channel{}).
		Where("id IN ? AND type = ?", channelIDs, constant.ChannelTypeCodex).
		Find(&channels).Error; err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(channels))
	for _, channel := range channels {
		ids = append(ids, channel.Id)
	}
	return normalizeCodexModelGovernanceChannelIDs(ids), nil
}

func filterCodexChannelIDsWithModel(modelName string, channelIDs []int) ([]int, error) {
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if len(channelIDs) == 0 {
		return nil, nil
	}
	var channels []Channel
	if err := DB.Model(&Channel{}).
		Where("id IN ? AND type = ?", channelIDs, constant.ChannelTypeCodex).
		Find(&channels).Error; err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(channels))
	for _, channel := range channels {
		if codexGovernanceChannelHasModel(channel.Models, modelName) {
			ids = append(ids, channel.Id)
		}
	}
	return normalizeCodexModelGovernanceChannelIDs(ids), nil
}

func codexGovernanceChannelHasModel(models string, modelName string) bool {
	for _, model := range splitCodexGovernanceModels(models) {
		if model == modelName {
			return true
		}
	}
	return false
}

func removeCodexGovernanceModel(models string, modelName string) (string, bool) {
	existing := splitCodexGovernanceModels(models)
	next := make([]string, 0, len(existing))
	removed := false
	for _, model := range existing {
		if model == modelName {
			removed = true
			continue
		}
		next = append(next, model)
	}
	return strings.Join(next, ","), removed
}

func splitCodexGovernanceModels(models string) []string {
	if strings.TrimSpace(models) == "" {
		return nil
	}
	parts := strings.Split(models, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		model := strings.TrimSpace(part)
		if model == "" {
			continue
		}
		result = append(result, model)
	}
	return result
}
