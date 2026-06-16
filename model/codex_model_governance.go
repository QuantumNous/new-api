package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	CodexModelGovernanceStatusActive                   = "active"
	CodexModelGovernanceStatusUnsupportedPendingReview = "unsupported_pending_review"
	CodexModelGovernanceStatusUnsupportedDisabled      = "unsupported_disabled"
	CodexModelGovernanceStatusPendingReview            = CodexModelGovernanceStatusUnsupportedPendingReview
	CodexModelGovernanceStatusRemoved                  = "removed"
	CodexModelGovernanceStatusIgnored                  = "ignored"

	CodexModelGovernanceSourceProbe               = "probe"
	CodexModelGovernanceSourceOfficialCodexNotice = "official_codex_notice"
	CodexModelGovernanceSourceOfficialNotice      = CodexModelGovernanceSourceOfficialCodexNotice
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
	AbilitiesDisabled  bool   `json:"abilities_disabled" gorm:"default:false"`
	DetectedAt         int64  `json:"detected_at" gorm:"type:bigint;index"`
	LastCheckedAt      int64  `json:"last_checked_at" gorm:"type:bigint;index"`
	LastAlertedAt      int64  `json:"last_alerted_at" gorm:"type:bigint;index"`
	ReviewedAt         int64  `json:"reviewed_at" gorm:"type:bigint"`
	ReviewedBy         int    `json:"reviewed_by" gorm:"index;default:0"`
	ReviewNote         string `json:"review_note" gorm:"type:text"`
	CreatedTime        int64  `json:"created_time" gorm:"type:bigint"`
	UpdatedTime        int64  `json:"updated_time" gorm:"type:bigint"`
}

type CodexModelGovernancePendingInput struct {
	ModelName          string
	Source             string
	MatchedRule        string
	LastError          string
	AffectedChannelIDs []int
	LastCheckedAt      int64
	// DisableAbilities controls whether affected Codex abilities are disabled
	// when the record enters pending review. Probe findings carry first-hand
	// upstream error evidence and disable immediately; official notice and AI
	// findings only alert and wait for a human decision.
	DisableAbilities bool
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

func DecodeCodexModelGovernanceChannelIDs(encoded string) []int {
	return decodeCodexModelGovernanceChannelIDs(encoded)
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
	abilitiesChanged := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&record, "model_name = ?", modelName).Error
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			record = CodexModelGovernanceRecord{
				ModelName:          modelName,
				Status:             CodexModelGovernanceStatusUnsupportedPendingReview,
				Source:             source,
				MatchedRule:        strings.TrimSpace(input.MatchedRule),
				LastError:          strings.TrimSpace(input.LastError),
				AffectedChannelIDs: encodeCodexModelGovernanceChannelIDs(affectedChannelIDs),
				AbilitiesDisabled:  input.DisableAbilities,
				DetectedAt:         now,
				LastCheckedAt:      lastCheckedAt,
				CreatedTime:        now,
				UpdatedTime:        now,
			}
			if err := tx.Create(&record).Error; err != nil {
				return err
			}
		} else {
			if record.DetectedAt == 0 {
				record.DetectedAt = now
			}
			affectedChannelIDs = normalizeCodexModelGovernanceChannelIDs(
				append(decodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs), affectedChannelIDs...),
			)
			nextStatus := CodexModelGovernanceStatusUnsupportedPendingReview
			if record.Status == CodexModelGovernanceStatusUnsupportedDisabled {
				nextStatus = CodexModelGovernanceStatusUnsupportedDisabled
			} else if record.Status == CodexModelGovernanceStatusIgnored && !input.DisableAbilities {
				nextStatus = CodexModelGovernanceStatusIgnored
			}
			updates := map[string]any{
				"status":               nextStatus,
				"source":               source,
				"matched_rule":         strings.TrimSpace(input.MatchedRule),
				"last_error":           strings.TrimSpace(input.LastError),
				"affected_channel_ids": encodeCodexModelGovernanceChannelIDs(affectedChannelIDs),
				"detected_at":          record.DetectedAt,
				"last_checked_at":      lastCheckedAt,
				"updated_time":         now,
			}
			if nextStatus == CodexModelGovernanceStatusUnsupportedPendingReview && record.Status != CodexModelGovernanceStatusUnsupportedPendingReview {
				updates["reviewed_at"] = int64(0)
				updates["reviewed_by"] = 0
				updates["review_note"] = ""
			}
			// Never downgrade: once abilities were disabled (by a probe finding or
			// an operator), an alert-only finding must not flip the flag back.
			if input.DisableAbilities {
				updates["abilities_disabled"] = true
			}
			if err := tx.Model(&CodexModelGovernanceRecord{}).Where("id = ?", record.ID).Updates(updates).Error; err != nil {
				return err
			}
			if err := tx.First(&record, "id = ?", record.ID).Error; err != nil {
				return err
			}
		}

		if input.DisableAbilities {
			changed, err := setCodexModelAbilityEnabledWithDB(tx, modelName, affectedChannelIDs, false)
			if err != nil {
				return err
			}
			abilitiesChanged = abilitiesChanged || changed
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if abilitiesChanged {
		publishChannelsChanged()
	}
	return &record, nil
}

