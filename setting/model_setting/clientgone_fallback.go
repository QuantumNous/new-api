package model_setting

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ClientGoneFallbackPolicy 定义"首字竞速"（clientgone fallback）的单模型策略：
// 主渠道超过 FrtTimeoutSeconds + ExtraSecondsPerMB × body_MB 仍未吐出首字节时，
// 并行向下一个可用渠道发起 hedge 请求，谁先出首字节谁赢。
type ClientGoneFallbackPolicy struct {
	Enabled           bool   `json:"enabled"`
	ModelID           string `json:"model_id"`
	FrtTimeoutSeconds int    `json:"frt_timeout_seconds"`
	ExtraSecondsPerMB int    `json:"extra_seconds_per_mb"`
}

type ClientGoneFallbackSettings struct {
	Policies []ClientGoneFallbackPolicy `json:"policies"`
}

var clientGoneFallbackSettings = ClientGoneFallbackSettings{}

func GetClientGoneFallbackSettings() *ClientGoneFallbackSettings {
	return &clientGoneFallbackSettings
}

func ParseClientGoneFallbackSettings(raw string) (ClientGoneFallbackSettings, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ClientGoneFallbackSettings{}, nil
	}

	settings := ClientGoneFallbackSettings{}
	if strings.HasPrefix(trimmed, "[") {
		if err := json.Unmarshal([]byte(trimmed), &settings.Policies); err != nil {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置格式错误: %w", err)
		}
	} else {
		if err := json.Unmarshal([]byte(trimmed), &settings); err != nil {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置格式错误: %w", err)
		}
	}

	return NormalizeAndValidateClientGoneFallbackSettings(settings)
}

func NormalizeAndValidateClientGoneFallbackSettings(settings ClientGoneFallbackSettings) (ClientGoneFallbackSettings, error) {
	normalized := ClientGoneFallbackSettings{
		Policies: make([]ClientGoneFallbackPolicy, 0, len(settings.Policies)),
	}
	seenModelIDs := make(map[string]struct{}, len(settings.Policies))

	for index, policy := range settings.Policies {
		policy.ModelID = strings.TrimSpace(policy.ModelID)
		if policy.ModelID == "" {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置第 %d 行 model_id 不能为空", index+1)
		}
		if _, exists := seenModelIDs[policy.ModelID]; exists {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置存在重复 model_id: %s", policy.ModelID)
		}
		seenModelIDs[policy.ModelID] = struct{}{}

		if policy.FrtTimeoutSeconds <= 0 {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置第 %d 行 frt_timeout_seconds 必须大于 0", index+1)
		}
		if policy.ExtraSecondsPerMB < 0 {
			return ClientGoneFallbackSettings{}, fmt.Errorf("clientgone fallback 配置第 %d 行 extra_seconds_per_mb 不能小于 0", index+1)
		}

		normalized.Policies = append(normalized.Policies, policy)
	}

	return normalized, nil
}

func ApplyClientGoneFallbackSettings(raw string) (string, error) {
	settings, err := ParseClientGoneFallbackSettings(raw)
	if err != nil {
		return "", err
	}
	clientGoneFallbackSettings = settings
	normalized, err := MarshalClientGoneFallbackSettings(settings)
	if err != nil {
		return "", err
	}
	return normalized, nil
}

func NormalizeClientGoneFallbackSettingsJSONString(raw string) (string, error) {
	settings, err := ParseClientGoneFallbackSettings(raw)
	if err != nil {
		return "", err
	}
	return MarshalClientGoneFallbackSettings(settings)
}

func MarshalClientGoneFallbackSettings(settings ClientGoneFallbackSettings) (string, error) {
	bytes, err := json.Marshal(settings)
	if err != nil {
		return "", fmt.Errorf("clientgone fallback 配置序列化失败: %w", err)
	}
	return string(bytes), nil
}

func GetClientGoneFallbackSettingsJSONString() string {
	value, err := MarshalClientGoneFallbackSettings(clientGoneFallbackSettings)
	if err != nil {
		return `{"policies":[]}`
	}
	return value
}

func FindClientGoneFallbackPolicy(modelName string) (ClientGoneFallbackPolicy, bool) {
	target := strings.TrimSpace(modelName)
	if target == "" {
		return ClientGoneFallbackPolicy{}, false
	}

	for _, policy := range clientGoneFallbackSettings.Policies {
		if !policy.Enabled {
			continue
		}
		if strings.TrimSpace(policy.ModelID) != target {
			continue
		}
		if policy.FrtTimeoutSeconds <= 0 {
			continue
		}
		return policy, true
	}
	return ClientGoneFallbackPolicy{}, false
}

// FirstByteTimeout 计算某请求的生效首字超时（秒）：frt_timeout_seconds + extra_seconds_per_mb × bodyMB。
func (p ClientGoneFallbackPolicy) FirstByteTimeoutSeconds(bodySizeBytes int64) int {
	timeout := p.FrtTimeoutSeconds
	if p.ExtraSecondsPerMB > 0 && bodySizeBytes > 0 {
		mb := int(bodySizeBytes / (1024 * 1024))
		timeout += p.ExtraSecondsPerMB * mb
	}
	return timeout
}
