package common

import (
	"encoding/json"
	"fmt"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/types"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/samber/lo"
)

// APIFormat 定义不同的API格式类型
type APIFormat string

const (
	APIFormatOpenAI APIFormat = "openai"
	APIFormatClaude APIFormat = "claude"
	APIFormatGemini APIFormat = "gemini"
)

// APISample 定义API样本数据，用于多格式测试
type APISample struct {
	Format APIFormat
	Input  string
	// PathTransforms 定义路径转换规则，将通用路径转换为特定API格式的路径
	PathTransforms map[string]string
	// ValueTransforms 定义值转换函数，用于处理不同API格式的值差异
	ValueTransforms map[string]func(interface{}) interface{}
}

// OverrideTestCase 定义通用的override测试用例
type OverrideTestCase struct {
	Name        string
	Operation   map[string]interface{}
	ExpectError bool
	// ExpectedOutput 使用通用路径，运行时会根据API格式进行转换
	ExpectedOutput string
	// SkipFormats 指定跳过的API格式
	SkipFormats []APIFormat
	// CustomAssert 自定义断言函数，用于复杂验证场景
	CustomAssert func(t *testing.T, got []byte, sample APISample)
}

// apiSamples 定义三种API格式的样本数据
var apiSamples = []APISample{
	{
		Format: APIFormatOpenAI,
		Input:  `{"model":"openai/gpt-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		PathTransforms: map[string]string{
			"model":       "model",
			"temperature": "temperature",
			"max_tokens":  "max_tokens",
		},
	},
	{
		Format: APIFormatClaude,
		Input:  `{"model":"anthropic/claude-3","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		PathTransforms: map[string]string{
			"model":       "model",
			"temperature": "temperature",
			"max_tokens":  "max_tokens",
		},
	},
	{
		Format: APIFormatGemini,
		Input:  `{"contents":[{"parts":[{"text":"hello"}]}],"generationConfig":{"temperature":0.7,"maxOutputTokens":1000}}`,
		PathTransforms: map[string]string{
			"temperature": "generationConfig.temperature",
			"max_tokens":  "generationConfig.maxOutputTokens",
		},
	},
}

// op 创建一个operation map的辅助函数
func op(mode string, opts ...func(map[string]interface{})) map[string]interface{} {
	m := map[string]interface{}{"mode": mode}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

// opPath 设置path
func opPath(path string) func(map[string]interface{}) {
	return func(m map[string]interface{}) { m["path"] = path }
}

// opValue 设置value
func opValue(value interface{}) func(map[string]interface{}) {
	return func(m map[string]interface{}) { m["value"] = value }
}

// opFrom 设置from
func opFrom(from string) func(map[string]interface{}) {
	return func(m map[string]interface{}) { m["from"] = from }
}

// opTo 设置to
func opTo(to string) func(map[string]interface{}) {
	return func(m map[string]interface{}) { m["to"] = to }
}

// opKeepOrigin 设置keep_origin
func opKeepOrigin(keep bool) func(map[string]interface{}) {
	return func(m map[string]interface{}) { m["keep_origin"] = keep }
}

// buildOverride 构建override配置
func buildOverride(operations ...map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"operations": toInterfaceSlice(operations),
	}
}

// toInterfaceSlice 将[]map[string]interface{}转换为[]interface{}
func toInterfaceSlice(operations []map[string]interface{}) []interface{} {
	result := make([]interface{}, len(operations))
	for i, op := range operations {
		result[i] = op
	}
	return result
}

// runOverrideTest 运行单个override测试用例
func runOverrideTest(t *testing.T, tc OverrideTestCase, sample APISample) {
	t.Helper()

	// 检查是否跳过该格式
	for _, skip := range tc.SkipFormats {
		if skip == sample.Format {
			t.Skipf("skipping format %s", sample.Format)
		}
	}

	input := []byte(sample.Input)
	override := buildOverride(tc.Operation)

	out, err := ApplyParamOverride(input, override, nil, nil)

	if tc.ExpectError {
		if err == nil {
			t.Fatalf("expected error, got nil")
		}
		return
	}

	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	// 使用自定义断言或默认断言
	if tc.CustomAssert != nil {
		tc.CustomAssert(t, out, sample)
	} else if tc.ExpectedOutput != "" {
		assertJSONEqual(t, tc.ExpectedOutput, string(out))
	}
}

