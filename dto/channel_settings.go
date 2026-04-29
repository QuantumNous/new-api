package dto

import (
	"fmt"
	"time"
)

const (
	DefaultRequestTimeoutSeconds              = 80
	DefaultResponseHeaderTimeoutSeconds       = 60
	DefaultStreamResponseHeaderTimeoutSeconds = 20
	DefaultStreamIdleTimeoutSeconds           = 15
)

type ChannelTimeoutDefaults struct {
	RequestTimeoutEnabled              bool `json:"request_timeout_enabled"`
	RequestTimeoutSeconds              int  `json:"request_timeout_seconds"`
	ResponseHeaderTimeoutEnabled       bool `json:"response_header_timeout_enabled"`
	ResponseHeaderTimeoutSeconds       int  `json:"response_header_timeout_seconds"`
	StreamIdleTimeoutEnabled           bool `json:"stream_idle_timeout_enabled"`
	StreamIdleTimeoutSeconds           int  `json:"stream_idle_timeout_seconds"`
	StreamResponseHeaderTimeoutEnabled bool `json:"stream_response_header_timeout_enabled"`
	StreamResponseHeaderTimeoutSeconds int  `json:"stream_response_header_timeout_seconds"`
}

func GetChannelTimeoutDefaults() ChannelTimeoutDefaults {
	return ChannelTimeoutDefaults{
		RequestTimeoutEnabled:              true,
		RequestTimeoutSeconds:              DefaultRequestTimeoutSeconds,
		ResponseHeaderTimeoutEnabled:       true,
		ResponseHeaderTimeoutSeconds:       DefaultResponseHeaderTimeoutSeconds,
		StreamIdleTimeoutEnabled:           true,
		StreamIdleTimeoutSeconds:           DefaultStreamIdleTimeoutSeconds,
		StreamResponseHeaderTimeoutEnabled: true,
		StreamResponseHeaderTimeoutSeconds: DefaultStreamResponseHeaderTimeoutSeconds,
	}
}

type ChannelSettings struct {
	ForceFormat                        bool     `json:"force_format,omitempty"`
	ThinkingToContent                  bool     `json:"thinking_to_content,omitempty"`
	Proxy                              string   `json:"proxy"`
	PassThroughBodyEnabled             bool     `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt                       string   `json:"system_prompt,omitempty"`
	SystemPromptOverride               bool     `json:"system_prompt_override,omitempty"`
	CostRatio                          *float64 `json:"cost_ratio,omitempty"`
	RequestTimeoutEnabled              *bool    `json:"request_timeout_enabled,omitempty"`
	RequestTimeoutSeconds              *int     `json:"request_timeout_seconds,omitempty"`
	ResponseHeaderTimeoutEnabled       *bool    `json:"response_header_timeout_enabled,omitempty"`
	ResponseHeaderTimeoutSeconds       *int     `json:"response_header_timeout_seconds,omitempty"`
	StreamIdleTimeoutEnabled           *bool    `json:"stream_idle_timeout_enabled,omitempty"`
	StreamIdleTimeoutSeconds           *int     `json:"stream_idle_timeout_seconds,omitempty"`
	StreamResponseHeaderTimeoutEnabled *bool    `json:"stream_response_header_timeout_enabled,omitempty"`
	StreamResponseHeaderTimeoutSeconds *int     `json:"stream_response_header_timeout_seconds,omitempty"`
}

func (s ChannelSettings) GetCostRatio() float64 {
	if s.CostRatio == nil {
		return 1
	}
	if *s.CostRatio < 0 {
		return 1
	}
	return *s.CostRatio
}

func (s ChannelSettings) Validate() error {
	if err := validateTimeoutSetting("非流式请求超时", s.RequestTimeoutEnabled, s.RequestTimeoutSeconds); err != nil {
		return err
	}
	if err := validateTimeoutSetting("非流式响应头超时", s.ResponseHeaderTimeoutEnabled, s.ResponseHeaderTimeoutSeconds); err != nil {
		return err
	}
	if err := validateTimeoutSetting("流式空闲超时", s.StreamIdleTimeoutEnabled, s.StreamIdleTimeoutSeconds); err != nil {
		return err
	}
	if err := validateTimeoutSetting("流式响应头超时", s.StreamResponseHeaderTimeoutEnabled, s.StreamResponseHeaderTimeoutSeconds); err != nil {
		return err
	}
	return nil
}

func (s ChannelSettings) ResolveRequestTimeoutOverride(isStream bool) (time.Duration, bool) {
	if isStream {
		return 0, false
	}
	return resolveTimeoutOverride(s.RequestTimeoutEnabled, s.RequestTimeoutSeconds, DefaultRequestTimeoutSeconds)
}

func (s ChannelSettings) ResolveResponseHeaderTimeoutOverride(isStream bool) (time.Duration, bool) {
	if isStream {
		return resolveTimeoutOverride(s.StreamResponseHeaderTimeoutEnabled, s.StreamResponseHeaderTimeoutSeconds, DefaultStreamResponseHeaderTimeoutSeconds)
	}
	return resolveTimeoutOverride(s.ResponseHeaderTimeoutEnabled, s.ResponseHeaderTimeoutSeconds, DefaultResponseHeaderTimeoutSeconds)
}

func (s ChannelSettings) ResolveStreamIdleTimeoutOverride() (time.Duration, bool) {
	return resolveTimeoutOverride(s.StreamIdleTimeoutEnabled, s.StreamIdleTimeoutSeconds, DefaultStreamIdleTimeoutSeconds)
}

func resolveTimeoutOverride(enabled *bool, seconds *int, defaultSeconds int) (time.Duration, bool) {
	if enabled != nil && !*enabled {
		return 0, true
	}
	if seconds == nil {
		return time.Duration(defaultSeconds) * time.Second, true
	}
	return time.Duration(*seconds) * time.Second, true
}

func validateTimeoutSetting(name string, enabled *bool, seconds *int) error {
	if seconds != nil && *seconds <= 0 {
		return fmt.Errorf("%s必须大于 0 秒", name)
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
