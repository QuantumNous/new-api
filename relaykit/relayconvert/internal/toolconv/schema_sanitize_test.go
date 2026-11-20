package toolconv

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeToolParameters_DropsNullRequired(t *testing.T) {
	parameters := map[string]any{
		"type":       "object",
		"properties": map[string]any{"path": map[string]any{"type": "string"}},
		"required":   nil,
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if !changed {
		t.Fatal("expected the null required member to be reported as changed")
	}
	schema, ok := sanitized.(map[string]any)
	if !ok {
		t.Fatalf("expected a map, got %T", sanitized)
	}
	if _, exists := schema["required"]; exists {
		t.Error("expected the null required member to be dropped")
	}
	if schema["type"] != "object" {
		t.Errorf("expected type to survive, got %v", schema["type"])
	}
	if _, exists := schema["properties"]; !exists {
		t.Error("expected properties to survive")
	}
}

func TestSanitizeToolParameters_KeepsValidRequired(t *testing.T) {
	parameters := map[string]any{
		"type":     "object",
		"required": []any{"path"},
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if changed {
		t.Fatal("a valid required array must be left untouched")
	}
	schema := sanitized.(map[string]any)
	required, ok := schema["required"].([]any)
	if !ok || len(required) != 1 || required[0] != "path" {
		t.Errorf("expected required to be preserved, got %v", schema["required"])
	}
}

func TestSanitizeToolParameters_DropsNullRequiredInNestedSchemas(t *testing.T) {
	parameters := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"filter": map[string]any{
				"type":     "object",
				"required": nil,
			},
		},
		"items": []any{
			map[string]any{"type": "object", "required": nil},
		},
	}

	sanitized, changed := sanitizeToolParameters(parameters)

	if !changed {
		t.Fatal("expected nested null required members to be reported as changed")
	}
	schema := sanitized.(map[string]any)
	nested := schema["properties"].(map[string]any)["filter"].(map[string]any)
	if _, exists := nested["required"]; exists {
		t.Error("expected the nested null required member to be dropped")
	}
	item := schema["items"].([]any)[0].(map[string]any)
	if _, exists := item["required"]; exists {
		t.Error("expected the null required member inside an array to be dropped")
	}
}

func TestSanitizeToolParameters_IgnoresNonSchemaValues(t *testing.T) {
	for _, value := range []any{nil, "text", 42, true} {
		if _, changed := sanitizeToolParameters(value); changed {
			t.Errorf("expected %v to be left untouched", value)
		}
	}
}

func TestSanitizeDefinitions_RepairsFunctionTools(t *testing.T) {
	definitions := []Definition{
		{Name: "no_function"},
		{
			Name: "read_file",
			Function: &Function{
				Name:       "read_file",
				Parameters: map[string]any{"type": "object", "required": nil},
			},
		},
	}

	sanitizeDefinitions(definitions)

	schema := definitions[1].Function.Parameters.(map[string]any)
	if _, exists := schema["required"]; exists {
		t.Error("expected the null required member to be dropped")
	}
	if definitions[0].Function != nil {
		t.Error("expected a definition without a function to stay untouched")
	}
}

// Keywords such as default, examples, const and enum carry instance data, so a
// literal {"required": null} inside them is legitimate payload rather than a
// malformed schema.
func TestSanitizeToolParameters_PreservesInstanceData(t *testing.T) {
	for _, keyword := range []string{"default", "examples", "const", "enum", "x-vendor"} {
		t.Run(keyword, func(t *testing.T) {
			payload := map[string]any{"required": nil}
			parameters := map[string]any{
				"type": "object",
				"properties": map[string]any{
					"cfg": map[string]any{
						"type":  "object",
						keyword: payload,
					},
				},
			}

			_, changed := sanitizeToolParameters(parameters)

			if changed {
				t.Errorf("instance data under %q must not be treated as a schema", keyword)
			}
			if _, exists := payload["required"]; !exists {
				t.Errorf("expected the literal required member under %q to survive", keyword)
			}
		})
	}
}

func TestSanitizeToolParameters_WalksSchemaKeywords(t *testing.T) {
	cases := map[string]map[string]any{
		"properties":           {"properties": map[string]any{"a": map[string]any{"required": nil}}},
		"patternProperties":    {"patternProperties": map[string]any{"^a$": map[string]any{"required": nil}}},
		"$defs":                {"$defs": map[string]any{"a": map[string]any{"required": nil}}},
		"items object":         {"items": map[string]any{"required": nil}},
		"items tuple":          {"items": []any{map[string]any{"required": nil}}},
		"prefixItems":          {"prefixItems": []any{map[string]any{"required": nil}}},
		"anyOf":                {"anyOf": []any{map[string]any{"required": nil}}},
		"allOf":                {"allOf": []any{map[string]any{"required": nil}}},
		"oneOf":                {"oneOf": []any{map[string]any{"required": nil}}},
		"not":                  {"not": map[string]any{"required": nil}},
		"if":                   {"if": map[string]any{"required": nil}},
		"additionalProperties": {"additionalProperties": map[string]any{"required": nil}},
		"contentSchema":        {"contentSchema": map[string]any{"required": nil}},
		"dependencies":         {"dependencies": map[string]any{"a": map[string]any{"required": nil}}},
		"dependentSchemas":     {"dependentSchemas": map[string]any{"a": map[string]any{"required": nil}}},
	}

	for name, parameters := range cases {
		t.Run(name, func(t *testing.T) {
			if _, changed := sanitizeToolParameters(parameters); !changed {
				t.Fatalf("expected the null required member under %s to be dropped", name)
			}
		})
	}
}