// TestApplyParamOverrideBasicOperations 表驱动测试基本操作
func TestApplyParamOverrideBasicOperations(t *testing.T) {
	// 基本操作测试用例 - 只测试OpenAI格式
	openAISample := apiSamples[0]

	testCases := []OverrideTestCase{
		{
			Name: "trim_prefix",
			Operation: op("trim_prefix",
				opPath("model"),
				opValue("openai/"),
			),
			ExpectedOutput: `{"model":"gpt-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "trim_suffix",
			Operation: op("trim_suffix",
				opPath("model"),
				opValue("-latest"),
			),
			ExpectedOutput: `{"model":"openai/gpt-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "set_temperature",
			Operation: op("set",
				opPath("temperature"),
				opValue(0.1),
			),
			ExpectedOutput: `{"model":"openai/gpt-4","temperature":0.1,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "delete_temperature",
			Operation: op("delete",
				opPath("temperature"),
			),
			ExpectedOutput: `{"model":"openai/gpt-4","max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "replace_model",
			Operation: op("replace",
				opPath("model"),
				opFrom("openai/"),
				opTo(""),
			),
			ExpectedOutput: `{"model":"gpt-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "to_lower",
			Operation: op("to_lower",
				opPath("model"),
			),
			ExpectedOutput: `{"model":"openai/gpt-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
		{
			Name: "to_upper",
			Operation: op("to_upper",
				opPath("model"),
			),
			ExpectedOutput: `{"model":"OPENAI/GPT-4","temperature":0.7,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			runOverrideTest(t, tc, openAISample)
		})
	}
}

// TestApplyParamOverrideMultiFormat 表驱动测试多API格式
func TestApplyParamOverrideMultiFormat(t *testing.T) {
	// 定义跨格式测试用例
	testCases := []struct {
		name           string
		operations     func(sample APISample) []map[string]interface{}
		expectedOutput func(sample APISample) string
		skipFormats    []APIFormat
	}{
		{
			name: "set_max_tokens",
			operations: func(sample APISample) []map[string]interface{} {
				path := sample.PathTransforms["max_tokens"]
				return []map[string]interface{}{
					op("set", opPath(path), opValue(500)),
				}
			},
			expectedOutput: func(sample APISample) string {
				switch sample.Format {
				case APIFormatOpenAI:
					return `{"model":"openai/gpt-4","temperature":0.7,"max_tokens":500,"messages":[{"role":"user","content":"hello"}]}`
				case APIFormatClaude:
					return `{"model":"anthropic/claude-3","max_tokens":500,"messages":[{"role":"user","content":"hello"}]}`
				case APIFormatGemini:
					return `{"contents":[{"parts":[{"text":"hello"}]}],"generationConfig":{"temperature":0.7,"maxOutputTokens":500}}`
				default:
					return ""
				}
			},
		},
		{
			name: "set_temperature",
			operations: func(sample APISample) []map[string]interface{} {
				path := sample.PathTransforms["temperature"]
				if path == "" {
					return nil
				}
				return []map[string]interface{}{
					op("set", opPath(path), opValue(0.5)),
				}
			},
			expectedOutput: func(sample APISample) string {
				switch sample.Format {
				case APIFormatOpenAI:
					return `{"model":"openai/gpt-4","temperature":0.5,"max_tokens":1000,"messages":[{"role":"user","content":"hello"}]}`
				case APIFormatGemini:
					return `{"contents":[{"parts":[{"text":"hello"}]}],"generationConfig":{"temperature":0.5,"maxOutputTokens":1000}}`
				default:
					return ""
				}
			},
			skipFormats: []APIFormat{APIFormatClaude}, // Claude样本没有temperature字段
		},
	}

	for _, tc := range testCases {
		for _, sample := range apiSamples {
			t.Run(fmt.Sprintf("%s/%s", tc.name, sample.Format), func(t *testing.T) {
				// 检查是否跳过该格式
				for _, skip := range tc.skipFormats {
					if skip == sample.Format {
						t.Skipf("skipping format %s", sample.Format)
					}
				}

				operations := tc.operations(sample)
				if operations == nil {
					t.Skip("no operations for this format")
				}

				input := []byte(sample.Input)
				override := buildOverride(operations...)

				out, err := ApplyParamOverride(input, override, nil, nil)
				if err != nil {
					t.Fatalf("ApplyParamOverride returned error: %v", err)
				}

				expected := tc.expectedOutput(sample)
				if expected != "" {
					assertJSONEqual(t, expected, string(out))
				}
			})
		}
	}
}

// TestApplyParamOverrideStringOperations 测试字符串操作（trim_prefix, trim_suffix, replace, regex_replace等）
func TestApplyParamOverrideStringOperations(t *testing.T) {
	testCases := []struct {
		name           string
		input          string
		operation      map[string]interface{}
		expectedOutput string
		expectError    bool
	}{
		{
			name:           "trim_prefix",
			input:          `{"model":"openai/gpt-4","temperature":0.7}`,
			operation:      op("trim_prefix", opPath("model"), opValue("openai/")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:           "trim_suffix",
			input:          `{"model":"gpt-4-latest","temperature":0.7}`,
			operation:      op("trim_suffix", opPath("model"), opValue("-latest")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:           "trim_prefix_noop",
			input:          `{"model":"gpt-4","temperature":0.7}`,
			operation:      op("trim_prefix", opPath("model"), opValue("openai/")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:        "trim_prefix_requires_value",
			input:       `{"model":"gpt-4"}`,
			operation:   op("trim_prefix", opPath("model")),
			expectError: true,
		},
		{
			name:           "replace",
			input:          `{"model":"openai/gpt-4o-mini","temperature":0.7}`,
			operation:      op("replace", opPath("model"), opFrom("openai/"), opTo("")),
			expectedOutput: `{"model":"gpt-4o-mini","temperature":0.7}`,
		},
		{
			name:           "regex_replace",
			input:          `{"model":"gpt-4o-mini","temperature":0.7}`,
			operation:      op("regex_replace", opPath("model"), opFrom("^gpt-"), opTo("openai/gpt-")),
			expectedOutput: `{"model":"openai/gpt-4o-mini","temperature":0.7}`,
		},
		{
			name:        "replace_requires_from",
			input:       `{"model":"gpt-4"}`,
			operation:   op("replace", opPath("model")),
			expectError: true,
		},
		{
			name:        "regex_replace_requires_pattern",
			input:       `{"model":"gpt-4"}`,
			operation:   op("regex_replace", opPath("model")),
			expectError: true,
		},
		{
			name:           "ensure_prefix",
			input:          `{"model":"gpt-4"}`,
			operation:      op("ensure_prefix", opPath("model"), opValue("openai/")),
			expectedOutput: `{"model":"openai/gpt-4"}`,
		},
		{
			name:           "ensure_prefix_noop",
			input:          `{"model":"openai/gpt-4"}`,
			operation:      op("ensure_prefix", opPath("model"), opValue("openai/")),
			expectedOutput: `{"model":"openai/gpt-4"}`,
		},
		{
			name:           "ensure_suffix",
			input:          `{"model":"gpt-4"}`,
			operation:      op("ensure_suffix", opPath("model"), opValue("-latest")),
			expectedOutput: `{"model":"gpt-4-latest"}`,
		},
		{
			name:           "ensure_suffix_noop",
			input:          `{"model":"gpt-4-latest"}`,
			operation:      op("ensure_suffix", opPath("model"), opValue("-latest")),
			expectedOutput: `{"model":"gpt-4-latest"}`,
		},
		{
			name:        "ensure_requires_value",
			input:       `{"model":"gpt-4"}`,
			operation:   op("ensure_prefix", opPath("model")),
			expectError: true,
		},
		{
			name:           "trim_space",
			input:          `{"model":" gpt-4 ","temperature":0.7}`,
			operation:      op("trim_space", opPath("model")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:           "to_lower",
			input:          `{"model":"GPT-4","temperature":0.7}`,
			operation:      op("to_lower", opPath("model")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:           "to_upper",
			input:          `{"model":"gpt-4","temperature":0.7}`,
			operation:      op("to_upper", opPath("model")),
			expectedOutput: `{"model":"GPT-4","temperature":0.7}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			input := []byte(tc.input)
			override := buildOverride(tc.operation)

			out, err := ApplyParamOverride(input, override, nil, nil)

			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("ApplyParamOverride returned error: %v", err)
			}

			assertJSONEqual(t, tc.expectedOutput, string(out))
		})
	}
}

// TestApplyParamOverrideBasicOps 测试基本操作（set, delete, move, copy）
func TestApplyParamOverrideBasicOps(t *testing.T) {
	testCases := []struct {
		name           string
		input          string
		operation      map[string]interface{}
		expectedOutput string
		expectError    bool
		customAssert   func(t *testing.T, got []byte)
	}{
		{
			name:           "set",
			input:          `{"model":"gpt-4","temperature":0.7}`,
			operation:      op("set", opPath("temperature"), opValue(0.1)),
			expectedOutput: `{"model":"gpt-4","temperature":0.1}`,
		},
		{
			name:           "set_keep_origin_existing",
			input:          `{"model":"gpt-4","temperature":0.7}`,
			operation:      op("set", opPath("temperature"), opValue(0.1), opKeepOrigin(true)),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:           "set_keep_origin_missing",
			input:          `{"model":"gpt-4"}`,
			operation:      op("set", opPath("temperature"), opValue(0.1), opKeepOrigin(true)),
			expectedOutput: `{"model":"gpt-4","temperature":0.1}`,
		},
		{
			name:  "delete",
			input: `{"model":"gpt-4","temperature":0.7}`,
			operation: op("delete", opPath("temperature")),
			customAssert: func(t *testing.T, got []byte) {
				var result map[string]interface{}
				if err := json.Unmarshal(got, &result); err != nil {
					t.Fatalf("failed to unmarshal: %v", err)
				}
				if _, exists := result["temperature"]; exists {
					t.Fatal("expected temperature to be deleted")
				}
			},
		},
		{
			name:           "move",
			input:          `{"model":"gpt-4","temp":0.7}`,
			operation:      op("move", opFrom("temp"), opTo("temperature")),
			expectedOutput: `{"model":"gpt-4","temperature":0.7}`,
		},
		{
			name:        "move_missing_source",
			input:       `{"model":"gpt-4"}`,
			operation:   op("move", opFrom("temp"), opTo("temperature")),
			expectError: true,
		},
		{
			name:           "copy",
			input:          `{"model":"gpt-4","temp":0.7}`,
			operation:      op("copy", opFrom("temp"), opTo("temperature")),
			expectedOutput: `{"model":"gpt-4","temp":0.7,"temperature":0.7}`,
		},
		{
			name:        "copy_missing_source",
			input:       `{"model":"gpt-4"}`,
			operation:   op("copy", opFrom("temp"), opTo("temperature")),
			expectError: true,
		},
		{
			name:        "copy_requires_from_to",
			input:       `{"model":"gpt-4"}`,
			operation:   op("copy"),
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			input := []byte(tc.input)
			override := buildOverride(tc.operation)

			out, err := ApplyParamOverride(input, override, nil, nil)

			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("ApplyParamOverride returned error: %v", err)
			}

			if tc.customAssert != nil {
				tc.customAssert(t, out)
			} else {
				assertJSONEqual(t, tc.expectedOutput, string(out))
			}
		})
	}
}

