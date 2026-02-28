package dto

import "strings"

const (
	TLSFingerprintDefault  = ""
	TLSFingerprintChrome   = "chrome"
	TLSFingerprintFirefox  = "firefox"
	TLSFingerprintSafari   = "safari"
	TLSFingerprintEdge     = "edge"
	TLSFingerprintCustom   = "custom"
	TLSFingerprintDisabled = "default"
)

func NormalizeTLSFingerprint(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == TLSFingerprintDisabled {
		return TLSFingerprintDefault
	}
	return normalized
}

func IsValidTLSFingerprint(value string) bool {
	switch NormalizeTLSFingerprint(value) {
	case TLSFingerprintDefault, TLSFingerprintChrome, TLSFingerprintFirefox, TLSFingerprintSafari, TLSFingerprintEdge, TLSFingerprintCustom:
		return true
	default:
		return false
	}
}

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`
	TLSFingerprint         string `json:"tls_fingerprint,omitempty"`
	TLSCustom              string `json:"tls_custom,omitempty"`
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
	AzureResponsesVersion   string        `json:"azure_responses_version,omitempty"`
	VertexKeyType           VertexKeyType `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise    *bool         `json:"openrouter_enterprise,omitempty"`
	ClaudeBetaQuery         bool          `json:"claude_beta_query,omitempty"`         // Claude 渠道是否强制追加 ?beta=true
	AllowServiceTier        bool          `json:"allow_service_tier,omitempty"`        // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	AllowInferenceGeo       bool          `json:"allow_inference_geo,omitempty"`       // 是否允许 inference_geo 透传（仅 Claude，默认过滤以满足数据驻留合规）
	DisableStore            bool          `json:"disable_store,omitempty"`             // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowSafetyIdentifier   bool          `json:"allow_safety_identifier,omitempty"`   // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	AllowIncludeObfuscation bool          `json:"allow_include_obfuscation,omitempty"` // 是否允许 stream_options.include_obfuscation 透传（默认过滤以避免关闭流混淆保护）
	AwsKeyType              AwsKeyType    `json:"aws_key_type,omitempty"`
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
