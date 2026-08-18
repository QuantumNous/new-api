package groksubscription

import "testing"

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
