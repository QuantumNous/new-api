package groksubscription

import (
	"strings"
	"testing"
)

func TestParseWebSearchToolPreservesFalse(t *testing.T) {
	// 客户端显式传 return_citations=false 必须保留（指针字段），不能被当成缺省丢弃
	raw := `{"type":"web_search","web_search":{"return_citations":false,"max_results":0}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	ws := tool.WebSearch
	if ws == nil || ws.ReturnCitations == nil || *ws.ReturnCitations != false {
		t.Fatalf("return_citations=false must be preserved as pointer, got %+v", ws)
	}
	if ws.MaxResults == nil || *ws.MaxResults != 0 {
		t.Fatalf("max_results=0 must be preserved, got %+v", ws)
	}
}

func TestParseXSearchTool(t *testing.T) {
	raw := `{"type":"x_search","x_search":{"query":"golang","max_results":5}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	if tool.XSearch == nil || tool.XSearch.Query != "golang" {
		t.Fatalf("x_search not parsed: %+v", tool)
	}
}

func TestParseFunctionTool(t *testing.T) {
	raw := `{"type":"function","function":{"name":"get_weather","parameters":{"type":"object"}}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("parse err %v", err)
	}
	if tool.Function == nil || tool.Function.Name != "get_weather" {
		t.Fatalf("function tool not parsed: %+v", tool)
	}
}

func TestParseUnknownToolTypeRejected(t *testing.T) {
	raw := `{"type":"code_interpreter","code_interpreter":{}}`
	if _, err := ParseTool([]byte(raw)); err == nil {
		t.Fatalf("unknown tool type must be rejected with locatable error, not silently dropped")
	}
}

// TestParseUnknownToolTypeErrorOmitsClientInput 守护本文件 invariant（[8] high/security）：
// 未知 tool type 的错误信息只描述类别，绝不 echo 客户端可控的原始 type 字符串
// （否则有 log/response injection 面）。变异验证：把 head.Type 拼回 error 即 FAIL。
func TestParseUnknownToolTypeErrorOmitsClientInput(t *testing.T) {
	const probe = "XSS-PROBE-<script>alert(1)</script>"
	raw := `{"type":"` + probe + `"}`
	_, err := ParseTool([]byte(raw))
	if err == nil {
		t.Fatalf("unknown tool type must be rejected")
	}
	if strings.Contains(err.Error(), probe) {
		t.Fatalf("error must NOT echo raw client tool type, got %q", err.Error())
	}
}

func TestParseWebSearchAliasNormalized(t *testing.T) {
	// 兼容别名（如 browser_search）归一化到 web_search
	raw := `{"type":"browser_search","browser_search":{"max_results":3}}`
	tool, err := ParseTool([]byte(raw))
	if err != nil {
		t.Fatalf("alias parse err %v", err)
	}
	if tool.Type != ToolTypeWebSearch || tool.WebSearch == nil {
		t.Fatalf("alias must normalize to web_search, got %+v", tool)
	}
}

func TestParseWebSearchRejectsUnknownField(t *testing.T) {
	// 已知 type 内的未知字段必须被 DisallowUnknownFields 拒绝——这是 strict 解析的存在理由，
	// 保证不静默丢弃 Grok 不支持的字段（回归护栏：删掉 strict 时本例应 FAIL）。
	raw := `{"type":"web_search","web_search":{"unknown_field":1}}`
	if _, err := ParseTool([]byte(raw)); err == nil {
		t.Fatalf("unknown field in web_search config must be rejected by strict unmarshal, not silently dropped")
	}
}

func TestParseFunctionNullBodyRejected(t *testing.T) {
	// 显式 null 的 function body 经 isJSONNull 视为不存在，返回可定位错误而非空 DTO。
	raw := `{"type":"function","function":null}`
	if _, err := ParseTool([]byte(raw)); err == nil {
		t.Fatalf("null function body must be rejected with locatable error, not treated as valid empty function")
	}
}
