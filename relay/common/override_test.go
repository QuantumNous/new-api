package common

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/types"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func TestApplyParamOverrideTrimPrefix(t *testing.T) {
	// trim_prefix example:
	// {"operations":[{"path":"model","mode":"trim_prefix","value":"openai/"}]}
	input := []byte(`{"model":"openai/gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "trim_prefix",
				"value": "openai/",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideTrimSuffix(t *testing.T) {
	// trim_suffix example:
	// {"operations":[{"path":"model","mode":"trim_suffix","value":"-latest"}]}
	input := []byte(`{"model":"gpt-4-latest","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "trim_suffix",
				"value": "-latest",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideTrimNoop(t *testing.T) {
	// trim_prefix no-op example:
	// {"operations":[{"path":"model","mode":"trim_prefix","value":"openai/"}]}
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "trim_prefix",
				"value": "openai/",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideTrimRequiresValue(t *testing.T) {
	// trim_prefix requires value example:
	// {"operations":[{"path":"model","mode":"trim_prefix"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "trim_prefix",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideReplace(t *testing.T) {
	// replace example:
	// {"operations":[{"path":"model","mode":"replace","from":"openai/","to":""}]}
	input := []byte(`{"model":"openai/gpt-4o-mini","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "replace",
				"from": "openai/",
				"to":   "",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4o-mini","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideRegexReplace(t *testing.T) {
	// regex_replace example:
	// {"operations":[{"path":"model","mode":"regex_replace","from":"^gpt-","to":"openai/gpt-"}]}
	input := []byte(`{"model":"gpt-4o-mini","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "regex_replace",
				"from": "^gpt-",
				"to":   "openai/gpt-",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"openai/gpt-4o-mini","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideReplaceRequiresFrom(t *testing.T) {
	// replace requires from example:
	// {"operations":[{"path":"model","mode":"replace"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "replace",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideRegexReplaceRequiresPattern(t *testing.T) {
	// regex_replace requires from(pattern) example:
	// {"operations":[{"path":"model","mode":"regex_replace"}]}
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "model",
				"mode": "regex_replace",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverrideDelete(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "temperature",
				"mode": "delete",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}

	var got map[string]interface{}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("failed to unmarshal output JSON: %v", err)
	}
	if _, exists := got["temperature"]; exists {
		t.Fatalf("expected temperature to be deleted")
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

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.1}`, string(out))
}

func TestApplyParamOverrideSetKeepOrigin(t *testing.T) {
	input := []byte(`{"model":"gpt-4","temperature":0.7}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":        "temperature",
				"mode":        "set",
				"value":       0.1,
				"keep_origin": true,
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"gpt-4","temperature":0.7}`, string(out))
}

func TestApplyParamOverrideMove(t *testing.T) {
	input := []byte(`{"model":"gpt-4","meta":{"x":1}}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "move",
				"from": "model",
				"to":   "meta.model",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"meta":{"x":1,"model":"gpt-4"}}`, string(out))
}

func TestApplyParamOverrideMoveMissingSource(t *testing.T) {
	input := []byte(`{"meta":{"x":1}}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"mode": "move",
				"from": "model",
				"to":   "meta.model",
			},
		},
	}

	_, err := ApplyParamOverride(input, override, nil)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestApplyParamOverridePrependAppendString(t *testing.T) {
	input := []byte(`{"model":"gpt-4"}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "model",
				"mode":  "prepend",
				"value": "openai/",
			},
			map[string]interface{}{
				"path":  "model",
				"mode":  "append",
				"value": "-latest",
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"model":"openai/gpt-4-latest"}`, string(out))
}

func TestApplyParamOverridePrependAppendArray(t *testing.T) {
	input := []byte(`{"arr":[1,2]}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":  "arr",
				"mode":  "prepend",
				"value": 0,
			},
			map[string]interface{}{
				"path":  "arr",
				"mode":  "append",
				"value": []interface{}{3, 4},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"arr":[0,1,2,3,4]}`, string(out))
}

func TestApplyParamOverrideAppendObjectMergeKeepOrigin(t *testing.T) {
	input := []byte(`{"obj":{"a":1}}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path":        "obj",
				"mode":        "append",
				"keep_origin": true,
				"value": map[string]interface{}{
					"a": 2,
					"b": 3,
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"obj":{"a":1,"b":3}}`, string(out))
}

func TestApplyParamOverrideAppendObjectMergeOverride(t *testing.T) {
	input := []byte(`{"obj":{"a":1}}`)
	override := map[string]interface{}{
		"operations": []interface{}{
			map[string]interface{}{
				"path": "obj",
				"mode": "append",
				"value": map[string]interface{}{
					"a": 2,
					"b": 3,
				},
			},
		},
	}

	out, err := ApplyParamOverride(input, override, nil)
	if err != nil {
		t.Fatalf("ApplyParamOverride returned error: %v", err)
	}
	assertJSONEqual(t, `{"obj":{"a":2,"b":3}}`, string(out))
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, nil)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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

	_, err := ApplyParamOverride(input, override, nil)
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

	_, err := ApplyParamOverride(input, override, ctx)
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

	_, err := ApplyParamOverride(input, override, ctx)
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

	_, err := ApplyParamOverride(input, override, ctx)
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

	out, err := ApplyParamOverride(input, override, ctx)
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
