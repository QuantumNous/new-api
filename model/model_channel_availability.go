package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	modelAvailabilityDisabled  = 0
	modelAvailabilityEnabled   = 1
	modelAvailabilityBatchSize = 500
)

// ModelChannelAvailabilityConfig controls one model/channel reconciliation.
// Automatic mode reads the persisted option pair while holding the same locks
// used by option updates. Manual mode uses the explicit Disable/Enable values.
type ModelChannelAvailabilityConfig struct {
	Automatic bool
	Disable   bool
	Enable    bool
}

// ModelChannelAvailabilityResult summarizes the committed model status changes.
type ModelChannelAvailabilityResult struct {
	Disabled int
	Enabled  int
	Skipped  bool
}

// ReconcileModelChannelAvailability atomically reconciles model metadata status
// against the latest enabled abilities and channels.
func ReconcileModelChannelAvailability(config ModelChannelAvailabilityConfig) (ModelChannelAvailabilityResult, error) {
	result := ModelChannelAvailabilityResult{}
	// FixAbility rebuilds the derivative table in one transaction. Share its
	// in-process lock so reconciliation never reads a deliberately empty repair
	// window.
	fixLock.Lock()
	defer fixLock.Unlock()
	err := DB.Transaction(func(tx *gorm.DB) error {
		// SQLite does not support SELECT FOR UPDATE. A harmless write acquires its
		// database-wide writer lock before any state is read.
		if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
			if err := tx.Model(&Option{}).
				Where(commonKeyCol+" = ?", "").
				UpdateColumn("value", gorm.Expr("value")).Error; err != nil {
				return err
			}
		}

		optionKeys := []string{automaticDisableModelOptionKey, automaticEnableModelOptionKey}
		var options []Option
		if err := lockForUpdate(tx).
			Where(commonKeyCol+" IN ?", optionKeys).
			Order(commonKeyCol + " ASC").
			Find(&options).Error; err != nil {
			return err
		}

		disableEnabled := config.Disable
		enableEnabled := config.Enable
		if config.Automatic {
			common.OptionMapRWMutex.RLock()
			disableEnabled = common.AutomaticDisableModelEnabled
			enableEnabled = common.AutomaticEnableModelEnabled
			common.OptionMapRWMutex.RUnlock()
			for _, option := range options {
				switch option.Key {
				case automaticDisableModelOptionKey:
					disableEnabled = isEnabledOptionValue(option.Value)
				case automaticEnableModelOptionKey:
					enableEnabled = isEnabledOptionValue(option.Value)
				}
			}
			// Auto-enable is subordinate to auto-disable.
			enableEnabled = disableEnabled && enableEnabled
		}
		if !disableEnabled && !enableEnabled {
			result.Skipped = true
			return nil
		}

		var models []*Model
		if err := lockForUpdate(tx).
			Select("id", "model_name", "status", "name_rule", "auto_disabled_by_rule").
			Order("id ASC").
			Find(&models).Error; err != nil {
			return err
		}

		// Keep ability and channel state in one statement snapshot. PostgreSQL's
		// default READ COMMITTED isolation can otherwise observe a channel mutation
		// between separate ability and channel queries and derive a state that never
		// existed in the database.
		var availableRows []struct {
			Model       string      `gorm:"column:model"`
			ChannelKey  string      `gorm:"column:channel_key"`
			ChannelInfo ChannelInfo `gorm:"column:channel_info"`
		}
		if err := tx.Table("abilities").
			Select("abilities.model AS model, channels."+commonKeyCol+" AS channel_key, channels.channel_info AS channel_info").
			Joins("JOIN channels ON channels.id = abilities.channel_id").
			Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
			Scan(&availableRows).Error; err != nil {
			return err
		}

		availableModels := make(map[string]struct{})
		for i := range availableRows {
			row := &availableRows[i]
			if row.ChannelInfo.IsMultiKey {
				channel := Channel{Key: row.ChannelKey, ChannelInfo: row.ChannelInfo}
				if !channel.HasEnabledMultiKey() {
					continue
				}
			}
			name := strings.TrimSpace(row.Model)
			if name == "" {
				continue
			}
			availableModels[name] = struct{}{}
		}

		disableIDs := make([]int, 0)
		enableIDs := make([]int, 0)
		for _, currentModel := range models {
			if currentModel == nil {
				continue
			}
			hasAvailableChannel := modelMatchesAvailableChannel(currentModel, availableModels)
			if disableEnabled && currentModel.Status == modelAvailabilityEnabled && !hasAvailableChannel {
				disableIDs = append(disableIDs, currentModel.Id)
				continue
			}
			if enableEnabled && currentModel.Status == modelAvailabilityDisabled && currentModel.AutoDisabledByRule && hasAvailableChannel {
				enableIDs = append(enableIDs, currentModel.Id)
			}
		}

		now := common.GetTimestamp()
		for start := 0; start < len(disableIDs); start += modelAvailabilityBatchSize {
			end := min(start+modelAvailabilityBatchSize, len(disableIDs))
			updateResult := tx.Model(&Model{}).
				Where("id IN ? AND status = ?", disableIDs[start:end], modelAvailabilityEnabled).
				Updates(map[string]interface{}{
					"status":                modelAvailabilityDisabled,
					"auto_disabled_by_rule": true,
					"updated_time":          now,
				})
			if updateResult.Error != nil {
				return updateResult.Error
			}
			result.Disabled += int(updateResult.RowsAffected)
		}
		for start := 0; start < len(enableIDs); start += modelAvailabilityBatchSize {
			end := min(start+modelAvailabilityBatchSize, len(enableIDs))
			updateResult := tx.Model(&Model{}).
				Where("id IN ? AND status = ? AND auto_disabled_by_rule = ?", enableIDs[start:end], modelAvailabilityDisabled, true).
				Updates(map[string]interface{}{
					"status":                modelAvailabilityEnabled,
					"auto_disabled_by_rule": true,
					"updated_time":          now,
				})
			if updateResult.Error != nil {
				return updateResult.Error
			}
			result.Enabled += int(updateResult.RowsAffected)
		}
		return nil
	})
	if err != nil {
		return ModelChannelAvailabilityResult{}, err
	}
	return result, nil
}

func modelMatchesAvailableChannel(currentModel *Model, availableModels map[string]struct{}) bool {
	name := currentModel.ModelName
	switch currentModel.NameRule {
	case NameRulePrefix:
		for available := range availableModels {
			if strings.HasPrefix(available, name) {
				return true
			}
		}
	case NameRuleContains:
		for available := range availableModels {
			if strings.Contains(available, name) {
				return true
			}
		}
	case NameRuleSuffix:
		for available := range availableModels {
			if strings.HasSuffix(available, name) {
				return true
			}
		}
	default:
		_, ok := availableModels[name]
		return ok
	}
	return false
}
