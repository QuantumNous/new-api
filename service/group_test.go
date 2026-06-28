package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRequestAutoGroupFiltersRouteScopedGroups(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUserGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUserGroups))
	})
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["codex","codex-pro","codex-completions"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"codex":"Codex","codex-pro":"Codex Pro","codex-completions":"Codex Completions"}`))

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyRouteAutoGroups, []string{"codex", "codex-pro"})

	groups := GetRequestAutoGroup(ctx, "default")

	require.Equal(t, []string{"codex", "codex-pro"}, groups)
}
