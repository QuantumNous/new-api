package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Admin model-square pricing should expose every billable group, not only the
// groups selectable by the admin's own account group. Regression test for the
// case where an admin in the "default" group could not see prices for a group
// ("c") that is restricted to c-group accounts.
func TestAdminUsableGroupsIncludesNonSelectableBillableGroups(t *testing.T) {
	configured := map[string]string{
		"default": "默认分组",
		"b":       "b分组",
	}
	groupRatio := map[string]float64{
		"default": 1,
		"b":       1,
		"c":       1, // billable but NOT in user-usable groups
	}

	got := adminUsableGroups(configured, groupRatio, "default")

	require.Contains(t, got, "c", "admin must see the restricted c group")
	require.Contains(t, got, "b")
	require.Contains(t, got, "default")
	require.Equal(t, "b分组", got["b"], "configured descriptions are preserved")
	require.Equal(t, "c", got["c"], "ratio-only groups fall back to the group name as description")
}

func TestAdminUsableGroupsAddsOwnGroupWhenMissing(t *testing.T) {
	got := adminUsableGroups(map[string]string{}, map[string]float64{}, "vip")
	require.Contains(t, got, "vip")
}

func TestAdminUsableGroupsDoesNotMutateInputs(t *testing.T) {
	configured := map[string]string{"default": "默认"}
	groupRatio := map[string]float64{"c": 1}

	_ = adminUsableGroups(configured, groupRatio, "default")

	require.Len(t, configured, 1, "input configured map must not be mutated")
	require.NotContains(t, configured, "c")
}
