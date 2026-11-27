package claude

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFunctionParametersToInputSchemaFlattensTopLevelUnion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		in        string
		want      string
		flattened []string
	}{
		{
			name: "no union keeps the client's bytes",
			in:   `{"type":"object","properties":{"z":{"type":"string"},"a":{"type":"integer","anyOf":[{"minimum":1}]}},"required":["z"]}`,
			want: `{"type":"object","properties":{"z":{"type":"string"},"a":{"type":"integer","anyOf":[{"minimum":1}]}},"required":["z"]}`,
		},
		{
			name:      "oneOf with disjoint properties",
			in:        `{"description":"Update an automation","oneOf":[{"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"}},"required":["id","name"]},{"type":"object","properties":{"id":{"type":"string"},"enabled":{"type":"boolean"}},"required":["id","enabled"]}],"additionalProperties":false}`,
			want:      `{"description":"Update an automation","additionalProperties":false,"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"enabled":{"type":"boolean"}},"required":["id"]}`,
			flattened: []string{"oneOf"},
		},
		{
			name:      "same-name properties with different schemas become anyOf",
			in:        `{"anyOf":[{"properties":{"when":{"type":"string"}}},{"properties":{"when":{"type":"integer"}}},{"properties":{"when":{ "type" : "string" }}}]}`,
			want:      `{"type":"object","properties":{"when":{"anyOf":[{"type":"string"},{"type":"integer"}]}}}`,
			flattened: []string{"anyOf"},
		},
		{
			name:      "allOf required is the union plus the top level's",
			in:        `{"type":"object","required":["mode"],"properties":{"mode":{"type":"string"}},"allOf":[{"properties":{"a":{"type":"string"}},"required":["a"]},{"properties":{"b":{"type":"string"}},"required":["b","a"]}]}`,
			want:      `{"type":"object","required":["mode","a","b"],"properties":{"mode":{"type":"string"},"a":{"type":"string"},"b":{"type":"string"}}}`,
			flattened: []string{"allOf"},
		},
		{
			name:      "branches without properties contribute nothing and empty required is dropped",
			in:        `{"oneOf":[{"properties":{"id":{"type":"string"}},"required":["id"]},{"required":["id"]},{"type":"object"}]}`,
			want:      `{"type":"object","properties":{"id":{"type":"string"}}}`,
			flattened: []string{"oneOf"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, flattened, ok := FunctionParametersToInputSchema(json.RawMessage(tt.in))
			require.True(t, ok)
			assert.Equal(t, tt.flattened, flattened)
			if tt.flattened == nil {
				assert.Equal(t, tt.want, string(got))
				return
			}
			assert.JSONEq(t, tt.want, string(got))
		})
	}
}
