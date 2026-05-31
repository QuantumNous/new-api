package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUpdateUserUsableGroupsByJSONStringPreservesExistingOnInvalidJSON(t *testing.T) {
	userUsableGroupsMutex.Lock()
	original := userUsableGroups
	userUsableGroups = map[string]string{
		"default": "Default group",
	}
	userUsableGroupsMutex.Unlock()
	t.Cleanup(func() {
		userUsableGroupsMutex.Lock()
		userUsableGroups = original
		userUsableGroupsMutex.Unlock()
	})

	err := UpdateUserUsableGroupsByJSONString(`{"default":`)
	require.Error(t, err)

	require.Equal(t, "Default group", GetUsableGroupDescription("default"))
}

func TestUpdateUserUsableGroupsByJSONStringReplacesExistingOnValidJSON(t *testing.T) {
	userUsableGroupsMutex.Lock()
	original := userUsableGroups
	userUsableGroups = map[string]string{
		"default": "Default group",
	}
	userUsableGroupsMutex.Unlock()
	t.Cleanup(func() {
		userUsableGroupsMutex.Lock()
		userUsableGroups = original
		userUsableGroupsMutex.Unlock()
	})

	err := UpdateUserUsableGroupsByJSONString(`{"vip":"VIP group"}`)
	require.NoError(t, err)

	require.Equal(t, "default", GetUsableGroupDescription("default"))
	require.Equal(t, "VIP group", GetUsableGroupDescription("vip"))
}
