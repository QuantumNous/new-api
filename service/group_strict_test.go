package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStrictGroupIsolationRestrictsEffectiveGroups(t *testing.T) {
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"team-a":"Team A","team-b":"Team B","auto":"Auto"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	assert.Equal(t, map[string]string{"team-a": "Team A"}, GetUserUsableGroups("team-a"))
	assert.True(t, IsTokenGroupAllowed("team-a", ""))
	assert.True(t, IsTokenGroupAllowed("team-a", "team-a"))
	assert.False(t, IsTokenGroupAllowed("team-a", "team-b"))
	assert.False(t, IsTokenGroupAllowed("team-a", "auto"))
	assert.Empty(t, GetUserAutoGroup("team-a"))

	assert.True(t, IsTokenGroupAllowed("team-b", "team-a"), "non-strict groups retain legacy behavior")
}
