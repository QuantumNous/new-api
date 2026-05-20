package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// ChannelAffinityKeySource 定义渠道亲和规则的 key 提取来源。
//
// 编写时间：2026-05-17
// 作者：苍朮
// 用途：描述渠道亲和规则从上下文、请求头、请求体 JSON 路径或 Claude prompt cache 信号中提取稳定 key 的方式。
// 参数说明：无；该类型通过 Type、Key、Path 字段承载配置参数。
// 返回值说明：无；该类型用于配置反序列化和规则匹配。
type ChannelAffinityKeySource struct {
	Type string `json:"type"` // context_int, context_string, request_header, gjson, claude_prompt_cache_key
	Key  string `json:"key,omitempty"`
	Path string `json:"path,omitempty"`
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

	SkipRetryOnFailure bool `json:"skip_retry_on_failure"`

	IncludeUsingGroup bool `json:"include_using_group"`
	IncludeModelName  bool `json:"include_model_name"`
	IncludeRuleName   bool `json:"include_rule_name"`
}

type ChannelAffinitySetting struct {
	Enabled           bool                  `json:"enabled"`
	SwitchOnSuccess   bool                  `json:"switch_on_success"`
	MaxEntries        int                   `json:"max_entries"`
	DefaultTTLSeconds int                   `json:"default_ttl_seconds"`
	Rules             []ChannelAffinityRule `json:"rules"`
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

var channelAffinitySetting = ChannelAffinitySetting{
	Enabled:           true,
	SwitchOnSuccess:   true,
	MaxEntries:        100_000,
	DefaultTTLSeconds: 3600,
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
			ModelRegex: []string{"^claude-.*$"},
			PathRegex:  []string{"/v1/messages"},
			KeySources: []ChannelAffinityKeySource{
				{Type: "gjson", Path: "metadata.user_id"},
				{Type: "claude_prompt_cache_key"},
			},
			ValueRegex:            "",
			TTLSeconds:            0,
			ParamOverrideTemplate: buildPassHeaderTemplate(claudeCliPassThroughHeaders),
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
