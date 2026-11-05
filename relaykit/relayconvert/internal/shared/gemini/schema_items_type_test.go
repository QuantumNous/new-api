package gemini

import (
	"encoding/json"
	"testing"
)

// 复刻线上 400 的现场：客户端 schema 里 source_paths 带 items 却没有 type，
// Gemini 侧报 field predicate failed: $type == Type.ARRAY。
func TestCleanFunctionParameters_GeminiItemsType(t *testing.T) {
	cases := []struct {
		name     string
		in       string
		wantType string
		wantNoKey bool
	}{
		{
			name:     "缺 type 但有 items",
			in:       `{"type":"object","properties":{"source_paths":{"items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:     "非标 type list",
			in:       `{"type":"object","properties":{"source_paths":{"type":"list","items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:     "非标 type List[str]",
			in:       `{"type":"object","properties":{"source_paths":{"type":"List[str]","items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:     "type 与 items 矛盾",
			in:       `{"type":"object","properties":{"source_paths":{"type":"string","items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:     "nullable 数组写法",
			in:       `{"type":"object","properties":{"source_paths":{"type":["array","null"],"items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:     "标准写法不应被改动",
			in:       `{"type":"object","properties":{"source_paths":{"type":"array","items":{"type":"string"}}}}`,
			wantType: "ARRAY",
		},
		{
			name:      "空 tuple items 应被删除",
			in:        `{"type":"object","properties":{"source_paths":{"type":"array","items":[]}}}`,
			wantNoKey: true,
		},
		{
			name:     "缺 type 但有 properties 补 OBJECT",
			in:       `{"type":"object","properties":{"cfg":{"properties":{"a":{"type":"string"}}}}}`,
			wantType: "OBJECT",
		},
		{
			name:     "嵌套数组",
			in:       `{"type":"object","properties":{"m":{"items":{"items":{"type":"string"}}}}}`,
			wantType: "ARRAY",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var in map[string]any
			if err := json.Unmarshal([]byte(tc.in), &in); err != nil {
				t.Fatalf("bad fixture: %v", err)
			}
			out := CleanFunctionParameters(in).(map[string]any)
			props := out["properties"].(map[string]any)

			if tc.wantNoKey {
				node := props["source_paths"].(map[string]any)
				if _, ok := node["items"]; ok {
					t.Fatalf("items 应被删除，实际仍存在: %v", node)
				}
				return
			}

			var node map[string]any
			switch {
			case props["source_paths"] != nil:
				node = props["source_paths"].(map[string]any)
			case props["cfg"] != nil:
				node = props["cfg"].(map[string]any)
			case props["m"] != nil:
				node = props["m"].(map[string]any)
			default:
				t.Fatalf("找不到目标节点: %v", props)
			}

			if got, _ := node["type"].(string); got != tc.wantType {
				t.Fatalf("type 期望 %s，实际 %q（整个节点: %v）", tc.wantType, got, node)
			}

			// 有 items 就必须 type=ARRAY，这是 Gemini 的硬约束
			if _, hasItems := node["items"]; hasItems {
				if node["type"] != "ARRAY" {
					t.Fatalf("带 items 却不是 ARRAY: %v", node)
				}
			}
		})
	}
}

// 确认白名单仍会剔除 Gemini 不认识的字段
func TestCleanFunctionParameters_StillFiltersUnknownKeys(t *testing.T) {
	in := map[string]any{
		"type":                 "object",
		"$schema":              "http://json-schema.org/draft-07/schema#",
		"additionalProperties": false,
		"oneOf":                []any{},
		"properties": map[string]any{
			"a": map[string]any{"type": "string", "$ref": "#/$defs/x", "examples": []any{"y"}},
		},
	}
	out := CleanFunctionParameters(in).(map[string]any)

	for _, k := range []string{"$schema", "additionalProperties", "oneOf"} {
		if _, ok := out[k]; ok {
			t.Fatalf("未知字段 %s 应被剔除，实际保留", k)
		}
	}
	a := out["properties"].(map[string]any)["a"].(map[string]any)
	for _, k := range []string{"$ref", "examples"} {
		if _, ok := a[k]; ok {
			t.Fatalf("未知字段 %s 应被剔除，实际保留", k)
		}
	}
	if a["type"] != "STRING" {
		t.Fatalf("type 应归一化为 STRING，实际 %v", a["type"])
	}
}
