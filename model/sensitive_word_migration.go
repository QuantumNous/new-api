package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func normalizeLegacySensitiveWords(words []string) ([]string, bool) {
	result := make([]string, 0, min(len(words), SensitiveWordMaxRules))
	seen := make(map[string]struct{}, len(words))
	complete := true
	invalidCount := 0
	for _, raw := range words {
		word, err := normalizeSensitiveWord(raw)
		if err != nil {
			if strings.TrimSpace(raw) != "" {
				complete = false
				invalidCount++
			}
			continue
		}
		key := strings.ToLower(word)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		if len(result) >= SensitiveWordMaxRules {
			complete = false
			invalidCount++
			continue
		}
		result = append(result, word)
	}
	if invalidCount > 0 {
		common.SysLog(fmt.Sprintf("sensitive-word migration retained %d legacy entries outside the new rule limits", invalidCount))
	}
	return result, complete
}

// MigrateSensitiveWordData performs an idempotent, one-way import. Once the
// marker is committed, legacy options and compatibility columns are never
// consulted by request handling or future migrations.
func MigrateSensitiveWordData() (err error) {
	completed := false
	defer func() {
		setSensitiveWordRuntimeUnavailable(err != nil || !completed)
	}()

	if DB == nil {
		return nil
	}
	var marker Option
	markerErr := DB.Where(&Option{Key: sensitiveWordMigrationKey}).First(&marker).Error
	if markerErr == nil && marker.Value == sensitiveWordMigrationValue {
		completed = true
		return nil
	}
	if markerErr != nil && !errors.Is(markerErr, gorm.ErrRecordNotFound) {
		return markerErr
	}

	if err := migrateSensitiveWordPolicy(); err != nil {
		return err
	}
	complete, err := migrateSensitiveWordRules()
	if err != nil {
		return err
	}
	legacyComplete, err := migrateLegacySensitiveWordOption()
	if err != nil {
		return err
	}
	complete = complete && legacyComplete
	if err := migrateLegacySensitiveWordWhitelist(); err != nil {
		return err
	}

	if complete {
		if err := DB.Save(&Option{Key: sensitiveWordMigrationKey, Value: sensitiveWordMigrationValue}).Error; err != nil {
			return err
		}
		completed = true
	} else if err := DB.Where(&Option{Key: sensitiveWordMigrationKey}).Delete(&Option{}).Error; err != nil {
		return err
	}
	return nil
}

func migrateSensitiveWordPolicy() error {
	var policy SensitiveWordPolicy
	err := DB.First(&policy, 1).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	policy = defaultSensitiveWordPolicy()
	var legacy Option
	if err := DB.Where(&Option{Key: "SensitiveWordConfig"}).First(&legacy).Error; err == nil {
		var config legacySensitiveWordConfig
		if err := common.UnmarshalJsonStr(legacy.Value, &config); err != nil {
			return fmt.Errorf("decode legacy sensitive-word policy: %w", err)
		}
		policy.Enabled = config.Enabled
		// The legacy schema had no check_prompt field. Keep the new
		// policy default in that case; a present false remains an explicit
		// administrator choice from later versions.
		if config.CheckPrompt != nil {
			policy.CheckPrompt = *config.CheckPrompt
		}
		policy.RetainFullPrompt = config.AuditEnabled
		policy.BlockMessage = config.BlockMessage
		policy.BanThreshold = config.BanThreshold
		policy.FullPromptRetentionDays = config.FullPromptRetentionDays
		policy.MaxPromptRunes = config.MaxPromptRunes
		policy.Version = config.RuleVersion
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	policy = normalizeSensitiveWordPolicy(policy)
	return DB.Create(&policy).Error
}

func migrateSensitiveWordRules() (bool, error) {
	complete := true
	var rules []SensitiveWordRule
	if err := DB.Find(&rules).Error; err != nil {
		return false, err
	}
	for _, rule := range rules {
		mode := migrateSensitiveWordRuleMode(rule.Mode, rule.Enabled)
		updates := make(map[string]any)
		if rule.Mode != mode || rule.Enabled != (mode != SensitiveWordModeOff) {
			updates["mode"] = mode
			updates["enabled"] = mode != SensitiveWordModeOff
		}
		if strings.TrimSpace(rule.Name) == "" {
			updates["name"] = fmt.Sprintf("迁移规则 #%d", rule.ID)
		}
		if rule.Version <= 0 {
			updates["version"] = 1
		}
		if len(updates) > 0 {
			if err := DB.Model(&SensitiveWordRule{}).Where("id = ?", rule.ID).Updates(updates).Error; err != nil {
				return false, err
			}
		}

		var count int64
		if err := DB.Model(&SensitiveWordRuleWord{}).Where("rule_id = ?", rule.ID).Count(&count).Error; err != nil {
			return false, err
		}
		if count > 0 || strings.TrimSpace(rule.Word) == "" {
			continue
		}
		words, importedAll := normalizeLegacySensitiveWords(strings.Split(rule.Word, "\n"))
		if !importedAll {
			complete = false
			continue
		}
		if err := DB.Transaction(func(tx *gorm.DB) error {
			for _, word := range words {
				item := SensitiveWordRuleWord{
					RuleID: rule.ID, Word: word,
					NormalizedHash: sensitiveWordHash(word), CreatedAt: time.Now(),
				}
				if err := tx.Create(&item).Error; err != nil {
					return err
				}
			}
			return nil
		}); err != nil {
			return false, err
		}
	}
	return complete, nil
}

func migrateLegacySensitiveWordOption() (bool, error) {
	var legacy Option
	err := DB.Where(&Option{Key: "SensitiveWords"}).First(&legacy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	words, complete := normalizeLegacySensitiveWords(strings.Split(legacy.Value, "\n"))
	if !complete || len(words) == 0 {
		return complete, nil
	}
	var importedCount int64
	if err := DB.Model(&SensitiveWordRule{}).
		Where("name = ? AND scope = ? AND created_by = ?", "旧配置导入", SensitiveWordScopeGlobal, 0).
		Count(&importedCount).Error; err != nil {
		return false, err
	}
	if importedCount == 0 {
		if _, err := UpsertSensitiveWordRuleWithMode(
			0, "旧配置导入", words, SensitiveWordScopeGlobal, nil, 0, SensitiveWordModeBlock,
		); err != nil {
			return false, err
		}
	}
	return true, nil
}

func migrateLegacySensitiveWordWhitelist() error {
	if !DB.Migrator().HasTable(&legacySensitiveWordWhitelist{}) {
		return nil
	}
	var whitelist []legacySensitiveWordWhitelist
	if err := DB.Where("enabled = ?", true).Find(&whitelist).Error; err != nil {
		return err
	}
	for _, item := range whitelist {
		whitelisted := true
		if err := UpdateSensitiveWordUserFields(item.UserID, nil, &whitelisted); err != nil {
			return err
		}
	}
	return nil
}
