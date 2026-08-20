package intelligent_routing

import (
	"strings"
	"testing"

	routingsetting "github.com/QuantumNous/new-api/setting/intelligent_routing_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatePolicyDocumentReturnsStructuredIssues(t *testing.T) {
	tests := []struct {
		name  string
		raw   string
		code  string
		field string
	}{
		{name: "malformed", raw: `{`, code: "policy.invalid_json", field: "policy"},
		{name: "too large", raw: `{"padding":"` + strings.Repeat("x", routingsetting.MaxPolicyDocumentBytes) + `"}`, code: "policy.too_large", field: "policy"},
		{name: "attempts", raw: `{"max_attempts":99}`, code: "max_attempts.out_of_range", field: "max_attempts"},
		{name: "capability", raw: `{"models":[{"model":"cheap","tier":1,"context_limit":4096,"capabilities":["telepathy"]}]}`, code: "models.capability.unknown", field: "models[0].capabilities[0]"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, issues := ValidatePolicyDocument(test.raw)
			require.NotEmpty(t, issues)
			assert.Equal(t, test.code, issues[0].Code)
			assert.Equal(t, test.field, issues[0].Field)
		})
	}
}

func TestCanonicalPolicyJSONProducesStableChecksum(t *testing.T) {
	first, issues := ValidatePolicyDocument(`{"models":[{"model":"b","tier":1,"context_limit":4096,"capabilities":["tools","json_schema"]},{"model":"a","tier":0,"context_limit":2048}]}`)
	require.Empty(t, issues)
	second, issues := ValidatePolicyDocument(`{"models":[{"model":"a","tier":0,"context_limit":2048},{"model":"b","tier":1,"context_limit":4096,"capabilities":["json_schema","tools"]}]}`)
	require.Empty(t, issues)

	assert.Equal(t, first.Checksum, second.Checksum)
	assert.Equal(t, first.JSON, second.JSON)
}
