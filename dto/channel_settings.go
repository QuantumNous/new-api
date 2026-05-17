package dto

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
	BalanceQuery                          BalanceQuery  `json:"balance_query,omitempty"`                              // 渠道余额查询配置
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}

type BalanceQuery struct {
	Enabled         bool                        `json:"enabled,omitempty"`
	Template        string                      `json:"template,omitempty"`
	IntervalSeconds *int                        `json:"interval_seconds,omitempty"`
	SourceChannelID int                         `json:"source_channel_id,omitempty"`
	AccessToken     string                      `json:"access_token,omitempty"`
	UserID          string                      `json:"user_id,omitempty"`
	Request         BalanceQueryRequestConfig   `json:"request,omitempty"`
	Extractor       BalanceQueryExtractorConfig `json:"extractor,omitempty"`
	LastResult      *BalanceQueryResult         `json:"last_result,omitempty"`
	LastCheckTime   int64                       `json:"last_check_time,omitempty"`
	LastError       string                      `json:"last_error,omitempty"`
}

type BalanceQueryRequestConfig struct {
	URL     string            `json:"url,omitempty"`
	Method  string            `json:"method,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Body    string            `json:"body,omitempty"`
}

type BalanceQueryExtractorConfig struct {
	PlanNamePath    string  `json:"plan_name_path,omitempty"`
	RemainingPath   string  `json:"remaining_path,omitempty"`
	UsedPath        string  `json:"used_path,omitempty"`
	TotalPath       string  `json:"total_path,omitempty"`
	UnitPath        string  `json:"unit_path,omitempty"`
	Unit            string  `json:"unit,omitempty"`
	Divisor         float64 `json:"divisor,omitempty"`
	SuccessPath     string  `json:"success_path,omitempty"`
	SuccessValue    string  `json:"success_value,omitempty"`
	SuccessOptional bool    `json:"success_optional,omitempty"`
	MessagePath     string  `json:"message_path,omitempty"`
}

type BalanceQueryResult struct {
	IsValid        bool    `json:"is_valid"`
	InvalidMessage string  `json:"invalid_message,omitempty"`
	PlanName       string  `json:"plan_name,omitempty"`
	Remaining      float64 `json:"remaining,omitempty"`
	Used           float64 `json:"used,omitempty"`
	Total          float64 `json:"total,omitempty"`
	Unit           string  `json:"unit,omitempty"`
	CheckedAt      int64   `json:"checked_at,omitempty"`
}
