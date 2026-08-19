package groksubscription

import (
	"bytes"
	"encoding/json"
	"errors"
)

// Grok Subscription 支持的工具类型（设计 §9）。
const (
	ToolTypeFunction  = "function"
	ToolTypeWebSearch = "web_search"
	ToolTypeXSearch   = "x_search"
)

// webSearchAliases 收拢客户端可能传入的 web_search 兼容别名，统一归一化到 web_search。
var webSearchAliases = map[string]struct{}{
	"web_search":     {},
	"browser_search": {},
}

// FunctionTool 对应 function 工具的定义体。
type FunctionTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
	Strict      *bool           `json:"strict,omitempty"`
}

// WebSearchTool 对应 web_search 工具配置。指针字段用于保留客户端显式传入的 0/false。
type WebSearchTool struct {
	MaxResults      *int     `json:"max_results,omitempty"`
	ReturnCitations *bool    `json:"return_citations,omitempty"`
	AllowedDomains  []string `json:"allowed_domains,omitempty"`
	BlockedDomains  []string `json:"blocked_domains,omitempty"`
}

// XSearchTool 对应 x_search 工具配置。
type XSearchTool struct {
	Query      string `json:"query,omitempty"`
	MaxResults *int   `json:"max_results,omitempty"`
	FromDate   string `json:"from_date,omitempty"`
	ToDate     string `json:"to_date,omitempty"`
}

// Tool 是解析后的 typed 工具，Type 已归一化，仅对应类型的指针字段非空。
type Tool struct {
	Type      string
	Function  *FunctionTool
	WebSearch *WebSearchTool
	XSearch   *XSearchTool
}

// ParseTool 将单个工具 JSON 解析为 typed DTO。
// 未知 tool type 或非法配置返回可定位错误（不静默删）；错误信息只描述工具类别，绝不 echo 原始 bytes。
func ParseTool(raw []byte) (Tool, error) {
	var head struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &head); err != nil {
		return Tool{}, errors.New("grok tool: invalid JSON")
	}

	toolType := head.Type
	if _, ok := webSearchAliases[toolType]; ok {
		toolType = ToolTypeWebSearch
	}

	// 顶层拆成子 payload map，使后续 strict 解析只作用于工具子对象内部，
	// 避免 DisallowUnknownFields 把顶层的 "type" 键误判为未知字段（方案A）。
	var wrap map[string]json.RawMessage
	if err := json.Unmarshal(raw, &wrap); err != nil {
		return Tool{}, errors.New("grok tool: invalid JSON")
	}

	switch toolType {
	case ToolTypeFunction:
		body, ok := firstRaw(wrap, head.Type, ToolTypeFunction)
		if !ok {
			return Tool{}, errors.New("grok tool: function tool requires a function body")
		}
		var fn FunctionTool
		if err := strictUnmarshal(body, &fn); err != nil {
			return Tool{}, errors.New("grok tool: invalid function config")
		}
		return Tool{Type: ToolTypeFunction, Function: &fn}, nil

	case ToolTypeWebSearch:
		var ws WebSearchTool
		if body, ok := firstRaw(wrap, head.Type, ToolTypeWebSearch); ok {
			if err := strictUnmarshal(body, &ws); err != nil {
				return Tool{}, errors.New("grok tool: invalid web_search config")
			}
		}
		return Tool{Type: ToolTypeWebSearch, WebSearch: &ws}, nil

	case ToolTypeXSearch:
		var xs XSearchTool
		if body, ok := firstRaw(wrap, head.Type, ToolTypeXSearch); ok {
			if err := strictUnmarshal(body, &xs); err != nil {
				return Tool{}, errors.New("grok tool: invalid x_search config")
			}
		}
		return Tool{Type: ToolTypeXSearch, XSearch: &xs}, nil

	default:
		// 只描述类别，绝不 echo 客户端可控的 head.Type（log/response injection 面；同本文件 invariant）。
		return Tool{}, errors.New("grok tool: unsupported tool type")
	}
}

// firstRaw 按 keys 顺序返回第一个存在且非 JSON null 的子 payload 及 ok。
// 别名类型（如 browser_search）把 head.Type 传在前、canonical key 在后即可取到别名 payload。
func firstRaw(m map[string]json.RawMessage, keys ...string) (json.RawMessage, bool) {
	for _, k := range keys {
		if raw, ok := m[k]; ok && !isJSONNull(raw) {
			return raw, true
		}
	}
	return nil, false
}

// isJSONNull 判断 raw 是否为 JSON null（或空），此类子 payload 视为不存在。
func isJSONNull(raw json.RawMessage) bool {
	t := bytes.TrimSpace(raw)
	return len(t) == 0 || bytes.Equal(t, []byte("null"))
}

// strictUnmarshal 以 DisallowUnknownFields 解析子 payload，未知字段即报错，用于拒绝非法工具配置。
func strictUnmarshal(raw []byte, v any) error {
	dec := json.NewDecoder(bytesReader(raw))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

// bytesReader 是 bytes.NewReader 的包内别名，供 strictUnmarshal 使用。
func bytesReader(b []byte) *bytes.Reader {
	return bytes.NewReader(b)
}
