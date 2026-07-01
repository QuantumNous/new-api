package system_setting

import "fmt"

var VolcAssetConfig = VolcAssetSettings{}

const (
	// AssetFormatVolcengine is an official built-in outbound: Volcengine Ark direct
	// connection with AK/SK HMAC signing. Only this format needs to be built in—HMAC
	// signing cannot be expressed as a template; use a custom format template for
	// other protocols (such as Volcengine-compatible gateways).
	AssetFormatVolcengine = "volcengine"
	// AssetFormatNewAPI is an official built-in outbound targeting another new-api
	// instance's asset endpoints (path-style Action + Bearer), used for nesting.
	AssetFormatNewAPI = "newapi"
)

const (
	// DefaultOutboundSelectorHeader is the request header clients use to select an
	// outbound (its value is the outbound Id).
	DefaultOutboundSelectorHeader = "X-Asset-Outbound"
	// defaultOutboundId is the stable identifier used when an outbound has no Id.
	defaultOutboundId = "default"
)

// AssetAuthSpec describes the auth scheme for a custom outbound format. Value
// supports template placeholders:
// {access_key} {secret_key} {access_token} {project_name} {region} {group_type}.
type AssetAuthSpec struct {
	Type  string `json:"type,omitempty"` // none | header | query | bearer
	Name  string `json:"name,omitempty"` // header/query name
	Value string `json:"value,omitempty"`
}

// AssetFieldMap describes one JSON field move: it writes the value at the From
// path (gjson) to the To path (sjson).
type AssetFieldMap struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// AssetActionTemplate describes how one action (or the default for a group of
// actions) builds the upstream request and parses the upstream response.
type AssetActionTemplate struct {
	// Method is the upstream HTTP method; defaults to POST.
	Method string `json:"method,omitempty"`
	// URLTemplate is the upstream URL template; supports {base_url} {action} {field:<canonicalPath>} placeholders.
	URLTemplate string `json:"url_template,omitempty"`
	// Headers are extra static request headers (values support template placeholders).
	Headers map[string]string `json:"headers,omitempty"`
	// RequestStatic are static fields written into the upstream request body; keys are sjson paths and values support template placeholders.
	RequestStatic map[string]string `json:"request_static,omitempty"`
	// RequestMapping moves fields from the canonical request body into the upstream request body.
	RequestMapping []AssetFieldMap `json:"request_mapping,omitempty"`
	// RequestPassthrough, when true, passes the canonical request body through directly (RequestStatic is still applied on top).
	RequestPassthrough bool `json:"request_passthrough,omitempty"`
	// ResultPath is the gjson path to the "result" in the upstream response; empty means the whole response body is the result.
	ResultPath string `json:"result_path,omitempty"`
	// ErrorCodePath / ErrorMessagePath are the paths to the upstream business error code/message; a non-empty error code is treated as failure.
	ErrorCodePath    string `json:"error_code_path,omitempty"`
	ErrorMessagePath string `json:"error_message_path,omitempty"`
	// ItemsPath is the path to the array in a list result (relative to ResultPath); combined with ItemMapping it normalizes each element.
	ItemsPath   string          `json:"items_path,omitempty"`
	ItemMapping []AssetFieldMap `json:"item_mapping,omitempty"`
	// ResponseMapping moves scalar fields from the upstream result (relative to ResultPath) into the canonical result.
	ResponseMapping []AssetFieldMap `json:"response_mapping,omitempty"`
}

// AssetCustomFormat is a user-defined outbound format template. The embedded
// AssetActionTemplate is the default for all actions, and Actions can override
// individual actions. This lets one default template cover every action while
// still customizing the actions that differ.
type AssetCustomFormat struct {
	Id   string        `json:"id"`
	Name string        `json:"name,omitempty"`
	Auth AssetAuthSpec `json:"auth"`
	AssetActionTemplate
	Actions map[string]AssetActionTemplate `json:"actions,omitempty"`
}

// AssetOutbound is an egress: the format, credentials and base URL new-api uses
// to reach an upstream asset service.
type AssetOutbound struct {
	Id          string `json:"id"`
	Name        string `json:"name,omitempty"`
	Format      string `json:"format"` // built-in: volcengine | newapi; or a custom format Id
	BaseURL     string `json:"base_url,omitempty"`
	Region      string `json:"region,omitempty"`
	ProjectName string `json:"project_name,omitempty"`
	GroupType   string `json:"group_type,omitempty"`
	AccessKey   string `json:"access_key,omitempty"`
	SecretKey   string `json:"secret_key,omitempty"`
	AccessToken string `json:"access_token,omitempty"`
	// Disabled, when true, excludes the outbound from resolution (default false means enabled).
	Disabled bool `json:"disabled,omitempty"`
}

