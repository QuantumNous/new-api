package dto

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestFlexibleArguments_UnmarshalPreservesShape(t *testing.T) {
	cases := []struct {
		name string
		in   string
		// expectedRaw is the verbatim JSON we expect FlexibleArguments to remember.
		expectedRaw string
		// expectedString is what String() should yield.
		expectedString string
	}{
		{
			name:           "string payload",
			in:             `"{\"foo\":\"bar\"}"`,
			expectedRaw:    `"{\"foo\":\"bar\"}"`,
			expectedString: `{"foo":"bar"}`,
		},
		{
			name:           "object payload",
			in:             `{"foo":"bar"}`,
			expectedRaw:    `{"foo":"bar"}`,
			expectedString: `{"foo":"bar"}`,
		},
		{
			name:           "array payload",
			in:             `[1,2,3]`,
			expectedRaw:    `[1,2,3]`,
			expectedString: `[1,2,3]`,
		},
		{
			name:           "null payload",
			in:             `null`,
			expectedRaw:    ``,
			expectedString: ``,
		},
		{
			name:           "empty string payload",
			in:             `""`,
			expectedRaw:    `""`,
			expectedString: ``,
		},
		{
			name:           "number payload",
			in:             `42`,
			expectedRaw:    `42`,
			expectedString: `42`,
		},
		{
			name:           "boolean true payload",
			in:             `true`,
			expectedRaw:    `true`,
			expectedString: `true`,
		},
		{
			name:           "boolean false payload",
			in:             `false`,
			expectedRaw:    `false`,
			expectedString: `false`,
		},
		{
			name:           "leading and trailing whitespace stripped on unmarshal",
			in:             "   {\"foo\":\"bar\"}   ",
			expectedRaw:    `{"foo":"bar"}`,
			expectedString: `{"foo":"bar"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var fa FlexibleArguments
			if err := fa.UnmarshalJSON([]byte(tc.in)); err != nil {
				t.Fatalf("UnmarshalJSON: %v", err)
			}
			if string(fa) != tc.expectedRaw {
				t.Fatalf("raw mismatch: want %q got %q", tc.expectedRaw, string(fa))
			}
			if got := fa.String(); got != tc.expectedString {
				t.Fatalf("String() mismatch: want %q got %q", tc.expectedString, got)
			}
		})
	}
}

func TestFlexibleArguments_MarshalRoundTripPreservesShape(t *testing.T) {
	type wrap struct {
		Arguments FlexibleArguments `json:"arguments,omitempty"`
	}

	cases := []struct {
		name string
		in   string
		// expectedField is what we expect the re-marshaled JSON to contain
		// for the `arguments` key (or empty string if the key should be elided).
		expectedField string
	}{
		{
			name:          "object preserved as object",
			in:            `{"arguments":{"foo":"bar"}}`,
			expectedField: `"arguments":{"foo":"bar"}`,
		},
		{
			name:          "string preserved as string",
			in:            `{"arguments":"abc"}`,
			expectedField: `"arguments":"abc"`,
		},
		{
			name:          "array preserved as array",
			in:            `{"arguments":[1,2]}`,
			expectedField: `"arguments":[1,2]`,
		},
		{
			name:          "null elided by omitempty",
			in:            `{"arguments":null}`,
			expectedField: ``,
		},
		{
			name:          "absent field stays absent",
			in:            `{}`,
			expectedField: ``,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var w wrap
			if err := common.UnmarshalJsonStr(tc.in, &w); err != nil {
				t.Fatalf("Unmarshal: %v", err)
			}
			out, err := common.Marshal(w)
			if err != nil {
				t.Fatalf("Marshal: %v", err)
			}
			outStr := string(out)
			if tc.expectedField == "" {
				if strings.Contains(outStr, `"arguments"`) {
					t.Fatalf("expected arguments to be elided, got %s", outStr)
				}
				return
			}
			if !strings.Contains(outStr, tc.expectedField) {
				t.Fatalf("expected %q in %s", tc.expectedField, outStr)
			}
		})
	}
}

func TestFlexibleArguments_MarshalIsIdempotent(t *testing.T) {
	// The same FlexibleArguments value must marshal to identical bytes on
	// every call; otherwise stream prefix-match logic in chat_via_responses.go
	// could see spurious diffs across chunks.
	type wrap struct {
		Arguments FlexibleArguments `json:"arguments,omitempty"`
	}
	inputs := []string{
		`{"arguments":"abc"}`,
		`{"arguments":{"foo":"bar","baz":1}}`,
		`{"arguments":[1,2,3]}`,
		`{"arguments":42}`,
		`{"arguments":true}`,
	}
	for _, in := range inputs {
		t.Run(in, func(t *testing.T) {
			var w wrap
			if err := common.UnmarshalJsonStr(in, &w); err != nil {
				t.Fatalf("Unmarshal: %v", err)
			}
			first, err := common.Marshal(w)
			if err != nil {
				t.Fatalf("Marshal #1: %v", err)
			}
			for i := 0; i < 4; i++ {
				next, err := common.Marshal(w)
				if err != nil {
					t.Fatalf("Marshal #%d: %v", i+2, err)
				}
				if string(next) != string(first) {
					t.Fatalf("non-idempotent marshal: first=%s later=%s", first, next)
				}
			}
		})
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_FunctionCallObjectToString(t *testing.T) {
	in := `{"type":"response.output_item.done","item":{"type":"function_call","arguments":{"path":"/etc"}}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if !strings.Contains(out, `"arguments":"{\"path\":\"/etc\"}"`) {
		t.Fatalf("expected stringified arguments, got %s", out)
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_ToolSearchCallStringToObject(t *testing.T) {
	in := `{"type":"response.output_item.done","item":{"type":"tool_search_call","arguments":"{\"query\":\"hello\"}"}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if !strings.Contains(out, `"arguments":{"query":"hello"}`) {
		t.Fatalf("expected object-shaped arguments, got %s", out)
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_AlreadyCorrectShapesAreNoOp(t *testing.T) {
	cases := []string{
		// function_call already string - no change
		`{"type":"response.output_item.done","item":{"type":"function_call","arguments":"{\"a\":1}"}}`,
		// tool_search_call already object - no change
		`{"type":"response.output_item.done","item":{"type":"tool_search_call","arguments":{"a":1}}}`,
	}
	for _, in := range cases {
		out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
		if err != nil {
			t.Fatalf("err: %v (input=%s)", err, in)
		}
		if changed {
			t.Fatalf("expected no change for %s, got %s", in, out)
		}
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_ExtendedObjectArgTypes(t *testing.T) {
	// code_interpreter_call and mcp_call are also expected to carry object-shaped
	// arguments. They should be normalized the same way as tool_search_call.
	cases := []struct {
		typ string
	}{
		{"code_interpreter_call"},
		{"mcp_call"},
	}
	for _, tc := range cases {
		t.Run(tc.typ, func(t *testing.T) {
			in := `{"type":"response.output_item.done","item":{"type":"` + tc.typ + `","arguments":"{\"k\":1}"}}`
			out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if !changed {
				t.Fatalf("expected change for %s", tc.typ)
			}
			if !strings.Contains(out, `"arguments":{"k":1}`) {
				t.Fatalf("expected object-shape for %s, got %s", tc.typ, out)
			}
		})
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_FunctionCallNullBecomesEmptyString(t *testing.T) {
	in := `{"type":"response.output_item.done","item":{"type":"function_call","arguments":null}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed {
		t.Fatalf("expected change")
	}
	if !strings.Contains(out, `"arguments":""`) {
		t.Fatalf("expected empty-string arguments, got %s", out)
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_ObjectTypeWithMalformedStringIsLeftAlone(t *testing.T) {
	// When a whitelisted type carries a string that is not valid JSON, the
	// normalizer leaves the original string in place rather than failing the
	// entire event. The downstream may still recover.
	in := `{"type":"response.output_item.done","item":{"type":"tool_search_call","arguments":"not-json"}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if changed {
		t.Fatalf("expected no change for malformed JSON string, got %s", out)
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_ResponseOutputArrayMixedTypes(t *testing.T) {
	in := `{"type":"response.completed","response":{"output":[` +
		`{"type":"function_call","arguments":{"path":"/etc"}},` +
		`{"type":"tool_search_call","arguments":"{\"q\":1}"},` +
		`{"type":"web_search_call","arguments":{"q":2}}` +
		`]}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !changed {
		t.Fatalf("expected changed=true")
	}
	if !strings.Contains(out, `"arguments":"{\"path\":\"/etc\"}"`) {
		t.Fatalf("function_call should become string, got %s", out)
	}
	if !strings.Contains(out, `"arguments":{"q":1}`) {
		t.Fatalf("tool_search_call should become object, got %s", out)
	}
	if !strings.Contains(out, `"arguments":{"q":2}`) {
		t.Fatalf("web_search_call should stay object, got %s", out)
	}
}

func TestNormalizeResponsesStreamArgumentsJSON_NoArgumentsField(t *testing.T) {
	in := `{"type":"response.created","response":{"id":"abc"}}`
	out, changed, err := NormalizeResponsesStreamArgumentsJSON(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if changed {
		t.Fatalf("expected no change")
	}
	if out != in {
		t.Fatalf("expected pass-through, got %s", out)
	}
}
