package dto

import (
	"fmt"
	"strings"
)

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`
	// Image2Capability is an opt-in declaration used by the Image2 smart
	// router. It deliberately describes capabilities instead of channel IDs so
	// operators can change upstreams without a code deployment.
	Image2Capability *Image2ChannelCapability `json:"image2_capability,omitempty"`
}

// Image2ChannelCapability declares the Image2 request shapes an upstream can
// safely accept. RoutePriority is only compared among compatible candidates;
// it is not a price, channel priority, or weight.
type Image2ChannelCapability struct {
	Enabled       bool     `json:"enabled,omitempty"`
	Operations    []string `json:"operations,omitempty"`  // generations, edits
	Resolutions   []string `json:"resolutions,omitempty"` // 1024, 2048, uhd
	Qualities     []string `json:"qualities,omitempty"`
	MaxN          uint     `json:"max_n,omitempty"` // zero means no declared limit
	RoutePriority int      `json:"route_priority,omitempty"`
	EditsAccepted bool     `json:"edits_accepted,omitempty"`
}

func (capability *Image2ChannelCapability) Validate() error {
	if capability == nil {
		return nil
	}
	if !capability.Enabled {
		return nil
	}
	if len(capability.Operations) == 0 {
		return fmt.Errorf("image2_capability.operations is required when enabled")
	}
	if len(capability.Resolutions) == 0 {
		return fmt.Errorf("image2_capability.resolutions is required when enabled")
	}
	if err := validateImage2CapabilityValues("operations", capability.Operations, map[string]struct{}{
		"generations": {},
		"edits":       {},
	}); err != nil {
		return err
	}
	if err := validateImage2CapabilityValues("resolutions", capability.Resolutions, map[string]struct{}{
		"1024": {},
		"2048": {},
		"uhd":  {},
	}); err != nil {
		return err
	}
	if !capability.EditsAccepted {
		for _, operation := range capability.Operations {
			if strings.EqualFold(strings.TrimSpace(operation), "edits") {
				return fmt.Errorf("image2_capability.edits_accepted must be true when operations includes edits")
			}
		}
	}
	for _, quality := range capability.Qualities {
		if strings.TrimSpace(quality) == "" {
			return fmt.Errorf("image2_capability.qualities cannot contain an empty value")
		}
	}
	return nil
}

func validateImage2CapabilityValues(field string, values []string, allowed map[string]struct{}) error {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		if _, ok := allowed[normalized]; !ok {
			return fmt.Errorf("image2_capability.%s contains unsupported value %q", field, value)
		}
		if _, duplicate := seen[normalized]; duplicate {
			return fmt.Errorf("image2_capability.%s contains duplicate value %q", field, value)
		}
		seen[normalized] = struct{}{}
	}
	return nil
}

type VertexKeyType string

const (
	VertexKeyTypeJSON   VertexKeyType = "json"
	VertexKeyTypeAPIKey VertexKeyType = "api_key"
)

type AwsKeyType string

const (
	AwsKeyTypeAKSK   AwsKeyType = "ak_sk" // 默认
	AwsKeyTypeApiKey AwsKeyType = "api_key"
)

type ChannelOtherSettings struct {
	AzureResponsesVersion                 string        `json:"azure_responses_version,omitempty"`
	VertexKeyType                         VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise                  *bool         `json:"openrouter_enterprise,omitempty"`
	ClaudeBetaQuery                       bool          `json:"claude_beta_query,omitempty"`         // Claude 渠道是否强制追加 ?beta=true
	AllowServiceTier                      bool          `json:"allow_service_tier,omitempty"`        // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	AllowInferenceGeo                     bool          `json:"allow_inference_geo,omitempty"`       // 是否允许 inference_geo 透传（仅 Claude，默认过滤以满足数据驻留合规
	AllowSpeed                            bool          `json:"allow_speed,omitempty"`               // 是否允许 speed 透传（仅 Claude，默认过滤以避免意外切换推理速度模式）
	AllowSafetyIdentifier                 bool          `json:"allow_safety_identifier,omitempty"`   // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	DisableStore                          bool          `json:"disable_store,omitempty"`             // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowIncludeObfuscation               bool          `json:"allow_include_obfuscation,omitempty"` // 是否允许 stream_options.include_obfuscation 透传（默认过滤以避免关闭流混淆保护）
	AwsKeyType                            AwsKeyType    `json:"aws_key_type,omitempty"`
	UpstreamModelUpdateCheckEnabled       bool          `json:"upstream_model_update_check_enabled,omitempty"`        // 是否检测上游模型更新
	UpstreamModelUpdateAutoSyncEnabled    bool          `json:"upstream_model_update_auto_sync_enabled,omitempty"`    // 是否自动同步上游模型更新
	UpstreamModelUpdateLastCheckTime      int64         `json:"upstream_model_update_last_check_time,omitempty"`      // 上次检测时间
	UpstreamModelUpdateLastDetectedModels []string      `json:"upstream_model_update_last_detected_models,omitempty"` // 上次检测到的可加入模型
	UpstreamModelUpdateLastRemovedModels  []string      `json:"upstream_model_update_last_removed_models,omitempty"`  // 上次检测到的可删除模型
	UpstreamModelUpdateIgnoredModels      []string      `json:"upstream_model_update_ignored_models,omitempty"`       // 手动忽略的模型
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
