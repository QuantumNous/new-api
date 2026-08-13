package common

import (
	"testing"

	appcommon "github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveLocalRequestFieldsPreservesPassthroughPayload(t *testing.T) {
	input := []byte(`{"model":"gpt-test","include_billing":true,"large_integer":18446744073686646784,"vendor":{"flag":true}}`)

	got, err := RemoveLocalRequestFields(input, "include_billing")

	require.NoError(t, err)
	var decoded map[string]any
	require.NoError(t, appcommon.Unmarshal(got, &decoded))
	assert.NotContains(t, decoded, "include_billing")
	assert.Contains(t, string(got), "18446744073686646784")
	assert.Contains(t, string(got), `"vendor":{"flag":true}`)
}
