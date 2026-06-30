package system_setting

import "fmt"

var VolcAssetConfig = VolcAssetSettings{}

const (
	// AssetFormatVolcengine 官方内置出口：火山 Ark 直连（AK/SK HMAC 签名）。
	// 仅此格式需内置——HMAC 签名无法用模板表达；其余协议（如火山兼容网关）请用自定义格式模板。
	AssetFormatVolcengine = "volcengine"
	// AssetFormatNewAPI 官方内置出口：对接另一台 new-api 的资产接口（路径式 Action + Bearer），用于套娃。
	AssetFormatNewAPI = "newapi"
)

const (
	// DefaultOutboundSelectorHeader 客户端用于指定出口的请求头（值为出口 Id）。
	DefaultOutboundSelectorHeader = "X-Asset-Outbound"
	// defaultOutboundId 出口未填 Id 时使用的稳定标识。
	defaultOutboundId = "default"
)

// AssetAuthSpec 描述自定义出口格式的鉴权方式。Value 支持模板占位符：
// {access_key} {secret_key} {access_token} {project_name} {region} {group_type}。
type AssetAuthSpec struct {
	Type  string `json:"type,omitempty"` // none | header | query | bearer
	Name  string `json:"name,omitempty"` // header/query 名称
	Value string `json:"value,omitempty"`
}

// AssetFieldMap 描述一次 JSON 字段搬运：把 From 路径(gjson)的值写到 To 路径(sjson)。
type AssetFieldMap struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// AssetActionTemplate 描述某个动作（或一组动作的默认值）如何构造上游请求与解析上游响应。
type AssetActionTemplate struct {
	// Method 上游 HTTP 方法，缺省 POST。
	Method string `json:"method,omitempty"`
	// URLTemplate 上游 URL 模板，支持 {base_url} {action} {field:<canonicalPath>} 占位符。
	URLTemplate string `json:"url_template,omitempty"`
	// Headers 附加静态请求头（值支持模板占位符）。
	Headers map[string]string `json:"headers,omitempty"`
	// RequestStatic 写入上游请求体的静态字段，键为 sjson 路径，值支持模板占位符。
	RequestStatic map[string]string `json:"request_static,omitempty"`
	// RequestMapping 把规范化请求体(canonical)的字段搬运到上游请求体。
	RequestMapping []AssetFieldMap `json:"request_mapping,omitempty"`
	// RequestPassthrough 为 true 时直接透传规范化请求体（仍会叠加 RequestStatic）。
	RequestPassthrough bool `json:"request_passthrough,omitempty"`
	// ResultPath 上游响应中“结果”所在的 gjson 路径，留空表示整个响应体即结果。
	ResultPath string `json:"result_path,omitempty"`
	// ErrorCodePath / ErrorMessagePath 上游业务错误码/消息所在路径，错误码非空即视为失败。
	ErrorCodePath    string `json:"error_code_path,omitempty"`
	ErrorMessagePath string `json:"error_message_path,omitempty"`
	// ItemsPath 列表结果中数组所在路径（相对 ResultPath）；配合 ItemMapping 逐元素归一。
	ItemsPath   string          `json:"items_path,omitempty"`
	ItemMapping []AssetFieldMap `json:"item_mapping,omitempty"`
	// ResponseMapping 把上游结果(相对 ResultPath)的标量字段搬运到规范化结果。
	ResponseMapping []AssetFieldMap `json:"response_mapping,omitempty"`
}

// AssetCustomFormat 是一份用户自定义的出口格式模板。内嵌的 AssetActionTemplate 作为所有动作的默认值，
// Actions 可对单个动作覆盖。这样既能用一份默认模板覆盖全部动作，也能为差异动作单独定制。
type AssetCustomFormat struct {
	Id   string        `json:"id"`
	Name string        `json:"name,omitempty"`
	Auth AssetAuthSpec `json:"auth"`
	AssetActionTemplate
	Actions map[string]AssetActionTemplate `json:"actions,omitempty"`
}

// AssetOutbound 是一个出口（egress）：new-api 以何种格式、凭证、基址访问某个上游资产服务。
type AssetOutbound struct {
	Id          string `json:"id"`
	Name        string `json:"name,omitempty"`
	Format      string `json:"format"` // 内置: volcengine | newapi；或自定义格式 Id
	BaseURL     string `json:"base_url,omitempty"`
	Region      string `json:"region,omitempty"`
	ProjectName string `json:"project_name,omitempty"`
	GroupType   string `json:"group_type,omitempty"`
	AccessKey   string `json:"access_key,omitempty"`
	SecretKey   string `json:"secret_key,omitempty"`
	AccessToken string `json:"access_token,omitempty"`
	// Disabled 为 true 时该出口不参与解析（默认 false 即启用）。
	Disabled bool `json:"disabled,omitempty"`
}

