package service

import (
	"fmt"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	modelStatusEnabled  = 1
	modelStatusDisabled = 0
)

// ModelChannelAvailabilityResult summarizes one reconciliation pass.
type ModelChannelAvailabilityResult struct {
	Disabled         int
	Enabled          int
	Skipped          bool
	Reason           string
	PricingRefreshed bool // true when this pass already called model.RefreshPricing
}

var modelChannelAvailabilityMu sync.Mutex

// SyncModelChannelAvailability reconciles model status against available channels.
// When reason is non-empty it is logged with the enable/disable counts.
// Evaluation always scans all model rows when either auto switch is enabled.
func SyncModelChannelAvailability(reason string) ModelChannelAvailabilityResult {
	return syncModelChannelAvailability(reason, false)
}

// SyncModelChannelAvailabilityFull runs the same reconciliation as SyncModelChannelAvailability,
// but also emits a zero-change log line when forceFull logging is requested.
func SyncModelChannelAvailabilityFull(reason string) ModelChannelAvailabilityResult {
	return syncModelChannelAvailability(reason, true)
}

// forceFull only affects zero-change logging; model evaluation already scans all rows.
func syncModelChannelAvailability(reason string, forceFull bool) ModelChannelAvailabilityResult {
	result := ModelChannelAvailabilityResult{Reason: reason}

	disableEnabled := common.AutomaticDisableModelEnabled
	// Auto-enable is subordinate to auto-disable: turning disable off stops the whole automation set.
	enableEnabled := common.AutomaticEnableModelEnabled && disableEnabled
	if !disableEnabled && !enableEnabled {
		result.Skipped = true
		return result
	}

	modelChannelAvailabilityMu.Lock()
	defer modelChannelAvailabilityMu.Unlock()

	availableModels, err := loadAvailableExactModelNames()
	if err != nil {
		common.SysError(fmt.Sprintf("model channel availability sync failed to load available models: %v", err))
		return result
	}

	var models []*model.Model
	if err := model.DB.Select("id", "model_name", "status", "name_rule", "auto_disabled_by_rule").Find(&models).Error; err != nil {
		common.SysError(fmt.Sprintf("model channel availability sync failed to load models: %v", err))
		return result
	}

	now := common.GetTimestamp()
	disableIDs := make([]int, 0)
	enableIDs := make([]int, 0)

	for _, m := range models {
		if m == nil {
			continue
		}
		hasAvailable := modelHasAvailableChannel(m, availableModels)
		if disableEnabled && m.Status == modelStatusEnabled && !hasAvailable {
			disableIDs = append(disableIDs, m.Id)
			continue
		}
		if enableEnabled && m.Status == modelStatusDisabled && m.AutoDisabledByRule && hasAvailable {
			enableIDs = append(enableIDs, m.Id)
		}
	}

	if len(disableIDs) > 0 {
		// Conditional update keeps the operation idempotent and avoids clobbering concurrent manual changes.
		res := model.DB.Model(&model.Model{}).
			Where("id IN ? AND status = ?", disableIDs, modelStatusEnabled).
			Updates(map[string]interface{}{
				"status":                modelStatusDisabled,
				"auto_disabled_by_rule": true,
				"updated_time":          now,
			})
		if res.Error != nil {
			common.SysError(fmt.Sprintf("model channel availability sync disable failed: %v", res.Error))
		} else {
			result.Disabled = int(res.RowsAffected)
		}
	}

	if len(enableIDs) > 0 {
		res := model.DB.Model(&model.Model{}).
			Where("id IN ? AND status = ? AND auto_disabled_by_rule = ?", enableIDs, modelStatusDisabled, true).
			Updates(map[string]interface{}{
				"status":                modelStatusEnabled,
				"auto_disabled_by_rule": true,
				"updated_time":          now,
			})
		if res.Error != nil {
			common.SysError(fmt.Sprintf("model channel availability sync enable failed: %v", res.Error))
		} else {
			result.Enabled = int(res.RowsAffected)
		}
	}

	if result.Disabled > 0 || result.Enabled > 0 {
		model.RefreshPricing()
		result.PricingRefreshed = true
		common.SysLog(fmt.Sprintf(
			"model channel availability sync: reason=%s disabled=%d enabled=%d",
			reason, result.Disabled, result.Enabled,
		))
	} else if reason != "" && forceFull {
		common.SysLog(fmt.Sprintf(
			"model channel availability sync: reason=%s disabled=0 enabled=0",
			reason,
		))
	}

	return result
}

func loadAvailableExactModelNames() (map[string]struct{}, error) {
	type row struct {
		Model string
	}
	var rows []row
	// Available = ability enabled + parent channel enabled.
	// Scope is global across groups: model metadata status is site-wide, not per-group.
	err := model.DB.Table("abilities").
		Select("DISTINCT abilities.model as model").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.enabled = ? AND channels.status = ?", true, common.ChannelStatusEnabled).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]struct{}, len(rows))
	for _, r := range rows {
		name := strings.TrimSpace(r.Model)
		if name == "" {
			continue
		}
		result[name] = struct{}{}
	}
	return result, nil
}

