package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type ChannelAffinityKeySource struct {
	Type string `json:"type"` // context_int, context_string, gjson
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

	SkipRetryOnFailure bool `json:"skip_retry_on_failure,omitempty"`

	IncludeUsingGroup bool `json:"include_using_group"`
	IncludeRuleName   bool `json:"include_rule_name"`
}

type ChannelAffinitySetting struct {
	Enabled           bool                  `json:"enabled"`
	SwitchOnSuccess   bool                  `json:"switch_on_success"`
	MaxEntries        int                   `json:"max_entries"`
	DefaultTTLSeconds int                   `json:"default_ttl_seconds"`
	Rules             []ChannelAffinityRule `json:"rules"`
}

var channelAffinitySetting = ChannelAffinitySetting{
	Enabled:           false,
	SwitchOnSuccess:   true,
	MaxEntries:        100_000,
	DefaultTTLSeconds: 3600,
	Rules:             []ChannelAffinityRule{},
}

func init() {
	config.GlobalConfig.Register("channel_affinity_setting", &channelAffinitySetting)
}

func GetChannelAffinitySetting() *ChannelAffinitySetting {
	return &channelAffinitySetting
}