// VolcAssetSettings 是资产网关的系统级配置：入口固定为规范化(火山原生)格式，出口可配置多个。
type VolcAssetSettings struct {
	// Outbounds 出口列表，可配置多个。
	Outbounds []AssetOutbound `json:"outbounds"`
	// DefaultOutbound 客户端未指定出口时使用的出口 Id。
	DefaultOutbound string `json:"default_outbound,omitempty"`
	// OutboundSelectorHeader 客户端用于指定出口的请求头名（缺省 X-Asset-Outbound）。
	OutboundSelectorHeader string `json:"outbound_selector_header,omitempty"`
	// Failover 为 true 时，所选/默认出口不可用时按顺序回退到其它已启用出口。
	Failover bool `json:"failover,omitempty"`
	// CustomFormats 自定义出口格式模板，被 Outbound.Format 以 Id 引用。
	CustomFormats []AssetCustomFormat `json:"custom_formats,omitempty"`

	// ActionPrices 为每个面向用户的资产操作配置固定扣费额度（单位与系统额度一致）。
	// 键为 Action（ListAssets/GetAsset/CreateAsset/UpdateAsset/DeleteAsset），缺省或 <=0 表示免费。
	ActionPrices map[string]int `json:"action_prices,omitempty"`

	// RateLimitCount / RateLimitDurationSeconds 控制按用户的资产接口限流；任一 <=0 表示关闭限流。
	RateLimitCount           int `json:"rate_limit_count,omitempty"`
	RateLimitDurationSeconds int `json:"rate_limit_duration_seconds,omitempty"`
}

// ============================
// Outbound helpers
// ============================

// EffectiveFormat 返回归一化后的出口格式（空值视为 volcengine）。
func (o AssetOutbound) EffectiveFormat() string {
	if o.Format == "" {
		return AssetFormatVolcengine
	}
	return o.Format
}

// EffectiveId 返回出口的稳定标识（空 Id 视为 default），用于隔离映射键与默认选择。
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

// ResolvedBaseURL 返回实际访问基址：volcengine 直连按区域拼接官方域名，其余使用配置的 BaseURL。
func (o AssetOutbound) ResolvedBaseURL() string {
	if o.EffectiveFormat() == AssetFormatVolcengine {
		return fmt.Sprintf("https://ark.%s.volcengineapi.com", o.GetRegion())
	}
	return o.BaseURL
}

// IsBuiltinAssetFormat 返回该格式是否为官方内置格式。
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

// EffectiveOutbounds 返回当前已启用的出口列表。
func (v *VolcAssetSettings) EffectiveOutbounds() []AssetOutbound {
	enabled := make([]AssetOutbound, 0, len(v.Outbounds))
	for _, o := range v.Outbounds {
		if !o.Disabled {
			enabled = append(enabled, o)
		}
	}
	return enabled
}

// CustomFormat 按 Id 返回自定义出口格式模板。
func (v *VolcAssetSettings) CustomFormat(id string) (*AssetCustomFormat, bool) {
	for i := range v.CustomFormats {
		if v.CustomFormats[i].Id == id {
			return &v.CustomFormats[i], true
		}
	}
	return nil, false
}

// OutboundConfigured 判断某出口所需的凭证/引用是否齐全（可用）。
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

// IsConfigured 返回是否至少存在一个已配置好的可用出口。
func (v *VolcAssetSettings) IsConfigured() bool {
	for _, o := range v.EffectiveOutbounds() {
		if v.OutboundConfigured(o) {
			return true
		}
	}
	return false
}

// ResolveOutboundCandidates 按“客户端指定 → 默认 → 第一个”的优先级返回有序候选出口。
// 开启 Failover 时，主候选之后追加其余已启用出口用于回退；未开启时仅返回主候选。
// 仅返回已配置(可用)的候选。
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

// GetOutboundSelectorHeader 返回出口选择请求头名（缺省 X-Asset-Outbound）。
func (v *VolcAssetSettings) GetOutboundSelectorHeader() string {
	if v.OutboundSelectorHeader == "" {
		return DefaultOutboundSelectorHeader
	}
	return v.OutboundSelectorHeader
}

// ActionPrice 返回某个操作的固定扣费额度；未配置或非正数时返回 0（免费）。
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

// Redacted 返回清空全部出口密钥字段的副本，用于安全地下发给管理端。
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

// MergeSecretsFromExisting 按出口 Id 用 prev 中的密钥回填本配置里为空的密钥。
// 管理端永不回显密钥，提交时为空表示“保持原值”，借此避免保存动作把已存密钥覆盖为空。
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
