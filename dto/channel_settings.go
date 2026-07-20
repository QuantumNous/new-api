package dto

import "fmt"

type ChannelSettings struct {
	ForceFormat            bool   `json:"force_format,omitempty"`
	ThinkingToContent      bool   `json:"thinking_to_content,omitempty"`
	Proxy                  string `json:"proxy"`
	PassThroughBodyEnabled bool   `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool   `json:"system_prompt_override,omitempty"`
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

// GptImage2EndpointCapabilities describes the request shapes an upstream can
// accept for one Images API endpoint. A nil endpoint config means unsupported.
// OptionalFields contains request field names accepted by the upstream; "*"
// permits every currently known optional field. AllowedValues and DeniedValues
// provide per-field value constraints (case-insensitive).
type GptImage2EndpointCapabilities struct {
	Enabled              bool                `json:"enabled"`
	Multipart            bool                `json:"multipart"`
	UploadedImage        bool                `json:"uploaded_image"`
	UploadedMask         bool                `json:"uploaded_mask"`
	RequireUploadedImage bool                `json:"require_uploaded_image,omitempty"`
	MaxN                 int                 `json:"max_n"`
	MaxImageURLs         int                 `json:"max_image_urls"`
	MaskURL              bool                `json:"mask_url"`
	Stream               bool                `json:"stream"`
	PartialImages        bool                `json:"partial_images"`
	OptionalFields       []string            `json:"optional_fields,omitempty"`
	AllowedValues        map[string][]string `json:"allowed_values,omitempty"`
	DeniedValues         map[string][]string `json:"denied_values,omitempty"`
}

type GptImage2SizeFormat string

const (
	// GptImage2SizeFormatAspectRatioWithResolution means the upstream accepts
	// requests such as size="1:1" plus resolution="1k" directly.
	GptImage2SizeFormatAspectRatioWithResolution GptImage2SizeFormat = "aspect_ratio_with_resolution"
	// GptImage2SizeFormatPixelDimensions means the upstream expects size as
	// WIDTHxHEIGHT. The relay maps aspect ratio + resolution before forwarding.
	GptImage2SizeFormatPixelDimensions GptImage2SizeFormat = "pixel_dimensions"
)

// GptImage2Capabilities is stored in channels.settings. Once present it is the
// authoritative compatibility contract for the channel, replacing legacy
// channel-ID checks. Keeping endpoint configs as pointers preserves the
// distinction between "not configured" and an explicitly disabled endpoint.
type GptImage2Capabilities struct {
	Version          int                            `json:"version"`
	Enabled          bool                           `json:"enabled"`
	OfficialAlias    bool                           `json:"official_alias"`
	SizeFormat       GptImage2SizeFormat            `json:"size_format,omitempty"`
	Generations      *GptImage2EndpointCapabilities `json:"generations,omitempty"`
	AsyncGenerations *GptImage2EndpointCapabilities `json:"async_generations,omitempty"`
	Edits            *GptImage2EndpointCapabilities `json:"edits,omitempty"`
}

func (c *GptImage2Capabilities) Validate() error {
	if c == nil {
		return nil
	}
	if c.Version != 1 {
		return fmt.Errorf("gpt_image2_capabilities.version must be 1")
	}
	if c.SizeFormat != "" &&
		c.SizeFormat != GptImage2SizeFormatAspectRatioWithResolution &&
		c.SizeFormat != GptImage2SizeFormatPixelDimensions {
		return fmt.Errorf("gpt_image2_capabilities.size_format must be %q or %q",
			GptImage2SizeFormatAspectRatioWithResolution,
			GptImage2SizeFormatPixelDimensions)
	}
	for name, endpoint := range map[string]*GptImage2EndpointCapabilities{
		"generations": c.Generations, "async_generations": c.AsyncGenerations, "edits": c.Edits,
	} {
		if endpoint == nil || !endpoint.Enabled {
			continue
		}
		if endpoint.MaxN < 1 {
			return fmt.Errorf("gpt_image2_capabilities.%s.max_n must be at least 1", name)
		}
		if endpoint.MaxImageURLs < 0 {
			return fmt.Errorf("gpt_image2_capabilities.%s.max_image_urls cannot be negative", name)
		}
	}
	return nil
}

type ChannelOtherSettings struct {
	AzureResponsesVersion                 string                 `json:"azure_responses_version,omitempty"`
	VertexKeyType                         VertexKeyType          `json:"vertex_key_type,omitempty"` // "json" or "api_key"
	OpenRouterEnterprise                  *bool                  `json:"openrouter_enterprise,omitempty"`
	ClaudeBetaQuery                       bool                   `json:"claude_beta_query,omitempty"`         // Claude 渠道是否强制追加 ?beta=true
	AllowServiceTier                      bool                   `json:"allow_service_tier,omitempty"`        // 是否允许 service_tier 透传（默认过滤以避免额外计费）
	AllowInferenceGeo                     bool                   `json:"allow_inference_geo,omitempty"`       // 是否允许 inference_geo 透传（仅 Claude，默认过滤以满足数据驻留合规
	AllowSpeed                            bool                   `json:"allow_speed,omitempty"`               // 是否允许 speed 透传（仅 Claude，默认过滤以避免意外切换推理速度模式）
	AllowSafetyIdentifier                 bool                   `json:"allow_safety_identifier,omitempty"`   // 是否允许 safety_identifier 透传（默认过滤以保护用户隐私）
	DisableStore                          bool                   `json:"disable_store,omitempty"`             // 是否禁用 store 透传（默认允许透传，禁用后可能导致 Codex 无法使用）
	AllowIncludeObfuscation               bool                   `json:"allow_include_obfuscation,omitempty"` // 是否允许 stream_options.include_obfuscation 透传（默认过滤以避免关闭流混淆保护）
	AwsKeyType                            AwsKeyType             `json:"aws_key_type,omitempty"`
	UpstreamModelUpdateCheckEnabled       bool                   `json:"upstream_model_update_check_enabled,omitempty"`        // 是否检测上游模型更新
	UpstreamModelUpdateAutoSyncEnabled    bool                   `json:"upstream_model_update_auto_sync_enabled,omitempty"`    // 是否自动同步上游模型更新
	UpstreamModelUpdateLastCheckTime      int64                  `json:"upstream_model_update_last_check_time,omitempty"`      // 上次检测时间
	UpstreamModelUpdateLastDetectedModels []string               `json:"upstream_model_update_last_detected_models,omitempty"` // 上次检测到的可加入模型
	UpstreamModelUpdateLastRemovedModels  []string               `json:"upstream_model_update_last_removed_models,omitempty"`  // 上次检测到的可删除模型
	UpstreamModelUpdateIgnoredModels      []string               `json:"upstream_model_update_ignored_models,omitempty"`       // 手动忽略的模型
	GptImage2Tier                         string                 `json:"gpt_image2_tier,omitempty"`                            // "standard" | "packy" | "official" for gpt-image-2 routing
	GptImage2Capabilities                 *GptImage2Capabilities `json:"gpt_image2_capabilities,omitempty"`                    // Config-driven Images API compatibility contract
	ImageGenerationSubmitPath             string                 `json:"image_generation_submit_path,omitempty"`               // "auto" | "generations" | "generations_async"
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
