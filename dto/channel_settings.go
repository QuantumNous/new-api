package dto

type ChannelSettings struct {
	ForceFormat            bool                 `json:"force_format,omitempty"`
	ThinkingToContent      bool                 `json:"thinking_to_content,omitempty"`
	Proxy                  string               `json:"proxy"`
	PassThroughBodyEnabled bool                 `json:"pass_through_body_enabled,omitempty"`
	SystemPrompt           string               `json:"system_prompt,omitempty"`
	SystemPromptOverride   bool                 `json:"system_prompt_override,omitempty"`
	BalanceQuery           *BalanceQuerySetting `json:"balance_query,omitempty"` // 下游余额查询配置（详见 docs/channel-balance-query.md）
}

// BalanceQuerySetting 下游平台余额查询配置。
// 大量下游中转站发放的是「无限额度」API Key，仅凭 Key 只能查到累计消费、查不到钱包余额；
// 要拿真实钱包余额需要补充控制台登录凭据（账密或用户级系统访问令牌）。
type BalanceQuerySetting struct {
	// Mode 余额查询模式：
	//   ""/"auto"        —— 按 base_url/Other 自动识别 provider（默认）
	//   "newapi_console" —— new-api 套壳站：用账密登录控制台拿真实钱包余额
	//   "system_token"   —— new-api 套壳站：用用户级系统访问令牌调 /api/user/self
	//   "disabled"       —— 不查询该渠道余额
	Mode string `json:"mode,omitempty"`
	// Username / Password 仅在 Mode=newapi_console 时使用
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	// Token 仅在 Mode=system_token 时使用（下游站点「个人设置」生成的系统访问令牌）
	Token string `json:"token,omitempty"`
	// Recharged 用户手填的累计充值额（仅 spend_only 档用于估算剩余 ≈ Recharged - Used）
	Recharged float64 `json:"recharged,omitempty"`
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
