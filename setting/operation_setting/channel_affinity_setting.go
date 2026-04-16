package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ChannelAffinityKeySource struct {
	Type       string `json:"type"` // context_int, context_string, request_header, gjson
	Key        string `json:"key,omitempty"`
	Path       string `json:"path,omitempty"`
	NestedPath string `json:"nested_path,omitempty"`
}

type ChannelAffinityRule struct {
	Name             string                     `json:"name"`
	ModelRegex       []string                   `json:"model_regex"`
	PathRegex        []string                   `json:"path_regex"`
	UserAgentInclude []string                   `json:"user_agent_include,omitempty"`
	KeySources       []ChannelAffinityKeySource `json:"key_sources"`

	ValueRegex string `json:"value_regex"`
	TTLSeconds int    `json:"ttl_seconds"`

	ParamOverrideTemplate map[string]interface{} `json:"param_override_template,omitempty"`

	SkipRetryOnFailure bool `json:"skip_retry_on_failure,omitempty"`

	IncludeUsingGroup bool `json:"include_using_group"`
	IncludeModelName  bool `json:"include_model_name"`
	IncludeRuleName   bool `json:"include_rule_name"`
}

type ChannelAffinitySetting struct {
	Enabled                     bool                  `json:"enabled"`
	SwitchOnSuccess             bool                  `json:"switch_on_success"`
	InvalidateStaleCacheEnabled bool                  `json:"invalidate_stale_cache_enabled"`
	RetryOnDisabledChannel      bool                  `json:"retry_on_disabled_channel"`
	RetryOnChannelQuotaExceeded bool                  `json:"retry_on_channel_quota_exceeded"`
	MaxEntries                  int                   `json:"max_entries"`
	DefaultTTLSeconds           int                   `json:"default_ttl_seconds"`
	Rules                       []ChannelAffinityRule `json:"rules"`
}

var codexCliPassThroughHeaders = []string{
	"Originator",
	"Session_id",
	"User-Agent",
	"X-Codex-Beta-Features",
	"X-Codex-Turn-Metadata",
}

var claudeCliPassThroughHeaders = []string{
	"X-Stainless-Arch",
	"X-Stainless-Lang",
	"X-Stainless-Os",
	"X-Stainless-Package-Version",
	"X-Stainless-Retry-Count",
	"X-Stainless-Runtime",
	"X-Stainless-Runtime-Version",
	"X-Stainless-Timeout",
	"User-Agent",
	"X-App",
	"X-Claude-Code-Session-Id",
	"Anthropic-Beta",
	"Anthropic-Dangerous-Direct-Browser-Access",
	"Anthropic-Version",
}

func buildPassHeaderTemplate(headers []string) map[string]interface{} {
	clonedHeaders := make([]string, 0, len(headers))
	clonedHeaders = append(clonedHeaders, headers...)
	return map[string]interface{}{
		"operations": []map[string]interface{}{
			{
				"mode":        "pass_headers",
				"value":       clonedHeaders,
				"keep_origin": true,
			},
		},
	}
}

func buildClaudeCliHeaderTemplate(headers []string) map[string]interface{} {
	clonedHeaders := make([]string, 0, len(headers))
	clonedHeaders = append(clonedHeaders, headers...)
	return map[string]interface{}{
		"operations": []map[string]interface{}{
			{
				"mode":        "pass_headers",
				"value":       clonedHeaders,
				"keep_origin": true,
			},
			{
				"mode": "sync_fields",
				"from": "context:channel_affinity.key",
				"to":   "header:session_id",
			},
			{
				"mode": "sync_fields",
				"from": "context:channel_affinity.key",
				"to":   "json:prompt_cache_key",
			},
		},
	}
}

var channelAffinitySetting = ChannelAffinitySetting{
	Enabled:                     true,
	SwitchOnSuccess:             true,
	InvalidateStaleCacheEnabled: true,
	RetryOnDisabledChannel:      true,
	RetryOnChannelQuotaExceeded: true,
	MaxEntries:                  100_000,
	DefaultTTLSeconds:           3600,
	Rules: []ChannelAffinityRule{
		{
			Name:       "codex cli trace",
			ModelRegex: []string{"^gpt-.*$"},
			PathRegex:  []string{"/v1/responses"},
			KeySources: []ChannelAffinityKeySource{
				{Type: "gjson", Path: "prompt_cache_key"},
			},
			ValueRegex:            "",
			TTLSeconds:            0,
			ParamOverrideTemplate: buildPassHeaderTemplate(codexCliPassThroughHeaders),
			SkipRetryOnFailure:    true,
			IncludeUsingGroup:     true,
			IncludeRuleName:       true,
			UserAgentInclude:      nil,
		},
		{
			Name:       "claude cli trace",
			ModelRegex: []string{"^claude-.*$", "^gpt-.*$"},
			PathRegex:  []string{"/v1/messages"},
			KeySources: []ChannelAffinityKeySource{
				{Type: "request_header", Key: "X-Claude-Code-Session-Id"},
				{Type: "gjson", Path: "metadata.user_id", NestedPath: "session_id"},
			},
			ValueRegex:            "",
			TTLSeconds:            0,
			ParamOverrideTemplate: buildClaudeCliHeaderTemplate(claudeCliPassThroughHeaders),
			SkipRetryOnFailure:    true,
			IncludeUsingGroup:     true,
			IncludeRuleName:       true,
			UserAgentInclude:      nil,
		},
	},
}

func init() {
	config.GlobalConfig.Register("channel_affinity_setting", &channelAffinitySetting)
}

func GetChannelAffinitySetting() *ChannelAffinitySetting {
	return &channelAffinitySetting
}
