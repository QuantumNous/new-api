package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func seedFixedGroupEntitlement(t *testing.T) *model.Token {
	t.Helper()
	user := &model.User{
		Id: 1, Username: "fixed-group-entitlement-user", Password: "password",
		Group: "default", AffCode: "fixed-group-entitlement-aff", Status: common.UserStatusEnabled,
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		Id: 1, UserId: user.Id, Key: "fixed-group-entitlement-token",
		Status: common.TokenStatusEnabled, UnlimitedQuota: true, ExpiredTime: -1, Group: "default",
	}
	require.NoError(t, model.DB.Create(token).Error)
	pkg := &model.EntitlementPackage{
		Name: "fixed-group-entitlement", Status: model.EntitlementStatusEnabled,
		Group: "vip", Models: "fixed-group-model", AllowPublicFallback: false,
	}
	require.NoError(t, model.SaveEntitlementPackage(pkg))
	require.NoError(t, model.UpsertUserEntitlement(&model.UserEntitlement{
		PackageId: pkg.Id, UserId: user.Id, Status: model.EntitlementStatusEnabled,
	}))
	require.NoError(t, model.SetTokenEntitlementPackages(token.Id, user.Id, []int{pkg.Id}, false))
	require.NoError(t, i18n.Init())
	return token
}

func runPlaygroundEntitlementGroupRequest(t *testing.T, token *model.Token, group string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/pg/chat/completions",
		strings.NewReader(`{"model":"fixed-group-model","group":"`+group+`"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", token.UserId)
	ctx.Set("token_id", token.Id)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")

	Distribute()(ctx)
	return recorder
}

func TestPlaygroundEntitlementCannotRewriteFixedPackageGroup(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	token := seedFixedGroupEntitlement(t)

	recorder := runPlaygroundEntitlementGroupRequest(t, token, "default")
	require.Equal(t, http.StatusForbidden, recorder.Code,
		"a playground group override must not escape the entitlement package group")
}

func TestPlaygroundEntitlementAllowsItsFixedPackageGroup(t *testing.T) {
	setupRuntimeVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })
	token := seedFixedGroupEntitlement(t)

	recorder := runPlaygroundEntitlementGroupRequest(t, token, "vip")
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code,
		"same-group request should pass entitlement authorization and fail only on missing test channel")
}
