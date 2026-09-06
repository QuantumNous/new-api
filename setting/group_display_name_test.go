package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetGroupDisplayNameUsesConfiguredName(t *testing.T) {
	previous := GroupDisplayNames2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupDisplayNamesByJSONString(previous))
	})

	require.NoError(t, UpdateGroupDisplayNamesByJSONString(`{"codex1":"Codex Plus"}`))

	assert.Equal(t, "Codex Plus", GetGroupDisplayName("codex1"))
}

func TestGetGroupDisplayNameFallsBackToIdentifier(t *testing.T) {
	previous := GroupDisplayNames2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupDisplayNamesByJSONString(previous))
	})

	require.NoError(t, UpdateGroupDisplayNamesByJSONString(`{}`))

	assert.Equal(t, "legacy-group", GetGroupDisplayName("legacy-group"))
}

func TestGetGroupDisplayNameFallsBackForBlankConfiguredName(t *testing.T) {
	previous := GroupDisplayNames2JSONString()
	t.Cleanup(func() {
		require.NoError(t, UpdateGroupDisplayNamesByJSONString(previous))
	})

	require.NoError(t, UpdateGroupDisplayNamesByJSONString(`{"codex1":"   "}`))

	assert.Equal(t, "codex1", GetGroupDisplayName("codex1"))
}
