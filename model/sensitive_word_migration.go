package model

import (
	"crypto/rand"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/request_plugin_setting"
	"gorm.io/gorm"
)

// retiredSensitiveOptionKeys are the options of the retired sensitive word
// check. Its words now live in a request-filter instance.
var retiredSensitiveOptionKeys = []string{
	"CheckSensitiveEnabled",
	"CheckSensitiveOnPromptEnabled",
	"StopOnSensitiveEnabled",
	"SensitiveWords",
	"StreamCacheQueueLength",
}

// MigrateSensitiveWords moves the words of the retired sensitive word check
// into one global request-filter instance and deletes the check's options.
// The instance is enabled when the check ran on prompts: both switches on.
// One transaction does both, so a later start finds nothing to move.
func MigrateSensitiveWords() error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	changed := false
	name := ""
	err := DB.Transaction(func(tx *gorm.DB) error {
		values := make(map[string]string, len(retiredSensitiveOptionKeys))
		var found []string
		for _, key := range retiredSensitiveOptionKeys {
			var option Option
			err := tx.Where(&Option{Key: key}).First(&option).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			if err != nil {
				return fmt.Errorf("read option %s: %w", key, err)
			}
			values[key] = option.Value
			found = append(found, key)
		}
		if len(found) == 0 {
			return nil
		}
		if words := sensitiveWordLines(values["SensitiveWords"]); words != "" {
			enabled := values["CheckSensitiveEnabled"] == "true" && values["CheckSensitiveOnPromptEnabled"] == "true"
			name = sensitiveWordInstanceName()
			if err := addSensitiveWordInstance(tx, name, words, enabled); err != nil {
				return err
			}
		}
		for _, key := range found {
			if err := tx.Delete(&Option{Key: key}).Error; err != nil {
				return fmt.Errorf("delete option %s: %w", key, err)
			}
		}
		changed = true
		return nil
	})
	if err != nil {
		return err
	}
	if changed {
		BumpSyncTopic(SyncTopicOptions)
	}
	if name != "" {
		common.SysLog(common.LogText("moved the sensitive words to the global request filter instance %s", name))
	}
	return nil
}

// sensitiveWordLines is the old word list, one word per line, as the check
// read it: lines trimmed, empty lines dropped.
func sensitiveWordLines(value string) string {
	var words []string
	for line := range strings.SplitSeq(value, "\n") {
		if word := strings.TrimSpace(line); word != "" {
			words = append(words, word)
		}
	}
	return strings.Join(words, "\n")
}

func sensitiveWordInstanceName() string {
	if language := strings.ToLower(strings.TrimSpace(common.DefaultLanguage)); language != "" && !strings.HasPrefix(language, "zh") {
		return "Sensitive words"
	}
	return "敏感词"
}

// addSensitiveWordInstance appends the instance to the saved instance list.
// The old check matched words in any letter case.
func addSensitiveWordInstance(tx *gorm.DB, name, words string, enabled bool) error {
	var option Option
	err := tx.Where(&Option{Key: request_plugin_setting.InstancesOption}).First(&option).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("read option %s: %w", request_plugin_setting.InstancesOption, err)
	}
	var instances []request_plugin_setting.Instance
	if strings.TrimSpace(option.Value) != "" {
		if err := common.UnmarshalJsonStr(option.Value, &instances); err != nil {
			return fmt.Errorf("read option %s: %w", request_plugin_setting.InstancesOption, err)
		}
	}
	ids := make(map[string]bool, len(instances))
	for _, instance := range instances {
		ids[instance.ID] = true
	}
	id := ""
	for id == "" || ids[id] {
		id = "rp_" + strings.ToLower(rand.Text()[:8])
	}
	config, err := common.Marshal(map[string]any{
		"rules":                 []any{},
		"keywords":              words,
		"keywordsCaseSensitive": false,
		"message":               "",
		"replies":               false,
	})
	if err != nil {
		return err
	}
	instances = append(instances, request_plugin_setting.Instance{
		ID:      id,
		Name:    name,
		Plugin:  "request-filter",
		Enabled: enabled,
		Global:  true,
		Groups:  []string{},
		Models:  []string{},
		Config:  config,
	})
	encoded, err := common.Marshal(instances)
	if err != nil {
		return err
	}
	option.Key = request_plugin_setting.InstancesOption
	option.Value = string(encoded)
	if err := tx.Save(&option).Error; err != nil {
		return fmt.Errorf("write option %s: %w", request_plugin_setting.InstancesOption, err)
	}
	return nil
}
