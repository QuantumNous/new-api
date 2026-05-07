package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newFeishuPermissionTestContext(role int) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("role", role)
	return ctx, recorder
}

func TestEnsureFeishuPlaintextTokenPermissionRootAllowed(t *testing.T) {
	ctx, recorder := newFeishuPermissionTestContext(common.RoleRootUser)
	system_setting.GetFeishuSettings().AllowAdminManagePlaintextTokens = false

	ok := ensureFeishuPlaintextTokenPermission(ctx)
	require.True(t, ok)
	require.Equal(t, 200, recorder.Code)
}

func TestEnsureFeishuPlaintextTokenPermissionAdminDeniedByDefault(t *testing.T) {
	ctx, recorder := newFeishuPermissionTestContext(common.RoleAdminUser)
	system_setting.GetFeishuSettings().AllowAdminManagePlaintextTokens = false

	ok := ensureFeishuPlaintextTokenPermission(ctx)
	require.False(t, ok)
	require.Equal(t, 403, recorder.Code)
}

func TestEnsureFeishuPlaintextTokenPermissionAdminAllowedWithFlag(t *testing.T) {
	ctx, recorder := newFeishuPermissionTestContext(common.RoleAdminUser)
	system_setting.GetFeishuSettings().AllowAdminManagePlaintextTokens = true
	t.Cleanup(func() {
		system_setting.GetFeishuSettings().AllowAdminManagePlaintextTokens = false
	})

	ok := ensureFeishuPlaintextTokenPermission(ctx)
	require.True(t, ok)
	require.Equal(t, 200, recorder.Code)
}

