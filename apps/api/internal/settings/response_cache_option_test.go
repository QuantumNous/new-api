package settings

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestResponseCacheOptionApplyContract pins the option wiring for the model
// response cache: seeding publishes defaults, ApplyOption reaches the runtime
// common fields the relay reads, and bad numeric values are rejected.
func TestResponseCacheOptionApplyContract(t *testing.T) {
	previousMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousMap })

	previousEnabled := common.ResponseCacheEnabled
	previousTTL := common.ResponseCacheTtlSeconds
	previousEntries := common.ResponseCacheMaxEntries
	previousSize := common.ResponseCacheMaxBodySize
	t.Cleanup(func() {
		common.ResponseCacheEnabled = previousEnabled
		common.ResponseCacheTtlSeconds = previousTTL
		common.ResponseCacheMaxEntries = previousEntries
		common.ResponseCacheMaxBodySize = previousSize
	})

	SeedOptionMap()
	assert.Equal(t, "false", common.OptionMap["ResponseCacheEnabled"],
		"the cache must seed disabled: it holds user conversation content")

	// Hot-reload the switch through the same path the admin option update uses.
	require.NoError(t, ApplyOption("ResponseCacheEnabled", "true"))
	assert.True(t, common.ResponseCacheEnabled)
	assert.Equal(t, "true", common.OptionMap["ResponseCacheEnabled"])

	// Turning it back off must also reach the runtime field.
	require.NoError(t, ApplyOption("ResponseCacheEnabled", "false"))
	assert.False(t, common.ResponseCacheEnabled)

	// Numeric knobs reach their runtime fields.
	require.NoError(t, ApplyOption("ResponseCacheTtlSeconds", "120"))
	assert.Equal(t, 120, common.ResponseCacheTtlSeconds)
	require.NoError(t, ApplyOption("ResponseCacheMaxEntries", "50"))
	assert.Equal(t, 50, common.ResponseCacheMaxEntries)

	// Non-integer and negative values are rejected before they are applied.
	assert.Error(t, ValidateOptionValue("ResponseCacheTtlSeconds", "abc"))
	assert.Error(t, ValidateOptionValue("ResponseCacheMaxEntries", "-1"))
	assert.Error(t, ValidateOptionValue("ResponseCacheMaxBodySize", "x"))
	// 0 is accepted (responsecache.SetConfig resets it to the default).
	require.NoError(t, ValidateOptionValue("ResponseCacheMaxBodySize", "0"))
}
