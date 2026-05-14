package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ModelDetectConfig mirrors controller.ModelDetectConfig but lives in service so
// background tasks can read per-model detection settings without importing controller.
type ModelDetectConfig struct {
	FingerprintEnabled         bool `json:"fingerprint_enabled"`
	FingerprintIntervalMinutes int  `json:"fingerprint_interval_minutes"`
	UptimeEnabled              bool `json:"uptime_enabled"`
	UptimeIntervalMinutes      int  `json:"uptime_interval_minutes"`
}

func defaultDetectConfig() ModelDetectConfig {
	return ModelDetectConfig{
		FingerprintEnabled:         false,
		FingerprintIntervalMinutes: 360,
		UptimeEnabled:              false,
		UptimeIntervalMinutes:      30,
	}
}

// DetectConfigKey returns the options table key used to store per-model detection settings.
func DetectConfigKey(modelName string) string {
	return fmt.Sprintf("detect_config_%s", modelName)
}

// LoadDetectConfig reads the per-model detection config from the options table.
// Falls back to defaults (both disabled) if the row is missing or unparseable.
func LoadDetectConfig(modelName string) ModelDetectConfig {
	var opt model.Option
	if err := model.DB.Where("key = ?", DetectConfigKey(modelName)).First(&opt).Error; err != nil {
		return defaultDetectConfig()
	}
	cfg := defaultDetectConfig()
	if err := common.Unmarshal([]byte(opt.Value), &cfg); err != nil {
		return defaultDetectConfig()
	}
	return cfg
}

// LoadAllConfiguredModels returns model names that have a saved detect_config_* row.
// Used by background tasks to know which models to iterate over without hardcoding.
func LoadAllConfiguredModels() []string {
	var opts []model.Option
	if err := model.DB.Where("key LIKE ?", "detect_config_%").Find(&opts).Error; err != nil {
		return nil
	}
	const prefix = "detect_config_"
	models := make([]string, 0, len(opts))
	for _, o := range opts {
		if len(o.Key) > len(prefix) {
			models = append(models, o.Key[len(prefix):])
		}
	}
	return models
}