// TestApplyParamOverrideArrayOperations 测试数组操作（prepend, append）
func TestApplyParamOverrideArrayOperations(t *testing.T) {
	testCases := []struct {
		name           string
		input          string
		operation      map[string]interface{}
		expectedOutput string
	}{
		{
			name:           "prepend_string",
			input:          `{"model":"gpt-4","prefix":"hello"}`,
			operation:      op("prepend", opPath("prefix"), opValue("say: ")),
			expectedOutput: `{"model":"gpt-4","prefix":"say: hello"}`,
		},
		{
			name:           "append_string",
			input:          `{"model":"gpt-4","suffix":"hello"}`,
			operation:      op("append", opPath("suffix"), opValue(" world")),
			expectedOutput: `{"model":"gpt-4","suffix":"hello world"}`,
		},
		{
			name:           "prepend_array",
			input:          `{"model":"gpt-4","tags":["b","c"]}`,
			operation:      op("prepend", opPath("tags"), opValue("a")),
			expectedOutput: `{"model":"gpt-4","tags":["a","b","c"]}`,
		},
		{
			name:           "append_array",
			input:          `{"model":"gpt-4","tags":["a","b"]}`,
			operation:      op("append", opPath("tags"), opValue("c")),
			expectedOutput: `{"model":"gpt-4","tags":["a","b","c"]}`,
		},
		{
			name:           "append_object_merge_keep_origin",
			input:          `{"model":"gpt-4","config":{"a":1}}`,
			operation:      op("append", opPath("config"), opValue(map[string]interface{}{"b": 2}), opKeepOrigin(true)),
			expectedOutput: `{"model":"gpt-4","config":{"a":1,"b":2}}`,
		},
		{
			name:           "append_object_merge_override",
			input:          `{"model":"gpt-4","config":{"a":1}}`,
			operation:      op("append", opPath("config"), opValue(map[string]interface{}{"a": 2, "b": 3})),
			expectedOutput: `{"model":"gpt-4","config":{"a":2,"b":3}}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			input := []byte(tc.input)
			override := buildOverride(tc.operation)

			out, err := ApplyParamOverride(input, override, nil, nil)
			if err != nil {
				t.Fatalf("ApplyParamOverride returned error: %v", err)
			}

			assertJSONEqual(t, tc.expectedOutput, string(out))
		})
	}
}

func TestApplyParamOverrideSetWildcardKeepOrigin(t *testing.T) {
	input := []byte(`{"tools":[{"custom":{"tag":"A"}},{"custom":{"tag":"B","enabled":false}},{"custom":{"tag":"C"}}]}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":        "tools.*.custom.enabled",
				"mode":        "set",
				"value":       true,
				"keep_origin": true,
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	var got struct {
		Tools []struct {
			Custom struct {
				Enabled bool `json:"enabled"`
			} `json:"custom"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("failed to unmarshal output JSON: %v", err)
	}

	enabledValues := lo.Map(got.Tools, func(item struct {
		Custom struct {
			Enabled bool `json:"enabled"`
		} `json:"custom"`
	}, _ int) bool {
		return item.Custom.Enabled
	})
	if !reflect.DeepEqual(enabledValues, []bool{true, false, true}) {
		t.Fatalf("unexpected enabled values after wildcard keep_origin set: %v", enabledValues)
	}
}

func TestApplyParamOverrideTrimSpaceMultiWildcardPath(t *testing.T) {
	input := []byte(`{"tools":[{"custom":{"items":[{"name":" alpha "},{"name":" beta "}]}},{"custom":{"items":[{"name":" gamma"}]}}]}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "tools.*.custom.items.*.name",
				"mode": "trim_space",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	var got struct {
		Tools []struct {
			Custom struct {
				Items []struct {
					Name string `json:"name"`
				} `json:"items"`
			} `json:"custom"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("failed to unmarshal output JSON: %v", err)
	}

	names := lo.FlatMap(got.Tools, func(tool struct {
		Custom struct {
			Items []struct {
				Name string `json:"name"`
			} `json:"items"`
		} `json:"custom"`
	}, _ int) []string {
		return lo.Map(tool.Custom.Items, func(item struct {
			Name string `json:"name"`
		}, _ int) string {
			return item.Name
		})
	})
	if !reflect.DeepEqual(names, []string{"alpha", "beta", "gamma"}) {
		t.Fatalf("unexpected names after multi wildcard trim_space: %v", names)
	}
}

func TestApplyParamOverrideSet(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.1}`, string(out))
}

func TestApplyParamOverrideConditionORDefault(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "model",
						"mode":  "prefix",
						"value": "gpt",
					},
					map[string]interface{}{
						"path":  "model",
						"mode":  "prefix",
						"value": "claude",
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.1}`, string(out))
}

func TestApplyParamOverrideConditionAND(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"logic": "AND",
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "model",
						"mode":  "prefix",
						"value": "gpt",
					},
					map[string]interface{}{
						"path":  "temperature",
						"mode":  "gt",
						"value": 0.5,
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.1}`, string(out))
}

func TestApplyParamOverrideConditionInvert(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":   "model",
						"mode":   "prefix",
						"value":  "gpt",
						"invert": true,
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideConditionPassMissingKey(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":             "model",
						"mode":             "prefix",
						"value":            "gpt",
						"pass_missing_key": true,
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideConditionFromContext(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "model",
						"mode":  "prefix",
						"value": "gpt",
					},
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"model": "gpt-4",
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideNegativeIndexPath(t *testing.T) {
	input := []byte(`{"arr":[{"model":"a"},{"model":"b"}]}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "arr.-1.model",
				"mode":  "set",
				"value": "c",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"arr":[{"model":"a"},{"model":"c"}]}`, string(out))
}

func TestApplyParamOverrideRegexReplaceInvalidPattern(t *testing.T) {
	// regex_replace invalid pattern example:
	// {"operations":[{"path":"model","mode":"regex_replace","from":"(","to":"x"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "regex_replace",
				"from": "(",
				"to":   "x",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideCopy(t *testing.T) {
	// copy example:
	// {"operations":[{"mode":"copy","from":"model","to":"original_model"}]}
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "copy",
				"from": "model",
				"to":   "original_model",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","original_model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideCopyMissingSource(t *testing.T) {
	// copy missing source example:
	// {"operations":[{"mode":"copy","from":"model","to":"original_model"}]}
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "copy",
				"from": "model",
				"to":   "original_model",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideCopyRequiresFromTo(t *testing.T) {
	// copy requires from/to example:
	// {"operations":[{"mode":"copy"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "copy",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideEnsurePrefix(t *testing.T) {
	// ensure_prefix example:
	// {"operations":[{"path":"model","mode":"ensure_prefix","value":"openai/"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "ensure_prefix",
				"value": "openai/",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"openai/gpt-4"}`, string(out))
}

func TestApplyParamOverrideEnsurePrefixNoop(t *testing.T) {
	// ensure_prefix no-op example:
	// {"operations":[{"path":"model","mode":"ensure_prefix","value":"openai/"}]}
	input := []byte(`{"model":"openai/gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "ensure_prefix",
				"value": "openai/",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"openai/gpt-4"}`, string(out))
}

func TestApplyParamOverrideEnsureSuffix(t *testing.T) {
	// ensure_suffix example:
	// {"operations":[{"path":"model","mode":"ensure_suffix","value":"-latest"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "ensure_suffix",
				"value": "-latest",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4-latest"}`, string(out))
}

func TestApplyParamOverrideEnsureSuffixNoop(t *testing.T) {
	// ensure_suffix no-op example:
	// {"operations":[{"path":"model","mode":"ensure_suffix","value":"-latest"}]}
	input := []byte(`{"model":"gpt-4-latest"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "ensure_suffix",
				"value": "-latest",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4-latest"}`, string(out))
}

func TestApplyParamOverrideEnsureRequiresValue(t *testing.T) {
	// ensure_prefix requires value example:
	// {"operations":[{"path":"model","mode":"ensure_prefix"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "ensure_prefix",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideTrimSpace(t *testing.T) {
	// trim_space example:
	// {"operations":[{"path":"model","mode":"trim_space"}]}
	input := []byte("{\"model\":\"  gpt-4 \\n\"}")
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "trim_space",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4"}`, string(out))
}

func TestApplyParamOverrideToLower(t *testing.T) {
	// to_lower example:
	// {"operations":[{"path":"model","mode":"to_lower"}]}
	input := []byte(`{"model":"GPT-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "to_lower",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4"}`, string(out))
}

func TestApplyParamOverrideToUpper(t *testing.T) {
	// to_upper example:
	// {"operations":[{"path":"model","mode":"to_upper"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "to_upper",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"GPT-4"}`, string(out))
}

func TestApplyParamOverrideReturnError(t *testing.T) {
	input := []byte(`{"model":"gemini-2.5-pro"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "return_error",
				"value": map[string]interface{}{
					"message":     "forced bad request by param override",
					"status_code": 422,
					"code":        "forced_bad_request",
					"type":        "invalid_request_error",
					"skip_retry":  true,
				},
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "retry.is_retry",
						"mode":  "full",
						"value": true,
					},
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"retry": map[string]interface{}{
			"index":    1,
			"is_retry": true,
		},
	}

	_, err := ApplyParamOverride(input, override, ctx, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	returnErr, ok := AsParamOverrideReturnError(err)
	if !ok {
		t.Fatalf("expected ParamOverrideReturnError, got %T: %v", err, err)
	}
	if returnErr.StatusCode != 422 {
		t.Fatalf("expected status 422, got %d", returnErr.StatusCode)
	}
	if returnErr.Code != "forced_bad_request" {
		t.Fatalf("expected code forced_bad_request, got %s", returnErr.Code)
	}
	if !returnErr.SkipRetry {
		t.Fatalf("expected skip_retry true")
	}
}

func TestApplyParamOverridePruneObjectsByTypeString(t *testing.T) {
	input := []byte(`{
		"messages":[
			{"role":"assistant","content":[
				{"type":"output_text","text":"a"},
				{"type":"redacted_thinking","text":"secret"},
				{"type":"tool_call","name":"tool_a"}
			]},
			{"role":"assistant","content":[
				{"type":"output_text","text":"b"},
				{"type":"wrapper","parts":[
					{"type":"redacted_thinking","text":"secret2"},
					{"type":"output_text","text":"c"}
				]}
			]}
		]
	}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode":  "prune_objects",
				"value": "redacted_thinking",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{
		"messages":[
			{"role":"assistant","content":[
				{"type":"output_text","text":"a"},
				{"type":"tool_call","name":"tool_a"}
			]},
			{"role":"assistant","content":[
				{"type":"output_text","text":"b"},
				{"type":"wrapper","parts":[
					{"type":"output_text","text":"c"}
				]}
			]}
		]
	}`, string(out))
}

func TestApplyParamOverridePruneObjectsWhereAndPath(t *testing.T) {
	input := []byte(`{
		"a":{"items":[{"type":"redacted_thinking","id":1},{"type":"output_text","id":2}]},
		"b":{"items":[{"type":"redacted_thinking","id":3},{"type":"output_text","id":4}]}
	}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "a",
				"mode": "prune_objects",
				"value": map[string]interface{}{
					"where": map[string]interface{}{
						"type": "redacted_thinking",
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{
		"a":{"items":[{"type":"output_text","id":2}]},
		"b":{"items":[{"type":"redacted_thinking","id":3},{"type":"output_text","id":4}]}
	}`, string(out))
}

func TestApplyParamOverrideNormalizeThinkingSignatureUnsupported(t *testing.T) {
	input := []byte(`{"items":[{"type":"redacted_thinking"}]}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "normalize_thinking_signature",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideConditionFromRetryAndLastErrorContext(t *testing.T) {
	info := &RelayInfo{
		RetryIndex: 1,
		LastError: types.WithOpenAIError(types.OpenAIError{
			Message: "invalid thinking signature",
			Type:    "invalid_request_error",
			Code:    "bad_thought_signature",
		}, 400),
	}
	ctx := BuildParamOverrideContext(info)

	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"logic": "AND",
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "is_retry",
						"mode":  "full",
						"value": true,
					},
					map[string]interface{}{
						"path":  "last_error.code",
						"mode":  "contains",
						"value": "thought_signature",
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideConditionFromRequestHeaders(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "request_headers.authorization",
						"mode":  "contains",
						"value": "Bearer ",
					},
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"authorization": "Bearer token-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideSetHeaderAndUseInLaterCondition(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode":  "set_header",
				"path":  "X-Debug-Mode",
				"value": "enabled",
			},
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "header_override.x-debug-mode",
						"mode":  "full",
						"value": "enabled",
					},
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideCopyHeaderFromRequestHeaders(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "copy_header",
				"from": "Authorization",
				"to":   "X-Upstream-Auth",
			},
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "header_override.x-upstream-auth",
						"mode":  "contains",
						"value": "Bearer ",
					},
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"authorization": "Bearer token-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverridePassHeadersSkipsMissingHeaders(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode":  "pass_headers",
				"value": []interface{}{"X-Codex-Beta-Features", "Session_id"},
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"session_id": "sess-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["session_id"] != "sess-123" {
		t.Fatalf("expected session_id to be passed, got: %v", headers["session_id"])
	}
	if _, exists := headers["x-codex-beta-features"]; exists {
		t.Fatalf("expected missing header to be skipped")
	}
}

func TestApplyParamOverrideCopyHeaderSkipsMissingSource(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "copy_header",
				"from": "X-Missing-Header",
				"to":   "X-Upstream-Auth",
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"authorization": "Bearer token-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		return
	}
	if _, exists := headers["x-upstream-auth"]; exists {
		t.Fatalf("expected X-Upstream-Auth to be skipped when source header is missing")
	}
}

func TestApplyParamOverrideMoveHeaderSkipsMissingSource(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "move_header",
				"from": "X-Missing-Header",
				"to":   "X-Upstream-Auth",
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"authorization": "Bearer token-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		return
	}
	if _, exists := headers["x-upstream-auth"]; exists {
		t.Fatalf("expected X-Upstream-Auth to be skipped when source header is missing")
	}
}

func TestApplyParamOverrideSyncFieldsHeaderToJSON(t *testing.T) {
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "sync_fields",
				"from": "header:session_id",
				"to":   "json:prompt_cache_key",
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"session_id": "sess-123",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","prompt_cache_key":"sess-123"}`, string(out))
}

func TestApplyParamOverrideSyncFieldsJSONToHeader(t *testing.T) {
	input := []byte(`{"model":"gpt-4","prompt_cache_key":"cache-abc"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "sync_fields",
				"from": "header:session_id",
				"to":   "json:prompt_cache_key",
			},
		},
	}
	ctx := map[string]interface{}{}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","prompt_cache_key":"cache-abc"}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["session_id"] != "cache-abc" {
		t.Fatalf("expected session_id to be synced from prompt_cache_key, got: %v", headers["session_id"])
	}
}

func TestApplyParamOverrideSyncFieldsNoChangeWhenBothExist(t *testing.T) {
	input := []byte(`{"model":"gpt-4","prompt_cache_key":"cache-body"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "sync_fields",
				"from": "header:session_id",
				"to":   "json:prompt_cache_key",
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"session_id": "cache-header",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","prompt_cache_key":"cache-body"}`, string(out))

	headers, _ := ctx["header_override"].(map[string]interface{})
	if headers != nil {
		if _, exists := headers["session_id"]; exists {
			t.Fatalf("expected no override when both sides already have value")
		}
	}
}

func TestApplyParamOverrideSyncFieldsInvalidTarget(t *testing.T) {
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "sync_fields",
				"from": "foo:session_id",
				"to":   "json:prompt_cache_key",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideSetHeaderKeepOrigin(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode":        "set_header",
				"path":        "X-Feature-Flag",
				"value":       "new-value",
				"keep_origin": true,
			},
		},
	}
	ctx := map[string]interface{}{
		"header_override": map[string]interface{}{
			"x-feature-flag": "legacy-value",
		},
	}

	_, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["x-feature-flag"] != "legacy-value" {
		t.Fatalf("expected keep_origin to preserve old value, got: %v", headers["x-feature-flag"])
	}
}

func TestApplyParamOverrideSetHeaderMapRewritesCommaSeparatedHeader(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"advanced-tool-use-2025-11-20": nil,
					"computer-use-2025-01-24":      "computer-use-2025-01-24",
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"request_headers": map[string]interface{}{
			"anthropic-beta": "advanced-tool-use-2025-11-20, computer-use-2025-01-24",
		},
	}

	_, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["anthropic-beta"] != "computer-use-2025-01-24" {
		t.Fatalf("expected anthropic-beta to keep only mapped value, got: %v", headers["anthropic-beta"])
	}
}

func TestApplyParamOverrideSetHeaderMapDeleteWholeHeaderWhenAllTokensCleared(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"advanced-tool-use-2025-11-20": nil,
					"computer-use-2025-01-24":      nil,
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"header_override": map[string]interface{}{
			"anthropic-beta": "advanced-tool-use-2025-11-20,computer-use-2025-01-24",
		},
	}

	_, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if _, exists := headers["anthropic-beta"]; exists {
		t.Fatalf("expected anthropic-beta to be deleted when all mapped values are null")
	}
}

func TestApplyParamOverrideSetHeaderMapAppendsTokens(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"$append": []interface{}{"context-1m-2025-08-07", "computer-use-2025-01-24"},
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"header_override": map[string]interface{}{
			"anthropic-beta": "computer-use-2025-01-24",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["anthropic-beta"] != "computer-use-2025-01-24,context-1m-2025-08-07" {
		t.Fatalf("expected anthropic-beta to append new token without duplicates, got: %v", headers["anthropic-beta"])
	}
}

func TestApplyParamOverrideSetHeaderMapAppendsTokensWhenHeaderMissing(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"$append": []interface{}{"context-1m-2025-08-07", "computer-use-2025-01-24"},
				},
			},
		},
	}

	ctx := map[string]interface{}{}
	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["anthropic-beta"] != "context-1m-2025-08-07,computer-use-2025-01-24" {
		t.Fatalf("expected anthropic-beta to be created from appended tokens, got: %v", headers["anthropic-beta"])
	}
}

