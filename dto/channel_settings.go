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

	// VolcTTS holds Volcengine TTS protocol-specific overrides for v3 endpoints
	// (bidirectional / unidirectional WS, HTTP Chunked, HTTP SSE).
	// nil/empty means "use legacy v1 ws_binary" for backward compatibility.
	VolcTTS *VolcTTSConfig `json:"volc_tts,omitempty"`
}

// Volcengine TTS protocol constants. Keep in sync with frontend selects.
const (
	VolcTTSProtocolV1WsBinary    = "v1_ws_binary"     // legacy default (omitted == this)
	VolcTTSProtocolV3WsBidir     = "v3_ws_bidir"      // wss://.../api/v3/tts/bidirection
	VolcTTSProtocolV3WsUni       = "v3_ws_uni"        // wss://.../api/v3/tts/unidirectional/stream
	VolcTTSProtocolV3HTTPChunked = "v3_http_chunked"  // https://.../api/v3/tts/unidirectional
	VolcTTSProtocolV3HTTPSSE     = "v3_http_sse"      // https://.../api/v3/tts/unidirectional/sse (passthrough)

	VolcTTSAuthModeNewConsole = "new_console" // X-Api-Key (default)
	VolcTTSAuthModeLegacy     = "legacy"      // X-Api-App-Id + X-Api-Access-Key

	// VolcTTSDefaultResourceID matches the default OpenAI->Volcengine voice
	// mapping (alloy/echo/fable/... -> *_mars_bigtts, all v1.0 voices). Users
	// who pass an explicit v2.0 voice (*_uranus_bigtts / saturn_*) MUST also
	// override this to seed-tts-2.0 / seed-icl-2.0 in the channel config or via
	// metadata.volc_tts_resource_id, otherwise upstream returns code=55000000
	// "resource ID is mismatched with speaker related resource".
	VolcTTSDefaultResourceID = "seed-tts-1.0-concurr"
)

// VolcTTSConfig is the per-channel Volcengine TTS configuration. All fields are
// optional; empty values fall back to safe defaults (v1 ws_binary, new console
// auth, seed-tts-1.0-concurr resource id — matching the default voice map).
type VolcTTSConfig struct {
	Protocol     string `json:"protocol,omitempty"`      // see VolcTTSProtocol* constants
	ResourceID   string `json:"resource_id,omitempty"`   // X-Api-Resource-Id (e.g. "seed-tts-2.0")
	AuthMode     string `json:"auth_mode,omitempty"`     // see VolcTTSAuthMode* constants
	RequireUsage *bool  `json:"require_usage,omitempty"` // emit X-Control-Require-Usage-Tokens-Return; default true (Rule 6)
}

// IsV3 reports whether the resolved protocol is any v3 transport.
func (c VolcTTSConfig) IsV3() bool {
	switch c.Protocol {
	case VolcTTSProtocolV3WsBidir, VolcTTSProtocolV3WsUni,
		VolcTTSProtocolV3HTTPChunked, VolcTTSProtocolV3HTTPSSE:
		return true
	}
	return false
}

// EffectiveResourceID returns ResourceID or the v3 default when empty.
func (c VolcTTSConfig) EffectiveResourceID() string {
	if c.ResourceID != "" {
		return c.ResourceID
	}
	return VolcTTSDefaultResourceID
}

// EffectiveAuthMode returns AuthMode or "new_console" when empty.
func (c VolcTTSConfig) EffectiveAuthMode() string {
	if c.AuthMode == VolcTTSAuthModeLegacy {
		return VolcTTSAuthModeLegacy
	}
	return VolcTTSAuthModeNewConsole
}

// ShouldRequireUsage returns true unless RequireUsage was explicitly set false.
func (c VolcTTSConfig) ShouldRequireUsage() bool {
	if c.RequireUsage == nil {
		return true
	}
	return *c.RequireUsage
}

func (s *ChannelOtherSettings) ResolvedVolcTTS() VolcTTSConfig {
	if s == nil || s.VolcTTS == nil {
		return VolcTTSConfig{}
	}
	return *s.VolcTTS
}

func (s *ChannelOtherSettings) IsOpenRouterEnterprise() bool {
	if s == nil || s.OpenRouterEnterprise == nil {
		return false
	}
	return *s.OpenRouterEnterprise
}