func MarkCodexModelGovernanceRecordAlerted(id int, alertedAt int64) error {
	if id <= 0 {
		return gorm.ErrRecordNotFound
	}
	if alertedAt == 0 {
		alertedAt = common.GetTimestamp()
	}
	return DB.Model(&CodexModelGovernanceRecord{}).
		Where("id = ?", id).
		Select("last_alerted_at").
		Update("last_alerted_at", alertedAt).Error
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

func GetCodexModelGovernanceRecordByModelName(modelName string) (*CodexModelGovernanceRecord, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var record CodexModelGovernanceRecord
	if err := DB.First(&record, "model_name = ?", modelName).Error; err != nil {
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
	changed, err := restoreCodexModelAbilitiesWithDB(DB, modelName, channelIDs)
	if err != nil {
		return err
	}
	if changed {
		publishChannelsChanged()
	}
	return nil
}

func restoreCodexModelAbilitiesWithDB(db *gorm.DB, modelName string, channelIDs []int) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return false, errors.New("model name is required")
	}
	codexChannelIDs, err := filterEnabledCodexChannelIDsWithModel(db, modelName, channelIDs)
	if err != nil {
		return false, err
	}
	if len(codexChannelIDs) == 0 {
		return false, nil
	}
	if err := db.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, codexChannelIDs).
		Select("enabled").
		Update("enabled", true).Error; err != nil {
		return false, err
	}
	return true, nil
}

func RemoveCodexModelFromChannels(modelName string, channelIDs []int) error {
	changed, err := removeCodexModelFromChannelsWithDB(DB, modelName, channelIDs)
	if err != nil {
		return err
	}
	if changed {
		publishChannelsChanged()
	}
	return nil
}

func removeCodexModelFromChannelsWithDB(db *gorm.DB, modelName string, channelIDs []int) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if modelName == "" {
		return false, errors.New("model name is required")
	}
	if len(channelIDs) == 0 {
		return false, nil
	}

	ownsTx := db == DB
	tx := db
	if ownsTx {
		tx = db.Begin()
		if tx.Error != nil {
			return false, tx.Error
		}
	}
	defer func() {
		if r := recover(); r != nil {
			if ownsTx {
				tx.Rollback()
			}
			panic(r)
		}
	}()

	var channels []Channel
	if err := tx.Where("id IN ? AND type = ?", channelIDs, constant.ChannelTypeCodex).Find(&channels).Error; err != nil {
		if ownsTx {
			tx.Rollback()
		}
		return false, err
	}
	changedAny := false
	for _, channel := range channels {
		nextModels, changed := removeCodexGovernanceModel(channel.Models, modelName)
		if !changed {
			continue
		}
		changedAny = true
		channel.Models = nextModels
		if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("models", nextModels).Error; err != nil {
			if ownsTx {
				tx.Rollback()
			}
			return false, err
		}
		if err := tx.Where("channel_id = ? AND model = ?", channel.Id, modelName).Delete(&Ability{}).Error; err != nil {
			if ownsTx {
				tx.Rollback()
			}
			return false, err
		}
	}
	if ownsTx {
		if err := tx.Commit().Error; err != nil {
			return false, err
		}
	}
	return changedAny, nil
}

