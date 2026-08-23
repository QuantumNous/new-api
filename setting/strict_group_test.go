package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStrictGroupIsolationSettingsNormalizeAndPreserveOnError(t *testing.T) {
	original := StrictGroupIsolationGroups2JsonString()
	t.Cleanup(func() {
		require.NoError(t, UpdateStrictGroupIsolationGroupsByJsonString(original))
	})

	require.NoError(t, UpdateStrictGroupIsolationGroupsByJsonString(`[" team-b ","team-a","team-a",""]`))
	assert.Equal(t, []string{"team-a", "team-b"}, GetStrictGroupIsolationGroups())
	assert.JSONEq(t, `["team-a","team-b"]`, StrictGroupIsolationGroups2JsonString())

	assert.Error(t, UpdateStrictGroupIsolationGroupsByJsonString(`{"team-a":true}`))
	assert.Equal(t, []string{"team-a", "team-b"}, GetStrictGroupIsolationGroups())
}
