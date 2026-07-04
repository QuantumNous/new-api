package model_setting

import (
	"encoding/json"
	"fmt"
	"strings"
)

type OfficialFallbackPolicy struct {
	Enabled           bool   `json:"enabled"`
	ModelID           string `json:"model_id"`
	FallbackAfter     int    `json:"fallback_after"`
	OfficialChannelID int    `json:"official_channel_id"`
}

type ModelFallbackSettings struct {
	Policies []OfficialFallbackPolicy `json:"policies"`
}

var defaultModelFallbackSettings = ModelFallbackSettings{
	Policies: []OfficialFallbackPolicy{
		{
			Enabled:           true,
			ModelID:           "gpt-5.4",
			FallbackAfter:     1,
			OfficialChannelID: 38,
		},
		{
			Enabled:           true,
			ModelID:           "gpt-5.5",
			FallbackAfter:     1,
			OfficialChannelID: 38,
		},
	},
}

var modelFallbackSettings = defaultModelFallbackSettings

func GetModelFallbackSettings() *ModelFallbackSettings {
	return &modelFallbackSettings
}

func ParseModelFallbackSettings(raw string) (ModelFallbackSettings, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ModelFallbackSettings{}, nil
	}

	settings := ModelFallbackSettings{}
	if strings.HasPrefix(trimmed, "[") {
		if err := json.Unmarshal([]byte(trimmed), &settings.Policies); err != nil {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置格式错误: %w", err)
		}
	} else {
		if err := json.Unmarshal([]byte(trimmed), &settings); err != nil {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置格式错误: %w", err)
		}
	}

	return NormalizeAndValidateModelFallbackSettings(settings)
}

func NormalizeAndValidateModelFallbackSettings(settings ModelFallbackSettings) (ModelFallbackSettings, error) {
	normalized := ModelFallbackSettings{
		Policies: make([]OfficialFallbackPolicy, 0, len(settings.Policies)),
	}
	seenModelIDs := make(map[string]struct{}, len(settings.Policies))

	for index, policy := range settings.Policies {
		policy.ModelID = strings.TrimSpace(policy.ModelID)
		if policy.ModelID == "" {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置第 %d 行 model_id 不能为空", index+1)
		}
		if _, exists := seenModelIDs[policy.ModelID]; exists {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置存在重复 model_id: %s", policy.ModelID)
		}
		seenModelIDs[policy.ModelID] = struct{}{}

		if policy.FallbackAfter < 0 {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置第 %d 行 fallback_after 不能小于 0", index+1)
		}
		if policy.OfficialChannelID <= 0 {
			return ModelFallbackSettings{}, fmt.Errorf("官方兜底配置第 %d 行 official_channel_id 必须大于 0", index+1)
		}

		normalized.Policies = append(normalized.Policies, policy)
	}

	return normalized, nil
}

func ApplyModelFallbackSettings(raw string) (string, error) {
	settings, err := ParseModelFallbackSettings(raw)
	if err != nil {
		return "", err
	}
	modelFallbackSettings = settings
	normalized, err := MarshalModelFallbackSettings(settings)
	if err != nil {
		return "", err
	}
	return normalized, nil
}

func NormalizeModelFallbackSettingsJSONString(raw string) (string, error) {
	settings, err := ParseModelFallbackSettings(raw)
	if err != nil {
		return "", err
	}
	return MarshalModelFallbackSettings(settings)
}

func MarshalModelFallbackSettings(settings ModelFallbackSettings) (string, error) {
	bytes, err := json.Marshal(settings)
	if err != nil {
		return "", fmt.Errorf("官方兜底配置序列化失败: %w", err)
	}
	return string(bytes), nil
}

func GetModelFallbackSettingsJSONString() string {
	value, err := MarshalModelFallbackSettings(modelFallbackSettings)
	if err != nil {
		return `{"policies":[]}`
	}
	return value
}

func FindOfficialFallbackPolicy(modelName string) (OfficialFallbackPolicy, bool) {
	target := strings.TrimSpace(modelName)
	if target == "" {
		return OfficialFallbackPolicy{}, false
	}

	for _, policy := range modelFallbackSettings.Policies {
		if !policy.Enabled {
			continue
		}
		if strings.TrimSpace(policy.ModelID) != target {
			continue
		}
		if policy.OfficialChannelID <= 0 {
			continue
		}
		if policy.FallbackAfter < 0 {
			policy.FallbackAfter = 0
		}
		return policy, true
	}
	return OfficialFallbackPolicy{}, false
}
