package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureUserGroupScopeTest(t *testing.T) {
	t.Helper()
	original := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(original))
	})
}

func TestCallerCanAssignGroupRootAlwaysTrue(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleRootUser, "default", "anything"))
}

func TestCallerCanAssignGroupAdminWithinVisible(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleAdminUser, "default", "vip"))
}

func TestCallerCanAssignGroupAdminRejectsOutOfScope(t *testing.T) {
	configureUserGroupScopeTest(t)
	assert.False(t, callerCanAssignGroup(common.RoleAdminUser, "default", "svip"))
}

func TestCallerCanAssignGroupEmptyTargetAllowed(t *testing.T) {
	// 空分组交由既有默认逻辑处理，不视为越界
	configureUserGroupScopeTest(t)
	assert.True(t, callerCanAssignGroup(common.RoleAdminUser, "default", ""))
}