// VolcAssetSettings is the system-level config of the asset gateway: the inbound is
// fixed to the canonical (Volcengine-native) format, while multiple outbounds can be configured.
type VolcAssetSettings struct {
	// Outbounds is the list of outbounds; multiple can be configured.
	Outbounds []AssetOutbound `json:"outbounds"`
	// DefaultOutbound is the outbound Id used when the client does not specify one.
	DefaultOutbound string `json:"default_outbound,omitempty"`
	// OutboundSelectorHeader is the request header name clients use to select an outbound (defaults to X-Asset-Outbound).
	OutboundSelectorHeader string `json:"outbound_selector_header,omitempty"`
	// Failover, when true, falls back in order to other enabled outbounds when the selected/default outbound is unavailable.
	Failover bool `json:"failover,omitempty"`
	// CustomFormats are custom outbound format templates, referenced by Id from Outbound.Format.
	CustomFormats []AssetCustomFormat `json:"custom_formats,omitempty"`

	// ActionPrices configures a fixed charge for each user-facing asset operation
	// (in the same unit as the system quota). Keys are actions
	// (ListAssets/GetAsset/CreateAsset/UpdateAsset/DeleteAsset); missing or <=0 means free.
	ActionPrices map[string]int `json:"action_prices,omitempty"`

	// RateLimitCount / RateLimitDurationSeconds control per-user rate limiting of the asset endpoints; either being <=0 disables rate limiting.
	RateLimitCount           int `json:"rate_limit_count,omitempty"`
	RateLimitDurationSeconds int `json:"rate_limit_duration_seconds,omitempty"`
}

// ============================
// Outbound helpers
// ============================

// EffectiveFormat returns the normalized outbound format (an empty value is treated as volcengine).
func (o AssetOutbound) EffectiveFormat() string {
	if o.Format == "" {
		return AssetFormatVolcengine
	}
	return o.Format
}

// EffectiveId returns the outbound's stable identifier (an empty Id is treated as
// default), used for isolation mapping keys and default selection.
func (o AssetOutbound) EffectiveId() string {
	if o.Id == "" {
		return defaultOutboundId
	}
	return o.Id
}

func (o AssetOutbound) GetRegion() string {
	if o.Region == "" {
		return "cn-beijing"
	}
	return o.Region
}

func (o AssetOutbound) GetGroupType() string {
	if o.GroupType == "" {
		return "AIGC"
	}
	return o.GroupType
}

// ResolvedBaseURL returns the actual base URL: a volcengine direct connection
// composes the official domain from the region, while others use the configured BaseURL.
func (o AssetOutbound) ResolvedBaseURL() string {
	if o.EffectiveFormat() == AssetFormatVolcengine {
		return fmt.Sprintf("https://ark.%s.volcengineapi.com", o.GetRegion())
	}
	return o.BaseURL
}

// IsBuiltinAssetFormat reports whether the format is an official built-in format.
func IsBuiltinAssetFormat(format string) bool {
	switch format {
	case "", AssetFormatVolcengine, AssetFormatNewAPI:
		return true
	default:
		return false
	}
}

// ============================
// Settings helpers
// ============================

// EffectiveOutbounds returns the list of currently enabled outbounds.
func (v *VolcAssetSettings) EffectiveOutbounds() []AssetOutbound {
	enabled := make([]AssetOutbound, 0, len(v.Outbounds))
	for _, o := range v.Outbounds {
		if !o.Disabled {
			enabled = append(enabled, o)
		}
	}
	return enabled
}

// CustomFormat returns the custom outbound format template by Id.
func (v *VolcAssetSettings) CustomFormat(id string) (*AssetCustomFormat, bool) {
	for i := range v.CustomFormats {
		if v.CustomFormats[i].Id == id {
			return &v.CustomFormats[i], true
		}
	}
	return nil, false
}

