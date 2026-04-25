package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseInviteGroupUpgradeRulesJSON_NormalizeAndSort(t *testing.T) {
	rules, err := ParseInviteGroupUpgradeRulesJSON(`[
		{"invite_count":30,"target_group":"svip","enabled":true},
		{"invite_count":10,"target_group":"vip","enabled":true}
	]`)
	require.NoError(t, err)
	require.Len(t, rules, 2)
	require.Equal(t, 10, rules[0].InviteCount)
	require.Equal(t, "vip", rules[0].TargetGroup)
	require.Equal(t, 30, rules[1].InviteCount)
	require.Equal(t, "svip", rules[1].TargetGroup)
}

func TestParseInviteGroupUpgradeRulesJSON_DuplicateInviteCount(t *testing.T) {
	_, err := ParseInviteGroupUpgradeRulesJSON(`[
		{"invite_count":10,"target_group":"vip","enabled":true},
		{"invite_count":10,"target_group":"svip","enabled":true}
	]`)
	require.Error(t, err)
}