func TestSanitizeToolParameters_StopsAtMaxDepth(t *testing.T) {
	root := map[string]any{}
	node := root
	for i := 0; i < schemaSanitizeMaxDepth+10; i++ {
		child := map[string]any{}
		node["not"] = child
		node = child
	}
	node["required"] = nil

	// The point is that a pathologically deep schema terminates instead of
	// exhausting the stack.
	sanitizeToolParameters(root)
}

// Draft-07 "dependencies" may also map a property name to an array of required
// property names. That form is instance data, not a subschema.
func TestSanitizeToolParameters_PreservesArrayFormDependencies(t *testing.T) {
	names := []any{"b", "c"}
	parameters := map[string]any{
		"type":         "object",
		"dependencies": map[string]any{"a": names},
	}

	if _, changed := sanitizeToolParameters(parameters); changed {
		t.Error("array-form dependencies must be left untouched")
	}
	if len(names) != 2 {
		t.Errorf("expected the property-name list to survive, got %v", names)
	}
}

func TestSanitizeChatRequestToolsDropsNullRequired(t *testing.T) {
	var request dto.GeneralOpenAIRequest
	body := `{"model":"m","tools":[{"type":"function","function":{"name":"t","parameters":{"type":"object","properties":{"a":{"type":"object","required":null,"properties":{}}},"required":null,"default":{"required":null}}}}],"functions":[{"name":"f","parameters":{"type":"object","required":null}}]}`
	require.NoError(t, kitutil.Unmarshal([]byte(body), &request))

	SanitizeChatRequestTools(&request)

	parameters, err := kitutil.Marshal(request.Tools[0].Function.Parameters)
	require.NoError(t, err)
	assert.JSONEq(t, `{"type":"object","properties":{"a":{"type":"object","properties":{}}},"default":{"required":null}}`, string(parameters))
	assert.JSONEq(t, `[{"name":"f","parameters":{"type":"object"}}]`, string(request.Functions))

	assert.NotPanics(t, func() { SanitizeChatRequestTools(nil) })
}

func TestSanitizeResponsesRequestTools(t *testing.T) {
	tests := []struct {
		name  string
		tools string
		want  string
	}{
		{
			name:  "drops null required in nested schemas and namespace tools",
			tools: `[{"type":"function","name":"t","parameters":{"type":"object","required":null,"properties":{"x":{"type":"array","items":{"type":"object","required":null}}}}},{"type":"namespace","name":"ns","tools":[{"type":"function","name":"n","parameters":{"type":"object","required":null}}]},{"type":"web_search"}]`,
			want:  `[{"type":"function","name":"t","parameters":{"type":"object","properties":{"x":{"type":"array","items":{"type":"object"}}}}},{"type":"namespace","name":"ns","tools":[{"type":"function","name":"n","parameters":{"type":"object"}}]},{"type":"web_search"}]`,
		},
		{
			name:  "keeps instance data under default and examples",
			tools: `[{"type":"function","name":"t","parameters":{"type":"object","required":null,"default":{"required":null},"examples":[{"required":null}]}}]`,
			want:  `[{"type":"function","name":"t","parameters":{"type":"object","default":{"required":null},"examples":[{"required":null}]}}]`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := dto.OpenAIResponsesRequest{Tools: json.RawMessage(tt.tools)}

			SanitizeResponsesRequestTools(&request)

			assert.JSONEq(t, tt.want, string(request.Tools))
		})
	}

	assert.NotPanics(t, func() { SanitizeResponsesRequestTools(nil) })
}

// A repair must not re-encode values it does not touch: decoding into any would
// round large integers through float64, and 9007199254740993 would come back as
// 9007199254740992. Byte equality on the untouched tool pins that down.
func TestSanitizeResponsesRequestToolsPreservesUntouchedBytes(t *testing.T) {
	untouched := `{"type":"function","name":"b","parameters":{"type":"object","properties":{"n":{"type":"integer","maximum":9007199254740993,"default":1.10}}}}`
	request := dto.OpenAIResponsesRequest{
		Tools: json.RawMessage(`[{"type":"function","name":"a","parameters":{"type":"object","required":null,"properties":{"m":{"type":"integer","const":9007199254740993}}}},` + untouched + `]`),
	}

	SanitizeResponsesRequestTools(&request)

	var tools []json.RawMessage
	require.NoError(t, kitutil.Unmarshal(request.Tools, &tools))
	require.Len(t, tools, 2)
	assert.Equal(t, untouched, string(tools[1]))
	assert.Contains(t, string(tools[0]), `"const":9007199254740993`)
	assert.NotContains(t, string(tools[0]), `"required"`)

	clean := json.RawMessage(`[{"type":"function","name":"t","parameters":{"type":"object","required":["a"],"maximum":9007199254740993}}]`)
	request = dto.OpenAIResponsesRequest{Tools: append(json.RawMessage(nil), clean...)}
	SanitizeResponsesRequestTools(&request)
	assert.Equal(t, string(clean), string(request.Tools))
}