// OutboundConfigured reports whether an outbound has all the credentials/references it needs (i.e. is usable).
func (v *VolcAssetSettings) OutboundConfigured(o AssetOutbound) bool {
	switch o.EffectiveFormat() {
	case AssetFormatVolcengine:
		return o.AccessKey != "" && o.SecretKey != ""
	case AssetFormatNewAPI:
		return o.BaseURL != "" && o.AccessToken != ""
	default:
		if o.BaseURL == "" {
			return false
		}
		_, ok := v.CustomFormat(o.EffectiveFormat())
		return ok
	}
}

// IsConfigured reports whether at least one usable, configured outbound exists.
func (v *VolcAssetSettings) IsConfigured() bool {
	for _, o := range v.EffectiveOutbounds() {
		if v.OutboundConfigured(o) {
			return true
		}
	}
	return false
}

// ResolveOutboundCandidates returns an ordered list of candidate outbounds by the
// priority "client-specified -> default -> first". When Failover is enabled, the
// remaining enabled outbounds are appended after the primary candidate for
// fallback; otherwise only the primary candidate is returned. Only configured
// (usable) candidates are returned.
func (v *VolcAssetSettings) ResolveOutboundCandidates(selector string) []AssetOutbound {
	obs := v.EffectiveOutbounds()
	if len(obs) == 0 {
		return nil
	}

	primaryIdx := -1
	if selector != "" {
		for i := range obs {
			if obs[i].EffectiveId() == selector {
				primaryIdx = i
				break
			}
		}
	}
	if primaryIdx == -1 && v.DefaultOutbound != "" {
		for i := range obs {
			if obs[i].EffectiveId() == v.DefaultOutbound {
				primaryIdx = i
				break
			}
		}
	}
	if primaryIdx == -1 {
		primaryIdx = 0
	}

	ordered := make([]AssetOutbound, 0, len(obs))
	ordered = append(ordered, obs[primaryIdx])
	if v.Failover {
		for i := range obs {
			if i != primaryIdx {
				ordered = append(ordered, obs[i])
			}
		}
	}

	candidates := make([]AssetOutbound, 0, len(ordered))
	for _, o := range ordered {
		if v.OutboundConfigured(o) {
			candidates = append(candidates, o)
		}
	}
	return candidates
}

// GetOutboundSelectorHeader returns the outbound selector header name (defaults to X-Asset-Outbound).
func (v *VolcAssetSettings) GetOutboundSelectorHeader() string {
	if v.OutboundSelectorHeader == "" {
		return DefaultOutboundSelectorHeader
	}
	return v.OutboundSelectorHeader
}

// ActionPrice returns the fixed charge for an operation; returns 0 (free) when unconfigured or non-positive.
func (v *VolcAssetSettings) ActionPrice(action string) int {
	if v.ActionPrices == nil {
		return 0
	}
	if price, ok := v.ActionPrices[action]; ok && price > 0 {
		return price
	}
	return 0
}

// ============================
// Secret handling
// ============================

// Redacted returns a copy with all outbound secret fields cleared, for safely sending to the admin UI.
func (v VolcAssetSettings) Redacted() VolcAssetSettings {
	if len(v.Outbounds) == 0 {
		return v
	}
	outbounds := make([]AssetOutbound, len(v.Outbounds))
	copy(outbounds, v.Outbounds)
	for i := range outbounds {
		outbounds[i].SecretKey = ""
		outbounds[i].AccessToken = ""
	}
	v.Outbounds = outbounds
	return v
}

// MergeSecretsFromExisting backfills empty secrets in this config from prev,
// matched by outbound Id. The admin UI never echoes secrets, so an empty value on
// submit means "keep the existing value"; this prevents a save from overwriting
// stored secrets with empty strings.
func (v VolcAssetSettings) MergeSecretsFromExisting(prev VolcAssetSettings) VolcAssetSettings {
	if len(v.Outbounds) == 0 {
		return v
	}
	prevById := make(map[string]AssetOutbound, len(prev.Outbounds))
	for _, o := range prev.Outbounds {
		prevById[o.EffectiveId()] = o
	}
	merged := make([]AssetOutbound, len(v.Outbounds))
	copy(merged, v.Outbounds)
	for i := range merged {
		old, ok := prevById[merged[i].EffectiveId()]
		if !ok {
			continue
		}
		if merged[i].SecretKey == "" {
			merged[i].SecretKey = old.SecretKey
		}
		if merged[i].AccessToken == "" {
			merged[i].AccessToken = old.AccessToken
		}
	}
	v.Outbounds = merged
	return v
}
