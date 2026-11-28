package gemini

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Reproduces the production 400: a property carries items without a usable
// type, so Gemini rejects the call with
// field predicate failed: $type == Type.ARRAY.
func TestCleanFunctionParameters_GeminiItemsType(t *testing.T) {
	cases := []struct {
		name          string
		in            string
		property      string
		wantType      string
		wantNullable  bool
		wantItemsType string
	}{
		{
			name:     "missing type with items",
			in:       `{"type":"object","properties":{"source_paths":{"items":{"type":"string"}}}}`,
			property: "source_paths",
			wantType: "ARRAY",
		},
		{
			name:     "non-standard type list",
			in:       `{"type":"object","properties":{"source_paths":{"type":"list","items":{"type":"string"}}}}`,
			property: "source_paths",
			wantType: "ARRAY",
		},
		{
			name:     "non-standard type List[str]",
			in:       `{"type":"object","properties":{"source_paths":{"type":"List[str]","items":{"type":"string"}}}}`,
			property: "source_paths",
			wantType: "ARRAY",
		},
		{
			name:     "type contradicts items",
			in:       `{"type":"object","properties":{"source_paths":{"type":"string","items":{"type":"string"}}}}`,
			property: "source_paths",
			wantType: "ARRAY",
		},
		{
			name:          "nullable array form",
			in:            `{"type":"object","properties":{"source_paths":{"type":["array","null"],"items":{"type":"string"}}}}`,
			property:      "source_paths",
			wantType:      "ARRAY",
			wantNullable:  true,
			wantItemsType: "STRING",
		},
		{
			name:          "standard form unchanged",
			in:            `{"type":"object","properties":{"source_paths":{"type":"array","items":{"type":"string"}}}}`,
			property:      "source_paths",
			wantType:      "ARRAY",
			wantItemsType: "STRING",
		},
		{
			name:          "empty tuple items keeps an element schema",
			in:            `{"type":"object","properties":{"source_paths":{"type":"array","items":[]}}}`,
			property:      "source_paths",
			wantType:      "ARRAY",
			wantItemsType: "STRING",
		},
		{
			name:     "missing type with properties infers OBJECT",
			in:       `{"type":"object","properties":{"cfg":{"properties":{"a":{"type":"string"}}}}}`,
			property: "cfg",
			wantType: "OBJECT",
		},
		{
			name:          "nested array",
			in:            `{"type":"object","properties":{"m":{"items":{"items":{"type":"string"}}}}}`,
			property:      "m",
			wantType:      "ARRAY",
			wantItemsType: "ARRAY",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var in map[string]any
			require.NoError(t, kitutil.Unmarshal([]byte(tc.in), &in))

			out, ok := CleanFunctionParameters(in).(map[string]any)
			require.True(t, ok)

			props, ok := out["properties"].(map[string]any)
			require.True(t, ok)
			node, ok := props[tc.property].(map[string]any)
			require.True(t, ok, "property %s missing from %v", tc.property, props)

			assert.Equal(t, tc.wantType, node["type"], "node: %v", node)
			if tc.wantNullable {
				assert.Equal(t, true, node["nullable"], "node: %v", node)
			}
			if tc.wantItemsType != "" {
				items, isMap := node["items"].(map[string]any)
				require.True(t, isMap, "items missing on node: %v", node)
				assert.Equal(t, tc.wantItemsType, items["type"], "items: %v", items)
			}
			// Gemini's hard constraint: a node carrying items is an ARRAY.
			if _, hasItems := node["items"]; hasItems {
				assert.Equal(t, "ARRAY", node["type"], "node with items is not an ARRAY: %v", node)
			}
		})
	}
}

// The allow-list still drops keywords Gemini's typed Schema cannot hold.
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

	out, ok := CleanFunctionParameters(in).(map[string]any)
	require.True(t, ok)

	for _, key := range []string{"$schema", "additionalProperties", "oneOf"} {
		assert.NotContains(t, out, key)
	}

	props, ok := out["properties"].(map[string]any)
	require.True(t, ok)
	a, ok := props["a"].(map[string]any)
	require.True(t, ok)
	for _, key := range []string{"$ref", "examples"} {
		assert.NotContains(t, a, key)
	}
	assert.Equal(t, "STRING", a["type"])
}
