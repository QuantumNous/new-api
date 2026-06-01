package business_fallback

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const DefaultConfigJSON = `{
  "enabled": true,
  "image_generation": {
    "families": {
      "gpt_image": {
        "match_models": ["gpt-image-2"],
        "select_model": "gpt-image-2"
      },
      "gemini_image": {
        "match_models": ["gemini-3.1-flash-image-preview"],
        "select_model": "gemini-3.1-flash-image-preview"
      },
      "seedream": {
        "match_models": ["doubao-seedream-5-0*"],
        "select_model": "doubao-seedream-5-0"
      }
    },
    "chains": {
      "gpt_image": ["gpt_image", "gemini_image", "seedream"],
      "gemini_image": ["gemini_image", "gpt_image", "seedream"],
      "seedream": ["seedream"]
    },
    "health": {
      "enabled": true,
      "monitored_families": ["gpt_image", "gemini_image"],
      "window_minutes": 60,
      "min_samples": 10,
      "success_rate_threshold": 0.3,
      "block_minutes": 60
    }
  }
}`

type Settings struct {
	Config string `json:"config"`
}

type Config struct {
	Enabled         bool                  `json:"enabled"`
	ImageGeneration ImageGenerationConfig `json:"image_generation"`
}

type ImageGenerationConfig struct {
	Families map[string]ImageModelFamily `json:"families"`
	Chains   map[string][]string         `json:"chains"`
	Health   HealthConfig                `json:"health"`
}

type ImageModelFamily struct {
	MatchModels []string `json:"match_models"`
	SelectModel string   `json:"select_model"`
}

type HealthConfig struct {
	Enabled              bool     `json:"enabled"`
	MonitoredFamilies    []string `json:"monitored_families"`
	WindowMinutes        int      `json:"window_minutes"`
	MinSamples           int      `json:"min_samples"`
	SuccessRateThreshold float64  `json:"success_rate_threshold"`
	BlockMinutes         int      `json:"block_minutes"`
}

var settings = Settings{Config: DefaultConfigJSON}

func init() {
	config.GlobalConfig.Register("business_fallback", &settings)
}

func GetSettings() *Settings {
	return &settings
}

func GetConfig() Config {
	cfg, err := ParseConfig(settings.Config)
	if err != nil {
		common.SysError("invalid business_fallback.config, using default: " + err.Error())
		cfg, _ = ParseConfig(DefaultConfigJSON)
	}
	return cfg
}

func UpdateConfig(value string) error {
	normalized, err := NormalizeConfigJSON(value)
	if err != nil {
		return err
	}
	settings.Config = normalized
	return nil
}

func NormalizeConfigJSON(value string) (string, error) {
	cfg, err := ParseConfig(value)
	if err != nil {
		return "", err
	}
	data, err := common.Marshal(cfg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func ParseConfig(value string) (Config, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		value = DefaultConfigJSON
	}
	var cfg Config
	if err := common.Unmarshal([]byte(value), &cfg); err != nil {
		return Config{}, fmt.Errorf("invalid JSON: %w", err)
	}
	if err := validateConfig(cfg); err != nil {
		return Config{}, err
	}
	applyDefaults(&cfg)
	return cfg, nil
}

func validateConfig(cfg Config) error {
	ig := cfg.ImageGeneration
	if len(ig.Families) == 0 {
		return errors.New("image_generation.families is required")
	}
	if len(ig.Chains) == 0 {
		return errors.New("image_generation.chains is required")
	}
	for id, family := range ig.Families {
		id = strings.TrimSpace(id)
		if id == "" {
			return errors.New("image_generation.families contains empty family id")
		}
		if strings.TrimSpace(family.SelectModel) == "" {
			return fmt.Errorf("image_generation.families.%s.select_model is required", id)
		}
		if len(family.MatchModels) == 0 {
			return fmt.Errorf("image_generation.families.%s.match_models is required", id)
		}
		for _, model := range family.MatchModels {
			if strings.TrimSpace(model) == "" {
				return fmt.Errorf("image_generation.families.%s.match_models contains empty model", id)
			}
		}
	}
	for family, chain := range ig.Chains {
		if _, ok := ig.Families[family]; !ok {
			return fmt.Errorf("image_generation.chains.%s references unknown source family", family)
		}
		if len(chain) == 0 {
			return fmt.Errorf("image_generation.chains.%s must contain at least one target family", family)
		}
		for _, target := range chain {
			if _, ok := ig.Families[target]; !ok {
				return fmt.Errorf("image_generation.chains.%s references unknown target family %s", family, target)
			}
		}
	}
	for _, family := range ig.Health.MonitoredFamilies {
		if _, ok := ig.Families[family]; !ok {
			return fmt.Errorf("image_generation.health.monitored_families references unknown family %s", family)
		}
	}
	if ig.Health.SuccessRateThreshold < 0 || ig.Health.SuccessRateThreshold > 1 {
		return errors.New("image_generation.health.success_rate_threshold must be between 0 and 1")
	}
	return nil
}

func applyDefaults(cfg *Config) {
	if cfg.ImageGeneration.Health.WindowMinutes <= 0 {
		cfg.ImageGeneration.Health.WindowMinutes = 60
	}
	if cfg.ImageGeneration.Health.MinSamples <= 0 {
		cfg.ImageGeneration.Health.MinSamples = 10
	}
	if cfg.ImageGeneration.Health.BlockMinutes <= 0 {
		cfg.ImageGeneration.Health.BlockMinutes = 60
	}
	if cfg.ImageGeneration.Health.SuccessRateThreshold == 0 {
		cfg.ImageGeneration.Health.SuccessRateThreshold = 0.3
	}
}