func modelHasAvailableChannel(m *model.Model, availableExact map[string]struct{}) bool {
	if m == nil {
		return false
	}
	name := m.ModelName
	switch m.NameRule {
	case model.NameRuleExact:
		_, ok := availableExact[name]
		return ok
	case model.NameRulePrefix:
		for exact := range availableExact {
			if strings.HasPrefix(exact, name) {
				return true
			}
		}
	case model.NameRuleContains:
		for exact := range availableExact {
			if strings.Contains(exact, name) {
				return true
			}
		}
	case model.NameRuleSuffix:
		for exact := range availableExact {
			if strings.HasSuffix(exact, name) {
				return true
			}
		}
	default:
		_, ok := availableExact[name]
		return ok
	}
	return false
}

// ClearModelAutoDisabledByRule clears the auto-disable marker for the given model ids.
// Call this when an admin explicitly changes model status or upstream sync overwrites status.
func ClearModelAutoDisabledByRule(ids ...int) {
	if len(ids) == 0 {
		return
	}
	if err := model.DB.Model(&model.Model{}).
		Where("id IN ? AND auto_disabled_by_rule = ?", ids, true).
		Update("auto_disabled_by_rule", false).Error; err != nil {
		common.SysError(fmt.Sprintf("failed to clear model auto-disabled marker: %v", err))
	}
}

// MaybeSyncModelChannelAvailabilityAfterOptionChange triggers full calibration when model auto switches change.
func MaybeSyncModelChannelAvailabilityAfterOptionChange(key string, value string) {
	if key != "AutomaticDisableModelEnabled" && key != "AutomaticEnableModelEnabled" {
		return
	}
	if value != "1" && !strings.EqualFold(value, "true") {
		return
	}
	if key == "AutomaticDisableModelEnabled" && !common.AutomaticDisableModelEnabled {
		return
	}
	if key == "AutomaticEnableModelEnabled" && !common.AutomaticEnableModelEnabled {
		return
	}
	SyncModelChannelAvailabilityFull(fmt.Sprintf("option.%s=true", key))
}

// ManualDisableModelsWithoutChannels forces disabling all currently enabled models
// that have no available channels, regardless of automatic option switches.
func ManualDisableModelsWithoutChannels() ModelChannelAvailabilityResult {
	return manualSyncModelChannelAvailability("manual.batch.disable.no-channels", true, false)
}

// ManualEnableModelsWithChannels forces enabling models that were disabled by
// channel-availability automation and now have available channels again.
// Manually disabled models (auto_disabled_by_rule=false) are left untouched.
func ManualEnableModelsWithChannels() ModelChannelAvailabilityResult {
	return manualSyncModelChannelAvailability("manual.batch.enable.with-channels", false, true)
}

func manualSyncModelChannelAvailability(reason string, doDisable bool, doEnable bool) ModelChannelAvailabilityResult {
	result := ModelChannelAvailabilityResult{Reason: reason}

	modelChannelAvailabilityMu.Lock()
	defer modelChannelAvailabilityMu.Unlock()

	availableModels, err := loadAvailableExactModelNames()
	if err != nil {
		common.SysError(fmt.Sprintf("manual model channel availability sync failed to load available models: %v", err))
		return result
	}

	var models []*model.Model
	if err := model.DB.Select("id", "model_name", "status", "name_rule", "auto_disabled_by_rule").Find(&models).Error; err != nil {
		common.SysError(fmt.Sprintf("manual model channel availability sync failed to load models: %v", err))
		return result
	}

	now := common.GetTimestamp()
	disableIDs := make([]int, 0)
	enableAutoIDs := make([]int, 0)

	for _, m := range models {
		if m == nil {
			continue
		}
		hasAvailable := modelHasAvailableChannel(m, availableModels)
		if doDisable && m.Status == modelStatusEnabled && !hasAvailable {
			disableIDs = append(disableIDs, m.Id)
			continue
		}
		// Only recover models previously disabled by this automation.
		if doEnable && m.Status == modelStatusDisabled && m.AutoDisabledByRule && hasAvailable {
			enableAutoIDs = append(enableAutoIDs, m.Id)
		}
	}

	if len(disableIDs) > 0 {
		res := model.DB.Model(&model.Model{}).
			Where("id IN ? AND status = ?", disableIDs, modelStatusEnabled).
			Updates(map[string]interface{}{
				"status":                modelStatusDisabled,
				"auto_disabled_by_rule": true,
				"updated_time":          now,
			})
		if res.Error != nil {
			common.SysError(fmt.Sprintf("manual model channel availability disable failed: %v", res.Error))
		} else {
			result.Disabled = int(res.RowsAffected)
		}
	}

	if len(enableAutoIDs) > 0 {
		res := model.DB.Model(&model.Model{}).
			Where("id IN ? AND status = ? AND auto_disabled_by_rule = ?", enableAutoIDs, modelStatusDisabled, true).
			Updates(map[string]interface{}{
				"status":                modelStatusEnabled,
				"auto_disabled_by_rule": true,
				"updated_time":          now,
			})
		if res.Error != nil {
			common.SysError(fmt.Sprintf("manual model channel availability auto-enable failed: %v", res.Error))
		} else {
			result.Enabled += int(res.RowsAffected)
		}
	}

	if result.Disabled > 0 || result.Enabled > 0 {
		model.RefreshPricing()
		result.PricingRefreshed = true
		common.SysLog(fmt.Sprintf(
			"manual model channel availability sync: reason=%s disabled=%d enabled=%d",
			reason, result.Disabled, result.Enabled,
		))
	}

	return result
}