func TestApplyParamOverrideSetHeaderMapKeepOnlyDeclaredDropsUndeclaredTokens(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"computer-use-2025-01-24": "computer-use-2025-01-24",
					"$append":                 []interface{}{"context-1m-2025-08-07"},
					"$keep_only_declared":     true,
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"header_override": map[string]interface{}{
			"anthropic-beta": "advanced-tool-use-2025-11-20,computer-use-2025-01-24",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if headers["anthropic-beta"] != "computer-use-2025-01-24,context-1m-2025-08-07" {
		t.Fatalf("expected anthropic-beta to keep only declared tokens, got: %v", headers["anthropic-beta"])
	}
}

func TestApplyParamOverrideSetHeaderMapKeepOnlyDeclaredDeletesHeaderWhenNothingDeclaredMatches(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "set_header",
				"path": "anthropic-beta",
				"value": map[string]interface{}{
					"computer-use-2025-01-24": "computer-use-2025-01-24",
					"$keep_only_declared":     true,
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"header_override": map[string]interface{}{
			"anthropic-beta": "advanced-tool-use-2025-11-20",
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	headers, ok := ctx["header_override"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected header_override context map")
	}
	if _, exists := headers["anthropic-beta"]; exists {
		t.Fatalf("expected anthropic-beta to be deleted when no declared tokens remain, got: %v", headers["anthropic-beta"])
	}
}

func TestApplyParamOverrideConditionsObjectShorthand(t *testing.T) {
	input := []byte(`{"temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.1,
				"logic": "AND",
				"conditions": map[string]interface{}{
					"is_retry":               true,
					"last_error.status_code": 400.0,
				},
			},
		},
	}
	ctx := map[string]interface{}{
		"is_retry": true,
		"last_error": map[string]interface{}{
			"status_code": 400.0,
		},
	}

	out, err := ApplyParamOverride(input, override, ctx, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.1}`, string(out))
}

func TestApplyParamOverrideWithRelayInfoSyncRuntimeHeaders(t *testing.T) {
	info := &RelayInfo{
		ChannelMeta: &ChannelMeta{
			ParamOverride: map[string]interface{}{
				"operations": []interface{}{
					map[string]interface{}{
						"mode":  "set_header",
						"path":  "X-Injected-By-Param-Override",
						"value": "enabled",
					},
					map[string]interface{}{
						"mode": "delete_header",
						"path": "X-Delete-Me",
					},
				},
			},
			HeadersOverride: map[string]interface{}{
				"X-Delete-Me": "legacy",
				"X-Keep-Me":   "keep",
			},
		},
	}

	input := []byte(`{"temperature":0.7}`)
	out, err := ApplyParamOverrideWithRelayInfo(input, info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}
	assertJSONEqual(t, `{"temperature":0.7}`, string(out))

	if !info.UseRuntimeHeadersOverride {
		t.Fatalf("expected runtime header override to be enabled")
	}
	if info.RuntimeHeadersOverride["x-keep-me"] != "keep" {
		t.Fatalf("expected x-keep-me header to be preserved, got: %v", info.RuntimeHeadersOverride["x-keep-me"])
	}
	if info.RuntimeHeadersOverride["x-injected-by-param-override"] != "enabled" {
		t.Fatalf("expected x-injected-by-param-override header to be set, got: %v", info.RuntimeHeadersOverride["x-injected-by-param-override"])
	}
	if _, exists := info.RuntimeHeadersOverride["x-delete-me"]; exists {
		t.Fatalf("expected x-delete-me header to be deleted")
	}
}

func TestApplyParamOverrideWithRelayInfoMixedLegacyAndOperations(t *testing.T) {
	info := &RelayInfo{
		RequestHeaders: map[string]string{
			"Originator": "Codex CLI",
		},
		ChannelMeta: &ChannelMeta{
			ParamOverride: map[string]interface{}{
				"temperature": 0.2,
				"operations": []interface{}{
					map[string]interface{}{
						"mode":  "pass_headers",
						"value": []interface{}{"Originator"},
					},
				},
			},
			HeadersOverride: map[string]interface{}{
				"X-Static": "legacy-static",
			},
		},
	}

	out, err := ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-5","temperature":0.7}`), info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-5","temperature":0.2}`, string(out))

	if !info.UseRuntimeHeadersOverride {
		t.Fatalf("expected runtime header override to be enabled")
	}
	if info.RuntimeHeadersOverride["x-static"] != "legacy-static" {
		t.Fatalf("expected x-static to be preserved, got: %v", info.RuntimeHeadersOverride["x-static"])
	}
	if info.RuntimeHeadersOverride["originator"] != "Codex CLI" {
		t.Fatalf("expected originator header to be passed, got: %v", info.RuntimeHeadersOverride["originator"])
	}
}

func TestApplyParamOverrideWithRelayInfoMoveAndCopyHeaders(t *testing.T) {
	info := &RelayInfo{
		ChannelMeta: &ChannelMeta{
			ParamOverride: map[string]interface{}{
				"operations": []interface{}{
					map[string]interface{}{
						"mode": "move_header",
						"from": "X-Legacy-Trace",
						"to":   "X-Trace",
					},
					map[string]interface{}{
						"mode": "copy_header",
						"from": "X-Trace",
						"to":   "X-Trace-Backup",
					},
				},
			},
			HeadersOverride: map[string]interface{}{
				"X-Legacy-Trace": "trace-123",
			},
		},
	}

	input := []byte(`{"temperature":0.7}`)
	_, err := ApplyParamOverrideWithRelayInfo(input, info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}
	if _, exists := info.RuntimeHeadersOverride["x-legacy-trace"]; exists {
		t.Fatalf("expected source header to be removed after move")
	}
	if info.RuntimeHeadersOverride["x-trace"] != "trace-123" {
		t.Fatalf("expected x-trace to be set, got: %v", info.RuntimeHeadersOverride["x-trace"])
	}
	if info.RuntimeHeadersOverride["x-trace-backup"] != "trace-123" {
		t.Fatalf("expected x-trace-backup to be copied, got: %v", info.RuntimeHeadersOverride["x-trace-backup"])
	}
}

func TestApplyParamOverrideWithRelayInfoSetHeaderMapRewritesAnthropicBeta(t *testing.T) {
	info := &RelayInfo{
		ChannelMeta: &ChannelMeta{
			ParamOverride: map[string]interface{}{
				"operations": []interface{}{
					map[string]interface{}{
						"mode": "set_header",
						"path": "anthropic-beta",
						"value": map[string]interface{}{
							"advanced-tool-use-2025-11-20": nil,
							"computer-use-2025-01-24":      "computer-use-2025-01-24",
						},
					},
				},
			},
			HeadersOverride: map[string]interface{}{
				"anthropic-beta": "advanced-tool-use-2025-11-20, computer-use-2025-01-24",
			},
		},
	}

	_, err := ApplyParamOverrideWithRelayInfo([]byte(`{"temperature":0.7}`), info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}

	if !info.UseRuntimeHeadersOverride {
		t.Fatalf("expected runtime header override to be enabled")
	}
	if info.RuntimeHeadersOverride["anthropic-beta"] != "computer-use-2025-01-24" {
		t.Fatalf("expected anthropic-beta to be rewritten, got: %v", info.RuntimeHeadersOverride["anthropic-beta"])
	}
}

func TestGetEffectiveHeaderOverrideUsesRuntimeOverrideAsFinalResult(t *testing.T) {
	info := &RelayInfo{
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]interface{}{
			"x-runtime": "runtime-only",
		},
		ChannelMeta: &ChannelMeta{
			HeadersOverride: map[string]interface{}{
				"X-Static":  "static-value",
				"X-Deleted": "should-not-exist",
			},
		},
	}

	effective := GetEffectiveHeaderOverride(info)
	if effective["x-runtime"] != "runtime-only" {
		t.Fatalf("expected x-runtime from runtime override, got: %v", effective["x-runtime"])
	}
	if _, exists := effective["x-static"]; exists {
		t.Fatalf("expected runtime override to be final and not merge channel headers")
	}
}

func TestRemoveDisabledFieldsSkipWhenChannelPassThroughEnabled(t *testing.T) {
	input := `{
		"service_tier":"flex",
		"safety_identifier":"user-123",
		"store":true,
		"stream_options":{"include_obfuscation":false}
	}`
	settings := dto.ChannelOtherSettings{}

	out, err := RemoveDisabledFields([]byte(input), settings, true)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}
	assertJSONEqual(t, input, string(out))
}

func TestRemoveDisabledFieldsSkipWhenGlobalPassThroughEnabled(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	t.Cleanup(func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = original
	})

	input := `{
		"service_tier":"flex",
		"safety_identifier":"user-123",
		"stream_options":{"include_obfuscation":false}
	}`
	settings := dto.ChannelOtherSettings{}

	out, err := RemoveDisabledFields([]byte(input), settings, false)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}
	assertJSONEqual(t, input, string(out))
}

func TestRemoveDisabledFieldsDefaultFiltering(t *testing.T) {
	input := `{
		"service_tier":"flex",
		"inference_geo":"eu",
		"safety_identifier":"user-123",
		"store":true,
		"stream_options":{"include_obfuscation":false}
	}`
	settings := dto.ChannelOtherSettings{}

	out, err := RemoveDisabledFields([]byte(input), settings, false)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}
	assertJSONEqual(t, `{"store":true}`, string(out))
}

func TestRemoveDisabledFieldsAllowInferenceGeo(t *testing.T) {
	input := `{
		"inference_geo":"eu",
		"store":true
	}`
	settings := dto.ChannelOtherSettings{
		AllowInferenceGeo: true,
	}

	out, err := RemoveDisabledFields([]byte(input), settings, false)
	if err != nil {
		t.Fatalf("RemoveDisabledFields returned error: %v", err)
	}
	assertJSONEqual(t, `{"inference_geo":"eu","store":true}`, string(out))
}

func assertJSONEqual(t *testing.T, want, got string) {
	t.Helper()

	var wantObj interface{}
	var gotObj interface{}

	if err := json.Unmarshal([]byte(want), &wantObj); err != nil {
		t.Fatalf("failed to unmarshal want JSON: %v", err)
	}
	if err := json.Unmarshal([]byte(got), &gotObj); err != nil {
		t.Fatalf("failed to unmarshal got JSON: %v", err)
	}

	if !reflect.DeepEqual(wantObj, gotObj) {
		t.Fatalf("json not equal\nwant: %s\ngot:  %s", want, got)
	}
}

// TestBuildParamOverrideContext_SystemMetadata 测试系统元数据被正确添加
func TestBuildParamOverrideContext_SystemMetadata(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-4",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "text", "text": "请描述这张图片"},
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/img.jpg"}},
				},
			},
		},
	}

	info := &RelayInfo{
		Request:         request,
		OriginModelName: "gpt-4",
	}

	ctx := BuildParamOverrideContext(info)

	// 验证元数据在顶层
	// 验证 count_image
	if count, ok := ctx["count_image"].(int); !ok || count != 1 {
		t.Errorf("Expected count_image to be 1, got %v", ctx["count_image"])
	}

	// 验证 message_count
	if count, ok := ctx["message_count"].(int); !ok || count != 1 {
		t.Errorf("Expected message_count to be 1, got %v", ctx["message_count"])
	}

	// 验证 text_length
	if length, ok := ctx["text_length"].(int); !ok || length <= 0 {
		t.Errorf("Expected text_length to be positive, got %v", ctx["text_length"])
	}

	// 验证 text_length_last
	if length, ok := ctx["text_length_last"].(int); !ok || length <= 0 {
		t.Errorf("Expected text_length_last to be positive, got %v", ctx["text_length_last"])
	}
}

// TestBuildParamOverrideContext_NilRequest 测试空请求不会导致 panic
func TestBuildParamOverrideContext_NilRequest(t *testing.T) {
	info := &RelayInfo{
		Request:         nil,
		OriginModelName: "gpt-4",
	}

	ctx := BuildParamOverrideContext(info)

	// 验证 $ 不存在
	if _, exists := ctx["$"]; exists {
		t.Error("Expected $ to not exist for nil request")
	}
}

// TestParamOverrideEndToEnd_MetadataDriven 测试端到端的元数据驱动 override 功能
// 验证 BuildParamOverrideContext 和 ApplyParamOverrideWithRelayInfo 的完整流程
func TestParamOverrideEndToEnd_MetadataDriven(t *testing.T) {
	// 创建一个包含图片、视频和文本的复杂请求
	// 注意：video_url 使用字符串格式（根据 ParseContent 方法的实现）
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o",
		Messages: []dto.Message{
			{
				Role: "system",
				Content: []any{
					map[string]any{"type": "text", "text": "你是一个有用的助手"},
				},
			},
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "text", "text": "请分析这张图片和这个视频"},
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/image1.jpg"}},
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/image2.png"}},
					map[string]any{"type": "video_url", "video_url": "https://example.com/video.mp4"},
				},
			},
		},
	}

	// 创建 ParamOverride，基于 token、图片数量、视频数量设置条件
	paramOverride := map[string]interface{}{
		"operations": []interface{}{
			// 当图片数量 >= 2 时，增加 max_tokens
			map[string]interface{}{
				"path":  "max_tokens",
				"mode":  "set",
				"value": 8192,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "count_image",
						"mode":  "gte",
						"value": 2,
					},
				},
			},
			// 当视频数量 >= 1 时，设置 temperature 为 0.5
			map[string]interface{}{
				"path":  "temperature",
				"mode":  "set",
				"value": 0.5,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "count_video",
						"mode":  "gte",
						"value": 1,
					},
				},
			},
			// 当 estimate_tokens > 10 时，添加一个标记字段
			map[string]interface{}{
				"path":  "metadata.high_token_request",
				"mode":  "set",
				"value": true,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "estimate_tokens",
						"mode":  "gt",
						"value": 10,
					},
				},
			},
		},
	}

	// 创建 RelayInfo
	info := &RelayInfo{
		Request:         request,
		OriginModelName: "gpt-4o",
		ChannelMeta: &ChannelMeta{
			ParamOverride: paramOverride,
		},
	}
	// 设置 estimatePromptTokens（模拟实际场景中的 token 估算）
	info.SetEstimatePromptTokens(100)

	// 步骤 1: 调用 BuildParamOverrideContext 构建上下文
	ctx := BuildParamOverrideContext(info)

	// 验证元数据被正确提取到上下文中
	// 验证 count_image = 2
	if count, ok := ctx["count_image"].(int); !ok || count != 2 {
		t.Errorf("Expected count_image to be 2, got %v", ctx["count_image"])
	}

	// 验证 count_video = 1
	if count, ok := ctx["count_video"].(int); !ok || count != 1 {
		t.Errorf("Expected count_video to be 1, got %v", ctx["count_video"])
	}

	// 验证 estimate_tokens = 100
	if tokens, ok := ctx["estimate_tokens"].(int); !ok || tokens != 100 {
		t.Errorf("Expected estimate_tokens to be 100, got %v", ctx["estimate_tokens"])
	}

	// 验证 message_count = 2
	if count, ok := ctx["message_count"].(int); !ok || count != 2 {
		t.Errorf("Expected message_count to be 2, got %v", ctx["message_count"])
	}

	// 验证 text_length > 0
	if length, ok := ctx["text_length"].(int); !ok || length <= 0 {
		t.Errorf("Expected text_length to be positive, got %v", ctx["text_length"])
	}

	// 步骤 2: 调用 ApplyParamOverrideWithRelayInfo 应用 override
	input := `{"model":"gpt-4o","max_tokens":1000,"temperature":0.7}`
	out, err := ApplyParamOverrideWithRelayInfo([]byte(input), info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}

	// 解析结果
	result := make(map[string]interface{})
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatalf("Failed to unmarshal result: %v", err)
	}

	// 验证 override 效果：max_tokens 应该被设置为 8192（因为 count_image >= 2）
	if maxTokens, ok := result["max_tokens"].(float64); !ok || maxTokens != 8192 {
		t.Errorf("Expected max_tokens to be 8192 (override by image count), got %v", result["max_tokens"])
	}

	// 验证 override 效果：temperature 应该被设置为 0.5（因为 count_video >= 1）
	if temp, ok := result["temperature"].(float64); !ok || temp != 0.5 {
		t.Errorf("Expected temperature to be 0.5 (override by video count), got %v", result["temperature"])
	}

	// 验证 override 效果：metadata.high_token_request 应该被设置为 true（因为 estimate_tokens > 10）
	metadata, ok := result["metadata"].(map[string]interface{})
	if !ok {
		t.Errorf("Expected metadata field to be present")
	} else if highToken, ok := metadata["high_token_request"].(bool); !ok || !highToken {
		t.Errorf("Expected metadata.high_token_request to be true (override by estimate_tokens), got %v", metadata["high_token_request"])
	}
}

// TestParamOverrideEndToEnd_TokenBasedCondition 测试基于 estimate_tokens 的条件 override
func TestParamOverrideEndToEnd_TokenBasedCondition(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-4",
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "这是一段很长的文本内容，用于测试基于 token 数量的条件判断逻辑",
			},
		},
	}

	paramOverride := map[string]interface{}{
		"operations": []interface{}{
			// 当 estimate_tokens >= 50 时，启用 stream
			map[string]interface{}{
				"path":  "stream",
				"mode":  "set",
				"value": true,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "estimate_tokens",
						"mode":  "gte",
						"value": 50,
					},
				},
			},
		},
	}

	info := &RelayInfo{
		Request:         request,
		OriginModelName: "gpt-4",
		ChannelMeta: &ChannelMeta{
			ParamOverride: paramOverride,
		},
	}
	info.SetEstimatePromptTokens(100)

	// 调用 ApplyParamOverrideWithRelayInfo
	input := `{"model":"gpt-4","max_tokens":500}`
	out, err := ApplyParamOverrideWithRelayInfo([]byte(input), info)
	if err != nil {
		t.Fatalf("ApplyParamOverrideWithRelayInfo returned error: %v", err)
	}

	result := make(map[string]interface{})
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatalf("Failed to unmarshal result: %v", err)
	}

	// 验证 stream 被设置为 true
	if stream, ok := result["stream"].(bool); !ok || !stream {
		t.Errorf("Expected stream to be true (override by estimate_tokens >= 50), got %v", result["stream"])
	}
}

// TestSystemMetadataCondition_ImageCount 测试条件判断正常工作
func TestSystemMetadataCondition_ImageCount(t *testing.T) {
	input := `{"model":"gpt-4","max_tokens":1000}`

	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "max_tokens",
				"mode":  "set",
				"value": 4096,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "count_image",
						"mode":  "gte",
						"value": 1,
					},
				},
			},
		},
	}

	context := map[string]interface{}{
		"count_image": 2,
	}

	out, err := ApplyParamOverride([]byte(input), override, context, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	result := make(map[string]interface{})
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatalf("Failed to unmarshal result: %v", err)
	}

	if maxTokens, ok := result["max_tokens"].(float64); !ok || maxTokens != 4096 {
		t.Errorf("Expected max_tokens to be 4096, got %v", result["max_tokens"])
	}
}

// TestSystemMetadataCondition_MessageCount 测试消息数量条件
func TestSystemMetadataCondition_MessageCount(t *testing.T) {
	input := `{"model":"gpt-4","max_tokens":1000}`

	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "max_tokens",
				"mode":  "set",
				"value": 8192,
				"conditions": []interface{}{
					map[string]interface{}{
						"path":  "message_count",
						"mode":  "gt",
						"value": 10,
					},
				},
			},
		},
	}

	// 测试条件不满足的情况
	context := map[string]interface{}{
		"message_count": 5,
	}

	out, err := ApplyParamOverride([]byte(input), override, context, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	result := make(map[string]interface{})
	if err := json.Unmarshal(out, &result); err != nil {
		t.Fatalf("Failed to unmarshal result: %v", err)
	}

	// 条件不满足，max_tokens 应该保持原值
	if maxTokens, ok := result["max_tokens"].(float64); !ok || maxTokens != 1000 {
		t.Errorf("Expected max_tokens to remain 1000, got %v", result["max_tokens"])
	}
}

// TestBuildRequestMetadata_MultipleMediaTypes 测试多种媒体类型
func TestBuildRequestMetadata_MultipleMediaTypes(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-4",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "text", "text": "Hello"},
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/img1.jpg"}},
					map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/img2.jpg"}},
				},
			},
			{
				Role:    "assistant",
				Content: "Hi there!",
			},
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "input_audio", "input_audio": map[string]any{"data": "base64audio", "format": "wav"}},
					map[string]any{"type": "file", "file": map[string]any{"file_id": "file123"}},
				},
			},
		},
	}

	info := &RelayInfo{
		Request:         request,
		OriginModelName: "gpt-4",
	}

	ctx := BuildParamOverrideContext(info)

	// 验证各种计数（元数据在顶层）
	if count, ok := ctx["count_image"].(int); !ok || count != 2 {
		t.Errorf("Expected count_image to be 2, got %v", ctx["count_image"])
	}
	if count, ok := ctx["count_audio"].(int); !ok || count != 1 {
		t.Errorf("Expected count_audio to be 1, got %v", ctx["count_audio"])
	}
	if count, ok := ctx["count_file"].(int); !ok || count != 1 {
		t.Errorf("Expected count_file to be 1, got %v", ctx["count_file"])
	}
	if count, ok := ctx["message_count"].(int); !ok || count != 3 {
		t.Errorf("Expected message_count to be 3, got %v", ctx["message_count"])
	}
}