func ReviewCodexModelGovernanceRecord(id int, status string, reviewerID int, note string) error {
	if id <= 0 {
		return gorm.ErrRecordNotFound
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	var record CodexModelGovernanceRecord
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&record, "id = ?", id).Error
	if err != nil {
		tx.Rollback()
		return err
	}
	nextStatus := strings.TrimSpace(status)
	channelIDs := decodeCodexModelGovernanceChannelIDs(record.AffectedChannelIDs)
	changed := false
	abilitiesDisabled := record.AbilitiesDisabled
	switch nextStatus {
	case CodexModelGovernanceStatusActive:
		// A removed record has already had the model stripped from
		// channels.models; restoring abilities would silently do nothing.
		// Fail loudly so the operator re-adds the model to channel config.
		if record.Status == CodexModelGovernanceStatusRemoved {
			tx.Rollback()
			return fmt.Errorf("model %s has been removed from channel configuration; re-add it to the affected channels manually before restoring", record.ModelName)
		}
		actionChanged, err := restoreCodexModelAbilitiesWithDB(tx, record.ModelName, channelIDs)
		if err != nil {
			tx.Rollback()
			return err
		}
		changed = changed || actionChanged
		abilitiesDisabled = false
	case CodexModelGovernanceStatusRemoved:
		actionChanged, err := removeCodexModelFromChannelsWithDB(tx, record.ModelName, channelIDs)
		if err != nil {
			tx.Rollback()
			return err
		}
		changed = changed || actionChanged
		abilitiesDisabled = true
	case CodexModelGovernanceStatusIgnored:
		if record.AbilitiesDisabled {
			tx.Rollback()
			return fmt.Errorf("model %s already has routing disabled; restore or remove it instead of ignoring the finding", record.ModelName)
		}
	case CodexModelGovernanceStatusUnsupportedPendingReview, CodexModelGovernanceStatusUnsupportedDisabled:
		actionChanged, err := setCodexModelAbilityEnabledWithDB(tx, record.ModelName, channelIDs, false)
		if err != nil {
			tx.Rollback()
			return err
		}
		changed = changed || actionChanged
		abilitiesDisabled = true
	default:
		tx.Rollback()
		return fmt.Errorf("unsupported codex model governance status: %s", status)
	}

	now := common.GetTimestamp()
	if err := tx.Model(&CodexModelGovernanceRecord{}).Where("id = ?", id).Updates(map[string]any{
		"status":             nextStatus,
		"abilities_disabled": abilitiesDisabled,
		"reviewed_at":        now,
		"reviewed_by":        reviewerID,
		"review_note":        strings.TrimSpace(note),
		"updated_time":       now,
	}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Commit().Error; err != nil {
		return err
	}
	if changed {
		publishChannelsChanged()
	}
	return nil
}

func setCodexModelAbilityEnabled(modelName string, channelIDs []int, enabled bool) error {
	changed, err := setCodexModelAbilityEnabledWithDB(DB, modelName, channelIDs, enabled)
	if err != nil {
		return err
	}
	if changed {
		publishChannelsChanged()
	}
	return nil
}

func setCodexModelAbilityEnabledWithDB(db *gorm.DB, modelName string, channelIDs []int, enabled bool) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if modelName == "" {
		return false, errors.New("model name is required")
	}
	if len(channelIDs) == 0 {
		return false, nil
	}
	codexChannelIDs, err := filterCodexChannelIDs(db, channelIDs)
	if err != nil {
		return false, err
	}
	if len(codexChannelIDs) == 0 {
		return false, nil
	}
	if err := db.Model(&Ability{}).
		Where("model = ? AND channel_id IN ?", modelName, codexChannelIDs).
		Select("enabled").
		Update("enabled", enabled).Error; err != nil {
		return false, err
	}
	return true, nil
}

func filterCodexChannelIDs(db *gorm.DB, channelIDs []int) ([]int, error) {
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if len(channelIDs) == 0 {
		return nil, nil
	}
	var channels []Channel
	if err := db.Model(&Channel{}).
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

func filterEnabledCodexChannelIDsWithModel(db *gorm.DB, modelName string, channelIDs []int) ([]int, error) {
	channelIDs = normalizeCodexModelGovernanceChannelIDs(channelIDs)
	if len(channelIDs) == 0 {
		return nil, nil
	}
	var channels []Channel
	if err := db.Model(&Channel{}).
		Where("id IN ? AND type = ? AND status = ?", channelIDs, constant.ChannelTypeCodex, common.ChannelStatusEnabled).
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
